-- ==========================================
-- MIGRACIÓN v2 — Ejecutar en Supabase SQL Editor
-- ==========================================

-- 1. Añadir columnas de dimensiones a equipos
ALTER TABLE equipos 
  ADD COLUMN IF NOT EXISTS ancho_mm NUMERIC,
  ADD COLUMN IF NOT EXISTS alto_mm NUMERIC,
  ADD COLUMN IF NOT EXISTS profundidad_mm NUMERIC;

-- 2. Añadir columna auth_id para vincular con Supabase Auth
ALTER TABLE usuarios 
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Trigger: cuando alguien se registra en Supabase Auth, se crea su fila en usuarios automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.usuarios (auth_id, email, nombre, rol, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    'operario',
    true
  )
  ON CONFLICT (email) DO UPDATE SET auth_id = EXCLUDED.auth_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Eliminar trigger si ya existía (para actualizarlo limpiamente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==========================================
-- SIGUIENTE PASO (hacer a mano en Supabase):
-- 1. Ve a Authentication > Users > "Add user"
-- 2. Email: adestacion@empresa.com
-- 3. Password: HEF4hjrb|@#uwehrU2
-- 4. Marca "Auto Confirm User"
-- 5. Luego ejecuta este UPDATE para darle rol admin:
-- ==========================================
UPDATE usuarios 
SET rol = 'admin', nombre = 'adestacion'
WHERE email = 'adestacion@empresa.com';

-- Actualizar también el admin antiguo (admin@empresa.com) para que sea consistente
-- Si ya no lo necesitas, puedes borrarlo:
-- DELETE FROM usuarios WHERE email = 'admin@empresa.com';
