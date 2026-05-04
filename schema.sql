-- Drop tables if they already exist (to ensure a clean slate, careful with production data)
DROP TABLE IF EXISTS "SEGUIMIENTOS";
DROP TABLE IF EXISTS "REGISTROS";
DROP TABLE IF EXISTS "EQUIPOS";
DROP TABLE IF EXISTS "SALAS";
DROP TABLE IF EXISTS "USUARIOS";

-- Table: USUARIOS
CREATE TABLE "USUARIOS" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    pin TEXT,
    rol TEXT DEFAULT 'operario',
    activo BOOLEAN DEFAULT true
);

-- Table: SALAS
CREATE TABLE "SALAS" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL
);

-- Table: EQUIPOS
CREATE TABLE "EQUIPOS" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    nombre TEXT,
    sala_id UUID REFERENCES "SALAS"(id) ON DELETE SET NULL,
    tipo TEXT,
    modelo TEXT,
    frecuencia_dias INT DEFAULT 30,
    ultimo_mantenimiento TIMESTAMP WITH TIME ZONE,
    estado TEXT DEFAULT 'activa'
);

-- Table: REGISTROS
CREATE TABLE "REGISTROS" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maquina_id UUID REFERENCES "EQUIPOS"(id) ON DELETE CASCADE,
    operario_email TEXT REFERENCES "USUARIOS"(email) ON DELETE SET NULL,
    tipo TEXT NOT NULL, -- 'Mantenimiento' o 'Incidencia'
    notas TEXT,
    resuelta BOOLEAN DEFAULT false,
    en_seguimiento BOOLEAN DEFAULT false,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: SEGUIMIENTOS
CREATE TABLE "SEGUIMIENTOS" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incidencia_id UUID REFERENCES "REGISTROS"(id) ON DELETE CASCADE,
    usuario_nombre TEXT,
    nota TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS (Row Level Security) - Por defecto en false para simplificar pruebas iniciales
-- ALTER TABLE "USUARIOS" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "SALAS" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "EQUIPOS" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "REGISTROS" ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE "SEGUIMIENTOS" ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso para anon / authenticated (ajustar según necesidades)
-- CREATE POLICY "Permitir lectura general a anon" ON "EQUIPOS" FOR SELECT USING (true);
