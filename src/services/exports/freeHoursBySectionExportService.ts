/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Exportación: Listado de Horas Libres (Libre Disposición) por Sección
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Genera un Excel con una hoja por departamento/sección.
 * Cada hoja contiene una tabla con:
 *   - Operario, Nombre
 *   - Horas gastadas en el periodo seleccionado
 *   - Horas acumuladas en el año (YTD)
 *   - Horas de derecho (LIBRE_DISPOSICION_HOURS = 8h)
 *   - Horas que le quedan
 *
 * Código de incidencia utilizado: 07 (Libre Disposición)
 */

import ExcelJS from 'exceljs';
import * as FileSaver from 'file-saver';
import { RawDataRow, User, Role } from '../../types';
import { ANNUAL_CREDITS } from '../../constants';
import type { Operario } from '../erpApi';

const saveAs: (data: Blob, filename: string) => void =
    ((FileSaver as any).saveAs || (FileSaver as any).default || FileSaver) as any;

// ── Helpers ──────────────────────────────────────────────────────────────

const normalizeDateStr = (raw: string): string =>
    (raw || '').trim().substring(0, 10);

const normalizeTimeStr = (raw: string): string => {
    if (!raw) return '00:00';
    const clean = (raw || '').trim();
    if (clean.length === 5) return clean;
    if (clean.length === 8) return clean.substring(0, 5);
    return clean;
};

const getMinutes = (timeStr: string): number => {
    const parts = normalizeTimeStr(timeStr).split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
};

const toMotivoNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const isEntrada = (entrada: boolean | number | string | null | undefined): boolean =>
    entrada === true || entrada === 1 || entrada === '1';

const round2 = (v: number): number => Math.round(v * 100) / 100;

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
 * Calcula horas de Libre Disposición (código 07) consumidas por un empleado
 * en un rango de fechas, usando emparejamiento de fichajes entrada/salida.
 */
const countFreeHoursInRange = (
    rows: RawDataRow[],
    employeeId: number,
    rangeStart: string,
    rangeEnd: string
): number => {
    // Filtrar filas del empleado en el rango con código 07
    const relevantRows = rows
        .filter(row => {
            if (Number(row.IDOperario) !== employeeId) return false;
            const date = normalizeDateStr(row.Fecha);
            if (!date || date < rangeStart || date > rangeEnd) return false;
            return true;
        })
        .sort((a, b) => {
            if (a.Fecha !== b.Fecha) return a.Fecha.localeCompare(b.Fecha);
            return a.Hora.localeCompare(b.Hora);
        });

    let totalMinutes = 0;

    // Buscar pares: entrada normal + salida con motivo 07
    for (let i = 0; i < relevantRows.length - 1; i++) {
        const current = relevantRows[i];
        const next = relevantRows[i + 1];

        // Par: entrada (motivo normal) seguida de salida con motivo 07
        if (isEntrada(current.Entrada) && !isEntrada(next.Entrada)) {
            const motivo = toMotivoNumber(next.MotivoAusencia);
            if (motivo === 7) {
                const startMin = getMinutes(current.Hora);
                const endMin = getMinutes(next.Hora);
                if (endMin > startMin) {
                    totalMinutes += (endMin - startMin);
                    i++; // Saltar el par consumido
                }
            }
        }
    }

    // Fallback: también buscar filas con Inicio/Fin explícito y código 07
    relevantRows.forEach(row => {
        const motivo = toMotivoNumber(row.MotivoAusencia);
        if (motivo !== 7) return;
        if (row.Inicio && row.Fin) {
            const startMin = getMinutes(row.Inicio);
            const endMin = getMinutes(row.Fin);
            if (endMin > startMin) {
                // Solo sumar si no lo hemos contado ya por pares
                // Verificamos si ya está contado revisando la hora de la fila
                const rowTime = getMinutes(row.Hora);
                const alreadyCounted = relevantRows.some((r, idx) => {
                    if (idx >= relevantRows.length - 1) return false;
                    const nextR = relevantRows[idx + 1];
                    return isEntrada(r.Entrada) &&
                        !isEntrada(nextR.Entrada) &&
                        toMotivoNumber(nextR.MotivoAusencia) === 7 &&
                        getMinutes(nextR.Hora) === rowTime;
                });
                if (!alreadyCounted) {
                    totalMinutes += (endMin - startMin);
                }
            }
        }
    });

    return round2(totalMinutes / 60);
};

