
import { RawDataRow } from '../types';
import { normalizeDateKey, extractTimeHHMM, extractTimeHHMMSS } from '../utils/datetime';
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

const normalizeDateInput = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('T')) return dateStr.split('T')[0];
    if (dateStr.includes(' ')) return dateStr.split(' ')[0];
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

const formatTimeForApi = (timeStr: string): string => {
    if (!timeStr) return '';
    let cleanTime = timeStr;
    if (cleanTime.includes('T')) cleanTime = cleanTime.split('T')[1];
    else if (cleanTime.includes(' ')) {
        const parts = cleanTime.split(' ');
        cleanTime = parts.length > 1 && parts[1].includes(':') ? parts[1] : cleanTime;
    }
    if (cleanTime.length === 5) return `${cleanTime}:00`;
    if (cleanTime.length >= 8) return cleanTime.substring(0, 8);
    return cleanTime;
};

const sanitizeServerError = (value: string, maxLen = 140): string => {
    if (!value) return 'Error ERP';
    const clean = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return 'Error ERP';
    return clean.substring(0, maxLen);
};

const parseEntradaFlag = (value: unknown): 0 | 1 => {
    if (value === true || value === 1 || value === -1) return 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', '-1', 'true', 'si', 'sí', 's', 'x'].includes(normalized)) return 1;
    }
    return 0;
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
        const cleanStart = normalizeDateInput(startDate);
        const cleanEnd = normalizeDateInput(endDate);
        if (!cleanStart || !cleanEnd) {
            return [];
        }
        const dateVariants = [
            {
                fechaDesde: formatDateForApi(cleanStart),
                fechaHasta: formatDateForApi(cleanEnd)
            }
        ];

        const idVariants: Array<{ idOperario?: string | number }> = [];
        if (idOperario) {
            const cleanId = idOperario.toString().replace(/\D/g, '');
            idVariants.push({ idOperario: cleanId.padStart(3, '0') });
            if (cleanId !== idOperario) {
                idVariants.push({ idOperario });
            }
        } else {
            idVariants.push({});
            idVariants.push({ idOperario: 0 });
            idVariants.push({ idOperario: '0' });
            idVariants.push({ idOperario: '000' });
        }

        const timeStart = formatTimeForApi(horaInicio);
        const timeEnd = formatTimeForApi(horaFin);
        const timeVariants: Array<{ horaInicio?: string; horaFin?: string }> = [];

        if (timeStart || timeEnd) {
            timeVariants.push({
                ...(timeStart && { horaInicio: timeStart }),
                ...(timeEnd && { horaFin: timeEnd })
            });

            if (horaFin && horaFin.startsWith('23:59') && timeEnd.endsWith(':00')) {
                timeVariants.push({
                    ...(timeStart && { horaInicio: timeStart }),
                    horaFin: '23:59:59'
                });
            }

            const shortStart = timeStart ? timeStart.substring(0, 5) : '';
            const shortEnd = timeEnd ? timeEnd.substring(0, 5) : '';
            if (shortStart !== timeStart || shortEnd !== timeEnd) {
                timeVariants.push({
                    ...(shortStart && { horaInicio: shortStart }),
                    ...(shortEnd && { horaFin: shortEnd })
                });
            }
        } else {
            timeVariants.push({});
        }

        let data: any = null;
        let lastStatus = 0;

        for (let d = 0; d < dateVariants.length; d++) {
            for (let id = 0; id < idVariants.length; id++) {
                for (let i = 0; i < timeVariants.length; i++) {
                    const payload: any = {
                        ...dateVariants[d],
                        ...idVariants[id],
                        ...timeVariants[i]
                    };
                    if (!payload.horaInicio) delete payload.horaInicio;
                    if (!payload.horaFin) delete payload.horaFin;

                    const response = await fetchWithTimeout(`${baseUrl}/fichajes/getFichajes`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    }, 60000);

                    if (!response.ok) {
                        lastStatus = response.status;
                        if (response.status === 422) {
                            if (d < dateVariants.length - 1 || id < idVariants.length - 1 || i < timeVariants.length - 1) {
                                continue;
                            }
                            const errorText = await response.text();
                            throw new Error(`Error del servidor (${response.status}): ${sanitizeServerError(errorText, 200)}`);
                        }
                        throw new Error(`Error del servidor (${response.status})`);
                    }

                    data = await response.json();
                    if (Array.isArray(data) && data.length === 0) {
                        if (d < dateVariants.length - 1 || id < idVariants.length - 1 || i < timeVariants.length - 1) {
                            continue;
                        }
                    }
                    break;
                }
                if (data) break;
            }
            if (data) break;
        }

        if (!data) {
            throw new Error(`Error del servidor (${lastStatus || 422})`);
        }


        const mappedData = data.map((item: any) => {
            const motivoRaw = item.MotivoAusencia;
            const motivo = (motivoRaw === null || motivoRaw === undefined || motivoRaw === '')
                ? null
                : parseInt(String(motivoRaw), 10);

            const parsedEntrada = parseEntradaFlag(item.Entrada);
            const descMotivo = item.DescMotivoAusencia || item.DescMotivo || '';

            // Fallback robusto: algunos entornos ERP devuelven "Entrada" en formatos no estandar.
            // Si no hay motivo de salida y no hay descripcion de motivo, tratarlo como ENTRADA.
            const entrada = parsedEntrada === 1
                ? 1
                : ((motivo === null || motivo === 0) && !descMotivo ? 1 : 0);

            return {
                IDControlPresencia: item.IDControlPresencia || 0,
                DescDepartamento: item.DescDepartamento || 'General',
                IDOperario: typeof item.IDOperario === 'string' ? parseInt(item.IDOperario, 10) : item.IDOperario,
                DescOperario: item.DescOperario || 'Desconocido',
                Fecha: normalizeDateKey(formatApiDateToApp(item.Fecha)),
                Hora: extractTimeHHMMSS(formatApiTimeToApp(item.Hora)),
                Entrada: entrada,
                MotivoAusencia: Number.isNaN(motivo as number) ? null : motivo,
                DescMotivoAusencia: descMotivo,
                Computable: (item.Computable === false || item.Computable === 0 || item.Computable === 'No') ? 'No' : 'Sí',
                IDTipoTurno: item.IDTipoTurno ? String(item.IDTipoTurno) : null,
                Inicio: extractTimeHHMM(item.Inicio || ''),
                Fin: extractTimeHHMM(item.Fin || ''),
                TipoDiaEmpresa: typeof item.TipoDiaEmpresa === 'number' ? item.TipoDiaEmpresa : (parseInt(item.TipoDiaEmpresa as string, 10) || 0),
                TurnoTexto: item.DescTipoTurno || item.TurnoTexto || ''
            };
        });

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

const toIsoDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number): Date => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
};

const diffDays = (start: string, end: string): number => {
    try {
        const s = new Date(`${start}T00:00:00`);
        const e = new Date(`${end}T23:59:59`);
        const diffMs = Math.abs(e.getTime() - s.getTime());
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    } catch {
        return 0;
    }
};

export const fetchFichajesBatched = async (
    startDate: string,
    endDate: string,
    idOperario: string = '',
    horaInicio: string = '',
    horaFin: string = '',
    batchDays = 7 // Optimizado para semanas
): Promise<RawDataRow[]> => {
    if (!startDate || !endDate) return [];

    const getDaysDiff = (s: string, e: string) => {
        const d1 = new Date(`${s}T00:00:00`);
        const d2 = new Date(`${e}T23:59:59`);
        return Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    };

    const normalizeChunkError = (err: unknown): string => {
        if (err instanceof Error) return err.message;
        return 'Error desconocido obteniendo bloque de fichajes';
    };

    const chunkRowsByHalf = (chunk: { start: string; end: string }): { start: string; end: string }[] => {
        const start = new Date(`${chunk.start}T00:00:00`);
        const end = new Date(`${chunk.end}T00:00:00`);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) {
            return [chunk];
        }

        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (totalDays <= 1) return [chunk];

        const midDays = Math.max(1, Math.floor(totalDays / 2));
        const mid = addDays(start, midDays - 1);
        const secondStart = addDays(mid, 1);

        return [
            { start: toIsoDate(start), end: toIsoDate(mid) },
            { start: toIsoDate(secondStart), end: toIsoDate(end) }
        ];
    };

    const fetchChunkWithRetry = async (chunk: { start: string; end: string }, retries = 2): Promise<RawDataRow[]> => {
        let lastError: unknown;
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                return await fetchFichajes(chunk.start, chunk.end, idOperario, horaInicio, horaFin);
            } catch (err) {
                lastError = err;
                if (attempt < retries) {
                    const waitMs = 400 * Math.pow(2, attempt);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                }
            }
        }
        throw new Error(normalizeChunkError(lastError));
    };

    const dedupeRows = (rows: RawDataRow[]): RawDataRow[] => {
        const seen = new Set<string>();
        const unique: RawDataRow[] = [];
        for (const row of rows) {
            const key = row.IDControlPresencia && row.IDControlPresencia > 0
                ? `id:${row.IDControlPresencia}`
                : `k:${row.IDOperario}|${row.Fecha}|${row.Hora}|${row.Entrada}|${row.MotivoAusencia ?? ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            unique.push(row);
        }

        unique.sort((a, b) => {
            if (a.Fecha !== b.Fecha) return a.Fecha.localeCompare(b.Fecha);
            const t = a.Hora.localeCompare(b.Hora);
            if (t !== 0) return t;
            return Number(a.IDOperario) - Number(b.IDOperario);
        });

        return unique;
    };

    const totalDays = getDaysDiff(startDate, endDate);

    // Si es un rango pequeño, llamada normal
    if (totalDays <= batchDays) {
        return fetchFichajes(startDate, endDate, idOperario, horaInicio, horaFin);
    }

    // Generar chunks
    const chunks: { start: string; end: string }[] = [];
    let cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);

    while (cursor <= end) {
        const chunkStart = toIsoDate(cursor);
        let chunkEndObj = addDays(cursor, batchDays - 1);
        if (chunkEndObj > end) chunkEndObj = end;
        const chunkEnd = toIsoDate(chunkEndObj);

        chunks.push({ start: chunkStart, end: chunkEnd });
        cursor = addDays(chunkEndObj, 1);
    }

    const results: RawDataRow[] = [];
    const CONCURRENCY_LIMIT = 1; // Priorizar estabilidad sobre velocidad
    const failedChunks: Array<{ chunk: { start: string; end: string }; error: string }> = [];

    // Execute chunks with throttling
    for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
        const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
        const promises = batch.map(chunk =>
            fetchChunkWithRetry(chunk)
                .catch(err => {
                    const message = normalizeChunkError(err);
                    console.error(`Error fetching batch ${chunk.start}-${chunk.end}:`, message);
                    failedChunks.push({ chunk, error: message });
                    return null;
                })
        );

        const batchResults = await Promise.all(promises);
        batchResults.forEach(r => {
            if (r) results.push(...r);
        });

        if (i + CONCURRENCY_LIMIT < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Delay aumentado
        }
    }

    if (failedChunks.length > 0) {
        const recovered = await Promise.all(failedChunks.map(async ({ chunk }) => {
            const halfChunks = chunkRowsByHalf(chunk);
            const partial: RawDataRow[] = [];

            for (const half of halfChunks) {
                try {
                    const rows = await fetchChunkWithRetry(half, 1);
                    partial.push(...rows);
                } catch (err) {
                    throw new Error(`Bloque ${half.start} -> ${half.end}: ${normalizeChunkError(err)}`);
                }
            }

            return partial;
        }));

        recovered.forEach(rows => results.push(...rows));
    }

    if (results.length === 0 && chunks.length > 0) {
        throw new Error('No se pudo obtener información del periodo solicitado desde Swagger. Verifica conexión y vuelve a intentar.');
    }

    return dedupeRows(results);
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
            throw new Error(`Error ERP (Texto sospechoso): ${sanitizeServerError(responseText, 100)}...`);
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
            throw new Error(`Error ERP (${response.status}): ${sanitizeServerError(responseText, 180)}`);
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
            throw new Error(`Error ERP (Texto sospechoso): ${sanitizeServerError(responseText, 100)}...`);
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
