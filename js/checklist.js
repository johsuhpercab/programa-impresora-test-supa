'use strict';

// ── Estado global ─────────────────────────────────────────────────────────────
let maquinaId = null;
let maquinaData = null;
let operarioData = null;
let sesionId = null;
let pinBuffer = '';
let modoActual = 'Mantenimiento'; // 'Mantenimiento' o 'Incidencia'
let selectedPhotos = [];

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

    const pNm = document.getElementById('portalMaquinaNombre');
    const pSl = document.getElementById('portalMaquinaSala');
    if (pNm) pNm.textContent = maquinaData.nombre;
    if (pSl) pSl.textContent = maquinaData.sala_nombre;

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
  
  // En ambos casos, ahora vamos directo al formulario de reporte
  iniciarSesion();
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

// ── Reporte ───────────────────────────────────────────────────────────────────
async function iniciarSesion() {
  const res = await apiFetch('/api/sesion/iniciar', {
    method: 'POST',
    body: { maquina_id: maquinaId }, // Ya no necesitamos operario_id aquí
  });

  if (res.ok) {
    sesionId = res.data.sesion_id;
    
    // Actualizar nombres en la UI de checklist
    document.getElementById('checkMaquinaNombre').textContent = maquinaData.nombre;
    document.getElementById('checkSalaNombre').textContent = maquinaData.sala_nombre;
    
    // Si veníamos de modo incidencia desde el portal, lo marcamos en el selector del formulario
    setOpTipo(modoActual);

    document.getElementById('reporteTextarea').value = '';
    document.getElementById('reporteError').style.display = 'none';
    actualizarBoton('');

    showScreen('checklist');
  } else {
    showError('Error al iniciar reporte');
  }
}

// ── Reporte ───────────────────────────────────────────────────────────────────
function onReporteChange() {
  const texto = document.getElementById('reporteTextarea').value;
  document.getElementById('reporteError').style.display = 'none';
  actualizarBoton(texto);
}

function actualizarBoton(texto) {
  const btn = document.getElementById('btnEnviar');
  const isValid = texto.trim().length > 0;
  
  if (isValid) {
    btn.className = 'btn-enviar activo';
    btn.textContent = '✅ Enviar informe';
    btn.disabled = false;
  } else {
    btn.className = 'btn-enviar bloqueado';
    btn.textContent = '✏️ Rellena el reporte para continuar';
    btn.disabled = true;
  }
}

// ── Gestión de Fotos ─────────────────────────────────────────────────────────
function onPhotoSelected() {
  const file = document.getElementById('photoInput').files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    selectedPhotos.push(e.target.result);
    renderPhotoPreviews();
  };
  reader.readAsDataURL(file);
  // Limpiar input para permitir seleccionar la misma foto o resetear el selector
  document.getElementById('photoInput').value = '';
}

function renderPhotoPreviews() {
  const grid = document.getElementById('photoPreviewsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  selectedPhotos.forEach((src, index) => {
    const container = document.createElement('div');
    container.style = "position:relative; width:80px; height:80px; flex-shrink:0";
    container.innerHTML = `
      <img src="${src}" style="width:100%; height:100%; object-fit:cover; border-radius:12px; border:2px solid var(--accent-maint)">
      <div onclick="removePhoto(${index})" style="position:absolute; top:-8px; right:-8px; background:var(--accent-inc); color:white; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:bold; cursor:pointer; border:2px solid #0f0f1a">✕</div>
    `;
    grid.appendChild(container);
  });
  
  const text = document.getElementById('photoText');
  const icon = document.getElementById('photoIcon');
  if (selectedPhotos.length > 0) {
    text.textContent = `Añadir otra foto (${selectedPhotos.length})`;
    icon.textContent = '📸';
  } else {
    text.textContent = 'Añadir foto de evidencia';
    icon.textContent = '📷';
  }
}

function removePhoto(index) {
  selectedPhotos.splice(index, 1);
  renderPhotoPreviews();
}

function cancelPhoto() {
  selectedPhotos = [];
  document.getElementById('photoInput').value = '';
  renderPhotoPreviews();
}

async function enviarChecklist() {
  const nombreUser = document.getElementById('userNameInput').value.trim();
  const reporte = document.getElementById('reporteTextarea').value.trim();

  if (!nombreUser) {
    alert("Por favor, introduce tu nombre.");
    return;
  }
  if (reporte.length < 1) {
    document.getElementById('reporteError').style.display = 'block';
    return;
  }

  const btn = document.getElementById('btnEnviar');
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  const res = await apiFetch(`/api/sesion/${sesionId}/completar`, {
    method: 'POST',
    body: { 
      observaciones: reporte,
      nombre_usuario: nombreUser, // Enviamos el nombre escrito
      fotos: selectedPhotos // Mandamos el array completo
    },
  });

  if (res.ok) {
    document.getElementById('exitoMaquina').textContent = maquinaData.nombre;
    document.getElementById('exitoOperario').textContent = nombreUser;
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
  sesionId = null;
  selectedPhotos = [];
  modoActual = 'Mantenimiento';
  
  // Limpiar campos del formulario
  const userInp = document.getElementById('userNameInput');
  const reportTxt = document.getElementById('reporteTextarea');
  if (userInp) userInp.value = '';
  if (reportTxt) reportTxt.value = '';
  
  // Resetear botón de envío
  const btn = document.getElementById('btnEnviar');
  if (btn) {
    btn.disabled = true;
    btn.className = 'btn-enviar bloqueado';
    btn.textContent = '✏️ Rellena el reporte para continuar';
  }

  // Ocultar errores
  const errDiv = document.getElementById('reporteError');
  if (errDiv) errDiv.style.display = 'none';
  
  cancelPhoto(); // Limpiar UI de foto
  showScreen('portal');
}

async function handlePhotoUploads(base64Photos) {
  const client = window.supabaseClient;
  const urls = [];
  console.log(`Iniciando subida de ${base64Photos.length} fotos a Storage...`);
  
  for (let i = 0; i < base64Photos.length; i++) {
    try {
      const b64 = base64Photos[i];
      const blob = await (await fetch(b64)).blob();
      const fileName = `${Date.now()}_${i}.jpg`;
      
      const { data, error } = await client.storage
        .from('photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      
      if (error) {
        console.error('Error al subir foto a Supabase:', error);
        continue;
      }
      
      const { data: { publicUrl } } = client.storage.from('photos').getPublicUrl(data.path);
      urls.push(publicUrl);
    } catch (e) {
      console.error('Fallo técnico en la subida:', e);
    }
  }
  return urls;
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
      // 1. Upload photos to Supabase Storage if any
      let photoUrls = [];
      if (payload.fotos && payload.fotos.length > 0) {
        photoUrls = await handlePhotoUploads(payload.fotos);
      }

      // 2. Use the names from the global state to ensure they aren't null
      const registroPayload = {
        maquina_id: maquinaId,
        maquina_nombre: maquinaData?.nombre || 'Desconocida',
        sala_nombre: maquinaData?.sala_nombre || 'Sin sala',
        operario_nombre: payload.nombre_usuario || 'Anonimo', 
        tipo: modoActual,
        notas: payload.observaciones,
        photos: photoUrls, // Now storing URLs instead of Base64 strings
        timestamp: new Date().toISOString()
      };

      const { data: registro, error: rError } = await client
        .from('registros')
        .insert(registroPayload)
        .select()
        .single();

      if (rError) throw rError;

      // 3. Update last maintenance date on the machine
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
