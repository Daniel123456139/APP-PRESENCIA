
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel,
    PageNumber, Header, Footer, ImageRun
} = require('docx');
const fs = require('fs');
const path = require('path');

// Configuración de estilos y colores Premium
const COLOR_PRIMARY = "1F4E79"; // Azul profundo
const COLOR_SECONDARY = "2E75B6"; // Azul medio
const COLOR_ACCENT = "E7E6E6"; // Gris claro para fondos
const BORDER_COLOR = "AEAAAA";
const HEADER_FILL = "DEEAF6";

const createPremiumReport = async () => {
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: "Calibri", size: 22 }
                }
            },
            paragraphStyles: [
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 36, bold: true, color: COLOR_PRIMARY, font: "Calibri" },
                    paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0, border: { bottom: { color: COLOR_PRIMARY, space: 4, style: BorderStyle.SINGLE, size: 6 } } }
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 28, bold: true, color: COLOR_SECONDARY, font: "Calibri" },
                    paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 }
                }
            ]
        },
        sections: [{
            properties: {
                page: {
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
                // PORTADA PREMIUM
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ break: 4 })] }),
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
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ break: 6 })] }),
                new Table({
                    width: { size: 9000, type: WidthType.DXA },
                    alignment: AlignmentType.CENTER,
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 4500, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Preparado para:", bold: true }), new TextRun({ break: 1 }), new TextRun("Daniel123456139")] })]
                                }),
                                new TableCell({
                                    width: { size: 4500, type: WidthType.DXA },
                                    children: [new Paragraph({ children: [new TextRun({ text: "Autor:", bold: true }), new TextRun({ break: 1 }), new TextRun("Antigravity AI Architect")] })]
                                })
                            ]
                        })
                    ]
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `\nFecha de emisión: ${new Date().toLocaleDateString('es-ES')}` })] }),
                new Paragraph({ children: [new TextRun({ break: 1 })] }),

                // SECCIÓN 1: ARQUITECTURA HÍBRIDA "ZONA CERO"
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. ARQUITECTURA HÍBRIDA Y ESTRATEGIA GDPR")] }),
                new Paragraph({
                    children: [
                        new TextRun("La aplicación implementa un patrón de "),
                        new TextRun({ text: "Arquitectura Híbrida de Alta Disponibilidad", bold: true }),
                        new TextRun(". El núcleo estratégico se basa en la separación estricta de responsabilidades:")
                    ]
                }),
                createBullet("LOCAL (ERP):", " Residencia única de PII (Información Personal Identificable). Nombres, DNI y datos de contacto nunca salen del perímetro de red local."),
                createBullet("CLOUD (FIREBASE):", " Lógica de acompañamiento, metadatos operativos, auditoría avanzada y gestión de estados de presencia."),
                new Paragraph({
                    children: [
                        new TextRun({ text: "\nProtocolo de Resiliencia (Offline-First):", bold: true }),
                        new TextRun(" El sistema utiliza "),
                        new TextRun({ text: "SyncService.ts", italic: true }),
                        new TextRun(" para gestionar una cola de operaciones en IndexedDB. Esto garantiza que ningún fichaje se pierda ante caídas de red, reintentando la sincronización de forma exponencial.")
                    ]
                }),

                // SECCIÓN 2: MAPEO ESTRATÉGICO DE COLECCIONES
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. MAPEO ESTRATÉGICO DE COLECCIONES")] }),
                new Paragraph({ text: "Firebase Firestore actúa como el cerebro operativo de la aplicación. A continuación se detallan los clústeres de datos identificados:" }),
                new Table({
                    width: { size: 9000, type: WidthType.DXA },
                    columnWidths: [2000, 2500, 4500],
                    rows: [
                        createPremiumHeaderRow(["Clúster", "Colecciones", "Valor de Negocio"]),
                        createPremiumDataRow("Identidad", "USUARIOS, ROLES", "Gestión de permisos RBAC (Admin, RRHH, Operador)."),
                        createPremiumDataRow("Operativa", "EMPLEADOS, CONFIG", "Enriquecimiento de datos ERP con metadatos de producción."),
                        createPremiumDataRow("Auditoría", "EMPLOYEE_ACCESS_LOG", "Trazabilidad completa de quién accede a qué ficha (GDPR)."),
                        createPremiumDataRow("Justificación", "APP_GENERATED_PUNCHES", "Persistencia de fichajes sintéticos generados por la app."),
                        createPremiumDataRow("Bienestar", "SICK_LEAVES, BAJAS", "Control de ausencias médicas con histórico inmutable."),
                        createPremiumDataRow("Talento", "NOTAS, COMPETENCIAS", "Interoperabilidad bidireccional con APP - TALENTO.")
                    ]
                }),

                // SECCIÓN 3: FLUJOS DE TRABAJO AUTOMATIZADOS
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. FLUJOS DE TRABAJO AUTOMATIZADOS")] }),
                new Paragraph({ text: "La inteligencia de la aplicación reside en sus servicios de automatización:", bold: true }),

                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1. Gestión de Gaps y Fichajes Sintéticos")] }),
                new Paragraph({
                    children: [
                        new TextRun("Mediante "),
                        new TextRun({ text: "incidentRegistrationService.ts", italic: true }),
                        new TextRun(", la app detecta automáticamente huecos durante la jornada. Implementa una lógica de 'Espejo de Incidencia': si un operario sale 2h, la app genera un par de fichajes sintéticos (una entrada 'transparente' y una salida con código de incidencia) para que el ERP compute correctamente el tiempo.")
                    ]
                }),

                new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2. Análisis de Prioridades de Producción")] }),
                new Paragraph({
                    children: [
                        new TextRun("El "),
                        new TextRun({ text: "priorityAnalysisService.ts", italic: true }),
                        new TextRun(" cruza en tiempo real los trabajos del ERP con el Excel de prioridades de gerencia, clasificando la carga de trabajo en URGENTE (entrega < 7 días) o NO URGENTE.")
                    ]
                }),

                // SECCIÓN 4: SEGURIDAD Y CUMPLIMIENTO
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. SEGURIDAD Y CUMPLIMIENTO (SHORING)")] }),
                new Paragraph({
                    children: [
                        new TextRun("El sistema de seguridad no es pasivo. Se han identificado medidas activas:")
                    ]
                }),
                createBullet("Sanitización Dynamica:", " Resolución de colecciones mediante `firebaseSchemaService.ts`, evitando ataques de inyección de rutas."),
                createBullet("Inmutabilidad de Logs:", " Los registros de acceso e incidencias son `append-only`, protegidos por reglas de Firestore que impiden la edición o borrado de auditoría."),
                createBullet("Aislamiento de Entornos:", " Uso de emuladores para desarrollo y Firebase Hosting con certificados SSL automáticos."),

                // SECCIÓN 5: CONCLUSIONES ARQUITECTÓNICAS
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. CONCLUSIONES ARQUITECTÓNICAS")] }),
                new Paragraph({
                    children: [
                        new TextRun("El ecosistema Firebase en App Presencia no es un simple almacén de datos, sino una capa de inteligencia distribuida que permite al ERP (sistema rígido) comportarse de manera ágil y moderna. La seguridad es ejemplar en su trato de datos médicos y personales.")
                    ]
                })
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join("C:", "Users", "facturas", "Desktop", "PRUEBAS COMERCIAL", "PRESENCIA_Firebase_Analysis_V2_PREMIUM.docx");
    fs.writeFileSync(outputPath, buffer);
    console.log(`Documento V2 generado con éxito en: ${outputPath}`);
};

// Help para bullets
function createBullet(title, text) {
    return new Paragraph({
        bullet: { level: 0 },
        children: [
            new TextRun({ text: title, bold: true, color: COLOR_SECONDARY }),
            new TextRun(text)
        ]
    });
}

// Helper para cabeceras premium
function createPremiumHeaderRow(titles) {
    return new TableRow({
        children: titles.map(t => new TableCell({
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: t, bold: true, color: COLOR_PRIMARY })] })],
            shading: { fill: HEADER_FILL, type: ShadingType.CLEAR },
            borders: getPremiumBorders()
        }))
    });
}

// Helper para filas premium
function createPremiumDataRow(c1, c2, c3) {
    return new TableRow({
        children: [
            new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c1, bold: true })] })], borders: getPremiumBorders() }),
            new TableCell({ children: [new Paragraph(c2)], borders: getPremiumBorders() }),
            new TableCell({ children: [new Paragraph(c3)], borders: getPremiumBorders() })
        ]
    });
}

function getPremiumBorders() {
    const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
    return { top: border, bottom: border, left: border, right: border };
}

createPremiumReport().catch(err => {
    console.error("Error generando el informe V2:", err);
    process.exit(1);
});
