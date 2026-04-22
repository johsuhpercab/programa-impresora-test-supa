'use strict';

const API = 'https://script.google.com/macros/s/AKfycbwW2_UWpOS45F-3BbyVbUvtxIJ3b_OP_Pnl_cSgSwO-BXz9nSzqoTb8oxnh185za0M/exec'; // <--- URL DE LA WEB APP OPTIMIZADA
let datosSalas = [];
let datosMaquinas = [];
let datosUsuarios = [];
let datosHistorial = []; // Reutilizar datos ya cargados
let isCargando = false;
// Detectar base path (útil para GitHub Pages en subcarpetas)
let serverHost = window.location.href.substring(0, window.location.href.lastIndexOf('/'));

async function detectarServidor() {
  try {
    const res = await fetch('/api/info');
    const json = await res.json();
    if (json.ok && json.data.url) {
      serverHost = json.data.url;
      console.log("🔗 QR Host detectado:", serverHost);
    }
  } catch (e) {
    console.warn("⚠️ No se pudo obtener IP local del servidor, usando origin actual.");
  }
}

let rolActual = 'admin';

// ── Simulator Roles (Eliminado para usar seguridad real) ──────────────────
function cambiarRolSimulado(nuevoRol) {
  // Función mantenida solo para compatibilidad de UI si es necesario, 
  // pero la seguridad real ahora depende del PIN.
}


