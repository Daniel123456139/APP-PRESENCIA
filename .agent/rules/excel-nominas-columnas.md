---
trigger: always_on
---

# 08 - Excel de Nóminas: Especificación de Columnas

## Descripción General

El Excel de Nóminas es una exportación detallada que contiene **34 columnas** con información de presencia, ausencias e incidencias de todos los empleados para un periodo determinado.

Todos los datos se calculan **directamente desde los fichajes del swagger** (endpoint `/fichajes/getFichajes`).

---

## Columnas del Excel

### 📋 Información Básica (Columnas 1-3)

#### 1. Colectivo
- **Descripción:** Sección o departamento del empleado
- **Origen:** Campo `DescDepartamento` de los fichajes
- **Ejemplo:** "Producción", "Almacén", "Administración"

#### 2. Operario
- **Descripción:** Identificador único del empleado
- **Formato:** `FV` + número de 3 dígitos
- **Origen:** Campo `IDOperario` del fichaje
- **Ejemplo:** `FV049`, `FV101`, `FV005`

#### 3. Nombre
- **Descripción:** Nombre completo del empleado
- **Origen:** Maestro de usuarios
- **Ejemplo:** "Juan García López"

---

### ⏱️ Horas Trabajadas (Columnas 4-10)

#### 4. TOTAL Horas
- **Descripción:** Suma total de todas las horas del periodo
- **Fórmula:** Horas Dia + Horas Tarde + Horas Noche + FESTIVAS + H. Medico + As. Oficiales + H. Vacaciones + Esp. y Acc. + H.L. Disp + H. Sind + H. ITAT + H. ITEC + H. Vac. Ant + H. Ley Fam + H. TAJ + Tiempo Retrasos
- **Importante:** NO incluye Exceso Jornada 1 ni Nocturnas

#### 5. Horas Dia
- **Descripción:** Tiempo trabajado en horario diurno (07:00-15:00)
- **Cálculo:** Intersección de fichajes con rango 07:00-15:00 **MENOS** tiempo TAJ en ese rango
- **Ejemplo:** Trabaja 07:00-15:00 pero sale 30min a fumar → 7.5h (no 8h)

#### 6. EXCESO JORNADA 1
- **Descripción:** Horas extras en rango 15:00-19:59
- **Aplica a:** Solo turno Mañana (M)
- **Ejemplo:** Turno M trabaja hasta 17:00 → 2h de exceso jornada 1

#### 7. Horas Tarde
- **Descripción:** Tiempo trabajado en horario de tarde (15:00-23:00)
- **Cálculo:** Intersección de fichajes con rango 15:00-23:00 **MENOS** tiempo TAJ
- **Aplica a:** Principalmente turno Tarde (TN)

#### 8. NOCTURNAS
- **Descripción:** Horas realizadas fuera de turno en periodo nocturno (20:00-06:00)
- **Aplica a:** Solo turno Mañana (M) trabajando fuera de su horario
- **Ejemplo:** Turno M trabaja 20:00-22:00 → 2h nocturnas

#### 9. Horas Noche
- **Descripción:** Tiempo trabajado en horario nocturno (23:00-07:00)
- **Cálculo:** Intersección de fichajes con rango 23:00-07:00 **MENOS** tiempo TAJ
- **Aplica a:** Turno Noche (si existiera)

#### 10. FESTIVAS
- **Descripción:** Horas trabajadas en festivos o fines de semana
- **Condición:** Si día es festivo (calendario empresa) o fin de semana
- **Importante:** Si un día es festivo, **TODO** el tiempo va a festivas, no a Horas Dia/Tarde/Noche

---

### 🏥 Médico (Columnas 11-13) - Código 02

#### 11. H. Medico
- **Descripción:** Horas de médico usadas en el periodo seleccionado
- **Código:** 02
- **Origen:** Fichajes con `MotivoAusencia = 2`

#### 12. Acum. Medico
- **Descripción:** Horas de médico acumuladas desde inicio de año hasta la fecha del informe
- **Período:** Year-To-Date (YTD)

#### 13. Disp. Medico
- **Descripción:** Horas de médico disponibles restantes
- **Fórmula:** 16h - Acum. Medico
- **Crédito anual:** 16 horas

---

