'use strict';

const API = 'https://script.google.com/macros/s/AKfycbwW2_UWpOS45F-3BbyVbUvtxIJ3b_OP_Pnl_cSgSwO-BXz9nSzqoTb8oxnh185za0M/exec'; // <--- URL DE LA WEB APP OPTIMIZADA
let datosSalas = [];
let datosMaquinas = [];
let datosOperarios = [];
let datosUsuarios = [];
let datosHistorial = []; // Reutilizar datos ya cargados
let isCargando = false;

let rolActual = 'admin';

// ── Simulator Roles (Eliminado para usar seguridad real) ──────────────────
function cambiarRolSimulado(nuevoRol) {
  // Función mantenida solo para compatibilidad de UI si es necesario, 
  // pero la seguridad real ahora depende del PIN.
}


document.addEventListener('DOMContentLoaded', async () => {
  const pin = localStorage.getItem('admin_pin');
  if (!pin) return; // Esperar al login manual

  try {
    isCargando = true;
    
    // Inyectar interfaz de forma segura
    const container = document.getElementById('dashboardContent');
    if (container) {
      container.innerHTML = DASHBOARD_HTML;
    }

    const grid = document.getElementById('gridMaquinas');
    if (grid) grid.innerHTML = skeletonMaquinas();
    const tbody = document.getElementById('dashboardUltimos');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)"><span class="spinner" style="display:inline-block;margin-right:8px"></span>Conectando con Supabase...</td></tr>';
    
    // Cargar TODO en una sola llamada
    await cargarDatosBase();
    
    // Auto-sincronización cada 2 minutos
    setInterval(() => {
      console.log('Sincronización automática con Supabase...');
      recargarTodo();
    }, 120000);
  } catch (err) {
    console.error('Error durante la carga inicial:', err);
  } finally {
    isCargando = false;
  }
});

function skeletonMaquinas() {
  const card = `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:20px;animation:pulse 1.5s ease-in-out infinite">
    <div style="height:14px;background:var(--border);border-radius:6px;width:60%;margin-bottom:12px"></div>
    <div style="height:10px;background:var(--border);border-radius:6px;width:40%;margin-bottom:20px"></div>
    <div style="height:10px;background:var(--border);border-radius:6px;width:80%;margin-bottom:8px"></div>
    <div style="height:10px;background:var(--border);border-radius:6px;width:70%"></div>
  </div>`;
  const inner = Array(6).fill(card).join('');
  return `<div class="grid-maquinas-inner" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;display:grid">${inner}</div>`;
}

function skeletonTabla(cols = 5) {
  const row = `<tr>
    ${Array(cols).fill(`<td><div style="height:12px;background:var(--border);border-radius:6px;width:80%;animation:pulse 1.5s ease-in-out infinite"></div></td>`).join('')}
  </tr>`;
  return Array(5).fill(row).join('');
}

async function cargarDatosBase() {
  console.time('Carga Inicial Bundled');
  // Una sola llamada para traerlo TODO
  const res = await apiFetch('/api/all-data');
  console.timeEnd('Carga Inicial Bundled');
  
  if (res.ok && res.data) {
    const d = res.data;
    datosSalas = d.salas || [];
    datosMaquinas = d.maquinas || [];
    datosOperarios = d.operarios || [];
    datosUsuarios = d.usuarios || [];
    datosHistorial = d.historial || [];
    
    // Poblar dashboard con los datos ya recibidos
    actualizarVistaDashboard(d.dashboard, d.historial);
  }

  // Actualizar la vista actual ahora que los datos están listos
  renderActualSection();

  // Poblar selects de salas
  ['filtroSalaMaquinas', 'filtroSala', 'filtroSalaQR', 'nuevoMaquinaSala'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id !== 'nuevoMaquinaSala') {
      el.innerHTML = '<option value="">Todas las salas</option>';
    } else {
      el.innerHTML = '<option value="">Seleccione una sala...</option>';
    }
    datosSalas.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.nombre;
      el.appendChild(opt);
    });
  });

  // Poblar selects personal (historial)
  const selOp = document.getElementById('filtroOperario');
  if (selOp) {
    selOp.innerHTML = '<option value="">Todo el personal</option>';
    datosUsuarios.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id; opt.textContent = u.nombre;
      selOp.appendChild(opt);
    });
  }

  // Actualizar badge alertas
  const alertas = datosMaquinas.filter(m =>
    m.estado_mantenimiento === 'vencido' || m.estado_mantenimiento === 'pendiente'
  ).length;
  const badge = document.getElementById('badge-alertas');
  if (alertas > 0) { badge.textContent = alertas; badge.style.display = 'inline'; }
  else badge.style.display = 'none';

  // Badge máquinas total
  const maqBadge = document.getElementById('badge-maquinas');
  if (maqBadge) {
    maqBadge.textContent = datosMaquinas.length;
    maqBadge.style.display = datosMaquinas.length > 0 ? 'inline' : 'none';
  }
}



// ── Navegación ────────────────────────────────────────────────────────────────
const sectionTitles = {
  dashboard: ['Panel General', 'Resumen del sistema'],
  maquinas: ['Máquinas', 'Estado y gestión de todas las máquinas'],
  historial: ['Historial', 'Registro de mantenimientos realizados'],
  operarios: ['Operarios', 'Gestión del personal de mantenimiento'],
  qrcodes: ['Códigos QR', 'QR individuales para el operario móvil'],
  galeria: ['Galería de Fotos', 'Últimas evidencias fotográficas de los reportes'],
};

