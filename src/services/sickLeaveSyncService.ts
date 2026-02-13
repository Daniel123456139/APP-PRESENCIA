import { RawDataRow } from '../types';
import { insertFichaje } from './apiService';
import { getCalendarioOperario } from './erpApi';
import { SickLeaveMetadataService } from './sickLeaveMetadataService';
import { toISODateLocal, parseISOToLocalDate } from '../utils/localDate';

/**
 * Resultado de la sincronización de bajas
 */
export interface SyncResult {
    processed: number;        // Número de bajas procesadas
    fichajesCreated: number;  // Número de fichajes creados
    skipped: number;          // Número de fichajes omitidos (duplicados)
    errors: number;           // Número de errores encontrados
    details: SyncDetail[];    // Detalles por empleado
}

export interface SyncDetail {
    employeeId: number;
    employeeName: string;
    startDate: string;
    endDate: string;
    fichajesCreated: number;
    error?: string;
}

/**
 * Servicio para sincronizar fichajes automáticos de bajas médicas activas
 */
class SickLeaveSyncServiceClass {
    private readonly MAX_RETRIES = 1;
    private readonly RETRY_DELAY = 1000;

    /**
     * Sincroniza todas las bajas activas
     */
    async syncAllActiveSickLeaves(
        activeSickLeaves: RawDataRow[],
        onProgress?: (current: number, total: number) => void
    ): Promise<SyncResult> {
        // Validación de conexión
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            throw new Error('Sin conexión a internet. No se puede sincronizar.');
        }

        // Agrupar bajas por empleado
        const leavesByEmployee = this.groupLeavesByEmployee(activeSickLeaves);

        const result: SyncResult = {
            processed: 0,
            fichajesCreated: 0,
            skipped: 0,
            errors: 0,
            details: []
        };

        let current = 0;
        const total = leavesByEmployee.size;

        for (const [employeeId, leaves] of leavesByEmployee.entries()) {
            current++;
            if (onProgress) onProgress(current, total);

            try {
                // Procesar la baja más reciente del empleado
                const mostRecentLeave = this.getMostRecentLeave(leaves);
                const detail = await this.syncSingleSickLeave(
                    mostRecentLeave,
                    activeSickLeaves
                );

                result.processed++;
                result.fichajesCreated += detail.fichajesCreated;
                result.details.push(detail);
            } catch (error) {
                console.error(`Error sincronizando baja de empleado ${employeeId}:`, error);
                result.errors++;
                result.details.push({
                    employeeId,
                    employeeName: leaves[0].DescOperario,
                    startDate: leaves[0].Fecha,
                    endDate: '',
                    fichajesCreated: 0,
                    error: error instanceof Error ? error.message : 'Error desconocido'
                });
            }
        }

