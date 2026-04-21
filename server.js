'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname)); // Servir archivos estáticos desde la raíz

// ── Helper: obtener IP local ────────────────────────────────────────────────
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// ── API: Info del servidor (Único endpoint necesario para QRs dinámicos) ─────
app.get('/api/info', (req, res) => {
  const ip = getLocalIP();
  res.json({ ok: true, data: { ip, puerto: PORT, url: `http://${ip}:${PORT}` } });
});

// ── Rutas amigables ─────────────────────────────────────────────────────────
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  SISTEMA DE GESTIÓN DE IMPRESORAS Y MÁQUINAS 3D  ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`\n  🖥️  Panel de administración: http://localhost:${PORT}`);
  console.log(`  📱  Nueva interfaz móvil:     http://${ip}:${PORT}/index.html`);
  console.log(`\n  Servidor simplificado (Modo Supabase) activo.`);
  console.log(`  Pulsa Ctrl+C para detener el servidor\n`);
});