function navigateTo(section) {
  // Verificación de roles
  const rutasRestringidas = ['operarios', 'usuarios', 'qrcodes'];
  let idToShow = section;
  
  if (rolActual !== 'admin' && rutasRestringidas.includes(section)) {
    idToShow = 'restringido';
  }

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById('section-' + idToShow).classList.add('active');
  if (idToShow !== 'restringido') {
    const navItem = document.getElementById('nav-' + section);
    if(navItem) navItem.classList.add('active');
  } else {
    document.getElementById('topbarTitle').textContent = 'Acceso Denegado';
    document.getElementById('topbarSubtitle').textContent = 'Sección restringida por permisos';
    return;
  }

  const [title, sub] = sectionTitles[section] || [section, ''];
  document.getElementById('topbarTitle').textContent = title;
  document.getElementById('topbarSubtitle').textContent = sub;

  // Cargar datos bajo demanda
  if (section === 'maquinas') renderMaquinas();
  if (section === 'historial') { cargarHistorial(); poblarFiltroMaquinasHistorial(); }
  if (section === 'operarios') renderOperarios();
  if (section === 'usuarios') renderUsuarios();
  if (section === 'qrcodes') renderQRs();
  if (section === 'galeria') renderizarGaleria();
}

function renderActualSection() {
  const activeSection = document.querySelector('.section.active');
  if (!activeSection) return;
  const id = activeSection.id.replace('section-', '');
  if (id === 'maquinas') renderMaquinas();
  if (id === 'historial') cargarHistorial();
  if (id === 'operarios') renderOperarios();
  if (id === 'usuarios') renderUsuarios();
  if (id === 'qrcodes') renderQRs();
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('open');
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
// ── Dashboard ─────────────────────────────────────────────────────────────────
async function cargarDashboard() {
  // Ahora es solo un wrapper por si se llama manualmente
  const res = await apiFetch('/api/dashboard');
  if (res.ok) {
     const histRes = await apiFetch('/api/historial?');
     actualizarVistaDashboard(res.data, histRes.ok ? histRes.data : []);
  }
}

function actualizarVistaDashboard(stats, historial) {
  if (!stats) return;

  const d = stats;
  const kpiHoy = document.getElementById('kpi-hoy');
  if (kpiHoy) kpiHoy.textContent = d.hoy;
  const kpiSem = document.getElementById('kpi-semana');
  if (kpiSem) kpiSem.textContent = d.semana;
  const kpiPen = document.getElementById('kpi-pendientes');
  if (kpiPen) kpiPen.textContent = d.pendientes;
  const kpiProx = document.getElementById('kpi-proximos');
  if (kpiProx) kpiProx.textContent = d.proximos;

  // Gráfica de días
  renderBarChart('chartDias', (d.porDia || []).slice(-14).map(r => ({
    label: formatFechaDia(r.dia), value: r.total
  })));

  // Gráfica de máquinas
  const maqData = (d.porMaquina || []).map(r => ({ label: r.nombre, value: r.total_sesiones }));
  renderBarChart('chartMaquinas', maqData.slice(0, 12));

  // Últimos mantenimientos
  if (historial) renderUltimosMantenimientos(historial.slice(0, 8));
}

function renderBarChart(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container || !items.length) {
    container.innerHTML = '<div class="empty-state" style="padding:24px"><div class="icon">📊</div><p>Sin datos aún</p></div>';
    return;
  }
  const max = Math.max(...items.map(i => i.value), 1);
  container.innerHTML = items.map(i => `
    <div class="chart-bar-row">
      <div class="chart-bar-label" title="${i.label}">${truncate(i.label, 12)}</div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width:${(i.value / max * 100).toFixed(1)}%"></div>
      </div>
      <div class="chart-bar-val">${i.value}</div>
    </div>
  `).join('');
}