// ── Estilos compartidos ──────────────────────────────────────────────────

const styleSheet = (
    worksheet: ExcelJS.Worksheet,
    headerRow: number,
    dataRows: number,
    totalCols: number,
    accentColor: string = 'FF7C3AED' // púrpura
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
                fgColor: { argb: isOdd ? 'FFF5F3FF' : 'FFFFFFFF' }  // púrpura-50 alternado
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

export interface FreeHoursSectionExportProgress {
    percent: number;
    message: string;
}

export const generateFreeHoursBySectionExport = async (
    periodStart: string,
    periodEnd: string,
    operarios: Operario[],
    onProgress?: (progress: FreeHoursSectionExportProgress) => void
): Promise<void> => {
    const { fetchFichajesBatched } = await import('../apiService');

    onProgress?.({ percent: 2, message: 'Validando datos...' });

    // ── 1. Verificar Online ──────────────────────────────────────────
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Sin conexión. No es posible generar el listado de horas libres.');
    }
    if (!operarios || operarios.length === 0) {
        throw new Error('No hay operarios para exportar.');
    }

    // ── 2. Construir lista de usuarios ──────────────────────────────
    const users: User[] = operarios.map(op => ({
        id: op.IDOperario,
        name: op.DescOperario,
        role: Role.Employee,
        department: op.DescDepartamento || 'General',
    }));

    // ── 3. Cargar fichajes del periodo ──────────────────────────────
    onProgress?.({ percent: 10, message: 'Cargando fichajes del periodo...' });
    let rawDataPeriod: RawDataRow[];
    try {
        rawDataPeriod = await fetchFichajesBatched(periodStart, periodEnd, '', '', '', 10);
    } catch (err: any) {
        throw new Error(`Error al leer fichajes del periodo: ${err.message || 'Error desconocido'}`);
    }

    // ── 4. Cargar fichajes YTD ──────────────────────────────────────
    onProgress?.({ percent: 30, message: 'Cargando fichajes acumulados del año...' });
    const year = periodEnd.substring(0, 4);
    const ytdStart = `${year}-01-01`;
    const ytdEnd = periodEnd > `${year}-12-31` ? `${year}-12-31` : periodEnd;
    let rawDataYTD: RawDataRow[];
    try {
        rawDataYTD = await fetchFichajesBatched(ytdStart, ytdEnd, '', '', '', 15);
    } catch (err: any) {
        throw new Error(`Error al leer fichajes anuales: ${err.message || 'Error desconocido'}`);
    }

    // ── 5. Agrupar empleados por departamento ───────────────────────
    onProgress?.({ percent: 55, message: 'Calculando acumulados por sección...' });
    const departmentMap = new Map<string, User[]>();
    users.forEach(user => {
        const dept = user.department || 'General';
        if (!departmentMap.has(dept)) departmentMap.set(dept, []);
        departmentMap.get(dept)!.push(user);
    });

    const sortedDepartments = Array.from(departmentMap.keys()).sort((a, b) =>
        a.localeCompare(b, 'es')
    );

    // ── 6. Generar Excel ────────────────────────────────────────────
    onProgress?.({ percent: 65, message: 'Construyendo Excel...' });
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'APP PRESENCIA';
    workbook.created = new Date();

    const HOURS_FORMAT = '0.00';
    const headers = ['Operario', 'Nombre', 'Horas Periodo', 'Acum. Año', 'Derecho (h)', 'Quedan (h)'];
    const TOTAL_COLS = headers.length;

    sortedDepartments.forEach((dept, idx) => {
        const employees = departmentMap.get(dept)!;
        employees.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

        const sheetName = dept.length > 31 ? dept.substring(0, 31) : dept;

        const ws = workbook.addWorksheet(sheetName, {
            views: [{ state: 'frozen', ySplit: 3, showGridLines: false }]
        });

        ws.columns = [
            { width: 12 },  // Operario
            { width: 32 },  // Nombre
            { width: 16 },  // Horas Periodo
            { width: 14 },  // Acum. Año
            { width: 14 },  // Derecho
            { width: 14 },  // Quedan
        ];

        // Título
        ws.mergeCells(`A1:${colRef(TOTAL_COLS)}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `⏰ LISTADO DE HORAS LIBRES — ${dept.toUpperCase()}`;
        titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF5B21B6' } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE9FE' } };
        ws.getRow(1).height = 28;

        // Subtítulo
        ws.mergeCells(`A2:${colRef(TOTAL_COLS)}2`);
        const subCell = ws.getCell('A2');
        subCell.value = `Periodo: ${periodStart} → ${periodEnd} | Acumulado anual: ${ytdStart} → ${ytdEnd} | ${employees.length} empleado(s)`;
        subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF6B7280' } };
        subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };

        // Cabecera de tabla
        const headerRow = 3;
        headers.forEach((header, colIdx) => {
            ws.getCell(`${colRef(colIdx + 1)}${headerRow}`).value = header;
        });

        // Datos
        employees.forEach((emp, empIdx) => {
            const rowNum = headerRow + 1 + empIdx;
            const empId = Number(emp.id);
            const operarioCode = `FV${String(empId).padStart(3, '0')}`;
            const horasPeriodo = countFreeHoursInRange(rawDataPeriod, empId, periodStart, periodEnd);
            const horasYTD = countFreeHoursInRange(rawDataYTD, empId, ytdStart, ytdEnd);
            const derecho = ANNUAL_CREDITS.LIBRE_DISPOSICION_HOURS;
            const quedan = round2(Math.max(0, derecho - horasYTD));

            ws.getCell(`A${rowNum}`).value = operarioCode;
            ws.getCell(`B${rowNum}`).value = emp.name;
            ws.getCell(`C${rowNum}`).value = horasPeriodo;
            ws.getCell(`C${rowNum}`).numFmt = HOURS_FORMAT;
            ws.getCell(`D${rowNum}`).value = horasYTD;
            ws.getCell(`D${rowNum}`).numFmt = HOURS_FORMAT;
            ws.getCell(`E${rowNum}`).value = derecho;
            ws.getCell(`E${rowNum}`).numFmt = HOURS_FORMAT;
            ws.getCell(`F${rowNum}`).value = quedan;
            ws.getCell(`F${rowNum}`).numFmt = HOURS_FORMAT;

            // Resaltar en rojo si quedan <= 0
            if (quedan <= 0) {
                ws.getCell(`F${rowNum}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
            }
        });

        // Aplicar estilos
        styleSheet(ws, headerRow, employees.length, TOTAL_COLS, 'FF7C3AED');

        // Fila de totales
        const totalRowNum = headerRow + 1 + employees.length;
        ws.getCell(`A${totalRowNum}`).value = '';
        ws.getCell(`B${totalRowNum}`).value = 'TOTAL SECCIÓN';
        ws.getCell(`B${totalRowNum}`).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF5B21B6' } };
        ws.getCell(`C${totalRowNum}`).value = { formula: `SUM(C${headerRow + 1}:C${totalRowNum - 1})` };
        ws.getCell(`C${totalRowNum}`).numFmt = HOURS_FORMAT;
        ws.getCell(`D${totalRowNum}`).value = { formula: `SUM(D${headerRow + 1}:D${totalRowNum - 1})` };
        ws.getCell(`D${totalRowNum}`).numFmt = HOURS_FORMAT;
        ws.getCell(`E${totalRowNum}`).value = { formula: `SUM(E${headerRow + 1}:E${totalRowNum - 1})` };
        ws.getCell(`E${totalRowNum}`).numFmt = HOURS_FORMAT;
        ws.getCell(`F${totalRowNum}`).value = { formula: `SUM(F${headerRow + 1}:F${totalRowNum - 1})` };
        ws.getCell(`F${totalRowNum}`).numFmt = HOURS_FORMAT;

        for (let c = 1; c <= TOTAL_COLS; c++) {
            const cell = ws.getCell(`${colRef(c)}${totalRowNum}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9D5FF' } };
            cell.font = { ...cell.font as any, bold: true };
            cell.border = {
                top: { style: 'medium', color: { argb: 'FF7C3AED' } },
                bottom: { style: 'medium', color: { argb: 'FF7C3AED' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        onProgress?.({
            percent: 65 + Math.round(((idx + 1) / sortedDepartments.length) * 25),
            message: `Procesando sección: ${dept}...`
        });
    });

    // ── 7. Guardar ──────────────────────────────────────────────────
    onProgress?.({ percent: 95, message: 'Guardando archivo...' });
    const startFormatted = periodStart.replace(/-/g, '');
    const endFormatted = periodEnd.replace(/-/g, '');
    const fileName = `Listado_Horas_Libres_${startFormatted}_${endFormatted}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);

    onProgress?.({ percent: 100, message: `Excel listo: ${fileName}` });
};
