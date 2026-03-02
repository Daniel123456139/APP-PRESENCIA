/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EXPORTACIÓN: PLANIFICACIÓN DE VACACIONES POR SECCIÓN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Genera un Excel con una hoja por sección/departamento.
 *
 * ⚠️ FUENTE DE DATOS: Calendario individual del operario (TipoDia = "2").
 *    NO se usan incidencias. Se consulta getCalendarioOperario() del ERP.
 *
 * CLASIFICACIÓN DE DÍAS (Año 2026):
 *   - CIERRE OBLIGATORIO: 10/08 al 14/08 + 17/08 al 21/08 (10 laborables)
 *   - PERIODO 1: 03/08 al 07/08 (semana previa al cierre)
 *   - PERIODO 2: 24/08 al 28/08 (semana posterior al cierre)
 *   - PERIODO 3: Otros bloques de ≥3 días consecutivos
 *   - DÍAS SUELTOS: Días individuales o pares fuera de los anteriores
 *
 * COLUMNAS:
 *   1. Operario          — FV + ID + Nombre
 *   2. Días Sueltos      — Fechas individuales (dd/mm/yyyy, multilínea)
 *   3. Periodo 1         — Rango dd/mm/yyyy - dd/mm/yyyy o "-"
 *   4. Periodo 2         — Rango o "-"
 *   5. Periodo 3         — Rango(s) o "-"
 *   6. Días derecho disfrute y Resto — Crédito anual (diasVacaciones o 22)
 *   7. Días Totales incluido cierre  — Todos los TipoDia=2 del año
 *   8. Días que quedan   — derecho - (totales - días_en_cierre)
 *
 * ESTILO: Replica el estilo del export de nóminas (addTable, bordes, colores).
 */

import ExcelJS from 'exceljs';
import * as FileSaver from 'file-saver';
import { ANNUAL_CREDITS } from '../../constants';
import { getCalendarioOperario, CalendarioDia } from '../erpApi';
import type { Operario } from '../erpApi';

const saveAs: (data: Blob, filename: string) => void =
    ((FileSaver as any).saveAs || (FileSaver as any).default || FileSaver) as any;

// ══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE PERIODOS 2026
// ══════════════════════════════════════════════════════════════════════════

// Cierre obligatorio de empresa (dos semanas de agosto)
const CIERRE_DATES = new Set([
    '2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14',
    '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21'
]);

// Periodo 1: semana anterior al cierre
const P1_DATES = new Set([
    '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'
]);

// Periodo 2: semana posterior al cierre
const P2_DATES = new Set([
    '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28'
]);

// ══════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════

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

/** Convierte YYYY-MM-DD → DD/MM/YYYY */
const fmt = (d: string) => {
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
};

