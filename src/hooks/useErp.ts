import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getMotivosAusencias, getCalendarioEmpresa, getOperarios, MotivoAusencia, CalendarioDia, Operario } from '../services/erpApi';
import { useMemo } from 'react';

// --- Keys ---
export const ERP_KEYS = {
    motivos: ['motivos'] as const,
    operarios: ['operarios'] as const,
    calendario: (start: string, end: string) => ['calendario', { start, end }] as const,
};

// --- Hooks ---

export const useMotivos = () => {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ERP_KEYS.motivos,
        queryFn: getMotivosAusencias,
        staleTime: 1000 * 60 * 60 * 24, // 24 horas (datos maestros muy estáticos)
    });

    return {
        motivos: data || [],
        loading: isLoading,
        error: error ? (error as Error).message : null,
        refresh: refetch
    };
};

export const useOperarios = (onlyActive = true) => {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ERP_KEYS.operarios,
        queryFn: () => getOperarios(),
        staleTime: 1000 * 60 * 5, // 5 minutos
    });

    const filteredOperarios = useMemo(() => {
        if (!data) return [];
        return data.filter(op => {
            // Excluir ID 999
            if (op.IDOperario === 999) return false;

            // Excluir empleados con "zzz" en descripción (dormidos/inactivos)
            if (op.DescOperario?.toLowerCase().includes('zzz')) return false;

            // Si onlyActive está activado, también filtrar por campo Activo
            if (onlyActive && !op.Activo) return false;

            return true;
        });
    }, [data, onlyActive]);

    return {
        operarios: filteredOperarios,
        loading: isLoading,
        error: error ? (error as Error).message : null,
        refresh: refetch
    };
};

export const useCalendario = (startDate: string, endDate: string) => {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ERP_KEYS.calendario(startDate, endDate),
        queryFn: () => getCalendarioEmpresa(startDate, endDate),
        enabled: !!startDate && !!endDate, // Solo ejecutar si hay fechas
        staleTime: 1000 * 60 * 10, // 10 minutos
    });

    return {
        calendario: data || [],
        loading: isLoading,
        error: error ? (error as Error).message : null,
        refresh: refetch
    };
};
