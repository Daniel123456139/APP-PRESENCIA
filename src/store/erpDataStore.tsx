
import React, { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { RawDataRow, LeaveRange } from '../types';
import { SyncService } from '../services/syncService';
import { generateRowsFromRange } from '../services/leaveService';
import { AuditService } from '../services/AuditService';
import { toISODateLocal } from '../utils/localDate';

// --- Estado ---
interface ErpDataState {
    erpData: RawDataRow[];
    lastUpdated: number;
    isLoading: boolean;
    error: string | null;
}

const initialState: ErpDataState = {
    erpData: [],
    lastUpdated: Date.now(),
    isLoading: false,
    error: null,
};

// --- Acciones del Reducer ---
type ErpDataAction =
    | { type: 'SET_DATA'; payload: RawDataRow[] }
    | { type: 'ADD_ROWS'; payload: RawDataRow[] }
    | { type: 'REMOVE_ROWS_BY_RANGE'; payload: { employeeId: number; motivoId: number; startDate: string; endDate: string } }
    | { type: 'UPDATE_ROWS'; payload: { oldRows: RawDataRow[]; newRows: RawDataRow[] } }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string };

const erpDataReducer = (state: ErpDataState, action: ErpDataAction): ErpDataState => {
    switch (action.type) {
        case 'SET_DATA':
            return { ...state, erpData: action.payload, lastUpdated: Date.now(), error: null };
        case 'ADD_ROWS':
            return { ...state, erpData: [...state.erpData, ...action.payload], lastUpdated: Date.now() };
        case 'REMOVE_ROWS_BY_RANGE':
            return {
                ...state,
                erpData: state.erpData.filter(row => {
                    if (row.IDOperario !== action.payload.employeeId) return true;
                    if (row.MotivoAusencia !== action.payload.motivoId) return true;
                    return !(row.Fecha >= action.payload.startDate && row.Fecha <= action.payload.endDate);
                }),
                lastUpdated: Date.now()
            };
        case 'UPDATE_ROWS':
            const oldRowSet = new Set(action.payload.oldRows);
            const filteredData = state.erpData.filter(r => !oldRowSet.has(r));
            return {
                ...state,
                erpData: [...filteredData, ...action.payload.newRows],
                lastUpdated: Date.now()
            };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        default:
            return state;
    }
};

const ErpDataContext = createContext<{
    state: ErpDataState;
    dispatch: React.Dispatch<ErpDataAction>;
} | null>(null);

export const ErpDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(erpDataReducer, initialState);

    return (
        <ErpDataContext.Provider value={{ state, dispatch }}>
            {children}
        </ErpDataContext.Provider>
    );
};

export const useErpDataState = () => {
    const context = useContext(ErpDataContext);
    if (!context) throw new Error('useErpDataState must be used within an ErpDataProvider');
    return context.state;
};

