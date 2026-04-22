# 📜 MEMORIA DE REGLAS - PROYECTO IMPRESORAS

Este archivo es de **LECTURA OBLIGATORIA** para la IA al inicio de cada sesión. Contiene las preferencias críticas del usuario para evitar errores de coordinación y repetición de instrucciones.

## 🚀 Flujo de Trabajo (Git)
1. **COMMIT Y PUSH AUTOMÁTICOS**: Al finalizar cada bloque de trabajo (o cada respuesta que implique cambios de código), la IA **DEBE** ejecutar `git add .`, `git commit -m "..."` y `git push` sin que el usuario lo solicite. Es una regla de oro.
2. **MENSAJES DE COMMIT**: Deben ser descriptivos y técnicos.

## 🎨 Preferencias de Interfaz (UI/UX)
1. **SIN EXTRAS NO SOLICITADOS**: No añadir elementos visuales, fechas, timestamps o textos informativos que el usuario no haya pedido explícitamente (ej: "Sincronizado a las...").
2. **IDENTIFICADORES**: Usar siempre el **Código de Máquina** (ID legible) y el **Email** del operario para trazabilidad. Nunca mostrar UUIDs largos.
3. **DISEÑO**: Mantener la estética premium (oscura, minimalista) sin recargar con datos innecesarios.

## 🧠 Arquitectura
1. **SEPARACIÓN TOTAL**: Mantener Mantenimientos e Incidencias como flujos de trabajo e interfaces completamente diferentes.
2. **TRAZABILIDAD**: Todo registro debe estar vinculado a un Email de operario/técnico.

---
*Este archivo NO debe ser modificado por la IA sin orden directa del Usuario.*
