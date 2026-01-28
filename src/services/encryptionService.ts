/**
 * Servicio de Encriptación Básica en Memoria
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

// Clave de sesión (se regenera en cada carga)
const SESSION_KEY = `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;

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
        const base64 = btoa(encrypted);
        return base64;
    } catch (error) {
        logger.error('❌ Error encriptando datos:', error);
        return JSON.stringify(data); // Fallback sin encriptar
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
        logger.error('❌ Error desencriptando datos:', error);
        // Intentar parsear directamente por si no está encriptado
        try {
            return JSON.parse(encrypted);
        } catch {
            return null;
        }
    }
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
