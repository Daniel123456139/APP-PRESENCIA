---
trigger: always_on
---

002 SEGURIDAD API KEYS


escription: Protocolos de seguridad no negociables para proteger la aplicación y los datos.
globs: ["**/*"]

Protocolo de Seguridad Empresarial (Hardened Mode)

La seguridad no es una característica, es la base.

🛡️ Reglas de Oro

Principio de Mínimo Privilegio:

Al crear consultas a Firebase, solicita solo los campos necesarios. No hagas SELECT * si solo necesitas el nombre.

Validación de Entradas (Zero Trust):

Nunca confíes en los datos que vienen del cliente (frontend).

Valida tipos y formatos en el servicio antes de enviarlos a la base de datos.

Sanitiza cualquier input de texto para evitar inyecciones.

Protección de Datos Sensibles (GDPR/LOPD):

Los datos médicos (bajas, diagnósticos) son de alto nivel de protección.

NUNCA los expongas en la URL (ej: app.com/baja?motivo=depresion -> PROHIBIDO).

NUNCA los guardes en localStorage sin encriptación previa, a menos que sea estrictamente temporal para la cola offline.

Gestión de Secretos:

Nunca escribas API Keys o secretos directamente en el código (hardcoded). Usa variables de entorno (import.meta.env en Vite).