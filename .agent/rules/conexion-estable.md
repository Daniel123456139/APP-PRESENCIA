---
trigger: always_on
---

008 MANEJO RED

description: Protocolos obligatorios para el manejo de red, detección de estado online/offline y persistencia de datos.
globs: ["src/services//*", "src/hooks//", "src/components/**/"]

Protocolo de Estabilidad de Conexión (Offline-First)

La aplicación se utiliza en entornos industriales donde la conexión puede ser inestable. Tu prioridad #1 es la integridad de los datos.

1. Verificación de Estado (Network Guard)

Antes de cualquier operación de escritura (POST, PUT, DELETE o mutación en Firebase):

DEBES verificar explícitamente navigator.onLine.

Si es false, DETÉN el envío a la API y redirige el dato a la Cola Offline (LocalStorage/IndexedDB).

Notifica al usuario visualmente (ej: "Sin conexión. Guardado en dispositivo.").

2. Listeners de Conexión

Usa siempre listeners globales (window.addEventListener('online'/'offline')) para actualizar el estado de la UI en tiempo real.

Al recuperar la conexión (online), dispara automáticamente el Workflow de Sincronización.

3. Manejo de Errores de Red

Nunca trates un error de red (timeout, DNS) como un error de lógica.

Implementa Exponential Backoff para reintentos automáticos en peticiones críticas (1s, 2s, 4s...).

Si una escritura falla por red, no descartes el dato: envíalo a la cola de reintentos.

4. Feedback Visual

El usuario debe saber SIEMPRE si está trabajando offline.

Usa indicadores no intrusivos (iconos de estado) pero claros.