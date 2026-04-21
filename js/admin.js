'use strict';

const API = 'https://script.google.com/macros/s/AKfycbwW2_UWpOS45F-3BbyVbUvtxIJ3b_OP_Pnl_cSgSwO-BXz9nSzqoTb8oxnh185za0M/exec'; 
let datosSalas = [];
let datosMaquinas = [];
let datosOperarios = [];
let datosUsuarios = [];
let datosHistorial = []; 
let isCargando = false;
let rolActual = 'admin';

document.addEventListener('DOMContentLoaded', async () => {
  const pin = localStorage.getItem('admin_pin');
  if (!pin) return; 

  try {
    isCargando = true;
    const container = document.getElementById('dashboardContent');
    if (container) {
      container.innerHTML = DASHBOARD_HTML;
    }

    const grid = document.getElementById('gridMaquinas');
    if (grid) grid.innerHTML = skeletonMaquinas();
    const tbody = document.getElementById('dashboardUltimos');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted)"><span class="spinner" style="display:inline-block;margin-right:8px"></span>Conectando con Supabase...</td></tr>';
    
    await cargarDatosBase();
    
    setInterval(() => {
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
  const res = await apiFetch('/api/all-data');
  if (res.ok && res.data) {
    const d = res.data;
    datosSalas = d.salas || [];
    datosMaquinas = d.maquinas || [];
    datosOperarios = d.operarios || [];
    datosUsuarios = d.usuarios || [];
    datosHistorial = d.historial || [];
    actualizarVistaDashboard(d.dashboard, d.historial);
  }

  renderActualSection();

  ['filtroSalaMaquinas', 'filtroSala', 'filtroSalaQR', 'nuevoMaquinaSala'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = id.includes('nuevo') ? '<option value="">Seleccione una sala...</option>' : '<option value="">Todas las salas</option>';
    datosSalas.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.nombre;
      el.appendChild(opt);
    });
  });

  const selOp = document.getElementById('filtroOperario');
  if (selOp) {
    selOp.innerHTML = '<option value="">Todos los operarios</option>';
    datosOperarios.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.id; opt.textContent = o.nombre;
      selOp.appendChild(opt);
    });
  }

  const alertas = datosMaquinas.filter(m => m.estado_mantenimiento === 'vencido' || m.estado_mantenimiento === 'pendiente').length;
  const badge = document.getElementById('badge-alertas');
  if (badge) {
    if (alertas > 0) { badge.textContent = alertas; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  }
}

function showSection(id) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const target = document.getElementById('section-' + id);
  if (target) {
    target.classList.remove('hidden');
    const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.innerText.toLowerCase().includes(id.replace('gestion-', '').toLowerCase()) || (id === 'general' && b.innerText.includes('Panel General')));
    if (btn) btn.classList.add('active');
  }

  if (id === 'galeria') renderizarGaleria();
  
  if (window.innerWidth <= 1024) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }
}

async function renderizarGaleria() {
  const container = document.getElementById('galeriaContent');
  if (!container) return;
  
  container.innerHTML = '<div class="loader-inline">Cargando fotos...</div>';
  
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
      container.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align:center; padding: 40px;">No se han encontrado fotos subidas todavía.</p>';
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
    container.innerHTML = '❌ Error al cargar la galería.';
  }
}

function actualizarVistaDashboard(stats, historial) {
  if (!stats) return;
  const d = stats;
  document.getElementById('kpi-hoy').textContent = d.hoy;
  document.getElementById('kpi-semana').textContent = d.semana;
  document.getElementById('kpi-pendientes').textContent = d.pendientes;
  document.getElementById('kpi-proximos').textContent = d.proximos;

  renderBarChart('chartDias', (d.porDia || []).slice(-14).map(r => ({ label: formatFechaDia(r.dia), value: r.total })));
  renderBarChart('chartMaquinas', (d.porMaquina || []).map(r => ({ label: r.nombre, value: r.total_sesiones })).slice(0, 12));
  if (historial) renderUltimosMantenimientos(historial.slice(0, 8));
}

function renderBarChart(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container || !items.length) {
    if (container) container.innerHTML = '<div class="empty-state" style="padding:24px"><div class="icon">📊</div><p>Sin datos aún</p></div>';
    return;
  }
  const max = Math.max(...items.map(i => i.value), 1);
  container.innerHTML = items.map(i => `
    <div class="chart-bar-row">
      <div class="chart-bar-label" title="${i.label}">${truncate(i.label, 12)}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(i.value / max * 100).toFixed(1)}%"></div></div>
      <div class="chart-bar-val">${i.value}</div>
    </div>
  `).join('');
}

