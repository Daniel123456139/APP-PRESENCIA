/**
 * Logger Utility - Condicional basado en entorno
 * 
 * En desarrollo: Muestra todos los logs
 * En producción: Silencia logs excepto errores críticos
 */

const isDev = import.meta.env.DEV;

export const logger = {
    /**
     * Log informativo - Solo en desarrollo
     */
    log: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    /**
     * Warning - Solo en desarrollo
     */
    warn: (...args: any[]) => {
        if (isDev) {
            console.warn(...args);
        }
    },

    /**
     * Error - Siempre se muestra (incluso en producción)
     */
    error: (...args: any[]) => {
        console.error(...args);
    },

    /**
     * Error crítico - Siempre se muestra y podría enviarse a servicio de monitoreo
     */
    critical: (...args: any[]) => {
        console.error('[CRITICAL]', ...args);
        // TODO: Enviar a servicio de monitoreo (ej: Sentry, Firebase Crashlytics)
    },

    /**
     * Debug - Solo en desarrollo
     */
    debug: (...args: any[]) => {
        if (isDev) {
            console.debug(...args);
        }
    },

    /**
     * Info con emoji - Solo en desarrollo
     */
    info: (emoji: string, ...args: any[]) => {
        if (isDev) {
            console.log(emoji, ...args);
        }
    },

    /**
     * Success log con emoji - Solo en desarrollo  
     */
    success: (...args: any[]) => {
        if (isDev) {
            console.log('✅', ...args);
        }
    }
};

export default logger;
