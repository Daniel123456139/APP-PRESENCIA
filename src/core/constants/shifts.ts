/**
 * Definiciones de horarios estáticos de la empresa.
 * Se utiliza para determinar los límites teóricos de los turnos.
 */
export const SHIFT_SPECS = [
    { code: 'M', start: '07:00', end: '15:00' },
    { code: 'T', start: '15:00', end: '23:00' },
    { code: 'TN', start: '22:00', end: '06:00' },
    { code: 'C', start: '08:00', end: '17:00' }, // Central
    { code: 'N', start: '23:00', end: '07:00' }, // Noche
    { code: 'V', start: '00:00', end: '00:00' }, // Vacaciones (virtual)
    { code: 'L', start: '00:00', end: '00:00' }, // Libre (virtual)
    { code: 'F', start: '00:00', end: '00:00' }, // Festivo (virtual)
];
