# Excel de Nominas - Generacion Actual

Este documento describe de forma exacta como la app genera el Excel de nominas en este momento.

## 1. Flujo general de exportacion

1) El usuario pulsa "Excel Nominas" y elige:
   - Mes completo (elige el mes manualmente), o
   - Periodo seleccionado (usa el rango actual de la pantalla).
2) La app obtiene fichajes para el periodo elegido (fecha inicio/fin a 00:00-23:59).
3) La app obtiene fichajes de TODO el ano natural (01/01 a 31/12 del ano del periodo).
4) Se consultan calendarios por empleado con `/fichajes/getCalendarioOperario`.
5) Se calculan las 34 columnas desde fichajes y calendario.
6) Se redondea todo a 2 decimales y se exporta a XLSX.

## 2. Fuentes de datos

- Fichajes: `/fichajes/getFichajes`
- Calendario empleado: `/fichajes/getCalendarioOperario`
- Usuarios: listado de operarios cargado en la app.

## 3. Rango del periodo y rango anual

- Periodo de calculo: el rango elegido en el export (mes completo o periodo seleccionado).
- Acumulados ("Acum.") y disponibles ("Disp."): SIEMPRE usan el ano natural completo del empleado.
  - Desde 01/01 hasta 31/12 del ano del periodo exportado.

## 4. Reconstruccion de horas trabajadas

Para cada empleado y periodo:

1) Se filtran sus fichajes del periodo.
2) Se reconstruyen intervalos de trabajo con prioridad:
   - Si el registro trae Inicio/Fin validos, se usa ese rango.
   - Si no, se emparejan Entrada/Salida reales (Hora) para crear intervalos.
3) Si un intervalo cruza medianoche, se reparte en dos dias.
4) Cada intervalo se clasifica en cubos horarios segun turno y festivo.

Esto evita el problema de filas con 0h por falta de Inicio/Fin en fichajes normales.

## 5. Festivos

Un dia es festivo si:
- El calendario del empleado indica TipoDia = 1, o
- `TipoDiaEmpresa = 1`, o
- Es fin de semana.

Si un dia es festivo:
- Todo el tiempo trabajado va a FESTIVAS.
- Horas Dia/Tarde/Noche = 0 para ese tiempo.

## 6. Turno aplicado

El turno se resuelve desde fichajes del ano:
- Prioridad: `IDTipoTurno` o `TurnoTexto` del fichaje.
- Fallback: hora de la primera entrada real.

Turnos usados:
- M (Manana): 07:00-15:00
- TN (Tarde/Noche): 15:00-23:00

## 7. Columnas y reglas de calculo

Las 34 columnas se generan segun la especificacion del documento `excel-nominas-columnas.md`.

Resumen por grupos:

### Horas trabajadas
- Horas Dia: interseccion 07:00-15:00 (turno M), menos TAJ.
- Exceso Jornada 1: 15:00-19:59 (solo turno M).
- Horas Tarde: interseccion 15:00-23:00 (turno TN), menos TAJ.
- Nocturnas: 20:00-06:00 (solo turno M fuera de turno).
- Horas Noche: interseccion 23:00-07:00 (turno TN), menos TAJ.
- Festivas: todo el tiempo en festivo o fin de semana.

### Incidencias
Se suman por MotivoAusencia con sus codigos:
- 02 Medico
- 03 Asuntos Oficiales
- 05 Vacaciones (en dias: horas/8)
- 06 Especialista/Accidente
- 07 Libre Disposicion
- 08 Vacaciones ano anterior (en dias: horas/8)
- 09 Sindicales
- 10 ITAT (dias y horas)
- 11 ITEC (dias y horas)
- 13 Ley Familias
- 14 TAJ (num. y horas)

### Retrasos
- Solo primera entrada normal del dia.
- Turno M esperado 07:00, Turno TN esperado 15:00.
- Margen 1 min 59 seg.
- Se acumula en horas decimales.

### TOTAL Horas
Suma:
Horas Dia + Horas Tarde + Horas Noche + Festivas +
H. Medico + As. Oficiales + H. Vacaciones (dias*8) + Esp. y Ac +
H.L. Disp + H. Sind + H. ITAT + H. ITEC + H. Vac. Ant (dias*8) +
H. Ley Fam + H. TAJ + Tiempo Retrasos.

NO incluye:
- Exceso Jornada 1
- Nocturnas

## 8. Redondeo

Todas las columnas numericas se redondean a 2 decimales antes de exportar.

## 9. Archivo exportado

- Nombre: `Base_Nominas_<fecha_inicio>_<fecha_fin>.xlsx`
- Hoja: "Resumen"