        return result;
    }

    /**
     * Sincroniza una baja específica
     */
    private async syncSingleSickLeave(
        leave: RawDataRow,
        allFichajes: RawDataRow[]
    ): Promise<SyncDetail> {
        const employeeId = leave.IDOperario;
        const motivoId = leave.MotivoAusencia!;
        const startDate = leave.Fecha;

        // Obtener metadatos de la baja
        const metadata = SickLeaveMetadataService.get(employeeId, startDate);

        // Calcular rango de fechas
        const dateRange = this.calculateDateRange(
            startDate,
            metadata?.dischargeDate
        );

        let fichajesCreated = 0;

        for (const date of dateRange) {
            // Verificar si ya existen fichajes para este día
            if (this.hasExistingEntry(employeeId, date, motivoId, allFichajes)) {
                continue;  // Skip, ya está grabado
            }

            try {
                // Obtener horario del empleado para ese día
                const horario = await this.getEmployeeSchedule(employeeId, date);

                if (!horario) {
                    console.warn(`No hay horario para empleado ${employeeId} el ${date}`);
                    continue;
                }

                // Grabar entrada normal (sin motivo)
                await this.insertFichajeWithRetry({
                    IDOperario: employeeId,
                    Fecha: date,
                    Hora: horario.Inicio,
                    Entrada: 1,
                    MotivoAusencia: null
                });

                // Grabar salida con código de baja (10/11)
                await this.insertFichajeWithRetry({
                    IDOperario: employeeId,
                    Fecha: date,
                    Hora: horario.Fin,
                    Entrada: 0,
                    MotivoAusencia: motivoId
                });

                fichajesCreated += 2;

            } catch (error) {
                console.error(`Error grabando fichaje para ${employeeId} el ${date}:`, error);
                // Continuar con el siguiente día si falla uno
            }
        }

        const endDate = dateRange.length > 0 ? dateRange[dateRange.length - 1] : startDate;

        return {
            employeeId,
            employeeName: leave.DescOperario,
            startDate,
            endDate,
            fichajesCreated
        };
    }

    /**
     * Calcula el rango de fechas a sincronizar
     */
    private calculateDateRange(
        startDate: string,
        dischargeDate?: string
    ): string[] {
        const today = toISODateLocal(new Date());

        // Solo generar hasta HOY. Si la fecha de alta ya pasó, cortar en esa fecha.
        let endDate = today;

        if (dischargeDate && dischargeDate <= today) {
            endDate = dischargeDate;
        }

        const dates: string[] = [];
        const current = parseISOToLocalDate(startDate);
        const end = parseISOToLocalDate(endDate);

        while (current <= end) {
            dates.push(toISODateLocal(current));
            current.setDate(current.getDate() + 1);
        }

        return dates;
    }

    /**
     * Verifica si ya existe un fichaje para un día específico
     */
    private hasExistingEntry(
        employeeId: number,
        date: string,
        motivoId: number,
        allFichajes: RawDataRow[]
    ): boolean {
        return allFichajes.some(f =>
            f.IDOperario === employeeId &&
            f.Fecha === date &&
            f.MotivoAusencia === motivoId &&
            f.Entrada === 0  // Verificar salida con código de baja
        );
    }

    /**
     * Obtiene el horario del empleado para un día específico
     */
    private async getEmployeeSchedule(
        employeeId: number,
        date: string
    ): Promise<{ Inicio: string; Fin: string } | null> {
        try {
            const calendario = await getCalendarioOperario(String(employeeId), date, date);

            if (!calendario || calendario.length === 0) {
                return null;
            }

            const dayData = calendario.find(d => d.Fecha === date);

            if (!dayData || !dayData.Inicio || !dayData.Fin) {
                return null;
            }

            return {
                Inicio: dayData.Inicio,
                Fin: dayData.Fin
            };
        } catch (error) {
            console.error(`Error obteniendo horario para empleado ${employeeId} el ${date}:`, error);
            return null;
        }
    }

    /**
     * Inserta un fichaje con reintentos
     */
    private async insertFichajeWithRetry(
        fichaje: Partial<RawDataRow>
    ): Promise<void> {
        for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                await insertFichaje(fichaje, 'SickLeaveSyncService');
                return;  // Éxito
            } catch (error) {
                if (attempt === this.MAX_RETRIES) {
                    throw error;
                }
                // Esperar antes de reintentar
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY));
            }
        }
    }

    /**
     * Agrupa las bajas por empleado
     */
    private groupLeavesByEmployee(leaves: RawDataRow[]): Map<number, RawDataRow[]> {
        const grouped = new Map<number, RawDataRow[]>();

        for (const leave of leaves) {
            if (!leave.MotivoAusencia || (leave.MotivoAusencia !== 10 && leave.MotivoAusencia !== 11)) {
                continue;  // Solo bajas médicas
            }

            const existing = grouped.get(leave.IDOperario) || [];
            existing.push(leave);
            grouped.set(leave.IDOperario, existing);
        }

        return grouped;
    }

    /**
     * Obtiene la baja más reciente de un empleado
     */
    private getMostRecentLeave(leaves: RawDataRow[]): RawDataRow {
        return leaves.reduce((latest, current) => {
            const latestDate = parseISOToLocalDate(latest.Fecha);
            const currentDate = parseISOToLocalDate(current.Fecha);
            return currentDate > latestDate ? current : latest;
        });
    }
}

// Exportar instancia singleton
export const SickLeaveSyncService = new SickLeaveSyncServiceClass();
