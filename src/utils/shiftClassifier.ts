
export type Turno = 'M' | 'TN';

interface ShiftInput {
  fecha: string;              // 'YYYY-MM-DD'
  horaEntrada?: string;       // 'HH:mm' | undefined
  horaSalida?: string;        // 'HH:mm' | undefined
  salidaEsDelDiaSiguiente?: boolean;
}

export function classifyTurno({ fecha, horaEntrada, horaSalida, salidaEsDelDiaSiguiente }: ShiftInput): Turno {
  // Sin entrada no asumimos tarde, por defecto M
  if (!horaEntrada) return 'M';

  const toMin = (hhmm: string) => {
    const parts = hhmm.split(':');
    if (parts.length < 2) return 0;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return h * 60 + m;
  };

  const ent = toMin(horaEntrada);
  const sal = horaSalida ? toMin(horaSalida) : undefined;

  // Detectar cruce de medianoche si no viene explícito
  let isCrossMidnight = false;
  if (salidaEsDelDiaSiguiente !== undefined) {
    isCrossMidnight = salidaEsDelDiaSiguiente;
  } else if (sal !== undefined && sal < ent) {
    isCrossMidnight = true;
  }

  // --- Reglas TN Revisadas (User Request 2024) ---
  // TN se analiza desde las 14:00 del dia 0 hasta las 06:00 del dia 1.
  // Por lo tanto, cualquier entrada >= 14:00 se considera TN.

  // 1. Entra a las 14:00 o despues
  if (ent >= 14 * 60) {
    return 'TN';
  }

  // 2. Si entra antes de las 14:00, pero la salida es del dia siguiente (ej: turno ultra largo o error), 
  // podria ser TN, pero por defecto asumimos M si entra < 14:00.
  // La regla "Los de la mañana, turno de 07:00 a 15:00" sugiere que si entras antes de 14:00 eres M.

  return 'M';
}

export function formatTimeRange(entrada?: string, salida?: string, salidaDiaSiguiente?: boolean): string {
  if (!entrada) return '-';

  // Asegurar formato corto HH:MM
  const entShort = entrada.length > 5 ? entrada.substring(0, 5) : entrada;

  if (!salida) {
    return `${entShort} - ??:??`;
  }

  const salShort = salida.length > 5 ? salida.substring(0, 5) : salida;
  const suffix = salidaDiaSiguiente ? ' (+1)' : '';

  return `${entShort} - ${salShort}${suffix}`;
}
