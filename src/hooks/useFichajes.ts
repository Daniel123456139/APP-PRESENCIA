import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchFichajes, fetchFichajesBatched } from '../services/apiService';
import { SyncService } from '../services/syncService';
import { deleteSyntheticPunchesInRange } from '../services/firestoreService';
import { AuditService } from '../services/AuditService';
import { RawDataRow, LeaveRange } from '../types';
import { toISODateLocal } from '../utils/localDate';
import { normalizeDateKey, extractTimeHHMM, extractTimeHHMMSS } from '../utils/datetime';
import { generateRowsFromRange } from '../services/leaveService';
import { trackPerfMetric } from '../services/performanceMonitoringService';
import { validateNewIncidents } from '../services/validationService';

// --- Keys ---
export const FICHAJES_KEYS = {
    all: ['fichajes'] as const,
    list: (start: string, end: string, startTime: string, endTime: string) => ['fichajes', { start, end, startTime, endTime }] as const,
};

export const useFichajes = (startDate: string, endDate: string, startTime: string = '00:00', endTime: string = '23:59') => {
    const getRangeDays = (start: string, end: string) => {
        const startMs = new Date(`${start}T00:00:00`).getTime();
        const endMs = new Date(`${end}T23:59:59`).getTime();
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
        return Math.ceil(Math.abs(endMs - startMs) / (1000 * 60 * 60 * 24));
    };

    const { data, isLoading, isFetching, dataUpdatedAt, error, refetch } = useQuery({
        queryKey: FICHAJES_KEYS.list(startDate, endDate, startTime, endTime),
        queryFn: async () => {
            const rangeDays = getRangeDays(startDate, endDate);
            const t0 = performance.now();
            if (rangeDays > 7) {
                const data = await fetchFichajesBatched(startDate, endDate, '', startTime, endTime);
                trackPerfMetric('fetch_fichajes_batched', performance.now() - t0, { rangeDays, rows: data.length });
                return data;
            }
            const data = await fetchFichajes(startDate, endDate, '', startTime, endTime);
            trackPerfMetric('fetch_fichajes', performance.now() - t0, { rangeDays, rows: data.length });
            return data;
        },
        enabled: !!startDate && !!endDate,
        staleTime: 1000 * 60 * 5, // 5 minutos de frescura
        refetchOnMount: false,
        refetchOnReconnect: false,
        refetchOnWindowFocus: false,
    });

    return {
        erpData: data || [],
        isLoading,
        isFetching,
        dataUpdatedAt,
        error: error ? (error as Error).message : null,
        refresh: refetch
    };
};