function renderUltimosMantenimientos(registros) {
  const tbody = document.getElementById('dashboardUltimos');
  if (!registros.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Sin mantenimientos aún</td></tr>';
    return;
  }
  tbody.innerHTML = registros.map(r => {
    const isIncidencia = r.tipo === 'Incidencia';
    const rowStyle = isIncidencia ? 'color: var(--danger); font-weight: 600;' : '';
    const badgeClass = isIncidencia ? 'estado-badge vencido' : 'estado-badge ok';
    const icon = isIncidencia ? '🚨' : '🛠️';

    return `
      <tr onclick="verDetalleSesion('${r.id}')" style="cursor:pointer">
        <td data-label="Máquina"><span style="${rowStyle}">${icon} ${r.maquina}</span></td>
        <td data-label="Sala"><span class="text-muted">${r.sala}</span></td>
        <td data-label="Operario">${r.operario}</td>
        <td data-label="Fecha y hora">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <span>${formatFechaHora(r.completado_en)}</span>
            ${r.tiene_fotos ? `
              <div style="position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <img src="${r.fotos[0]}" style="width:28px;height:28px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
                <span style="position:absolute;font-size:9px;background:var(--accent);color:white;padding:1px 3px;border-radius:4px;bottom:-3px;right:-3px;box-shadow:0 2px 4px rgba(0,0,0,0.2)">${r.fotos.length}</span>
              </div>
            ` : ''}
          </div>
        </td>
        <td data-label="Acciones">
          <button class="btn btn-outline btn-sm">Detalle</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ── Máquinas ──────────────────────────────────────────────────────────────────
function renderMaquinas() {
  const salaFiltro = document.getElementById('filtroSalaMaquinas') ? document.getElementById('filtroSalaMaquinas').value : '';
  const grid = document.getElementById('gridMaquinas');
  
  if (isCargando && !datosMaquinas.length) {
    grid.innerHTML = skeletonMaquinas();
    return;
  }

  const lista = salaFiltro
    ? datosMaquinas.filter(m => String(m.sala_id) === String(salaFiltro))
    : datosMaquinas;

  if (!lista.length) {
    if (isCargando) {
       grid.innerHTML = skeletonMaquinas();
    } else {
       grid.innerHTML = '<div class="empty-state"><div class="icon">🖨️</div><p>No hay máquinas en esta sala</p></div>';
    }
    return;
  }

  // Clasificar máquinas por espacio dinámicamente según la base de datos
  function tarjetaMaquina(m) {
    const estadoLabel = {
      ok: '✅ Al día',
      proximo: '⚠️ Próximo',
      vencido: '🚨 Vencido',
      pendiente: '🔴 Pendiente',
    }[m.estado_mantenimiento] || m.estado_mantenimiento;

    const ultimo = m.ultimo_mantenimiento
      ? `Último: ${formatFechaHora(m.ultimo_mantenimiento)}`
      : 'Sin mantenimiento registrado';

    return `
      <div class="maquina-card fade-in" onclick="verHistorialMaquina('${m.nombre}')" style="cursor:pointer" title="Ver historial completo">
        <div class="maquina-header">
          <div>
            <div class="maquina-nombre">${m.nombre}</div>
            <div class="maquina-tipo">${m.tipo}</div>
          </div>
          <span class="estado-badge ${m.estado_mantenimiento}">${estadoLabel}</span>
        </div>
        <div class="maquina-info">
          <span>🏭 ${m.sala_nombre}</span>
          <span>⚙️ ${m.modelo || 'Sin modelo'}</span>
          <span>📅 Frecuencia: cada ${m.frecuencia_dias} días</span>
          <span>🕐 ${ultimo}</span>
        </div>
        <div class="maquina-actions">
          ${rolActual === 'admin' ? `
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); verQR('${m.id}', '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">📱 QR</button>
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); editarMaquina('${m.id}')">✏️ Editar</button>
            <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger);padding:4px 8px" onclick="event.stopPropagation(); eliminarMaquina('${m.id}')" title="Eliminar máquina">🗑️</button>
          ` : `
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); verQR('${m.id}', '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">📱 QR</button>
          `}
        </div>
      </div>
    `;
  }

  function seccionEspacio(titulo, icono, color, maquinas) {
    if (!maquinas.length) return '';
    return `
      <div class="espacio-section" style="margin-bottom:32px">
        <div class="espacio-header" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;background:${color};border-radius:12px;border-left:4px solid var(--primary)">
          <span style="font-size:22px">${icono}</span>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${titulo}</div>
            <div style="font-size:12px;color:var(--text-muted)">${maquinas.length} máquina${maquinas.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="grid-maquinas-inner">
          ${maquinas.map(tarjetaMaquina).join('')}
        </div>
      </div>
    `;
  }

  let htmlResult = '';
  const bgColors = ['rgba(79,142,247,0.08)', 'rgba(16,185,129,0.08)', 'rgba(245,158,11,0.08)', 'rgba(139,92,246,0.08)', 'rgba(236,72,153,0.08)'];
  const iconos = ['🛠️', '🤖', '🖨️', '⚙️', '🏗️'];

  datosSalas.forEach((sala, index) => {
    // Si hay un filtro y no es esta sala, la ignoramos
    if (salaFiltro && String(sala.id) !== String(salaFiltro)) return;

    const maquinasSala = lista.filter(m => m.sala_id === sala.id);
    if (maquinasSala.length > 0) {
      const color = bgColors[index % bgColors.length];
      const icono = iconos[index % iconos.length];
      htmlResult += seccionEspacio(sala.nombre, icono, color, maquinasSala);
    }
  });

  const maquinasSinSala = lista.filter(m => !m.sala_id);
  if (maquinasSinSala.length > 0) {
    htmlResult += seccionEspacio('Otras Máquinas', '🖨️', 'rgba(107,114,128,0.08)', maquinasSinSala);
  }

  grid.innerHTML = htmlResult;
}

function filtrarMaquinas() { renderMaquinas(); }

async function editarMaquina(id) {
  const maq = datosMaquinas.find(m => m.id === id);
  if (!maq) return;
  document.getElementById('editMaquinaId').value = id;
  document.getElementById('editNombre').value = maq.nombre;
  document.getElementById('editTipo').value = maq.tipo;
  document.getElementById('editModelo').value = maq.modelo || '';
  document.getElementById('editFrecuencia').value = maq.frecuencia_dias;
  document.getElementById('editEstado').value = maq.estado;
  abrirModal('modalMaquina');
}

async function guardarMaquina() {
  const id = document.getElementById('editMaquinaId').value;
  const datos = {
    nombre: document.getElementById('editNombre').value.trim(),
    tipo: document.getElementById('editTipo').value,
    modelo: document.getElementById('editModelo').value.trim(),
    frecuencia_dias: parseInt(document.getElementById('editFrecuencia').value),
    estado: document.getElementById('editEstado').value,
  };
  if (!datos.nombre) return;
  const res = await apiFetch(`/api/maquina/${id}`, { method: 'PUT', body: datos });
  if (res.ok) {
    cerrarModal('modalMaquina');
    await cargarDatosBase();
    renderMaquinas();
  } else {
    alert('Error al guardar: ' + (res.error || 'Error desconocido'));
  }
}

function abrirModalNuevaMaquina() {
  document.getElementById('nuevoMaquinaNombre').value = '';
  document.getElementById('nuevoMaquinaModelo').value = '';
  document.getElementById('nuevoMaquinaTipo').value = 'Impresora FDM';
  document.getElementById('nuevoMaquinaFrecuencia').value = '7';
  document.getElementById('msgNuevaMaquina').innerHTML = '';
  abrirModal('modalNuevaMaquina');
}

async function crearMaquina() {
  const nombre = document.getElementById('nuevoMaquinaNombre').value.trim();
  const sala_id = document.getElementById('nuevoMaquinaSala').value;
  const tipo = document.getElementById('nuevoMaquinaTipo').value;
  const frecuencia_dias = document.getElementById('nuevoMaquinaFrecuencia').value;
  const modelo = document.getElementById('nuevoMaquinaModelo').value.trim();
  const msg = document.getElementById('msgNuevaMaquina');

  if (!nombre || !sala_id) {
    msg.innerHTML = '<div class="alert alert-warning">⚠️ Nombre y Sala son obligatorios</div>';
    return;
  }

  const res = await apiFetch('/api/maquinas', { 
    method: 'POST', 
    body: { nombre, sala_id, tipo, frecuencia_dias, modelo } 
  });

  if (res.ok) {
    cerrarModal('modalNuevaMaquina');
    await cargarDatosBase();
    renderMaquinas();
  } else {
    msg.innerHTML = `<div class="alert alert-danger">❌ ${res.error}</div>`;
  }
}

async function eliminarMaquina(id) {
  if (!confirm('¿Estás seguro de que deseas eliminar esta máquina por completo? Se borrarán también sus registros de mantenimiento.')) return;
  const res = await apiFetch(`/api/maquina/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await cargarDatosBase();
    renderMaquinas();
  } else {
    alert('Error al eliminar: ' + res.error);
  }
}

// ── QR Codes ──────────────────────────────────────────────────────────────────
function renderQRs() {
  const salaFiltro = document.getElementById('filtroSalaQR').value;
  const lista = salaFiltro
    ? datosMaquinas.filter(m => String(m.sala_id) === String(salaFiltro))
    : datosMaquinas;

  const grid = document.getElementById('gridQRs');
  if (isCargando && !datosMaquinas.length) {
     grid.innerHTML = skeletonMaquinas();
     return;
  }
  
  grid.innerHTML = lista.map(m => `
    <div class="maquina-card fade-in" style="cursor:pointer" onclick="verQR('${m.id}', '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">
      <div class="maquina-header">
        <div>
          <div class="maquina-nombre">${m.nombre}</div>
          <div class="maquina-tipo">${m.sala_nombre} · ${m.tipo}</div>
        </div>
        <span style="font-size:32px">📱</span>
      </div>
      <div style="text-align:center;padding:8px 0;color:var(--text-muted);font-size:13px">
        Haz clic para ver el código QR
      </div>
    </div>
  `).join('');
}

function filtrarQRs() { renderQRs(); }

async function verQR(id, nombre, sala) {
  document.getElementById('qrNombre').textContent = nombre;
  document.getElementById('qrSala').textContent = sala;
  document.getElementById('qrImg').src = '';
  document.getElementById('qrUrl').textContent = 'Generando QR...';
  abrirModal('modalQR');

  const res = await apiFetch(`/api/maquina/${id}/qr`);
  if (res.ok) {
    document.getElementById('qrImg').src = res.data.qr;
    const link = document.getElementById('qrUrl');
    link.textContent = res.data.url;
    link.href = res.data.url;
  }
}

function imprimirQR() {
  const nombre = document.getElementById('qrNombre').textContent;
  const sala = document.getElementById('qrSala').textContent;
  const img = document.getElementById('qrImg').src;
  const url = document.getElementById('qrUrl').textContent;
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>QR - ${nombre}</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px}
    h2{margin-bottom:4px}p{color:#666;font-size:14px;margin-bottom:20px}
    img{border:3px solid #000;border-radius:8px;width:220px}
    .url{font-size:11px;color:#999;margin-top:16px;word-break:break-all}
    </style></head><body>
    <h2>${nombre}</h2><p>${sala}</p>
    <img src="${img}">
    <div class="url">${url}</div>
    </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// ── Historial ─────────────────────────────────────────────────────────────────
async function poblarFiltroMaquinasHistorial() {
  const sel = document.getElementById('filtroMaquina');
  sel.innerHTML = '<option value="">Todas las máquinas</option>';
  datosMaquinas.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = `${m.nombre} (${m.sala_nombre})`;
    sel.appendChild(opt);
  });
}

async function cargarHistorial() {
  const params = new URLSearchParams();
  const sala = document.getElementById('filtroSala').value;
  const maquina = document.getElementById('filtroMaquina').value;
  const operario = document.getElementById('filtroOperario').value;
  const desde = document.getElementById('filtroDesde').value;
  const hasta = document.getElementById('filtroHasta').value;

  const tbody = document.getElementById('tablaHistorial');
  const empty = document.getElementById('historialEmpty');
  
  // OPTIMIZACIÓN: Si NO hay filtros, usamos los datos que ya tenemos cargados
  const hasFilters = sala || maquina || operario || desde || hasta;
  
  if (!hasFilters && datosHistorial.length > 0) {
    console.log('Mostrando historial desde memoria local (Instántaneo)');
    renderizarContenidoHistorial(datosHistorial, tbody, empty);
    return;
  }

  if (tbody) tbody.innerHTML = skeletonTabla(8);
  if (empty) empty.style.display = 'none';

  const res = await apiFetch('/api/historial?' + params.toString());

  if (!res.ok || !res.data.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  
  renderizarContenidoHistorial(res.data, tbody, empty);
}

function renderizarContenidoHistorial(data, tbody, empty) {
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = data.map(r => {
    const isIncidencia = r.tipo === 'Incidencia';
    const rowStyle = isIncidencia ? 'color: var(--danger); font-weight: 600;' : '';
    const icon = isIncidencia ? '🚨' : '🛠️';

    return `
      <tr style="${isIncidencia ? 'background: rgba(239, 68, 68, 0.03)' : ''}">
        <td data-label="#" class="text-muted" style="font-size:10px">#${r.id.toString().substring(0, 8)}...</td>
        <td data-label="Máquina"><span style="${rowStyle}">${icon} ${r.maquina}</span></td>
        <td data-label="Sala">${r.sala}</td>
        <td data-label="Operario">${r.operario}</td>
        <td data-label="Inicio" style="font-size:11px">${formatFechaHora(r.iniciado_en)}</td>
        <td data-label="Fin" style="font-size:11px">${formatFechaHora(r.completado_en)}</td>
        <td data-label="Observ." style="font-size:11px;color:var(--text-muted)">
          <div style="display:flex;align-items:center;gap:12px;justify-content:space-between">
            <span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.observaciones || '–'}</span>
            ${r.tiene_fotos ? `
              <div onclick="event.stopPropagation(); window.open('${r.fotos[0]}', '_blank')" style="cursor:zoom-in;position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <img src="${r.fotos[0]}" style="width:26px;height:26px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
                <span style="position:absolute;font-size:9px;background:var(--accent);color:white;padding:1px 3px;border-radius:4px;top:-4px;right:-4px;box-shadow:0 2px 4px rgba(0,0,0,0.2)">${r.fotos.length}</span>
              </div>
            ` : ''}
          </div>
        </td>
        <td data-label="Acciones">
          <button class="btn btn-outline btn-sm" onclick="verDetalleSesion('${r.id}')">Detalle</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function verDetalleSesion(id) {
  // Cerramos el modal de historial si está abierto para evitar solapamiento
  cerrarModal('modalHistorialMaquina');

  const container = document.getElementById('detalleContenido');
  container.innerHTML = '<div style="padding:40px;text-align:center"><span class="spinner"></span> Cargando detalle...</div>';
  abrirModal('modalDetalle');

  const res = await apiFetch(`/api/sesion/${id}/detalle`);
  if (!res.ok) {
    container.innerHTML = `<div class="alert alert-danger">Error: ${res.error}</div>`;
    return;
  }

  const { sesion } = res.data;
  const isIncidencia = sesion.tipo === 'Incidencia';
  const tipoIcon = isIncidencia ? '🚨' : '🛠️';
  const tipoLabel = isIncidencia ? 'Incidencia' : 'Mantenimiento';
  const tipoClass = isIncidencia ? 'vencido' : 'ok';

  container.innerHTML = `
    <div class="detail-container">
      <div class="detail-header-info">
        <div class="detail-machine">
          <span class="machine-icon">🖨️</span>
          <div>
            <div class="machine-name">${sesion.maquina}</div>
            <div class="machine-sala">📍 ${sesion.sala}</div>
          </div>
        </div>
        <div class="estado-badge ${tipoClass}" style="padding: 6px 12px; margin: 0;">
          <div style="font-size: 13px; font-weight: 600;">${tipoIcon} ${tipoLabel}</div>
        </div>
      </div>

      <div class="detail-stats-grid">
        <div class="detail-stat">
          <div class="label">👷 Operario</div>
          <div class="value">${sesion.operario}</div>
        </div>
        <div class="detail-stat">
          <div class="label">📅 Fecha y Hora</div>
          <div class="value">${formatFechaHora(sesion.completado_en)}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="section-label">📝 Observaciones</div>
        <div class="detail-notes">
          ${sesion.observaciones || '<span class="text-muted">Sin observaciones.</span>'}
        </div>
      </div>

      ${sesion.fotos && sesion.fotos.length > 0 ? `
        <div class="detail-section">
          <div class="section-label">🖼️ Fotos de Evidencia</div>
          <div class="detail-photos">
            ${sesion.fotos.map(f => `
              <div class="detail-photo-wrapper" onclick="window.open('${f}')">
                <img src="${f}" alt="Evidencia" loading="lazy">
                <div class="photo-overlay">🔍 Ver detalle</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

async function verHistorialMaquina(nombreMaquina) {
  document.getElementById('historialMaquinaTitulo').textContent = nombreMaquina;
  document.getElementById('historialMaquinaSub').textContent = 'Filtrando registros...';
  const tbody = document.getElementById('tablaHistorialMaquina');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px"><span class="spinner"></span> Buscando...</td></tr>';
  abrirModal('modalHistorialMaquina');

  // Buscamos en los datos locales primero (muy rápido)
  const filtrados = datosHistorial.filter(r => r.maquina === nombreMaquina);
  
  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted)">No hay mantenimientos registrados todavía</td></tr>';
    document.getElementById('historialMaquinaSub').textContent = '0 registros encontrados';
    return;
  }

  document.getElementById('historialMaquinaSub').textContent = `${filtrados.length} mantenimientos realizados`;
  
  tbody.innerHTML = filtrados.map(r => {
    const isInc = r.tipo === 'Incidencia';
    return `
      <tr>
        <td data-label="Fecha" style="font-size:12px">${formatFechaHora(r.completado_en)}</td>
        <td data-label="Operario" style="font-size:13px">${r.operario}</td>
        <td data-label="Tipo">
           <div style="display:flex;align-items:center;gap:8px">
             <span class="estado-badge ${isInc ? 'vencido' : 'ok'}" style="font-size:10px;padding:2px 6px">${r.tipo}</span>
             ${r.tiene_fotos ? `
               <div onclick="window.open('${r.fotos[0]}', '_blank')" style="cursor:pointer;position:relative;display:flex;align-items:center;justify-content:center">
                 <img src="${r.fotos[0]}" style="width:24px;height:24px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">
                 <span style="position:absolute;font-size:10px;background:rgba(0,0,0,0.6);color:white;padding:1px 3px;border-radius:4px;bottom:-2px;right:-2px">${r.fotos.length}</span>
               </div>
             ` : ''}
           </div>
        </td>
        <td data-label="Nota" title="${r.observaciones || ''}" style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${r.observaciones || '<span class="text-muted">Sin notas</span>'}
        </td>
        <td data-label="Acciones">
          <button class="btn btn-outline btn-sm" style="padding:2px 8px;font-size:11px" onclick="verDetalleSesion('${r.id}')">Ver detalle</button>
        </td>
      </tr>
    `;
  }).join('');
}

function exportarCSV() {
  apiFetch('/api/historial').then(res => {
    if (!res.ok) return;
    const rows = [['ID', 'Máquina', 'Sala', 'Operario', 'Inicio', 'Fin', 'Observaciones']];
    res.data.forEach(r => {
      rows.push([r.id, r.maquina, r.sala, r.operario, r.iniciado_en, r.completado_en, r.observaciones || '']);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `historial_mantenimiento_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  });
}

// ── Operarios ─────────────────────────────────────────────────────────────────
function renderOperarios() {
  const tbody = document.getElementById('tablaOperarios');
  if (!tbody) return;

  if (isCargando && !datosOperarios.length) {
    tbody.innerHTML = skeletonTabla(5);
    return;
  }

  tbody.innerHTML = datosOperarios.map(o => `
    <tr>
      <td data-label="ID" class="text-muted">#${o.id}</td>
      <td data-label="Nombre"><span class="fw-600">${o.nombre}</span></td>
      <td data-label="PIN">
        <span style="background:var(--bg-secondary);padding:4px 10px;border-radius:6px;font-family:monospace;font-size:13px;letter-spacing:0.1em">****</span>
      </td>
      <td data-label="Estado"><span class="estado-badge ok">✅ Activo</span></td>
      <td data-label="Acciones">
        <button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger)" onclick="eliminarOperario('${o.id}')">🗑️ Borrar</button>
      </td>
    </tr>
  `).join('');
}

function abrirModalOperario() {
  document.getElementById('nuevoNombre').value = '';
  document.getElementById('nuevoPin').value = '';
  document.getElementById('msgOperario').innerHTML = '';
  abrirModal('modalOperario');
}

async function crearOperario() {
  const nombre = document.getElementById('nuevoNombre').value.trim();
  const pin = document.getElementById('nuevoPin').value.trim();
  const msg = document.getElementById('msgOperario');

  if (!nombre || !pin) {
    msg.innerHTML = '<div class="alert alert-warning">⚠️ Completa todos los campos</div>';
    return;
  }

  const res = await apiFetch('/api/operarios', { method: 'POST', body: { nombre, pin } });

  if (res.ok) {
    cerrarModal('modalOperario');
    await cargarDatosBase();
    renderOperarios();
  } else {
    msg.innerHTML = `<div class="alert alert-danger">❌ ${res.error}</div>`;
  }
}

async function eliminarOperario(id) {
  if (!confirm('¿Seguro que quieres borrar este operario?')) return;
  const res = await apiFetch(`/api/operario/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await cargarDatosBase();
    renderOperarios();
  } else {
    alert('Error al borrar: ' + res.error);
  }
}

const ROL_BADGES = {
  admin:   { label: '🛡️ Administrador', cls: 'azul' },
  tecnico: { label: '🔧 Técnico', cls: 'verde' },
  usuario: { label: '👤 Usuario', cls: '' },
};

function renderUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  const empty = document.getElementById('usuariosEmpty');
  if (!tbody) return;

  if (isCargando && !datosUsuarios.length) {
    tbody.innerHTML = skeletonTabla(7);
    return;
  }

  const lista = datosUsuarios.filter(u => u.activo);
  if (!lista.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = lista.map(u => {
    const rol = ROL_BADGES[u.rol] || { label: u.rol, cls: '' };
    return `
    <tr>
      <td data-label="ID" class="text-muted">#${u.id}</td>
      <td data-label="Nombre"><span class="fw-600">${u.nombre}</span></td>
      <td data-label="Email" style="font-size:13px;color:var(--text-secondary)">${u.email || '–'}</td>
      <td data-label="Rol"><span class="estado-badge ${rol.cls}">${rol.label}</span></td>
      <td data-label="PIN (QR)">
        ${u.pin ? `<span style="background:var(--bg-secondary);padding:4px 8px;border-radius:6px;font-family:monospace">${u.pin}</span>` : '<span class="text-muted">–</span>'}
      </td>
      <td data-label="Estado"><span class="estado-badge ok">✅ Activo</span></td>
      <td data-label="Alta" style="font-size:12px;color:var(--text-muted)">${formatFechaHora(u.creado_en)}</td>
      <td data-label="Acciones"><button class="btn btn-outline btn-sm" onclick="eliminarUsuarioAdmin(${u.id})" title="Desactivar usuario">🗑️</button></td>
    </tr>
  `;
  }).join('');
}

function abrirModalUsuario() {
  document.getElementById('nuevoUsuarioNombre').value = '';
  document.getElementById('nuevoUsuarioEmail').value = '';
  document.getElementById('nuevoUsuarioPin').value = '';
  document.getElementById('nuevoUsuarioRol').value = 'usuario';
  document.getElementById('msgUsuario').innerHTML = '';
  abrirModal('modalUsuario');
}

async function crearUsuario() {
  const nombre = document.getElementById('nuevoUsuarioNombre').value.trim();
  const email = document.getElementById('nuevoUsuarioEmail').value.trim();
  const pin = document.getElementById('nuevoUsuarioPin').value.trim();
  const rol = document.getElementById('nuevoUsuarioRol').value;
  const msg = document.getElementById('msgUsuario');

  if (!nombre) {
    msg.innerHTML = '<div class="alert alert-warning">⚠️ El nombre es obligatorio</div>';
    return;
  }

  const res = await apiFetch('/api/usuarios', { method: 'POST', body: { nombre, email, pin, rol } });

  if (res.ok) {
    cerrarModal('modalUsuario');
    await cargarDatosBase();
    renderUsuarios();
  } else {
    msg.innerHTML = `<div class="alert alert-danger">❌ ${res.error}</div>`;
  }
}

async function eliminarUsuarioAdmin(id) {
  if (!confirm('¿Desactivar este usuario?')) return;
  const res = await apiFetch(`/api/usuario/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await cargarDatosBase();
    renderUsuarios();
  }
}

// ── Utilidades ────────────────────────────────────────────────────────────────
// --- SUPABASE WRAPPER FOR ADMIN ---
async function apiFetch(url, options = {}) {
  const method = options.method || 'GET';
  const payload = options.body; // In admin.js, body is already an object in most calls, but let's be safe
  const client = window.supabaseClient;
  const pin = localStorage.getItem('admin_pin');

  // Simple PIN-based auth check (basic mockup of what GAS was doing)
  if (url !== '/api/login-admin') {
     const { data: config } = await client.from('config').select('valor').eq('clave', 'admin_pin').single();
     if (config && config.valor !== pin) {
       return { ok: false, error: 'No autorizado', code: 403 };
     }
  }

  try {
    if (url === '/api/login-admin') {
      const { data: config } = await client.from('config').select('valor').eq('clave', 'admin_pin').single();
      if (config && config.valor === pin) return { ok: true };
      return { ok: false, error: 'PIN incorrecto' };
    }

    if (url.includes('/api/all-data')) {
      const [salas, equipos, operarios, usuarios, registros] = await Promise.all([
        client.from('salas').select('*'),
        client.from('equipos').select('*, salas(nombre)'),
        client.from('operarios').select('*').eq('activo', true),
        client.from('usuarios').select('*').eq('activo', true),
        client.from('registros').select('*').order('timestamp', { ascending: false }).limit(100)
      ]);

      // Calculate dashboard stats
      const hoy = new Date().toISOString().split('T')[0];
      const { data: statsHoy } = await client.rpc('count_registros_dia', { dia: hoy }); // We'll need a simple RPC or just filter
      // For simplicity here, let's just calculate from the fetched records or do separate queries
      
      const formattedMaquinas = (equipos.data || []).map(m => {
        const h = new Date();
        const frec = m.frecuencia_dias || 7;
        let estadoMant = 'pendiente';
        if (m.ultimo_mantenimiento) {
          const ult = new Date(m.ultimo_mantenimiento);
          const difDias = (h - ult) / (1000 * 60 * 60 * 24);
          if (difDias > frec) estadoMant = 'vencido';
          else if (difDias > frec * 0.8) estadoMant = 'proximo';
          else estadoMant = 'ok';
        }
        return { ...m, sala_nombre: m.salas ? m.salas.nombre : 'Sin sala', estado_mantenimiento: estadoMant };
      });

      // Group by day for the chart
      const registrosData = registros.data || [];
      const porDiaMap = {};
      const porMaquinaMap = {};
      
      registrosData.forEach(r => {
        const dia = r.timestamp.split('T')[0];
        porDiaMap[dia] = (porDiaMap[dia] || 0) + 1;
        
        const maq = r.maquina_nombre || 'Desconocida';
        porMaquinaMap[maq] = (porMaquinaMap[maq] || 0) + 1;
      });

      const dashboard = {
        hoy: registrosData.filter(r => r.timestamp.startsWith(hoy) && r.tipo === 'Mantenimiento').length,
        semana: registrosData.filter(r => (r.tipo === 'Mantenimiento' || !r.tipo)).length, 
        pendientes: formattedMaquinas.filter(m => m.estado_mantenimiento === 'vencido' || m.estado_mantenimiento === 'pendiente').length,
        proximos: formattedMaquinas.filter(m => m.estado_mantenimiento === 'proximo').length,
        porDia: Object.entries(porDiaMap).map(([dia, total]) => ({ dia, total })).sort((a,b) => a.dia.localeCompare(b.dia)),
        porMaquina: Object.entries(porMaquinaMap).map(([nombre, total_sesiones]) => ({ nombre, total_sesiones })).sort((a,b) => b.total_sesiones - a.total_sesiones)
      };

      return {
        ok: true,
        data: {
          salas: salas.data,
          maquinas: formattedMaquinas,
          operarios: operarios.data,
          usuarios: usuarios.data,
          historial: (registros.data || []).map(r => ({
            id: r.id,
            maquina: r.maquina_nombre,
            sala: r.sala_nombre,
            operario: r.operario_nombre,
            iniciado_en: r.timestamp,
            completado_en: r.timestamp,
            observaciones: r.notas,
            tipo: r.tipo,
            fotos: r.photos || [],
            tiene_fotos: (r.photos && r.photos.length > 0)
          })),
          dashboard
        }
      };
    }

    if (url.includes('/api/maquinas') && method === 'POST') {
      const { data, error } = await client.from('equipos').insert(payload).select().single();
      if (error) throw error;
      return { ok: true, data };
    }

    if (url.includes('/api/maquina/')) {
      const id = url.split('/')[3];
      if (method === 'PUT') {
        const { error } = await client.from('equipos').update(payload).eq('id', id);
        if (error) throw error;
        return { ok: true };
      }
      if (method === 'DELETE') {
        const { error } = await client.from('equipos').delete().eq('id', id);
        if (error) throw error;
        return { ok: true };
      }
    }

    if (url.includes('/api/operarios') && method === 'POST') {
      const { data, error } = await client.from('operarios').insert(payload).select().single();
      if (error) throw error;
      return { ok: true, data };
    }

    if (url.includes('/api/operarios') && method === 'POST') {
      const { data, error } = await client.from('operarios').insert(payload).select().single();
      if (error) throw error;
      return { ok: true, data };
    }

    if (url.includes('/api/operario/')) {
      const parts = url.split('/');
      const id = parts[parts.length - 1];
      console.log('Intentando borrar operario con ID:', id);
      if (method === 'DELETE') {
        const { error } = await client.from('operarios').delete().eq('id', id);
        if (error) {
          console.error('Error de Supabase al borrar:', error);
          throw error;
        }
        return { ok: true };
      }
    }

    if (url.includes('/api/usuarios') && method === 'POST') {
      const { data, error } = await client.from('usuarios').insert(payload).select().single();
      if (error) throw error;
      return { ok: true, data };
    }

    if (url.includes('/api/usuario/')) {
      const id = url.split('/')[3];
      if (method === 'DELETE') {
        const { error } = await client.from('usuarios').update({ activo: false }).eq('id', id);
        if (error) throw error;
        return { ok: true };
      }
    }

    if (url.includes('/api/sesion/') && url.includes('/detalle')) {
      const id = url.split('/')[3];
      const { data: reg, error } = await client.from('registros').select('*').eq('id', id).single();
      if (error) throw error;
      
      return {
        ok: true,
        data: {
          sesion: {
            id: reg.id,
            maquina: reg.maquina_nombre,
            sala: reg.sala_nombre,
            operario: reg.operario_nombre,
            iniciado_en: reg.timestamp,
            completado_en: reg.timestamp,
            observaciones: reg.notas,
            tipo: reg.tipo,
            fotos: reg.photos || []
          },
          items: []
        }
      };
    }

    if (url.includes('/api/maquina/') && url.includes('/qr')) {
      const id = url.split('/')[3];
      // Construir la URL que el operario escaneará
      // Forzamos que siempre apunte a operario.html independientemente de si estamos en dashboard o admin
      const currentPath = window.location.pathname;
      let newPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1) + 'operario.html';
      const targetUrl = `${window.location.origin}${newPath}?maquinaId=${id}`;
      
      return {
        ok: true,
        data: {
          qr: `https://quickchart.io/qr?text=${encodeURIComponent(targetUrl)}&size=300&margin=2`,
          url: targetUrl
        }
      };
    }

    // Fallback for unimplemented endpoints
    return { ok: false, error: 'Endpoint not implemented' };

  } catch (err) {
    console.error('Error in Supabase apiFetch:', err);
    return { ok: false, error: err.message };
  }
}

// ── Gestión de Autenticación ──────────────────────────────────────────────────
async function intentarLogin() {
  const input = document.getElementById('adminPinInput');
  const error = document.getElementById('loginError');
  const card = document.getElementById('loginCard');
  const pin = input.value.trim();

  if (!pin) return;

  error.innerHTML = '<span class="spinner-sm"></span> Verificando...';
  
  // Guardamos temporalmente para validar contra el servidor
  localStorage.setItem('admin_pin', pin);

  const res = await apiFetch('/api/login-admin', { method: 'POST' });
  
  if (res.ok) {
    error.innerHTML = '<span style="color:var(--success)">✅ ¡Correcto! Entrando...</span>';
    
    // Inyectar interfaz inmediatamente por seguridad
    const container = document.getElementById('dashboardContent');
    if (container) {
      container.innerHTML = DASHBOARD_HTML;
    }
    
    setTimeout(() => {
      document.documentElement.classList.remove('auth-locked');
      location.reload();
    }, 500);
  } else {
    localStorage.removeItem('admin_pin');
    error.innerHTML = '❌ PIN administrativo incorrecto';
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 400);
    input.value = '';
    input.focus();
  }
}

function cerrarSesionAdmin() {
  localStorage.removeItem('admin_pin');
  location.reload();
}

function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }

function showLoader(show) {
  // Deshabilitado por petición del usuario
}

function formatFechaHora(str) {
  if (!str) return '–';
  const d = new Date(str);
  return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatFechaDia(str) {
  if (!str) return '–';
  const [y, m, d] = str.split('-');
  return `${d}/${m}`;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function escapar(str) {
  return String(str).replace(/'/g, "\\'");
}

async function recargarTodo() {
  isCargando = true;
  const grid = document.getElementById('gridMaquinas');
  if (grid) grid.innerHTML = skeletonMaquinas();
  
  await cargarDatosBase();
  isCargando = false;
}

// Cerrar modal al hacer clic fuera
document.querySelectorAll('.overlay').forEach(ov => {
  ov.addEventListener('click', e => {
    if (e.target === ov) ov.classList.remove('open');
  });
});

// Responsive
if (window.innerWidth < 768) {
  document.getElementById('btnMenuMobile').style.display = 'flex';
}

// ── Galería de Fotos ──────────────────────────────────────────────────────────
async function renderizarGaleria() {
  const container = document.getElementById('galeriaContent');
  if (!container) return;
  
  container.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:60px;background:var(--bg-card);border-radius:12px;border:1px solid var(--border)">
      <div class="spinner" style="margin-bottom:16px"></div>
      <p style="color:var(--text-muted)">Cargando galería de imágenes...</p>
    </div>
  `;
  
  try {
    const { data: registros, error } = await window.supabaseClient
      .from('registros')
      .select('id, maquina_nombre, operario_nombre, timestamp, photos')
      .not('photos', 'is', null)
      .order('timestamp', { ascending: false });
      
    if (error) throw error;
    
    const allPhotos = [];
    registros.forEach(r => {
      if (Array.isArray(r.photos)) {
        r.photos.forEach(url => {
          allPhotos.push({ url, maquina: r.maquina_nombre, operario: r.operario_nombre, fecha: r.timestamp, id: r.id });
        });
      }
    });
    
    if (allPhotos.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:80px;background:var(--bg-card);border-radius:12px;border:1px solid var(--border)">
          <div style="font-size:48px;margin-bottom:16px">🖼️</div>
          <h3 style="margin-bottom:8px">Galería vacía</h3>
          <p style="color:var(--text-muted)">No se han encontrado fotos todavía.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = allPhotos.map(p => `
      <div class="gallery-card" onclick="verDetalleSesion('${p.id}')">
        <img src="${p.url}" alt="Foto ${p.maquina}" loading="lazy">
        <div class="gallery-info">
          <div class="gallery-title">${p.maquina}</div>
          <div class="gallery-meta">${formatFechaHora(p.fecha)} · ${p.operario}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("Error cargando galería:", err);
    container.innerHTML = '❌ Error de conexión';
  }
}
