---
trigger: always_on
---

# 07 - Cálculo de Columnas Principales

## Descripción General

Este documento define con precisión el cálculo de las **tres columnas más críticas** de la tabla principal de presencia. Estas columnas son esenciales para el Excel final de nóminas.

---

## Columnas Principales

### 1. PRESENCIA

**Definición:** Tiempo trabajado real **DENTRO DE SU JORNADA LABORAL**

**Cálculo:**
```
PRESENCIA = Horas trabajadas dentro de la jornada - TODAS las ausencias (incluido TAJ)
```

**Consideraciones:**
- **Solo cuenta tiempo dentro de la jornada:** 
  - Turno M (Mañana): 07:00 - 15:00
  - Turno TN (Tarde): 15:00 - 23:00
- **Se descuentan TODAS las ausencias:**
  - TAJ (código 14)
  - Médico (código 02)
  - Vacaciones (código 05)
  - Cualquier otra incidencia (03, 04, 06, 07, 08, 09, 10, 11, 13)

**Ejemplo 1 - Turno Mañana sin incidencias:**
- Fichajes: 07:00 (entrada) → 15:00 (salida)
- **PRESENCIA = 8h**

**Ejemplo 2 - Turno Mañana con TAJ:**
- Fichajes: 07:00 → 15:00
- TAJ: 10:00 → 10:30 (30 minutos)
- **PRESENCIA = 7.5h** (8h - 0.5h TAJ)

**Ejemplo 3 - Turno Mañana con médico:**
- Fichajes: 07:00 → 10:00 (sale), 11:30 → 15:00 (vuelve)
- Médico grabado: 10:00 → 11:30 (1.5h) esto ira a JUSTIFICA
- Tiempo dentro de jornada trabajado: 3h (07:00-10:00) + 3.5h (11:30-15:00) = 6.5h
- **PRESENCIA = 6.5h**

**Ejemplo 4 - Turno Mañana con retraso:**
- Fichajes: 08:00 (entrada con retraso) → 15:00 (salida)
- **PRESENCIA = 7h** (solo cuenta de 08:00 a 15:00)
- Nota: El retraso se refleja en otra columna

---

### 2. JUSTIFICA

**Definición:** Ausencias o "saltos" justificados mediante incidencias **excepto código 14 (TAJ)** dentro de la jornada laboral

**Cálculo:**
```
JUSTIFICA = Suma de horas de todas las incidencias EXCEPTO 14 (TAJ)
```

**Códigos incluidos:**
- 02: Médico
- 03: Asuntos Oficiales
- 04: Asuntos Propios
- 05: Vacaciones
- 06: Especialista/Accidente
- 07: Libre Disposición
- 08: Vacaciones Año Anterior
- 09: Horas Sindicales
- 10: ITAT (Baja)
- 11: ITEC (Baja)
- 13: Ley de Familias

**Códigos NO incluidos:**
- 14: TAJ (se muestra en columna separada)

**Ejemplo 1 - Médico:**
- Fichajes: 07:00 → 10:00, 11:30 → 15:00
- Médico: 10:00 → 11:30
- **JUSTIFICA = 1.5h**

**Ejemplo 2 - Médico + Libre Disposición:**
- Médico: 1.5h
- Libre Disposición: 2h
- **JUSTIFICA = 3.5h**

**Ejemplo 3 - Solo TAJ (no cuenta):**
- TAJ: 10:00 → 10:30
- **JUSTIFICA = 0h** (TAJ no se incluye en JUSTIFICA)

**Ejemplo 4 - Vacaciones día completo:**
- Vacaciones: 07:00 → 15:00 (turno M)
- **JUSTIFICA = 8h**

---

### 3. TOTAL

**Definición:** Suma de PRESENCIA + JUSTIFICA + TAJ (en número entero)

**Cálculo:**
```
TOTAL = PRESENCIA + JUSTIFICA + TAJ
```

**Regla de Oro:**
- **Salvo retrasos, TOTAL debe ser exactamente 8h** (la duración de la jornada laboral)
- Si hay retraso, TOTAL será menor a 8h

**Ejemplo 1 - Jornada normal:**
- PRESENCIA = 8h
- JUSTIFICA = 0h
- TAJ = 0h
- **TOTAL = 8h** ✓

**Ejemplo 2 - Jornada con TAJ:**
- PRESENCIA = 7.5h (descontado TAJ)
- JUSTIFICA = 0h
- TAJ = 0.5h
- **TOTAL = 8h** ✓