function renderUltimosMantenimientos(registros) {
  const tbody = document.getElementById('dashboardUltimos');
  if (!tbody) return;
  if (!registros.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">Sin mantenimientos aún</td></tr>';
    return;
  }
  tbody.innerHTML = registros.map(r => {
    const isIncidencia = r.tipo === 'Incidencia';
    const rowStyle = isIncidencia ? 'color: var(--danger); font-weight: 600;' : '';
    const icon = isIncidencia ? '🚨' : '🛠️';
    return `
      <tr onclick="verDetalleSesion('${r.id}')" style="cursor:pointer">
        <td data-label="Máquina"><span style="${rowStyle}">${icon} ${r.maquina}</span></td>
        <td data-label="Sala"><span class="text-muted">${r.sala}</span></td>
        <td data-label="Operario">${r.operario}</td>
        <td data-label="Fecha y hora">${formatFechaHora(r.completado_en)}</td>
        <td data-label="Acciones"><button class="btn btn-outline btn-sm">Detalle</button></td>
      </tr>
    `;
  }).join('');
}

function renderMaquinas() {
  const salaFiltro = document.getElementById('filtroSalaMaquinas')?.value || '';
  const grid = document.getElementById('gridMaquinas');
  if (!grid) return;
  
  const lista = salaFiltro ? datosMaquinas.filter(m => String(m.sala_id) === String(salaFiltro)) : datosMaquinas;
  if (!lista.length) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">🖨️</div><p>No hay máquinas en esta sala</p></div>';
    return;
  }

  let htmlResult = '';
  datosSalas.forEach((sala, index) => {
    if (salaFiltro && String(sala.id) !== String(salaFiltro)) return;
    const maquinasSala = lista.filter(m => m.sala_id === sala.id);
    if (maquinasSala.length > 0) {
      htmlResult += `
        <div class="espacio-section" style="margin-bottom:32px">
          <div class="espacio-header" style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding:12px 16px;background:rgba(79,142,247,0.08);border-radius:12px;border-left:4px solid var(--primary)">
            <div style="font-size:16px;font-weight:700;">🏢 ${sala.nombre}</div>
          </div>
          <div class="grid-maquinas-inner">
            ${maquinasSala.map(m => `
              <div class="maquina-card fade-in">
                <div class="maquina-header">
                  <div>
                    <div class="maquina-nombre">${m.nombre}</div>
                    <div class="maquina-tipo">${m.tipo}</div>
                  </div>
                  <span class="estado-badge ${m.estado_mantenimiento}">${m.estado_mantenimiento}</span>
                </div>
                <div class="maquina-info">
                  <span>📅 Frecuencia: cada ${m.frecuencia_dias} días</span>
                  <span>🕐 Último: ${m.ultimo_mantenimiento ? formatFechaHora(m.ultimo_mantenimiento) : 'Nunca'}</span>
                </div>
                <div class="maquina-actions">
                  <button class="btn btn-primary btn-sm" onclick="verQR('${m.id}', '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">📱 QR</button>
                  <button class="btn btn-outline btn-sm" onclick="editarMaquina('${m.id}')">✏️ Editar</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  });
  grid.innerHTML = htmlResult;
}

async function verQR(id, nombre, sala) {
  document.getElementById('qrNombre').textContent = nombre;
  document.getElementById('qrSala').textContent = sala;
  document.getElementById('qrImg').src = '';
  document.getElementById('qrUrl').textContent = 'Generando QR...';
  abrirModal('modalQR');
  const res = await apiFetch(`/api/maquina/${id}/qr`);
  if (res.ok) {
    document.getElementById('qrImg').src = res.data.qr;
    document.getElementById('qrUrl').textContent = res.data.url;
    document.getElementById('qrUrl').href = res.data.url;
  }
}

