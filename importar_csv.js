const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ========== CONFIGURACIÓN ==========
// Lee la URL y la Key desde tu archivo js/supabase-config.js 
// (Asegúrate de poner los mismos valores que tienes ahí)
const SUPABASE_URL = 'https://reyrhwvhlezqujidswer.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJleXJod3ZobGV6cXVqaWRzd2VyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTEzMzIsImV4cCI6MjA5MjMyNzMzMn0.mny5WDM79wIlCD-Sdrfd1-P956VLT9V8sAi_cnX4_jk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importarCSV() {
  console.log("Iniciando importación...");

  // 1. Leer el archivo CSV
  if (!fs.existsSync('maquinas.csv')) {
    console.error("❌ Error: No se ha encontrado el archivo 'maquinas.csv' en la carpeta actual.");
    console.log("👉 Por favor, guarda tu Excel como 'maquinas.csv' en la carpeta principal del proyecto y vuelve a intentarlo.");
    return;
  }

  const csvText = fs.readFileSync('maquinas.csv', 'utf-8');
  const lineas = csvText.split('\n').map(l => l.trim()).filter(l => l);
  
  // Quitar la cabecera
  lineas.shift(); 

  // 2. Crear las dos salas por defecto para obtener sus UUIDs
  console.log("Creando salas...");
  const { data: sala1 } = await supabase.from('salas').insert({ nombre: 'Sala A' }).select().single();
  const { data: sala2 } = await supabase.from('salas').insert({ nombre: 'Sala B' }).select().single();
  
  if (!sala1 || !sala2) {
    console.error("❌ Hubo un problema creando las salas en Supabase. Verifica tu conexión.");
    return;
  }
  
  console.log(`✅ Salas creadas con éxito. UUID Sala A: ${sala1.id}, UUID Sala B: ${sala2.id}`);

  // 3. Procesar e insertar impresoras
  console.log("Procesando impresoras...");
  let agregadas = 0;

  for (const linea of lineas) {
    // CSV format: id,sala_id,nombre,tipo,modelo,estado,frecuencia_dias,ultimo_mantenimiento
    const partes = linea.split(',');
    if (partes.length < 7) continue;

    const sala_id_old = partes[1].trim();
    const nombre = partes[2].trim();
    const tipo = partes[3].trim();
    const modelo = partes[4].trim();
    const estado = partes[5].trim();
    const frecuencia_dias = parseInt(partes[6].trim()) || 7;
    let ultimo_mantenimiento = partes[7] ? partes[7].trim() : null;
    
    if (ultimo_mantenimiento === '') ultimo_mantenimiento = null;

    // Asignar el nuevo UUID de sala dependiendo del ID antiguo
    const salaUuid = (sala_id_old === '1') ? sala1.id : sala2.id;

    // Generar un código único (Ej: "Impresora A-01" -> "IMP-A-01")
    let codigo = nombre.replace('Impresora ', 'IMP-');
    if (codigo === nombre) {
      codigo = "COD-" + Math.floor(Math.random() * 10000); // Fallback por si acaso
    }

    // Insertar en Supabase
    const { error } = await supabase.from('equipos').insert({
      codigo: codigo,
      nombre: nombre,
      sala_id: salaUuid,
      tipo: tipo,
      modelo: modelo,
      estado: estado,
      frecuencia_dias: frecuencia_dias,
      ultimo_mantenimiento: ultimo_mantenimiento
    });

    if (error) {
      console.error(`⚠️ Error al insertar ${nombre}:`, error.message);
    } else {
      console.log(`✅ Añadida: ${nombre} (${codigo})`);
      agregadas++;
    }
  }

  console.log(`\n🎉 ¡Importación finalizada! Se han migrado ${agregadas} máquinas a la nueva base de datos.`);
}

importarCSV();
