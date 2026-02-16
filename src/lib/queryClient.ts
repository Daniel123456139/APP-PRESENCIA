import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60 * 5, // 5 minutos: Los datos se consideran frescos por 5m
            gcTime: 1000 * 60 * 10,   // 10 minutos: Tiempo antes de borrar de memoria
            refetchOnWindowFocus: false, // No recargar al cambiar de ventana (evita parpadeos)
            retry: 1, // Reintentar solo 1 vez en caso de fallo
        },
        mutations: {
            retry: 0, // No reintentar mutaciones automáticamente (evita duplicados si no es idempotente)
        },
    },
});
