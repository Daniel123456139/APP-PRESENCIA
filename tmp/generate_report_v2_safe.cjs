const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel,
    PageNumber, Header, Footer, LevelFormat
} = require('docx');
const fs = require('fs');
const path = require('path');

const COLOR_PRIMARY = "1F4E79";
const COLOR_SECONDARY = "2E75B6";
const COLOR_ACCENT = "E7E6E6";
const BORDER_COLOR = "AEAAAA";
const HEADER_FILL = "DEEAF6";

const createPremiumReport = async () => {
    const doc = new Document({
        numbering: {
            config: [
                {
                    reference: "bullets",
                    levels: [{
                        level: 0,
                        format: LevelFormat.BULLET,
                        text: "•",
                        alignment: AlignmentType.LEFT,
                        style: { paragraph: { indent: { left: 720, hanging: 360 } } }
                    }]
                }
            ]
        },
        styles: {
            default: {
                document: {
                    run: { font: "Arial", size: 22 }
                }
            },
            paragraphStyles: [
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 36, bold: true, color: COLOR_PRIMARY, font: "Arial" },
                    paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0, border: { bottom: { color: COLOR_PRIMARY, space: 4, style: BorderStyle.SINGLE, size: 6 } } }
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 28, bold: true, color: COLOR_SECONDARY, font: "Arial" },
                    paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 }
                }
            ]
        },
        sections: [{
            properties: {
                page: {
                    size: { width: 11906, height: 16838 }, // A4
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
                }
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({ text: "AUDITORÍA TÉCNICA CLOUD - APP PRESENCIA V2.0", color: "BFBFBF", size: 16, bold: true })
                            ]
                        })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "Confidencial - Propiedad de Daniel123456139", size: 16, color: "BFBFBF" }),
                                new TextRun({ break: 1 }),
                                new TextRun("Página "),
                                new TextRun({ children: [PageNumber.CURRENT] }),
                                new TextRun(" de "),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES] })
                            ]
                        })
                    ]
                })
            },
            children: [
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("\n\n\n\n")] }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "INFRAESTRUCTURA HÍBRIDA FIREBASE", bold: true, size: 44, color: COLOR_PRIMARY }),
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "Análisis Arquitectónico, Seguridad y Flujos de Datos v2.0", size: 24, color: COLOR_SECONDARY }),
                    ]
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("\n\n\n\n\n\n")] }),
                new Table({
                    width: { size: 9026, type: WidthType.DXA },
                    columnWidths: [4513, 4513],
                    alignment: AlignmentType.CENTER,
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 4513, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Preparado para:", bold: true }), new TextRun("\nDaniel123456139")] })]
                                }),
                                new TableCell({
                                    width: { size: 4513, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Autor:", bold: true }), new TextRun("\nAntigravity AI Architect")] })]
                                })
                            ]
                        })
                    ]
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `\nFecha de emisión: ${new Date().toLocaleDateString('es-ES')}` })] }),
                new Paragraph({ children: [new TextRun({ break: 1 })] }),

                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. ARQUITECTURA HÍBRIDA Y ESTRATEGIA GDPR")] }),
                new Paragraph({
                    children: [
                        new TextRun("La aplicación implementa un patrón de "),
                        new TextRun({ text: "Arquitectura Híbrida de Alta Disponibilidad", bold: true }),
                        new TextRun(". El núcleo estratégico se basa en la separación estricta de responsabilidades:")
                    ]
                }),
                createBullet("LOCAL (ERP):", " Residencia única de PII. Nombres, DNI y datos nunca salen del perímetro de red local."),
                createBullet("CLOUD (FIREBASE):", " Lógica de acompañamiento, metadatos operativos y auditoría."),
                new Paragraph({
                    children: [
                        new TextRun({ text: "\nProtocolo de Resiliencia (Offline-First):", bold: true }),
                        new TextRun(" El sistema utiliza "),
                        new TextRun({ text: "SyncService.ts", italic: true }),
                        new TextRun(" para gestionar una cola IndexedDB.")
                    ]
                }),

                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. MAPEO ESTRATÉGICO DE COLECCIONES")] }),
                new Paragraph({ text: "Firebase Firestore actúa como el cerebro operativo de la aplicación. A continuación se detallan los clústeres:" }),
                new Table({
                    width: { size: 9026, type: WidthType.DXA },
                    columnWidths: [2000, 2526, 4500],
                    rows: [
                        createPremiumHeaderRow(["Clúster", "Colecciones", "Valor de Negocio"]),
                        createPremiumDataRow("Identidad", "USUARIOS, ROLES", "Gestión de permisos RBAC."),
                        createPremiumDataRow("Operativa", "EMPLEADOS, CONFIG", "Enriquecimiento de datos ERP."),
                        createPremiumDataRow("Auditoría", "EMPLOYEE_ACCESS", "Trazabilidad de accesos."),
                        createPremiumDataRow("Justificación", "APP_GENERATED", "Fichajes sintéticos."),
                        createPremiumDataRow("Bienestar", "SICK_LEAVES", "Control de ausencias."),
                        createPremiumDataRow("Talento", "NOTAS", "Interoperabilidad.")
                    ]
                }),

                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. FLUJOS DE TRABAJO AUTOMATIZADOS")] }),
                new Paragraph({ text: "La inteligencia de la aplicación reside en sus servicios de automatización:", bold: true }),

                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1. Gestión de Gaps y Fichajes Sintéticos")] }),
                new Paragraph({ text: "Mediante incidentRegistrationService, la app detecta automáticamente huecos durante la jornada generando fichajes sintéticos." }),

                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2. Análisis de Prioridades de Producción")] }),
                new Paragraph({ text: "El priorityAnalysisService cruza los trabajos del ERP y clasifica urgencias (entrega < 7 días)." }),

                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. SEGURIDAD Y CUMPLIMIENTO (SHORING)")] }),
                new Paragraph({ text: "Medidas activas:" }),
                createBullet("Sanitización:", " Resolución de colecciones segura evitando inyección de rutas."),
                createBullet("Inmutabilidad:", " Logs append-only protegidos por reglas Firestore.")
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join("C:", "Users", "facturas", "Desktop", "PRUEBAS COMERCIAL", "PRESENCIA_Firebase_Analysis_V2_PREMIUM.docx");
    fs.writeFileSync(outputPath, buffer);
    console.log(`Documento V2 generado de forma segura en: ${outputPath}`);
};

function createBullet(title, text) {
    return new Paragraph({
        numbering: { reference: "bullets", level: 0 },
        children: [
            new TextRun({ text: title, bold: true, color: COLOR_SECONDARY }),
            new TextRun(text)
        ]
    });
}

const colWidths = [2000, 2526, 4500];

function createPremiumHeaderRow(titles) {
    return new TableRow({
        children: titles.map((t, i) => new TableCell({
            width: { size: colWidths[i], type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, color: COLOR_PRIMARY })] })],
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            borders: getPremiumBorders()
        }))
    });
}

function createPremiumDataRow(c1, c2, c3) {
    return new TableRow({
        children: [c1, c2, c3].map((c, i) => new TableCell({
            width: { size: colWidths[i], type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun(i === 0 ? { text: c, bold: true } : { text: c })] })],
            borders: getPremiumBorders()
        }))
    });
}

function getPremiumBorders() {
    const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
    return { top: border, bottom: border, left: border, right: border };
}

createPremiumReport().catch(err => {
    console.error("Error generando el informe:", err);
    process.exit(1);
});
