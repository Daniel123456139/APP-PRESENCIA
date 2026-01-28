# Lógica de Gestión de Trabajos (Auditoría de Producción)

Este documento detalla la lógica técnica y funcional implementada en el módulo de **Gestión de Trabajos** de la aplicación. Este módulo cruza los datos de **Presencia** (RRHH) con los datos de **Producción** (ERP) para auditar la eficiencia y detectar fugas de tiempo.

---

## 1. Fuentes de Datos

El sistema combina dos fuentes de información independientes para realizar la comparativa:

### A. Datos de Presencia (RRHH)
*   **Origen:** `useHrPortalData` -> `dataProcessor.ts`
*   **Entidad:** Fichajes de entrada/salida y marcajes de incidencias.
*   **Variable Clave:** `datasetResumen` (Array de `ProcessedDataRow`).
*   **Actualización:** Se sincroniza con el rango de fechas seleccionado en el portal global.

### B. Datos de Producción (ERP)
*   **Origen:** `erpApi.ts` -> Endpoint `/fichajes/getControlOfPorOperario`
*   **Entidad:** Imputaciones de tiempos a Órdenes de Fabricación (OF).
*   **Campos Clave:** `FechaInicio`, `HoraInicio`, `FechaFin`, `HoraFin`.
*   **Filtrado:** Se solicitan rangos de fechas específicos al iniciar el módulo.

---

## 2. Lógica de Cálculo

### 2.1 Cálculo del Tiempo de Presencia ("Jornada")
Es el tiempo total que el operario ha estado disponible para trabajar o ha justificado.
Se calcula sumando tres componentes para asegurar integridad:

$$
\text{Total Presencia} = \text{HORAS TOTALES} + \text{HORAS EXCESO} + \text{H. FESTIVAS}
$$

*   **HORAS TOTALES (RRHH):** Incluye tiempo trabajado ordinario + tiempo justificado (médico, asuntos propios, etc.) + tiempo de torno (TAJ). *Nota: Cumple la regla Total = Presencia + Justifica + TAJ.*
*   **HORAS EXCESO:** Tiempo trabajado fuera del horario asignado (ej. horas extra por la tarde).
*   **H. FESTIVAS:** Tiempo trabajado en fines de semana o festivos (que a veces no cuenta como jornada ordinaria pero sí para producción).

> **Objetivo:** Evitar falsos positivos de "fuga de tiempo" si un operario trabaja horas extra o fines de semana.

### 2.2 Cálculo del Tiempo de Producción ("Ocupación")
Es la suma de tiempo imputado a trabajos. Se analiza de dos formas:

#### A. Tiempo Bruto Producido
Suma simple de la duración de todas las órdenes de trabajo.
$$ \text{Tiempo Bruto} = \sum (\text{Fin}_i - \text{Inicio}_i) $$

#### B. Tiempo Cubierto (Cobertura Real)
Tiempo en la línea temporal que está cubierto por al menos una orden. **Elimina el efecto de la multitarea (solapamientos).**
*   **Algoritmo:**
    1.  Se normalizan todos los intervalos de trabajo.
    2.  Se ordenan por hora de inicio.
    3.  Se fusionan intervalos solapados o adyacentes.
    4.  Se suma la duración de los intervalos fusionados resultantes.

### 2.3 Métricas Derivadas

*   **Fuga de Tiempo (Gap):** Tiempo de presencia no justificado con trabajo.
    $$ \text{Gap} = \max(0, \text{Total Presencia} - \text{Tiempo Cubierto}) $$
    *   *Alerta Roja:* Si Gap > 0.05h (3 minutos).

*   **Multitarea (Overlap Ratio):** Indicador de trabajos simultáneos.
    $$ \text{Ratio} = \frac{\text{Tiempo Bruto Producido}}{\text{Tiempo Cubierto}} $$
    *   *Alerta Ambar:* Si Ratio > 1.1 (indica solapamiento significativo).

*   **Porcentaje de Ocupación:**
    $$ \text{% Ocupación} = \left( \frac{\text{Tiempo Cubierto}}{\text{Total Presencia}} \right) \times 100 $$

---

## 3. Visualización y KPIs Globales

En la cabecera del módulo se agregan los datos de la **sección seleccionada** (o todas):

1.  **Gráfico de Ocupación Global:**
    *   Suma de tiempos cubiertos de todos los operarios visibles vs Suma de presencias totales.
    *   Representado en un gráfico de tarta (Donut Chart) dinámico.

2.  **Fuga de Tiempo (Critical KPI):**
    *   Suma total de horas "perdidas" (Gaps) en el departamento.
    *   Permite a los jefes de sección ver rápidamente la magnitud de la ineficiencia.

3.  **Eficiencia Media:**
    *   Media de horas cubiertas por operario activo.

---

## 4. Sistema de Reportes (Exportación)

El módulo permite generar un PDF formal para reuniones de seguimiento:

*   **Servicio:** `jobAuditExportService.ts`
*   **Librerías:** `jspdf`, `jspdf-autotable`.
*   **Contenido del Reporte:**
    1.  **Cabecera:** Datos corporativos, fecha y rango seleccionado.
    2.  **Resumen Ejecutivo:** Replica de los KPIs visuales y gráfico de ocupación.
    3.  **Tabla de Detalle:** Listado de todos los operarios con sus métricas individuales.
    4.  **Resaltado Inteligente:** Marca en rojo automáticamente en la tabla a los operarios con ocupación < 70%.

---

## 5. Consideraciones Técnicas

*   **Sincronización:** Los filtros de Fecha Inicio/Fin se heredan del contexto global de la App (`useHrPortalData`), pero pueden modificarse localmente para auditorías específicas.
*   **Limpieza de Datos:** Se aplica un parser robusto (`parseErpDateTime`) para manejar inconsistencias en formatos de fecha del ERP (ISO vs ES, presencia de 'T', etc.).
*   **Renderizado:** Se usa `React.useMemo` intensivamente para recalcular las estadísticas globales en tiempo real sin bloquear la interfaz de usuario al filtrar por texto o departamento.
