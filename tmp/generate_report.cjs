
const { 
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
    WidthType, BorderStyle, ShadingType, AlignmentType, HeadingLevel, 
    PageNumber, Header, Footer
} = require('docx');
const fs = require('fs');
const path = require('path');

// Configuración de estilos y colores
const COLOR_CORPORATIVO = "1F4E79";
const BORDER_COLOR = "CCCCCC";
const TABLE_HEADER_FILL = "D5E8F0";

const createReport = async () => {
    const doc = new Document({
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
                    run: { size: 32, bold: true, color: COLOR_CORPORATIVO, font: "Arial" },
                    paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 }
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 28, bold: true, color: COLOR_CORPORATIVO, font: "Arial" },
                    paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 }
                }
            ]
        },
        sections: [{
            properties: {
                page: {
                    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1 pulgada
                }
            },
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                                new TextRun({ text: "App Presencia - Análisis de Integración Firebase", color: "666666", size: 18 })
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
                // 1. PORTADA
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("\n\n\n\n")] }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "APP PRESENCIA", bold: true, size: 48, color: COLOR_CORPORATIVO })
                    ]
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("\n")] }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "INFORME TÉCNICO: ANÁLISIS DE INTEGRACIÓN FIREBASE", bold: true, size: 28 })
                    ]
                }),
                new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun("\n\n\n\n")] }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: `Fecha: ${new Date().toLocaleDateString('es-ES')}`, size: 24 })
                    ]
                }),
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({ text: "Estado: Finalizado", size: 24 })
                    ]
                }),
                new Paragraph({ children: [new TextRun({ break: 1 })] }),

                // 2. RESUMEN EJECUTIVO
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. RESUMEN EJECUTIVO")] }),
                new Paragraph({
                    children: [
                        new TextRun("Este documento detalla la arquitectura de integración entre la aplicación de Control de Presencia y los servicios cloud de Firebase. La aplicación utiliza una arquitectura híbrida donde los datos sensibles (PII) residen en un servidor local (ERP) mientras que la lógica de negocio enriquecida, la auditoría y la gestión de usuarios se centralizan en Firebase Firestore y Authentication.")
                    ]
                }),
                new Paragraph({
                    children: [
                        new TextRun("\nPuntos clave identificados:"),
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Uso de Firebase v12 con persistencia offline activada.")]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Sistema de seguridad basado en reglas de Firestore con validación anti-PII para cumplimiento GDPR.")]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Integración de 20+ colecciones de datos, incluyendo interoperabilidad con App Talento.")]
                }),

                // 3. CONFIGURACIÓN Y CONEXIÓN
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. CONFIGURACIÓN Y CONEXIÓN")] }),
                new Paragraph({
                    children: [
                        new TextRun("La inicialización se centraliza en "),
                        new TextRun({ text: "src/firebaseConfig.ts", bold: true }),
                        new TextRun(". El sistema utiliza variables de entorno (.env) para proteger los identificadores del proyecto:")
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Project ID: app-presencia")]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Hosting Site: app-presencia")]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Funciones: Localizadas en /functions, regíon europe-west1.")]
                }),

                // 4. COLECCIONES Y ACCESO A DATOS
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. COLECCIONES Y ACCESO A DATOS")] }),
                new Table({
                    width: { size: 9000, type: WidthType.DXA },
                    columnWidths: [2000, 3000, 4000],
                    rows: [
                        new TableRow({
                            children: [
                                createHeaderCell("Colección"),
                                createHeaderCell("Operaciones"),
                                createHeaderCell("Descripción/Propósito")
                            ]
                        }),
                        createDataRow("USUARIOS", "R/W (Admin)", "Gestión unificada de usuarios y roles."),
                        createDataRow("EMPLEADOS", "R/W", "Datos enriquecidos (antigüedad, turno, vacaciones)."),
                        createDataRow("SICK_LEAVES", "CRUD", "Gestión de bajas médicas activas."),
                        createDataRow("BAJAS", "R", "Histórico de bajas finalizadas."),
                        createDataRow("INCIDENT_LOG", "C (Inmutable)", "Log de auditoría de incidencias."),
                        createDataRow("APP_GENERATED...", "R/W", "Fichajes sintéticos para justificación automática."),
                        createDataRow("NOTAS", "CRUD", "Seguimiento compartido con App Talento."),
                        createDataRow("CONFIGURACION", "R (Syste/Admin)", "Parámetros globales del sistema.")
                    ]
                }),

                // 5. AUTENTICACIÓN
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. AUTENTICACIÓN Y USUARIOS")] }),
                new Paragraph({
                    children: [
                        new TextRun("El servicio "),
                        new TextRun({ text: "firebaseAuthService.ts", bold: true }),
                        new TextRun(" gestiona el ciclo de vida de la sesión:")
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Método: Email / Password.")]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Roles Identificados: SUPER_ADMIN, RRHH, OPERADOR, GESTOR_TRABAJOS, EMPLOYEE.")]
                }),

                // 6. REGLAS DE SEGURIDAD
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. REGLAS DE SEGURIDAD (GDPR)")] }),
                new Paragraph({
                    children: [
                        new TextRun("Las reglas en "),
                        new TextRun({ text: "firestore.rules", bold: true }),
                        new TextRun(" implementan una lógica de 'Zero Trust' mediante la función "),
                        new TextRun({ text: "noPII()", bold: true }),
                        new TextRun(", que bloquea cualquier escritura de datos identificables como nombres o DNI en Firebase.")
                    ]
                }),

                // 7. CONCLUSIONES
                new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. CONCLUSIONES Y RECOMENDACIONES")] }),
                new Paragraph({
                    children: [
                        new TextRun("La integración es robusta y sigue patrones modernos de seguridad cloud. Se recomienda:")
                    ]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Monitorización: Implementar Firebase App Check para evitar accesos no autorizados a la API.")]
                }),
                new Paragraph({
                    bullet: { level: 0 },
                    children: [new TextRun("Backups: Automatizar exportaciones diarias de Firestore (existen scripts de backup parciales).")]
                })
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join("C:", "Users", "facturas", "Desktop", "PRUEBAS COMERCIAL", "PRESENCIA_Firebase_Analysis.docx");
    fs.writeFileSync(outputPath, buffer);
    console.log(`Documento generado con éxito en: ${outputPath}`);
};

// Helper para celdas de cabecera
function createHeaderCell(text) {
    return new TableCell({
        children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true })] })],
        shading: { fill: TABLE_HEADER_FILL, type: ShadingType.CLEAR },
        borders: getStandardBorders()
    });
}

// Helper para filas de datos
function createDataRow(col1, col2, col3) {
    return new TableRow({
        children: [
            new TableCell({ children: [new Paragraph(col1)], borders: getStandardBorders() }),
            new TableCell({ children: [new Paragraph(col2)], borders: getStandardBorders() }),
            new TableCell({ children: [new Paragraph(col3)], borders: getStandardBorders() })
        ]
    });
}

function getStandardBorders() {
    const border = { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR };
    return { top: border, bottom: border, left: border, right: border };
}

createReport().catch(err => {
    console.error("Error generando el informe:", err);
    process.exit(1);
});
