-- Limpieza total: Borrar todas las tablas antiguas y empezar de cero
DROP TABLE IF EXISTS seguimientos CASCADE;
DROP TABLE IF EXISTS registros CASCADE;
DROP TABLE IF EXISTS equipos CASCADE;
DROP TABLE IF EXISTS salas CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS operarios CASCADE;
DROP TABLE IF EXISTS config CASCADE;

-- Table: usuarios
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    pin TEXT,
    rol TEXT DEFAULT 'operario',
    activo BOOLEAN DEFAULT true
);

-- Table: salas
CREATE TABLE salas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL
);

-- Table: equipos
CREATE TABLE equipos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT,
    sala_id UUID REFERENCES salas(id) ON DELETE SET NULL,
    tipo TEXT,
    modelo TEXT,
    frecuencia_dias INT DEFAULT 30,
    ultimo_mantenimiento TIMESTAMP WITH TIME ZONE,
    estado TEXT DEFAULT 'activa'
);

-- Table: registros
CREATE TABLE registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maquina_id UUID REFERENCES equipos(id) ON DELETE CASCADE,
    operario_email TEXT REFERENCES usuarios(email) ON DELETE SET NULL,
    tipo TEXT NOT NULL, -- 'Mantenimiento' o 'Incidencia'
    notas TEXT,
    resuelta BOOLEAN DEFAULT false,
    en_seguimiento BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: seguimientos
CREATE TABLE seguimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidencia_id UUID REFERENCES registros(id) ON DELETE CASCADE,
    usuario_nombre TEXT,
    nota TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ==========================================
-- DATOS INICIALES POR DEFECTO
-- ==========================================
-- Insertar un usuario administrador por defecto para poder entrar al panel
INSERT INTO usuarios (email, nombre, pin, rol, activo)
VALUES ('admin@empresa.com', 'Administrador Principal', '123456', 'admin', true)
ON CONFLICT (email) DO NOTHING;
