---
trigger: always_on
---

004 INSERTAR INCIDENCIAS -- **REGLA CLAVE*

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



para el caso de los fichajes, cuando un empelado se va y vuelve, se le graba una incidencia.
el ejemplo sera: el empelado viene de 7 a 8. de 8 a 11 se va, y de 11 a 15 vuelve a su puesto.

antes de grabar la incidencia, su fichaje sera:
entrada 01 a las 07
salida 01 a las 8:00
entrada 01 a las 11:00 
salida 01 a las 15:00

lo que deberia hcer la app es meter un par de fichajes, una salida y una entrada para justificar la incidecnia. el fichaje quedaria
entrada 01 a las 07
salida 01 a las 8:00
entrada 01 a las 08:01 
salida 02 (por ejemplo, aqui iria el numero de la incidecia) a las 10:59
entrada 01 a las 11:00 
salida 01 a las 15:00


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