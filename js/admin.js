'use strict';

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
    if (grid) grid.innerHTML = 'Cargando máquinas...';
    
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

  const selects = ['filtroSalaMaquinas', 'filtroSala', 'filtroSalaQR', 'nuevoMaquinaSala'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = id.includes('nuevo') ? '<option value="">Seleccione una sala...</option>' : '<option value="">Todas las salas</option>';
    datosSalas.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.nombre;
      el.appendChild(opt);
    });
  });
}

function showSection(id) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const target = document.getElementById('section-' + id);
  if (target) {
    target.classList.remove('hidden');
    const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => 
      b.getAttribute('onclick') && b.getAttribute('onclick').includes(id)
    );
    if (btn) btn.classList.add('active');
  }

  if (id === 'galeria') renderizarGaleria();
  if (id === 'historial') cargarHistorial();
  if (id === 'maquinas') renderMaquinas();
  
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
  document.getElementById('kpi-hoy').textContent = d.hoy || 0;
  document.getElementById('kpi-semana').textContent = d.semana || 0;
  document.getElementById('kpi-pendientes').textContent = d.pendientes || 0;
  document.getElementById('kpi-proximos').textContent = d.proximos || 0;

  renderBarChart('chartDias', (d.porDia || []).slice(-14).map(r => ({ label: formatFechaDia(r.dia), value: r.total })));
  renderBarChart('chartMaquinas', (d.porMaquina || []).map(r => ({ label: r.nombre, value: r.total_sesiones })).slice(0, 12));
  if (historial) renderUltimosMantenimientos(historial.slice(0, 8));
}

function renderBarChart(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container || !items.length) {
    if (container) container.innerHTML = '<p class="text-muted">Sin datos</p>';
    return;
  }
  const max = Math.max(...items.map(i => i.value), 1);
  container.innerHTML = items.map(i => `
    <div class="chart-bar-row">
      <div class="chart-bar-label">${truncate(i.label, 12)}</div>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${(i.value / max * 100).toFixed(1)}%"></div></div>
      <div class="chart-bar-val">${i.value}</div>
    </div>
  `).join('');
}

function renderUltimosMantenimientos(registros) {
  const tbody = document.getElementById('dashboardUltimos');
  if (!tbody || !registros.length) return;
  tbody.innerHTML = registros.map(r => `
    <tr onclick="verDetalleSesion('${r.id}')" style="cursor:pointer">
      <td>${r.tipo === 'Incidencia' ? '🚨' : '🛠️'} ${r.maquina}</td>
      <td>${r.sala}</td>
      <td>${r.operario}</td>
      <td>${formatFechaHora(r.completado_en)}</td>
      <td><button class="btn btn-outline btn-sm">Detalle</button></td>
    </tr>
  `).join('');
}

function renderMaquinas() {
  const grid = document.getElementById('gridMaquinas');
  if (!grid) return;
  grid.innerHTML = datosMaquinas.map(m => `
    <div class="maquina-card">
      <div class="maquina-nombre">${m.nombre}</div>
      <div class="maquina-info">${m.sala_nombre} · ${m.tipo}</div>
      <div class="maquina-actions">
        <button class="btn btn-primary btn-sm" onclick="verQR('${m.id}', '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">QR</button>
      </div>
    </div>
  `).join('');
}

async function verQR(id, nombre, sala) {
  document.getElementById('qrNombre').textContent = nombre;
  document.getElementById('qrSala').textContent = sala;
  abrirModal('modalQR');
  const res = await apiFetch(`/api/maquina/${id}/qr`);
  if (res.ok) {
    document.getElementById('qrImg').src = res.data.qr;
    document.getElementById('qrUrl').textContent = res.data.url;
    document.getElementById('qrUrl').href = res.data.url;
  }
}

async function verDetalleSesion(id) {
  const res = await apiFetch(`/api/sesion/${id}/detalle`);
  if (!res.ok) return;
  const { sesion } = res.data;
  const content = document.getElementById('detalleContenido');
  content.innerHTML = `
    <div style="padding:16px;">
      <h3>${sesion.maquina}</h3>
      <p><strong>Observaciones:</strong><br>${sesion.observaciones || 'Sin observaciones'}</p>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px">
        ${(sesion.fotos || []).map(f => `<img src="${f}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;cursor:pointer" onclick="window.open('${f}')">`).join('')}
      </div>
    </div>
  `;
  abrirModal('modalDetalle');
}

function renderActualSection() {
  const activeBtn = document.querySelector('.nav-btn.active');
  if (activeBtn) {
    const id = activeBtn.getAttribute('onclick').match(/'([^']+)'/)[1];
    showSection(id);
  }
}

async function recargarTodo() {
  await cargarDatosBase();
}

async function cargarHistorial() {
  const tbody = document.getElementById('tablaHistorial');
  if (!tbody) return;
  tbody.innerHTML = datosHistorial.map(r => `
    <tr onclick="verDetalleSesion('${r.id}')" style="cursor:pointer">
      <td><strong>${r.tipo === 'Incidencia' ? '🚨' : '🛠️'} ${r.maquina}</strong></td>
      <td>${r.sala}</td>
      <td>${r.operario}</td>
      <td>${formatFechaHora(r.completado_en)}</td>
      <td>${truncate(r.observaciones || '–', 20)}</td>
      <td><button class="btn btn-outline btn-sm">Detalle</button></td>
    </tr>
  `).join('');
}

