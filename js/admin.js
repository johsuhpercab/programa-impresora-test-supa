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
    
    await cargarDatosBase();
    
    // Auto-sincronización cada 2 minutos
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

  // Poblar selects de salas
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
}

function showSection(id) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  const target = document.getElementById('section-' + id);
  if (target) {
    target.classList.remove('hidden');
    const btn = Array.from(document.querySelectorAll('.nav-btn')).find(b => 
       b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${id}'`)
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
  const ids = { 'kpi-hoy': d.hoy, 'kpi-semana': d.semana, 'kpi-pendientes': d.pendientes, 'kpi-proximos': d.proximos };
  for (const [id, val] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || 0;
  }

  renderBarChart('chartDias', (d.porDia || []).slice(-14).map(r => ({ label: formatFechaDia(r.dia), value: r.total })));
  renderBarChart('chartMaquinas', (d.porMaquina || []).map(r => ({ label: r.nombre, value: r.total_sesiones })).slice(0, 12));
  if (historial) renderUltimosMantenimientos(historial.slice(0, 8));
}

function renderBarChart(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container || !items.length) {
    if (container) container.innerHTML = '<div class="empty-state" style="padding:24px"><p>Sin datos aún</p></div>';
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
        <td><span style="${rowStyle}">${icon} ${r.maquina}</span></td>
        <td class="text-muted">${r.sala}</td>
        <td>${r.operario}</td>
        <td>${formatFechaHora(r.completado_en)}</td>
        <td><button class="btn btn-outline btn-sm">Detalle</button></td>
      </tr>
    `;
  }).join('');
}

function renderMaquinas() {
  const grid = document.getElementById('gridMaquinas');
  if (!grid) return;
  
  grid.innerHTML = datosMaquinas.map(m => `
    <div class="maquina-card fade-in">
      <div class="maquina-header">
        <div>
          <div class="maquina-nombre">${m.nombre}</div>
          <div class="maquina-tipo">${m.tipo}</div>
        </div>
        <span class="estado-badge ${m.estado_mantenimiento}">${m.estado_mantenimiento}</span>
      </div>
      <div class="maquina-info">
        <span>🏢 ${m.sala_nombre}</span>
        <span>🕐 Último: ${m.ultimo_mantenimiento ? formatFechaHora(m.ultimo_mantenimiento) : 'Nunca'}</span>
      </div>
      <div class="maquina-actions">
        <button class="btn btn-primary btn-sm" onclick="verQR('${m.id}', '${escapar(m.nombre)}', '${escapar(m.sala_nombre)}')">📱 QR</button>
        <button class="btn btn-outline btn-sm" onclick="editarMaquina('${m.id}')">✏️ Editar</button>
      </div>
    </div>
  `).join('');
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
    const linkEmail = document.getElementById('qrUrl');
    linkEmail.textContent = res.data.url;
    linkEmail.href = res.data.url;
  }
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

function renderActualSection() {
  const activeBtn = document.querySelector('.nav-btn.active');
  if (activeBtn) {
    const id = activeBtn.getAttribute('onclick').match(/'([^']+)'/)[1];
    showSection(id);
  } else {
    showSection('general');
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
      <td>${truncate(r.observaciones || '–', 30)}</td>
      <td><button class="btn btn-outline btn-sm">Detalle</button></td>
    </tr>
  `).join('');
}

async function apiFetch(url, options = {}) {
  const client = window.supabaseClient;
  const method = options.method || 'GET';
  const payload = options.body;
  try {
    if (url.includes('/api/all-data')) {
      const { data: salas } = await client.from('salas').select('*');
      const { data: maquinas } = await client.from('equipos').select('*, salas(nombre)');
      const { data: registros } = await client.from('registros').select('*').order('timestamp', { ascending: false });
      
      const hoy = new Date().toISOString().split('T')[0];
      const stats = {
        hoy: registros.filter(r => r.timestamp.startsWith(hoy) && r.tipo === 'Mantenimiento').length,
        semana: registros.filter(r => r.tipo === 'Mantenimiento').length,
        pendientes: maquinas.filter(m => m.estado_mantenimiento === 'vencido').length,
        proximos: maquinas.filter(m => m.estado_mantenimiento === 'proximo').length,
        porDia: [], 
        porMaquina: [] 
      };
      
      return { ok: true, data: { salas, maquinas: maquinas.map(m => ({...m, sala_nombre: m.salas?.nombre})), historial: registros.map(r => ({...r, maquina: r.maquina_nombre, sala: r.sala_nombre, operario: r.operario_nombre, completado_en: r.timestamp})), dashboard: stats } };
    }

    if (url.includes('/api/login-admin')) {
      const { data, error } = await client.from('config').select('value').eq('key', 'admin_pin').single();
      if (error) throw error;
      if (data.value === payload.pin) return { ok: true };
      return { ok: false, error: 'PIN incorrecto' };
    }

    if (url.includes('/api/maquina/') && url.includes('/qr')) {
      const id = url.split('/')[3];
      const targetUrl = `${window.location.origin}${window.location.pathname.replace('dashboard.html', 'operario.html')}?maquinaId=${id}`;
      return { ok: true, data: { qr: `https://quickchart.io/qr?text=${encodeURIComponent(targetUrl)}&size=300`, url: targetUrl } };
    }

    if (url.includes('/api/sesion/') && url.includes('/detalle')) {
      const id = url.split('/')[3];
      const { data: reg, error } = await client.from('registros').select('*').eq('id', id).single();
      if (error) throw error;
      return { ok: true, data: { sesion: { id: reg.id, maquina: reg.maquina_nombre, sala: reg.sala_nombre, operario: reg.operario_nombre, completado_en: reg.timestamp, observaciones: reg.notas, fotos: reg.photos || [] } } };
    }

    return { ok: false, error: 'Endpoint no implementado' };
  } catch (err) {
    console.error('Error en API:', err);
    return { ok: false, error: err.message };
  }
}