/** Normaliza fecha a YYYY-MM-DD */
const norm = (raw: string): string => {
    if (!raw) return '';
    const clean = raw.trim();
    if (clean.includes('T')) return clean.split('T')[0];
    if (clean.includes('/')) {
        const parts = clean.split('/');
        if (parts[0].length === 4) return clean;
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return clean.substring(0, 10);
};

// ══════════════════════════════════════════════════════════════════════════
// LÓGICA DE CLASIFICACIÓN
// ══════════════════════════════════════════════════════════════════════════

interface ClassifiedResult {
    sueltos: string[];        // Fechas dd/mm/yyyy
    p1Range: string;          // "dd/mm/yyyy - dd/mm/yyyy" o "-"
    p2Range: string;          // ídem
    p3Ranges: string[];       // Array de rangos
    totalDays: number;        // Todos los TipoDia=2 del año
    daysInClosure: number;    // Días TipoDia=2 dentro de cierre
    daysOutsideClosure: number; // totalDays - daysInClosure
}

const classifyVacationDays = (calendar: CalendarioDia[]): ClassifiedResult => {
    // Extraer solo los días de vacaciones
    const vacDates = calendar
        .filter(d => String(d.TipoDia) === '2')
        .map(d => norm(d.Fecha))
        .filter(Boolean)
        .sort();

    const result: ClassifiedResult = {
        sueltos: [],
        p1Range: '-',
        p2Range: '-',
        p3Ranges: [],
        totalDays: vacDates.length,
        daysInClosure: 0,
        daysOutsideClosure: 0
    };

    if (vacDates.length === 0) {
        return result;
    }

    // Clasificar cada fecha en su categoría
    const p1Days: string[] = [];
    const p2Days: string[] = [];
    const closureDays: string[] = [];
    const otherDays: string[] = [];

    vacDates.forEach(date => {
        if (CIERRE_DATES.has(date)) {
            closureDays.push(date);
        } else if (P1_DATES.has(date)) {
            p1Days.push(date);
        } else if (P2_DATES.has(date)) {
            p2Days.push(date);
        } else {
            otherDays.push(date);
        }
    });

    result.daysInClosure = closureDays.length;
    result.daysOutsideClosure = result.totalDays - result.daysInClosure;

    // P1: Mostrar rango si hay al menos 1 día
    if (p1Days.length > 0) {
        result.p1Range = p1Days.length === 1
            ? fmt(p1Days[0])
            : `${fmt(p1Days[0])} - ${fmt(p1Days[p1Days.length - 1])}`;
    }

    // P2: ídem
    if (p2Days.length > 0) {
        result.p2Range = p2Days.length === 1
            ? fmt(p2Days[0])
            : `${fmt(p2Days[0])} - ${fmt(p2Days[p2Days.length - 1])}`;
    }

    // "otherDays" → Separar en bloques consecutivos (P3) y sueltos
    if (otherDays.length > 0) {
        // Agrupar en bloques consecutivos (considerando fines de semana como puente)
        const blocks: string[][] = [];
        let currentBlock: string[] = [otherDays[0]];

        for (let i = 1; i < otherDays.length; i++) {
            const prev = new Date(otherDays[i - 1] + 'T00:00:00');
            const curr = new Date(otherDays[i] + 'T00:00:00');
            const diffDays = Math.round((curr.getTime() - prev.getTime()) / (86400000));

            // Si están separados por 1 día (consecutivo) o 2-3 días (fin de semana)
            if (diffDays <= 3) {
                currentBlock.push(otherDays[i]);
            } else {
                blocks.push([...currentBlock]);
                currentBlock = [otherDays[i]];
            }
        }
        blocks.push(currentBlock);

        // Bloques de ≥3 días → P3, resto → sueltos
        blocks.forEach(block => {
            if (block.length >= 3) {
                result.p3Ranges.push(`${fmt(block[0])} - ${fmt(block[block.length - 1])}`);
            } else {
                block.forEach(d => result.sueltos.push(fmt(d)));
            }
        });
    }

    return result;
};

// ══════════════════════════════════════════════════════════════════════════
// EXPORTACIÓN PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════

export interface VacationSectionExportProgress {
    percent: number;
    message: string;
}

export const generateVacationBySectionExport = async (
    _periodStart: string,
    _periodEnd: string,
    operarios: Operario[],
    onProgress?: (progress: VacationSectionExportProgress) => void
): Promise<void> => {
    onProgress?.({ percent: 2, message: 'Validando datos...' });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('Sin conexión. No es posible generar el listado de vacaciones.');
    }
    if (!operarios || operarios.length === 0) {
        throw new Error('No hay operarios para exportar.');
    }

    const year = '2026';
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const exportTimestamp = new Date().toLocaleString('es-ES', { hour12: false });

    // ── 1. Obtener diasVacaciones individuales de Firebase ───────────
    onProgress?.({ percent: 5, message: 'Consultando créditos de vacaciones...' });
    const richDataMap = new Map<number, number>();
    try {
        const { getEmployeeRichData } = await import('../employeeService');
        for (let i = 0; i < operarios.length; i += 8) {
            const batch = operarios.slice(i, i + 8);
            await Promise.all(batch.map(async op => {
                try {
                    const rd = await getEmployeeRichData(op.IDOperario.toString());
                    if (rd?.DiasVacaciones && typeof rd.DiasVacaciones === 'number') {
                        richDataMap.set(op.IDOperario, rd.DiasVacaciones);
                    }
                } catch { /* silenciar */ }
            }));
        }
    } catch { /* si el servicio no existe, usamos default */ }

    // ── 2. Consultar calendario de cada operario activo ──────────────
    onProgress?.({ percent: 10, message: 'Consultando calendarios individuales...' });

    interface EmployeeRow {
        operario: string;           // "FV010 - ADAN TOLEDO JORGE"
        sueltos: string;            // Multilínea dd/mm/yyyy
        p1: string;                 // Rango o "-"
        p2: string;
        p3: string;
        derecho: number;
        totalInclCierre: number;
        quedan: number | string;
        department: string;
    }

    const allEmployeeRows: EmployeeRow[] = [];
    const activeOps = operarios.filter(op => op.Activo);
    const BATCH = 4;

    for (let i = 0; i < activeOps.length; i += BATCH) {
        const batch = activeOps.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(async (op): Promise<EmployeeRow> => {
            const idStr = op.IDOperario.toString();
            const code = `FV${idStr.padStart(3, '0')}`;
            const label = `${code} - ${op.DescOperario}`;
            const department = op.DescDepartamento || 'General';
            const derecho = richDataMap.get(op.IDOperario) ?? ANNUAL_CREDITS.VACATION_DAYS;

            let classified: ClassifiedResult;
            try {
                const cal = await getCalendarioOperario(idStr, yearStart, yearEnd);
                classified = classifyVacationDays(cal);
            } catch {
                classified = {
                    sueltos: [], p1Range: '-', p2Range: '-', p3Ranges: [],
                    totalDays: 0, daysInClosure: 0, daysOutsideClosure: 0
                };
            }

            const quedan = derecho - classified.daysOutsideClosure;

            return {
                operario: label,
                sueltos: classified.sueltos.join('\n') || '-',
                p1: classified.p1Range,
                p2: classified.p2Range,
                p3: classified.p3Ranges.join('\n') || '-',
                derecho,
                totalInclCierre: classified.totalDays,
                quedan: quedan > 0 ? quedan : (quedan === 0 ? '' : 0),
                department
            };
        }));

        allEmployeeRows.push(...results);

        onProgress?.({
            percent: 10 + Math.round(((i + batch.length) / activeOps.length) * 70),
            message: `Calendario ${Math.min(i + batch.length, activeOps.length)} de ${activeOps.length} operarios...`
        });

        if (i + BATCH < activeOps.length) {
            await new Promise(r => setTimeout(r, 150));
        }
    }

    // ── 3. Agrupar por departamento ─────────────────────────────────
    onProgress?.({ percent: 82, message: 'Generando Excel...' });
    const sections = new Map<string, EmployeeRow[]>();
    allEmployeeRows.forEach(row => {
        if (!sections.has(row.department)) sections.set(row.department, []);
        sections.get(row.department)!.push(row);
    });
    const sortedDepts = Array.from(sections.keys()).sort((a, b) => a.localeCompare(b, 'es'));

    // ── 4. Construir Workbook ───────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'APP PRESENCIA';
    workbook.created = new Date();

    const HEADERS = [
        'Operario',
        'Días Sueltos',
        'Periodo 1',
        'Periodo 2',
        'Periodo 3',
        'Días derecho\ndisfrute y Resto',
        'Días Totales\nincluido cierre',
        'Días que\nquedan'
    ];
    const TOTAL_COLS = HEADERS.length;

    sortedDepts.forEach((dept, deptIdx) => {
        const employees = sections.get(dept)!;
        employees.sort((a, b) => a.operario.localeCompare(b.operario, 'es', { numeric: true }));

        const sheetName = dept.length > 31 ? dept.substring(0, 31) : dept;
        const ws = workbook.addWorksheet(sheetName, {
            views: [{ state: 'frozen', ySplit: 2, showGridLines: false }],
            pageSetup: {
                paperSize: 9, // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0
            }
        });

        // Anchos de columna
        ws.columns = [
            { width: 38 },  // Operario
            { width: 20 },  // Días Sueltos
            { width: 24 },  // P1
            { width: 24 },  // P2
            { width: 24 },  // P3
            { width: 18 },  // Derecho
            { width: 18 },  // Totales
            { width: 14 },  // Quedan
        ];

        // ── Fila 1: Título ──────────────────────────────────────────
        ws.mergeCells(`A1:${colRef(TOTAL_COLS)}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = `PLANIFICACIÓN VACACIONES ${year} — ${dept.toUpperCase()}  |  Cierre: 10/08 al 21/08  |  P1: 03-07 Ago  |  P2: 24-28 Ago  |  Exportado: ${exportTimestamp}`;
        titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF1F4E78' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
        ws.getRow(1).height = 24;

        // ── Fila 2: Cabecera de tabla (addTable) ────────────────────
        const tableData = employees.map(e => [
            e.operario,
            e.sueltos,
            e.p1,
            e.p2,
            e.p3,
            e.derecho,
            e.totalInclCierre,
            e.quedan
        ]);

        const tableName = `T_VAC_${dept.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)}_${deptIdx}`;

        ws.addTable({
            name: tableName,
            ref: 'A2',
            headerRow: true,
            style: {
                theme: 'TableStyleLight1',
                showRowStripes: true
            },
            columns: HEADERS.map(name => ({ name })),
            rows: tableData
        });

        // AutoFilter
        ws.autoFilter = {
            from: { row: 2, column: 1 },
            to: { row: employees.length + 2, column: TOTAL_COLS }
        };

        // ── Estilo: Replicar exactamente el de nóminas ──────────────
        const tableStartRow = 2;
        const totalTableRows = employees.length + 1; // header + data
        const tableEndRow = tableStartRow + totalTableRows - 1;

        for (let r = tableStartRow; r <= tableEndRow; r++) {
            for (let c = 1; c <= TOTAL_COLS; c++) {
                const cell = ws.getCell(`${colRef(c)}${r}`);
                const isHeader = r === tableStartRow;
                const isOddDataRow = (r - tableStartRow) % 2 === 1;

                cell.alignment = {
                    horizontal: c === 1 ? 'left' : 'center',
                    vertical: 'middle',
                    wrapText: true
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                    left: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                    bottom: { style: 'thin', color: { argb: 'FF8E8E8E' } },
                    right: { style: 'thin', color: { argb: 'FF8E8E8E' } }
                };

                if (isHeader) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E1E1E' } };
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                } else {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: isOddDataRow ? 'FFF2F2F2' : 'FFFFFFFF' }
                    };
                    cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1E1E1E' } };
                }
            }
        }

        // Blanquear celdas fuera de la tabla (evitar fondo gris residual)
        for (let r = 1; r <= employees.length + 50; r++) {
            for (let c = 1; c <= TOTAL_COLS; c++) {
                if (r === 1) continue;
                if (r >= tableStartRow && r <= tableEndRow) continue;
                const cell = ws.getCell(`${colRef(c)}${r}`);
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                };
            }
        }

        // Cabecera con altura mayor
        ws.getRow(2).height = 38;

        // Ajuste de altura dinámica para filas con multilínea
        for (let r = 3; r <= employees.length + 2; r++) {
            const row = ws.getRow(r);
            let maxLines = 1;
            for (let c = 1; c <= TOTAL_COLS; c++) {
                const val = String(ws.getCell(`${colRef(c)}${r}`).value || '');
                const lineCount = val.split('\n').length;
                if (lineCount > maxLines) maxLines = lineCount;
            }
            row.height = Math.max(20, maxLines * 14 + 6);
        }

        // Resaltar "quedan" en rojo si es 0 o negativo
        for (let r = 3; r <= employees.length + 2; r++) {
            const cell = ws.getCell(`H${r}`);
            const val = cell.value;
            if (val === 0 || val === '' || (typeof val === 'number' && val <= 0)) {
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFDC2626' } };
            }
        }

        // Resaltar "quedan" en verde si > 0
        for (let r = 3; r <= employees.length + 2; r++) {
            const cell = ws.getCell(`H${r}`);
            const val = cell.value;
            if (typeof val === 'number' && val > 0) {
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF16A34A' } };
            }
        }

        // Columnas numéricas centradas con formato entero
        for (let r = 3; r <= employees.length + 2; r++) {
            ws.getCell(`F${r}`).numFmt = '0';
            ws.getCell(`G${r}`).numFmt = '0';
        }

        // Footer informativo
        const footerRow = employees.length + 4;
        ws.mergeCells(`A${footerRow}:${colRef(TOTAL_COLS)}${footerRow}`);
        const footer = ws.getCell(`A${footerRow}`);
        footer.value = `Página ${deptIdx + 1} de ${sortedDepts.length}  —  ${employees.length} empleados en sección "${dept}"  —  Fuente: Calendario Operario (TipoDia=2)`;
        footer.font = { name: 'Arial', size: 8, italic: true, color: { argb: 'FF9CA3AF' } };
        footer.alignment = { horizontal: 'center' };

        onProgress?.({
            percent: 82 + Math.round(((deptIdx + 1) / sortedDepts.length) * 15),
            message: `Hoja generada: ${dept}`
        });
    });

    // ── 5. Guardar archivo ──────────────────────────────────────────
    onProgress?.({ percent: 98, message: 'Guardando archivo...' });
    const fileName = `Planificacion_Vacaciones_Secciones_${year}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, fileName);

    onProgress?.({ percent: 100, message: `Listo: ${fileName}` });
};