async function apiFetch(url, options = {}) {
  const client = window.supabaseClient;
  const method = options.method || 'GET';
  try {
    if (url.includes('/api/all-data')) {
      const { data: salas } = await client.from('salas').select('*');
      const { data: maquinas } = await client.from('equipos').select('*, salas(nombre)');
      const { data: registros } = await client.from('registros').select('*').order('timestamp', { ascending: false });
      return { ok: true, data: { salas, maquinas: maquinas.map(m => ({...m, sala_nombre: m.salas?.nombre})), historial: registros.map(r => ({...r, maquina: r.maquina_nombre, sala: r.sala_nombre, operario: r.operario_nombre, completado_en: r.timestamp})), dashboard: { hoy: 0, semana: 0, pendientes: 0, proximos: 0 } } };
    }
    if (url.includes('/api/maquina/') && url.includes('/qr')) {
      const id = url.split('/')[3];
      const targetUrl = `${window.location.origin}${window.location.pathname.replace('dashboard.html', 'operario.html')}?maquinaId=${id}`;
      return { ok: true, data: { qr: `https://quickchart.io/qr?text=${encodeURIComponent(targetUrl)}&size=300`, url: targetUrl } };
    }
    if (url.includes('/api/sesion/') && url.includes('/detalle')) {
      const id = url.split('/')[3];
      const { data: reg, error } = await client.from('registros').select('*').eq('id', id).single();
      return { ok: true, data: { sesion: { id: reg.id, maquina: reg.maquina_nombre, sala: reg.sala_nombre, operario: reg.operario_nombre, completado_en: reg.timestamp, observaciones: reg.notas, fotos: reg.photos || [] } } };
    }
    return { ok: false };
  } catch (err) { return { ok: false, error: err.message }; }
}

async function intentarLogin() {
  const pin = document.getElementById('adminPinInput').value;
  if(pin === '1234') { // PIN de ejemplo, cámbialo por tu lógica real
    localStorage.setItem('admin_pin', pin);
    location.reload();
  } else {
    alert('PIN incorrecto');
  }
}

function abrirModal(id) { document.getElementById(id).classList.add('open'); }
function cerrarModal(id) { document.getElementById(id).classList.remove('open'); }
function formatFechaHora(str) { if (!str) return '–'; const d = new Date(str); return d.toLocaleString('es-ES'); }
function formatFechaDia(str) { return str; }
function truncate(str, len) { return str && str.length > len ? str.slice(0, len) + '…' : str; }
function escapar(str) { return str ? str.replace(/'/g, "\\'") : ''; }

const DASHBOARD_HTML = `
  <div class="admin-layout">
    <aside class="sidebar" id="sidebar">
      <nav class="sidebar-nav">
        <button class="nav-btn active" onclick="showSection('general')">📊 Panel General</button>
        <button class="nav-btn" onclick="showSection('galeria')">🖼️ Galería</button>
        <button class="nav-btn" onclick="showSection('historial')">📋 Historial</button>
        <button class="nav-btn" onclick="showSection('maquinas')">🖨️ Impresoras</button>
      </nav>
    </aside>
    <main class="admin-main">
      <section id="section-general" class="admin-section">
        <div class="kpi-grid">
          <div class="kpi-card">Hoy: <span id="kpi-hoy">0</span></div>
          <div class="kpi-card">Semana: <span id="kpi-semana">0</span></div>
          <div class="kpi-card">Pendientes: <span id="kpi-pendientes">0</span></div>
          <div class="kpi-card">Próximos: <span id="kpi-proximos">0</span></div>
        </div>
        <div class="dashboard-grid">
          <div class="card"><h3>Actividad</h3><div id="chartDias"></div></div>
          <div class="card"><h3>Máquinas</h3><div id="chartMaquinas"></div></div>
        </div>
        <div class="card">
          <h3>Últimos Reportes</h3>
          <table class="admin-table">
            <tbody id="dashboardUltimos"></tbody>
          </table>
        </div>
      </section>
      <section id="section-galeria" class="admin-section hidden">
        <div id="galeriaContent" class="photo-gallery-grid"></div>
      </section>
      <section id="section-historial" class="admin-section hidden">
        <table class="admin-table"><tbody id="tablaHistorial"></tbody></table>
      </section>
      <section id="section-maquinas" class="admin-section hidden">
        <div id="gridMaquinas" class="grid-maquinas-inner"></div>
      </section>
    </main>
  </div>
  <div id="modalDetalle" class="modal"><div class="modal-content"><div id="detalleContenido"></div><button onclick="cerrarModal('modalDetalle')">Cerrar</button></div></div>
  <div id="modalQR" class="modal"><div class="modal-content"><h3 id="qrNombre"></h3><img id="qrImg" style="width:200px"><p id="qrUrl"></p><button onclick="cerrarModal('modalQR')">Cerrar</button></div></div>
`;
