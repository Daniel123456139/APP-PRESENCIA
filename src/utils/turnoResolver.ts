
import { RawDataRow } from '../types';

export function resolveTurno(row: RawDataRow): { code: 'M' | 'TN' | 'UNKNOWN', label: string } {
    // Si no hay IDTipoTurno, no inventamos
    if (!row.IDTipoTurno) {
        return { code: 'UNKNOWN', label: 'Sin Turno' };
    }
    
    const tipo = String(row.IDTipoTurno).toUpperCase();
    const texto = (row.TurnoTexto || '').toUpperCase();

    // Lógica basada en códigos conocidos o texto descriptivo del backend
    if (tipo.includes('TN') || tipo.includes('NOCHE') || texto.includes('NOCHE') || texto.includes('TARDE')) {
        return { code: 'TN', label: 'Tarde/Noche' };
    }
    
    if (tipo.includes('M') || texto.includes('MAÑANA')) {
        return { code: 'M', label: 'Mañana' };
    }

    // Fallback conservador si hay ID pero no machea reglas específicas
    return { code: 'M', label: 'Mañana' };
}
