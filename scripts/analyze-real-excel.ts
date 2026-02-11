import * as XLSX from 'xlsx';
import * as fs from 'fs';

const EXCEL_PATH = 'C:/-- APLICACIONES DANI --/APP -- PRESENCIA/docs/jm.gomez_2026-02-05_07-20-38.xlsx';

console.log('📂 Analizando Excel real...\n');

try {
    const workbook = XLSX.readFile(EXCEL_PATH);

    console.log('📋 HOJAS DISPONIBLES:', workbook.SheetNames.join(', '));

    const worksheet = workbook.Sheets['BASE DATOS'];
    if (!worksheet) {
        console.error('❌ No se encontró hoja "BASE DATOS"');
        process.exit(1);
    }

    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    console.log(`📏 Rango del Excel: Filas ${range.s.r} a ${range.e.r}, Columnas ${range.s.c} a ${range.e.c}\n`);

    // Leer TODAS las columnas de la fila 44 (primera fila de datos)
    const ROW_44 = 43; // índice 0-based

    console.log('🔍 CONTENIDO COMPLETO DE LA FILA 44 (primera fila de datos):\n');

    for (let col = 0; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: ROW_44, c: col });
        const cell = worksheet[cellAddress];
        const value = cell ? cell.v : null;

        if (value !== null && value !== undefined && value !== '') {
            const colLetter = XLSX.utils.encode_col(col);
            console.log(`   ${colLetter} (${col}): ${JSON.stringify(value)}`);
        }
    }

    console.log('\n🔍 CONTENIDO DE FILAS 44-48 (primeras 5 filas de datos):\n');

    // Columnas clave según especificación
    const KEY_COLUMNS = {
        F: 5,  // ARTICULO
        G: 6,  // DESCRIPCION
        H: 7,  // CLIENTE
        I: 8,  // FECHA_REQUERIDA
        K: 10, // CANTIDAD
        N: 13, // PEDIDO
        R: 17, // BIN
        T: 19, // FASE_R
        V: 21  // LANZ
    };

    for (let row = 43; row < 48; row++) {
        console.log(`\n--- FILA ${row + 1} ---`);
        for (const [letter, colIdx] of Object.entries(KEY_COLUMNS)) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: colIdx });
            const cell = worksheet[cellAddress];
            const value = cell ? cell.v : null;
            console.log(`   ${letter} (${colIdx}): ${JSON.stringify(value)}`);
        }
    }

    console.log('\n✅ Análisis completado. Revisa los valores arriba para identificar la columna correcta.\n');

} catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
}
