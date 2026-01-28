
export const formatPeriodoAnalisis = (fechaInicioISO: string, fechaFinISO: string): string => {
    if (!fechaInicioISO || !fechaFinISO) return '';

    const meses = [
        "enero", "febrero", "marzo", "abril", "mayo", "junio",
        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
    ];

    // Asegurar parsing correcto evitando problemas de zona horaria (UTC vs Local)
    // Asumimos formato YYYY-MM-DD
    const parseDate = (iso: string) => {
        const parts = iso.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };

    const d1 = parseDate(fechaInicioISO);
    const d2 = parseDate(fechaFinISO);

    const dia1 = d1.getDate();
    const dia2 = d2.getDate();
    const mes1 = meses[d1.getMonth()];
    const mes2 = meses[d2.getMonth()];

    // Helper para formatear número a 2 dígitos si se quisiera, 
    // pero el ejemplo pide "9" o "09". Usaremos el número natural del getDate() 
    // o padStart si queremos consistencia visual con el ejemplo "09". 
    // El ejemplo dice "09", así que usaremos padStart.
    const fDia = (d: number) => d.toString().padStart(2, '0');

    // Caso 1: Mismo día
    if (d1.getTime() === d2.getTime()) {
        return `${fDia(dia1)} de ${mes1}`;
    }

    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    // Mismo mes
    if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
        // Caso 2: Consecutivos (diferencia 1 día)
        if (diffDays === 1) {
            return `${fDia(dia1)} y ${fDia(dia2)} de ${mes1}`;
        }
        // Caso 3: Rango mismo mes
        return `del ${fDia(dia1)} al ${fDia(dia2)} de ${mes1}`;
    }

    // Caso 4: Cruce de mes
    // Consecutivos entre meses o rango general se tratan igual según especificación:
    // "Consecutivos -> DD de <mes> y DD de <mes>" vs "Rango -> del DD de <mes> al DD de <mes>"
    
    if (diffDays === 1) {
        return `${fDia(dia1)} de ${mes1} y ${fDia(dia2)} de ${mes2}`;
    }

    return `del ${fDia(dia1)} de ${mes1} al ${fDia(dia2)} de ${mes2}`;
};
