const fs = require('fs');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ShadingType, VerticalAlign } = docx;

async function generateUltimateReport() {
    console.log("Iniciando generación del informe V3 ULTIMATE...");

    // ESTILOS SEGUROS
    const COLOR_PRIMARY = "1E293B"; // Slate 800
    const COLOR_SECONDARY = "0284C7"; // Light Blue 600
    const COLOR_ACCENT = "059669";    // Emerald 600
    const COLOR_TEXT = "334155";     // Slate 700

    const commonCellMargin = { top: 150, bottom: 150, left: 150, right: 150 };
    const commonBorders = {
        top: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
        left: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
        right: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" }
    };

    function crearFilaTabla(celda1Text, celda2Text, celda3Text = null, isHeader = false) {
        const createCell = (text, width, isHeader) => {
            return new TableCell({
                width: { size: width, type: WidthType.DXA },
                shading: isHeader ? { fill: COLOR_PRIMARY, type: ShadingType.CLEAR } : undefined,
                borders: commonBorders,
                margins: commonCellMargin,
                verticalAlign: VerticalAlign.CENTER,
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: text,
                                bold: isHeader,
                                color: isHeader ? "FFFFFF" : COLOR_TEXT,
                                font: "Calibri",
                                size: 22
                            })
                        ],
                        alignment: isHeader ? AlignmentType.CENTER : AlignmentType.LEFT
                    })
                ]
            });
        };

        const children = [];
        if (celda3Text) {
            children.push(createCell(celda1Text, 2500, isHeader));
            children.push(createCell(celda2Text, 4500, isHeader));
            children.push(createCell(celda3Text, 2000, isHeader));
        } else {
            children.push(createCell(celda1Text, 3000, isHeader));
            children.push(createCell(celda2Text, 6000, isHeader));
        }

        return new TableRow({ children });
    }

    const doc = new Document({
        creator: "Antigravity AI Arquitecto",
        title: "Arquitectura Firebase Multi-App",
        styles: {
            paragraphStyles: [
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 36, bold: true, color: COLOR_PRIMARY, font: "Arial" },
                    paragraph: { spacing: { before: 500, after: 250 } }
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
                    id: "Heading3",
                    name: "Heading 3",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 24, bold: true, color: COLOR_ACCENT, font: "Arial" },
                    paragraph: { spacing: { before: 200, after: 100 } }
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
                new Paragraph({ text: "ARQUITECTURA FIREBASE MULTI-APP", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
                new Paragraph({ text: "Análisis Profundo, Flujos de Datos y Guía de Migración", alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "Fecha de Generación: " + new Date().toLocaleDateString(), alignment: AlignmentType.CENTER }),
                new Paragraph({ text: " ", spacing: { after: 800 } }),

                // 1. Visión Global
                new Paragraph({ text: "1. VISIÓN GLOBAL DEL ECOSISTEMA", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "El ecosistema reside en un único proyecto de Firebase (ProjectId: app-presencia). Firebase actúa como Backend-as-a-Service (BaaS) pero bajo un modelo \"Híbrido\", donde los datos personales sensibles (PII) residen en el ERP local de la empresa, y Firebase almacena metadatos operativos y referencias cruzadas. Tres aplicaciones interactúan con esta misma base de datos:" }),
                
                new Paragraph({ text: "App 1: PRESENCIA", heading: HeadingLevel.HEADING_3 }),
                new Paragraph({ text: "Control horario y fichajes. (AppId: 1:426717771094:web:f667103fc2c020bdd6d2f7)" }),
                new Paragraph({ text: "App 2: TALENTO", heading: HeadingLevel.HEADING_3 }),
                new Paragraph({ text: "Recursos humanos, competencias y performance. (AppId: 1:426717771094:web:f95aa914b93ddba6d6d2f7)" }),
                new Paragraph({ text: "App 3: GESTIÓN DE TRABAJOS", heading: HeadingLevel.HEADING_3 }),
                new Paragraph({ text: "Producción y partes de trabajo. (AppId: 1:426717771094:web:ed9d8f8a3d6b5883d6d2f7)" }),

                // 2. Esquema de Colecciones
                new Paragraph({ text: "2. MAPA COMPLETO DE COLECCIONES FIRESTORE", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "A continuación, se detalla TODA la estructura de datos detectada en firestore.rules y el código:" }),

                new Paragraph({ text: "2.1. NÚCLEO COMPARTIDO (Leído por las 3 Apps)", heading: HeadingLevel.HEADING_2 }),
                new Table({
                    columnWidths: [2500, 4500, 2000],
                    rows: [
                        crearFilaTabla("COLECCIÓN", "PROPÓSITO Y DATOS TÍPICOS", "ROLES", true),
                        crearFilaTabla("USUARIOS", "Contiene uid, email, y el objeto 'roles' (SUPER_ADMIN, RRHH, OPERADOR). Es el RBAC del sistema.", "Admin/RRHH"),
                        crearFilaTabla("EMPLEADOS", "Registro central Legacy. Documentos indexados por ID de empleado ERP.", "Todos"),
                        crearFilaTabla("EMPLEADOS_REF", "Nuevo registro central, validado estrictamente contra PII.", "Todos"),
                        crearFilaTabla("CONFIGURACION", "Features flags y configuración global.", "Admin"),
                        crearFilaTabla("EMPLOYEE_ACCESS_LOG", "Log inmutable de auditoría forense para GDPR. Registra accesos de RRHH a expedientes.", "Admin")
                    ]
                }),
                new Paragraph({ text: " " }),

                new Paragraph({ text: "2.2. DOMINIO PRESENCIA", heading: HeadingLevel.HEADING_2 }),
                new Table({
                    columnWidths: [2500, 4500, 2000],
                    rows: [
                        crearFilaTabla("COLECCIÓN / SUB", "PROPÓSITO", "ROLES", true),
                        crearFilaTabla("SICK_LEAVES", "Gestión activa de Incapacidad Temporal (IT).", "RRHH"),
                        crearFilaTabla("BAJAS", "Histórico de bajas archivadas para métricas.", "RRHH"),
                        crearFilaTabla("APP_GENERATED_PUNCHES", "Fichajes creados por algoritmos y RRHH.", "RRHH"),
                        crearFilaTabla("INCIDENT_LOG", "Log centralizado de incidencias de horario.", "RRHH"),
                        crearFilaTabla("EMPLEADOS/{id}/presencia_fichajes_app", "[SUBCOLECCION] Fichajes naturales realizados desde las pantallas de la empresa.", "Todos"),
                        crearFilaTabla("EMPLEADOS/{id}/presencia_incidencias", "[SUBCOLECCION] Incidencias asignadas a ausencias.", "RRHH"),
                        crearFilaTabla("EMPLEADOS/{id}/presencia_bajas_*", "[SUBCOLECCION] Relación de bajas activas/históricas.", "RRHH")
                    ]
                }),
                new Paragraph({ text: " " }),

                new Paragraph({ text: "2.3. DOMINIO TALENTO", heading: HeadingLevel.HEADING_2 }),
                new Table({
                    columnWidths: [2500, 4500, 2000],
                    rows: [
                        crearFilaTabla("COLECCIÓN / SUB", "PROPÓSITO", "ROLES", true),
                        crearFilaTabla("COMPETENCIAS", "Inventario maestro de competencias de la empresa.", "RRHH/Talento"),
                        crearFilaTabla("NOTAS", "Registro de anotaciones de los managers hacia empleados.", "RRHH/Mngr"),
                        crearFilaTabla("SKILLS", "Inventario antiguo de Skills técnicas.", "RRHH"),
                        crearFilaTabla("CERTIFICACIONES", "Catálogo Válido de certificaciones (PRL, ISO, etc).", "RRHH"),
                        crearFilaTabla("FORMACIONES", "Catálogo maestro de cursos.", "RRHH"),
                        crearFilaTabla("PLANES_FORMATIVOS_ANUALES", "Matriz anual de inversión en formación.", "RRHH"),
                        crearFilaTabla("HISTORIAL_EVALUACIONES", "Campañas de performance assessment.", "Admin"),
                        crearFilaTabla("EMPLEADOS/{id}/talento_*", "[SUBCOLECCIONES] Competencias, notas, certificaciones y evaluaciones específicas para ese único empleado.", "RRHH/Talento")
                    ]
                }),
                new Paragraph({ text: " " }),

                new Paragraph({ text: "2.4. DOMINIO GESTIÓN TRABAJOS", heading: HeadingLevel.HEADING_2 }),
                new Table({
                    columnWidths: [2500, 4500, 2000],
                    rows: [
                        crearFilaTabla("COLECCIÓN / SUB", "PROPÓSITO", "ROLES", true),
                        crearFilaTabla("TRABAJOS", "Órdenes de fabricación (OFs) y asignación global a maquinaria.", "Gestores"),
                        crearFilaTabla("EMPLEADOS/{id}/trabajos_partes", "[SUBCOLECCION] El impute de horas exactas que un trabajador dedica a una OF.", "Gestor/Op")
                    ]
                }),

                // 3. Diagramas de Flujo
                new Paragraph({ text: "3. ESQUEMAS: FLUJO Y MOVIMIENTO DE DATOS", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Debido a la naturaleza de la arquitectura para alta disponibilidad, el sistema de PRESENCIA utiliza un flujo 'Offline-First' que se explicará a continuación en formato matricial." }),
                
                new Paragraph({ text: "Flujo 1: Un fichaje de Presencia (Resiliencia Extrema)", heading: HeadingLevel.HEADING_3 }),
                new Table({
                    columnWidths: [3000, 6000],
                    rows: [
                        crearFilaTabla("PASO", "ACCIÓN DEL SISTEMA", true),
                        crearFilaTabla("1. Interfaz", "Trabajador introduce ID. La app valida localmente si existe el empleado."),
                        crearFilaTabla("2. SyncService", "El evento se registra en la cola IndexedDB del navegador."),
                        crearFilaTabla("3. Router Online", "¿Hay red sólida? SI -> Muta Firebase / NO -> Permanece en IndexedDB."),
                        crearFilaTabla("4. Firestore", "Escritura en: EMPLEADOS/{id}/presencia_fichajes_app.")
                    ]
                }),
                new Paragraph({ text: " " }),

                new Paragraph({ text: "Flujo 2: Reglas GDPR y Protección PII", heading: HeadingLevel.HEADING_3 }),
                new Table({
                    columnWidths: [3000, 6000],
                    rows: [
                        crearFilaTabla("PASO", "ACCIÓN DEL SISTEMA", true),
                        crearFilaTabla("1. Interfaz (RRHH)", "La responsable intenta alta un empleado en Firebase."),
                        crearFilaTabla("2. Middleware API", "Se intercepta la mutación y se borran campos: DNI, Nombre, Apellidos."),
                        crearFilaTabla("3. Firestore Rules", "La función nativa noPII() revisa el payload. Si detecta nombre, tira ERROR de Permisos 403."),
                        crearFilaTabla("4. Aprobación", "Firestore guarda un documento SOLO con el `employeeId` y datos organizativos inocuos.")
                    ]
                }),

                // 4. Guía de Migración
                new Paragraph({ text: "4. PROTOCOLO TÉCNICO DE MIGRACIÓN EXACTA", heading: HeadingLevel.HEADING_1 }),
                new Paragraph({ text: "Paso 1: Exportación Inmutable de Firestore", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "PROHIBIDO exportar en JSON plano directamente desde código cliente. Debes usar la CLI de Google Cloud (gcloud firestore export). ¿Motivo? Las colecciones EMPLOYEE_ACCESS_LOG y INCIDENT_LOG contienen Timestamp nativos de base de datos que una exportación burda convertiría a Strings. Si pierdes el formato Timestamp, perderás todas tus consultas temporales en los dashboards.", numbering: { reference: "lista-basica", level: 0 } }),

                new Paragraph({ text: "Paso 2: Duplicación de Reglas", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "Copia íntegramente todo el contenido del archivo `firestore.rules` al nuevo proyecto. Esta configuración contiene las funciones isHrRole() y noPII(), que son el muro de contención absoluto frente a fugas de PII o accesos no autorizados a datos médicos (SICK_LEAVES).", numbering: { reference: "lista-basica", level: 0 } }),

                new Paragraph({ text: "Paso 3: Regeneración de Tokens y Aplicaciones web", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "Deberás crear TRES (3) aplicaciones Web dentro del nuevo Proyecto Firebase. Se generarán 3 objectos de configuración distintos. Obtendrás algo así:", numbering: { reference: "lista-basica", level: 0 } }),
                new Paragraph({ text: "• VITE_FIREBASE_API_KEY=AIzaSyB....." }),
                new Paragraph({ text: "• VITE_FIREBASE_PROJECT_ID=nuevo-proyecto" }),
                new Paragraph({ text: "• VITE_FIREBASE_APP_ID_PRESENCIA=1:4267..." }),
                new Paragraph({ text: "Esto provocará que tengas que actualizar todas las terminales físicas que ejecutan código Compilado (hacer npm run build instalando el nuevo .env)." }),

                new Paragraph({ text: "Paso 4: Exportación de Autenticación (Auth)", heading: HeadingLevel.HEADING_2 }),
                new Paragraph({ text: "Para no perder el logueo de los trabajadores/RRHH: `firebase auth:export usuarios.json --format=json`. Es CRÍTICO exportar la autenticación al unísono que la colección USUARIOS, pues los roles de Custom Claims deben sincronizarse.", numbering: { reference: "lista-basica", level: 0 } })

            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const targetPath = 'C:/Users/facturas/Desktop/PRUEBAS COMERCIAL/Firebase_Analisis_Exhaustivo_Migracion.docx';
    fs.writeFileSync(targetPath, buffer);
    console.log("Documento generado y guardado en: " + targetPath);
}

generateUltimateReport().catch((err) => {
    console.error("Error al generar:", err);
    process.exit(1);
});
