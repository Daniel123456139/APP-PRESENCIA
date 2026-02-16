const isDev = import.meta.env.DEV;

const allowInsecureClient =
    String(import.meta.env.VITE_ALLOW_INSECURE_GEMINI_CLIENT || '').toLowerCase() === 'true';

export const getGeminiClientApiKey = (): string => {
    if (!isDev || !allowInsecureClient) return '';
    return String(import.meta.env.VITE_GEMINI_API_KEY || '').trim();
};

export const isGeminiClientEnabled = (): boolean => {
    return getGeminiClientApiKey().length > 0;
};

export const getGeminiDisabledMessage = (): string => {
    return 'IA desactivada en cliente por seguridad. Configura un proxy backend para Gemini.';
};
