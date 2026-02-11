/**
 * SERVICIO DE EXPORTACIÓN DE ANÁLISIS DE PRIORIDADES
 * 
 * Responsabilidad: Generar reportes PDF y Excel del dashboard de prioridades
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { EmployeePriorityAnalysis, GlobalPriorityStats } from '../types';
import { formatHours } from './priorityAnalysisService';

interface ExportOptions {
    startDate: string;
    endDate: string;
    department?: string;
}

/**
 * Exporta dashboard completo a PDF
 * Captura el contenido visual del dashboard incluyendo gráficos
 * 
 * @param stats - Estadísticas globales
 * @param employeeData - Datos de empleados
 * @param options - Opciones de exportación
 */
export async function exportPriorityDashboardToPDF(
    stats: GlobalPriorityStats,
    employeeData: EmployeePriorityAnalysis[],
    options: ExportOptions
): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPosition = 15;

    const captureElement = document.getElementById('priority-dashboard-capture');
    if (captureElement) {
        try {
            const canvas = await html2canvas(captureElement, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                windowWidth: captureElement.scrollWidth,
                windowHeight: captureElement.scrollHeight,
                scrollX: 0,
                scrollY: -window.scrollY,
                ignoreElements: (el) => (el as HTMLElement).dataset?.exportIgnore === 'true',
                onclone: (doc) => {
                    doc.body.style.background = '#ffffff';
                    const root = doc.getElementById('priority-dashboard-capture');
                    if (root) {
                        root.style.background = '#ffffff';
                        root.style.padding = '16px';
                        root.style.maxWidth = '1100px';
                        root.style.margin = '0 auto';
                    }

                    const gradientText = doc.querySelectorAll('.bg-clip-text');
                    gradientText.forEach((el) => {
                        const node = el as HTMLElement;
                        node.style.backgroundImage = 'none';
                        node.style.color = '#4c1d95';
                        (node.style as any).webkitTextFillColor = '#4c1d95';
                    });
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = pageWidth - 10;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 5;

            pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - 10);

            while (heightLeft > 0) {
                position = heightLeft - imgHeight + 5;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 5, position, imgWidth, imgHeight);
                heightLeft -= (pageHeight - 10);
            }

            pdf.addPage();
            yPosition = 15;
        } catch (error) {
            console.warn('Error capturando dashboard, usando PDF estándar', error);
        }
    }

    // === ENCABEZADO ===
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('ANÁLISIS DE PRIORIDADES', pageWidth / 2, yPosition, { align: 'center' });

    yPosition += 10;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(
        `Periodo: ${options.startDate} - ${options.endDate}`,
        pageWidth / 2,
        yPosition,
        { align: 'center' }
    );

    if (options.department && options.department !== 'all') {
        yPosition += 5;
        pdf.text(
            `Departamento: ${options.department}`,
            pageWidth / 2,
            yPosition,
            { align: 'center' }
        );
    }

    yPosition += 15;

    // === RESUMEN GLOBAL ===
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cumplimiento de Prioridad', 15, yPosition);
    yPosition += 8;

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');

    const summaryData = [
        `Tasa de Éxito: ${stats.tasaExito.toFixed(0)}%`,
        `Total Artículos Analizados: ${stats.totalArticulos}`,
        '',
        `✅ Trabajos Correctos (Urgentes): ${stats.trabajosCorrectos} | ${formatHours(stats.horasCorrectas)}`,
        `❌ Desviaciones (NO Urgentes): ${stats.desviaciones} | ${formatHours(stats.horasDesviadas)}`
    ];

    summaryData.forEach(line => {
        pdf.text(line, 15, yPosition);
        yPosition += 6;
    });

    yPosition += 10;

    // === TOP 5 DESVIACIONES ===
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('TOP 5 Operarios con Más Desviaciones', 15, yPosition);
    yPosition += 8;

    const top5 = [...employeeData]
        .sort((a, b) => b.trabajosNoUrgentes - a.trabajosNoUrgentes)
        .slice(0, 5);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    top5.forEach((emp, index) => {
        const text = `${index + 1}. ${emp.employeeName}: ${emp.trabajosNoUrgentes} artículos NO urgentes → ${formatHours(emp.horasNoUrgentes)}`;
        pdf.text(text, 15, yPosition);
        yPosition += 6;
    });

    yPosition += 10;

    // === TABLA DE EMPLEADOS ===
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Detalle por Empleado', 15, yPosition);
    yPosition += 8;

    // Headers de tabla
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    const headers = ['Empleado', 'Trab. Urg.', 'H. Urg.', 'Trab. NO Urg.', 'H. NO Urg.', '% Cump.'];
    const colWidths = [50, 20, 25, 25, 25, 20];
    let xPos = 15;

    headers.forEach((header, i) => {
        pdf.text(header, xPos, yPosition);
        xPos += colWidths[i];
    });

    yPosition += 5;
    pdf.setFont('helvetica', 'normal');

    // Datos de empleados
    employeeData.forEach(emp => {
        if (yPosition > 270) {
            // Nueva página si no hay espacio
            pdf.addPage();
            yPosition = 15;
        }

        xPos = 15;
        const rowData = [
            emp.employeeName.substring(0, 20), // Truncar nombre largo
            emp.trabajosUrgentes.toString(),
            formatHours(emp.horasUrgentes),
            emp.trabajosNoUrgentes.toString(),
            formatHours(emp.horasNoUrgentes),
            `${emp.cumplimiento.toFixed(0)}%`
        ];

        rowData.forEach((data, i) => {
            pdf.text(data, xPos, yPosition);
            xPos += colWidths[i];
        });

        yPosition += 5;
    });

    // Guardar PDF
    const fileName = `analisis_prioridades_${options.startDate}_${options.endDate}.pdf`;
    pdf.save(fileName);
}

/**
 * Exporta datos detallados a Excel
 * 
 * @param employeeData - Datos de análisis por empleado
 */
export async function exportPriorityDataToExcel(
    employeeData: EmployeePriorityAnalysis[]
): Promise<void> {
    const workbook = XLSX.utils.book_new();

    // === HOJA 1: RESUMEN POR EMPLEADO ===
    const summaryRows = employeeData.map(emp => ({
        'Empleado': emp.employeeName,
        'ID': emp.employeeId,
        'Trabajos Urgentes': emp.trabajosUrgentes,
        'Horas Urgentes': emp.horasUrgentes.toFixed(1),
        'Trabajos NO Urgentes': emp.trabajosNoUrgentes,
        'Horas NO Urgentes': emp.horasNoUrgentes.toFixed(1),
        '% Cumplimiento': emp.cumplimiento.toFixed(1)
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen Empleados');

    // === HOJA 2: DETALLE DE TRABAJOS ===
    const detailRows: any[] = [];

    employeeData.forEach(emp => {
        emp.trabajosDetalle.forEach(work => {
            detailRows.push({
                'Empleado': emp.employeeName,
                'Artículo/OF': work.articleId,
                'Descripción': work.descripcion,
                'Cliente': work.cliente,
                'Fecha Entrega': work.fechaRequerida
                    ? work.fechaRequerida.toLocaleDateString('es-ES')
                    : 'Sin fecha',
                'Días hasta Entrega': work.diasHastaEntrega ?? 'N/A',
                'Horas Dedicadas': work.horasDedicadas.toFixed(1),
                'Estado': work.urgency === 'URGENTE' ? '✅ URGENTE' : '🔴 NO URGENTE'
            });
        });
    });

    const detailSheet = XLSX.utils.json_to_sheet(detailRows);
    XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle Trabajos');

    // Guardar archivo
    const fileName = `datos_prioridades_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
}
