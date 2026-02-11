
import { getApiBaseUrl } from '../config/apiConfig';

export interface MotivoAusencia {
    IDMotivo: string;
    DescMotivo: string;
    Computable: boolean;
}

export interface CalendarioDia {
    Fecha: string; // YYYY-MM-DD
    TipoDia: "0" | "1" | "2" | string; // "0" = laborable, "1" = festivo, "2" = vacaciones
    DescTipoDia: string;
    IDTipoTurno: string | null;
    DescTurno: string;
    Duracion: number;
    Inicio?: string;
    Fin?: string;
}

export interface Operario {
    IDOperario: number;
    DescOperario: string;
    IDDepartamento: number;
    DescDepartamento: string;
    Activo: boolean;
    Productivo: boolean;
    Flexible: boolean;
}

const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
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

export const getMotivosAusencias = async (): Promise<MotivoAusencia[]> => {
    const baseUrl = getApiBaseUrl();
    const response = await fetchWithTimeout(`${baseUrl}/fichajes/getMotivosAusencias`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching reasons: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
};

/**
 * Actualiza el calendario de un operario (vacaciones, festivos, etc.)
 */
export const updateCalendarioOperario = async (
    idOperario: string,
    fecha: string,
    tipoDia: number | null
): Promise<void> => {
    const baseUrl = getApiBaseUrl();

    // Formatear ID a 3 dígitos (Solmicro standard)
    const idFormateado = idOperario.padStart(3, '0');

    // Convertir fecha de YYYY-MM-DD a DD/MM/YYYY
    const formatDateForApi = (dateStr: string): string => {
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    };

    const payload = {
        idOperario: idFormateado,
        fecha: formatDateForApi(fecha),
        tipoDia: tipoDia
    };

    // console.log('📅 [API] updateCalendarioOperario - Request:', payload);

    const response = await fetchWithTimeout(
        `${baseUrl}/fichajes/updateCalendaOperario`,
        {
            method: 'PUT', // OpenAPI spec says PUT for updateCalendaOperario
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        },
        15000 // 15 segundos de timeout
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] updateCalendarioOperario - ERROR:', response.status, errorText);
        throw new Error(`Error actualizando calendario (${response.status}): ${errorText}`);
    }

    return await response.json();
};


export const getCalendarioEmpresa = async (fechaDesde: string, fechaHasta: string): Promise<CalendarioDia[]> => {
    const baseUrl = getApiBaseUrl();
    const url = new URL(`${baseUrl}/fichajes/getCalendarioEmpresa`);

    // Convert YYYY-MM-DD to DD/MM/YYYY for ERP
    const formatDateForApi = (dateStr: string): string => {
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    };

    url.searchParams.append('fechaDesde', formatDateForApi(fechaDesde));
    url.searchParams.append('fechaHasta', formatDateForApi(fechaHasta));

    const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching calendar: ${response.statusText}`);
    }

    const rawData = await response.json();

    return rawData.map((d: any) => ({
        Fecha: d.Fecha.split(' ')[0], // "YYYY-MM-DD 00:00:00" -> "YYYY-MM-DD"
        TipoDia: d.TipoDia,
        DescTipoDia: d.DescTipoDia || '',
        IDTipoTurno: (!d.IDTipoTurno || d.IDTipoTurno === 'None' || d.IDTipoTurno === '') ? null : d.IDTipoTurno,
        DescTurno: d.DescTurno || '',
        Duracion: parseFloat(d.Duracion) || 0,
        Inicio: d.Inicio,
        Fin: d.Fin
    }));
};

export const getOperarios = async (activo: boolean = true): Promise<Operario[]> => {
    const baseUrl = getApiBaseUrl();

    // Endpoint estándar para obtener operarios
    const response = await fetchWithTimeout(`${baseUrl}/fichajes/getOperarios`, {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching operators: ${response.statusText}`);
    }

    const data: any[] = await response.json();

    return data.map(op => ({
        IDOperario: typeof op.IDOperario === 'string' ? parseInt(op.IDOperario, 10) : op.IDOperario,
        DescOperario: op.DescOperario,
        IDDepartamento: typeof op.IDDepartamento === 'string' ? parseInt(op.IDDepartamento, 10) : op.IDDepartamento,
        DescDepartamento: op.DescDepartamento,
        Activo: op.Activo === true || op.Activo === 1 || op.Activo === 'true',
        Productivo: !([false, 0, '0', 'false', 'FALSE', 'False'].includes(op.Productivo ?? op.productivo)),
        Flexible: op.Flexible === true || op.Flexible === 1 || op.Flexible === 'true' || op.flexible === true
    }));
};

export const getCalendarioOperario = async (idOperario: string, fechaDesde: string, fechaHasta: string): Promise<CalendarioDia[]> => {
    // Sanitización básica: asegurar que idOperario es numérico
    const cleanId = idOperario.replace(/\D/g, '');
    if (!cleanId) throw new Error("ID de operario inválido.");

    const baseUrl = getApiBaseUrl();
    const url = new URL(`${baseUrl}/fichajes/getCalendarioOperario`);

    const formatDateForApi = (dateStr: string): string => {
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    };

    url.searchParams.append('idOperario', cleanId.padStart(3, '0'));
    url.searchParams.append('fechaDesde', formatDateForApi(fechaDesde));
    url.searchParams.append('fechaHasta', formatDateForApi(fechaHasta));

    const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Error fetching individual calendar: ${response.statusText}`);
    }

    const rawData = await response.json();

    return rawData.map((d: any) => ({
        Fecha: d.Fecha.split(' ')[0],
        TipoDia: String(d.TipoDia) as "0" | "1",
        DescTipoDia: d.DescTipoDia || '',
        IDTipoTurno: (!d.IDTipoTurno || d.IDTipoTurno === 'None' || d.IDTipoTurno === '') ? null : d.IDTipoTurno,
        DescTurno: d.DescTurno || '',
        Duracion: parseFloat(d.Duracion) || 0,
        Inicio: d.Inicio,
        Fin: d.Fin
    }));
};

/**
 * Obtiene imputaciones de producción (Costes) filtrando por OF si se desea
 */
export const getControlOfProduccion = async (idOrden: string): Promise<any[]> => {
    const baseUrl = getApiBaseUrl();
    const url = new URL(`${baseUrl}/fichajes/getControlOfProduccion`);

    // Parametro CORRECTO según OpenAPI: 'n_orden'
    url.searchParams.append('n_orden', idOrden);

    const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: {
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Error fetching Control Produccion: ${response.statusText}`);
    }

    return await response.json();
};

/**
 * Obtiene imputaciones por operario
 */
export const getControlOfPorOperario = async (
    idOperario: string,
    fechaDesde: string,
    fechaHasta: string,
    timeoutMs: number = 10000
): Promise<any[]> => {
    const baseUrl = getApiBaseUrl();
    const url = new URL(`${baseUrl}/fichajes/getControlOfPorOperario`);

    // Formatear ID a 3 dígitos (Ej: 56 -> 056)
    const idFormateado = idOperario.padStart(3, '0');

    const formatDateForApi = (dateStr: string): string => {
        if (dateStr.includes('-')) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    };

    // Parámetros CORRECTOS según OpenAPI: id_operario, fecha_inicio, fecha_fin
    url.searchParams.append('id_operario', idFormateado);
    url.searchParams.append('fecha_inicio', formatDateForApi(fechaDesde));
    url.searchParams.append('fecha_fin', formatDateForApi(fechaHasta));

    const response = await fetchWithTimeout(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    }, timeoutMs);

    if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error(`Error fetching Control Operario: ${response.statusText}`);
    }

    return await response.json();
};
