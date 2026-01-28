
export enum Role {
    Employee = 'Operario',
    Management = 'Dirección',
    HR = 'RRHH',
}

export interface User {
    id: number;
    name: string;
    department?: string;
    uid?: string;
    email?: string;
    appRole?: 'HR' | 'EMPLOYEE' | 'MANAGEMENT';
}

export interface BaseRecord {
    id: string | number;
    employeeId: number;
    createdAt?: string;
    updatedAt?: string;
}

export interface RawDataRow {
    IDControlPresencia?: number; // Added for DB tracking
    DescDepartamento: string;
    IDOperario: number;
    DescOperario: string;
    Fecha: string; // YYYY-MM-DD
    Hora: string; // HH:MM:SS
    Entrada: boolean | number; // true/1 for clock-in, false/0 for clock-out
    MotivoAusencia: number | null; // 0 for clock-in, 1 for clock-out, other numbers for absences
    DescMotivoAusencia: string;
    Computable: 'Sí' | 'No';
    IDTipoTurno: string | null;
    Inicio: string; // HH:MM
    Fin: string; // HH:MM
    TipoDiaEmpresa: number; // 0 for normal day, 1 for holiday
    TurnoTexto: string;
}

// Nueva interfaz para agrupar filas consecutivas
export interface LeaveRange {
    id: string; // Identificador único generado (ej: empId-motivo-start-end)
    employeeId: number;
    employeeName: string;
    department: string;
    motivoId: number;
    motivoDesc: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    isFullDay: boolean;
    startTime?: string; // HH:MM solo si no es full day
    endTime?: string; // HH:MM solo si no es full day
    originalRows: RawDataRow[]; // Referencia a las filas originales para el borrado
}

export interface UnjustifiedGap {
    date: string;
    start: string; // HH:MM:SS
    end: string;   // HH:MM:SS
    originPunchId?: number; // Check IDControlPresencia type in RawDataRow
}

export interface WorkdayDeviation {
    date: string;
    actualHours: number;
}

export interface TimeSlice {
    start: string; // HH:mm
    end: string;   // HH:mm
    endIsNextDay: boolean;
}

export interface ProcessedDataRow {
    operario: number;
    nombre: string;
    colectivo: string;
    turnoAsignado: string; // 'M' o 'TN'

    // NUEVO: Horario real formateado (ej: "15:00 - 23:00" o "22:00 - 06:00 (+1)")
    horarioReal: string;

    // NUEVO: Lista de todos los tramos horarios individuales
    timeSlices: TimeSlice[];

    // 4. TOTAL Horas (Calculated sum of worked hours)
    totalHoras: number;

    // PRESENCIA: Tiempo trabajado DENTRO de jornada sin TAJ
    presencia: number;

    // NUEVO: Horas Justificadas (Médico, Asuntos Propios, etc.) - Distinto de TAJ/Retrasos
    horasJustificadas: number;

    // NUEVO: Total Presencia + Justificadas
    horasTotalesConJustificacion: number;

    // NUEVO: Hora Exceso (trabajadas fuera del horario asignado)
    horasExceso: number;

    // Shifts & Overtime
    horasDia: number;       // 5. (07:00 - 15:00)
    excesoJornada1: number; // 6. Extra fuera de horas normales
    horasTarde: number;     // 7. (15:00 - 20:00) Parte diurna de la tarde
    nocturnas: number;      // 8. (20:00 - 07:00) Horas Nocturnas Universales
    horasNoche: number;     // 9. Legacy / Unused in new logic (kept for interface compat)
    festivas: number;       // 10. Weekends/Holidays

    // Absences & Permits
    hMedico: number;        // 11. Period
    acumMedico: number;     // 12. YTD
    dispMedico: number;     // 13. Available

    hVacaciones: number;    // 14. Period Days
    acumVacaciones: number; // 15. YTD Days
    dispVacaciones: number; // 16. Available Days

    hLDisp: number;         // 17. Period
    acumHLDisp: number;     // 18. YTD
    dispHLDisp: number;     // 19. Available

    hLeyFam: number;        // 20. Period
    acumHLF: number;        // 21. YTD
    dispHLF: number;        // 22. Available

    asOficiales: number;    // 23. Period
    hEspecialistaAccidente: number; // 24. Period
    hSindicales: number;    // 25. Period
    hVacAnt: number;        // 26. Period Days (Vacaciones Año Anterior)

    // New Codes (Internal tracking)
    asPropios: number;      // Code 04
    vacacionesPeriodo: number; // Code 05 (Standard Vacations)

    // IT
    diasITAT: number;       // 27. Days
    hITAT: number;          // 28. Hours
    diasITEC: number;       // 29. Days
    hITEC: number;          // 30. Hours

    // Incidents
    numTAJ: number;         // 31. Count
    hTAJ: number;           // 32. Hours
    numRetrasos: number;    // 33. Count
    tiempoRetrasos: number; // 34. Time

    numJornadasPartidas: number;
    tiempoJornadaPartida: number;

    unjustifiedGaps: UnjustifiedGap[];
    workdayDeviations: WorkdayDeviation[];

    // NEW: List of shift changes
    shiftChanges: { date: string; shift: string }[];

