---
name: executing-plans
description: Lee IMPLEMENTATION_PLAN.md y ejecuta las tareas de codificación secuencialmente, verificando cada paso.
---

# Executing Plans - El Ejecutor

Esta habilidad es el "Ejecutor" del sistema y su función es materializar el plan definido en `IMPLEMENTATION_PLAN.md` de forma segura y secuencial.

## Reglas de Ejecución (Core Principles)

### 1. Ejecución por Lotes
*   **Nunca** ejecutes todo el plan de una vez.
*   Ejecuta UN solo paso lógico a la vez.
*   Verifica que no haya errores tras la ejecución.
*   Solicita conformación explícita antes de pasar al siguiente paso.

### 2. Manejo de Errores Rígido
*   Si un paso falla (error de compilación, test fallido, comando erróneo), **DETENTE**.
*   Analiza el error e intenta aplicar una corrección (self-healing).
*   Si la corrección falla, repórtalo al usuario y espera instrucciones.
*   **Jamás** avances al siguiente paso dejando errores atrás.

### 3. Actualización de Progreso
*   Es obligatorio mantener el archivo `IMPLEMENTATION_PLAN.md` actualizado.
*   Al terminar un paso exitosamente, cambia la marca `[ ]` por `[x]`.

## Flujo de Trabajo (Workflow)

### Paso 1: Lectura del Plan
Lee el archivo `IMPLEMENTATION_PLAN.md` completo para entender el contexto global y el estado actual.

### Paso 2: Identificación del Siguiente Paso
Busca el primer ítem de la lista de tareas que no esté marcado como completado (que tenga `[ ]`).

### Paso 3: Anuncio de Ejecución
Informa al usuario qué paso vas a ejecutar ahora:
> "Ejecutando paso: [Nombre del paso del plan]..."

### Paso 4: Codificación / Ejecución
Realiza las acciones necesarias para completar ese paso específico:
*   Crear o editar archivos.
*   Ejecutar comandos de terminal (instalaciones, migraciones, etc.).

### Paso 5: Verificación
Ejecuta una validación rápida para asegurar que no has roto nada:
*   ¿Compila el proyecto?
*   ¿Pasan los tests unitarios afectados?
*   ¿Arranca el servidor (si aplica)?

### Paso 6: Cierre del Paso
1.  Si todo está verde, edita `IMPLEMENTATION_PLAN.md` y marca el paso con `[x]`.
2.  Pregunta al usuario: *"Paso completado y verificado. ¿Procedo con el siguiente: [Nombre del siguiente paso]?"*
