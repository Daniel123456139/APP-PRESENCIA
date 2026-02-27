---
trigger: always_on
---

0010 CALIDAD

description: Lista de verificación obligatoria antes de dar cualquier tarea por finalizada. Asegura la integridad de los datos de RRHH.
globs: ["src//*", "components//", "services/**/"]

Auditoría de Calidad y Entrega (Quality Gate)

Antes de comunicar al usuario que has terminado una tarea, ejecuta esta auditoría mental sobre tus cambios:

1. Integridad de Datos de RRHH (CRÍTICO)

Regla del ID de Empleado: Verifica que CUALQUIER componente, función o servicio que maneje datos de una persona incluya explícitamente su employeeId (o el campo ID correspondiente en la BD).

Mal: const guardarIncidencia = (datos) => ...

Bien: const guardarIncidencia = (employeeId: string, datos) => ...

Trazabilidad: ¿Queda claro quién hizo el cambio y cuándo? (Timestamps, User IDs).

2. Estabilidad del Sistema

Manejo de Errores: ¿Has envuelto las llamadas a API/Firebase en bloques try/catch?

Feedback Visual: ¿La UI muestra un estado de "Cargando..." o mensajes de error amigables si algo falla?

Conexión: ¿Qué pasa si el servidor se cae justo en este momento? (El código debe manejarlo sin colapsar la app).

3. Limpieza (Clean Code)

No dejes console.log con datos sensibles (nombres, DNI, motivos médicos).

Elimina código muerto o comentado.

Verifica que no hay errores de TypeScript (npm run type-check mental).

✅ Verificación Final

Si tu código no pasa estos puntos, corrígelo ANTES de responder al usuario.