document.addEventListener('DOMContentLoaded', async () => {
  const pin = localStorage.getItem('admin_pin');
  detectarServidor(); // Cargar IP real para los QRs
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

// El filtro de operario ahora es un input de texto, no necesita población inicial

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

  // Badge incidencias pendientes
  const pendientesCount = datosHistorial.filter(r => r.tipo === 'Incidencia' && !r.resuelta).length;
  const incBadge = document.getElementById('badge-incidencias');
  if (incBadge) {
    incBadge.textContent = pendientesCount;
    incBadge.style.display = pendientesCount > 0 ? 'inline' : 'none';
  }
}

// ── Incidencias ─────────────────────────────────────────────────────────────
function renderIncidencias(filtro = 'todas') {
  const grid = document.getElementById('gridTicketsIncidencias');
  const empty = document.getElementById('incidenciasEmpty');
  if (!grid) return;

  // Actualizar estados de botones de filtro
  ['todas', 'pendientes', 'resueltas'].forEach(f => {
    const btn = document.getElementById(`btn-inc-${f}`);
    if (btn) btn.classList.toggle('active', f === filtro);
  });

  let lista = datosHistorial.filter(r => r.tipo === 'Incidencia');
  
  // Cálculo de KPIs locales para el panel
  const totalPendientes = lista.filter(r => !r.resuelta && !r.en_seguimiento).length;
  const totalResueltas = lista.filter(r => r.resuelta).length;
  const totalSeguimiento = lista.filter(r => !r.resuelta && r.en_seguimiento).length;

  if (document.getElementById('kpi-inc-pendientes')) document.getElementById('kpi-inc-pendientes').textContent = totalPendientes;
  if (document.getElementById('kpi-inc-resueltas')) document.getElementById('kpi-inc-resueltas').textContent = totalResueltas;
  if (document.getElementById('kpi-inc-seguimiento')) document.getElementById('kpi-inc-seguimiento').textContent = totalSeguimiento;

  if (filtro === 'pendientes') lista = lista.filter(r => !r.resuelta);
  if (filtro === 'resueltas') lista = lista.filter(r => r.resuelta);

  if (!lista.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = lista.map(r => {
    const resuelta = r.resuelta || false;
    const esSeguimiento = !resuelta && r.en_seguimiento; 
    const statusClass = resuelta ? 'resuelto' : (esSeguimiento ? 'seguimiento' : 'urgente');
    const statusText = resuelta ? '✅ Finalizado' : (esSeguimiento ? '📝 En Seguimiento' : '🚨 Pendiente');

    return `
      <div class="ticket-card ${statusClass} fade-in" onclick="verDetalleSesion('${r.id}')">
        <div class="ticket-header">
          <div class="ticket-machine-name">${r.maquina}</div>
          <span class="estado-badge ${statusClass}">${statusText}</span>
        </div>
        <div class="ticket-body">
          <div class="ticket-sala">📍 ${r.sala}</div>
          <div class="ticket-desc">${truncate(r.observaciones || 'Sin descripción detallada', 120)}</div>
          <div class="ticket-date">🗓️ Reportado: ${formatFechaHora(r.completado_en)}</div>
          <div class="ticket-date">👷 Operario: ${r.operario}</div>
          
          ${esSeguimiento ? `
            <div class="ticket-last-note">
              Última nota: Revisión técnica en curso...
            </div>
          ` : ''}
        </div>
        <div class="ticket-footer">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); verDetalleSesion('${r.id}')">Gestionar</button>
          ${!resuelta ? `
            <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); toggleResolucionIncidencia('${r.id}', true)">Cerrar Ticket</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Navegación ────────────────────────────────────────────────────────────────
const sectionTitles = {
  dashboard: ['Panel General', 'Resumen del sistema'],
  maquinas: ['Máquinas', 'Estado y gestión de todas las máquinas'],
  incidencias: ['Centro de Incidencias', 'Gestión de fallos técnicos y reparaciones'],
  historial: ['Mantenimientos', 'Registro de mantenimientos realizados'],
  qrcodes: ['Códigos QR', 'QR individuales para el operario móvil'],
  usuarios: ['Administradores', 'Gestión de cuentas con acceso al panel']
};

function navigateTo(section) {
  // Verificación de roles (solo admin puede ver gestión de máquinas, QR y usuarios)
  const rutasRestringidas = ['usuarios', 'qrcodes'];
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
  if (section === 'incidencias') renderIncidencias();
  if (section === 'historial') { cargarHistorial(); poblarFiltroMaquinasHistorial(); }
  if (section === 'usuarios') renderUsuarios();
  if (section === 'qrcodes') renderQRs();
}

function renderActualSection() {
  const activeSection = document.querySelector('.section.active');
  if (!activeSection) return;
  const id = activeSection.id.replace('section-', '');
  if (id === 'maquinas') renderMaquinas();
  if (id === 'incidencias') renderIncidencias();
  if (id === 'historial') cargarHistorial();
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
    const resuelta = r.resuelta || false;
    const rowStyle = (isIncidencia && !resuelta) ? 'color: var(--danger); font-weight: 600;' : '';
    const icon = isIncidencia ? (resuelta ? '✅' : '🚨') : '🛠️';

    return `
      <tr onclick="verDetalleSesion('${r.id}')" style="cursor:pointer">
        <td data-label="Máquina"><span style="${rowStyle}">${icon} ${r.maquina}</span></td>
        <td data-label="Sala"><span class="text-muted">${r.sala}</span></td>
        <td data-label="Operario">${r.operario}</td>
        <td data-label="Fecha y hora">${formatFechaHora(r.completado_en)}</td>
        <td data-label="Estado">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
            <span class="estado-badge ${isIncidencia ? (resuelta ? 'ok' : 'vencido') : 'ok'}" style="font-size:10px">
              ${isIncidencia ? (resuelta ? 'Resuelta' : 'Pendiente') : 'Completado'}
            </span>
            ${r.tiene_fotos ? `
              <div style="position:relative;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <img src="${r.fotos[0]}" style="width:24px;height:24px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
              </div>
            ` : ''}
          </div>
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
            <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); verHistorialMaquina('${m.id}')" style="background:rgba(79, 142, 247, 0.1); border-color:var(--accent)">📋 Historial</button>
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
  const qrContainer = document.getElementById('qrImgContainer');
  qrContainer.innerHTML = '';
  qrContainer.style.cursor = 'pointer';
  
  const targetUrl = `${serverHost}/operario.html?maquinaId=${id}`;
  qrContainer.onclick = () => window.open(targetUrl, '_blank');
  
  document.getElementById('qrUrl').textContent = 'Generando...';
  abrirModal('modalQR');

  const qrUrlEl = document.getElementById('qrUrl');
  qrUrlEl.textContent = targetUrl;
  qrUrlEl.href = targetUrl;
  qrUrlEl.style.textDecoration = 'underline'; // Asegurar que parezca clickeable
  
  new QRCode(qrContainer, {
    text: targetUrl,
    width: 256,
    height: 256,
    colorDark: "#1a1a2e",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
}

function imprimirTodosLosQRs() {
  const salaFiltro = document.getElementById('filtroSalaQR').value;
  const lista = salaFiltro
    ? datosMaquinas.filter(m => String(m.sala_id) === String(salaFiltro))
    : datosMaquinas;

  if (!lista.length) return alert('No hay máquinas para imprimir');

  const printWindow = window.open('', '_blank');
  let baseOrigin = serverHost;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Imprimir todos los QRs</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <style>
        body { font-family: sans-serif; display: flex; flex-wrap: wrap; gap: 20px; padding: 20px; justify-content: center; }
        .qr-label { border: 1px solid #eee; padding: 15px; border-radius: 8px; text-align: center; width: 220px; page-break-inside: avoid; }
        .qr-name { font-weight: bold; font-size: 16px; margin-bottom: 4px; }
        .qr-sala { font-size: 12px; color: #666; margin-bottom: 10px; }
        .qr-canvas { display: flex; justify-content: center; margin-bottom: 10px; }
        .qr-url { font-size: 9px; color: #aaa; word-break: break-all; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      ${lista.map(m => `
        <div class="qr-label">
          <div class="qr-name">${m.nombre}</div>
          <div class="qr-sala">${m.sala_nombre}</div>
          <div class="qr-canvas" id="canvas-${m.id}"></div>
          <a class="qr-url" href="${baseOrigin}/operario.html?maquinaId=${m.id}" target="_blank">${baseOrigin}/operario.html?maquinaId=${m.id}</a>
        </div>
      `).join('')}
      <script>
        window.onload = () => {
          const maquinas = ${JSON.stringify(lista)};
          maquinas.forEach(m => {
            new QRCode(document.getElementById('canvas-' + m.id), {
              text: "${baseOrigin}/operario.html?maquinaId=" + m.id,
              width: 160,
              height: 160
            });
          });
          setTimeout(() => { window.print(); window.close(); }, 1200);
        };
      </script>
    </body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
}

function imprimirQR() {
  const nombre = document.getElementById('qrNombre').textContent;
  const sala = document.getElementById('qrSala').textContent;
  const container = document.getElementById('qrImgContainer');
  const imgElement = container.querySelector('img');
  const img = imgElement ? imgElement.src : '';
  const url = document.getElementById('qrUrl').textContent;
  
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>QR - ${nombre}</title>
    <style>body{font-family:sans-serif;text-align:center;padding:40px}
    h2{margin-bottom:4px}p{color:#666;font-size:14px;margin-bottom:20px}
    img{border:3px solid #000;border-radius:8px;width:240px}
    .url{font-size:11px;color:#999;margin-top:16px;word-break:break-all}
    </style></head><body>
    <h2>${nombre}</h2><p>${sala}</p>
    <img src="${img}">
    <a class="url" href="${url}" target="_blank">${url}</a>
    <script>window.onload=()=>{setTimeout(()=>window.print(),500)}</script>
    </body></html>`);
  w.document.close();
}

// ── Historial ─────────────────────────────────────────────────────────────────
async function poblarFiltroMaquinasHistorial() {
  const sel = document.getElementById('filtroMaquina');
  if(!sel) return;
  sel.innerHTML = '<option value="">Todas las máquinas</option>';
  datosMaquinas.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id; opt.textContent = `${m.nombre} (${m.sala_nombre})`;
    sel.appendChild(opt);
  });
}

async function cargarHistorial() {
  const params = new URLSearchParams();
  const sala = document.getElementById('filtroSala')?.value;
  const maquina = document.getElementById('filtroMaquina')?.value;
  const operario = document.getElementById('filtroOperario')?.value.trim();
  const desde = document.getElementById('filtroDesde')?.value;
  const hasta = document.getElementById('filtroHasta')?.value;

  if (sala) params.append('sala_id', sala);
  if (maquina) params.append('maquina_id', maquina);
  if (operario) params.append('operario_nombre', operario);
  if (desde) params.append('desde', desde);
  if (hasta) params.append('hasta', hasta);

  const tbody = document.getElementById('tablaHistorial');
  const empty = document.getElementById('historialEmpty');
  const hasFilters = sala || maquina || operario || desde || hasta;
  
  if (!hasFilters && datosHistorial.length > 0) {
    renderizarContenidoHistorial(datosHistorial, tbody, empty);
    return;
  }

  if (tbody) tbody.innerHTML = skeletonTabla(8);
  const res = await apiFetch('/api/historial?' + params.toString());

  if (!res.ok || !res.data.length) {
    if(tbody) tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  renderizarContenidoHistorial(res.data, tbody, empty);
}

function renderizarContenidoHistorial(data, tbody, empty) {
  if (!tbody) return;
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = data.map(r => {
    const isInc = r.tipo === 'Incidencia';
    const resuelta = r.resuelta || false;
    
    // Badge de resolución para incidencias
    let resBadge = '';
    if (isInc) {
      resBadge = resuelta 
        ? `<span class="estado-badge ok" style="margin-left:8px;font-size:10px;cursor:pointer" onclick="event.stopPropagation(); toggleResolucionIncidencia('${r.id}', false)">✅ Resuelta</span>`
        : `<span class="estado-badge vencido" style="margin-left:8px;font-size:10px;cursor:pointer" onclick="event.stopPropagation(); toggleResolucionIncidencia('${r.id}', true)">🚨 Pendiente</span>`;
    }

    return `
      <tr style="${isInc && !resuelta ? 'background: rgba(239, 68, 68, 0.03)' : ''}">
        <td data-label="#" class="text-muted" style="font-size:10px">#${r.id.toString().substring(0, 8)}...</td>
        <td data-label="Máquina">
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px">
            <span style="${isInc && !resuelta ? 'color:var(--danger);font-weight:600':''}">${isInc ? (resuelta ? '✅':'🚨') : '🛠️'} ${r.maquina}</span>
            ${resBadge}
          </div>
        </td>
        <td data-label="Sala">${r.sala}</td>
        <td data-label="Operario">${r.operario}</td>
        <td data-label="Inicio" style="font-size:11px">${formatFechaHora(r.iniciado_en)}</td>
        <td data-label="Fin" style="font-size:11px">${formatFechaHora(r.completado_en)}</td>
        <td data-label="Observ." style="font-size:11px;color:var(--text-muted)">
          <div style="display:flex;align-items:center;gap:12px;justify-content:space-between">
            <span style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.observaciones || '–'}</span>
            ${r.tiene_fotos ? `<img src="${r.fotos[0]}" style="width:26px;height:26px;object-fit:cover;border-radius:6px;cursor:pointer" onclick="event.stopPropagation(); window.open('${r.fotos[0]}','_blank')">` : ''}
          </div>
        </td>
        <td data-label="Acciones"><button class="btn btn-outline btn-sm" onclick="verDetalleSesion('${r.id}')">Detalles</button></td>
      </tr>
    `;
  }).join('');
}

async function toggleResolucionIncidencia(id, nuevoEstado) {
  let comentario = '';
  if (nuevoEstado) {
    comentario = prompt('Escribe un breve comentario sobre la solución (opcional):');
    if (comentario === null) return; // Cancelado
  }

  const res = await apiFetch(`/api/sesion/${id}/resolver`, { 
    method: 'PUT', 
    body: { 
      resuelta: nuevoEstado,
      comentario_resolucion: comentario 
    } 
  });
  
  if (res.ok) {
    await cargarDatosBase();
    if (document.getElementById('section-historial').classList.contains('active')) await cargarHistorial();
    if (document.getElementById('section-incidencias').classList.contains('active')) {
      const filtroActual = document.querySelector('.btn-outline.btn-sm.active[id^="btn-inc-"]')?.id.replace('btn-inc-', '') || 'todas';
      renderIncidencias(filtroActual);
    }
  } else {
    alert('No se pudo actualizar el estado: ' + res.error);
  }
}

async function verDetalleSesion(id) {
  cerrarModal('modalHistorialMaquina');
  const container = document.getElementById('detalleContenido');
  const titleEl = document.querySelector('#modalDetalle .modal-title');
  if(!container) return;
  container.innerHTML = '<div style="padding:40px;text-align:center"><span class="spinner"></span> Cargando...</div>';
  abrirModal('modalDetalle');

  const res = await apiFetch(`/api/sesion/${id}/detalle`);
  if (!res.ok) {
    container.innerHTML = `<div class="alert alert-danger">Error: ${res.error}</div>`;
    return;
  }

  const { sesion } = res.data;
  const isInc = sesion.tipo === 'Incidencia';
  const resuelta = sesion.resuelta || false;

  // Cambiar título del modal dinámicamente
  if (titleEl) titleEl.textContent = isInc ? 'Detalles de la Incidencia' : 'Detalles del Mantenimiento';

  container.innerHTML = `
    <div class="detail-container">
      <div class="detail-header-info" style="${isInc ? 'border-bottom: 2px solid var(--danger)' : ''}; margin-bottom: 20px;">
        <div class="detail-machine"><span class="machine-icon">${isInc ? '🚨' : '🖨️'}</span><div><div class="machine-name">${sesion.maquina}</div><div class="machine-sala">📍 ${sesion.sala}</div></div></div>
        <div style="display:flex;gap:8px">
          <div class="estado-badge ${isInc?'vencido':'ok'}">${isInc?'Incidencia':'Mantenimiento'}</div>
          ${isInc ? `<div class="estado-badge ${resuelta?'ok':'vencido'}" style="cursor:pointer" onclick="toggleResolucionIncidencia('${sesion.id}', ${!resuelta}); cerrarModal('modalDetalle');">${resuelta?'✅ Resuelta':'🚨 Pendiente'}</div>` : ''}
        </div>
      </div>

      <div style="display:flex; gap:20px; align-items:flex-start; flex-wrap:wrap">
        <!-- Columna Izquierda: Información -->
        <div style="flex: 1; min-width: 280px;">
          <div class="detail-stats-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 16px;">
            <div class="detail-stat"><div class="label">👷 Operario</div><div class="value" style="font-size:14px">${sesion.operario}</div></div>
            <div class="detail-stat"><div class="label">📅 Fecha</div><div class="value" style="font-size:14px">${formatFechaHora(sesion.completado_en)}</div></div>
          </div>
          
          <div class="detail-section" style="margin-bottom: 20px;">
            <div class="section-label">${isInc ? '🚩 Informe de Fallo' : '📝 Observaciones'}</div>
            <div class="detail-notes" style="font-size:13px; ${isInc ? 'background:rgba(239, 68, 68, 0.05); border-left:4px solid var(--danger)' : ''}">${sesion.observaciones || 'Sin notas'}</div>
          </div>

          ${sesion.comentario_resolucion ? `
            <div class="detail-section" style="margin-bottom: 20px;">
              <div class="section-label">✅ Solución / Resolución</div>
              <div class="detail-notes" style="font-size:13px; background:rgba(16, 185, 129, 0.05); border-left:4px solid var(--success); color:var(--success); font-weight:600">
                ${sesion.comentario_resolucion}
              </div>
            </div>
          ` : ''}

          <div style="display:flex; flex-direction:column; gap:12px">
            <button class="btn btn-outline btn-full" onclick="cerrarModal('modalDetalle'); verHistorialMaquina('${sesion.maquina}')" style="background:var(--bg-secondary); padding: 10px; font-size: 13px;">📋 Ver Historial de la máquina</button>
            
            ${isInc && !resuelta ? `
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:16px; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid var(--border)">
                <button class="btn btn-outline" onclick="editarDescripcionIncidencia('${sesion.id}')">✏️ Editar Reporte</button>
                <button class="btn btn-primary" onclick="toggleResolucionIncidencia('${sesion.id}', true)">✅ Resolver</button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Columna Derecha: Fotos -->
        ${sesion.fotos && sesion.fotos.length > 0 ? `
          <div style="width: 200px; flex-shrink: 0;">
            <div class="section-label">🖼️ Evidencias</div>
            <div style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
              ${sesion.fotos.map(f => `<img src="${f}" onclick="window.open('${f}')" style="width:100%; height: 140px; object-fit: cover; border-radius:10px; cursor:zoom-in; border:1px solid var(--border)" loading="lazy">`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  // --- Manejo de Seguimientos ---
  const seccionSeg = document.getElementById('seccionSeguimiento');
  const timeline = document.getElementById('seguimientoTimeline');
  
  if (isInc && seccionSeg && timeline) {
    seccionSeg.style.display = 'block';
    timeline.innerHTML = '<div style="text-align:center;padding:10px;opacity:0.5">Cargando hilo de seguimiento...</div>';
    
    // Guardar ID actual para la nueva nota
    window.currentIncidenciaId = id;

    // Cargar seguimientos desde la API
    const segRes = await apiFetch(`/api/incidencia/${id}/seguimientos`);
    if (segRes.ok && segRes.data) {
      const notas = segRes.data;
      if (notas.length === 0) {
        timeline.innerHTML = '<div style="text-align:center;padding:10px;opacity:0.5;font-size:12px">No hay notas registradas aún. El técnico puede empezar a documentar aquí.</div>';
      } else {
        timeline.innerHTML = notas.map(n => `
          <div class="timeline-item">
            <div class="timeline-meta">
              <b>${n.usuario_nombre || 'Técnico'}</b>
              <span>${formatFechaHora(n.timestamp)}</span>
            </div>
            <div class="timeline-content">
              <div class="timeline-text">${n.nota}</div>
            </div>
          </div>
        `).join('');
        // Hacer scroll al final
        timeline.scrollTop = timeline.scrollHeight;
      }
    } else {
      timeline.innerHTML = '<div style="color:var(--danger);font-size:12px">Error al cargar el historial de seguimiento.</div>';
    }
  } else if (seccionSeg) {
    seccionSeg.style.display = 'none';
  }
}

async function guardarNuevaNota() {
  const input = document.getElementById('nuevaNotaSeguimiento');
  const btn = document.getElementById('btnGuardarNota');
  const nota = input.value.trim();
  const id = window.currentIncidenciaId;

  if (!nota || !id) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm"></span> Guardando...';

  const res = await apiFetch(`/api/incidencia/${id}/seguimientos`, {
    method: 'POST',
    body: { nota }
  });

  if (res.ok) {
    input.value = '';
    // Recargar el detalle para ver la nueva nota
    verDetalleSesion(id);
  } else {
    alert('Error al guardar la nota: ' + res.error);
  }
  btn.disabled = false;
  btn.innerHTML = '<span>➕ Añadir Nota</span>';
}

async function editarDescripcionIncidencia(id) {
  const nuevaDesc = prompt('Edita el reporte de la incidencia:');
  if (nuevaDesc === null) return;
  
  const res = await apiFetch(`/api/incidencia/${id}/editar`, {
    method: 'PUT',
    body: { notas: nuevaDesc }
  });

  if (res.ok) {
    alert('Reporte actualizado correctamente');
    // Recargar datos y refrescar vista
    await cargarDatosBase();
    verDetalleSesion(id);
  } else {
    alert('Error al editar: ' + res.error);
  }
}

async function verHistorialMaquina(nombreMaquina) {
  document.getElementById('historialMaquinaTitulo').textContent = nombreMaquina;
  const tbody = document.getElementById('tablaHistorialMaquina');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px"><span class="spinner"></span></td></tr>';
  abrirModal('modalHistorialMaquina');

  const filtrados = datosHistorial.filter(r => r.maquina === nombreMaquina);
  if (!filtrados.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">Sin registros</td></tr>';
    return;
  }
  tbody.innerHTML = filtrados.map(r => `
    <tr>
      <td data-label="Fecha">${formatFechaHora(r.completado_en)}</td>
      <td data-label="Operario">${r.operario}</td>
      <td data-label="Tipo"><span class="estado-badge ${r.tipo==='Incidencia'?'vencido':'ok'}">${r.tipo}</span></td>
      <td data-label="Nota">${truncate(r.observaciones || '', 20)}</td>
      <td><button class="btn btn-outline btn-sm" onclick="verDetalleSesion('${r.id}')">Detalles</button></td>
    </tr>
  `).join('');
}

function exportarCSV() {
  const rows = [['ID', 'Máquina', 'Sala', 'Operario', 'Fecha', 'Observaciones']];
  datosHistorial.forEach(r => rows.push([r.id, r.maquina, r.sala, r.operario, r.completado_en, r.observaciones || '']));
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `historial_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ── Usuarios Admin ────────────────────────────────────────────────────────────
const ROL_BADGES = {
  admin:   { label: '🛡️ Administrador', cls: 'azul' },
  tecnico: { label: '🔧 Técnico', cls: 'verde' },
  usuario: { label: '👤 Usuario', cls: '' },
};

function renderUsuarios() {
  const tbody = document.getElementById('tablaUsuarios');
  if (!tbody) return;
  tbody.innerHTML = datosUsuarios.map(u => {
    const rol = ROL_BADGES[u.rol] || { label: u.rol || 'usuario', cls: '' };
    return `
    <tr>
      <td data-label="Nombre"><b>${u.nombre}</b></td>
      <td data-label="Rol"><span class="estado-badge ${rol.cls}">${rol.label}</span></td>
      <td data-label="PIN"><span style="font-family:monospace">${u.pin || '–'}</span></td>
      <td data-label="Estado"><span class="estado-badge ok">✅ Activo</span></td>
      <td data-label="Acciones"><button class="btn btn-outline btn-sm" onclick="eliminarUsuarioAdmin('${u.id}')">🗑️ Borrar</button></td>
    </tr>
  `;
  }).join('');
}

function abrirModalUsuario() {
  document.getElementById('usuarioId').value = '';
  document.getElementById('usuarioNombre').value = '';
  document.getElementById('usuarioPin').value = '';
  abrirModal('modalUsuario');
}

async function guardarUsuario() {
  const id = document.getElementById('usuarioId').value;
  const nombre = document.getElementById('usuarioNombre').value.trim();
  const pin = document.getElementById('usuarioPin').value.trim();
  if (!nombre) return;
  const payload = { nombre, pin, activo: true };
  let res = id ? await apiFetch(`/api/usuario/${id}`, { method: 'PUT', body: payload }) : await apiFetch('/api/usuarios', { method: 'POST', body: payload });
  if (res.ok) { cerrarModal('modalUsuario'); await cargarDatosBase(); renderUsuarios(); }
}

async function eliminarUsuarioAdmin(id) {
  if (confirm('¿Eliminar usuario?')) {
    const res = await apiFetch(`/api/usuario/${id}`, { method: 'DELETE' });
    if (res.ok) { await cargarDatosBase(); renderUsuarios(); }
  }
}

// ── Utilidades de Red (Supabase Wrapper) ──────────────────────────────────────
let cachedAdminPin = null;

async function apiFetch(url, options = {}) {
  const method = options.method || 'GET';
  const payload = options.body;
  const client = window.supabaseClient;
  const localPin = localStorage.getItem('admin_pin');

  if (!cachedAdminPin && url !== '/api/login-admin') {
     const { data: config } = await client.from('config').select('valor').eq('clave', 'admin_pin').single();
     if (config) cachedAdminPin = config.valor;
  }

  if (url !== '/api/login-admin' && cachedAdminPin && cachedAdminPin !== localPin) return { ok: false, error: 'No autorizado' };

  try {
    if (url === '/api/login-admin') {
      const { data: config } = await client.from('config').select('valor').eq('clave', 'admin_pin').single();
      if (config && config.valor === localPin) { cachedAdminPin = config.valor; return { ok: true }; }
      return { ok: false, error: 'PIN incorrecto' };
    }

    if (url.includes('/api/all-data')) {
      const [salas, equipos, usuarios, registros] = await Promise.all([
        client.from('salas').select('*'),
        client.from('equipos').select('*, salas(nombre)'),
        client.from('usuarios').select('*').eq('activo', true),
        client.from('registros').select('*').order('timestamp', { ascending: false }).limit(200)
      ]);
      const now = new Date();
      const hoy = now.toISOString().split('T')[0];
      const haceUnaSemana = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const regs = registros.data || [];
      
      const formattedMaquinas = (equipos.data || []).map(m => {
        const frec = m.frecuencia_dias || 7;
        let estadoMant = 'pendiente';
        if (m.ultimo_mantenimiento) {
          const dif = (now - new Date(m.ultimo_mantenimiento)) / (1000 * 60 * 60 * 24);
          if (dif > frec) estadoMant = 'vencido'; else if (dif > frec * 0.8) estadoMant = 'proximo'; else estadoMant = 'ok';
        }
        return { ...m, sala_nombre: m.salas ? m.salas.nombre : 'Sin sala', estado_mantenimiento: estadoMant };
      });

      const porDiaMap = {}; const porMaquinaMap = {};
      regs.forEach(r => {
        const dia = r.timestamp.split('T')[0];
        porDiaMap[dia] = (porDiaMap[dia] || 0) + 1;
        porMaquinaMap[r.maquina_nombre] = (porMaquinaMap[r.maquina_nombre] || 0) + 1;
      });

      return {
        ok: true,
        data: {
          salas: salas.data, maquinas: formattedMaquinas, usuarios: usuarios.data,
          historial: regs.map(r => ({ id: r.id, maquina: r.maquina_nombre, sala: r.sala_nombre, operario: r.operario_nombre, iniciado_en: r.timestamp, completado_en: r.timestamp, observaciones: r.notas || '', tipo: r.tipo, resuelta: r.resuelta || false, en_seguimiento: r.en_seguimiento || false, comentario_resolucion: r.comentario_resolucion, fotos: r.photos || [], tiene_fotos: (r.photos && r.photos.length > 0) })),
          dashboard: { hoy: regs.filter(r => r.timestamp.startsWith(hoy)).length, semana: regs.filter(r => r.timestamp >= haceUnaSemana).length, pendientes: formattedMaquinas.filter(m => m.estado_mantenimiento === 'vencido' || m.estado_mantenimiento === 'pendiente').length, proximos: formattedMaquinas.filter(m => m.estado_mantenimiento === 'proximo').length, porDia: Object.entries(porDiaMap).map(([dia, total]) => ({ dia, total })).sort((a,b) => a.dia.localeCompare(b.dia)), porMaquina: Object.entries(porMaquinaMap).map(([nombre, total_sesiones]) => ({ nombre, total_sesiones })).sort((a,b) => b.total_sesiones - a.total_sesiones) }
        }
      };
    }

    if (url.includes('/api/maquinas') && method === 'POST') {
      const { data, error } = await client.from('equipos').insert(payload).select().single();
      if (error) throw error; return { ok: true, data };
    }

    if (url.includes('/api/maquina/') && !url.includes('/qr')) {
      const id = url.split('/')[3];
      if (method === 'PUT') { await client.from('equipos').update(payload).eq('id', id); return { ok: true }; }
      if (method === 'DELETE') { await client.from('equipos').delete().eq('id', id); return { ok: true }; }
    }

    if (url.includes('/api/historial')) {
      const searchParams = new URL(url, window.location.origin).searchParams;
      let query = client.from('registros').select('*');
      if (searchParams.get('sala_id')) query = query.eq('sala_id', searchParams.get('sala_id'));
      if (searchParams.get('maquina_id')) query = query.eq('maquina_id', searchParams.get('maquina_id'));
      if (searchParams.get('operario_nombre')) query = query.ilike('operario_nombre', `%${searchParams.get('operario_nombre')}%`);
      if (searchParams.get('desde')) query = query.gte('timestamp', searchParams.get('desde'));
      if (searchParams.get('hasta')) query = query.lte('timestamp', searchParams.get('hasta') + 'T23:59:59');
      const { data, error } = await query.order('timestamp', { ascending: false });
      if (error) throw error;
      return { ok: true, data: (data || []).map(r => ({ id: r.id, maquina: r.maquina_nombre, sala: r.sala_nombre, operario: r.operario_nombre, iniciado_en: r.timestamp, completado_en: r.timestamp, observaciones: r.notas || '', tipo: r.tipo, resuelta: r.resuelta || false, fotos: r.photos || [], tiene_fotos: (r.photos && r.photos.length > 0) })) };
    }

    if (url.includes('/api/sesion/') && url.includes('/resolver')) {
      const id = url.split('/')[3];
      const { error } = await client.from('registros').update({ 
        resuelta: payload.resuelta,
        comentario_resolucion: payload.comentario_resolucion
      }).eq('id', id);
      if (error) throw error;
      return { ok: true };
    }

    if (url.includes('/api/sesion/') && url.includes('/detalle')) {
      const id = url.split('/')[3];
      const { data: reg, error } = await client.from('registros').select('*').eq('id', id).single();
      if (error) throw error;
      return { ok: true, data: { sesion: { id: reg.id, maquina: reg.maquina_nombre, sala: reg.sala_nombre, operario: reg.operario_nombre, iniciado_en: reg.timestamp, completado_en: reg.timestamp, observaciones: reg.notas || '', tipo: reg.tipo, resuelta: reg.resuelta || false, comentario_resolucion: reg.comentario_resolucion, fotos: reg.photos || [] }, items: [] } };
    }

    if (url.includes('/api/incidencia/') && url.includes('/seguimientos')) {
      const id = url.split('/')[3];
      if (method === 'GET') {
        const { data, error } = await client
          .from('seguimientos')
          .select('*')
          .eq('incidencia_id', id)
          .order('timestamp', { ascending: true });
        
        if (error) {
          console.warn('Tabla seguimientos no encontrada o error:', error);
          return { ok: true, data: [] };
        }
        return { ok: true, data };
      }
      
      if (method === 'POST') {
        const { data, error } = await client
          .from('seguimientos')
          .insert({
            incidencia_id: id,
            nota: payload.nota,
            usuario_nombre: 'Administrador',
            timestamp: new Date().toISOString()
          })
          .select()
          .single();
        
        // Actualizar automáticamente a "en seguimiento" si no estaba resuelta
        await client.from('registros').update({ en_seguimiento: true }).eq('id', id);
        
        if (error) throw error;
        return { ok: true, data };
      }
    }

    if (url.includes('/api/incidencia/') && url.includes('/editar')) {
      const id = url.split('/')[3];
      const { error } = await client.from('registros').update({ notas: payload.notas }).eq('id', id);
      if (error) throw error;
      return { ok: true };
    }

    return { ok: false, error: 'Endpoint not implemented' };
  } catch (err) { console.error('Error apiFetch:', err); return { ok: false, error: err.message }; }
}

async function intentarLogin() {
  const input = document.getElementById('adminPinInput');
  const error = document.getElementById('loginError');
  const card = document.getElementById('loginCard');
  const pin = input?.value.trim();
  if (!pin) return;
  error.innerHTML = 'Verificando...';
  localStorage.setItem('admin_pin', pin);
  const res = await apiFetch('/api/login-admin', { method: 'POST' });
  if (res.ok) { location.reload(); }
  else { localStorage.removeItem('admin_pin'); error.innerHTML = '❌ PIN incorrecto'; card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 400); }
}

function cerrarSesionAdmin() { localStorage.removeItem('admin_pin'); location.reload(); }
function abrirModal(id) { document.getElementById(id)?.classList.add('open'); }
function cerrarModal(id) { document.getElementById(id)?.classList.remove('open'); }
function formatFechaHora(str) { if (!str) return '–'; const d = new Date(str); return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }

function formatFechaDia(str) { if (!str) return '–'; const [y, m, d] = str.split('-'); return `${d}/${m}`; }
function truncate(str, len) { return str.length > len ? str.slice(0, len) + '…' : str; }
function escapar(str) { return String(str).replace(/'/g, "\\'"); }
async function recargarTodo() { await cargarDatosBase(); }

document.querySelectorAll('.overlay').forEach(ov => ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('open'); }));

function iniciarTour() {
  const driverInstance = window.driver?.js?.driver || window.driver;
  if (!driverInstance) return;

  const driverObj = driverInstance({
    showProgress: true,
    animate: true,
    steps: [
      { 
        popover: { 
          title: '✨ Bienvenido', 
          description: 'Recorrido rápido por el panel de administración del sistema.' 
        },
        onHighlightStarted: () => navigateTo('dashboard')
      },
      { 
        element: '#kpiGrid', 
        popover: { 
          title: '📊 Resumen General', 
          description: 'Aquí verás el estado actual del sistema en tiempo real.' 
        },
        onHighlightStarted: () => navigateTo('dashboard')
      },
      { 
        element: '#nav-maquinas', 
        popover: { 
          title: '🖨️ Máquinas', 
          description: 'Gestiona todo tu inventario de impresoras y su estado.' 
        } 
      },
      { 
        element: '#gridQRs', 
        popover: { 
          title: '📱 Códigos QR', 
          description: 'Desde aquí generas los códigos para que los operarios escaneen con su móvil.' 
        },
        onHighlightStarted: () => {
          navigateTo('qrcodes');
          // Esperamos a que la sección sea visible y se renderice el contenido para re-enfocar
          setTimeout(() => {
            if (driverObj.refresh) driverObj.refresh();
          }, 400);
        }
      },
      { 
        element: '#nav-historial', 
        popover: { 
          title: '📋 Historial', 
          description: 'Accede a todos los registros de mantenimiento e incidencias pasadas.' 
        },
        onHighlightStarted: () => navigateTo('historial')
      }
    ]
  });
  driverObj.drive();
}
