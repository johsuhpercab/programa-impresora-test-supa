-- Creamos primero las dos salas (Sala A y Sala B) forzando sus UUIDs 
-- para poder vincularlas fácilmente a las impresoras más abajo.
INSERT INTO salas (id, nombre) VALUES 
('11111111-1111-1111-1111-111111111111', 'Sala A'),
('22222222-2222-2222-2222-222222222222', 'Sala B')
ON CONFLICT (id) DO NOTHING;

-- Inyectamos todas las impresoras del Excel, vinculándolas a sus respectivas salas
INSERT INTO equipos (codigo, nombre, sala_id, tipo, modelo, estado, frecuencia_dias, ultimo_mantenimiento) VALUES
('IMP-A-01', 'Impresora A-01', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, '2026-04-20T11:29:48.396Z'),
('IMP-A-02', 'Impresora A-02', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-03', 'Impresora A-03', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-04', 'Impresora A-04', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-05', 'Impresora A-05', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-06', 'Impresora A-06', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-07', 'Impresora A-07', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-08', 'Impresora A-08', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-09', 'Impresora A-09', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'inactiva', 7, NULL),
('IMP-A-10', 'Impresora A-10', '11111111-1111-1111-1111-111111111111', 'Impresora FDM', 'Prusa MK4', 'inactiva', 7, NULL),

('IMP-B-01', 'Impresora B-01', '22222222-2222-2222-2222-222222222222', 'Impresora FDM', 'Bambu Lab X1', 'activa', 7, NULL),
('IMP-B-02', 'Impresora B-02', '22222222-2222-2222-2222-222222222222', 'Impresora FDM', 'Bambu Lab X1', 'activa', 7, NULL),
('IMP-B-03', 'Impresora B-03', '22222222-2222-2222-2222-222222222222', 'Impresora FDM', 'Bambu Lab X1', 'activa', 7, NULL),
('IMP-B-04', 'Impresora B-04', '22222222-2222-2222-2222-222222222222', 'Impresora FDM', 'Bambu Lab X1', 'inactiva', 7, NULL)
ON CONFLICT (codigo) DO NOTHING;
