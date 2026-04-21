/**
 * Sistema de Gestión — Componentes de la Interfaz
 * Este archivo contiene la estructura del Dashboard para inyección dinámica,
 * asegurando que el código no sea visible en el DOM inicial por seguridad.
 */

const DASHBOARD_HTML = `
  <div class="layout">
    <!-- ── Sidebar ── -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="logo">
          <div class="logo-icon">🖨️</div>
          <div>
            <h1>GestiónImpresoras</h1>
            <p>Panel de Administración</p>
          </div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Principal</div>
          <div class="nav-item active" id="nav-dashboard" onclick="navigateTo('dashboard')">
            <span class="nav-icon">📊</span>
            <span>Panel General</span>
          </div>
          <div class="nav-item" id="nav-maquinas" onclick="navigateTo('maquinas')">
            <span class="nav-icon">🖨️</span>
            <span>Máquinas</span>
            <span class="nav-badge" id="badge-alertas" style="display:none">!</span>
          </div>
          <div class="nav-item" id="nav-historial" onclick="navigateTo('historial')">
            <span class="nav-icon">📋</span>
            <span>Historial</span>
          </div>
          <div class="nav-item" id="nav-galeria" onclick="navigateTo('galeria')">
            <span class="nav-icon">🖼️</span>
            <span>Galería</span>
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-section-title">Administración</div>
          <div class="nav-item" id="nav-operarios" onclick="navigateTo('operarios')">
            <span class="nav-icon">👷</span>
            <span>Operarios</span>
          </div>
          <div class="nav-item" id="nav-qrcodes" onclick="navigateTo('qrcodes')">
            <span class="nav-icon">📱</span>
            <span>Códigos QR</span>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div style="margin-bottom:8px">v2.4 · Supabase Edition</div>
        <button class="btn btn-outline btn-sm btn-full" onclick="cerrarSesionAdmin()" style="font-size:11px;padding:6px">🚪 Cerrar Sesión</button>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>

    <!-- ── Main ── -->
    <main class="main">
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="btn btn-icon btn-outline" id="btnMenuMobile" onclick="toggleSidebar()"
            style="display:none">☰</button>
          <div>
            <div class="topbar-title" id="topbarTitle">Panel General</div>
            <div style="font-size:12px;color:var(--text-muted)" id="topbarSubtitle">Resumen del sistema</div>
          </div>
        </div>
        <div class="topbar-actions">
          <!-- Ya no necesitamos simuladores ni botones manuales, el sistema es auto-suficiente -->
        </div>
      </header>

      <div class="page-content">

        <!-- ══════════ ACCESO RESTRINGIDO ══════════ -->
        <div class="section fade-in" id="section-restringido">
          <div class="restricted-screen">
            <div class="icon">🔒</div>
            <h2>Acceso Restringido</h2>
            <p>No tienes los permisos suficientes para ver esta sección. Acceso limitado solo a Administradores.</p>
            <button class="btn btn-primary" onclick="navigateTo('dashboard')">← Volver al Panel</button>
          </div>
        </div>

        <!-- ══════════ DASHBOARD ══════════ -->
        <div class="section active fade-in" id="section-dashboard">
          <div class="kpi-grid" id="kpiGrid">
            <div class="kpi-card azul">
              <div class="kpi-icon">✅</div>
              <div class="kpi-value" id="kpi-hoy">–</div>
              <div class="kpi-label">Mantenimientos hoy</div>
            </div>
            <div class="kpi-card verde">
              <div class="kpi-icon">📅</div>
              <div class="kpi-value" id="kpi-semana">–</div>
              <div class="kpi-label">Esta semana</div>
            </div>
            <div class="kpi-card rojo">
              <div class="kpi-icon">🚨</div>
              <div class="kpi-value" id="kpi-pendientes">–</div>
              <div class="kpi-label">Máquinas vencidas</div>
            </div>
            <div class="kpi-card amarillo">
              <div class="kpi-icon">⚠️</div>
              <div class="kpi-value" id="kpi-proximos">–</div>
              <div class="kpi-label">Próximas a vencer</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">📈 Actividad últimos 30 días</div>
              <div class="chart-bar-wrap" id="chartDias"></div>
            </div>
            <div class="chart-card">
              <div class="chart-title">🖨️ Mantenimientos por máquina</div>
              <div class="chart-bar-wrap" id="chartMaquinas"></div>
            </div>
          </div>

          <div class="table-wrap">
            <div class="table-header">
              <div class="table-title">📋 Últimos mantenimientos realizados</div>
              <button class="btn btn-outline btn-sm" onclick="navigateTo('historial')">Ver todos →</button>
            </div>
            <div style="overflow-x:auto">
              <table>
                <thead>
                  <tr>
                    <th>Máquina</th>
                    <th>Sala</th>
                    <th>Operario</th>
                    <th>Fecha y hora</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody id="dashboardUltimos"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ══════════ MÁQUINAS ══════════ -->
        <div class="section fade-in" id="section-maquinas">
          <div class="section-header">
            <div>
              <div class="section-title">🖨️ Máquinas</div>
              <div class="section-subtitle">Gestión y estado de todas las máquinas</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <select class="form-control" id="filtroSalaMaquinas" onchange="filtrarMaquinas()"
                style="width:160px;padding:8px 12px;font-size:13px">
                <option value="">Todas las salas</option>
              </select>
              <button class="btn btn-primary" onclick="abrirModalNuevaMaquina()" id="btnNuevaMaquina">+ Nueva máquina</button>
            </div>
          </div>
          <div class="grid-maquinas" id="gridMaquinas"></div>
        </div>

        <!-- ══════════ HISTORIAL ══════════ -->
        <div class="section fade-in" id="section-historial">
          <div class="section-header">
            <div>
              <div class="section-title">📋 Historial de Mantenimientos</div>
              <div class="section-subtitle">Registro completo de todas las sesiones</div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="exportarCSV()">⬇️ Exportar CSV</button>
          </div>

          <div class="table-wrap">
            <div class="filtros-bar">
              <div class="filtro-item">
                <select class="form-control" id="filtroSala" onchange="cargarHistorial()">
                  <option value="">Todas las salas</option>
                </select>
              </div>
              <div class="filtro-item">
                <select class="form-control" id="filtroMaquina" onchange="cargarHistorial()">
                  <option value="">Todas las máquinas</option>
                </select>
              </div>
              <div class="filtro-item">
                <select class="form-control" id="filtroOperario" onchange="cargarHistorial()">
                  <option value="">Todos los operarios</option>
                </select>
              </div>
              <div class="filtro-item">
                <input type="date" class="form-control" id="filtroDesde" onchange="cargarHistorial()">
              </div>
              <div class="filtro-item">
                <input type="date" class="form-control" id="filtroHasta" onchange="cargarHistorial()">
              </div>
            </div>
            <div style="overflow-x:auto">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Máquina</th>
                    <th>Sala</th>
                    <th>Operario</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Observaciones</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="tablaHistorial"></tbody>
              </table>
            </div>
            <div id="historialEmpty" class="empty-state" style="display:none">
              <div class="icon">📋</div>
              <p>No se encontraron registros con esos filtros</p>
            </div>
          </div>
        </div>

        <!-- ══════════ GALERÍA ══════════ -->
        <div class="section fade-in" id="section-galeria">
          <div class="section-header">
            <div>
              <div class="section-title">🖼️ Galería de Fotos</div>
              <div class="section-subtitle">Últimas evidencias fotográficas de los reportes</div>
            </div>
          </div>
          <div id="galeriaContent" class="photo-gallery-grid">
            <!-- Se inyecta por JS -->
          </div>
        </div>

        <!-- ══════════ OPERARIOS ══════════ -->
        <div class="section fade-in" id="section-operarios">
          <div class="section-header">
            <div>
              <div class="section-title">👷 Operarios</div>
              <div class="section-subtitle">Gestión de personal de mantenimiento</div>
            </div>
            <button class="btn btn-primary" onclick="abrirModalOperario()">+ Nuevo operario</button>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>PIN</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody id="tablaOperarios"></tbody>
            </table>
            <div id="usuariosEmpty" class="empty-state" style="display:none">
              <div class="icon">👥</div>
              <p>No hay usuarios creados todavía</p>
            </div>
          </div>
        </div>

        <!-- ══════════ QR CODES ══════════ -->
        <div class="section fade-in" id="section-qrcodes">
          <div class="section-header">
            <div>
              <div class="section-title">📱 Códigos QR</div>
              <div class="section-subtitle">QR individuales para cada máquina — escanear con el móvil del operario</div>
            </div>
            <select class="form-control" id="filtroSalaQR" onchange="filtrarQRs()"
              style="width:160px;padding:8px 12px;font-size:13px">
              <option value="">Todas las salas</option>
            </select>
          </div>

          <div
            style="background:rgba(79,142,247,0.08);border:1px solid rgba(79,142,247,0.3);border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start">
            <span style="font-size:20px">ℹ️</span>
            <div>
              <div style="font-weight:600;margin-bottom:4px">Instrucciones de uso</div>
              <div style="font-size:13px;color:var(--text-secondary)">
                1. Imprime o muestra en pantalla el QR de cada máquina.<br>
                2. El operario escanea el QR con la cámara del móvil.<br>
                3. La impresora queda <strong>pre-seleccionada automáticamente</strong>.<br>
                4. El operario elige el tipo (Incidencia / Mantenimiento), describe el problema y puede añadir fotos.<br>
                5. El registro queda guardado en la base de datos del sistema.
              </div>
            </div>
          </div>

          <div class="grid-maquinas" id="gridQRs"></div>
        </div>

      </div><!-- /page-content -->
    </main>
  </div><!-- /layout -->

  <!-- ── Modal: Ver QR ── -->
  <div class="overlay" id="modalQR">
    <div class="modal" style="max-width:360px;text-align:center">
      <div class="modal-header">
        <div class="modal-title">Código QR</div>
        <button class="modal-close" onclick="cerrarModal('modalQR')">✕</button>
      </div>
      <div class="qr-container">
        <div class="qr-maquina-nombre" id="qrNombre"></div>
        <div class="qr-maquina-sala" id="qrSala"></div>
        <img id="qrImg" src="" alt="QR Code">
        <a class="qr-url" id="qrUrl" target="_blank" style="color:var(--accent);text-decoration:underline;word-break:break-all;display:block;margin-top:10px"></a>
      </div>
      <div class="modal-footer" style="justify-content:center">
        <button class="btn btn-primary" onclick="imprimirQR()">🖨️ Imprimir QR</button>
        <button class="btn btn-outline" onclick="cerrarModal('modalQR')">Cerrar</button>
      </div>
    </div>
  </div>

  <!-- ── Modal: Editar Máquina ── -->
  <div class="overlay" id="modalMaquina">
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">Editar Máquina</div>
        <button class="modal-close" onclick="cerrarModal('modalMaquina')">✕</button>
      </div>
      <input type="hidden" id="editMaquinaId">
      <div class="form-group">
        <label class="form-label">Nombre</label>
        <input class="form-control" id="editNombre" type="text">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-control" id="editTipo">
            <option>Impresora FDM</option>
            <option>Impresora Resina</option>
            <option>CNC / Fresadora</option>
            <option>Cortadora Láser</option>
            <option>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Frecuencia (días)</label>
          <input class="form-control" id="editFrecuencia" type="number" min="1" max="365">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Modelo</label>
        <input class="form-control" id="editModelo" type="text">
      </div>
      <div class="form-group">
        <label class="form-label">Estado</label>
        <select class="form-control" id="editEstado">
          <option value="activa">Activa</option>
          <option value="inactiva">Inactiva / En reparación</option>
        </select>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="cerrarModal('modalMaquina')">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarMaquina()">Guardar cambios</button>
      </div>
    </div>
  </div>

  <!-- ── Modal: Nuevo Operario ── -->
  <div class="overlay" id="modalOperario">
    <div class="modal" style="max-width:400px">
      <div class="modal-header">
        <div class="modal-title">Gestión de Personal (Operarios)</div>
        <button class="modal-close" onclick="cerrarModal('modalOperario')">✕</button>
      </div>
      <div id="msgOperario"></div>
      <div class="form-group">
        <label class="form-label">Nombre completo</label>
        <input class="form-control" id="nuevoNombre" type="text" placeholder="Ej: Carlos García">
      </div>
      <div class="form-group">
        <label class="form-label">PIN (4-6 dígitos)</label>
        <input class="form-control" id="nuevoPin" type="text" maxlength="6" placeholder="Ej: 1234">
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="cerrarModal('modalOperario')">Cancelar</button>
        <button class="btn btn-primary" onclick="crearOperario()">Crear operario</button>
      </div>
    </div>
  </div>

  <!-- ── Modal: Crear Máquina ── -->
  <div class="overlay" id="modalNuevaMaquina">
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div class="modal-title">Nueva Máquina</div>
        <button class="modal-close" onclick="cerrarModal('modalNuevaMaquina')">✕</button>
      </div>
      <div id="msgNuevaMaquina"></div>
      <div class="form-group">
        <label class="form-label">Nombre <span style="color:var(--danger)">*</span></label>
        <input class="form-control" id="nuevoMaquinaNombre" type="text" placeholder="Ej: Impresora A-11">
      </div>
      <div class="form-group">
        <label class="form-label">Sala <span style="color:var(--danger)">*</span></label>
        <select class="form-control" id="nuevoMaquinaSala"></select>
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select class="form-control" id="nuevoMaquinaTipo">
            <option>Impresora FDM</option>
            <option>Impresora Resina</option>
            <option>CNC / Fresadora</option>
            <option>Cortadora Láser</option>
            <option>Otro</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Frecuencia (días)</label>
          <input class="form-control" id="nuevoMaquinaFrecuencia" type="number" min="1" max="365" value="7">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Modelo</label>
        <input class="form-control" id="nuevoMaquinaModelo" type="text" placeholder="Ej: Prusa MK4">
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="cerrarModal('modalNuevaMaquina')">Cancelar</button>
        <button class="btn btn-primary" onclick="crearMaquina()">Crear máquina</button>
      </div>
    </div>
  </div>

  <!-- ── Modal: Detalle sesión ── -->
  <div class="overlay" id="modalDetalle">
    <div class="modal" style="max-width:560px">
      <div class="modal-header">
        <div class="modal-title">Detalle del Mantenimiento</div>
        <button class="modal-close" onclick="cerrarModal('modalDetalle')">✕</button>
      </div>
      <div id="detalleContenido"></div>
    </div>
  </div>

  <!-- ── Modal: Historial Máquina ── -->
  <div class="overlay" id="modalHistorialMaquina">
    <div class="modal" style="max-width:800px; width: 95%">
      <div class="modal-header">
        <div>
          <div class="modal-title" id="historialMaquinaTitulo">Historial de Máquina</div>
          <div style="font-size:12px;color:var(--text-muted)" id="historialMaquinaSub">Cargando...</div>
        </div>
        <button class="modal-close" onclick="cerrarModal('modalHistorialMaquina')">✕</button>
      </div>
      <div class="table-wrap" style="max-height:60vh; overflow-y:auto">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Operario</th>
              <th>Tipo</th>
              <th>Nota</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tablaHistorialMaquina"></tbody>
        </table>
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="cerrarModal('modalHistorialMaquina')">Cerrar</button>
      </div>
    </div>
  </div>
`;
