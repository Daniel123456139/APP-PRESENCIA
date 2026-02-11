import { ProcessedDataRow } from '../../types';
import * as XLSX from 'xlsx';

export const exportUnproductivityToXlsx = (
    data: ProcessedDataRow[],
    filename: string,
    periodStr: string
) => {

    // 1. Definir las columnas de "Actividad" (Tipos de incidencia)
    const incidentKeys = [
        { key: 'hMedico', label: 'Médico' },
        { key: 'hVacaciones', label: 'Vacaciones' },
        { key: 'hLDisp', label: 'Libre Disposición' },
        { key: 'hLeyFam', label: 'Ley Familias' },
        { key: 'asOficiales', label: 'Asuntos Oficiales' },
        { key: 'hEspecialistaAccidente', label: 'Especialista/Accidente' },
        { key: 'hSindicales', label: 'Horas Sindicales' },
        { key: 'hITAT', label: 'ITAT' },
        { key: 'hITEC', label: 'ITEC' },
        { key: 'hVacAnt', label: 'Vac. Año Anterior' },
        { key: 'asPropios', label: 'Asuntos Propios' },
        { key: 'hTAJ', label: 'TAJ' }
    ] as const;

    // 2. Agrupar por Sección (Colectivo)
    const groupedBySection = new Map<string, Record<string, number>>();

    data.forEach(row => {
        const section = row.colectivo || 'Sin Sección';
        if (!groupedBySection.has(section)) {
            groupedBySection.set(section, {});
            // Inicializar contadores
            incidentKeys.forEach(k => {
                groupedBySection.get(section)![k.key] = 0;
            });
        }

        const sectionTotals = groupedBySection.get(section)!;
        incidentKeys.forEach(k => {
            // @ts-ignore - Dynamic access to strictly typed keys
            const val = row[k.key] || 0;
            sectionTotals[k.key] = (sectionTotals[k.key] || 0) + val;
        });
    });

    // 3. Construir filas para Excel
    const excelRows: any[] = [];

    // Header Row
    // Sección | Médico | Vacaciones | ... | TOTAL
    const headerRow: any = { 'Sección': 'Sección' };
    incidentKeys.forEach(k => headerRow[k.label] = k.label);
    headerRow['TOTAL'] = 'TOTAL';
    excelRows.push(headerRow); // Note: Simple Push for now, but XLSX.utils.json_to_sheet handles headers differently usually.
    // Better strategy for json_to_sheet is array of objects.

    const finalRows: any[] = [];

    Array.from(groupedBySection.keys()).sort().forEach(section => {
        const counts = groupedBySection.get(section)!;
        const rowObj: any = { 'Sección': section };
        let rowTotal = 0;

        incidentKeys.forEach(k => {
            const val = counts[k.key] || 0;
            rowObj[k.label] = Number(val.toFixed(2));
            rowTotal += val;
        });

        rowObj['TOTAL'] = Number(rowTotal.toFixed(2));
        finalRows.push(rowObj);
    });

    // Add Grand Total Row
    const grandTotalRow: any = { 'Sección': 'TOTAL GENERAL' };
    let grandTotalSum = 0;
    incidentKeys.forEach(k => {
        const colTotal = finalRows.reduce((sum, r) => sum + (r[k.label] || 0), 0);
        grandTotalRow[k.label] = Number(colTotal.toFixed(2));
        grandTotalSum += colTotal;
    });
    grandTotalRow['TOTAL'] = Number(grandTotalSum.toFixed(2));
    finalRows.push(grandTotalRow);


    // 4. Generar Workbook
    const workbook = XLSX.utils.book_new();

    // SHEET 1: RESUMEN SECCIÓN (Original)
    const worksheet = XLSX.utils.json_to_sheet(finalRows);

    // Auto-width columns for Sheet 1
    const objectMaxLength: number[] = [];
    const colKeys = Object.keys(finalRows[0]);
    colKeys.forEach((key) => {
        objectMaxLength.push(
            Math.max(
                ...finalRows.map((obj) => (obj[key] ? obj[key].toString().length : 0)),
                key.length
            )
        );
    });
    worksheet['!cols'] = objectMaxLength.map((w) => ({ width: w + 2 }));

    XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen Sección");

    // SHEET 2: DETALLE EMPLEADOS (New)
    const detailedRows = data.map(row => {
        const rowObj: any = {
            'ID': row.operario,
            'Nombre': row.nombre,
            'Sección': row.colectivo || 'Sin Sección',
            'Turno': row.turnoAsignado || '',
            'Presencia': row.presencia
        };

        // Add incidents
        incidentKeys.forEach(k => {
            // @ts-ignore
            rowObj[k.label] = Number((row[k.key] || 0).toFixed(2));
        });

        // Use the total calculated by dataProcessor
        rowObj['TOTAL'] = row.horasTotalesConJustificacion;

        return rowObj;
    });

    // Sort detailed rows by Name
    detailedRows.sort((a, b) => a.Nombre.localeCompare(b.Nombre));

    const worksheetDetail = XLSX.utils.json_to_sheet(detailedRows);

    // Auto-width for Sheet 2
    if (detailedRows.length > 0) {
        const detailKeys = Object.keys(detailedRows[0]);
        const detailWidths = detailKeys.map(key => {
            return Math.max(
                ...detailedRows.map(obj => (obj[key] ? obj[key].toString().length : 0)),
                key.length
            ) + 2;
        });
        worksheetDetail['!cols'] = detailWidths.map(w => ({ width: w }));
    }

    XLSX.utils.book_append_sheet(workbook, worksheetDetail, "Detalle Empleados");

    XLSX.writeFile(workbook, filename);
};
