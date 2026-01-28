
import { RawDataRow } from '../types';

export interface ValidationIssue {
    type: 'error' | 'warning';
    code: 'PRESENCE_CONFLICT' | 'DOUBLE_EXIT' | 'OVERLAP' | 'PARTIAL_OVERLAP' | 'OTHER';
    message: string;
    employeeName: string;
    date: string;
}

// Helper: Convertir HH:MM o HH:MM:SS a minutos desde media noche
const timeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    // Manejar formato ISO o HH:MM:SS
    const cleanTime = timeStr.length > 8 ? timeStr.substring(11, 16) : timeStr.substring(0, 5);
    const parts = cleanTime.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return h * 60 + m;
};

export const validateNewIncidents = (
    currentData: RawDataRow[],
    newRows: RawDataRow[],
    rowsToIgnore: RawDataRow[] = [] // Para ediciones: filas antiguas que se van a borrar
): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    // Crear un Set de claves únicas para las filas a ignorar para búsqueda rápida
    // Usamos una clave compuesta que identifique la fila unívocamente
    const ignoreSet = new Set(rowsToIgnore.map(r => `${r.IDOperario}-${r.Fecha}-${r.MotivoAusencia}-${r.Hora}`));

    // Agrupar filas nuevas por Empleado y Fecha para procesar día por día
    const newRowsMap = new Map<string, RawDataRow[]>();
    for (const row of newRows) {
        const key = `${row.IDOperario}|${row.Fecha}`;
        if (!newRowsMap.has(key)) newRowsMap.set(key, []);
        newRowsMap.get(key)!.push(row);
    }

    // Preparar mapa de datos existentes para acceso rápido O(1)
    // Map<"IDOperario|Fecha", RawDataRow[]>
    const currentDataMap = new Map<string, RawDataRow[]>();
    for (const row of currentData) {
        // Si la fila está en ignoreSet, la saltamos (es como si ya no existiera)
        if (ignoreSet.has(`${row.IDOperario}-${row.Fecha}-${row.MotivoAusencia}-${row.Hora}`)) continue;

        const key = `${row.IDOperario}|${row.Fecha}`;
        if (!currentDataMap.has(key)) currentDataMap.set(key, []);
        currentDataMap.get(key)!.push(row);
    }

    // Iterar sobre los días afectados por los nuevos datos
    for (const [key, rows] of newRowsMap.entries()) {
        const [empIdStr, dateStr] = key.split('|');
        const employeeName = rows[0].DescOperario;

        // Obtener datos existentes para este empleado y fecha
        const existingDayRows = currentDataMap.get(key) || [];

        // --- REGLA 1: Vacaciones/Bajas vs Presencia ---
        // Si intentamos meter una ausencia de día completo (Vacaciones, IT, etc.)
        // No debe haber fichajes de Entrada (Trabajo realizado)
        const isNewFullDayAbsence = rows.some(r =>
            r.Entrada === 0 &&
            r.MotivoAusencia !== 1 && // No es fin jornada
            r.MotivoAusencia !== 14 && // No es tabaco
            (r.Hora === '00:00:00' || !r.Inicio) // Es día completo o no tiene horas parciales definidas
        );

        const hasPresence = existingDayRows.some(r => r.Entrada === 1);

        if (isNewFullDayAbsence && hasPresence) {
            issues.push({
                type: 'warning',
                code: 'PRESENCE_CONFLICT',
                message: `Aviso: El empleado tiene fichajes de trabajo este día. La incidencia se registrará igualmente.`,
                employeeName,
                date: dateStr
            });
        }

        // --- REGLA 2: Doble Fin de Jornada ---
        const newExits = rows.filter(r => r.MotivoAusencia === 1);
        const existingExits = existingDayRows.filter(r => r.MotivoAusencia === 1);

        if (newExits.length > 0 && existingExits.length > 0) {
            issues.push({
                type: 'error',
                code: 'DOUBLE_EXIT',
                message: `Ya existe un registro de 'Fin de Jornada' para este día.`,
                employeeName,
                date: dateStr
            });
        }

        // --- REGLA 3: Solapamiento de Ausencias (Mismo Tipo o Tipos Incompatibles) ---
        // Ejemplo: Meter Vacaciones donde ya hay IT, o IT donde ya hay Vacaciones.
        const newAbsences = rows.filter(r => r.Entrada === 0 && ![1, 14].includes(r.MotivoAusencia || 0));
        const existingAbsences = existingDayRows.filter(r => r.Entrada === 0 && ![1, 14].includes(r.MotivoAusencia || 0));

        if (newAbsences.length > 0 && existingAbsences.length > 0) {
            // Verificar si son parciales o totales
            const isNewPartial = newAbsences.every(r => r.Inicio && r.Fin);
            const isExistingPartial = existingAbsences.every(r => r.Inicio && r.Fin);

            if (!isNewPartial || !isExistingPartial) {
                // Si alguna es total y ya hay otra ausencia -> ERROR
                issues.push({
                    type: 'error',
                    code: 'OVERLAP',
                    message: `Ya existe una ausencia registrada (${existingAbsences[0].DescMotivoAusencia}) incompatible con la nueva solicitud.`,
                    employeeName,
                    date: dateStr
                });
            } else {
                // Ambas son parciales -> Verificar horas
                // --- REGLA 4: Solapamiento de Rangos Horarios (MODIFICADA: Cambio 3) ---
                // NUEVO: Permitir misma incidencia si las horas son DIFERENTES
                // Solo marcar error si es EXACTAMENTE el mismo código + mismo rango horario
                const newIntervals = newAbsences.map(r => ({
                    start: timeToMinutes(r.Inicio),
                    end: timeToMinutes(r.Fin),
                    desc: r.DescMotivoAusencia,
                    motivoId: r.MotivoAusencia
                }));
                const existingIntervals = existingAbsences.map(r => ({
                    start: timeToMinutes(r.Inicio),
                    end: timeToMinutes(r.Fin),
                    desc: r.DescMotivoAusencia,
                    motivoId: r.MotivoAusencia
                }));

                for (const newInt of newIntervals) {
                    for (const existInt of existingIntervals) {
                        // NUEVA LÓGICA: Solo es ERROR si:
                        // 1. Mismo código de incidencia
                        // 2. Y mismo rango horario (exacto o con solapamiento)
                        const isSameCode = newInt.motivoId === existInt.motivoId;
                        const hasOverlap = newInt.start < existInt.end && newInt.end > existInt.start;

                        if (isSameCode && hasOverlap) {
                            // Mismo código con solapamiento -> ERROR
                            issues.push({
                                type: 'error',
                                code: 'PARTIAL_OVERLAP',
                                message: `Ya existe ${newInt.desc} registrado en este horario (${rToTime(existInt.start)}-${rToTime(existInt.end)}).`,
                                employeeName,
                                date: dateStr
                            });
                        } else if (!isSameCode && hasOverlap) {
                            // Diferentes códigos con solapamiento -> WARNING (puede ser válido)
                            issues.push({
                                type: 'warning',
                                code: 'PARTIAL_OVERLAP',
                                message: `Solapamiento horario: ${newInt.desc} (${rToTime(newInt.start)}-${rToTime(newInt.end)}) se solapa con ${existInt.desc}.`,
                                employeeName,
                                date: dateStr
                            });
                        }
                        // Si es mismo código pero sin solapamiento -> OK (permitido)
                    }
                }
            }
        }
    }

    return issues;
};

// Helper inverso para mostrar minutos como HH:MM
const rToTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
