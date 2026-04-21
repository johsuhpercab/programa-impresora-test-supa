'use strict';

// ── Estado global ─────────────────────────────────────────────────────────────
let maquinaId = null;
let maquinaData = null;
let operarioData = null;
let sesionId = null;
let pinBuffer = '';
let modoActual = 'Mantenimiento'; // 'Mantenimiento' o 'Incidencia'
let selectedPhoto = null;

// ── Arranque ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  maquinaId = urlParams.get('maquinaId'); // Corrección: quitar 'const' para usar global
  console.log("ID de máquina recibido de la URL:", maquinaId);

  if (!maquinaId) {
    showError('No se especificó ninguna máquina en la URL. Escanea el código QR de nuevo.');
    return;
  }

  try {
    const client = window.supabaseClient;
    console.log("Buscando máquina en Supabase con criterio:", maquinaId);
    
    // ESTRATEGIA SEGURA: 
    // 1. Intentamos buscar por ID directo
    let { data: maquina, error: mError } = await client
      .from('equipos')
      .select('*, salas(nombre)')
      .eq('id', maquinaId)
      .maybeSingle();

    // 2. Si no hay resultado (o era un nombre y dio error de tipos), buscamos por NOMBRE
    if (!maquina) {
      console.log("No encontrado por ID, probando por nombre...");
      const { data: maquinaByNombre, error: nError } = await client
        .from('equipos')
        .select('*, salas(nombre)')
        .eq('nombre', maquinaId)
        .maybeSingle();
      
      maquina = maquinaByNombre;
      if (nError) {
        console.error("Error buscando por nombre:", nError);
      }
    }
    
    if (mError && !maquina) {
      console.error("Error inicial de Supabase:", mError);
    }

    if (!maquina) {
      console.warn("No se encontró ninguna coincidencia para:", maquinaId);
      showError('No existe ninguna impresora con el ID o Nombre: "' + maquinaId + '". Verifica que esté registrada en el Panel de Administrador.');
      return;
    }

    console.log("Máquina cargada con éxito:", maquina);
    
    // Asignar datos de la máquina al estado global
    maquinaData = {
      ...maquina,
      id: maquina.id, // Asegurar ID
      sala_nombre: maquina.salas ? maquina.salas.nombre : 'Sin sala'
    };
    maquinaId = maquinaData.id;

    document.getElementById('pinMaquinaNombre').textContent = maquinaData.nombre;
    document.getElementById('pinMaquinaSala').textContent = maquinaData.sala_nombre + ' · ' + maquinaData.tipo;
    
    document.getElementById('portalMaquinaNombre').textContent = maquinaData.nombre;
    document.getElementById('portalMaquinaSala').textContent = maquinaData.sala_nombre;

    showScreen('portal');
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

function seleccionarModo(modo) {
  modoActual = modo === 'incidencia' ? 'Incidencia' : 'Mantenimiento';
  
  if (modo === 'incidencia') {
    // Si es incidencia desde el portal, saltamos identificación
    operarioData = { id: 0, nombre: 'Usuario (Incidencia)' };
    iniciarSesion();
  } else {
    // Si es mantenimiento, pedimos el PIN
    showScreen('pin');
  }
}

function setOpTipo(tipo) {
  modoActual = tipo;
  const mCard = document.getElementById('op-tipo-maint');
  const iCard = document.getElementById('op-tipo-inc');
  
  if (tipo === 'Mantenimiento') {
    mCard.classList.add('active');
    iCard.classList.remove('active-inc');
  } else {
    mCard.classList.remove('active');
    iCard.classList.add('active-inc');
  }
  console.log('Tipo de reporte cambiado a:', modoActual);
}

// ── PIN ───────────────────────────────────────────────────────────────────────
function pinKey(digit) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += digit;
  actualizarDotsPIN();
  if (pinBuffer.length === 4) verificarPIN();
}

function pinDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  actualizarDotsPIN();
  document.getElementById('pinError').innerHTML = '';
}

function actualizarDotsPIN() {
  for (let i = 0; i < 4; i++) {
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

// ── Gestión de Fotos ─────────────────────────────────────────────────────────
function onPhotoSelected() {
  const file = document.getElementById('photoInput').files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    selectedPhoto = e.target.result;
    document.getElementById('photoPreviewImg').src = selectedPhoto;
    document.getElementById('photoPreviewContainer').style.display = 'block';
    document.getElementById('photoText').textContent = 'Foto añadida';
    document.getElementById('photoIcon').textContent = '✅';
  };
  reader.readAsDataURL(file);
}

function cancelPhoto() {
  selectedPhoto = null;
  document.getElementById('photoInput').value = '';
  document.getElementById('photoPreviewContainer').style.display = 'none';
  document.getElementById('photoText').textContent = 'Añadir foto de evidencia';
  document.getElementById('photoIcon').textContent = '📷';
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
    body: { 
      observaciones: reporte,
      fotos: selectedPhoto ? [selectedPhoto] : []
    },
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
  selectedPhoto = null;
  modoActual = 'Mantenimiento';
  document.getElementById('pinError').innerHTML = '';
  cancelPhoto(); // Limpiar UI de foto
  showScreen('portal');
}

// --- SUPABASE WRAPPER FOR CHECKLIST ---
async function apiFetch(url, options = {}) {
  const method = options.method || 'GET';
  const payload = options.body;
  const client = window.supabaseClient;

  try {
    if (url.includes('/api/maquina/') && method === 'GET') {
      const id = url.split('/')[3];
      const { data, error } = await client
        .from('equipos')
        .select('*, salas(nombre)')
        .or(`id.eq."${id}",nombre.eq."${id}"`)
        .single();
      
      if (error) throw error;
      const formatted = {
        ...data,
        sala_nombre: data.salas ? data.salas.nombre : 'Sin sala'
      };
      return { ok: true, data: formatted };
    }

    if (url.includes('/api/operarios/verificar-pin')) {
      const { data, error } = await client
        .from('operarios')
        .select('*')
        .eq('pin', payload.pin)
        .eq('activo', true)
        .single();
      
      if (error || !data) return { ok: false, error: 'PIN incorrecto' };
      return { ok: true, data };
    }

    if (url.includes('/api/sesion/iniciar')) {
      // For Supabase, we don't strictly need to start a session in a separate table
      // unless we want to track working time. For now, matching the dummy logic.
      return { ok: true, data: { sesion_id: 'temp_sesion' } };
    }

    if (url.includes('/api/sesion/') && url.includes('/completar')) {
      // Use the names from the global state to ensure they aren't null
      const registroPayload = {
        maquina_id: maquinaId,
        maquina_nombre: maquinaData?.nombre || 'Desconocida',
        sala_nombre: maquinaData?.sala_nombre || 'Sin sala',
        operario_nombre: operarioData?.nombre || 'Anonimo',
        tipo: modoActual,
        notas: payload.observaciones,
        photos: payload.fotos || [], // Cambiado a 'photos' para marchar con la tabla
        timestamp: new Date().toISOString()
      };

      const { data: registro, error: rError } = await client
        .from('registros')
        .insert(registroPayload)
        .select()
        .single();

      if (rError) throw rError;

      // Update last maintenance date on the machine
      await client.from('equipos')
        .update({ ultimo_mantenimiento: new Date().toISOString() })
        .eq('id', maquinaId);

      return { ok: true, data: registro };
    }

    return { ok: false, error: 'Endpoint not implemented' };

  } catch (err) {
    console.error('Error in Supabase Checklist API:', err);
    return { ok: false, error: err.message };
  }
}