    // NEW: Critical Alerts
    missingClockOuts: string[]; // List of DateTimes where user forgot to clock out
    absentDays: string[]; // List of Dates where user didn't show up at all
    vacationConflicts?: string[]; // NEW: List of dates where employee has vacations but also punches
    incidentCount: number;
}

export interface BlogPost {
    id: number;
    title: string;
    author: string;
    date: string; // YYYY-MM-DD
    summary: string;
    content: string;
    tags: string[];
    imageUrl?: string;
}

export interface SickLeave extends BaseRecord {
    operarioName?: string;
    startDate: string; // YYYY-MM-DD
    endDate: string | null; // null if still active
    type: 'ITEC' | 'ITAT'; // Enfermedad Común or Accidente de Trabajo
    status: 'Activa' | 'Cerrada';
    motivo?: string;
    fechaRevision?: string | null;
    bcc?: number;
}

export interface FutureAbsence extends BaseRecord {
    operarioName: string;
    fechaPrevista: string;
    motivo: string;
}

// Actualizamos ShiftCode para incluir TN
export type ShiftCode = 'M' | 'TN' | 'C' | 'V' | 'L' | 'F';

export interface Shift {
    operarioId: number;
    date: string; // YYYY-MM-DD
    shiftCode: ShiftCode;
}

export interface IncidentLogEntry extends BaseRecord {
    timestamp: string;
    employeeName: string;
    type: string;
    reason: string;
    dates: string;
    source: 'Registrar Incidencia' | 'Resumen Empleados';
}

export interface CompanyHoliday {
    id: number;
    date: string; // YYYY-MM-DD
    description: string;
}

export const SHIFT_TYPES: Record<ShiftCode, { label: string; color: string }> = {
    M: { label: 'Mañana', color: 'bg-yellow-200 text-yellow-800' },
    TN: { label: 'Tarde/Noche', color: 'bg-indigo-200 text-indigo-800' }, // Nuevo TN
    C: { label: 'Central', color: 'bg-gray-200 text-gray-800' },
    V: { label: 'Vacaciones', color: 'bg-green-200 text-green-800' },
    L: { label: 'Libre', color: 'bg-pink-200 text-pink-800' },
    F: { label: 'Festivo', color: 'bg-red-200 text-red-800' },
};

export const MANAGEABLE_SHIFT_TYPES: Pick<typeof SHIFT_TYPES, 'M' | 'TN'> = {
    M: { label: 'Mañana', color: 'bg-yellow-200 text-yellow-800' },
    TN: { label: 'Tarde/Noche', color: 'bg-indigo-200 text-indigo-800' },
};

// ═══════════════════════════════════════════════════════════════════
// TIPOS DE FICHA DE EMPLEADO (Arquitectura Híbrida)
// ═══════════════════════════════════════════════════════════════════

/**
 * Competencia evaluada del empleado
 * Compartido con APP - TALENTO (colección COMPETENCIAS)
 */
export interface CompetenciaEvaluacion {
    skillId: string;
    skillName: string;
    nivel: 1 | 2 | 3; // Básico, Intermedio, Avanzado
    fechaEvaluacion: string;
    evaluadoPor: string;
}

/**
 * Nota de seguimiento del empleado
 * Compartido con APP - TALENTO (colección NOTAS)
 */
export interface NotaEmpleado {
    id: string;
    fecha: string;
    autor: string;
    contenido: string;
    tipo: 'observacion' | 'formacion' | 'incidencia';
}

/**
 * Datos enriquecidos del empleado (Firestore)
 * NO contiene PII - Seguro para Firebase compartido
 */
export interface EmployeeRichData {
    FechaAntiguedad?: string;
    NivelRetributivo?: string;
    Categoria?: string;
    Seccion?: string;
    TurnoHabitual?: 'M' | 'TN';
    UltimoFichaje?: string;
}

/**
 * Perfil completo del empleado (merge híbrido API + Firestore)
 */
export interface EmployeeProfile {
    IDOperario: number;
    DescOperario: string; // ⚠️ PII - Solo en memoria desde API
    Activo: boolean;
    Productivo: boolean;
    DescDepartamento: string;
    // Datos enriquecidos de Firestore
    FechaAntiguedad?: string;
    NivelRetributivo?: string;
    Categoria?: string;
    Seccion?: string;
    TurnoHabitual?: 'M' | 'TN';
    UltimoFichaje?: string;
    // Datos opcionales
    competencias?: CompetenciaEvaluacion[];
    notas?: NotaEmpleado[];
    hasPendingData?: boolean;
}

export interface JobControlEntry {
    IDOFControl: number | null;
    IDOrden: number | null;
    NOrden: string | null;
    IDArticulo: string | null;
    Secuencia: number | null;
    DescOperacion: string | null;
    FechaInicio: string | null; // dd/MM/yyyy
    HoraInicio: string | null;  // HH:mm:ss
    FechaFin: string | null;    // dd/MM/yyyy
    HoraFin: string | null;     // HH:mm:ss
    IDOperario: string | null;
    DescOperario: string | null;
    QBuena: number | null;
    QFabricar: number | null;
    Observaciones: string | null;
}
