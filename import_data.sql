-- Inyectamos todas las impresoras del Excel, vinculándolas a las salas reales que ya existen en tu Supabase:
-- 'Espacio Maker' = 69acdff5-3110-47dd-81f4-1d5d2b1eedd2
-- 'Espacio Robot' = d518331e-d3b7-43b5-b7ba-b0f939e3515c

INSERT INTO equipos (codigo, nombre, sala_id, tipo, modelo, estado, frecuencia_dias, ultimo_mantenimiento) VALUES
-- Máquinas de la Sala 1 (Espacio Maker)
('IMP-A-01', 'Impresora A-01', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, '2026-04-20T11:29:48.396Z'),
('IMP-A-02', 'Impresora A-02', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-03', 'Impresora A-03', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-04', 'Impresora A-04', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-05', 'Impresora A-05', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-06', 'Impresora A-06', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-07', 'Impresora A-07', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-08', 'Impresora A-08', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'activa', 7, NULL),
('IMP-A-09', 'Impresora A-09', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'inactiva', 7, NULL),
('IMP-A-10', 'Impresora A-10', '69acdff5-3110-47dd-81f4-1d5d2b1eedd2', 'Impresora FDM', 'Prusa MK4', 'inactiva', 7, NULL),

-- Máquinas de la Sala 2 (Espacio Robot)
('IMP-B-01', 'Impresora B-01', 'd518331e-d3b7-43b5-b7ba-b0f939e3515c', 'Impresora FDM', 'Bambu Lab X1', 'activa', 7, NULL),
('IMP-B-02', 'Impresora B-02', 'd518331e-d3b7-43b5-b7ba-b0f939e3515c', 'Impresora FDM', 'Bambu Lab X1', 'activa', 7, NULL),
('IMP-B-03', 'Impresora B-03', 'd518331e-d3b7-43b5-b7ba-b0f939e3515c', 'Impresora FDM', 'Bambu Lab X1', 'activa', 7, NULL),
('IMP-B-04', 'Impresora B-04', 'd518331e-d3b7-43b5-b7ba-b0f939e3515c', 'Impresora FDM', 'Bambu Lab X1', 'inactiva', 7, NULL)
ON CONFLICT (codigo) DO NOTHING;
