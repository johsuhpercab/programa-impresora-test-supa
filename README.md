# Sistema de Gestión de Impresoras (SGI) - Documentación Técnica

## Modelo Entidad-Relación (ER)
Este modelo define la estructura de datos optimizada para la trazabilidad y el seguimiento de incidencias.

```mermaid
erDiagram
    USUARIO ||--o{ REGISTRO : "realiza (via Email)"
    USUARIO ||--o{ SEGUIMIENTO : "escribe"
    SALA ||--o{ EQUIPO : "contiene"
    EQUIPO ||--o{ REGISTRO : "tiene"
    REGISTRO ||--o{ SEGUIMIENTO : "genera"

    USUARIO {
        uuid id PK
        string email UK "Clave Única (Auto-alta)"
        string nombre
        string pin
        string rol "admin / técnico / operario"
        boolean activo
    }

    SALA {
        uuid id PK
        string nombre
    }

    EQUIPO {
        uuid id PK
        string codigo UK "ID Legible (IMP-01)"
        string nombre
        uuid sala_id FK
        string tipo
        string modelo
        int frecuencia_dias
        datetime ultimo_mantenimiento
        string estado "activa / inactiva"
    }

    REGISTRO {
        uuid id PK
        uuid maquina_id FK
        string operario_email FK "Trazabilidad"
        string tipo "Mantenimiento / Incidencia"
        text notas
        boolean resuelta
        boolean en_seguimiento
        datetime timestamp
    }

    SEGUIMIENTO {
        uuid id PK
        uuid incidencia_id FK "Relación con Registro"
        string usuario_nombre
        text nota
        datetime timestamp
    }
```

## Arquitectura de Interfaces
1. **Panel de Administración (`/dashboard.html`)**: Gestión técnica avanzada, tickets de incidencia y configuración.
2. **Interfaz de Operario (`/operario.html`)**: Acceso vía QR para reporte de mantenimiento e incidencias.
3. **Consulta Pública (`/estado.html`)**: Semáforo visual de disponibilidad para usuarios finales.

---
*Documentación actualizada automáticamente por el sistema de asistencia técnica.*
