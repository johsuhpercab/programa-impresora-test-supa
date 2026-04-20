'use strict';

// ── Estado global ─────────────────────────────────────────────────────────────
let maquinaId = null;
let maquinaData = null;
let operarioData = null;
let sesionId = null;
let pinBuffer = '';

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  maquinaId = params.get('id');

  if (!maquinaId) {
    showError('No se especificó una máquina. Escanea el QR directamente desde la máquina.');
    return;
  }

  try {
    const maqRes = await apiFetch(`/api/maquina/${maquinaId}`);
    if (!maqRes.ok) { showError('Máquina no encontrada (ID: ' + maquinaId + ')'); return; }
    maquinaData = maqRes.data;

    document.getElementById('pinMaquinaNombre').textContent = maquinaData.nombre;
    document.getElementById('pinMaquinaSala').textContent = maquinaData.sala_nombre + ' · ' + maquinaData.tipo;

    showScreen('pin');
  } catch (e) {
    showError('Error de conexión con el servidor: ' + e.message);
  }
});

// ── Navegación ────────────────────────────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
}

function showError(msg) {
  document.getElementById('errorMsg').textContent = msg;
  showScreen('error');
}

// ── PIN ───────────────────────────────────────────────────────────────────────
function pinKey(digit) {
  if (pinBuffer.length >= 6) return;
  pinBuffer += digit;
  actualizarDotsPIN();
  if (pinBuffer.length >= 4) verificarPIN();
}

function pinDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  actualizarDotsPIN();
  document.getElementById('pinError').innerHTML = '';
}

function actualizarDotsPIN() {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById('d' + i);
    if (!dot) continue;
    dot.classList.toggle('filled', i < pinBuffer.length);
  }
}

async function verificarPIN() {
  await new Promise(r => setTimeout(r, 200));
  const res = await apiFetch('/api/operarios/verificar-pin', {
    method: 'POST',
    body: { pin: pinBuffer },
  });

  if (res.ok) {
    operarioData = res.data;
    await iniciarSesion();
  } else {
    document.getElementById('pinError').innerHTML =
      '<div class="error-msg">❌ PIN incorrecto. Inténtalo de nuevo.</div>';
    pinBuffer = '';
    actualizarDotsPIN();
    setTimeout(() => { document.getElementById('pinError').innerHTML = ''; }, 2500);
  }
}

async function iniciarSesion() {
  const res = await apiFetch('/api/sesion/iniciar', {
    method: 'POST',
    body: { maquina_id: maquinaId, operario_id: operarioData.id },
  });
  if (!res.ok) { showError('Error al iniciar la sesión.'); return; }
  sesionId = res.data.sesion_id;

  // Preparar pantalla de reporte
  document.getElementById('checkMaquinaNombre').textContent = maquinaData.nombre;
  document.getElementById('checkSalaNombre').textContent = maquinaData.sala_nombre;
  document.getElementById('operarioNombreLabel').textContent = operarioData.nombre;
  document.getElementById('reporteTextarea').value = '';
  document.getElementById('reporteError').style.display = 'none';
  actualizarBoton('');

  showScreen('checklist');
}

// ── Reporte ───────────────────────────────────────────────────────────────────
function onReporteChange() {
  const texto = document.getElementById('reporteTextarea').value;
  document.getElementById('reporteError').style.display = 'none';
  actualizarBoton(texto);
}

function actualizarBoton(texto) {
  const btn = document.getElementById('btnEnviar');
  if (texto.trim().length > 0) {
    btn.className = 'btn-enviar activo';
    btn.textContent = '✅ Enviar informe';
  } else {
    btn.className = 'btn-enviar bloqueado';
    btn.textContent = '✏️ Rellena el reporte para continuar';
  }
}

async function enviarChecklist() {
  const reporte = document.getElementById('reporteTextarea').value.trim();

  if (!reporte) {
    document.getElementById('reporteError').style.display = 'block';
    document.getElementById('reporteTextarea').focus();
    return;
  }

  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  const res = await apiFetch(`/api/sesion/${sesionId}/completar`, {
    method: 'POST',
    body: { observaciones: reporte },
  });

  if (res.ok) {
    document.getElementById('exitoMaquina').textContent = maquinaData.nombre;
    document.getElementById('exitoOperario').textContent = operarioData.nombre;
    document.getElementById('exitoFecha').textContent = new Date().toLocaleString('es-ES');
    showScreen('exito');
  } else {
    btn.disabled = false;
    btn.className = 'btn-enviar activo';
    btn.textContent = '⚠️ Error al enviar. Reintentar';
    alert('Error: ' + (res.error || 'No se pudo enviar el informe'));
  }
}

function reiniciar() {
  pinBuffer = '';
  actualizarDotsPIN();
  operarioData = null;
  sesionId = null;
  document.getElementById('pinError').innerHTML = '';
  showScreen('pin');
}

const API = window.API_URL || 'https://script.google.com/macros/s/AKfycbxtJLSCIzCzkc90A-Q-pOQnInLQlKkR3GPWJUFF1g993JCjodqmkDoY95KAod-u1fPl/exec'; // Compartir URL con admin.js o inyectarla

async function apiFetch(url, options = {}) {
  try {
    let action = '';
    let payload = options.body;
    let method = options.method || 'GET';

    if (url.includes('/api/maquina/') && method === 'GET') {
      action = 'getMaquinaById';
      url += '&id=' + url.split('/')[3]; 
    }
    else if (url.includes('/api/operarios/verificar-pin')) action = 'verificarPin';
    else if (url.includes('/api/sesion/iniciar')) {
      // Dummy response as GAS doesn't require "starting" a session explicitly
      return { ok: true, data: { sesion_id: new Date().getTime() } };
    }
    else if (url.includes('/api/sesion/') && url.includes('/completar')) {
      action = 'enviarIncidencia';
      payload = {
        maquina_id: maquinaId,
        maquina_nombre: maquinaData?.nombre,
        sala_nombre: maquinaData?.sala_nombre,
        operario_nombre: operarioData?.nombre,
        notas: options.body.observaciones || '',
        tipo: 'Mantenimiento'
      };
    }

    if (API === 'INSERTA_TU_WEB_APP_URL_AQUI') {
      return { ok: false, error: 'Falta añadir la URL del Sheet API' };
    }

    if (method === 'GET' || action === 'getMaquinaById') {
      const gUrl = `${API}?action=${action}${action==='getMaquinaById' ? '&id='+url.split('=')[1] : ''}`;
      const res = await fetch(gUrl);
      return await res.json();
    } else {
      const res = await fetch(API, {
        method: 'POST',
        body: JSON.stringify({ action, method, payload }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return await res.json();
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