export const useFichajesMutations = () => {
    const queryClient = useQueryClient();

    const addIncidentsMutation = useMutation({
        mutationFn: async ({ newRows, userName = "AppUser" }: { newRows: RawDataRow[], userName?: string }) => {
            console.group("🟢 [Mutation] addIncidents - INICIO");

            const rowsToSave: RawDataRow[] = [];

            // 1. Pre-procesamiento (Split días)
            for (const row of newRows) {
                const start = row.Inicio || extractTimeHHMM(row.Hora);
                const end = row.Fin || '';
                const horaNormalized = extractTimeHHMMSS(row.Hora);

                if (start && end && end < start && horaNormalized !== '00:00:00') {
                    const row1 = { ...row, Fin: '23:59:59' };
                    const dateObj = new Date(row.Fecha);
                    dateObj.setDate(dateObj.getDate() + 1);
                    const nextDateStr = toISODateLocal(dateObj);

                    const row2 = {
                        ...row,
                        Fecha: nextDateStr,
                        Hora: '00:00:00',
                        Inicio: '00:00:00',
                        Fin: end
                    };
                    rowsToSave.push(row1, row2);
                } else {
                    rowsToSave.push(row);
                }
            }

            let successCount = 0;
            let queuedCount = 0;
            const failedErrors: string[] = [];

            // Obtener datos actuales de la caché para "smart replacement"
            // Buscamos en todas las queries de fichajes activas
            const allQueries = queryClient.getQueriesData<RawDataRow[]>({ queryKey: FICHAJES_KEYS.all });
            const allFichajes = allQueries.flatMap(([_, data]) => data || []);

            const issues = validateNewIncidents(allFichajes, rowsToSave as RawDataRow[]);
            const blockingErrors = issues.filter(i => i.type === 'error');
            if (blockingErrors.length > 0) {
                throw new Error(`Validación bloqueante: ${blockingErrors.map(e => e.message).join(' | ')}`);
            }

            for (let i = 0; i < rowsToSave.length; i++) {
                const row = rowsToSave[i];
                let isReplacement = false;
                let replacementTargetId = 0;

                // 🎯 SMART REPLACEMENT LOGIC
                if (row.Entrada === 0 && row.MotivoAusencia && row.MotivoAusencia !== 1) {
                    const existingExit = allFichajes.find(r =>
                        r.IDOperario === row.IDOperario &&
                        r.Fecha === row.Fecha &&
                        r.Entrada === 0 &&
                        (r.MotivoAusencia === 1 || r.MotivoAusencia === null || r.MotivoAusencia === 0) &&
                        extractTimeHHMM(r.Hora) === extractTimeHHMM(row.Hora)
                    );

                    if (existingExit && existingExit.IDControlPresencia && existingExit.IDControlPresencia > 0) {
                        isReplacement = true;
                        replacementTargetId = existingExit.IDControlPresencia!;
                    }
                }

                try {
                    let result;
                    if (isReplacement) {
                        const updatePayload = { ...row, IDControlPresencia: replacementTargetId };
                        result = await SyncService.tryUploadFichaje(updatePayload, userName);
                    } else {
                        result = await SyncService.tryInsertFichaje(row, userName);
                    }

                    if (result.success) successCount++;
                    else if (result.queued) queuedCount++;
                    else {
                        failedErrors.push(result.message);
                        console.error(`❌ [Mutation] Fila ${i + 1} - Error:`, result.message);
                    }
                } catch (e: any) {
                    console.error(`❌ [Mutation] Fila ${i + 1} - Excepción:`, e.message);
                    failedErrors.push(e.message);
                }
            }

            if (failedErrors.length > 0) {
                throw new Error(`Error al guardar: ${failedErrors.join(', ')}`);
            }

            console.groupEnd();
            return { successCount, queuedCount, rowsToSave, userName };
        },
        onSuccess: (data) => {
            // Invalidar para recargar datos frescos
            queryClient.invalidateQueries({ queryKey: FICHAJES_KEYS.all });

            if (data.rowsToSave.length > 0) {
                const first = data.rowsToSave[0];
                AuditService.log({
                    actorId: data.userName === "AppUser" ? 0 : 1,
                    actorName: data.userName,
                    action: 'INCIDENT_CREATED',
                    description: `Incidencia registrada: ${first.DescMotivoAusencia}`,
                    module: 'HR_PORTAL',
                    employeeId: first.IDOperario,
                    status: data.queuedCount > 0 ? 'pending' : 'success'
                });
            }
        }
    });

    const deleteLeaveRangeMutation = useMutation({
        mutationFn: async ({ range, userName = "AppUser" }: { range: LeaveRange, userName?: string }) => {
            const result = await SyncService.tryDeleteRange({
                idOperario: range.employeeId,
                motivoId: range.motivoId,
                fechaInicio: range.startDate,
                fechaFin: range.endDate
            }, userName);

            if (!result.success && !result.queued) {
                throw new Error(result.message);
            }

            // CLEANUP: Delete any synthetic punches
            try {
                await deleteSyntheticPunchesInRange(range.employeeId, range.startDate, range.endDate);
            } catch (err) {
                console.warn("⚠️ Failed to cleanup synthetic punches:", err);
            }

            return { result, range, userName };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: FICHAJES_KEYS.all });
            AuditService.log({
                actorId: 1,
                actorName: data.userName,
                action: 'LEAVE_DELETED',
                description: `Baja eliminada: ${data.range.motivoDesc} (${data.result.queued ? 'En cola' : 'Exito'})`,
                module: 'HR_PORTAL',
                employeeId: data.range.employeeId,
                employeeName: data.range.employeeName,
                status: data.result.queued ? 'pending' : 'warning'
            });
        }
    });

    const editLeaveRangeMutation = useMutation({
        mutationFn: async ({ oldRange, newRange, userName = "AppUser" }: { oldRange: LeaveRange, newRange: LeaveRange, userName?: string }) => {
            // 1. Delete old
            const delResult = await SyncService.tryDeleteRange({
                idOperario: oldRange.employeeId,
                motivoId: oldRange.motivoId,
                fechaInicio: oldRange.startDate,
                fechaFin: oldRange.endDate
            }, userName);
            if (!delResult.success && !delResult.queued) throw new Error(delResult.message);
            try { await deleteSyntheticPunchesInRange(oldRange.employeeId, oldRange.startDate, oldRange.endDate); } catch (e) { }

            // 2. Add new
            const newRows = generateRowsFromRange(newRange);
            // Reutilizar lógica de inserción es complejo sin llamar al hook addIncidentsMutation.
            // Asi que replicamos la llamada a SyncService.tryInsertFichaje en bucle
            // O mejor, encadenamos mutaciones en el componente? No, la lógica debe estar aquí.

            // Lógica simplificada de inserción masiva para ranges (asumiendo que ranges no necesitan smart replacement complejo de salidas)
            // Aunque generateRowsFromRange genera filas que podrían necesitar split.
            // Para simplificar, asumimos que generateRowsFromRange ya devuelve filas correctas.

            // NOTA: Para reutilizar la lógica completa de 'addIncidents' (smart split + smart replace),
            // deberíamos extraer esa lógica a una función async pura fuera del hook.
            // Por ahora, haremos una implementación inline simplificada o llamaremos a una función helper.

            return { oldRange, newRange, userName, newRows };
        },
        onSuccess: async (data) => {
            // Aquí llamamos a la mutación de addIncidents para completar la segunda parte
            // Pero no podemos llamar hook dentro de hook callback.
            // Solución: Refactorizar lógica de addIncidents a funcion helper.

            // Como workaround temporal, invalidamos y confiamos en que el componente llame a addIncidents después?
            // No, esto debe ser atómico.
            // MEJOR: Implementar `editLeaveRange` como una composición en el componente o mover la lógica core a un servicio.
            // Pero dado que estamos migrando, vamos a hacer que editLeaveRange llame a `addIncidentsMutation.mutateAsync` NO se puede.

            // Vamos a dejar editLeaveRange en el limbo por un segundo y refactorizar `addIncidentsCore`
            queryClient.invalidateQueries({ queryKey: FICHAJES_KEYS.all });
        }
    });

    // Helper para editLeaveRange que realmente funcione
    const editLeaveRangeComplete = async (oldRange: LeaveRange, newRange: LeaveRange, userName: string = "AppUser") => {
        await deleteLeaveRangeMutation.mutateAsync({ range: oldRange, userName });
        const newRows = generateRowsFromRange(newRange);
        await addIncidentsMutation.mutateAsync({ newRows, userName });

        AuditService.log({
            actorId: 1,
            actorName: userName,
            action: 'LEAVE_UPDATED',
            description: `Baja actualizada: ${oldRange.motivoDesc} -> ${newRange.motivoDesc}`,
            module: 'HR_PORTAL',
            employeeId: newRange.employeeId,
            employeeName: newRange.employeeName,
            status: 'success'
        });
    }

    const updateRowsMutation = useMutation({
        mutationFn: async ({ oldRows, newRows }: { oldRows: RawDataRow[], newRows: RawDataRow[] }) => {
            const failedErrors: string[] = [];
            let successCount = 0;
            let queuedCount = 0;

            for (const row of newRows) {
                try {
                    let result;
                    if (row.IDControlPresencia && row.IDControlPresencia > 0) {
                        result = await SyncService.tryUpdateFichaje(row, "BulkUpdate");
                    } else {
                        result = await SyncService.tryInsertFichaje(row, "BulkUpdate");
                    }

                    if (result.success) successCount++;
                    else if (result.queued) queuedCount++;
                    else failedErrors.push(result.message);

                } catch (e: any) {
                    failedErrors.push(e.message);
                }
            }

            if (failedErrors.length > 0) {
                throw new Error(`Errores al actualizar: ${failedErrors.join(', ')}`);
            }
            return { newRows, queuedCount };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: FICHAJES_KEYS.all });
            AuditService.log({
                actorId: 1,
                actorName: 'RRHH',
                action: 'BULK_UPDATE',
                description: `Actualización masiva de ${data.newRows.length} registros (${data.queuedCount} en cola)`,
                module: 'HR_PORTAL',
                status: data.queuedCount > 0 ? 'pending' : 'success'
            });
        }
    });

    const updateCalendarMutation = useMutation({
        mutationFn: async ({ employeeId, date, tipoDia, userName = "RRHH" }: { employeeId: string, date: string, tipoDia: number, userName?: string }) => {
            const { updateCalendarioOperario } = await import('../services/erpApi');
            await updateCalendarioOperario(employeeId, date, tipoDia);
            return { employeeId, date, tipoDia, userName };
        },
        onSuccess: (data) => {
            // Invalida tanto fichajes como el estado de calendarios si existiera una query de cache
            queryClient.invalidateQueries({ queryKey: FICHAJES_KEYS.all });
            // Nota: useHrPortalData usa estado local para calendarios, por lo que el refresco
            // dependerá de cómo se use. Pero invalidar fichajes es un buen comienzo.

            AuditService.log({
                actorId: 1,
                actorName: data.userName,
                action: 'CALENDAR_UPDATED',
                description: `Calendario actualizado para operario ${data.employeeId} en fecha ${data.date} (Tipo: ${data.tipoDia})`,
                module: 'HR_PORTAL',
                employeeId: parseInt(data.employeeId),
                status: 'success'
            });
        }
    });

    return {
        addIncidents: addIncidentsMutation.mutateAsync,
        deleteLeaveRange: deleteLeaveRangeMutation.mutateAsync,
        editLeaveRange: editLeaveRangeComplete,
        updateRows: updateRowsMutation.mutateAsync,
        updateCalendar: updateCalendarMutation.mutateAsync,
        isMutating: addIncidentsMutation.isPending ||
            deleteLeaveRangeMutation.isPending ||
            updateRowsMutation.isPending ||
            updateCalendarMutation.isPending
    };
};
