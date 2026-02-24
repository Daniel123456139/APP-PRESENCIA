---
trigger: always_on
---

# Guia de Columnas: Excel de Nominas (Regla Oficial del Proyecto)

Este documento define las reglas que el proyecto debe respetar siempre para evitar errores en calculo de horas, cruce ERP/Firebase y exclusiones entre tablas.

---

## 1) Reglas maestras de calculo temporal

- Regla 1 (obligatoria): las incidencias se interpretan en pares. El tiempo justificado es el hueco entre una Entrada y su Salida correspondiente.
- Regla 2 (obligatoria): el tiempo efectivo trabajado se calcula con pares de jornada normal Entrada -> Salida con `MotivoAusencia = 1`.
- Regla 3 (obligatoria): si una incidencia trae `Inicio/Fin` valido, ese rango se respeta como intervalo explicito.
- Regla 4 (fallback): si no hay `Inicio/Fin`, se usa emparejado por fichajes consecutivos Entrada -> Salida(codigo).
- Regla 5: para cruces de medianoche, el sistema soporta intervalos que terminan al dia siguiente.

---

## 2) Informacion basica del empleado

### 1. Colectivo
- Se obtiene del departamento del empleado (ERP/Fichajes), priorizando el dato mas reciente disponible.

### 2. Operario
- Formato oficial de exportacion: `FV` + ID a 3 digitos (ejemplo `FV049`).

### 3. Nombre
- Se obtiene del maestro de empleados que usa la app para generar el export.
- Regla de control ERP/Firebase:
  - Si un operario existe en ERP pero no en Firebase, la app debe mostrar aviso visible.
  - La app debe ofrecer boton directo `Anadir a Firebase` para crear su ficha sin salir de la pantalla.
  - Tras alta, la lista debe refrescarse y el aviso desaparecer para ese empleado.

---

## 3) Horas de trabajo y tramos

### 4. TOTAL Horas
- Suma: `Horas Dia + Horas Tarde + Horas Noche + H. Medico + As. Oficiales + H. Vacaciones(8h/dia) + Esp. y Ac + H.L. Disp + H. Sind + H. ITAT + H. ITEC + H. Vac. Ant(8h/dia) + H. Ley Fam + H. TAJ + Tiempo Retrasos`.

### 5. Horas Dia
- Tiempo efectivo trabajado en franja diurna (07:00-15:00), descontando TAJ en la misma franja.

### 6. Exceso Jornada 1
- Para turno de manana, tiempo trabajado entre 15:00 y 19:59.

### 7. Horas Tarde
- Tiempo efectivo trabajado en 15:00-23:00, descontando TAJ en esa franja.

### 8. Nocturnas
- Tiempo trabajado en tramo nocturno (20:00-06:00) segun reglas del bucket nocturno.

### 9. Horas Noche
- Tiempo efectivo trabajado en 23:00-07:00 (turno noche/tarde-noche segun configuracion).

### 10. Festivas
- Si el dia es festivo o fin de semana (calendario), el tiempo trabajado de ese dia se imputa en festivas.

---

## 4) Incidencias por codigo (resumen funcional)

- 11-13 Medico (`02`):
  - `H. Medico` y `Acum. Medico` se calculan por intervalos en pares (o `Inicio/Fin` si existe).
  - `Disp. Medico = 16 - Acum. Medico`.
- 14-16 Vacaciones (`05`):
  - Se calculan en horas por intervalos y se convierten a dias (`/8`) para mostrar.
  - `Disp. Vacaciones = DiasVacacionesEmpleado - Acum. Vacaciones`.
- 17-19 Libre Disposicion (`07`): horas en periodo, acumulado y disponible.
- 20-22 Ley Familias (`13`): horas en periodo, acumulado y disponible.
- 23 As. Oficiales (`03`), 24 Esp. y Ac (`06`), 25 H. Sind (`09`), 26 H. Vac. Ant (`08` en dias /8).
- 27-30 Bajas:
  - `Dias ITAT` (`10`) y `Dias ITEC` (`11`) cuentan dias unicos con incidencia.
  - `H. ITAT` y `H. ITEC` se calculan por intervalos.
- 31-32 TAJ (`14`):
  - `Num. TAJ` = numero de registros del codigo.
  - `H. TAJ` = suma de intervalos TAJ; ademas se descuenta de horas de trabajo por franja.
- 33-34 Retrasos:
  - `Num. Retrasos` y `Tiempo Retrasos` se calculan contra la primera entrada valida del dia por turno.

---

## 5) Regla de exclusiones entre tablas (obligatoria)

Tablas afectadas:
- General (fichajes/resumen)
- Ausencias
- Bajas
- Vacaciones

### Vista de un unico dia
- Deben ser mutuamente excluyentes: un empleado no puede aparecer en mas de una tabla a la vez.
- Reglas minimas:
  - Ausencias excluye Bajas y Vacaciones.
  - General excluye Bajas, Ausencias y Vacaciones.
  - Vacaciones no debe duplicar con Ausencias en el mismo dia.

### Vista de varios dias
- Se permite superposicion por periodo: un empleado puede aparecer en General y tambien en Ausencias/Bajas/Vacaciones si ocurren en dias distintos dentro del rango.

---

## 6) Regla de calidad para evitar regresiones

- Cualquier cambio en export nominas o tablas de RRHH debe validar estas reglas antes de cerrar tarea.
- Si una nueva implementacion contradice este documento, se considera regresion funcional.
- Este documento es norma operativa del proyecto para estos dos ejes:
  - calculo temporal por pares de incidencias,
  - exclusiones coherentes entre tablas.

---

Documento oficial de referencia interna - APP PRESENCIA.
