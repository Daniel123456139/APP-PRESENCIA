const fs = require('fs');
const docx = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, ShadingType, VerticalAlign, PageBreak, Header, Footer, PageNumber } = docx;

async function generateMasterReport() {
    console.log("Iniciando generación del informe MASTERPRINT...");

    // PALETA DE COLORES ULTRA PREMIUM CORPORATIVA
    const C_DARK = "0F172A";       // Slate 900 (Headers principales, Portada)
    const C_PRIMARY = "1D4ED8";    // Blue 700 (Títulos de sección)
    const C_SECONDARY = "475569";  // Slate 600 (Subtítulos)
    const C_ACCENT = "059669";     // Emerald 600 (Destacados, validaciones)
    const C_DANGER = "DC2626";     // Red 600 (Advertencias)
    const C_GRAY_BG = "F1F5F9";    // Slate 100 (Fondo celdas)
    const C_TEXT = "334155";       // Text general

    // ESTILOS COMUNES DE TABLA
    const commonCellPadding = { top: 150, bottom: 150, left: 150, right: 150 };
    const invisibleBorders = {
        top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
        right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }
    };
    const standardBorders = {
        top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" }
    };

    // FUNCIÓN: Título de Sección
    function seccionTitulo(texto, nivel = HeadingLevel.HEADING_1) {
        return new Paragraph({ text: texto, heading: nivel });
    }

    // FUNCIÓN: Párrafo Normal
    function parrafo(texto, options = {}) {
        return new Paragraph({
            children: [
                new TextRun({
                    text: texto,
                    bold: options.bold || false,
                    color: options.color || C_TEXT,
                    italics: options.italics || false,
                    size: options.size || 22,
                    font: "Calibri"
                })
            ],
            alignment: options.align || AlignmentType.JUSTIFIED,
            spacing: { before: 100, after: 150 }
        });
    }

    // FUNCIÓN: Elemento de Lista
    function listItem(texto, level = 0, boldStart = "") {
        const children = [];
        if (boldStart) {
            children.push(new TextRun({ text: boldStart + ": ", bold: true, color: C_PRIMARY, font: "Calibri", size: 22 }));
            children.push(new TextRun({ text: texto.replace(boldStart + ": ", ""), color: C_TEXT, font: "Calibri", size: 22 }));
        } else {
            children.push(new TextRun({ text: texto, color: C_TEXT, font: "Calibri", size: 22 }));
        }

        return new Paragraph({
            children: children,
            numbering: { reference: "master-list", level: level },
            spacing: { before: 80, after: 80 }
        });
    }

    // FUNCIÓN: Tabla de Diccionario de Datos (Estilo Profesional)
    function tablaDiccionario(titulo, campos) {
        const rows = [
            new TableRow({
                children: [
                    new TableCell({
                        width: { size: 9000, type: WidthType.DXA },
                        columnSpan: 3,
                        shading: { fill: C_DARK, type: ShadingType.CLEAR },
                        borders: standardBorders,
                        margins: commonCellPadding,
                        children: [new Paragraph({ children: [new TextRun({ text: titulo, bold: true, color: "FFFFFF", size: 24, font: "Arial" })], alignment: AlignmentType.CENTER })]
                    })
                ]
            }),
            new TableRow({
                children: [
                    new TableCell({ width: { size: 2500, type: WidthType.DXA }, shading: { fill: C_GRAY_BG, type: ShadingType.CLEAR }, borders: standardBorders, margins: commonCellPadding, children: [new Paragraph({ children: [new TextRun({ text: "CAMPO / SUBCOLECCIÓN", bold: true, color: C_PRIMARY, font: "Calibri" })] })] }),
                    new TableCell({ width: { size: 1500, type: WidthType.DXA }, shading: { fill: C_GRAY_BG, type: ShadingType.CLEAR }, borders: standardBorders, margins: commonCellPadding, children: [new Paragraph({ children: [new TextRun({ text: "TIPO", bold: true, color: C_PRIMARY, font: "Calibri" })], alignment: AlignmentType.CENTER })] }),
                    new TableCell({ width: { size: 5000, type: WidthType.DXA }, shading: { fill: C_GRAY_BG, type: ShadingType.CLEAR }, borders: standardBorders, margins: commonCellPadding, children: [new Paragraph({ children: [new TextRun({ text: "DESCRIPCIÓN Y USO", bold: true, color: C_PRIMARY, font: "Calibri" })] })] })
                ]
            })
        ];

        campos.forEach(c => {
            rows.push(new TableRow({
                children: [
                    new TableCell({ width: { size: 2500, type: WidthType.DXA }, borders: standardBorders, margins: commonCellPadding, children: [new Paragraph({ children: [new TextRun({ text: c.nombre, bold: true, font: "Consolas", size: 20 })] })] }),
                    new TableCell({ width: { size: 1500, type: WidthType.DXA }, borders: standardBorders, margins: commonCellPadding, children: [new Paragraph({ children: [new TextRun({ text: c.tipo, color: C_SECONDARY, font: "Calibri", size: 20 })], alignment: AlignmentType.CENTER })] }),
                    new TableCell({ width: { size: 5000, type: WidthType.DXA }, borders: standardBorders, margins: commonCellPadding, children: [new Paragraph({ children: [new TextRun({ text: c.desc, font: "Calibri", size: 20 })] })] })
                ]
            }));
        });

        return [new Table({ columnWidths: [2500, 1500, 5000], rows: rows }), new Paragraph({ text: " ", spacing: { after: 200 } })];
    }

    // FUNCIÓN: Diagrama de Flujo Simulado con Tablas
    function cajaFlujo(nodo, desc, color = C_PRIMARY) {
        return new Table({
            columnWidths: [9000],
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 9000, type: WidthType.DXA },
                            shading: { fill: color, type: ShadingType.CLEAR },
                            borders: standardBorders,
                            margins: { top: 200, bottom: 200, left: 300, right: 300 },
                            children: [
                                new Paragraph({ children: [new TextRun({ text: nodo, bold: true, color: "FFFFFF", size: 24, font: "Arial" })], alignment: AlignmentType.CENTER }),
                                new Paragraph({ children: [new TextRun({ text: desc, color: "F8FAFC", size: 20, font: "Calibri" })], alignment: AlignmentType.CENTER })
                            ]
                        })
                    ]
                })
            ]
        });
    }

    function flechaFlujo() {
        return new Paragraph({ children: [new TextRun({ text: "↓", bold: true, size: 40, color: C_SECONDARY })], alignment: AlignmentType.CENTER, spacing: { before: 100, after: 100 } });
    }

    // CONFIGURACIÓN DEL DOCUMENTO
    const doc = new Document({
        creator: "Antigravity Architect",
        title: "Masterprint: Arquitectura Firebase Multi-App",
        styles: {
            paragraphStyles: [
                { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { size: 36, bold: true, color: C_PRIMARY, font: "Arial" }, paragraph: { spacing: { before: 600, after: 300 }, border: { bottom: { color: C_PRIMARY, space: 10, style: BorderStyle.SINGLE, size: 12 } } } },
                { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 28, bold: true, color: C_SECONDARY, font: "Arial" }, paragraph: { spacing: { before: 400, after: 200 } } },
                { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", run: { size: 24, bold: true, color: C_DARK, font: "Arial" }, paragraph: { spacing: { before: 200, after: 100 } } },
                { id: "Normal", name: "Normal", run: { size: 22, color: C_TEXT, font: "Calibri" }, paragraph: { spacing: { before: 100, after: 100, line: 276 } } }
            ]
        },
        numbering: {
            config: [
                {
                    reference: "master-list",
                    levels: [
                        { level: 0, format: "bullet", text: "■", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { color: C_PRIMARY } } },
                        { level: 1, format: "bullet", text: "○", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
                        { level: 2, format: "decimal", text: "%3.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } } // Numeric for steps
                    ]
                }
            ]
        },
        sections: [{
            headers: {
                default: new Header({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "MASTERPRINT - CORPORATE ARCHITECTURE & MIGRATION GUIDE", color: "94A3B8", size: 16 })], alignment: AlignmentType.RIGHT })
                    ]
                })
            },
            footers: {
                default: new Footer({
                    children: [
                         new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                                new TextRun({ text: "Página ", color: "94A3B8", size: 18 }),
                                new TextRun({ children: [PageNumber.CURRENT], color: "94A3B8", size: 18 }),
                                new TextRun({ text: " de ", color: "94A3B8", size: 18 }),
                                new TextRun({ children: [PageNumber.TOTAL_PAGES], color: "94A3B8", size: 18 })
                            ]
                        })
                    ]
                })
            },
            properties: {},
            children: [
                // ==========================================
                // PORTADA (COVER PAGE)
                // ==========================================
                new Paragraph({ text: " ", spacing: { before: 2000 } }),
                new Paragraph({ children: [new TextRun({ text: "MASTERPRINT DE ARQUITECTURA", size: 56, bold: true, color: C_DARK, font: "Arial" })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
                new Paragraph({ children: [new TextRun({ text: "FIREBASE MULTI-APP MIGRATION", size: 48, bold: true, color: C_PRIMARY, font: "Arial" })], alignment: AlignmentType.CENTER, spacing: { after: 800 } }),
                new Paragraph({ children: [new TextRun({ text: "Análisis Exhaustivo, Diagramas de Flujo y Protocolo de Traspaso Seguro", size: 28, color: C_SECONDARY, font: "Calibri", italics: true })], alignment: AlignmentType.CENTER }),
                new Paragraph({ text: " ", spacing: { before: 3000 } }),
                
                new Table({
                    columnWidths: [4500, 4500],
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ borders: invisibleBorders, children: [parrafo("Proyecto:", { bold: true, align: AlignmentType.RIGHT })] }),
                                new TableCell({ borders: invisibleBorders, children: [parrafo(" TALENTO (app-presencia)")] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: invisibleBorders, children: [parrafo("Ecosistema:", { bold: true, align: AlignmentType.RIGHT })] }),
                                new TableCell({ borders: invisibleBorders, children: [parrafo(" PRESENCIA | TALENTO | TRABAJOS")] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: invisibleBorders, children: [parrafo("Fecha:", { bold: true, align: AlignmentType.RIGHT })] }),
                                new TableCell({ borders: invisibleBorders, children: [parrafo(" " + new Date().toLocaleDateString())] })
                            ]
                        }),
                        new TableRow({
                            children: [
                                new TableCell({ borders: invisibleBorders, children: [parrafo("Nivel de Seguridad:", { bold: true, align: AlignmentType.RIGHT, color: C_DANGER })] }),
                                new TableCell({ borders: invisibleBorders, children: [parrafo(" CONFIDENCIAL / CRÍTICO", { color: C_DANGER, bold: true })] })
                            ]
                        })
                    ]
                }),
                new Paragraph({ children: [new PageBreak()] }),

                // ==========================================
                // 1. RESUMEN EJECUTIVO Y ARQUITECTURA HÍBRIDA
                // ==========================================
                seccionTitulo("1. Resumen Ejecutivo y Arquitectura Híbrida"),
                parrafo("Este documento constituye el análisis más profundo y detallado de la infraestructura en la nube del proyecto. Actualmente, el proyecto de Firebase ampara no una, sino TRES aplicaciones interconectadas que leen y escriben sobre una matriz de colecciones compartida."),
                parrafo("El sistema opera bajo un modelo de 'Arquitectura Híbrida Zero-Trust'. Esto significa que Firebase se utiliza exclusivamente como un motor transaccional y de metadatos, mientras que el ERP local de la empresa sigue siendo el maestro absoluto de la información personal (PII). Ningún nombre, apellido o DNI se almacena en Cloud, mitigando riesgos catastróficos en términos de GDPR."),
                
                seccionTitulo("Inventario de Aplicaciones Registradas (Cloud Keys)", HeadingLevel.HEADING_2),
                listItem("App 1: PRESENCIA", 0, "App 1: PRESENCIA"),
                listItem("AppId: 1:426717771094:web:f667103fc2c020bdd6d2f7", 1),
                listItem("Target: Control horario, resiliencia offline, fichajes sintéticos.", 1),
                listItem("App 2: TALENTO", 0, "App 2: TALENTO"),
                listItem("AppId: 1:426717771094:web:f95aa914b93ddba6d6d2f7", 1),
                listItem("Target: Gestión cualitativa, competencias, historiales de formación.", 1),
                listItem("App 3: GESTIÓN DE TRABAJOS", 0, "App 3: GESTIÓN DE TRABAJOS"),
                listItem("AppId: 1:426717771094:web:ed9d8f8a3d6b5883d6d2f7", 1),
                listItem("Target: Entorno de producción industrial, partes de OFs interactuando con metadatos de operarios.", 1),

                // ==========================================
                // 2. DICCIONARIO BÁSICO DE DATOS Y ENTORNO
                // ==========================================
                new Paragraph({ children: [new PageBreak()] }),
                seccionTitulo("2. Diccionario de Datos: Bases Compartidas (Core)"),
                parrafo("Las siguientes colecciones sustentan el ecosistema. Si una de estas colecciones sufre daños, las tres aplicaciones caerán en cascada."),

                ...tablaDiccionario("COLECCIÓN: USUARIOS (RBAC Core)", [
                    { nombre: "document_id", tipo: "String", desc: "Coincide exactamente con el Firebase Auth UID del usuario." },
                    { nombre: "email", tipo: "String", desc: "Correo electrónico corporativo." },
                    { nombre: "roles", tipo: "Map", desc: "Objeto que define accesos. Claves booleanas: SUPER_ADMIN, RRHH, OPERADOR, GESTOR_TRABAJOS. Es consultado por el middleware para asignar los 'Custom Claims' y por el Frontend para pintar menús." },
                    { nombre: "config", tipo: "Map", desc: "Preferencias visuales o de entorno por usuario." }
                ]),

                ...tablaDiccionario("COLECCIÓN: EMPLEADOS_REF (Muro GDPR)", [
                    { nombre: "document_id", tipo: "String", desc: "ID de empleado del ERP (ej. FV045). Vincula Firebase con el sistema on-premise." },
                    { nombre: "colectivo", tipo: "String", desc: "Departamento al que pertenece (ej. Limpieza, Administración)." },
                    { nombre: "activo", tipo: "Boolean", desc: "Se usa como soft-delete. Los inactivos no se muestran pero no se borran por reglas de auditoría." },
                    { nombre: "PII Filters", tipo: "N/A", desc: "¡Atención! Las reglas de Firestore prohiben que existan campos nombrados como 'nombre', 'DNI', etc. La app local cruza el ID con la base SQL para mostrar nombres." }
                ]),

                ...tablaDiccionario("COLECCIÓN: CONFIGURACION / FEATURE_FLAGS", [
                    { nombre: "sync_interval", tipo: "Number", desc: "Intervalo en milisegundos que define la agresividad del SyncService offline." },
                    { nombre: "maintenance_mode", tipo: "Boolean", desc: "Si es True, el frontend bloquea todos los accesos excepto a SUPER_ADMIN." }
                ]),

                // ==========================================
                // 3. MAPA DE DOMINIOS ESPECÍFICOS (APPS)
                // ==========================================
                new Paragraph({ children: [new PageBreak()] }),
                seccionTitulo("3. Dominios Específicos por Aplicación"),
                
                seccionTitulo("3.1. Clúster de Control Horario (App: Presencia)", HeadingLevel.HEADING_2),
                parrafo("Este es el clúster con mayor volumen transaccional (miles de escrituras diarias por los marcajes)."),
                ...tablaDiccionario("SUBCOLECCIONES DENTRO DE EMPLEADOS/{id}", [
                    { nombre: "/presencia_fichajes_app", tipo: "SubCol", desc: "Registra cada 'punch' natural en la tablet. Campos: timestamp, type (IN/OUT), deviceId." },
                    { nombre: "/presencia_incidencias", tipo: "SubCol", desc: "Huecos de horario justificados. Campos: codigoIncidencia (02, 05, etc), startTime, endTime." },
                    { nombre: "/presencia_bajas_activas", tipo: "SubCol", desc: "Registro de baja actual. Evita que el empleado fiche accidentalmente." }
                ]),
                ...tablaDiccionario("COLECCIONES DE NIVEL RAÍZ (Presencia)", [
                    { nombre: "APP_GENERATED_PUNCHES", tipo: "Col", desc: "Tabla vital para RRHH. Son fichajes sintéticos inyectados por la aplicación para compensar huecos (ej: El trabajador se va al médico, RRHH inyecta una 'Salida' y luego la 'Entrada' correspondiente). Tiene reglas RBAC estrictas." },
                    { nombre: "SICK_LEAVES & BAJAS", tipo: "Col", desc: "SICK_LEAVES acoge partes activos. Cuando se cierra, un Cloud Function o script de RRHH lo mueve a la tabla BAJAS (histórico congelado para estadísticas)." }
                ]),

                seccionTitulo("3.2. Clúster de Capital Humano (App: Talento)", HeadingLevel.HEADING_2),
                parrafo("Baja frecuencia de escritura, alta frecuencia de lectura analítica."),
                ...tablaDiccionario("CATÁLOGOS RAÍZ", [
                    { nombre: "COMPETENCIAS / SKILLS", tipo: "Col", desc: "Metadatos. Descripciones de qué es cada competencia evaluable." },
                    { nombre: "FORMACIONES", tipo: "Col", desc: "Cursos ofrecidos por la empresa." },
                    { nombre: "PLANES_FORMATIVOS_ANUALES", tipo: "Col", desc: "Presupuestos y proyecciones de formación año a año." }
                ]),
                ...tablaDiccionario("SUBCOLECCIONES DENTRO DE EMPLEADOS/{id}", [
                    { nombre: "/talento_competencias", tipo: "SubCol", desc: "Niveles (1 al 5) del empleado en cada competencia maestra." },
                    { nombre: "/talento_historial_eval", tipo: "SubCol", desc: "Notas y evaluaciones de los managers en el ciclo de revisión (Performance Review)." }
                ]),

                seccionTitulo("3.3. Clúster de Producción (App: Gestión Trabajos)", HeadingLevel.HEADING_2),
                ...tablaDiccionario("GESTIÓN EN PLANTA", [
                    { nombre: "TRABAJOS", tipo: "Col", desc: "Registro maestro de Ordenes de Fabricación importadas del ERP. Campos: OF, articulo, maquina, prioridad." },
                    { nombre: "EMPLEADOS/{id}/trabajos_partes", tipo: "SubCol", desc: "El operario (App Presencia/Trabajos híbrida) indica: 'Estuve 2 horas en máquina X para OF Y'." }
                ]),

                // ==========================================
                // 4. DIAGRAMAS DE FLUJO Y COMPORTAMIENTO
                // ==========================================
                new Paragraph({ children: [new PageBreak()] }),
                seccionTitulo("4. Diagramas de Flujo y Mecánica Activa"),
                
                seccionTitulo("A. Ciclo de Resiliencia: 'Offline-First' Fichajes", HeadingLevel.HEADING_3),
                parrafo("El entorno industrial suele sufrir caídas de red wifi. La App PRESENCIA utiliza un motor IndexedDB sincronizado."),
                cajaFlujo("1. Operario Ficha (Tablet)", "El Frontend UI genera payload: { workerId, type: IN, ts: 12:00 }"),
                flechaFlujo(),
                cajaFlujo("2. Router de Red Local", "¿navigator.onLine == true?"),
                flechaFlujo(),
                new Table({
                    columnWidths: [4500, 4500],
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ shading: { fill: C_ACCENT, type: ShadingType.CLEAR }, borders: standardBorders, margins: commonCellPadding, children: [parrafo("CAMINO A: SÍ HAY RED", {bold:true, color:"FFFFFF", align: AlignmentType.CENTER}), parrafo("Sincroniza directo a Firestore EMPLEADOS/{id}/...", {color:"FFFFFF", align: AlignmentType.CENTER})] }),
                                new TableCell({ shading: { fill: C_DANGER, type: ShadingType.CLEAR }, borders: standardBorders, margins: commonCellPadding, children: [parrafo("CAMINO B: NO HAY RED", {bold:true, color:"FFFFFF", align: AlignmentType.CENTER}), parrafo("El Service guarda en Dexie/IndexedDB local. Muestra check verde fake al usuario.", {color:"FFFFFF", align: AlignmentType.CENTER})] })
                            ]
                        })
                    ]
                }),
                flechaFlujo(),
                cajaFlujo("3. SyncWorker Background", "Se activa `window.addEventListener('online')` y purga la cola a la nube automáticamente."),

                new Paragraph({ text: " " }),
                seccionTitulo("B. Arquitectura de Seguridad y Fugas PII (GDPR)", HeadingLevel.HEADING_3),
                parrafo("Si un hacker o un bug intenta guardar datos sensibles en Firebase, el motor de reglas (firestore.rules) actuará de cortafuegos último."),
                cajaFlujo("1. Intento de Mutación", "Request: { id: FV01, nombre: 'Juan Perez', DNI: '1234567X' } -> Destino: EMPLEADOS_REF", C_SECONDARY),
                flechaFlujo(),
                cajaFlujo("2. Firestore Security Rules", "Se dispara `match /EMPLEADOS_REF/{id}` > `allow create: if isHrRole() && noPII()`"),
                flechaFlujo(),
                cajaFlujo("3. Función noPII() Runtime", "Evalúa: `!('nombre' in data) && !('DNI' in data)`. Resultado: FALSE.", C_SECONDARY),
                flechaFlujo(),
                cajaFlujo("4. BLOQUEO (403 Permission Denied)", "La petición rebota instantáneamente. Los datos sensibles jamás tocan Cloud Storage.", C_DANGER),

                // ==========================================
                // 5. PROTOCOLO MAESTRO DE MIGRACIÓN
                // ==========================================
                new Paragraph({ children: [new PageBreak()] }),
                seccionTitulo("5. MIGRACIÓN: Manual de Traspaso Seguro (Step-by-Step)"),
                parrafo("Preste mucha atención a esta fase. Trasladar un ecosistema Híbrido Multi-App a otro servidor Firebase requiere precisión militar, o las relaciones entre colecciones (Subcolecciones) y los Logs Inmutables se perderán.", { bold: true }),

                seccionTitulo("Fase 1: Preparación del Nuevo Host", HeadingLevel.HEADING_2),
                listItem("Cree un nuevo proyecto en la consola de Firebase.", 2),
                listItem("Navegue a 'Configuración del Proyecto' > 'General'.", 2),
                listItem("Añada TRES aplicaciones web. Nómbrelas: PRESENCIA, TALENTO, GESTION.", 2),
                listItem("Copie los scripts de configuración (apiKey, projectId, appId) de cada una.", 2),

                seccionTitulo("Fase 2: Exportación Transaccional Forense (Firestore)", HeadingLevel.HEADING_2),
                parrafo("ERROR COMÚN FATAL: Muchas migraciones usan scripts Node.js para leer JSON y guardarlo. ESTO DESTRUYE LOS OBJETOS `Timestamp` y los convierte en Strings planos. Destrozará las colecciones EMPLOYEE_ACCESS_LOG, INCIDENT_LOG y los timestamps automáticos de los fichajes.", { color: C_DANGER, bold: true }),
                listItem("Use Google Cloud Console (CLI). Autentíquese con la cuenta dueña del proyecto antiguo.", 2),
                listItem("Ejecute en la consola: `gcloud firestore export gs://[NUEVO_BUCKET_GCP]`", 2),
                listItem("Mueva los archivos generados al bucket del proyecto nuevo.", 2),
                listItem("Importe usando: `gcloud firestore import gs://[NUEVO_BUCKET_GCP]/ruta-del-export`", 2),
                parrafo("Resultado: Las subcolecciones internas de EMPLEADOS mantendrán su anidación y los Tipos de Datos (GeoPoints, Timestamps) seguirán siendo puros.", { color: C_ACCENT, bold: true }),

                seccionTitulo("Fase 3: Exportación del Corazón de RBAC (Authentication)", HeadingLevel.HEADING_2),
                parrafo("Cuidado: Cuando exportas los usuarios de Auth mediante CSV, se pierden los 'Custom Claims' (Roles a nivel de token de seguridad)."),
                listItem("Use Firebase CLI: `firebase auth:export usuarios.json --format=json`", 2),
                listItem("En el nuevo proyecto: `firebase auth:import usuarios.json`", 2),
                listItem("Verifíquelo: Ingrese como usuario 'SUPER_ADMIN', abra la app nueva. El backend debería haber leído correctamente el rol desde la tabla heredada USUARIOS cruzándola con su nuevo Token.", 2),

                seccionTitulo("Fase 4: Configuración de Entorno Local (.env)", HeadingLevel.HEADING_2),
                parrafo("Las tres aplicaciones (repositorios de React/Next) tienen archivos `.env.local`."),
                listItem("Sustituya todas las variables: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`.", 2),
                listItem("CRÍTICO: Inserte meticulosamente los nuevos `VITE_FIREBASE_APP_ID`. Cada de una de las 3 apps recibirá credenciales exactas.", 2),
                listItem("Ejecute `npm run build` en los 3 proyectos.", 2),

                seccionTitulo("Fase 5: Muros de Fuego (Security Rules)", HeadingLevel.HEADING_2),
                listItem("Abra la consola de Firebase del NUEVO proyecto.", 2),
                listItem("Vaya a Firestore Database -> Pestaña 'Reglas'.", 2),
                listItem("Copie LITERALMENTE todo el contenido del archivo local `firestore.rules` del código fuente (356 líneas) y péguelo.", 2),
                listItem("Haga click en Publicar.", 2),
                parrafo("Explicación: Si olvidas este paso y dejas las reglas por defecto (Test Mode), el sistema será vulnerable a que inyecten datos PII (nombre, dni). Si lo dejas en Locked Mode, la aplicación entera dará pantallas rojas de 'Permissions Denied'.", { italics: true })

            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    const targetPath = 'C:/Users/facturas/Desktop/PRUEBAS COMERCIAL/Arquitectura_MultiApp_Masterprint.docx';
    fs.writeFileSync(targetPath, buffer);
    console.log("Masterprint generado exitosamente en: " + targetPath);
}

generateMasterReport().catch((err) => {
    console.error("Error al generar:", err);
    process.exit(1);
});
