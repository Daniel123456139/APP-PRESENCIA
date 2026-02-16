/**
 * Servicio de Encriptación Básica en Memoria y Persistencia
 * 
 * ADVERTENCIA:
 * - Esto NO es encriptación de grado militar
 * - Solo ofuscación básica para evitar inspección casual en DevTools
 * - La clave está en el código (NO es segura al 100%)
 * - Use HTTPS + Security Rules + Backend encryption para verdadera seguridad
 * 
 * @module encryptionService
 */

import logger from '../utils/logger';

// Clave de sesión (se regenera en cada carga) - Para datos volátiles
const SESSION_KEY = `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;

// Clave persistente (Para LocalStorage que debe sobrevivir a recargas)
// Se debe definir VITE_STORAGE_KEY en .env
const deriveFallbackStorageKey = (): string => {
    const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : 'unknown-origin';
    const agent = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'unknown-agent';
    return `fallback_${simpleHash(`${origin}|${agent}`)}`;
};

const PERSISTENT_KEY = String(import.meta.env.VITE_STORAGE_KEY || '').trim() || deriveFallbackStorageKey();

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════════════════════════════════

/**
 * Encriptar datos con XOR simple + Base64
 * Suficiente para ofuscar datos en sessionStorage/memory
 */
export function encryptData(data: any, customKey?: string): string {
    try {
        const key = customKey || SESSION_KEY;
        const jsonString = JSON.stringify(data);

        // XOR cada carácter con la clave
        let encrypted = '';
        for (let i = 0; i < jsonString.length; i++) {
            const charCode = jsonString.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            encrypted += String.fromCharCode(charCode);
        }

        // Convertir a Base64 para que sea almacenable
        return btoa(encrypted);
    } catch (error) {
        logger.error('❌ Error encriptando datos:', error);
        return '';
    }
}

/**
 * Desencriptar datos
 */
export function decryptData(encrypted: string, customKey?: string): any {
    try {
        const key = customKey || SESSION_KEY;

        // Decodificar Base64
        const decrypted = atob(encrypted);

        // XOR inverso
        let jsonString = '';
        for (let i = 0; i < decrypted.length; i++) {
            const charCode = decrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length);
            jsonString += String.fromCharCode(charCode);
        }

        return JSON.parse(jsonString);
    } catch (error) {
        // Silencioso si falla desencriptación (puede ser dato corrupto o no encriptado)
        return null;
    }
}

/**
 * Helper específico para Storage Persistente (LocalStorage)
 * Usa la clave PERSISTENT_KEY
 */
export function encryptStorageData(data: any): string {
    return encryptData(data, PERSISTENT_KEY);
}

/**
 * Helper específico para Storage Persistente con migración legacy
 * Intenta desencriptar con PERSISTENT_KEY. Si falla, intenta parsear como JSON plano (migración suave).
 */
export function decryptStorageData(rawData: string | null): any {
    if (!rawData) return null;

    // 1. Intentar desencriptar
    const decrypted = decryptData(rawData, PERSISTENT_KEY);
    if (decrypted !== null) return decrypted;

    // 2. Fallback: Intentar leer JSON plano (datos antiguos antes del parche de seguridad)
    try {
        // Verificación rápida: si parece base64 pero falló decrypt, puede ser basura.
        // Si empieza por [ o { es probable que sea JSON plano.
        if (rawData.trim().startsWith('[') || rawData.trim().startsWith('{')) {
            return JSON.parse(rawData);
        }
    } catch (e) {
        // Ignorar
    }

    return null;
}

/**
 * Generar hash simple de un string (NO criptográfico)
 * Útil para comparaciones rápidas
 */
export function simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Limpiar datos sensibles de memoria
 * Sobrescribe el objeto con valores vacíos
 */
export function sanitizeObject<T extends object>(obj: T): void {
    try {
        Object.keys(obj).forEach(key => {
            (obj as any)[key] = null;
        });
    } catch (error) {
        // Silenciar errores de propiedades read-only
    }
}

// ═══════════════════════════════════════════════════════════════════
// CACHE ENCRIPTADO
// ═══════════════════════════════════════════════════════════════════

/**
 * Guardar datos en sessionStorage encriptados
 */
export function setEncryptedCache(key: string, data: any): void {
    try {
        const encrypted = encryptData(data);
        sessionStorage.setItem(key, encrypted);
    } catch (error) {
        logger.warn('⚠️ No se pudo guardar cache encriptado:', error);
    }
}

/**
 * Obtener datos de sessionStorage y desencriptar
 */
export function getEncryptedCache(key: string): any | null {
    try {
        const encrypted = sessionStorage.getItem(key);
        if (!encrypted) return null;

        return decryptData(encrypted);
    } catch (error) {
        logger.warn('⚠️ No se pudo leer cache encriptado:', error);
        return null;
    }
}

/**
 * Limpiar cache encriptado
 */
export function clearEncryptedCache(key?: string): void {
    try {
        if (key) {
            sessionStorage.removeItem(key);
        } else {
            // Limpiar solo claves que parecen cache de empleados
            for (let i = 0; i < sessionStorage.length; i++) {
                const storageKey = sessionStorage.key(i);
                if (storageKey?.startsWith('employees_') || storageKey?.startsWith('profile_')) {
                    sessionStorage.removeItem(storageKey);
                }
            }
        }
    } catch (error) {
        logger.warn('⚠️ Error limpiando cache:', error);
    }
}
