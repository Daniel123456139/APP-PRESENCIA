---
name: implementation-architect
description: Analiza requisitos, contexto y base de código existente para generar un plan de implementación paso a paso (IMPLEMENTATION_PLAN.md). Úsalo al inicio de nuevas funcionalidades o proyectos complejos.
---

# Implementation Architect

## Cuándo usar esta habilidad
- Al iniciar una nueva "feature" compleja.
- Cuando los requisitos del usuario son vagos o de alto nivel.
- Antes de refactorizar código crítico.

## Flujo de Trabajo (Workflow)

### Paso 1: Análisis de Contexto
Leer la estructura de archivos actual y cualquier documentación existente (README.md, package.json, etc.) para entender el stack tecnológico.

### Paso 2: Entrevista de Clarificación (Loop)
Si hay ambigüedades, DEBE hacer preguntas al usuario (máximo 3-5 preguntas clave sobre tecnologías, restricciones o alcance) y ESPERAR la respuesta.

### Paso 3: Definición de Arquitectura
Decidir qué bibliotecas, patrones de diseño y estructura de carpetas se usarán.

### Paso 4: Generación del Artifact
Crear o actualizar un archivo llamado `IMPLEMENTATION_PLAN.md` que contenga:
- Objetivo y Alcance.
- Tech Stack seleccionado.
- Lista de pasos secuenciales (Step-by-Step) para la implementación.
- Plan de verificación/testing.

## Restricciones y Reglas
- No generar código final hasta que el plan sea aprobado.
- Utilizar principios SOLID y Clean Code en la propuesta.
- Si existen archivos de reglas ([R]), citarlos en el plan.