export const useErpDataActions = () => {
    const context = useContext(ErpDataContext);
    if (!context) throw new Error('useErpDataActions must be used within an ErpDataProvider');
    const { state, dispatch } = context; // Access state for validity check

    const setErpData = useCallback((data: RawDataRow[]) => {
        dispatch({ type: 'SET_DATA', payload: data });
    }, [dispatch]);

    const addIncidents = useCallback(async (newRows: RawDataRow[], userName: string = "AppUser") => {
        console.group("🟢 [Store] addIncidents - INICIO (Smart Mode)");
        // console.log("📦 Filas a guardar:", newRows); // Removed for security - avoid logging employee data

        const rowsToSave: RawDataRow[] = [];

        // 1. Pre-procesamiento (Split días)
        for (const row of newRows) {
            const start = row.Inicio || row.Hora.substring(0, 5);
            const end = row.Fin || '';

            if (start && end && end < start && row.Hora !== '00:00:00') {
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
        const rowsForDispatch: RawDataRow[] = [];
        const idsToRemoveFromState: number[] = []; // IDs that were "replaced" and should be removed/updated in state

        for (let i = 0; i < rowsToSave.length; i++) {
            const row = rowsToSave[i];
            // console.log(`🔄 [Store] Procesando fila ${i + 1}/${rowsToSave.length}:`, row); // Removed for security

            // 🎯 SMART REPLACEMENT LOGIC
            // Si es una SALIDA de INCIDENCIA (Entrada=0, Motivo!=1), buscamos si ya existe una salida normal (Motivo=1 o null)
            // para "pisarla" en lugar de crear una nueva.
            let isReplacement = false;
            let replacementTargetId = 0;

            if (row.Entrada === 0 && row.MotivoAusencia && row.MotivoAusencia !== 1) {
                const existingExit = state.erpData.find(r =>
                    r.IDOperario === row.IDOperario &&
                    r.Fecha === row.Fecha &&
                    r.Entrada === 0 &&
                    (r.MotivoAusencia === 1 || r.MotivoAusencia === null || r.MotivoAusencia === 0) &&
                    r.Hora.substring(0, 5) === row.Hora.substring(0, 5) // Coincidencia de hora (HH:MM) requerida
                );

                if (existingExit && existingExit.IDControlPresencia && existingExit.IDControlPresencia > 0) {
                    isReplacement = true;
                    replacementTargetId = existingExit.IDControlPresencia;
                    // console.log(`🔄 [Store] SMART REPLACE: Sustituyendo salida existente (ID: ${replacementTargetId}) por Incidencia ${row.DescMotivoAusencia}`); // Removed for security
                }
            }

            try {
                let result;
                if (isReplacement) {
                    // UPDATE en lugar de INSERT
                    const updatePayload = { ...row, IDControlPresencia: replacementTargetId };
                    // USAMOS uploadFichaje como solicitó el usuario para sustituciones
                    result = await SyncService.tryUploadFichaje(updatePayload, userName);

                    if (result.success || result.queued) {
                        idsToRemoveFromState.push(replacementTargetId); // Para quitar el viejo del estado local
                        // Update the row ID to the existing one so local state has the correct ID
                        row.IDControlPresencia = replacementTargetId;
                    }
                } else {
                    // INSERT Normal
                    result = await SyncService.tryInsertFichaje(row, userName);
                }

                // console.log(`📊 [Store] Resultado fila ${i + 1}:`, result); // Removed for security

                if (result.success) {
                    successCount++;
                    rowsForDispatch.push(row); // Añadimos la nueva versión
                } else if (result.queued) {
                    queuedCount++;
                    rowsForDispatch.push(row);
                } else {
                    failedErrors.push(result.message);
                    console.error(`❌ [Store] Fila ${i + 1} - Error:`, result.message);
                }
            } catch (e: any) {
                console.error(`❌ [Store] Fila ${i + 1} - Excepción:`, e.message);
                failedErrors.push(e.message);
            }
        }

        if (failedErrors.length > 0) {
            throw new Error(`Error al guardar: ${failedErrors.join(', ')}`);
        }

        // Actualizar Estado Local
        if (rowsForDispatch.length > 0) {
            // 1. Si hubo reemplazos, quitar los viejos registros "pisados" de la visualización previa
            // Usamos UPDATE_ROWS para esto, pasando las filas originales que fueron reemplazadas
            if (idsToRemoveFromState.length > 0) {
                const oldRowsToRemove = state.erpData.filter(r => r.IDControlPresencia && idsToRemoveFromState.includes(r.IDControlPresencia));

                // Las "newRows" para estas actualizaciones son las que acabamos de procesar en rowsForDispatch 
                // que coincidan con estos IDs
                const updatedRows = rowsForDispatch.filter(r => r.IDControlPresencia && idsToRemoveFromState.includes(r.IDControlPresencia));

                // Las que NO son actualizaciones (son inserts puros) se deben añadir con ADD_ROWS después
                const newInserts = rowsForDispatch.filter(r => !r.IDControlPresencia || !idsToRemoveFromState.includes(r.IDControlPresencia));

                if (oldRowsToRemove.length > 0) {
                    dispatch({ type: 'UPDATE_ROWS', payload: { oldRows: oldRowsToRemove, newRows: updatedRows } });
                }

                if (newInserts.length > 0) {
                    dispatch({ type: 'ADD_ROWS', payload: newInserts });
                }

            } else {
                // 2. Si no hubo reemplazos (solo inserts), flujo normal
                dispatch({ type: 'ADD_ROWS', payload: rowsForDispatch });
            }

            const first = rowsForDispatch[0];
            AuditService.log({
                actorId: userName === "AppUser" ? 0 : 1,
                actorName: userName,
                action: 'INCIDENT_CREATED',
                description: `Incidencia registrada: ${first.DescMotivoAusencia}`,
                module: 'HR_PORTAL',
                employeeId: first.IDOperario,
                status: queuedCount > 0 ? 'pending' : 'success'
            });
        }

        console.groupEnd();
        return { successCount, queuedCount };
    }, [dispatch, state]);

    const deleteLeaveRange = useCallback(async (range: LeaveRange, userName: string = "AppUser") => {
        try {
            const result = await SyncService.tryDeleteRange({
                idOperario: range.employeeId,
                motivoId: range.motivoId,
                fechaInicio: range.startDate,
                fechaFin: range.endDate
            }, userName);

            if (!result.success && !result.queued) {
                throw new Error(result.message);
            }

            // Eliminamos de UI tanto si éxito como si encolado
            dispatch({
                type: 'REMOVE_ROWS_BY_RANGE',
                payload: {
                    employeeId: range.employeeId,
                    motivoId: range.motivoId,
                    startDate: range.startDate,
                    endDate: range.endDate
                }
            });

            AuditService.log({
                actorId: 1,
                actorName: userName,
                action: 'LEAVE_DELETED',
                description: `Baja eliminada: ${range.motivoDesc} (${result.queued ? 'En cola' : 'Exito'})`,
                module: 'HR_PORTAL',
                employeeId: range.employeeId,
                employeeName: range.employeeName,
                status: result.queued ? 'pending' : 'warning'
            });

        } catch (e) {
            console.error("Failed to delete range", e);
            throw e;
        }
    }, [dispatch]);

    const editLeaveRange = useCallback(async (oldRange: LeaveRange, newRange: LeaveRange, userName: string = "AppUser") => {
        await deleteLeaveRange(oldRange, userName);
        const newRows = generateRowsFromRange(newRange);
        await addIncidents(newRows, userName);

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

    }, [deleteLeaveRange, addIncidents]);

    const updateRows = useCallback(async (oldRows: RawDataRow[], newRows: RawDataRow[]) => {
        const failedErrors: string[] = [];
        let successCount = 0;
        let queuedCount = 0;

        for (const row of newRows) {
            try {
                let result;
                // Si tiene IDControlPresencia, es update, si no, es insert
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

        dispatch({ type: 'UPDATE_ROWS', payload: { oldRows, newRows } });

        AuditService.log({
            actorId: 1,
            actorName: 'RRHH',
            action: 'BULK_UPDATE',
            description: `Actualización masiva de ${newRows.length} registros (${queuedCount} en cola)`,
            module: 'HR_PORTAL',
            status: queuedCount > 0 ? 'pending' : 'success'
        });
    }, [dispatch]);

    return {
        setErpData,
        addIncidents,
        deleteLeaveRange,
        editLeaveRange,
        updateRows
    };
};
