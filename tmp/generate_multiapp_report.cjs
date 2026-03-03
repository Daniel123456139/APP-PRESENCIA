const fs = require('fs');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ShadingType } = docx;

async function generateMultiappReport() {
    console.log("Iniciando generación del informe Multi-App V2 Seguro...");

    // ESTILOS SEGUROS
    const COLOR_PRIMARY = "0f172a";
    const COLOR_SECONDARY = "fbbf24";
    const COLOR_TEXT = "333333";

    const commonCellMargin = { top: 100, bottom: 100, left: 100, right: 100 };
    const commonBorders = {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
    };

    function crearFilaTabla(celda1Text, celda2Text, isHeader = false) {
        return new TableRow({
            children: [
                new TableCell({
                    width: { size: 3000, type: WidthType.DXA },
                    shading: isHeader ? { fill: COLOR_PRIMARY, type: ShadingType.CLEAR } : undefined,
                    borders: commonBorders,
                    margins: commonCellMargin,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: celda1Text,
                                    bold: isHeader,
                                    color: isHeader ? "FFFFFF" : COLOR_TEXT,
                                    font: "Calibri"
                                })
                            ],
                            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT
                        })
                    ]
                }),
                new TableCell({
                    width: { size: 6000, type: WidthType.DXA },
                    shading: isHeader ? { fill: COLOR_PRIMARY, type: ShadingType.CLEAR } : undefined,
                    borders: commonBorders,
                    margins: commonCellMargin,
                    children: [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: celda2Text,
                                    bold: isHeader,
                                    color: isHeader ? "FFFFFF" : COLOR_TEXT,
                                    font: "Calibri"
                                })
                            ],
                            alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT
                        })
                    ]
                })
            ]
        });
    }

    const doc = new Document({
        creator: "Antigravity AI Arquitecto",
        title: "Análisis Multi-App Firebase",
        styles: {
            paragraphStyles: [
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 36, bold: true, color: COLOR_PRIMARY, font: "Arial" },
                    paragraph: { spacing: { before: 400, after: 200 } }
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 28, bold: true, color: COLOR_SECONDARY, font: "Arial" },
                    paragraph: { spacing: { before: 300, after: 150 } }
                },
                {
                    id: "Normal",
                    name: "Normal",
                    quickFormat: true,
                    run: { size: 22, color: COLOR_TEXT, font: "Calibri" },
                    paragraph: { spacing: { before: 100, after: 100, line: 276 } }
                }
            ]
        },
        numbering: {
            config: [
                {
                    reference: "lista-basica",
                    levels: [
                        { level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
                        { level: 1, format: "bullet", text: "o", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } }
                    ]
                }
            ]
        },
        sections: [{
            properties: {},
            children: [
                // PORTADA
                new Paragraph({ text: "DOCUMENTO TÉCNICO DE MIGRACIÓN", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                new Paragraph({ text: "Entorno Multi-App: Presencia, Talento y Gestión de Trabajos", alignment: AlignmentType.CENTER }),
                new Paragraph({ text: "Fecha: " + new Date().toLocaleDateString(), alignment: AlignmentType.CENTER }),
                new Paragraph({ text: " ", spacing: { after: 1000 } }), // Espaciado

                // INTRODUCCIÓN
                new Paragraph({ text: "1. RESUMEN DEL ENTORNO FIREBASE", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Este documento detalla la arquitectura de las tres aplicaciones coexistentes en el proyecto de Firebase actual. Para garantizar una migración segura a otro servidor, es fundamental comprender qué colecciones de Firestore, roles y métricas de seguridad pertenecen a cada aplicación, así como los espacios en los que comparten datos (Base de datos unificada)." }),
                
                new Paragraph({ text: "Ecosistema de Aplicaciones Registradas:", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "App 1: PRESENCIA (AppId: term. d2245f)", numbering: { reference: "lista-basica", level: 0 } }),
                new Paragraph({ text: "App 2: TALENTO (AppId: term. b53e7e)", numbering: { reference: "lista-basica", level: 0 } }),
                new Paragraph({ text: "App 3: GESTION TRABAJOS (AppId: term. c99)", numbering: { reference: "lista-basica", level: 0 } }),

                // CORE COMPARTIDO
                new Paragraph({ text: "2. CLÚSTER DE DATOS COMPARTIDOS (CORE)", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Esta sección abarca las colecciones y sistemas de los que dependen las tres aplicaciones. Si migras el entorno, estas colecciones deben transferirse intactas." }),
                new Table({
                    columnWidths: [3000, 6000],
                    rows: [
                        crearFilaTabla("COLECCIÓN", "DESCRIPCIÓN Y USO", true),
                        crearFilaTabla("USUARIOS", "Contiene la autenticación cruzada. Define los clain roles (RRHH, OPERADOR, GESTOR_TRABAJOS, SUPER_ADMIN). Leída por las 3 apps."),
                        crearFilaTabla("EMPLEADOS / EMPLEADOS_REF", "Registro maestro de trabajadores. Está protegido por la función 'noPII()' en las reglas de Firestore para evitar guardar nombres u otros datos sensibles en Cloud (estrategia Híbrida local/cloud)."),
                        crearFilaTabla("CONFIGURACION", "Parámetros globales compartidos por todas las instancias.")
                    ]
                }),

                // APP 1: PRESENCIA
                new Paragraph({ text: "3. CLÚSTER: APP PRESENCIA", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Maneja el control horario, fichajes sintéticos y gestión offline. Escribe de manera intensiva." }),
                new Table({
                    columnWidths: [3000, 6000],
                    rows: [
                        crearFilaTabla("COLECCIÓN", "DESCRIPCIÓN Y ACCESOS", true),
                        crearFilaTabla("SICK_LEAVES / BAJAS", "Gestión de IT (Incapacidad Temporal). Leído/Escrito por RRHH exclusivamente."),
                        crearFilaTabla("APP_GENERATED_PUNCHES", "Fichajes sintéticos creados desde la app para justificar ausencias. Escrito por RRHH."),
                        crearFilaTabla("EMPLEADOS/{id}/presencia_*", "Subcolecciones como prescencia_fichajes_app e incidencias. Cada empleado lee/escribe sus propios fichajes desde la terminal."),
                        crearFilaTabla("EMPLOYEE_ACCESS_LOG", "Logs de auditoría inmutables (append-only) para cumplir con auditorías técnicas y GDPR. No se permite borrado.")
                    ]
                }),

                // APP 2: TALENTO
                new Paragraph({ text: "4. CLÚSTER: APP TALENTO", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Enfocada en recursos humanos cualitativos, formación y competencias." }),
                new Table({
                    columnWidths: [3000, 6000],
                    rows: [
                        crearFilaTabla("COLECCIÓN", "DESCRIPCIÓN Y ACCESOS", true),
                        crearFilaTabla("SKILLS / COMPETENCIAS", "Catálogo de habilidades requeridas en la empresa. Leídas por RRHH y administradores."),
                        crearFilaTabla("CERTIFICACIONES / FORMACIONES", "Historial de capacitación técnica y PRL. Leídas por Gestores y RRHH."),
                        crearFilaTabla("HISTORIAL_EVALUACIONES", "Desempeño de los empleados. Alta seguridad: Sólo modificable por SUPER_ADMIN, creable por RRHH."),
                        crearFilaTabla("PLANES_FORMATIVOS_ANUALES", "Listados de formación presupuestada y programada.")
                    ]
                }),

                // APP 3: GESTIÓN DE TRABAJOS
                new Paragraph({ text: "5. CLÚSTER: APP GESTIÓN DE TRABAJOS", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Control operativo y de maquinaria en la planta de producción." }),
                new Table({
                    columnWidths: [3000, 6000],
                    rows: [
                        crearFilaTabla("COLECCIÓN", "DESCRIPCIÓN Y ACCESOS", true),
                        crearFilaTabla("TRABAJOS", "Órdenes de Fabricación (OF), asignación de máquinas e incidencias de producción. Escrito por GESTOR_TRABAJOS y RRHH."),
                        crearFilaTabla("EMPLEADOS/{id}/trabajos_partes", "Partes intervinientes producidos por un operador (roles OPERADOR y GESTOR_TRABAJOS)."),
                        crearFilaTabla("PRIORIDADES (Virtual)", "Se cruza dinámicamente en local (ERP) con las OFs de la nube para calcular urgencias (fuzzing matching en Service).")
                    ]
                }),

                // SEGURIDAD Y REGLAS (MIGRACIÓN)
                new Paragraph({ text: "6. CONSIDERACIONES IMPORTANTES PARA LA MIGRACIÓN", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Exportación de Datos (Firestore):", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "Al migrar el proyecto, se DEBE usar Firebase Managed Export/Import para preservar los timestamps de los Logs Inmutables (EMPLOYEE_ACCESS_LOG y INCIDENT_LOG), ya que de lo contrario, se sobrescribirán las fechas de creación.", numbering: { reference: "lista-basica", level: 0 } }),
                
                new Paragraph({ text: "Exportación de Autenticación:", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "Utilizar el CLI (firebase auth:export). Cuidado: los 'Custom Claims' (los roles como SUPER_ADMIN definidos directamente en el Auth Token) podrían no exportarse en métodos estándar CSV. Exportar en formato JSON o hacer un script que recorra la colección USUARIOS para recrear los Custom Claims.", numbering: { reference: "lista-basica", level: 0 } }),

                new Paragraph({ text: "Reglas de Seguridad (firestore.rules):", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "Deben copiarse textualmente al nuevo proyecto. Contienen la función crítica 'noPII()' que evita un grave problema legal con GDPR (impide inyectar NIF/Nombres directamente en la nube).", numbering: { reference: "lista-basica", level: 0 } }),
                
                new Paragraph({ text: "Service Accounts (.env):", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "El nuevo proyecto de Firebase generará nuevos IDs. Todos los .env de las 3 apps deberán ser rotados inmediatamente (apiKey, projectId, appId). NOTA: Cada sub-app de las 3 tiene su propio appId específico de web.", numbering: { reference: "lista-basica", level: 0 } })
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const targetPath = 'C:/Users/facturas/Desktop/PRUEBAS COMERCIAL/Firebase_AnalisisCompleto_20260302.docx';
    fs.writeFileSync(targetPath, buffer);
    console.log("Documento generado y guardado en: " + targetPath);
}

generateMultiappReport().catch((err) => {
    console.error("Error al generar:", err);
    process.exit(1);
});
