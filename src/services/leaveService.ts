
import { LeaveRange, RawDataRow } from "../types";
import { toISODateLocal, parseISOToLocalDate } from "../utils/localDate";

/**
 * Agrupa filas individuales de ERP (RawDataRow) en objetos LeaveRange lógicos.
 * Identifica secuencias consecutivas de días con el mismo motivo y empleado.
 */
export const groupRawDataToLeaves = (data: RawDataRow[]): LeaveRange[] => {
    // 1. Filtrar solo ausencias/incidencias relevantes (excluir fichajes de presencia)
    // Motivos que NO son ausencia: 1 (Salida), 14 (Fumar), null. Entrada=1 es fichaje.
    const absenceRows = data.filter(r => 
        r.Entrada === 0 && 
        r.MotivoAusencia !== null && 
        r.MotivoAusencia !== 1 && 
        r.MotivoAusencia !== 14
    );

    // 2. Ordenar por Empleado, Motivo y Fecha
    absenceRows.sort((a, b) => {
        if (a.IDOperario !== b.IDOperario) return a.IDOperario - b.IDOperario;
        if (a.MotivoAusencia !== b.MotivoAusencia) return (a.MotivoAusencia || 0) - (b.MotivoAusencia || 0);
        return parseISOToLocalDate(a.Fecha).getTime() - parseISOToLocalDate(b.Fecha).getTime();
    });

    const ranges: LeaveRange[] = [];
    let currentRange: LeaveRange | null = null;

    for (const row of absenceRows) {
        // Verificar si la fila actual extiende el rango actual
        const isExtension = currentRange &&
            currentRange.employeeId === row.IDOperario &&
            currentRange.motivoId === row.MotivoAusencia &&
            // Check continuity (Is this row date <= currentRange end date + 1 day?)
            (parseISOToLocalDate(row.Fecha).getTime() <= parseISOToLocalDate(currentRange.endDate).getTime() + (24 * 60 * 60 * 1000) * 1.5); 

        if (isExtension && currentRange) {
            // Extender fecha fin
            if (row.Fecha > currentRange.endDate) {
                currentRange.endDate = row.Fecha;
            }
            currentRange.originalRows.push(row);
        } else {
            // Crear nuevo rango
            const isFullDay = row.Hora === '00:00:00' && (!row.Inicio || row.Inicio === '00:00');
            
            currentRange = {
                id: `${row.IDOperario}-${row.MotivoAusencia}-${row.Fecha}-${Math.random().toString(36).substr(2, 5)}`,
                employeeId: row.IDOperario,
                employeeName: row.DescOperario,
                department: row.DescDepartamento,
                motivoId: row.MotivoAusencia!,
                motivoDesc: row.DescMotivoAusencia,
                startDate: row.Fecha,
                endDate: row.Fecha,
                isFullDay: isFullDay,
                startTime: isFullDay ? undefined : (row.Inicio || row.Hora.substring(0, 5)),
                endTime: isFullDay ? undefined : row.Fin,
                originalRows: [row]
            };
            ranges.push(currentRange);
        }
    }

    return ranges;
};

/**
 * Genera las filas RawDataRow necesarias para representar un rango de baja en el ERP.
 */
export const generateRowsFromRange = (range: LeaveRange): RawDataRow[] => {
    const rows: RawDataRow[] = [];
    const start = parseISOToLocalDate(range.startDate);
    const end = parseISOToLocalDate(range.endDate);

    // Iterar por cada día del rango
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = toISODateLocal(d);
        
        let hora = '00:00:00';
        let inicio = '';
        let fin = '';

        if (!range.isFullDay) {
            hora = range.startTime ? (range.startTime.length === 5 ? range.startTime + ':00' : range.startTime) : '00:00:00';
            inicio = range.startTime || '';
            fin = range.endTime || '';
        }

        const newRow: RawDataRow = {
            IDControlPresencia: 0, // Nuevo registro
            DescDepartamento: range.department || 'General',
            IDOperario: range.employeeId,
            DescOperario: range.employeeName,
            Fecha: dateStr,
            Hora: hora,
            Entrada: 0,
            MotivoAusencia: range.motivoId,
            DescMotivoAusencia: range.motivoDesc,
            Computable: 'Sí',
            IDTipoTurno: null,
            Inicio: inicio,
            Fin: fin,
            TipoDiaEmpresa: 0,
            TurnoTexto: range.motivoDesc
        };
        rows.push(newRow);
    }
    return rows;
};