async function renderizarContenidoHistorial(data, tbody, empty) {
  if (empty) empty.style.display = 'none';
  tbody.innerHTML = data.map(r => {
    const isIncidencia = r.tipo === 'Incidencia';
    return `
      <tr style="${isIncidencia ? 'background: rgba(239, 68, 68, 0.03)' : ''}">
        <td data-label="Máquina"><strong>${isIncidencia ? '🚨' : '🛠️'} ${r.maquina}</strong></td>
        <td data-label="Sala">${r.sala}</td>
        <td data-label="Operario">${r.operario}</td>
        <td data-label="Fecha">${formatFechaHora(r.completado_en)}</td>
        <td data-label="Observ.">${r.observaciones || '–'}</td>
        <td data-label="Acciones"><button class="btn btn-outline btn-sm" onclick="verDetalleSesion('${r.id}')">Detalle</button></td>
      </tr>
    `;
  }).join('');
}

async function verDetalleSesion(id) {
  const res = await apiFetch(`/api/sesion/${id}/detalle`);
  if (!res.ok) return;
  const { sesion } = res.data;
  const content = document.getElementById('detalleContenido');
  content.innerHTML = `
    <div style="background:var(--bg-secondary);border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="margin-top:0">${sesion.maquina}</h3>
      <p><strong>Sala:</strong> ${sesion.sala} | <strong>Operario:</strong> ${sesion.operario}</p>
      <p><strong>Fecha:</strong> ${formatFechaHora(sesion.completado_en)}</p>
      <hr style="opacity:0.1;margin:16px 0">
      <p><strong>Observaciones:</strong><br>${sesion.observaciones || 'Sin observaciones'}</p>
      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px">
        ${(sesion.fotos || []).map(f => `<img src="${f}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open('${f}')">`).join('')}
      </div>
    </div>
  `;
  abrirModal('modalDetalle');
}

async function recargarTodo() {
  await cargarDatosBase();
  renderActualSection();
}

function renderActualSection() {
  const activeSection = document.querySelector('.admin-section:not(.hidden)');
  if (!activeSection) return;
  const id = activeSection.id.replace('section-', '');
  if (id === 'maquinas') renderMaquinas();
  if (id === 'historial') cargarHistorial();
  if (id === 'operarios') renderOperarios();
  if (id === 'usuarios') renderUsuarios();
  if (id === 'qrcodes') renderQRs();
  if (id === 'galeria') renderizarGaleria();
}

async function cargarHistorial() {
  const tbody = document.getElementById('tablaHistorial');
  if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px"><span class="spinner"></span></td></tr>';
  const res = await apiFetch('/api/historial');
  if (res.ok) renderizarContenidoHistorial(res.data, tbody, document.getElementById('historialEmpty'));
}

async function apiFetch(url, options = {}) {
  const client = window.supabaseClient;
  const method = options.method || 'GET';
  const payload = options.body;
  try {
    if (url.includes('/api/all-data')) {
      const { data: salas } = await client.from('salas').select('*');
      const { data: maquinas } = await client.from('equipos').select('*, salas(nombre)');
      const { data: operarios } = await client.from('operarios').select('*');
      const { data: usuarios } = await client.from('usuarios').select('*');
      const { data: registros } = await client.from('registros').select('*').order('timestamp', { ascending: false });
      
      const hoy = new Date().toISOString().split('T')[0];
      const stats = {
        hoy: registros.filter(r => r.timestamp.startsWith(hoy) && r.tipo === 'Mantenimiento').length,
        semana: registros.filter(r => r.tipo === 'Mantenimiento').length,
        pendientes: maquinas.filter(m => m.estado_mantenimiento === 'vencido').length,
        proximos: maquinas.filter(m => m.estado_mantenimiento === 'proximo').length,
        porDia: [], // Simplificado
        porMaquina: [] // Simplificado
      };
      
      return { ok: true, data: { salas, maquinas: maquinas.map(m => ({...m, sala_nombre: m.salas?.nombre})), operarios, usuarios, historial: registros.map(r => ({...r, maquina: r.maquina_nombre, sala: r.sala_nombre, operario: r.operario_nombre, completado_en: r.timestamp})), dashboard: stats } };
    }

    if (url.includes('/api/maquina/') && url.includes('/qr')) {
      const id = url.split('/')[3];
      const currentPath = window.location.pathname;
      let newPath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1) + 'operario.html';
      const targetUrl = `${window.location.origin}${newPath}?maquinaId=${id}`;
      return { ok: true, data: { qr: `https://quickchart.io/qr?text=${encodeURIComponent(targetUrl)}&size=300&margin=2`, url: targetUrl } };
    }

    if (url.includes('/api/sesion/') && url.includes('/detalle')) {
      const id = url.split('/')[3];
      const { data: reg, error } = await client.from('registros').select('*').eq('id', id).single();
      if (error) throw error;
      return { ok: true, data: { sesion: { id: reg.id, maquina: reg.maquina_nombre, sala: reg.sala_nombre, operario: reg.operario_nombre, completado_en: reg.timestamp, observaciones: reg.notas, tipo: reg.tipo, fotos: reg.photos || [] } } };
    }

    return { ok: false, error: 'Endpoint not implemented' };
  } catch (err) {
    console.error('Error in API:', err);
    return { ok: false, error: err.message };
  }
}

