# 🛠️ Sistema de Gestión de Impresoras 3D (Supabase Edition)

Este es un sistema moderno de gestión para el mantenimiento preventivo e incidencias de impresoras 3D, diseñado para operar de forma rápida, visual y eficiente.

## 🚀 Características Principales

- **Gestión Multi-Sala**: Organización de máquinas por espacios físicos.
- **Reporte de Incidencias**: Interfaz simplificada para que cualquier usuario reporte fallos con fotos opcionales.
- **Mantenimiento Preventivo**: Checklist especializado para operarios con seguimiento de fechas de vencimiento.
- **Panel de Administración**: 
  - Gráficos de actividad en tiempo real.
  - Historial detallado con fotografías.
  - Generador de códigos QR dinámicos para cada máquina.
  - Gestión de operarios y usuarios vinculados a salas.
- **Infraestructura Moderna**: Migrado de Google Sheets a **Supabase (PostgreSQL)** para mayor velocidad y robustez.

## 📁 Estructura del Proyecto

- `index.html`: Portal público para reportar incidencias.
- `dashboard.html`: Panel administrativo centralizado.
- `operario.html`: Interfaz móvil para escaneo de QR y checklists.
- `js/`: Lógica principal del sistema.
  - `supabase-config.js`: Conexión al backend.
  - `admin.js`: Inteligencia del panel de control.
- `css/`: Estilos modernos con variables y modo oscuro.

## 🛠️ Configuración (Backend)

El sistema utiliza **Supabase** para datos y fotos.

### 1. Base de Datos
Asegúrate de que las tablas `salas`, `equipos`, `operarios`, `usuarios` y `registros` estén creadas correctamente.

### 2. Almacenamiento (Storage)
Crea un "Bucket" público llamado `photos` y aplica las siguientes políticas RLS:
```sql
-- Permitir lectura pública
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'photos');
-- Permitir subida anónima (o restringida)
CREATE POLICY "Allow Uploads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos');
```

## 🌐 Despliegue

Este repositorio está configurado con **GitHub Actions** para desplegarse automáticamente en GitHub Pages cada vez que haces un `push` a la rama `main`.

---
*Desarrollado para la gestión eficiente del taller Maker.*
