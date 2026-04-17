'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.VERCEL ? { rejectUnauthorized: false } : false
});

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

// ─── Funciones de consulta ────────────────────────────────────────────────────

async function getSalas() {
  return query('SELECT * FROM salas ORDER BY nombre');
}

async function getMaquinas(salaId) {
  const sql = `
    SELECT m.*, s.nombre as sala_nombre,
      CASE
        WHEN m.ultimo_mantenimiento IS NULL THEN 'pendiente'
        WHEN NOW() - m.ultimo_mantenimiento > make_interval(days => m.frecuencia_dias) THEN 'vencido'
        WHEN NOW() - m.ultimo_mantenimiento > make_interval(days => (m.frecuencia_dias * 0.8)::int) THEN 'proximo'
        ELSE 'ok'
      END as estado_mantenimiento
    FROM maquinas m
    JOIN salas s ON s.id = m.sala_id
    ${salaId ? 'WHERE m.sala_id = $1 ORDER BY m.nombre' : 'ORDER BY s.nombre, m.nombre'}
  `;
  return salaId ? query(sql, [salaId]) : query(sql);
}

async function getMaquinaById(id) {
  return queryOne(`
    SELECT m.*, s.nombre as sala_nombre,
      CASE
        WHEN m.ultimo_mantenimiento IS NULL THEN 'pendiente'
        WHEN NOW() - m.ultimo_mantenimiento > make_interval(days => m.frecuencia_dias) THEN 'vencido'
        WHEN NOW() - m.ultimo_mantenimiento > make_interval(days => (m.frecuencia_dias * 0.8)::int) THEN 'proximo'
        ELSE 'ok'
      END as estado_mantenimiento
    FROM maquinas m
    JOIN salas s ON s.id = m.sala_id
    WHERE m.id = $1
  `, [id]);
}

async function verificarPin(pin) {
  return queryOne('SELECT * FROM operarios WHERE pin = $1 AND activo = 1', [pin]);
}

async function iniciarSesion(maquinaId, operarioId) {
  await query(`
    UPDATE sesiones_mantenimiento SET estado = 'abandonada'
    WHERE maquina_id = $1 AND estado = 'en_progreso'
  `, [maquinaId]);

  const rows = await query(
    'INSERT INTO sesiones_mantenimiento (maquina_id, operario_id) VALUES ($1, $2) RETURNING id',
    [maquinaId, operarioId]
  );
  return rows[0].id;
}

async function completarSesion(sesionId, observaciones) {
  const sesion = await queryOne('SELECT * FROM sesiones_mantenimiento WHERE id = $1', [sesionId]);
  if (!sesion) throw new Error('Sesión no encontrada');
  if (!observaciones || observaciones.trim() === '') throw new Error('El reporte del problema es obligatorio');

  await query(`
    UPDATE sesiones_mantenimiento
    SET estado = 'completada', observaciones = $1, completado_en = NOW()
    WHERE id = $2
  `, [observaciones, sesionId]);

  await query(
    'UPDATE maquinas SET ultimo_mantenimiento = NOW() WHERE id = $1',
    [sesion.maquina_id]
  );

  return true;
}

async function getDashboard() {
  const hoy = await queryOne(`SELECT COUNT(*) as total FROM sesiones_mantenimiento WHERE estado = 'completada' AND DATE(completado_en) = CURRENT_DATE`);
  const semana = await queryOne(`SELECT COUNT(*) as total FROM sesiones_mantenimiento WHERE estado = 'completada' AND completado_en >= NOW() - INTERVAL '7 days'`);
  const pendientes = await queryOne(`SELECT COUNT(*) as total FROM maquinas WHERE estado = 'activa' AND (ultimo_mantenimiento IS NULL OR NOW() - ultimo_mantenimiento > make_interval(days => frecuencia_dias))`);
  const proximos = await queryOne(`SELECT COUNT(*) as total FROM maquinas WHERE estado = 'activa' AND ultimo_mantenimiento IS NOT NULL AND NOW() - ultimo_mantenimiento > make_interval(days => (frecuencia_dias * 0.8)::int) AND NOW() - ultimo_mantenimiento <= make_interval(days => frecuencia_dias)`);
  const porDia = await query(`SELECT DATE(completado_en) as dia, COUNT(*) as total FROM sesiones_mantenimiento WHERE estado = 'completada' AND completado_en >= NOW() - INTERVAL '30 days' GROUP BY dia ORDER BY dia`);
  const porMaquina = await query(`SELECT m.nombre, m.tipo, s.nombre as sala, COUNT(sm.id) as total_sesiones, MAX(sm.completado_en) as ultimo_mantenimiento FROM maquinas m LEFT JOIN salas s ON s.id = m.sala_id LEFT JOIN sesiones_mantenimiento sm ON sm.maquina_id = m.id AND sm.estado = 'completada' GROUP BY m.id, m.nombre, m.tipo, s.nombre ORDER BY s.nombre, m.nombre`);

  return {
    hoy: parseInt(hoy.total),
    semana: parseInt(semana.total),
    pendientes: parseInt(pendientes.total),
    proximos: parseInt(proximos.total),
    porDia,
    porMaquina
  };
}

