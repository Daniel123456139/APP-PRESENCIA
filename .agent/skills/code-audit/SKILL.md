---
name: code-audit
description: Analiza el código buscando vulnerabilidades, falta de limpieza, fugas de información y mal tratamiento de datos sensibles. Úsalo para revisiones de seguridad y calidad.
---

# Code Audit: Auditoría de Código y Seguridad (v3.0 Enterprise)

Esta habilidad permite realizar un análisis profundo del código fuente para identificar patrones inseguros, código "sucio" (code smells), y riesgos potenciales relacionados con la privacidad de los datos. Incluye auditoría de rendimiento y dependencias.

## Cuándo usar esta habilidad

- Antes de realizar un despliegue a producción.
- Para asegurar cumplimiento normativo (GDPR) en el manejo de datos.
- Para detectar cuellos de botella de rendimiento (Re-renders excesivos, queries lentas).
- Para validar la seguridad de las dependencias (`npm audit`).

## Cómo usar esta habilidad (Protocolo)

### 1. Fase de Análisis Automático
Utiliza estos patrones para identificar riesgos rápidamente:
- **Secretos:** `(password|passwd|pwd|secret|key|token|access_key|api_key|private|credential)[\s\w]*[:=]\s*["'][^"']{4,}["']`
- **Logs Sensibles:** `console\.(log|info|debug)\(.*(user|password|email|phone|address|token).*\)`
- **Vulnerabilidades Comunes:** Busca inyecciones SQL (`query\(.*${.*\)`), eval inseguro (`eval\(.*\)`), o falta de sanitización.

### 2. Ejecución y Clasificación
Analiza el código manualmente basándote en los resultados automáticos:
1.  **Rendimiento & Scalabilidad:**
    - **React:** Busca `useEffect` sin dependencias o con dependencias inestables que causen loops.
    - **Firestore/Supabase:** Identifica lecturas masivas sin particionar, llamadas de mutación (`addDoc`, `updateDoc`) que no estén en bloques `try/catch`.
2.  **Resiliencia y Offline-First:**
    - Verifica si las mutaciones de base de datos validan `navigator.onLine` o tienen un `catch` para manejar errores de red.
    - Identifica operaciones críticas sin feedback visual (loading state).
3.  **Security de Dependencias:** Revisa el reporte de `npm audit` para vulnerabilidades críticas (CVSS > 7.0).
4.  **Protocolo Auto-Fix y Calidad:**
    - Si encuentras base de datos o API operando sin ID del empleado (`employeeId` faltante) -> **MARCAR COMO BLOQUEANTE**.
    - Si encuentras `console.log` residuales -> **BORRAR**.
    - Si encuentras imports no usados -> **BORRAR**.
    - Si encuentras variables `any` en TypeScript -> **MARCAR** como deuda técnica.

### 3. Reporte de Hallazgos (Template)
Presenta los resultados usando este formato:
```markdown
### 🛡️ Reporte de Auditoría: [Nombre del Proyecto]

| ID | Hallazgo | Riesgo | Recomendación |
|----|----------|--------|---------------|
| 01 | [Desc]   | [H/M/L]| [Acción]      |

**Resumen Ejecutivo:** [1-2 líneas sobre el estado general]
```

## Mejores Prácticas y Restricciones
- **Do:** Priorizar vulnerabilidades que permitan ejecución remota de código (RCE).
- **Don't:** Ignorar advertencias de obsolescencia (deprecation) en dependencias core.
