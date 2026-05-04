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
            <h1>Gestión Impresoras</h1>
            <p>Panel de Administración</p>
          </div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
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
            <span>Mantenimientos</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-item" id="nav-incidencias" onclick="navigateTo('incidencias')">
            <span class="nav-icon">🚨</span>
            <span>Panel de Incidencias</span>
            <span class="nav-badge vencido" id="badge-incidencias" style="display:none">0</span>
          </div>
        </div>
        <div class="nav-section">
          <div class="nav-item" id="nav-qrcodes" onclick="navigateTo('qrcodes')">
            <span class="nav-icon">📱</span>
            <span>Códigos QR</span>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div style="margin-bottom:8px">v3.1 · Supabase Edition</div>
        <button class="btn btn-primary btn-sm btn-full" onclick="window.location.href='index.html'" style="margin-bottom:8px;font-size:11px;padding:6px">🏠 Volver al Inicio</button>
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
           <button class="btn btn-outline btn-sm" onclick="iniciarTour()" style="border-radius:20px; padding: 6px 16px;">
             ✨ Guía Rápida
           </button>
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
              <button class="btn btn-outline btn-sm" onclick="abrirModalNuevaSala()" title="Añadir nueva sala" style="font-size:16px; padding: 4px 10px;">+</button>
              <button class="btn btn-primary" onclick="abrirModalNuevaMaquina()" id="btnNuevaMaquina">+ Nueva máquina</button>
            </div>
          </div>
          <div class="grid-maquinas" id="gridMaquinas"></div>
        </div>

        <!-- ══════════ INCIDENCIAS ══════════ -->
        <div class="section fade-in" id="section-incidencias">
          <div class="section-header">
            <div>
              <div class="section-title">🚨 Centro de Incidencias</div>
              <div class="section-subtitle">Gestión de fallos técnicos y reparaciones</div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-outline btn-sm active" id="btn-inc-todas" onclick="renderIncidencias('todas')">Todas</button>
              <button class="btn btn-outline btn-sm" id="btn-inc-pendientes" onclick="renderIncidencias('pendientes')" style="border-color:var(--danger);color:var(--danger)">Pendientes</button>
              <button class="btn btn-outline btn-sm" id="btn-inc-resueltas" onclick="renderIncidencias('resueltas')" style="border-color:var(--success);color:var(--success)">Resueltas</button>
            </div>
          </div>

          <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-bottom: 24px;">
            <div class="kpi-card rojo" id="kpi-inc-pendientes-card">
              <div class="kpi-icon">🚨</div>
              <div class="kpi-value" id="kpi-inc-pendientes">0</div>
              <div class="kpi-label">Urgentes (Sin atender)</div>
            </div>
            <div class="kpi-card amarillo" id="kpi-inc-seguimiento-card">
              <div class="kpi-icon">📝</div>
              <div class="kpi-value" id="kpi-inc-seguimiento">0</div>
              <div class="kpi-label">En Seguimiento</div>
            </div>
            <div class="kpi-card verde" id="kpi-inc-resueltas-card">
              <div class="kpi-icon">✅</div>
              <div class="kpi-value" id="kpi-inc-resueltas">0</div>
              <div class="kpi-label">Resueltas</div>
            </div>
          </div>

          <div class="incidencias-container">
            <div id="gridTicketsIncidencias" class="tickets-grid">
              <!-- Los tickets de incidencia se inyectarán aquí -->
            </div>
            
            <div id="incidenciasEmpty" class="empty-state" style="display:none">
              <div class="icon">✨</div>
              <p>No hay incidencias activas en este momento</p>
            </div>
          </div>
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
                <input type="text" id="filtroOperario" class="form-control" placeholder="🔍 Buscar operario..." oninput="cargarHistorial()">
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



        <!-- ══════════ QR CODES ══════════ -->
        <div class="section fade-in" id="section-qrcodes">
          <div class="section-header">
            <div>
              <div class="section-title">📱 Códigos QR</div>
              <div class="section-subtitle">QR individuales para cada máquina — escanear con el móvil del operario</div>
            </div>
            <div style="display:flex; gap:12px; align-items:center">
              <select class="form-control" id="filtroSalaQR" onchange="filtrarQRs()"
                style="width:160px;padding:8px 12px;font-size:13px">
                <option value="">Todas las salas</option>
              </select>
              <button class="btn btn-primary" onclick="imprimirTodosLosQRs()">🖨️ Imprimir Todos los QRs</button>
            </div>
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
    <div class="modal card" style="max-width:340px; text-align:center">
      <div class="modal-header">
        <div class="modal-title" id="qrNombre">Máquina</div>
        <button class="btn-close" onclick="cerrarModal('modalQR')">✕</button>
      </div>
      <div style="margin-bottom:8px; color:var(--text-muted); font-size:14px" id="qrSala">Sala</div>
      <div id="qrImgContainer" style="display:flex; justify-content:center; margin:20px 0; min-height:256px"></div>
      <a id="qrUrl" class="text-accent" style="word-break:break-all; font-size:11px; margin-bottom:20px; display:block" target="_blank">URL</a>
      <button class="btn btn-primary btn-full" onclick="imprimirQR()">🖨️ Imprimir Etiqueta</button>
      <button class="btn btn-outline" onclick="cerrarModal('modalQR')">Cerrar</button>
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
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Código</label>
          <input class="form-control" id="editCodigo" type="text" placeholder="Ej: IMP-01">
        </div>
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input class="form-control" id="editNombre" type="text">
        </div>
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
          <label class="form-label">Frecuencia (días) <span class="info-icon" data-tooltip="Días recomendados entre mantenimientos preventivos.">?</span></label>
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

  <!-- ── Modal: Crear Máquina ── -->
  <div class="overlay" id="modalNuevaMaquina">
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div class="modal-title">Nueva Máquina</div>
        <button class="modal-close" onclick="cerrarModal('modalNuevaMaquina')">✕</button>
      </div>
      <div id="msgNuevaMaquina"></div>
      <div class="grid-2">
        <div class="form-group">
          <label class="form-label">Código <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="nuevoMaquinaCodigo" type="text" placeholder="Ej: IMP-01">
        </div>
        <div class="form-group">
          <label class="form-label">Nombre <span style="color:var(--danger)">*</span></label>
          <input class="form-control" id="nuevoMaquinaNombre" type="text" placeholder="Ej: Impresora A-11">
        </div>
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
          <label class="form-label">Frecuencia (días) <span class="info-icon" data-tooltip="Días recomendados entre mantenimientos preventivos.">?</span></label>
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
    <div class="modal" style="max-width:650px; width:90%">
      <div class="modal-header">
        <div class="modal-title" id="modalDetalleTitulo">Detalles del Reporte</div>
        <button class="modal-close" onclick="cerrarModal('modalDetalle')">✕</button>
      </div>
      
      <div id="detalleContenido" style="margin-bottom:24px"></div>

      <!-- Sección de Seguimiento (Solo para Incidencias) -->
      <div id="seccionSeguimiento" style="display:none; border-top:1px solid var(--border); padding-top:20px">
        <h3 style="font-size:16px; margin-bottom:16px; display:flex; align-items:center; gap:8px">
          💬 Hilo de Seguimiento Técnico
        </h3>
        
        <div id="seguimientoTimeline" class="timeline-container" style="max-height:250px; overflow-y:auto; margin-bottom:20px; padding-right:10px">
          <!-- Las notas se inyectarán aquí -->
        </div>

        <div class="add-note-box" style="background:var(--bg-card); padding:15px; border-radius:12px; border:1px solid var(--accent)">
          <label class="form-label" style="font-size:12px">Añadir nueva nota de progreso:</label>
          <textarea id="nuevaNotaSeguimiento" class="form-control" rows="2" placeholder="Describe los avances, piezas pedidas, etc..." style="margin-bottom:10px; font-size:13px"></textarea>
          <div style="display:flex; justify-content:flex-end">
            <button class="btn btn-primary btn-sm" id="btnGuardarNota" onclick="guardarNuevaNota()">
              <span>➕ Añadir Nota</span>
            </button>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="margin-top:20px">
        <button class="btn btn-outline" onclick="cerrarModal('modalDetalle')">Cerrar</button>
      </div>
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
  <!-- ── Modal: Usuarios ── -->
  <div class="overlay" id="modalUsuario">
    <div class="modal" style="max-width:460px">
      <div class="modal-header">
        <div class="modal-title" id="usuarioModalTitle">Usuario</div>
        <button class="modal-close" onclick="cerrarModal('modalUsuario')">✕</button>
      </div>
      <div id="msgUsuario"></div>
      <input type="hidden" id="usuarioId">
      <div class="form-group">
        <label class="form-label">Nombre completo</label>
        <input class="form-control" id="usuarioNombre" type="text" placeholder="Ej: Juan Pérez">
      </div>
      <div class="form-group">
        <label class="form-label">PIN de acceso (solo admin)</label>
        <input class="form-control" id="usuarioPin" type="password" maxlength="6" placeholder="******">
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="cerrarModal('modalUsuario')">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarUsuario()">Guardar usuario</button>
      </div>
    </div>
  </div>

  <!-- ── Modal: Gestionar Sala ── -->
  <div class="overlay" id="modalSala">
    <div class="modal" style="max-width:400px">
      <div class="modal-header">
        <div class="modal-title" id="tituloModalSala">Nueva Sala</div>
        <button class="modal-close" onclick="cerrarModal('modalSala')">✕</button>
      </div>
      <div id="msgSala"></div>
      <input type="hidden" id="salaIdActual">
      <div class="form-group">
        <label class="form-label">Nombre de la Sala <span style="color:var(--danger)">*</span></label>
        <input class="form-control" id="salaNombreInput" type="text" placeholder="Ej: Laboratorio 3D">
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="cerrarModal('modalSala')">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarSala()">Guardar Sala</button>
      </div>
    </div>
  </div>

  </div>
`;
