const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat } = require('docx');
const fs = require('fs');
const path = require('path');

async function createDocx(title, content, outputPath) {
    const doc = new Document({
        styles: {
            default: { document: { run: { font: "Arial", size: 24 } } },
            paragraphStyles: [
                {
                    id: "Heading1",
                    name: "Heading 1",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 32, bold: true, font: "Arial" },
                    paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 }
                },
                {
                    id: "Heading2",
                    name: "Heading 2",
                    basedOn: "Normal",
                    next: "Normal",
                    quickFormat: true,
                    run: { size: 28, bold: true, font: "Arial" },
                    paragraph: { spacing: { before: 180, after: 180 }, outlineLevel: 1 }
                }
            ]
        },
        sections: [{
            children: [
                new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [new TextRun(title)]
                }),
                ...content.split('\n').map(line => {
                    if (line.startsWith('## ')) {
                        return new Paragraph({
                            heading: HeadingLevel.HEADING_2,
                            children: [new TextRun(line.replace('## ', ''))]
                        });
                    } else if (line.startsWith('### ')) {
                        return new Paragraph({
                            heading: HeadingLevel.HEADING_3,
                            children: [new TextRun(line.replace('### ', ''))]
                        });
                    } else if (line.startsWith('- ')) {
                        return new Paragraph({
                            children: [new TextRun("• " + line.replace('- ', ''))],
                            indent: { left: 720, hanging: 360 }
                        });
                    } else if (line.trim() === '') {
                        return new Paragraph({});
                    } else {
                        return new Paragraph({
                            children: [new TextRun(line)]
                        });
                    }
                })
            ]
        }]
    });

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
}

const techReportMd = fs.readFileSync('c:/-- APLICACIONES DANI --/APP -- PRESENCIA/PRESENCIA_TECHNICAL_REPORT.md', 'utf-8');
const userManualMd = fs.readFileSync('c:/-- APLICACIONES DANI --/APP -- PRESENCIA/PRESENCIA_USER_MANUAL.md', 'utf-8');
const justificacionMd = fs.readFileSync('c:/-- APLICACIONES DANI --/APP -- PRESENCIA/PRESENCIA_JUSTIFICACION_ID.md', 'utf-8');

const outputDir = 'F:/01_ADMINISTRACIÓN/05 DIRECCION = INVERSIONES/2025/011 AUTOMATIZACION PROCESOS IA/PRESENCIA';

createDocx("Reporte Técnico: Sistema de Gestión de Presencia y RRHH", techReportMd, path.join(outputDir, "PRESENCIA_TECHNICAL_REPORT.docx"))
    .then(() => console.log("Reporte Técnico generado."))
    .catch(err => console.error(err));

createDocx("Manual de Usuario: Gestión de Presencia y RRHH", userManualMd, path.join(outputDir, "PRESENCIA_USER_MANUAL.docx"))
    .then(() => console.log("Manual de Usuario generado."))
    .catch(err => console.error(err));

createDocx("Justificación I+D: Automatización de Gestión de Presencia y RRHH", justificacionMd, path.join(outputDir, "PRESENCIA_JUSTIFICACION_ID.docx"))
    .then(() => console.log("Justificación I+D generada."))
    .catch(err => console.error(err));
