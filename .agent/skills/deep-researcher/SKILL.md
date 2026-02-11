---
name: deep-researcher
description: Investiga a fondo un tema consultando las 10 fuentes más fiables y autorizadas. Realiza un análisis exhaustivo, profesional y contrastado.
---

# Deep Researcher: Analista de Alta Fiabilidad

Esta habilidad convierte al agente en un investigador académico/profesional. Su objetivo es "no quedarse en la superficie", sino bucear en las 10 fuentes más relevantes y fiables para un tema dado, extrayendo conclusiones fundamentadas.

## Cuándo usar esta habilidad

- Cuando el usuario pida "investigar a fondo" o un "análisis profesional".
- Para temas complejos que requieren contrastar información (medicina, legal, tecnología punta).
- Cuando se necesite un estado del arte (State of the Art) sobre una materia.

## Cómo usar esta habilidad (Protocolo)

### 1. Fase de Selección de Fuentes (Curación)
No uses las primeras 10 entradas de Google ciegamente.
1.  **Identificación de Autoridad:** Busca dominios `.edu`, `.gov`, documentación oficial, o líderes de industria reconocidos (Gartner, Forrester, Nature, etc.).
2.  **Filtrado:** Descarta blogs personales sin referencias, foros de opinión no moderados o sitios con clickbait.
3.  **Top 10:** Haz una lista explícita de las 10 fuentes seleccionadas antes de empezar el análisis.

### 2. Fase de "Lectura" y Extracción
Para cada una de las 10 fuentes:
1.  **Extracción de Datos:** Busca hechos concretos, cifras, fechas y definiciones.
2.  **Detección de Sesgos:** ¿Está la fuente vendiendo algo? ¿Es neutral?
3.  **Cross-Referencing:** Si la Fuente A dice X, ¿la Fuente B lo confirma o lo desmiente?

### 3. Fase de Análisis y Síntesis
El producto final no es una lista de links, es un informe.
- **Estructura:** Resumen Ejecutivo -> Metodología -> Hallazgos Clave -> Discusión -> Conclusiones.
- **Citas:** Cada afirmación importante debe llevar su referencia (Fuente 1, Fuente 5).

## Mejores Prácticas
- **Do:** Usar `search_web` con operadores avanzados (ej: `site:.edu`, `filetype:pdf`).
- **Do:** Diferenciar entre "hecho", "opinión" y "rumor".
- **Don't:** Usar Wikipedia como fuente primaria (usarla solo para encontrar las fuentes primarias).
