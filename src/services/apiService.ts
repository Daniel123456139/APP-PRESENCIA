
import { RawDataRow } from '../types';
import { getApiBaseUrl, getErpUsername } from '../config/apiConfig';

// Convierte YYYY-MM-DD a DD/MM/YYYY para compatibilidad estricta con ERP
const formatDateForApi = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    }
    return dateStr;
};

// Optimización: Parsing de fecha sin Regex si es formato ISO estándar o conocido
const formatApiDateToApp = (dateStr: string): string => {
    if (!dateStr) return '';
    // Formato ISO rápido YYYY-MM-DD
    if (dateStr.length >= 10 && dateStr[4] === '-' && dateStr[7] === '-') {
        return dateStr.substring(0, 10);
    }
    // Formato con T
    if (dateStr.indexOf('T') > 0) return dateStr.split('T')[0];
    // Formato con / (DD/MM/YYYY -> YYYY-MM-DD)
    if (dateStr.indexOf('/') > 0) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    return dateStr.split(' ')[0];
};

const formatApiTimeToApp = (timeStr: string): string => {
    if (!timeStr) return '00:00:00';
    // Fast path para "HH:MM:SS"
    if (timeStr.length === 8 && timeStr[2] === ':' && timeStr[5] === ':') return timeStr;

    let cleanTime = timeStr;
    if (timeStr.includes('T')) cleanTime = timeStr.split('T')[1];
    else if (timeStr.includes(' ')) {
        const parts = timeStr.split(' ');
        cleanTime = parts.length > 1 && parts[1].includes(':') ? parts[1] : timeStr;
    }

    if (cleanTime.length > 8) return cleanTime.substring(0, 8);
    if (cleanTime.length === 5) return `${cleanTime}:00`;
    return cleanTime;
};

// Helper con Timeout para evitar bloqueos
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

export const checkConnection = async (): Promise<boolean> => {
    try {
        await fetchWithTimeout(`${getApiBaseUrl()}/docs`, {
            mode: 'no-cors',
            method: 'GET',
            cache: 'no-store'
        }, 3000);
        return true;
    } catch (error) {
        console.error("Connection check failed:", error);
        return false;
    }
};