async function intentarLogin() {
  const input = document.getElementById('adminPinInput');
  const error = document.getElementById('loginError');
  const pin = input.value.trim();
  if (!pin) return;

  error.innerHTML = 'Verificando...';
  const res = await apiFetch('/api/login-admin', { method: 'POST', body: { pin } });
  
  if (res.ok) {
    localStorage.setItem('admin_pin', pin);
    location.reload();
  } else {
    error.innerHTML = '❌ PIN incorrecto';
    input.value = '';
    input.focus();
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
      <div class="sidebar-header">
        <div class="logo">🛠️ Admin Panel</div>
      </div>
      <nav class="sidebar-nav">
        <button class="nav-btn active" onclick="showSection('general')">📊 Panel General</button>
        <button class="nav-btn" onclick="showSection('galeria')">🖼️ Galería</button>
        <button class="nav-btn" onclick="showSection('historial')">📋 Historial</button>
        <button class="nav-btn" onclick="showSection('maquinas')">🖨️ Impresoras</button>
      </nav>
    </aside>
    
    <main class="admin-main">
      <header class="admin-header">
        <h1 id="sectionTitle">Dashboard</h1>
      </header>

      <section id="section-general" class="admin-section">
        <div class="kpi-grid">
          <div class="kpi-card"><h3>Hoy</h3><div id="kpi-hoy" class="kpi-val">0</div></div>
          <div class="kpi-card"><h3>Semana</h3><div id="kpi-semana" class="kpi-val">0</div></div>
          <div class="kpi-card"><h3>Pendientes</h3><div id="kpi-pendientes" class="kpi-val color-vencido">0</div></div>
          <div class="kpi-card"><h3>Próximos</h3><div id="kpi-proximos" class="kpi-val color-proximo">0</div></div>
        </div>
        <div class="dashboard-grid">
          <div class="card"><h3>Actividad Diaria</h3><div id="chartDias"></div></div>
          <div class="card"><h3>Mant. por Máquina</h3><div id="chartMaquinas"></div></div>
        </div>
        <div class="card">
          <h3>Últimos Movimientos</h3>
          <table class="admin-table">
            <thead><tr><th>Máquina</th><th>Sala</th><th>Operario</th><th>Fecha</th><th>Acciones</th></tr></thead>
            <tbody id="dashboardUltimos"></tbody>
          </table>
        </div>
      </section>

      <section id="section-galeria" class="admin-section hidden">
        <div class="section-header"><h2>Galería de Fotos</h2><p>Evidencias fotográficas de los reportes</p></div>
        <div id="galeriaContent" class="photo-gallery-grid"></div>
      </section>

      <section id="section-historial" class="admin-section hidden">
        <div class="card">
          <table class="admin-table">
            <thead><tr><th>Máquina</th><th>Sala</th><th>Operario</th><th>Fecha</th><th>Notas</th><th>Acciones</th></tr></thead>
            <tbody id="tablaHistorial"></tbody>
          </table>
        </div>
      </section>

      <section id="section-maquinas" class="admin-section hidden">
        <div id="gridMaquinas" class="grid-maquinas-inner"></div>
      </section>
    </main>
  </div>

  <div id="modalDetalle" class="modal"><div class="modal-content"><div class="modal-header"><h3>Detalle</h3><button class="close-btn" onclick="cerrarModal('modalDetalle')">×</button></div><div id="detalleContenido"></div></div></div>
  <div id="modalQR" class="modal"><div class="modal-content"><div class="modal-header"><h3>Código QR</h3><button class="close-btn" onclick="cerrarModal('modalQR')">×</button></div><div style="text-align:center"><h4 id="qrNombre"></h4><img id="qrImg" style="width:200px"><br><a id="qrUrl" href="#" target="_blank"></a></div></div></div>
`;
