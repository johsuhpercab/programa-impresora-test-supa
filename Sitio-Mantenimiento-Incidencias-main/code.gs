/**
 * Sistema de Gestión — Google Apps Script Backend
 * Deploy as Web App → Execute as: Me → Who has access: Anyone
 *
 * Self-initializing: all sheets and default data are created automatically
 * on first use. No manual setup needed.
 */

const SHEET_ID = '1msNplZKo4KbDlKbUwWYoisxqOftZ1xbXX2rs6KdeqT8';

// ── Auto-init ────────────────────────────────────────────────────────────────
function setupIfNeeded() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('initialized') === 'true') return; // Fast exit after first run
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);

  // Salas
  let salas = ss.getSheetByName('Salas');
  if (!salas) {
    salas = ss.insertSheet('Salas');
    salas.appendRow(['id', 'nombre']);
    salas.setFrozenRows(1);
    // Seed default salas
    salas.appendRow(['1', 'Espacio Maker']);
    salas.appendRow(['2', 'Espacio Robot']);
  }

  // Equipos
  let equipos = ss.getSheetByName('Equipos');
  if (!equipos) {
    equipos = ss.insertSheet('Equipos');
    equipos.appendRow(['id', 'sala_id', 'nombre', 'tipo', 'modelo', 'estado', 'frecuencia_dias', 'ultimo_mantenimiento']);
    equipos.setFrozenRows(1);
  }

  // Operarios
  let operarios = ss.getSheetByName('Operarios');
  if (!operarios) {
    operarios = ss.insertSheet('Operarios');
    operarios.appendRow(['id', 'nombre', 'pin', 'activo', 'creado_en']);
    operarios.setFrozenRows(1);
  }

  // Usuarios
  let usuarios = ss.getSheetByName('Usuarios');
  if (!usuarios) {
    usuarios = ss.insertSheet('Usuarios');
    usuarios.appendRow(['id', 'nombre', 'email', 'rol', 'activo', 'creado_en']);
    usuarios.setFrozenRows(1);
  }

  // Registros
  let registros = ss.getSheetByName('Registros');
  if (!registros) {
    registros = ss.insertSheet('Registros');
    registros.appendRow(['id', 'timestamp', 'activo_id', 'activo_nombre', 'sala_nombre', 'operario_nombre', 'tipo', 'notas']);
    registros.setFrozenRows(1);
  }

  // Configuración
  let config = ss.getSheetByName('Config');
  if (!config) {
    config = ss.insertSheet('Config');
    config.appendRow(['clave', 'valor', 'descripcion']);
    config.setFrozenRows(1);
    config.appendRow(['admin_pin', '1234', 'PIN global de acceso al panel de administración']);
  }

  props.setProperty('initialized', 'true');
}

function getAdminPin() {
  const sheet = getSheet('Config');
  const rows = getRowsToObjects(sheet);
  const row = rows.find(r => r.clave === 'admin_pin');
  return row ? String(row.valor).trim() : '1234';
}

function checkAuth(pin) {
  if (!pin) return false;
  return String(pin).trim() === getAdminPin();
}

// ── Entry points ─────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    setupIfNeeded();
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const pin = data.auth_pin;

    // Acciones Públicas (Operario)
    if (action === 'verificarPin')    return verificarPin(data.payload.pin);
    if (action === 'enviarIncidencia') return guardarIncidencia(data);

    // Login Admin
    if (action === 'loginAdmin') {
       if (checkAuth(pin)) return json({ ok: true, message: 'Acceso concedido' });
       return json({ ok: false, error: 'PIN de Administrador incorrecto' });
    }

    // Acciones Protegidas
    if (!checkAuth(pin)) return json({ ok: false, error: 'No autorizado. Se requiere PIN de Administrador.', code: 403 });

    if (action === 'manageMaquinas')  return handleMaquinas(data);
    if (action === 'manageOperarios') return handleOperarios(data);
    if (action === 'manageUsuarios')  return handleUsuarios(data);

    return json({ status: 'error', error: 'Action not found or protected: ' + action });
  } catch (err) {
    return json({ status: 'error', error: err.message });
  }
}

