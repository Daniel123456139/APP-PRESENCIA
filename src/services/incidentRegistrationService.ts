/**
 * Servicio para registro avanzado de incidencias con generación de fichajes sintéticos
 * 
 * REGLA CRÍTICA: Cuando un empleado tiene un "gap" (se va y vuelve) durante la jornada,
 * se deben insertar fichajes intermedios:
 * - Entrada "null" 1 minuto DESPUÉS de la salida real
 * - Salida con código de incidencia 1 minuto ANTES de la entrada real
 * 
 * Ejemplo:
 * Fichajes reales: 07:00 → 10:00 (sale), 12:00 → 15:00 (vuelve)
 * Incidencia: Médico 10:00-12:00
 * Fichajes a generar:
 *   - Entrada null a las 10:01
 *   - Salida médico (código 02) a las 11:59
 */

import { RawDataRow } from '../types';

export interface IntermediatePunchesParams {
    employeeId: string;
    employeeName: string;
    date: string; // formato ISO: YYYY-MM-DD
    exitTime: string; // HH:MM (salida real)
    returnTime: string; // HH:MM (entrada real)
    motivo: number; // código de incidencia (02=médico, 05=vacaciones, etc.)
    motivoDesc: string;
    turno: string;
    department: string;
}

export interface FullDayPunchesParams {
    employeeId: string;
    employeeName: string;
    date: string;
    shiftStart: string; // HH:MM
    shiftEnd: string; // HH:MM
    motivo: number;
    motivoDesc: string;
    turno: string;
    department: string;
}

export interface SyntheticPunch {
    IDOperario: string;
    DescOperario: string;
    Fecha: string;
    Hora: string;
    Entrada: number; // 1=entrada, 0=salida
    MotivoAusencia: number | null;
    DescMotivoAusencia: string;
    DescDepartamento: string;
    TurnoTexto: string;
    Inicio?: string;
    Fin?: string;
}

export interface IncidentContext {
    type: 'intermediate' | 'late_arrival' | 'early_departure' | 'full_day';
    existingPunches: RawDataRow[];
    hasEntry: boolean;
    hasExit: boolean;
}

function addDaysLocal(dateStr: string, days: number): string {
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Calcula las horas intermedias para fichajes sintéticos
 */
function calculateIntermediateTimes(exitTime: string, returnTime: string) {
    const [exitH, exitM] = exitTime.split(':').map(Number);
    const [returnH, returnM] = returnTime.split(':').map(Number);

    // Entrada: 1 minuto después de la salida
    let entryMinutes = exitH * 60 + exitM + 1;
    const entryHour = Math.floor(entryMinutes / 60);
    const entryMin = entryMinutes % 60;

    // Salida: 1 minuto antes de la vuelta
    let exitMinutes = returnH * 60 + returnM - 1;
    const exitHour = Math.floor(exitMinutes / 60);
    const exitMin = exitMinutes % 60;

    return {
        entryTime: `${entryHour.toString().padStart(2, '0')}:${entryMin.toString().padStart(2, '0')}`,
        exitTime: `${exitHour.toString().padStart(2, '0')}:${exitMin.toString().padStart(2, '0')}`
    };
}

/**
 * Detecta el contexto de una incidencia basándose en fichajes existentes
 */
export function detectIncidentContext(
    date: string,
    existingPunches: RawDataRow[],
    shift: { start: string; end: string }
): IncidentContext {
    const dayPunches = existingPunches.filter(p => p.Fecha === date);

    const hasEntry = dayPunches.some(p => p.Entrada === 1);
    const hasExit = dayPunches.some(p => p.Entrada === 0);

    // Si no hay fichajes, es día completo
    if (dayPunches.length === 0) {
        return { type: 'full_day', existingPunches: dayPunches, hasEntry: false, hasExit: false };
    }

    // Si hay entrada pero no salida, podría ser salida temprana
    if (hasEntry && !hasExit) {
        return { type: 'early_departure', existingPunches: dayPunches, hasEntry: true, hasExit: false };
    }

    // Si hay salida pero no entrada, podría ser llegada tardía
    if (!hasEntry && hasExit) {
        return { type: 'late_arrival', existingPunches: dayPunches, hasEntry: false, hasExit: true };
    }

    // Si hay múltiples entradas/salidas, es intermedio
    const entries = dayPunches.filter(p => p.Entrada === 1).length;
    const exits = dayPunches.filter(p => p.Entrada === 0).length;

    if (entries > 1 || exits > 1) {
        return { type: 'intermediate', existingPunches: dayPunches, hasEntry: true, hasExit: true };
    }

    // Por defecto, considerar día completo
    return { type: 'full_day', existingPunches: dayPunches, hasEntry, hasExit };
}

/**
 * Genera los fichajes intermedios para justificar una ausencia entre dos fichajes reales
 */
export function generateIntermediatePunches(params: IntermediatePunchesParams): SyntheticPunch[] {
    const { employeeId, employeeName, date, exitTime, returnTime, motivo, motivoDesc, turno, department } = params;

    const { entryTime, exitTime: syntheticExitTime } = calculateIntermediateTimes(exitTime, returnTime);

    // Fichaje 1: Entrada "null" (sin motivo) 1 minuto después de salida real
    const entryPunch: SyntheticPunch = {
        IDOperario: employeeId,
        DescOperario: employeeName,
        Fecha: date,
        Hora: `${entryTime}:00`,
        Entrada: 1,
        MotivoAusencia: null,
        DescMotivoAusencia: '',
        DescDepartamento: department,
        TurnoTexto: turno,
        Inicio: '',
        Fin: ''
    };

    // Fichaje 2: Salida con motivo de incidencia 1 minuto antes de entrada real
    const exitPunch: SyntheticPunch = {
        IDOperario: employeeId,
        DescOperario: employeeName,
        Fecha: date,
        Hora: `${syntheticExitTime}:00`,
        Entrada: 0,
        MotivoAusencia: motivo,
        DescMotivoAusencia: motivoDesc,
        DescDepartamento: department,
        TurnoTexto: turno,
        Inicio: entryTime,
        Fin: syntheticExitTime
    };

    return [entryPunch, exitPunch];
}

/**
 * Genera fichajes para cubrir toda la jornada (ausencia día completo)
 */
export function generateFullDayPunches(params: FullDayPunchesParams): SyntheticPunch[] {
    const { employeeId, employeeName, date, shiftStart, shiftEnd, motivo, motivoDesc, turno, department } = params;

    const toMinutes = (hhmm: string): number => {
        const [h, m] = hhmm.split(':').map(Number);
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };

    const isCrossMidnight = toMinutes(shiftEnd) < toMinutes(shiftStart);
    const exitDate = isCrossMidnight ? addDaysLocal(date, 1) : date;

    const entryPunch: SyntheticPunch = {
        IDOperario: employeeId,
        DescOperario: employeeName,
        Fecha: date,
        Hora: `${shiftStart}:00`,
        Entrada: 1,
        MotivoAusencia: null,
        DescMotivoAusencia: '',
        DescDepartamento: department,
        TurnoTexto: turno,
        Inicio: '',
        Fin: ''
    };

    const exitPunch: SyntheticPunch = {
        IDOperario: employeeId,
        DescOperario: employeeName,
        Fecha: exitDate,
        Hora: `${shiftEnd}:00`,
        Entrada: 0,
        MotivoAusencia: motivo,
        DescMotivoAusencia: motivoDesc,
        DescDepartamento: department,
        TurnoTexto: turno,
        Inicio: shiftStart,
        Fin: shiftEnd
    };

    return [entryPunch, exitPunch];
}
