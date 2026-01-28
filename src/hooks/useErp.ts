
import { useState, useEffect, useCallback } from 'react';
import { getMotivosAusencias, getCalendarioEmpresa, getOperarios, MotivoAusencia, CalendarioDia, Operario } from '../services/erpApi';

// Simple in-memory cache
const cache = {
    motivos: null as MotivoAusencia[] | null,
    operarios: null as Operario[] | null,
    calendario: new Map<string, CalendarioDia[]>() // key: `${start}-${end}`
};

export const useMotivos = () => {
    const [motivos, setMotivos] = useState<MotivoAusencia[]>(cache.motivos || []);
    const [loading, setLoading] = useState(!cache.motivos);
    const [error, setError] = useState<string | null>(null);

    const fetchMotivos = useCallback(async (force = false) => {
        if (!force && cache.motivos) {
            setMotivos(cache.motivos);
            return;
        }
        setLoading(true);
        try {
            const data = await getMotivosAusencias();
            cache.motivos = data;
            setMotivos(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchMotivos();
    }, [fetchMotivos]);

    return { motivos, loading, error, refresh: () => fetchMotivos(true) };
};

export const useOperarios = (onlyActive = true) => {
    const [operarios, setOperarios] = useState<Operario[]>(cache.operarios || []);
    const [loading, setLoading] = useState(!cache.operarios);
    const [error, setError] = useState<string | null>(null);

    const fetchOperarios = useCallback(async (force = false) => {
        if (!force && cache.operarios) {
            setOperarios(cache.operarios);
            return;
        }
        setLoading(true);
        try {
            const data = await getOperarios();
            cache.operarios = data;
            setOperarios(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOperarios();
    }, [fetchOperarios]);

    // Filtrado mejorado: Excluir inactivos, empleados con "zzz" y ID 999
    const filteredOperarios = operarios.filter(op => {
        // Excluir ID 999
        if (op.IDOperario === 999) return false;

        // Excluir empleados con "zzz" en descripción (dormidos/inactivos)
        if (op.DescOperario?.toLowerCase().includes('zzz')) return false;

        // Si onlyActive está activado, también filtrar por campo Activo
        if (onlyActive && !op.Activo) return false;

        return true;
    });

    return { operarios: filteredOperarios, loading, error, refresh: () => fetchOperarios(true) };

};

export const useCalendario = (startDate: string, endDate: string) => {
    const [calendario, setCalendario] = useState<CalendarioDia[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCalendario = useCallback(async (start: string, end: string, force = false) => {
        const key = `${start}-${end}`;
        if (!force && cache.calendario.has(key)) {
            setCalendario(cache.calendario.get(key)!);
            return;
        }

        setLoading(true);
        try {
            const data = await getCalendarioEmpresa(start, end);
            cache.calendario.set(key, data);
            setCalendario(data);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (startDate && endDate) {
            fetchCalendario(startDate, endDate);
        }
    }, [startDate, endDate, fetchCalendario]);

    return { calendario, loading, error, refresh: () => fetchCalendario(startDate, endDate, true) };
};