function doGet(e) {
  try {
    setupIfNeeded();
    const action = e && e.parameter && e.parameter.action;
    const pin = e && e.parameter && e.parameter.auth_pin;

    // Acciones Públicas
    if (action === 'getSalas')       return getSalas();
    if (action === 'getMaquinas')    return getMaquinas();
    if (action === 'getMaquinaById') return getMaquinaById(e.parameter.id);

    // Acciones Protegidas (Dashboard / Admin)
    if (!checkAuth(pin)) return json({ ok: false, error: 'Acceso Denegado. PIN incorrecto.', code: 403 });

    if (action === 'getOperarios')   return getOperarios();
    if (action === 'getUsuarios')    return getUsuarios();
    if (action === 'getDashboard')   return getDashboard();
    if (action === 'getHistorial')   return getHistorial();

    return json({ status: 'ok', message: 'API del Sistema de Gestión activo y configurado.' });
  } catch (err) {
    return json({ status: 'error', error: err.message });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(name);
}

function getRowsToObjects(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0].map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    let obj = { _rowIndex: i + 1 };
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

// ── Salas ────────────────────────────────────────────────────────────────────
function getSalas() {
  const rows = getRowsToObjects(getSheet('Salas'));
  return json({ ok: true, data: rows });
}

// ── Máquinas ─────────────────────────────────────────────────────────────────
function getMaquinas() {
  const salas    = getRowsToObjects(getSheet('Salas'));
  const maquinas = getRowsToObjects(getSheet('Equipos'));
  const hoy      = new Date();

  const data = maquinas.map(m => {
    const sala  = salas.find(s => s.id === m.sala_id);
    const frec  = parseInt(m.frecuencia_dias) || 7;
    let estadoMant = 'pendiente';

    if (m.ultimo_mantenimiento) {
      const ult     = new Date(m.ultimo_mantenimiento);
      const difDias = (hoy - ult) / (1000 * 60 * 60 * 24);
      if      (difDias > frec)       estadoMant = 'vencido';
      else if (difDias > frec * 0.8) estadoMant = 'proximo';
      else                           estadoMant = 'ok';
    }

    return {
      id:                 m.id,
      nombre:             m.nombre,
      tipo:               m.tipo,
      sala_nombre:        sala ? sala.nombre : 'Sin sala',
      sala_id:            m.sala_id,
      modelo:             m.modelo,
      frecuencia_dias:    frec,
      estado:             m.estado,
      ultimo_mantenimiento: m.ultimo_mantenimiento,
      estado_mantenimiento: estadoMant
    };
  });

  return json({ ok: true, data });
}

function getMaquinaById(id) {
  const all = JSON.parse(getMaquinas().getContent()).data;
  const m   = all.find(x => x.id == id || x.nombre === id);
  if (!m) return json({ ok: false, error: 'Máquina no encontrada' });
  return json({ ok: true, data: m });
}

function handleMaquinas(data) {
  const sheet = getSheet('Equipos');

  if (data.method === 'POST') {
    const id = new Date().getTime().toString();
    sheet.appendRow([
      id,
      data.payload.sala_id,
      data.payload.nombre,
      data.payload.tipo    || 'Impresora FDM',
      data.payload.modelo  || '',
      data.payload.estado  || 'activa',
      data.payload.frecuencia_dias || 7,
      ''
    ]);
    return json({ ok: true, data: { id } });
  }

  if (data.method === 'PUT') {
    const rows = getRowsToObjects(sheet);
    const m    = rows.find(x => x.id == data.id);
    if (m) {
      sheet.getRange(m._rowIndex, 2, 1, 6).setValues([[
        data.payload.sala_id       || m.sala_id,
        data.payload.nombre        || m.nombre,
        data.payload.tipo          || m.tipo,
        data.payload.modelo        || m.modelo,
        data.payload.estado        || m.estado,
        data.payload.frecuencia_dias || m.frecuencia_dias
      ]]);
    }
    return json({ ok: true });
  }

  if (data.method === 'DELETE') {
    const rows = getRowsToObjects(sheet);
    const m    = rows.find(x => x.id === data.id);
    if (m) sheet.deleteRow(m._rowIndex);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Método no reconocido' });
}

// ── Operarios ────────────────────────────────────────────────────────────────
function getOperarios() {
  const rows = getRowsToObjects(getSheet('Operarios'))
    .filter(o => o.activo == '1' || o.activo === 'true')
    .map(o => ({ id: o.id, nombre: o.nombre, pin: '****', creado_en: o.creado_en }));
  return json({ ok: true, data: rows });
}

function handleOperarios(data) {
  const sheet = getSheet('Operarios');

  if (data.method === 'POST') {
    const id = new Date().getTime().toString();
    // Forzamos formato texto con ' para evitar que Google Sheets borre ceros a la izquierda
    sheet.appendRow([id, data.payload.nombre, "'" + data.payload.pin, '1', new Date().toISOString()]);
    return json({ ok: true, data: { id } });
  }

  if (data.method === 'DELETE') {
    const rows = getRowsToObjects(sheet);
    const o    = rows.find(x => x.id == data.id);
    if (o) sheet.getRange(o._rowIndex, 4).setValue('0');
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Método no reconocido' });
}

function verificarPin(pin) {
  const rows = getRowsToObjects(getSheet('Operarios'));
  const o = rows.find(x => {
    // Comparación robusta: manejamos strings ("0000") y números (0)
    const pinBD = String(x.pin || "").trim();
    const pinUser = String(pin || "").trim();
    const matchPin = (pinBD == pinUser) || (Number(pinBD) === Number(pinUser));
    const matchActivo = (x.activo == '1' || x.activo === 'true' || x.activo === 1);
    return matchPin && matchActivo;
  });
  if (o) return json({ ok: true, data: { id: o.id, nombre: o.nombre } });
  return json({ ok: false, error: 'PIN incorrecto' });
}

// ── Usuarios ─────────────────────────────────────────────────────────────────
function getUsuarios() {
  const rows = getRowsToObjects(getSheet('Usuarios'))
    .filter(u => u.activo == '1' || u.activo === 'true')
    .map(u => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, creado_en: u.creado_en, activo: true }));
  return json({ ok: true, data: rows });
}

function handleUsuarios(data) {
  const sheet = getSheet('Usuarios');

  if (data.method === 'POST') {
    const id = new Date().getTime().toString();
    sheet.appendRow([id, data.payload.nombre, data.payload.email, data.payload.rol, '1', new Date().toISOString()]);
    return json({ ok: true });
  }

  if (data.method === 'DELETE') {
    const rows = getRowsToObjects(sheet);
    const u    = rows.find(x => x.id == data.id);
    if (u) sheet.getRange(u._rowIndex, 5).setValue('0');
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Método no reconocido' });
}

// ── Incidencias / Registros ───────────────────────────────────────────────────
function guardarIncidencia(data) {
  const sheet = getSheet('Registros');
  const ts    = new Date().toISOString();
  const id    = new Date().getTime().toString();

  sheet.appendRow([
    id, ts,
    data.payload.maquina_id      || '',
    data.payload.maquina_nombre  || '',
    data.payload.sala_nombre     || '',
    data.payload.operario_nombre || '',
    data.payload.tipo,
    data.payload.notas
  ]);

  // Actualizar ultimo_mantenimiento en la máquina
  if (data.payload.maquina_id) {
    const mSheet = getSheet('Equipos');
    const mRows  = getRowsToObjects(mSheet);
    const m      = mRows.find(x => x.id == data.payload.maquina_id);
    if (m) mSheet.getRange(m._rowIndex, 8).setValue(ts);
  }

  return json({ ok: true, data: { id } });
}

function getHistorial() {
  const rows = getRowsToObjects(getSheet('Registros'));
  const data = rows.map(r => ({
    id:            r.id,
    maquina:       r.activo_nombre || r.activo_id,
    sala:          r.sala_nombre,
    operario:      r.operario_nombre,
    iniciado_en:   r.timestamp,
    completado_en: r.timestamp,
    observaciones: r.notas,
    tipo:          r.tipo
  })).reverse();
  return json({ ok: true, data });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function getDashboard() {
  const hist = JSON.parse(getHistorial().getContent()).data;
  const maq  = JSON.parse(getMaquinas().getContent()).data;

  const hoyDate = new Date().toISOString().split('T')[0];
  const last7   = new Date(); last7.setDate(last7.getDate() - 7);
  let hoy = 0, semana = 0;
  const porDiaMap = {};

  hist.forEach(h => {
    const d = (h.completado_en || '').split('T')[0];
    if (d === hoyDate) hoy++;
    if (new Date(h.completado_en) >= last7) semana++;
    porDiaMap[d] = (porDiaMap[d] || 0) + 1;
  });

  const porDia = Object.keys(porDiaMap).sort().slice(-14).map(k => ({ dia: k, total: porDiaMap[k] }));

  let pendientes = 0, proximos = 0;
  const porMaquina = [];

  maq.forEach(m => {
    if (m.estado_mantenimiento === 'pendiente' || m.estado_mantenimiento === 'vencido') pendientes++;
    if (m.estado_mantenimiento === 'proximo') proximos++;
    const count = hist.filter(h => h.maquina === m.nombre).length;
    if (count > 0) porMaquina.push({ nombre: m.nombre, total_sesiones: count });
  });

  porMaquina.sort((a, b) => b.total_sesiones - a.total_sesiones);

  return json({ ok: true, data: { hoy, semana, pendientes, proximos, porDia, porMaquina } });
}
