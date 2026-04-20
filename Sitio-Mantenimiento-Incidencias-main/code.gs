/**
 * MantApp — Google Apps Script Backend (Fused with Public Admin)
 * Deploy as Web App → Execute as: Me → Who has access: Anyone
 */

// ─── Configure these ──────────────────────────────────────
const SHEET_ID    = 'TU_SHEET_ID_AQUI'; // from the Sheet URL
const FOLDER_ID   = ''; // Drive folder ID for photos (leave '' to skip)
// ─────────────────────────────────────────────────────────

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'manageMaquinas') {
      return handleMaquinas(data);
    }
    if (action === 'manageOperarios') {
      return handleOperarios(data);
    }
    if (action === 'manageUsuarios') {
      return handleUsuarios(data);
    }
    if (action === 'verificarPin') {
      return verificarPin(data.pin);
    }
    if (action === 'enviarIncidencia') {
      return guardarIncidencia(data);
    }

    return json({ status: 'error', error: 'Action not found' });
  } catch (err) {
    return json({ status: 'error', error: err.message });
  }
}

function doGet(e) {
  const action = e && e.parameter && e.parameter.action;

  if (action === 'getSalas') return getSalas();
  if (action === 'getMaquinas') return getMaquinas();
  if (action === 'getOperarios') return getOperarios();
  if (action === 'getUsuarios') return getUsuarios();
  if (action === 'getDashboard') return getDashboard();
  if (action === 'getHistorial') return getHistorial();
  if (action === 'getMaquinaById') return getMaquinaById(e.parameter.id);

  return json({ status: 'ok', message: 'MantApp API backend activo.' });
}

