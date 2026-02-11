---
name: knowledge-manager
description: Combina gestión y análisis de conocimiento (NotebookLM). Modos Lectura (Analyst) y Escritura (Manager).
---

# Knowledge Manager: Gestor Integral de Conocimiento

Esta habilidad centraliza todas las operaciones relacionadas con la gestión del conocimiento y el análisis de documentos mediante Google NotebookLM.

## Modos de Operación

### 1. Modo Escritura/Gestión (Manager Mode)
**Objetivo:** Mantener el espacio de trabajo limpio, organizado y actualizado.
- **Creación:** `notebooklm_create_notebook`. Usa nombres descriptivos (ej: "Proyecto X - Docs").
- **Ingesta:** `notebooklm_upload_source`. Añade PDFs, URLs o notas.
- **Mantenimiento:** `notebooklm_delete_notebook`. Elimina lo obsoleto (siempre con confirmación).

### 2. Modo Lectura/Análisis (Analyst Mode)
**Objetivo:** Extraer inteligencia y responder preguntas complejas.
- **Exploración:** Obtén el panorama de un cuaderno.
- **Interrogatorio:** `notebooklm_query`. Pregunta al modelo sobre el contenido.
- **Síntesis:** Cruza datos de múltiples fuentes para generar informes coherentes.

## Flujo de Trabajo Típico
1.  **Setup:** ¿Existe el cuaderno? Si no, (Manager) créalo.
2.  **Ingesta:** (Manager) Sube los documentos relevantes.
3.  **Consulta:** (Analyst) Pregunta sobre los documentos subidos.
4.  **Cierre:** (Manager) Si era temporal, límpialo.

## Herramientas MCP
- `notebooklm_create_notebook`
- `notebooklm_upload_source`
- `notebooklm_query`
- `notebooklm_delete_notebook`
