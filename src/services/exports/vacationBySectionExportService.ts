/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Exportación: Listado de Vacaciones por Sección
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Genera un Excel con una hoja por departamento/sección.
 * 
 * ⚠️ REGLA CLAVE: Las vacaciones NO se calculan a partir de incidencias.
 *    Se obtienen del CALENDARIO INDIVIDUAL de cada operario, contando
 *    cuántos días tienen TipoDia === "2" (Vacaciones).
 *
 * Cada hoja contiene:
 *   - Operario, Nombre
 *   - Días disfrutados en el periodo seleccionado
 *   - Días acumulados en el año (YTD) — todos los TipoDia=2 del año
 *   - Días de derecho (diasVacaciones del empleado o VACATION_DAYS)
 *   - Días que le quedan
 */

import ExcelJS from 'exceljs';
import * as FileSaver from 'file-saver';
import { User, Role } from '../../types';
import { ANNUAL_CREDITS } from '../../constants';
import { getCalendarioOperario, CalendarioDia } from '../erpApi';
import type { Operario } from '../erpApi';

const saveAs: (data: Blob, filename: string) => void =
    ((FileSaver as any).saveAs || (FileSaver as any).default || FileSaver) as any;

// ── Helpers ──────────────────────────────────────────────────────────────

const colRef = (col: number): string => {
    let result = '';
    let c = col;
    while (c > 0) {
        c--;
        result = String.fromCharCode(65 + (c % 26)) + result;
        c = Math.floor(c / 26);
    }
    return result;
};

/**
 * Cuenta días con TipoDia === "2" (vacaciones) en un array de CalendarioDia.
 */
const countVacationDays = (calendar: CalendarioDia[]): number => {
    return calendar.filter(day => String(day.TipoDia) === '2').length;
};

// ── Estilos compartidos ──────────────────────────────────────────────────

const styleSheet = (
    worksheet: ExcelJS.Worksheet,
    headerRow: number,
    dataRows: number,
    totalCols: number,
    accentColor: string = 'FF16A34A'
) => {
    for (let c = 1; c <= totalCols; c++) {
        const cell = worksheet.getCell(`${colRef(c)}${headerRow}`);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accentColor } };
        cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF8E8E8E' } },
            left: { style: 'thin', color: { argb: 'FF8E8E8E' } },
            bottom: { style: 'thin', color: { argb: 'FF8E8E8E' } },
            right: { style: 'thin', color: { argb: 'FF8E8E8E' } }
        };
    }

    for (let r = headerRow + 1; r <= headerRow + dataRows; r++) {
        const isOdd = (r - headerRow) % 2 === 1;
        for (let c = 1; c <= totalCols; c++) {
            const cell = worksheet.getCell(`${colRef(c)}${r}`);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: isOdd ? 'FFF0FDF4' : 'FFFFFFFF' }
            };
            cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E1E1E' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
        }
        worksheet.getCell(`B${r}`).alignment = { horizontal: 'left', vertical: 'middle' };
    }
};

// ── Exportación principal ────────────────────────────────────────────────

export interface VacationSectionExportProgress {
    percent: number;
    message: string;
}

