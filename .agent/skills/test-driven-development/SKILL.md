---
name: test-driven-development
description: Garantiza la calidad del código escribiendo y ejecutando pruebas antes y después de la implementación. Previene regresiones y bugs.
---

# Test Driven Development (TDD)

Esta habilidad impone una disciplina de calidad estricta basada en el ciclo Red-Green-Refactor. Su propósito es asegurar que cada línea de código tenga un propósito verificado y prevenir la introducción de errores silenciosos.

## La Ley de Hierro (The Iron Law)

> **NUNCA afirmes que una tarea está completa sin haber ejecutado un test o script de verificación que demuestre el resultado. La suposición es el enemigo.**

Si no hay un test que lo demuestre, el código no funciona. Punto.

## Flujo de Trabajo (Workflow TDD)

Este flujo es obligatorio para corregir bugs complejos o implementar lógica crítica.

### Paso 1: Crear Test de Fallo (Red)
Antes de escribir una sola línea de la solución o funcionalidad:
- Crea un archivo de prueba (unit test, integration test) o un script de verificación simple (si no hay framework).
- El test debe intentar ejecutar la funcionalidad deseada o reproducir el bug reportado.

### Paso 2: Verificar el Fallo
- Ejecuta el test creado en el paso anterior.
- **Debes ver fallar el test**. Esto confirma que tu test es válido y que efectivamente está detectando la ausencia de la funcionalidad o la presencia del bug.
- Si el test pasa a la primera, está mal diseñado o la funcionalidad ya existía.

### Paso 3: Implementar Solución (Green)
- Escribe el código **mínimo necesario** para hacer pasar ese test.
- No te preocupes todavía por la elegancia o la optimización, solo céntrate en cambiar el rojo por el verde.

### Paso 4: Verificar el Éxito
- Ejecuta el test nuevamente.
- Confirma que ahora **PASA** exitosamente.
- Esto te da la seguridad matemática de que tu código hace lo que se supone que debe hacer.

### Paso 5: Refactorizar (Refactor)
- Ahora que tienes un test en verde que te protege "la espalda", mejora el código.
- Limpia, optimiza, mejora nombres de variables, extrae funciones.
- Ejecuta el test tras cada cambio para asegurar que no rompes nada durante la limpieza.

## Comandos Sugeridos

Utiliza las herramientas ya configuradas en el proyecto siempre que sea posible. Si no existen, usa scripts nativos del lenguaje.

- **Node/JS/TS**: `npm test`, `npx jest`, `npx vitest`, o simplemente `node validation_script.js`.
- **Python**: `pytest`, `python -m unittest`, o `python validation_script.py`.
- **Rust**: `cargo test`.
- **Go**: `go test ./...`.

Si no hay framework de testing, crea un archivo temporal `verify_fix.js` (o la extensión que corresponda), ejecútalo para validar, y bórralo al finalizar si es necesario.
