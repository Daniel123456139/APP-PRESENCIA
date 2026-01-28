
import { RawDataRow, User } from '../types';
import * as XLSX from 'xlsx';

export interface VacationManagementRow {
    operario: string;
    diasSueltos: string;
    periodo1: string;
    periodo2: string;
    periodo3: string;
    derechoYDisfrute: number;
    quedan: number;
}

const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
};

const isConsecutiveWeek = (dates: string[]): boolean => {
    if (dates.length !== 5) return false;
    const sorted = [...dates].sort();
    for (let i = 0; i < 4; i++) {
        const d1 = new Date(sorted[i]);
        const d2 = new Date(sorted[i + 1]);
        const diff = (d2.getTime() - d1.getTime()) / (1000 * 3600 * 24);
        if (diff !== 1) return false;
    }
    // Check if it's Mon-Fri
    const first = new Date(sorted[0]);
    return first.getDay() === 1; // 1 = Monday
};

export const exportVacationManagementToXlsx = (
    erpData: RawDataRow[],
    targetEmployees: User[],
    year: number = 2026
) => {
    const P1_START = `${year}-08-03`;
    const P1_END = `${year}-08-07`;
    const P2_START = `${year}-08-24`;
    const P2_END = `${year}-08-28`;

    const data: VacationManagementRow[] = targetEmployees.map(emp => {
        const empVacDates = erpData
            .filter(r => r.IDOperario === emp.id && (r.MotivoAusencia === 5 || r.MotivoAusencia === 8) && r.Fecha.startsWith(year.toString()))
            .map(r => r.Fecha)
            .filter((v, i, a) => a.indexOf(v) === i) // Unique
            .sort();

        let p1 = '';
        let p2 = '';
        let p3 = '';
        const usedInP = new Set<string>();

        // Check P1
        const p1Dates = empVacDates.filter(d => d >= P1_START && d <= P1_END);
        if (p1Dates.length === 5) {
            p1 = `${formatDate(P1_START)} - ${formatDate(P1_END)}`;
            p1Dates.forEach(d => usedInP.add(d));
        }

        // Check P2
        const p2Dates = empVacDates.filter(d => d >= P2_START && d <= P2_END);
        if (p2Dates.length === 5) {
            p2 = `${formatDate(P2_START)} - ${formatDate(P2_END)}`;
            p2Dates.forEach(d => usedInP.add(d));
        }

        // Check P3 (Any other 5 consecutive working days Mon-Fri)
        const remainingForP3 = empVacDates.filter(d => !usedInP.has(d));
        // We need to find a window of 5 consecutive days that is Mon-Fri
        for (let i = 0; i <= remainingForP3.length - 5; i++) {
            const window = remainingForP3.slice(i, i + 5);
            if (isConsecutiveWeek(window)) {
                p3 = `${formatDate(window[0])} - ${formatDate(window[4])}`;
                window.forEach(d => usedInP.add(d));
                break; // Only one P3? The UI shows one slot.
            }
        }

        // Remaining are "Dias Sueltos"
        const sueltos = empVacDates.filter(d => !usedInP.has(d));
        const sueltosStr = sueltos.map(formatDate).join('\n');

        const derecho = 12;
        const consumidos = empVacDates.length;
        const quedan = derecho - consumidos;

        return {
            operario: `FV${emp.id.toString().padStart(3, '0')} - ${emp.name}`,
            diasSueltos: sueltosStr,
            periodo1: p1,
            periodo2: p2,
            periodo3: p3,
            derechoYDisfrute: derecho,
            quedan: quedan < 0 ? 0 : quedan
        };
    });

    const wb = XLSX.utils.book_new();
    const wsData = [
        ["OPERARIO", "DIAS SUELTOS", "PERIODO 1", "PERIODO 2", "PERIODO 3", "DIAS DERECHO Y DISFRUTE", "DIAS QUE QUEDAN"],
        ...data.map(r => [r.operario, r.diasSueltos, r.periodo1, r.periodo2, r.periodo3, r.derechoYDisfrute, r.quedan])
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto-calculate column widths
    const colWidths = [35, 20, 25, 25, 25, 25, 20];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, "Gestión Vacaciones");
    XLSX.writeFile(wb, `Gestion_Vacaciones_${year}.xlsx`);
};
