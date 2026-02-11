
import { RawDataRow, User } from '../../types';
import { ANNUAL_CREDITS } from '../../constants';
import { toISODateLocal } from '../../utils/localDate';
import { normalizeDateKey } from '../../utils/datetime';
import * as XLSX from 'xlsx';

export interface FreeHoursExportRow {
    op: string;
    nombre: string;
    colectivo: string;
    consumo: number;
    credito: number;
    queda: number;
}

const getDuration = (row: RawDataRow): number => {
    if (row.Inicio && row.Fin && row.Inicio !== '00:00' && row.Fin !== '00:00') {
        const [h1, m1] = row.Inicio.split(':').map(Number);
        const [h2, m2] = row.Fin.split(':').map(Number);
        const startMin = h1 * 60 + m1;
        const endMin = h2 * 60 + m2;
        if (endMin > startMin) return (endMin - startMin) / 60;
    }
    return 8;
};

export const exportFreeHoursToXlsx = (
    allRawDataYTD: RawDataRow[],
    allUsers: User[],
    exportDate: string
) => {
    const currentYear = new Date(exportDate).getFullYear();
    const ytdStartStr = `${currentYear}-01-01`;

    const rows: FreeHoursExportRow[] = allUsers.map(user => {
        const idOperario = user.id;
        const empRawYTD = allRawDataYTD.filter(r => {
            const dateKey = normalizeDateKey(r.Fecha);
            return r.IDOperario === idOperario && dateKey >= ytdStartStr && dateKey <= exportDate;
        });

        // Motivo 7: Libre Disposición (Horas Libres)
        const consumo = empRawYTD
            .filter(r => r.MotivoAusencia === 7 && r.Entrada === 0)
            .reduce((acc, r) => acc + getDuration(r), 0);

        const credito = ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS;
        const queda = credito - consumo;

        let colectivo = "";
        const sample = allRawDataYTD.find(r => r.IDOperario === idOperario);
        if (sample) colectivo = sample.DescDepartamento;

        return {
            op: `FV${idOperario.toString().padStart(2, '0')}`,
            nombre: user.name,
            colectivo,
            consumo,
            credito,
            queda
        };
    });

    const wb = XLSX.utils.book_new();
    const headers = ["OP", "NOMBRE", "COLECTIVO", `CONSUMO H. LIBRES A ${exportDate}`, "CREDITO", "CUANTO QUEDA"];
    const data = rows.map(r => [r.op, r.nombre, r.colectivo, r.consumo, r.credito, r.queda]);

    const wsData = [
        [`Exportación de Horas Libres - Fecha: ${exportDate}`],
        headers,
        ...data
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Horas Libres");
    XLSX.writeFile(wb, `Horas_Libres_${exportDate}.xlsx`);
};