### 🏖️ Vacaciones (Columnas 14-16) - Código 05

#### 14. H. Vacaciones
- **Descripción:** Días de vacaciones usados en el periodo seleccionado
- **Código:** 05
- **Unidad:** DÍAS (no horas)
- **Cálculo:** Horas con código 05 / 8

#### 15. Acum. Vacaciones
- **Descripción:** Días de vacaciones acumulados YTD
- **Unidad:** DÍAS

#### 16. Disp. Vacaciones
- **Descripción:** Días de vacaciones disponibles restantes
- **Fórmula:** 22 días - Acum. Vacaciones
- **Crédito anual:** 22 días

---

### 🕐 Libre Disposición (Columnas 17-19) - Código 07

#### 17. H.L. Disp
- **Descripción:** Horas de Libre Disposición usadas en el periodo
- **Código:** 07

#### 18. Acum. H.L. Disp
- **Descripción:** Horas de Libre Disposición acumuladas YTD

#### 19. Disp. H.L. Disp
- **Descripción:** Horas de Libre Disposición disponibles
- **Fórmula:** 8h - Acum. H.L. Disp
- **Crédito anual:** 8 horas

---

### 👨‍👩‍👧 Ley Familias (Columnas 20-22) - Código 13

#### 20. H. Ley Fam
- **Descripción:** Horas de Ley de Familias usadas en el periodo
- **Código:** 13

#### 21. Acum. HLF
- **Descripción:** Horas de Ley de Familias acumuladas YTD

#### 22. Disp. HLF
- **Descripción:** Horas de Ley de Familias disponibles
- **Fórmula:** 32h - Acum. HLF
- **Crédito anual:** 32 horas

---

### 📄 Otras Incidencias (Columnas 23-26)

#### 23. As. Oficiales
- **Descripción:** Horas de Asuntos Oficiales en el periodo
- **Código:** 03

#### 24. Esp. y Ac
- **Descripción:** Horas de Especialista y Accidente en el periodo
- **Código:** 06
- **Ejemplo:** Visita a especialista médico, accidente laboral

#### 25. H. Sind
- **Descripción:** Horas Sindicales usadas en el periodo
- **Código:** 09

#### 26. H. Vac. Ant
- **Descripción:** Vacaciones del año anterior no disfrutadas
- **Código:** 08
- **Unidad:** DÍAS
- **Importante:** No consume el crédito del año actual

---

### 🏥 Bajas ITAT e ITEC (Columnas 27-30)

#### 27. Dias ITAT
- **Descripción:** Número de días distintos con baja por ITAT
- **Código:** 10
- **Cálculo:** Cuenta días únicos, no suma horas

#### 28. H. ITAT
- **Descripción:** Total de horas de ITAT en el periodo
- **Código:** 10

#### 29. Dias ITEC
- **Descripción:** Número de días distintos con baja por ITEC
- **Código:** 11

#### 30. H. ITEC
- **Descripción:** Total de horas de ITEC en el periodo
- **Código:** 11

---

### 🚬 TAJ - Torno (Columnas 31-32) - Código 14

#### 31. Num. TAJ
- **Descripción:** Cantidad de veces que el empleado registró salidas TAJ
- **Código:** 14
- **Cálculo:** Cuenta registros con `MotivoAusencia = 14`
- **Ejemplo:** Si salió 5 veces a fumar → 5

#### 32. H. TAJ
- **Descripción:** Tiempo total acumulado en salidas TAJ
- **Código:** 14
- **Importante:** Este tiempo ya se ha **RESTADO** de Horas Dia/Tarde/Noche

---

### ⏰ Retrasos (Columnas 33-34)

#### 33. Num. Retrasos
- **Descripción:** Cantidad de días con entrada tardía
- **Cálculo:** Cuenta días donde primera entrada > horario esperado + margen
- **Margen:** 1 minuto 59 segundos
- **Horario esperado:**
  - Turno M: 07:00
  - Turno TN: 15:00

#### 34. Tiempo Retrasos
- **Descripción:** Suma de minutos de retraso acumulados en el periodo
- **Unidad:** Horas
- **Ejemplo:** 3 días con retrasos de 5min, 10min, 8min → 0.383h (23min total)

---

## Reglas Críticas de Cálculo

