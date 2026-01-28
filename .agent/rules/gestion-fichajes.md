---
trigger: always_on
---

\# Instrucciones de Gestión de Fichajes por Incidencias



Este documento define las reglas de actuación que debe aplicar la aplicación de fichajes ante distintos escenarios de ausencia o incidencia de los operarios.



---



\## Caso 1: El operario se va y no vuelve



\*\*Descripción\*\*  

El operario abandona su puesto antes de finalizar la jornada y no regresa.



\*\*Acción requerida\*\*

\- Insertar un \*\*fichaje de entrada normal\*\* (sin motivo de ausencia) \*\*un minuto después\*\* del fichaje real de salida.

\- Insertar un \*\*fichaje de salida\*\* con el \*\*código de incidencia correspondiente\*\* a la \*\*hora fin de su horario\*\*.



\*\*Ejemplo\*\*

\- Turno mañana: \*\*07:00 – 15:00\*\*

\- Sale a las \*\*12:00\*\* y no vuelve  

&nbsp; - Entrada normal: \*\*12:01\*\* (sin motivo)

&nbsp; - Salida con incidencia (ej. `02`): \*\*15:00\*\*



---



\## Caso 2: Entrada tardía justificada (médico u otra causa)



\*\*Descripción\*\*  

El operario no inicia la jornada a su hora habitual, pero la ausencia está justificada.



\*\*Acción requerida\*\*

\- Insertar un \*\*fichaje de entrada normal\*\* (sin motivo) a la \*\*hora de inicio del horario\*\*.

\- Insertar un \*\*fichaje de salida\*\* con el \*\*motivo de ausencia\*\* \*\*un minuto antes\*\* de la hora real de entrada.



\*\*Ejemplo\*\*

\- Turno mañana: \*\*07:00 – 15:00\*\*

\- Entra realmente a las \*\*09:00\*\*

&nbsp; - Entrada normal: \*\*07:00\*\*

&nbsp; - Salida con incidencia (ej. `02`): \*\*08:59\*\*



---



\## Caso 3: El operario se va y vuelve



\*\*Descripción\*\*  

El operario interrumpe la jornada, pero regresa y continúa trabajando.



\*\*Acción requerida\*\*

\- \*\*No insertar nuevos fichajes\*\*.

\- \*\*Modificar el fichaje existente\*\* utilizando el endpoint `/fichajes/updateFichaje`.

\- Cambiar el tipo de la salida intermedia por el \*\*código de incidencia correspondiente\*\*.



\*\*Ejemplo\*\*

\- Turno mañana:

&nbsp; - Entrada: \*\*07:00\*\*

&nbsp; - Salida: \*\*09:00\*\* (inicialmente “fin de jornada”)

&nbsp; - Entrada: \*\*12:00\*\*

&nbsp; - Salida: \*\*15:00\*\*

\- Acción: modificar la salida de \*\*09:00\*\* a incidencia (ej. `02`).



---



\## Caso 4: Incidencia de día completo y bajas



\*\*Descripción\*\*  

El operario no trabaja durante toda la jornada (incidencia completa o baja).



\*\*Acción requerida\*\*

\- Insertar un \*\*fichaje de entrada normal\*\* (sin motivo) a la \*\*hora de inicio del horario\*\*.

\- Insertar un \*\*fichaje de salida\*\* con el \*\*código de incidencia\*\* correspondiente a la \*\*hora fin del horario\*\*.



\*\*Ejemplo\*\*

\- Turno mañana: \*\*07:00 – 15:00\*\*

&nbsp; - Entrada normal: \*\*07:00\*\*

&nbsp; - Salida con incidencia:

&nbsp;   - `10` (incidencia día completo) o

&nbsp;   - `11` (baja)

&nbsp;   - Hora: \*\*15:00\*\*



---



