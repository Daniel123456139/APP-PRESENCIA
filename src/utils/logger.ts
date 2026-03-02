/**
 * Logger Utility - Profesional y Colorido
 * 
 * En desarrollo: Muestra todos los logs con formato y colores.
 * En producción: Solo errores críticos.
 */

const isDev = import.meta.env.DEV;

// Colores ANSI para la terminal si se soporta, 
// o estilos CSS para la consola del navegador
const COLORS = {
    info: 'color: #10b981; font-weight: bold;', // Esmeralda
    warn: 'color: #f59e0b; font-weight: bold;', // Ámbar
    error: 'color: #ef4444; font-weight: bold;', // Rojo
    debug: 'color: #6366f1; font-weight: bold;', // Índigo
    timestamp: 'color: #6b7280; font-weight: normal;' // Gris
};

const getTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0]; // HH:MM:SS
};

const formatMessage = (level: string, emoji: string, message: string, context?: any) => {
    const timestamp = getTimestamp();
    const style = COLORS[level as keyof typeof COLORS] || '';

    if (isDev) {
        console.log(
            `%c[${timestamp}] %c${emoji} [${level.toUpperCase()}] %c${message}`,
            COLORS.timestamp,
            '',
            style,
            context ? '\nContexto:' : '',
            context || ''
        );
    } else if (level === 'error' || level === 'critical') {
        console.error(`[${timestamp}] ${emoji} [${level.toUpperCase()}] ${message}`, context || '');
    }
};

export const logger = {
    info: (message: string, context?: any) => {
        formatMessage('info', '🟢', message, context);
    },

    warn: (message: string, context?: any) => {
        formatMessage('warn', '🟡', message, context);
    },

    error: (message: string, context?: any) => {
        const timestamp = getTimestamp();
        console.error(
            `%c[${timestamp}] %c🔴 [ERROR] %c${message}`,
            COLORS.timestamp,
            '',
            COLORS.error,
            context ? '\nContexto:' : '',
            context || ''
        );
        // Posibilidad de enviar a servidor externo en el futuro:
        /*
        enviarErrorAServidor({
            timestamp,
            message,
            context,
            stack: new Error().stack
        });
        */
    },

    critical: (message: string, context?: any) => {
        const timestamp = getTimestamp();
        console.error(
            `%c[${timestamp}] %c🚨 [CRITICAL] %c${message}`,
            COLORS.timestamp,
            '',
            'color: #ffffff; background-color: #ef4444; padding: 2px 4px; border-radius: 2px; font-weight: bold;',
            context || ''
        );
    },

    debug: (message: string, context?: any) => {
        if (isDev) {
            formatMessage('debug', '🔍', message, context);
        }
    },

    success: (message: string, context?: any) => {
        formatMessage('info', '✅', message, context);
    }
};

export default logger;