export const fetchFichajes = async (
    startDate: string,
    endDate: string,
    idOperario: string = '',
    horaInicio: string = '',
    horaFin: string = ''
): Promise<RawDataRow[]> => {
    try {
        const baseUrl = getApiBaseUrl();
        // CONTRATO A: POST /fichajes/getFichajes
        const payload = {
            fechaDesde: formatDateForApi(startDate),
            fechaHasta: formatDateForApi(endDate),
            idOperario: idOperario,
            ...(horaInicio && { horaInicio }),
            ...(horaFin && { horaFin })
        };


        const response = await fetchWithTimeout(`${baseUrl}/fichajes/getFichajes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }, 30000);

        if (!response.ok) {
            throw new Error(`Error del servidor (${response.status})`);
        }

        const data = await response.json();


        const mappedData = data.map((item: RawDataRow) => ({
            IDControlPresencia: item.IDControlPresencia || 0,
            DescDepartamento: item.DescDepartamento || 'General',
            IDOperario: typeof item.IDOperario === 'string' ? parseInt(item.IDOperario, 10) : item.IDOperario,
            DescOperario: item.DescOperario || 'Desconocido',
            Fecha: formatApiDateToApp(item.Fecha),
            Hora: formatApiTimeToApp(item.Hora),
            Entrada: (item.Entrada === true || item.Entrada === 1 || item.Entrada === '1') ? 1 : 0,
            MotivoAusencia: item.MotivoAusencia ? parseInt(item.MotivoAusencia as string, 10) : null,
            DescMotivoAusencia: item.DescMotivoAusencia || item.DescMotivo || '',
            Computable: (item.Computable === false || item.Computable === 0 || item.Computable === 'No') ? 'No' : 'Sí',
            IDTipoTurno: item.IDTipoTurno ? String(item.IDTipoTurno) : null,
            Inicio: item.Inicio || '',
            Fin: item.Fin || '',
            TipoDiaEmpresa: typeof item.TipoDiaEmpresa === 'number' ? item.TipoDiaEmpresa : (parseInt(item.TipoDiaEmpresa as string, 10) || 0),
            TurnoTexto: item.DescTipoTurno || item.TurnoTexto || ''
        }));

        return mappedData;

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error fetching fichajes:", error.message);
            if (error.name === 'AbortError') {
                throw new Error("El servidor tardó demasiado en responder (Timeout). Intenta reducir el rango de fechas.");
            }
            if (error instanceof TypeError && error.message.includes('fetch')) {
                throw new Error(`No se pudo conectar al servidor en ${getApiBaseUrl()}. Verifica VPN o IP.`);
            }
        }
        throw error;
    }
};

export const insertFichaje = async (fichaje: Partial<RawDataRow>, userName: string = "AppUser") => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("Sin conexión a internet. La operación se ha cancelado o pospuesto.");
    }
    try {
        const baseUrl = getApiBaseUrl();
        const endpoint = `${baseUrl}/fichajes/insertarFichaje`;

        let horaFormat = fichaje.Hora || '00:00:00';
        if (horaFormat.length === 5) horaFormat += ':00';

        // Garantizar que MotivoAusencia es string válido o ""
        const motivo = fichaje.MotivoAusencia !== undefined && fichaje.MotivoAusencia !== null
            ? String(fichaje.MotivoAusencia).padStart(2, '0')
            : "";

        // CONTRATO B: POST /fichajes/insertarFichaje
        const payload = {
            "Entrada": fichaje.Entrada === 1 ? 1 : 0,
            "Fecha": formatDateForApi(fichaje.Fecha || ''),
            "Hora": horaFormat,
            "IDOperario": String(fichaje.IDOperario).padStart(3, '0'),
            "MotivoAusencia": motivo,
            "Usuario": getErpUsername()
        };

        const response = await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }, 20000);

        // Leer el cuerpo de la respuesta
        const responseText = await response.text();

        // 1. Verificación básica de HTTP Status
        if (!response.ok) {
            let errorMsg = `Error ERP (${response.status})`;
            try {
                const data = JSON.parse(responseText);
                errorMsg = data.message || data.Message || data.error || errorMsg;
            } catch (e) {
                if (responseText && responseText.length < 200) errorMsg = responseText;
            }
            throw new Error(errorMsg);
        }

        // 2. Intentar parsear JSON
        let responseData: any = {};
        let isJson = false;
        try {
            responseData = JSON.parse(responseText);
            isJson = true;
        } catch (e) {
            console.warn("⚠️ No se pudo parsear como JSON. Verificando si es error en texto plano...");
        }

        // 3. Verificación Exhaustiva de Errores (Falsos Positivos)

        // A. Si es JSON, buscar flags de error comunes
        if (isJson) {
            // Lista de posibles indicadores de error en el JSON
            const errorIndicators = [
                responseData.status === 'error',
                responseData.Success === false,
                responseData.success === false,
                responseData.Ok === false,
                responseData.ok === false,
                responseData.error === true,
                !!responseData.ExceptionMessage,
                !!responseData.exception
            ];

            if (errorIndicators.some(Boolean)) {
                const errorMsg = responseData.message ||
                    responseData.Message ||
                    responseData.ExceptionMessage ||
                    responseData.error ||
                    'Error reportado por el ERP (sin detalle)';

                console.error("❌ ERP devolvió indicador de error con HTTP 200:", errorMsg);
                throw new Error(`Error ERP: ${errorMsg}`);
            }
        }

        // B. Si NO es JSON o si es JSON pero queremos doble check de texto
        const lowerText = responseText.toLowerCase();
        const suspiciousKeywords = ["error", "exception", "failed", "fallo"];

        // Solo si no es un JSON claro de éxito, miramos el texto
        if (!isJson && suspiciousKeywords.some(kw => lowerText.includes(kw))) {
            console.error("❌ Respuesta sospechosa en texto plano detectada.");
            throw new Error(`Error ERP (Texto sospechoso): ${responseText.substring(0, 100)}...`);
        }

        return responseData || { status: 'ok' };

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("❌ [API] insertFichaje - ERROR:", error.message);
            if (error.name === 'AbortError') {
                throw new Error("Tiempo de espera agotado al guardar en el ERP.");
            }
        }
        throw error;
    }
};

export const uploadFichaje = async (fichaje: Partial<RawDataRow>, userName: string = "AppUser") => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("Sin conexión a internet. La operación se ha cancelado o pospuesto.");
    }
    try {
        const baseUrl = getApiBaseUrl();
        // Validación mínima
        if (!fichaje.IDControlPresencia || !fichaje.IDOperario) {
            throw new Error("IDControlPresencia e IDOperario obligatorios para uploadFichaje.");
        }

        let horaFormat = fichaje.Hora || '00:00:00';
        if (horaFormat.length === 5) horaFormat += ':00';

        // Garantizar que MotivoAusencia es string válido
        const motivo = fichaje.MotivoAusencia !== undefined && fichaje.MotivoAusencia !== null
            ? String(fichaje.MotivoAusencia).padStart(2, '0')
            : "";

        // CONTRATO D: PUT /fichajes/updateFichaje
        // Schema solicitado por el usuario + MotivoAusencia para que grabe el código (ej: 02)
        const payload = {
            "Entrada": fichaje.Entrada === 1 ? 1 : 0,
            "Fecha": formatDateForApi(fichaje.Fecha || ''),
            "Hora": horaFormat,
            "IDControlPresencia": fichaje.IDControlPresencia,
            "IDOperario": String(fichaje.IDOperario).padStart(3, '0'),
            "MotivoAusencia": motivo,
            "Usuario": userName
        };

        // console.log("📤 [API] uploadFichaje Payload:", payload);

        // CORRECCIÓN: El usuario confirmó por pantallazo que el endpoint real es 'updateFichaje'
        const response = await fetchWithTimeout(`${baseUrl}/fichajes/updateFichaje`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }, 20000);

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Error ERP (${response.status}): ${responseText}`);
        }

        let responseData: Record<string, unknown> = {};
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.warn("⚠️ uploadFichaje response not JSON:", responseText);
        }

        return responseData || { status: 'ok', message: responseText };

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("❌ [API] uploadFichaje Error:", error.message);
            if (error.name === 'AbortError') throw new Error("Timeout en uploadFichaje.");
        }
        throw error;
    }
};

