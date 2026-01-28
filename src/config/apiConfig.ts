
export const getApiBaseUrl = (): string => {
    // 1. Local Storage (Configuración manual tiene prioridad alta)
    try {
        const stored = localStorage.getItem('apiBaseUrl');
        if (stored) return stored;
    } catch (e) {
        // Ignorar errores de acceso a localStorage
    }

    // 2. Variable de entorno (Vite)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
        // @ts-ignore
        return import.meta.env.VITE_API_URL;
    }

    // 3. Fallback por defecto
    return 'http://10.0.0.19:8000';
};

export const setApiBaseUrl = (url: string) => {
    try {
        let cleanUrl = url.trim();
        // Quitar barra final si existe
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }
        // Validar protocolo
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'http://' + cleanUrl;
        }

        localStorage.setItem('apiBaseUrl', cleanUrl);
        // Notificar cambio a la app
        window.dispatchEvent(new Event('apiBaseUrlChanged'));
    } catch (e) {
        console.error("Error guardando API URL", e);
    }
};

export const clearApiBaseUrl = () => {
    try {
        localStorage.removeItem('apiBaseUrl');
        window.dispatchEvent(new Event('apiBaseUrlChanged'));
    } catch (e) {
        console.error("Error limpiando API URL", e);
    }
};

// --- Configuración del Usuario ERP (dominio\usuario) ---
// Ejemplo correcto del API: "favram\a.obregon" (una sola barra invertida)
const DEFAULT_ERP_USERNAME = 'favram\\facturas';

export const getErpUsername = (): string => {
    try {
        const stored = localStorage.getItem('erpUsername');
        if (stored) {
            // Normalizar: si el usuario escribió doble barra, convertir a simple
            return stored.replace(/\\\\/g, '\\');
        }
    } catch (e) {
        // Ignorar errores
    }
    return DEFAULT_ERP_USERNAME;
};

export const setErpUsername = (username: string) => {
    try {
        // Normalizar: convertir doble barra a simple antes de guardar
        const normalized = username.trim().replace(/\\\\/g, '\\');
        localStorage.setItem('erpUsername', normalized);
        console.log('ERP Username guardado:', normalized);
    } catch (e) {
        console.error("Error guardando ERP Username", e);
    }
};

export const clearErpUsername = () => {
    try {
        localStorage.removeItem('erpUsername');
    } catch (e) {
        console.error("Error limpiando ERP Username", e);
    }
};
