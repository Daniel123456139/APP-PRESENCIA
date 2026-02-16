import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DepartmentGroup } from '../hooks/useImproductiveReport';

export const generateImproductivosExcel = async (
    data: DepartmentGroup[],
    allArticleIds: string[],
    dateRange: { start: string, end: string }
) => {
    // 1. Create Workbook and Worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Improductivos', {
        views: [{ state: 'frozen', ySplit: 1, xSplit: 0 }]
    });

    // 2. Define Columns
    // Base columns
    const columns = [
        { header: 'OPERARIO', key: 'operario', width: 12 },
        { header: 'NOMBRE_OPERARIO', key: 'nombre', width: 35 },
        { header: 'TOTAL', key: 'total', width: 12 },
    ];

    // Add Dynamic Columns for Articles BETWEEN TOTAL and Summary Stats
    allArticleIds.forEach(articleId => {
        columns.push({ header: articleId, key: `art_${articleId}`, width: 15 });
    });

    // Add Summary Stats
    columns.push(
        { header: 'Improd', key: 'improd', width: 12 },
        { header: 'Prod', key: 'prod', width: 12 },
        { header: '% Improd', key: 'percent', width: 12 },
        { header: 'Descripción (Sección)', key: 'desc', width: 30 }
    );

    worksheet.columns = columns;

    // 3. Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

    // Style base columns
    // Count = 6 (0-5)
    // Dynamic columns follow

    headerRow.eachCell((cell, colNumber) => {
        cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        // Determine if it's a dynamic column
        // Base columns are 1-3. Dynamic start at 4.
        const isDynamic = colNumber > 3 && colNumber <= (3 + allArticleIds.length);

        if (isDynamic) {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCC99' } // Peach/Light Orange for Breakdown
            };
        } else {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEEEEEE' } // Light Grey
            };
        }
    });

    let currentRowIndex = 2;
    let grandTotalHours = 0;
    let grandTotalImproductive = 0;
    let grandTotalProductive = 0;
    const grandTotalBreakdown: Record<string, number> = {};

    // 4. Iterate Data Groups
    data.forEach(group => {
        // Add Rows for Employees
        group.rows.forEach(emp => {
            const rowData: any = {
                operario: emp.operatorId,
                nombre: emp.operatorName,
                total: parseFloat(emp.totalHours.toFixed(2)),
                improd: parseFloat(emp.improductiveHours.toFixed(2)),
                prod: parseFloat(emp.productiveHours.toFixed(2)),
                percent: (emp.improductiveHours + emp.productiveHours) > 0
                    ? (emp.improductiveHours / (emp.improductiveHours + emp.productiveHours))
                    : 0,
                desc: group.departmentName
            };

            // Map breakdown values
            allArticleIds.forEach(articleId => {
                const val = emp.breakdown[articleId] || 0;
                rowData[`art_${articleId}`] = val > 0 ? parseFloat(val.toFixed(2)) : 0;
            });

            const row = worksheet.addRow(rowData);

            // Format Numbers
            row.getCell('percent').numFmt = '0.00%';
            row.getCell('total').numFmt = '0.00';
            row.getCell('improd').numFmt = '0.00';
            row.getCell('prod').numFmt = '0.00';

            // Format dynamic columns
            allArticleIds.forEach(articleId => {
                // We need to find the cell by key, or iterate cells
                // But keys are dynamic. We can just iterate cells from 7...
            });

            // Apply numeric format and borders to all cells in this row
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                const col = columns[colNumber - 1];
                if (!col) return;

                if (col.key === 'percent') {
                    cell.numFmt = '0.00%';
                } else if (['total', 'improd', 'prod'].includes(col.key as string) || (col.key as string).startsWith('art_')) {
                    cell.numFmt = '0.00';
                }

                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });

            currentRowIndex++;
        });

        // 5. Add Section Total Row (YELLOW)
        const sectionRowData: any = {
            operario: '',
            nombre: `TOTAL SECCIÓN ${group.departmentName}`,
            total: parseFloat(group.totalHours.toFixed(2)),
            improd: parseFloat(group.totalImproductive.toFixed(2)),
            prod: parseFloat(group.totalProductive.toFixed(2)),
            percent: (group.totalImproductive + group.totalProductive) > 0
                ? (group.totalImproductive / (group.totalImproductive + group.totalProductive))
                : 0,
            desc: ''
        };

        // Calculate and Map Section Breakdown
        allArticleIds.forEach(articleId => {
            const val = group.breakdown[articleId] || 0;
            sectionRowData[`art_${articleId}`] = val > 0 ? parseFloat(val.toFixed(2)) : 0;

            // Add to Grand Total Breakdown
            grandTotalBreakdown[articleId] = (grandTotalBreakdown[articleId] || 0) + val;
        });

        const sectionRow = worksheet.addRow(sectionRowData);


        // Style Section Row
        sectionRow.font = { bold: true };
        sectionRow.eachCell((cell, colNumber) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' } // Yellow
            };
            cell.border = {
                top: { style: 'medium' }, // Thicker border for section total
                left: { style: 'thin' },
                bottom: { style: 'medium' },
                right: { style: 'thin' }
            };

            const col = columns[colNumber - 1];
            if (col) {
                if (col.key === 'percent') {
                    cell.numFmt = '0.00%';
                } else if (['total', 'improd', 'prod'].includes(col.key as string) || (col.key as string).startsWith('art_')) {
                    cell.numFmt = '0.00';
                }
            }
        });


        // Accumulate Grand Totals
        grandTotalHours += group.totalHours;
        grandTotalImproductive += group.totalImproductive;
        grandTotalProductive += group.totalProductive;

        currentRowIndex++;
    });

    // 6. Add Grand Total Row (ORANGE)
    const grandTotalRowData: any = {
        operario: '',
        nombre: 'TOTAL GENERAL',
        total: parseFloat(grandTotalHours.toFixed(2)),
        improd: parseFloat(grandTotalImproductive.toFixed(2)),
        prod: parseFloat(grandTotalProductive.toFixed(2)),
        percent: (grandTotalImproductive + grandTotalProductive) > 0
            ? (grandTotalImproductive / (grandTotalImproductive + grandTotalProductive))
            : 0,
        desc: ''
    };

    allArticleIds.forEach(articleId => {
        const val = grandTotalBreakdown[articleId] || 0;
        grandTotalRowData[`art_${articleId}`] = val > 0 ? parseFloat(val.toFixed(2)) : 0;
    });

    const grandTotalRow = worksheet.addRow(grandTotalRowData);

    // Style Grand Total Row
    grandTotalRow.font = { bold: true, size: 12 };
    grandTotalRow.eachCell((cell, colNumber) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFA500' } // Orange
        };
        cell.border = {
            top: { style: 'thick' },
            left: { style: 'thick' },
            bottom: { style: 'thick' },
            right: { style: 'thick' }
        };

        const col = columns[colNumber - 1];
        if (col) {
            if (col.key === 'percent') {
                cell.numFmt = '0.00%';
            } else if (['total', 'improd', 'prod'].includes(col.key as string) || (col.key as string).startsWith('art_')) {
                cell.numFmt = '0.00';
            }
        }
    });

    // 7. Write Buffer and Save
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    const fileName = `IMPRODUCTIVOS_${dateRange.start}_${dateRange.end}.xlsx`;
    saveAs(blob, fileName);
};