export const generateVacationBySectionExport = async (
    periodStart: string,
    periodEnd: string,
    operarios: Operario[],
    onProgress?: (progress: VacationSectionExportProgress) => void
): Promise<void> => {
    onProgress?.({ percent: 2, message: 'Validando datos...' });

    // ── 1. Verificar Online ──────────────────────────────────────────
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Sin conexión. No es posible generar el listado de vacaciones.');
    }
    if (!operarios || operarios.length === 0) {
        throw new Error('No hay operarios para exportar.');
    }

    // ── 2. Obtener diasVacaciones de Firebase (crédito individual) ───
    let richDataMap: Map<number, number> = new Map();
    try {
        const { getEmployeeRichData } = await import('../employeeService');
        for (const op of operarios) {
            try {
                const richData = await getEmployeeRichData(op.IDOperario.toString());
                if (richData && typeof richData.DiasVacaciones === 'number') {
                    richDataMap.set(op.IDOperario, richData.DiasVacaciones);
                }
            } catch { /* silenciar errores individuales */ }
        }
    } catch { /* si el servicio falla, usamos el default */ }

    // ── 3. Consultar calendario individualizado de cada operario ─────
    onProgress?.({ percent: 10, message: 'Consultando calendarios individuales...' });
    const year = periodEnd.substring(0, 4);
    const ytdStart = `${year}-01-01`;
    const ytdEnd = periodEnd > `${year}-12-31` ? `${year}-12-31` : periodEnd;

    interface EmployeeVacData {
        operario: Operario;
        diasPeriodo: number;
        diasYTD: number;
        derecho: number;
    }

    const employeeData: EmployeeVacData[] = [];
    const activeOperarios = operarios.filter(op => op.Activo);
    const BATCH_SIZE = 5;

    for (let i = 0; i < activeOperarios.length; i += BATCH_SIZE) {
        const batch = activeOperarios.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
            batch.map(async (op): Promise<EmployeeVacData> => {
                const idStr = op.IDOperario.toString();
                let diasPeriodo = 0;
                let diasYTD = 0;

                try {
                    // Calendario del periodo seleccionado
                    const calPeriod = await getCalendarioOperario(idStr, periodStart, periodEnd);
                    diasPeriodo = countVacationDays(calPeriod);

                    // Si el periodo YTD es más amplio, consultar aparte
                    if (ytdStart < periodStart || ytdEnd > periodEnd) {
                        const calYTD = await getCalendarioOperario(idStr, ytdStart, ytdEnd);
                        diasYTD = countVacationDays(calYTD);
                    } else {
                        diasYTD = diasPeriodo;
                    }
                } catch {
                    // Si falla un operario, seguimos con 0 días
                }

                const derecho = richDataMap.get(op.IDOperario) ?? ANNUAL_CREDITS.VACATION_DAYS;

                return { operario: op, diasPeriodo, diasYTD, derecho };
            })
        );

        employeeData.push(...batchResults);

        onProgress?.({
            percent: 10 + Math.round(((i + batch.length) / activeOperarios.length) * 50),
            message: `Calendario ${Math.min(i + batch.length, activeOperarios.length)}/${activeOperarios.length} operarios...`
        });

        // Pausa entre lotes para no saturar la API
        if (i + BATCH_SIZE < activeOperarios.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    // ── 4. Agrupar por departamento ─────────────────────────────────
    onProgress?.({ percent: 65, message: 'Agrupando por sección...' });
    const departmentMap = new Map<string, EmployeeVacData[]>();
    employeeData.forEach(data => {
        const dept = data.operario.DescDepartamento || 'General';
        if (!departmentMap.has(dept)) departmentMap.set(dept, []);
        departmentMap.get(dept)!.push(data);
    });

    const sortedDepartments = Array.from(departmentMap.keys()).sort((a, b) =>
        a.localeCompare(b, 'es')
    );

    // ── 5. Generar Excel ────────────────────────────────────────────
    onProgress?.({ percent: 70, message: 'Construyendo Excel...' });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'APP PRESENCIA';
    workbook.created = new Date();

    const headers = ['Operario', 'Nombre', 'Días Periodo', 'Acum. Año', 'Derecho', 'Quedan'];
    const TOTAL_COLS = headers.length;

    sortedDepartments.forEach((dept, idx) => {
        const employees = departmentMap.get(dept)!;
        employees.sort((a, b) => a.operario.DescOperario.localeCompare(b.operario.DescOperario, 'es'));

        const sheetName = dept.length > 31 ? dept.substring(0, 31) : dept;

        const ws = workbook.addWorksheet(sheetName, {
            views: [{ state: 'frozen', ySplit: 3, showGridLines: false }]
        });

        ws.columns = [
            { width: 12 },
            { width: 32 },
            { width: 16 },
            { width: 14 },
            { width: 12 },
            { width: 12 },
        ];

        // Título
        ws.mergeCells(`A1:${colRef(TOTAL_COLS)}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `🏖️ LISTADO DE VACACIONES — ${dept.toUpperCase()}`;
        titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF166534' } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
        ws.getRow(1).height = 28;

        // Subtítulo
        ws.mergeCells(`A2:${colRef(TOTAL_COLS)}2`);
        const subCell = ws.getCell('A2');
        subCell.value = `Periodo: ${periodStart} → ${periodEnd} | Acum. anual: ${ytdStart} → ${ytdEnd} | ${employees.length} empleado(s) | Fuente: Calendario (TipoDia=2)`;
        subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };

        // Cabecera
        const headerRow = 3;
        headers.forEach((header, colIdx) => {
            ws.getCell(`${colRef(colIdx + 1)}${headerRow}`).value = header;
        });

        // Datos
        employees.forEach((data, empIdx) => {
            const rowNum = headerRow + 1 + empIdx;
            const operarioCode = `FV${String(data.operario.IDOperario).padStart(3, '0')}`;
            const quedan = Math.max(0, data.derecho - data.diasYTD);

            ws.getCell(`A${rowNum}`).value = operarioCode;
            ws.getCell(`B${rowNum}`).value = data.operario.DescOperario;
            ws.getCell(`C${rowNum}`).value = data.diasPeriodo;
            ws.getCell(`D${rowNum}`).value = data.diasYTD;
            ws.getCell(`E${rowNum}`).value = data.derecho;
            ws.getCell(`F${rowNum}`).value = quedan;

            if (quedan <= 0) {
                ws.getCell(`F${rowNum}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
            }
        });

        // Estilos
        styleSheet(ws, headerRow, employees.length, TOTAL_COLS, 'FF16A34A');

        // Fila de totales
        const totalRowNum = headerRow + 1 + employees.length;
        ws.getCell(`A${totalRowNum}`).value = '';
        ws.getCell(`B${totalRowNum}`).value = 'TOTAL SECCIÓN';
        ws.getCell(`B${totalRowNum}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF166534' } };
        ws.getCell(`C${totalRowNum}`).value = { formula: `SUM(C${headerRow + 1}:C${totalRowNum - 1})` };
        ws.getCell(`D${totalRowNum}`).value = { formula: `SUM(D${headerRow + 1}:D${totalRowNum - 1})` };
        ws.getCell(`E${totalRowNum}`).value = { formula: `SUM(E${headerRow + 1}:E${totalRowNum - 1})` };
        ws.getCell(`F${totalRowNum}`).value = { formula: `SUM(F${headerRow + 1}:F${totalRowNum - 1})` };

        for (let c = 1; c <= TOTAL_COLS; c++) {
            const cell = ws.getCell(`${colRef(c)}${totalRowNum}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBBF7D0' } };
            cell.font = { ...cell.font as any, bold: true };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF16A34A' } },
                bottom: { style: 'medium', color: { argb: 'FF16A34A' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        onProgress?.({
            percent: 70 + Math.round(((idx + 1) / sortedDepartments.length) * 20),
            message: `Hoja: ${dept}...`
        });
    });

    // ── 6. Guardar ──────────────────────────────────────────────────
    onProgress?.({ percent: 95, message: 'Guardando archivo...' });
    const startFormatted = periodStart.replace(/-/g, '');
    const endFormatted = periodEnd.replace(/-/g, '');
    const fileName = `Listado_Vacaciones_${startFormatted}_${endFormatted}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);

    onProgress?.({ percent: 100, message: `Excel listo: ${fileName}` });
};