// ── Helpers ────────────────────────────────────────────────
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers) {
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function getRowsToObjects(sheet) {
  if (sheet.getLastRow() < 2) return [];
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

// ── Salas ────────────────────────────────────────────────
function getSalas() {
  const sheet = getSheet('Salas', ['id', 'nombre']);
  const rows = getRowsToObjects(sheet);
  return json({ ok: true, data: rows });
}

// ── Máquinas ────────────────────────────────────────────────
function getMaquinas() {
  const sheetMaq = getSheet('Equipos', ['id', 'sala_id', 'nombre', 'tipo', 'modelo', 'estado', 'frecuencia_dias', 'ultimo_mantenimiento']);
  const sheetSalas = getSheet('Salas', ['id', 'nombre']);
  
  const salas = getRowsToObjects(sheetSalas);
  const maquinas = getRowsToObjects(sheetMaq);

  const hoy = new Date();
  const data = maquinas.map(m => {
    let sala = salas.find(s => s.id === m.sala_id);
    let ult = m.ultimo_mantenimiento ? new Date(m.ultimo_mantenimiento.split('/').reverse().join('-')) : null;
    let estadoMant = 'pendiente';
    let frec = parseInt(m.frecuencia_dias) || 7;

    if (ult) {
      let difDias = (hoy - ult) / (1000 * 60 * 60 * 24);
      if (difDias > frec) estadoMant = 'vencido';
      else if (difDias > frec * 0.8) estadoMant = 'proximo';
      else estadoMant = 'ok';
    }

    return {
      id: m.id,
      nombre: m.nombre,
      tipo: m.tipo,
      sala_nombre: sala ? sala.nombre : 'Maker',
      sala_id: m.sala_id,
      modelo: m.modelo,
      frecuencia_dias: frec,
      estado: m.estado,
      ultimo_mantenimiento: m.ultimo_mantenimiento,
      estado_mantenimiento: estadoMant
    };
  });

  return json({ ok: true, data });
}

function handleMaquinas(data) {
  const sheet = getSheet('Equipos', ['id', 'sala_id', 'nombre', 'tipo', 'modelo', 'estado', 'frecuencia_dias', 'ultimo_mantenimiento']);
  
  if (data.method === 'POST') {
    const id = new Date().getTime().toString();
    sheet.appendRow([id, data.payload.sala_id, data.payload.nombre, data.payload.tipo, data.payload.modelo, data.payload.estado || 'activa', data.payload.frecuencia_dias, '']);
    return json({ ok: true, data: { id } });
  } 
  if (data.method === 'PUT') {
    const rows = getRowsToObjects(sheet);
    const m = rows.find(x => x.id === data.id);
    if (m) {
      sheet.getRange(m._rowIndex, 2, 1, 6).setValues([[
        data.payload.sala_id || m.sala_id,
        data.payload.nombre,
        data.payload.tipo,
        data.payload.modelo,
        data.payload.estado,
        data.payload.frecuencia_dias
      ]]);
    }
    return json({ ok: true });
  }
  if (data.method === 'DELETE') {
    const rows = getRowsToObjects(sheet);
    const m = rows.find(x => x.id === data.id);
    if (m) sheet.deleteRow(m._rowIndex);
    return json({ ok: true });
  }
}

function getMaquinaById(id) {
  const all = JSON.parse(getMaquinas().getContent()).data;
  const m = all.find(x => x.id == id || x.nombre === id);
  if (!m) return json({ ok: false, error: 'Not found' });
  return json({ ok: true, data: m });
}

// ── Operarios ────────────────────────────────────────────────
function getOperarios() {
  const sheet = getSheet('Operarios', ['id', 'nombre', 'pin', 'activo', 'creado_en']);
  const data = getRowsToObjects(sheet).filter(o => o.activo == '1' || o.activo === 'true').map(o => ({
    id: o.id, nombre: o.nombre, pin: '****', creado_en: o.creado_en
  }));
  return json({ ok: true, data });
}

function handleOperarios(data) {
  if (data.method === 'POST') {
    const sheet = getSheet('Operarios', ['id', 'nombre', 'pin', 'activo', 'creado_en']);
    const rows = getRowsToObjects(sheet);
    if (rows.find(o => o.pin === data.payload.pin && (o.activo == '1' || o.activo === 'true'))) {
      return json({ ok: false, error: 'Ya existe un operario con ese PIN' });
    }
    const id = new Date().getTime().toString();
    const date = new Date().toISOString();
    sheet.appendRow([id, data.payload.nombre, data.payload.pin, '1', date]);
    return json({ ok: true, data: { id } });
  }
}

function verificarPin(pin) {
  const sheet = getSheet('Operarios');
  const rows = getRowsToObjects(sheet);
  const o = rows.find(x => x.pin == pin && (x.activo == '1' || x.activo === 'true'));
  if (o) return json({ ok: true, data: { id: o.id, nombre: o.nombre } });
  return json({ ok: false, error: 'PIN incorrecto' });
}

// ── Usuarios ────────────────────────────────────────────────
function getUsuarios() {
  const sheet = getSheet('Usuarios', ['id', 'nombre', 'email', 'rol', 'activo', 'creado_en']);
  const data = getRowsToObjects(sheet).filter(u => u.activo == '1' || u.activo === 'true').map(u => ({
    id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, creado_en: u.creado_en, activo: true
  }));
  return json({ ok: true, data });
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
    const u = rows.find(x => x.id == data.id);
    if (u) sheet.getRange(u._rowIndex, 5).setValue('0');
    return json({ ok: true });
  }
}

// ── Incidencias / Historial ─────────────────────────────────
function guardarIncidencia(data) {
  const sheet = getSheet('Registros', ['id', 'timestamp', 'activo_id', 'activo_nombre', 'sala_nombre', 'operario_nombre', 'tipo', 'notas']);
  const ts = new Date().toISOString();
  const id = new Date().getTime().toString();
  
  sheet.appendRow([
    id, ts, data.payload.maquina_id || '', data.payload.maquina_nombre || '',
    data.payload.sala_nombre || '', data.payload.operario_nombre || '',
    data.payload.tipo, data.payload.notas
  ]);

  // Actualizar ultimo mantenimiento en maquina
  if (data.payload.maquina_id) {
    const mSheet = getSheet('Equipos');
    const mRows = getRowsToObjects(mSheet);
    const m = mRows.find(x => x.id == data.payload.maquina_id);
    if (m) {
      mSheet.getRange(m._rowIndex, 8).setValue(ts);
    }
  }

  return json({ ok: true });
}

function getHistorial() {
  const sheet = getSheet('Registros');
  const rows = getRowsToObjects(sheet);
  
  const data = rows.map(r => ({
    id: r.id,
    maquina: r.activo_nombre || r.activo_id,
    sala: r.sala_nombre,
    operario: r.operario_nombre,
    iniciado_en: r.timestamp,
    completado_en: r.timestamp,
    observaciones: r.notas,
    tipo: r.tipo
  })).reverse();

  return json({ ok: true, data });
}

function getDashboard() {
  const hist = JSON.parse(getHistorial().getContent()).data;
  const maq = JSON.parse(getMaquinas().getContent()).data;

  const hoyDate = new Date().toISOString().split('T')[0];
  let hoy = 0;
  let semana = 0;
  const last7 = new Date(); last7.setDate(last7.getDate() - 7);
  
  let porDiaMap = {};
  
  hist.forEach(h => {
    let d = h.completado_en.split('T')[0];
    if (d === hoyDate) hoy++;
    if (new Date(h.completado_en) >= last7) semana++;
    porDiaMap[d] = (porDiaMap[d] || 0) + 1;
  });

  const porDia = Object.keys(porDiaMap).sort().slice(-14).map(k => ({ dia: k, total: porDiaMap[k] }));

  let pendientes = 0;
  let proximos = 0;
  let porMaquina = [];

  maq.forEach(m => {
    if (m.estado_mantenimiento === 'pendiente' || m.estado_mantenimiento === 'vencido') pendientes++;
    if (m.estado_mantenimiento === 'proximo') proximos++;
    
    let count = hist.filter(h => h.maquina === m.nombre).length;
    if(count > 0) porMaquina.push({ nombre: m.nombre, total_sesiones: count });
  });

  porMaquina.sort((a,b) => b.total_sesiones - a.total_sesiones);

  return json({
    ok: true,
    data: {
      hoy, semana, pendientes, proximos, porDia, porMaquina
    }
  });
}
