import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logger from '../utils/logger';

export interface ProductivityKpis {
    totalPresence: number;
    totalCovered: number;
    totalImproductiveProduced: number;
    totalGap: number;
    occupancy: number;
}

export interface ProductivityTopImproductiveRow {
    name: string;
    hours: number;
    percent: number;
}

export interface ProductivityActivityRow {
    id: string;
    name: string;
    hours: number;
    count: number;
    percent: number;
}

export interface ProductivitySectionRow {
    name: string;
    worked: number;
    improductive: number;
    presence: number;
    efficiency: number;
}

export interface ProductivityPdfOptions {
    startDate: string;
    endDate: string;
    department: string;
    section: string;
    watermark?: string;
}

export async function exportProductivityDashboardToPDF(
    kpis: ProductivityKpis,
    topImproductive: ProductivityTopImproductiveRow[],
    activityRows: ProductivityActivityRow[],
    sectionRows: ProductivitySectionRow[],
    options: ProductivityPdfOptions
): Promise<void> {
    try {
        const { startDate, endDate, department, section, watermark } = options;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();

        // Header
        pdf.setFillColor(37, 99, 235);
        pdf.rect(0, 0, pageWidth, 32, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text('DASHBOARD DE PRODUCTIVIDAD', pageWidth / 2, 18, { align: 'center' });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`Periodo: ${formatDate(startDate)} - ${formatDate(endDate)}`, pageWidth / 2, 26, { align: 'center' });
        pdf.text(`Departamento: ${department === 'all' ? 'Todos' : department} | Seccion: ${section === 'all' ? 'Global' : section}`, pageWidth / 2, 30, { align: 'center' });

        let yPosition = 40;

        // KPI Cards
        const totalProductive = Math.max(0, kpis.totalCovered - kpis.totalImproductiveProduced);
        drawKpiCard(pdf, 12, yPosition, 90, 24, 'Productivo', `${totalProductive.toFixed(1)}h`, 'Trabajo real', [16, 185, 129]);
        drawKpiCard(pdf, 108, yPosition, 90, 24, 'Improductivo', `${kpis.totalImproductiveProduced.toFixed(1)}h`, 'Actividad no productiva', [245, 158, 11]);
        yPosition += 30;
        drawKpiCard(pdf, 12, yPosition, 90, 24, 'Gap', `${kpis.totalGap.toFixed(1)}h`, 'Tiempo sin cubrir', [239, 68, 68]);
        drawKpiCard(pdf, 108, yPosition, 90, 24, 'Presencia', `${kpis.totalPresence.toFixed(1)}h`, `Ocupacion ${kpis.occupancy.toFixed(1)}%`, [59, 130, 246]);

        yPosition += 32;

        // Top improductive
        pdf.setTextColor(30, 41, 59);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Top improductivos', 12, yPosition);
        yPosition += 4;

        autoTable(pdf, {
            startY: yPosition,
            head: [['#', 'Empleado', 'Horas', '% Presencia']],
            body: topImproductive.map((row, idx) => [
                String(idx + 1),
                row.name,
                `${row.hours.toFixed(2)}h`,
                `${row.percent.toFixed(1)}%`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 90 },
                2: { cellWidth: 25, halign: 'right' },
                3: { cellWidth: 25, halign: 'right' }
            }
        });

        yPosition = (pdf as any).lastAutoTable.finalY + 8;

        // Activities
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Actividades improductivas', 12, yPosition);
        yPosition += 4;

        autoTable(pdf, {
            startY: yPosition,
            head: [['#', 'Actividad', 'Veces', 'Horas', '% Total']],
            body: activityRows.slice(0, 15).map((row, idx) => [
                String(idx + 1),
                row.name,
                `${row.count}`,
                `${row.hours.toFixed(2)}h`,
                `${row.percent.toFixed(1)}%`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
            columnStyles: {
                0: { cellWidth: 8, halign: 'center' },
                1: { cellWidth: 90 },
                2: { cellWidth: 18, halign: 'right' },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 25, halign: 'right' }
            }
        });

        yPosition = (pdf as any).lastAutoTable.finalY + 8;

        // Sections
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('Eficiencia por seccion', 12, yPosition);
        yPosition += 4;

        autoTable(pdf, {
            startY: yPosition,
            head: [['Seccion', 'Efic.', 'Prod', 'Imp', 'Pres']],
            body: sectionRows.map(row => [
                row.name,
                `${row.efficiency.toFixed(1)}%`,
                `${row.worked.toFixed(1)}h`,
                `${row.improductive.toFixed(1)}h`,
                `${row.presence.toFixed(1)}h`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 9 },
            bodyStyles: { fontSize: 8, textColor: [51, 65, 85] }
        });

        // Footer
        const pageCount = pdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'italic');
            pdf.setTextColor(148, 163, 184);
            pdf.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 12, pdf.internal.pageSize.getHeight() - 8);
            pdf.text(`Pagina ${i} de ${pageCount}`, pageWidth - 35, pdf.internal.pageSize.getHeight() - 8);

            if (watermark) {
                pdf.setTextColor(220, 220, 220);
                pdf.setFontSize(50);
                pdf.text(watermark, pageWidth / 2, 150, { align: 'center', angle: 45 });
            }
        }

        const deptName = department === 'all' ? 'Todos' : department.replace(/\s+/g, '_');
        const sectionName = section === 'all' ? 'Global' : section.replace(/\s+/g, '_');
        const filename = `Dashboard_Productividad_${deptName}_${sectionName}_${startDate}_${endDate}.pdf`;
        pdf.save(filename);
        logger.success('✅ Dashboard de productividad exportado correctamente');
    } catch (error) {
        logger.error('❌ Error exportando dashboard de productividad:', error);
        throw error;
    }
}

function drawKpiCard(
    pdf: jsPDF,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    subtitle: string,
    color: [number, number, number]
): void {
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(x, y, width, height, 2, 2, 'FD');

    pdf.setFillColor(...color);
    pdf.circle(x + 6, y + 7, 2.8, 'F');

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(148, 163, 184);
    pdf.text(label.toUpperCase(), x + 12, y + 6);

    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(30, 41, 59);
    pdf.text(value, x + width / 2, y + 15, { align: 'center' });

    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 116, 139);
    pdf.text(subtitle, x + width / 2, y + 21, { align: 'center' });
}

function formatDate(dateStr: string): string {
    try {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    } catch {
        return dateStr;
    }
}