### 1. ¿Qué es "Trabajo Real"?

Solo se consideran **fichajes normales** sin motivo de ausencia:
- `MotivoAusencia = null` (fichaje normal)
- `MotivoAusencia = 0` (fichaje normal)
- `MotivoAusencia = 1` (fin jornada normal)

**NO se incluyen:**
- Médico (02), Vacaciones (05), Permisos, etc.
- TAJ (14) se incluye inicialmente pero luego se resta

### 2. TAJ se Resta del Tiempo Trabajado

El tiempo TAJ **NO** es tiempo trabajado, por tanto:
1. Se calcula primero el tiempo bruto trabajado
2. Se resta el tiempo TAJ del rango correspondiente
3. El resultado es el tiempo **neto** trabajado

**Ejemplo:**
- Trabaja 07:00-15:00 (8h brutas)
- TAJ 10:00-10:30 (0.5h)
- **Horas Dia final:** 7.5h

### 3. Festivos Anulan Otros Rangos

Si un día es festivo (calendario o fin de semana):
- **TODO** el tiempo va a columna "FESTIVAS"
- Horas Dia, Tarde, Noche = 0 para ese día

### 4. YTD = Year-To-Date

Las columnas "Acum." calculan desde:
- **Fecha inicio:** 01/01/[año del informe]
- **Fecha fin:** Fecha final del periodo seleccionado

### 5. Disponible = Crédito - Acumulado

Todas las columnas "Disp." usan la fórmula:
```
Disponible = Crédito Anual - Acumulado YTD
```

---

## Códigos de Motivos de Ausencia

| Código | Descripción | Columnas Afectadas |
|--------|-------------|-------------------|
| 00/01 | Fichaje normal | Horas Dia/Tarde/Noche |
| 02 | Médico | 11, 12, 13 |
| 03 | Asuntos Oficiales | 23 |
| 05 | Vacaciones Año Actual | 14, 15, 16 |
| 06 | Especialista/Accidente | 24 |
| 07 | Libre Disposición | 17, 18, 19 |
| 08 | Vacaciones Año Anterior | 26 |
| 09 | Horas Sindicales | 25 |
| 10 | ITAT | 27, 28 |
| 11 | ITEC | 29, 30 |
| 13 | Ley Familias | 20, 21, 22 |
| 14 | TAJ (Torno) | 31, 32 |

---

## Créditos Anuales

| Concepto | Crédito Anual | Unidad |
|----------|---------------|--------|
| Médico | 16 | Horas |
| Vacaciones | 22 | Días |
| Libre Disposición | 8 | Horas |
| Ley Familias | 32 | Horas |

---

## Ejemplo Completo

**Empleado:** FV049 - Juan García  
**Periodo:** 01/01/2026 - 31/01/2026  
**Turno:** Mañana (M)

**Fichajes del mes:**
- 20 días trabajados 07:00-15:00 (160h brutas)
- 3 salidas TAJ de 30min cada una (1.5h total)
- 1 día médico (8h)
- 2 días vacaciones (16h)
- 2 retrasos: 5min y 10min (0.25h total)
- 1 día trabajó hasta 17:00 (2h extra)

**Resultado Excel:**
- **Horas Dia:** 158.5h (160h - 1.5h TAJ)
- **EXCESO JORNADA 1:** 2h (15:00-17:00 el día extra)
- **H. Medico:** 8h
- **H. Vacaciones:** 2 días
- **Num. TAJ:** 3
- **H. TAJ:** 1.5h
- **Num. Retrasos:** 2
- **Tiempo Retrasos:** 0.25h
- **TOTAL Horas:** 158.5 + 2 + 8 + 16 + 1.5 + 0.25 = 186.25h

---

## Notas Importantes

1. **Columna TOTAL NO incluye** "Exceso Jornada 1" ni "Nocturnas" según especificación del usuario
2. **TAJ ya está restado** de Horas Dia/Tarde/Noche, pero se suma al TOTAL
3. **Vacaciones se muestran en DÍAS**, no en horas (aunque se convierten a horas para el TOTAL)
4. **Retrasos solo cuentan primera entrada** del día, ignora entradas posteriores
5. **Margen de retraso:** 1min 59seg es tolerancia antes de considerar retraso oficial
