---
name: document-finder
description: Realiza una investigación profunda para localizar documentos exactos en rutas proporcionadas. Responde con tablas ordenadas y no modifica archivos.
---

# Document Finder (V2)

Esta habilidad permite realizar búsquedas de alta precisión en directorios locales y de red. Su objetivo es localizar información específica con rigor absoluto, manteniendo un entorno de solo lectura y entregando resultados estructurados.

## Cuándo usar esta habilidad

- Cuando se requiera localizar documentos con nombres precisos (ej: "A2102.pdf").
- Para realizar una investigación profunda en estructuras de carpetas complejas buscando coincidencias exactas.
- Cuando el usuario necesite un informe claro y tabulado de la ubicación de múltiples archivos.
- **Restricción:** Solo lectura. No está permitido renombrar, mover o editar.

## Cómo usar esta habilidad (Protocolo)

### 1. Fase de Análisis e Investigación Profunda
1.  **Exactitud por Defecto:** Salvo que el usuario pida "algo parecido" o use wildcards (`*`), busca el término **exactamente** como fue proporcionado.
2.  **Múltiples Intentos:** Si la búsqueda exacta falla, el agente debe:
    - Verificar la estructura del directorio (`list_dir`) para entender la nomenclatura local (ej: ver si hay prefijos como 'S25' o 'A').
    - Realizar una investigación profunda explorando niveles lógicos (ej: si buscas facturas de 2025, busca en carpetas llamadas '2025', 'Septiembre', etc.).
    - Proponer al usuario variaciones encontradas si la búsqueda exacta no dio frutos.

### 2. Ejecución Técnica
1.  Utilizar `find_by_name` con patrones estrictos inicialmente.
2.  Si es necesario, realizar búsquedas recursivas en subdirectorios clave identificados durante la fase de análisis.
3.  Mantener un registro de qué rutas han sido exploradas para evitar duplicidad.

### 3. Formato de Salida (Obligatorio)
La respuesta final **DEBE** incluir una tabla de Markdown con las siguientes columnas, ordenada por el término buscado:

| Documento Buscado | Estado | Ruta Encontrada / Observaciones |
| :--- | :--- | :--- |
| [Nombre] | Encontrado / No Encontrado | [Ruta absoluta o motivo del fallo] |

## Mejores Prácticas y Restricciones
- **Do:** Ser extremadamente meticuloso con los nombres de archivo. Una letra de diferencia importa.
- **Do:** Investigar profundamente las carpetas de red antes de dar un resultado como negativo.
- **Don't:** Usar `*` de forma indiscriminada si el usuario dio un nombre cerrado.
- **Don't:** Entregar listas desordenadas; usa siempre la tabla especificada.
