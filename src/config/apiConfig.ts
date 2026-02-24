
import { API_BASE_URL } from '../constants';

export const getApiBaseUrl = (): string => {
    const isProd = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.PROD;
    const defaultProxyUrl = API_BASE_URL;
    const enforceProtocol = (url: string): string => {
        if (!url) return url;
        let clean = url.trim();
        if (clean.endsWith('/')) clean = clean.slice(0, -1);
        if (clean.startsWith('/')) return clean;
        if (isProd && clean.startsWith('http://')) {
            clean = `https://${clean.slice('http://'.length)}`;
        }
        return clean;
    };

    // 1. Local Storage (Configuración manual tiene prioridad alta)
    try {
        const stored = localStorage.getItem('apiBaseUrl');
        if (stored && !isProd) {
            const normalizedStored = stored.trim().replace(/\/$/, '');
            const isLegacyDirectErp = /10\.0\.0\.19:8000(?:\/api)?$/i.test(normalizedStored);
            if (isLegacyDirectErp) return defaultProxyUrl;
            return enforceProtocol(stored);
        }
    } catch (e) {
        // Ignorar errores de acceso a localStorage
    }

    // 2. Variable de entorno (Vite)
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        // @ts-ignore
        const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || defaultProxyUrl;
        if (envUrl) {
            return enforceProtocol(envUrl);
        }
    }

    // 3. Fallback por defecto
    return defaultProxyUrl;
};

export const setApiBaseUrl = (url: string) => {
    try {
        const isProd = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.PROD;
        let cleanUrl = url.trim();
        // Quitar barra final si existe
        if (cleanUrl.endsWith('/')) {
            cleanUrl = cleanUrl.slice(0, -1);
        }
        // Validar protocolo
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = (isProd ? 'https://' : 'http://') + cleanUrl;
        }

        if (isProd && cleanUrl.startsWith('http://')) {
            cleanUrl = 'https://' + cleanUrl.slice('http://'.length);
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
