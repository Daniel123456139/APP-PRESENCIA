# Fase 2 - Ejecucion real completada

Fecha: 2026-02-20

## Objetivo

Preparar la transicion a arquitectura por subcolecciones por empleado, sin romper compatibilidad legacy.

## Acciones ejecutadas

1. Restauracion de colecciones legacy necesarias para TALENTO:
   - `SKILLS`
   - `COMPETENCY_DEFINITIONS`

2. Inicializacion de colecciones requeridas ausentes (con `_meta`):
   - `EMPLEADOS_REF`, `CERTIFICACIONES`, `HISTORIAL_EVALUACIONES`, `FORMACIONES`, `PLANES_FORMATIVOS_ANUALES`,
     `FORMACION_JUSTIFICACIONES`, `HOMOLOGACIONES_TECNICAS`, `SICK_LEAVES`, `BAJAS`, `BAJAS_METADATA`.

3. Creacion de subcolecciones por empleado (118 empleados x 10 subcolecciones = 1180):
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

4. Migracion de datos top-level a subcolecciones (Fase 2):
   - Script: `scripts/fase2-migrar-subcolecciones.cjs`
   - Resultado:
     - `COMPETENCIAS`: 2875 migradas / 23 omitidas
     - `NOTAS`: 2088 migradas / 0 omitidas
     - `INCIDENT_LOG`: 58 migradas / 4 omitidas
     - `APP_GENERATED_PUNCHES`: 2 migradas / 0 omitidas
     - `SICK_LEAVES+BAJAS`: 0 migradas / 2 omitidas
     - `CERTIFICACIONES`: 0 migradas / 1 omitida
     - `FORMACIONES`: 0 migradas / 1 omitida
     - `HISTORIAL_EVALUACIONES`: 0 migradas / 1 omitida
     - `TRABAJOS`: 0 migradas / 1 omitida

## Motivo de omitidas

Las omitidas corresponden principalmente a documentos sin `employeeId/IDOperario` normalizable o con referencia de empleado no presente en `EMPLEADOS`.

## Reglas de seguridad actualizadas

Se ampliaron en `firestore.rules`:
- permisos de subcolecciones `EMPLEADOS/{id}/...`;
- compatibilidad de colecciones TALENTO (`SKILLS`, `COMPETENCY_DEFINITIONS`, `CERTIFICACIONES`, `FORMACIONES`, etc.).

## Validacion final

- Auditoria interconexion: 22/22 colecciones activas o listas.
- Faltantes: 0
- No referenciadas: 0

## Scripts fase 2 disponibles

- `npm run firestore:fase2-migrar-subcolecciones`
- `npm run firestore:fase2-validar-subcolecciones`
