# Analisis exhaustivo de interconexion (PRESENCIA, TALENTO, GESTION TRABAJOS)

Fecha: 2026-02-20

## 1) Alcance revisado

- `C:\-- APLICACIONES DANI --\APP -- PRESENCIA`
- `C:\-- APLICACIONES DANI --\APP -- TALENTO`
- `C:\-- APLICACIONES DANI --\APP -- GESTION TRABAJOS`

Se reviso:
- uso de Firestore en `src/` y `scripts/`;
- reglas de seguridad (`firestore.rules`) de las 3 apps;
- estado real de colecciones en la base compartida;
- brechas de compatibilidad entre arquitectura deseada y codigo real actual.

## 2) Resultado funcional real por aplicacion

### APP PRESENCIA

Usa de forma activa:
- `USUARIOS`, `EMPLEADOS_REF/EMPLEADOS`, `COMPETENCIAS`, `NOTAS`
- `SICK_LEAVES`, `BAJAS`, `INCIDENT_LOG`, `BAJAS_METADATA`
- `APP_GENERATED_PUNCHES`, `EMPLOYEE_ACCESS_LOG`
- `CONFIGURACION`

### APP GESTION TRABAJOS

Actualmente comparte el mismo esquema operativo que PRESENCIA para autenticacion/perfiles y datos RRHH:
- `USUARIOS`, `EMPLEADOS_REF/EMPLEADOS`, `COMPETENCIAS`, `NOTAS`
- `SICK_LEAVES`, `BAJAS`, `INCIDENT_LOG`, `APP_GENERATED_PUNCHES`, `EMPLOYEE_ACCESS_LOG`

Nota importante:
- Aunque existe la coleccion `TRABAJOS`, el codigo actual de la app no la explota como fuente principal Firestore (la trazabilidad de trabajo va muy apoyada en ERP/API).

### APP TALENTO

Usa activamente:
- `USUARIOS`, `EMPLEADOS`, `COMPETENCIAS`, `NOTAS`
- `SKILLS`, `COMPETENCY_DEFINITIONS` (compatibilidad legacy aun en uso)
- `CERTIFICACIONES`, `HISTORIAL_EVALUACIONES`
- `FORMACIONES`, `PLANES_FORMATIVOS_ANUALES`
- `FORMACION_JUSTIFICACIONES`, `HOMOLOGACIONES_TECNICAS`

## 3) Colecciones necesarias vs no necesarias (estado actual)

Tras auditoria y ajustes, todas las colecciones necesarias para las 3 apps quedaron en estado operativo:

- `USUARIOS`
- `CONFIGURACION`
- `EMPLEADOS`
- `EMPLEADOS_REF`
- `COMPETENCIAS`
- `NOTAS`
- `SKILLS`
- `COMPETENCY_DEFINITIONS`
- `COMPETENCIAS_DEF`
- `CERTIFICACIONES`
- `HISTORIAL_EVALUACIONES`
- `FORMACIONES`
- `PLANES_FORMATIVOS_ANUALES`
- `FORMACION_JUSTIFICACIONES`
- `HOMOLOGACIONES_TECNICAS`
- `SICK_LEAVES`
- `BAJAS`
- `BAJAS_METADATA`
- `INCIDENT_LOG`
- `APP_GENERATED_PUNCHES`
- `EMPLOYEE_ACCESS_LOG`
- `TRABAJOS`

Colecciones no referenciadas por codigo actual tras el ajuste:
- Ninguna (0)

## 4) Incidencias detectadas y resueltas

1. Se habian eliminado `SKILLS` y `COMPETENCY_DEFINITIONS`, pero TALENTO las sigue usando.
   - Accion: restauradas desde backup JSON.

2. Habia colecciones requeridas por codigo que no existian al no tener documentos.
   - Accion: inicializadas con documento `_meta` en espanol para evitar huecos de esquema.

3. No existia estructura de subcolecciones por empleado para interconexion limpia entre apps.
   - Accion: creada estructura base por empleado.

## 5) Subcolecciones creadas (por cada empleado)

Bajo `EMPLEADOS/{employeeId}/` se creo:

- `talento_competencias`
- `talento_notas`
- `talento_certificaciones`
- `talento_formaciones`
- `talento_historial_evaluaciones`
- `presencia_bajas_activas`
- `presencia_bajas_historico`
- `presencia_incidencias`
- `presencia_fichajes_app`
- `trabajos_partes`

Cada subcoleccion tiene documento `_meta` con descripcion en espanol.

## 6) Scripts creados para gobernanza continua

- `scripts/auditar-interconexion-firestore.cjs`
- `scripts/restaurar-colecciones-backup.cjs`
- `scripts/inicializar-colecciones-requeridas.cjs`
- `scripts/crear-subcolecciones-interapps.cjs`

Y comandos npm:

- `npm run firestore:auditar-interconexion`
- `npm run firestore:restaurar-backup`
- `npm run firestore:inicializar-colecciones`
- `npm run firestore:crear-subcolecciones`

## 7) Criterio de interconexion recomendado

- Mantener top-level legacy para no romper apps actuales.
- Usar subcolecciones nuevas por empleado como capa de convergencia entre apps.
- Migrar gradualmente lectura/escritura de cada app a subcolecciones, con doble escritura temporal.
- Cuando las 3 apps terminen migracion, desactivar legacy de forma controlada.
