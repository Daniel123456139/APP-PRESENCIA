---
trigger: always_on
---

A la hora de grabar una incidencia, la app debe de mostrar visualmente el rango de tiempo en el que se va  ainsetar.

**Ejemplo 1** el operario que trabaja de 07:00 a 15:00, pero entre medias d ela jornada, se va de 10 a 12 al medico. 

A la hora de grabar la incidencia, la app debe decirme que la incidencia se grabara de 10:01 --> 11:59

**Ejemplo 2** el operario que trabaja de 07:00 a 15:00, pero viene mas tarde , por ejemplo a las 08:00.

A la hora de grabar la incidencia, la app debe decirme que la incidencia se grabara de 07:00 --> 07:59

**Ejemplo 3** el operario que trabaja de 07:00 a 15:00, pero se va a las 12 y no vuelve.

A la hora de grabar la incidencia, la app debe decirme que la incidencia se grabara de 12:01 --> 15:00