**Ejemplo 3 - Jornada con médico:**
- PRESENCIA = 6.5h
- JUSTIFICA = 1.5h (médico)
- TAJ = 0h
- **TOTAL = 8h** ✓

**Ejemplo 4 - Jornada con retraso (NO llega a 8h):**
- Fichajes: 08:00 → 15:00
- PRESENCIA = 7h
- JUSTIFICA = 0h
- TAJ = 0h
- **TOTAL = 7h** ⚠️ (Correcto: hay retraso de 1h)

**Ejemplo 5 - Jornada con retraso justificado:**
- Fichajes: 09:00 → 15:00 (llegó a las 09:00)
- Médico grabado: 07:00 → 09:00 (2h)
- PRESENCIA = 6h (09:00-15:00)
- JUSTIFICA = 2h (médico)
- TAJ = 0h
- **TOTAL = 8h** ✓ (El retraso está justificado)

**Ejemplo 6 - Vacaciones día completo:**
- PRESENCIA = 0h (no trabajó)
- JUSTIFICA = 8h (vacaciones)
- TAJ = 0h
- **TOTAL = 8h** ✓

---

## Casos Especiales

### Caso: Salida temprana justificada

**Escenario:**
- Turno M: 07:00 - 15:00
- Fichajes: 07:00 → 12:00 (se va y no vuelve)
- Médico grabado: 12:00 → 15:00

**Cálculo:**
- PRESENCIA = 5h (07:00 - 12:00)
- JUSTIFICA = 3h (12:00 - 15:00, médico)
- TAJ = 0h
- **TOTAL = 8h** ✓

### Caso: Múltiples salidas con TAJ

**Escenario:**
- Fichajes: 07:00 → 10:00 (TAJ), 10:30 → 12:00 (TAJ), 12:15 → 15:00
- TAJ: 10:00-10:30 + 12:00-12:15 = 45 min

**Cálculo:**
- Tiempo trabajado bruto: 8h
- PRESENCIA = 7.25h (8h - 0.75h TAJ)
- JUSTIFICA = 0h
- TAJ = 0.75h
- **TOTAL = 8h** ✓

### Caso: Horarios partidos sin incidencia

**Escenario:**
- Fichajes: 07:00 → 12:00, 13:00 → 16:00
- No hay incidencia grabada entre 12:00 y 13:00

**Problema:**
- Hay un "hueco" de 1h sin justificar

**Cálculo incorrecto (antes de grabar incidencia):**
- PRESENCIA = 8h (5h + 3h)
- JUSTIFICA = 0h
- TAJ = 0h
- **TOTAL = 8h** 

**⚠️ WARNING:** La app debe detectar este hueco y proponer grabar una incidencia

**Después de grabar incidencia (ej. Asuntos Propios 12:00-13:00):**
- PRESENCIA = 7h (5h mañana + 2h tarde dentro de jornada 07:00-15:00)
- JUSTIFICA = 1h
- TAJ = 0h
- **TOTAL = 8h** ✓

---

## Validaciones Automáticas

La aplicación debe verificar:

1. **TOTAL = 8h (salvo retrasos):**
   - Si `TOTAL < 8h` y no hay retraso → Error / Falta incidencia
   - Si `TOTAL > 8h` → Error de cálculo

2. **Coherencia PRESENCIA + JUSTIFICA:**
   - `PRESENCIA + JUSTIFICA + TAJ` debe coincidir con las horas de la jornada
   
3. **Tiempo dentro de jornada:**
   - PRESENCIA nunca debe exceder 8h para jornada normal
   - Horas fuera de jornada van a columnas "Exceso" o "Nocturnas"

---

## Notas Importantes

### Diferencia entre PRESENCIA y Horas Dia/Tarde/Noche

- **PRESENCIA:** Solo tiempo trabajado DENTRO de la jornada correspondiente
- **Horas Dia/Tarde/Noche:** Pueden incluir tiempo fuera de jornada (horas extra)

**Ejemplo:**
- Turno M trabaja: 07:00 → 17:00
- **PRESENCIA = 8h** (solo 07:00-15:00)
- **Horas Dia = 8h** (07:00-15:00)
- **Exceso Jornada 1 = 2h** (15:00-17:00, en columna separada)

### Tratamiento del TAJ

- TAJ se descuenta de PRESENCIA
- TAJ NO cuenta en JUSTIFICA
- TAJ se suma aparte en TOTAL
- TAJ tiene su propia columna en el Excel final

### Festivos

- En festivos, todo el tiempo va a columna "FESTIVAS"
- PRESENCIA puede ser 0 si trabajó en festivo
- El tiempo trabajado en festivo no suma a PRESENCIA regular
