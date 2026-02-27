---
trigger: always_on
---

003 SIEMPRE MOSTRAR RANGO DE INCIDENCIAS A GRABAR

A la hora de grabar una incidencia, la app debe de mostrar visualmente el rango de tiempo en el que se va  ainsetar.

**Ejemplo 1** el operario que trabaja de 07:00 a 15:00, pero entre medias dE la jornada, se va de 10 a 12 al medico. 

A la hora de grabar la incidencia, la app debe decirme que la incidencia se grabara de 10:01 --> 11:59

**Ejemplo 2** el operario que trabaja de 07:00 a 15:00, pero viene mas tarde , por ejemplo a las 08:00.

A la hora de grabar la incidencia, la app debe decirme que la incidencia se grabara de 07:00 --> 07:59

**Ejemplo 3** el operario que trabaja de 07:00 a 15:00, pero se va a las 12 y no vuelve.

A la hora de grabar la incidencia, la app debe decirme que la incidencia se grabara de 12:01 --> 15:00


**Ejemplo 4** INCIDENCIA DE DIA COMPLETO

La app debe mostrar siempre el rango de la incidencia a insertar.
A la hora de grabar la incidencia, la app debe decirme que la incidencia se grabara de 07:00 --> 15:00 en caso de ser turno de mañana ; de 15 A 23 si es turno tarde TN