async function getHistorial(filtros = {}) {
  let conditions = ["sm.estado = 'completada'"];
  const params = [];
  let i = 1;

  if (filtros.sala_id) { conditions.push(`m.sala_id = $${i++}`); params.push(filtros.sala_id); }
  if (filtros.maquina_id) { conditions.push(`sm.maquina_id = $${i++}`); params.push(filtros.maquina_id); }
  if (filtros.operario_id) { conditions.push(`sm.operario_id = $${i++}`); params.push(filtros.operario_id); }
  if (filtros.desde) { conditions.push(`DATE(sm.completado_en) >= $${i++}`); params.push(filtros.desde); }
  if (filtros.hasta) { conditions.push(`DATE(sm.completado_en) <= $${i++}`); params.push(filtros.hasta); }

  const where = 'WHERE ' + conditions.join(' AND ');

  return query(`
    SELECT sm.id, sm.iniciado_en, sm.completado_en, sm.observaciones,
      m.nombre as maquina, m.tipo as tipo_maquina, s.nombre as sala, o.nombre as operario
    FROM sesiones_mantenimiento sm
    JOIN maquinas m ON m.id = sm.maquina_id
    JOIN salas s ON s.id = m.sala_id
    JOIN operarios o ON o.id = sm.operario_id
    ${where}
    ORDER BY sm.completado_en DESC LIMIT 200
  `, params);
}

async function getOperarios() {
  return query('SELECT id, nombre, activo, creado_en FROM operarios WHERE activo = 1 ORDER BY nombre');
}

async function crearOperario(nombre, pin) {
  const existe = await queryOne('SELECT id FROM operarios WHERE pin = $1', [pin]);
  if (existe) throw new Error('Ya existe un operario con ese PIN');
  const rows = await query('INSERT INTO operarios (nombre, pin) VALUES ($1, $2) RETURNING id', [nombre, pin]);
  return rows[0].id;
}

async function getUsuarios() {
  return query('SELECT id, nombre, email, rol, activo, creado_en FROM usuarios ORDER BY nombre');
}

async function crearUsuario(nombre, email, rol) {
  if (email) {
    const existe = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe) throw new Error('Ya existe un usuario con ese email');
  }
  const rows = await query('INSERT INTO usuarios (nombre, email, rol) VALUES ($1, $2, $3) RETURNING id', [nombre, email || null, rol || 'usuario']);
  return rows[0].id;
}

async function eliminarUsuario(id) {
  await query('UPDATE usuarios SET activo = 0 WHERE id = $1', [id]);
  return true;
}

async function actualizarMaquina(id, datos) {
  await query(`
    UPDATE maquinas SET nombre = $1, tipo = $2, modelo = $3, frecuencia_dias = $4, estado = $5
    WHERE id = $6
  `, [datos.nombre, datos.tipo, datos.modelo, datos.frecuencia_dias, datos.estado, id]);
  return true;
}

async function getSesionDetalle(sesionId) {
  const sesion = await queryOne(`
    SELECT sm.*, m.nombre as maquina, o.nombre as operario, s.nombre as sala
    FROM sesiones_mantenimiento sm
    JOIN maquinas m ON m.id = sm.maquina_id
    JOIN salas s ON s.id = m.sala_id
    JOIN operarios o ON o.id = sm.operario_id
    WHERE sm.id = $1
  `, [sesionId]);
  if (!sesion) return null;
  return { sesion, items: [] };
}

async function crearMaquina(datos) {
  const rows = await query(
    'INSERT INTO maquinas (sala_id, nombre, tipo, modelo, estado, frecuencia_dias) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [datos.sala_id, datos.nombre, datos.tipo || 'Impresora 3D', datos.modelo || '', datos.estado || 'activa', datos.frecuencia_dias || 7]
  );
  return rows[0].id;
}

async function eliminarMaquina(id) {
  await query('DELETE FROM sesiones_mantenimiento WHERE maquina_id = $1', [id]);
  await query('DELETE FROM maquinas WHERE id = $1', [id]);
  return true;
}

async function crearIncidencia(maquinaNombre, tipo, notas, fotos) {
  const maquina = await queryOne('SELECT id FROM maquinas WHERE nombre = $1 LIMIT 1', [maquinaNombre]);
  const fotosJson = JSON.stringify(fotos || []);
  const rows = await query(
    'INSERT INTO incidencias (maquina_nombre, maquina_id, tipo, notas, fotos) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [maquinaNombre, maquina ? maquina.id : null, tipo, notas || '', fotosJson]
  );
  return rows[0].id;
}

async function getIncidencias(filtros = {}) {
  let conditions = [];
  const params = [];
  let i = 1;

  if (filtros.maquina_nombre) { conditions.push(`maquina_nombre ILIKE $${i++}`); params.push('%' + filtros.maquina_nombre + '%'); }
  if (filtros.tipo) { conditions.push(`tipo = $${i++}`); params.push(filtros.tipo); }
  if (filtros.desde) { conditions.push(`DATE(timestamp) >= $${i++}`); params.push(filtros.desde); }
  if (filtros.hasta) { conditions.push(`DATE(timestamp) <= $${i++}`); params.push(filtros.hasta); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  return query(`
    SELECT id, maquina_nombre, maquina_id, tipo, notas, fotos, timestamp
    FROM incidencias ${where}
    ORDER BY timestamp DESC LIMIT 200
  `, params);
}

module.exports = {
  getSalas, getMaquinas, getMaquinaById,
  verificarPin, iniciarSesion, completarSesion,
  getDashboard, getHistorial, getOperarios, crearOperario,
  actualizarMaquina, crearMaquina, eliminarMaquina, getSesionDetalle,
  getUsuarios, crearUsuario, eliminarUsuario,
  crearIncidencia, getIncidencias
};