export const updateFichaje = async (fichaje: Partial<RawDataRow>, userName: string = "AppUser") => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("Sin conexión a internet. La operación se ha cancelado o pospuesto.");
    }
    try {
        const baseUrl = getApiBaseUrl();
        if (!fichaje.IDControlPresencia || !fichaje.IDOperario) {
            throw new Error("IDControlPresencia e IDOperario obligatorios para actualizar.");
        }

        let horaFormat = fichaje.Hora || '00:00:00';
        if (horaFormat.length === 5) horaFormat += ':00';

        // Garantizar que MotivoAusencia es string válido
        const motivo = fichaje.MotivoAusencia !== undefined && fichaje.MotivoAusencia !== null
            ? String(fichaje.MotivoAusencia).padStart(2, '0')
            : "";

        // CONTRATO C: PUT /fichajes/updateFichaje
        const payload = {
            "Entrada": fichaje.Entrada === 1 ? 1 : 0,
            "Fecha": formatDateForApi(fichaje.Fecha || ''),
            "Hora": horaFormat,
            "IDControlPresencia": fichaje.IDControlPresencia,
            "IDOperario": String(fichaje.IDOperario).padStart(3, '0'),
            "MotivoAusencia": motivo,
            "Usuario": userName
        };

        const response = await fetchWithTimeout(`${baseUrl}/fichajes/updateFichaje`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        }, 20000);

        const responseText = await response.text();

        // 1. Verificación básica de HTTP Status
        // 2. Intentar parsear JSON
        let responseData: Record<string, unknown> = {};
        let isJson = false;
        try {
            responseData = JSON.parse(responseText);
            isJson = true;
        } catch (e) {
            // Fallback a objeto vacío si no se puede parsear
        }

        // 3. Verificación Exhaustiva de Errores (Falsos Positivos)
        if (isJson) {
            const errorIndicators = [
                responseData.status === 'error',
                responseData.Success === false,
                responseData.success === false,
                responseData.Ok === false,
                responseData.ok === false,
                responseData.error === true,
                !!responseData.ExceptionMessage,
                !!responseData.exception
            ];

            if (errorIndicators.some(Boolean)) {
                const errorMsg = (responseData.message || responseData.Message || responseData.ExceptionMessage || responseData.error || 'Error reportado por el ERP') as string;
                throw new Error(`Error ERP: ${errorMsg}`);
            }
        }

        const lowerText = responseText.toLowerCase();
        const suspiciousKeywords = ["error", "exception", "failed", "fallo"];
        if (!isJson && suspiciousKeywords.some(kw => lowerText.includes(kw))) {
            throw new Error(`Error ERP (Texto sospechoso): ${responseText.substring(0, 100)}...`);
        }

        return responseData || { status: 'ok' };
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error("Tiempo de espera agotado al actualizar en el ERP.");
            }
        }
        throw error;
    }
};

export const deleteFichajesRange = async (idOperario: number, motivoId: number, fechaInicio: string, fechaFin: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error("Sin conexión a internet. La operación se ha cancelado o pospuesto.");
    }
    try {
        const baseUrl = getApiBaseUrl();
        // Coherencia con el formato estricto: Strings para IDs y fechas españolas
        const payload = {
            idOperario: String(idOperario),
            motivoAusencia: String(motivoId),
            fechaInicio: formatDateForApi(fechaInicio),
            fechaFin: formatDateForApi(fechaFin)
        };

        const response = await fetchWithTimeout(`${baseUrl}/fichajes/borrarRango`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 20000);

        if (!response.ok && response.status !== 404) {
            throw new Error(`Error al borrar rango (${response.status})`);
        }
        return true;
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                throw new Error("Timeout al borrar rango.");
            }
        }
        throw error;
    }
};