function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }
function formatFechaHora(str) { if (!str) return '–'; const d = new Date(str); return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }); }
function formatFechaDia(str) { if (!str) return '–'; const [y, m, d] = str.split('-'); return `${d}/${m}`; }
function truncate(str, len) { return str && str.length > len ? str.slice(0, len) + '…' : str; }
function escapar(str) { return str.replace(/'/g, "\\'"); }

const DASHBOARD_HTML = `
  <div class="admin-layout">
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="logo">🛠️ Admin Panel</div>
      </div>
      <nav class="sidebar-nav">
        <button class="nav-btn active" onclick="showSection('general')">📊 Panel General</button>
        <button class="nav-btn" onclick="showSection('galeria')">🖼️ Galería de Fotos</button>
        <button class="nav-btn" onclick="showSection('historial')">📋 Historial</button>
        <button class="nav-btn" onclick="showSection('equipos')">🖨️ Impresoras</button>
        <button class="nav-btn" onclick="showSection('salas')">🏢 Salas</button>
      </nav>
    </aside>
    
    <main class="admin-main">
      <section id="section-general" class="admin-section">
        <div class="kpi-grid">
          <div class="kpi-card"><h3>Hoy</h3><div id="kpi-hoy" class="kpi-val">0</div></div>
          <div class="kpi-card"><h3>Semana</h3><div id="kpi-semana" class="kpi-val">0</div></div>
          <div class="kpi-card"><h3>Pendientes</h3><div id="kpi-pendientes" class="kpi-val color-vencido">0</div></div>
          <div class="kpi-card"><h3>Próximos</h3><div id="kpi-proximos" class="kpi-val color-proximo">0</div></div>
        </div>
        <div class="dashboard-grid">
          <div class="card"><h3>Actividad</h3><div id="chartDias"></div></div>
          <div class="card"><h3>Máquinas</h3><div id="chartMaquinas"></div></div>
        </div>
        <div class="card">
          <h3>Últimos Mantenimientos</h3>
          <table class="admin-table">
            <thead><tr><th>Máquina</th><th>Sala</th><th>Operario</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody id="dashboardUltimos"></tbody>
          </table>
        </div>
      </section>

      <section id="section-galeria" class="admin-section hidden">
        <div class="section-header"><h2>Galería de Fotos</h2><p>Imágenes recientes de los reportes</p></div>
        <div id="galeriaContent" class="photo-gallery-grid"></div>
      </section>

      <section id="section-historial" class="admin-section hidden">
        <div class="section-header"><h2>Historial de Actividad</h2></div>
        <table class="admin-table">
          <thead><tr><th>Máquina</th><th>Sala</th><th>Operario</th><th>Fecha</th><th>Notas</th><th>Acciones</th></tr></thead>
          <tbody id="tablaHistorial"></tbody>
        </table>
        <div id="historialEmpty" style="display:none;text-align:center;padding:40px">Sin datos</div>
      </section>
    </main>
  </div>

  <div id="modalDetalle" class="modal"><div class="modal-content"><div class="modal-header"><h3>Detalle de Sesión</h3><button class="close-btn" onclick="cerrarModal('modalDetalle')">×</button></div><div id="detalleContenido"></div></div></div>
  <div id="modalQR" class="modal"><div class="modal-content"><div class="modal-header"><h3>Código QR</h3><button class="close-btn" onclick="cerrarModal('modalQR')">×</button></div><div style="text-align:center;padding:20px"><h4 id="qrNombre"></h4><p id="qrSala" class="text-muted"></p><img id="qrImg" style="width:200px;border:1px solid #ddd;padding:10px;border-radius:8px"><div style="margin-top:20px"><a id="qrUrl" href="#" target="_blank" style="word-break:break-all;font-size:12px"></a></div><button class="btn btn-primary" style="margin-top:20px;width:100%" onclick="imprimirQR()">🖨️ Imprimir</button></div></div></div>
`;
