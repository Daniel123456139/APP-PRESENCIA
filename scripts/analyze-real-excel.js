const XLSX = require('xlsx');

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
    console.log(`📏 Rango del Excel: Filas ${range.s.r + 1} a ${range.e.r + 1}, Columnas ${range.s.c} a ${range.e.c}\n`);

    // Función helper para leer celda
    function getCellValue(row, col) {
        const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
        const cell = worksheet[cellAddress];
        return cell ? cell.v : null;
    }

    // Leer encabezados (asumiendo fila 43 = fila 44 en Excel)
    console.log('📝 ENCABEZADOS (si existen en fila 43):\n');
    for (let col = 0; col <= 25; col++) {
        const value = getCellValue(42, col); // fila 43 en Excel
        if (value) {
            const colLetter = XLSX.utils.encode_col(col);
            console.log(`   ${colLetter} (índice ${col}): "${value}"`);
        }
    }

    // Leer TODAS las columnas de la fila 44 (primera fila de datos)
    const ROW_44 = 43; // índice 0-based (fila 44 en Excel)

    console.log('\n🔍 CONTENIDO COMPLETO DE LA FILA 44 (primera fila de datos):\n');

    for (let col = 0; col <= 25; col++) {
        const value = getCellValue(ROW_44, col);

        if (value !== null && value !== undefined && value !== '') {
            const colLetter = XLSX.utils.encode_col(col);
            console.log(`   ${colLetter} (índice ${col}): ${JSON.stringify(value)}`);
        }
    }

    console.log('\n🔍 PRIMERAS 5 FILAS DE DATOS (filas 44-48 en Excel):\n');

    // Columnas clave según especificación
    const KEY_COLUMNS = [
        { letter: 'F', idx: 5, name: 'ARTICULO' },
        { letter: 'G', idx: 6, name: 'DESCRIPCION' },
        { letter: 'H', idx: 7, name: 'CLIENTE' },
        { letter: 'I', idx: 8, name: 'FECHA_REQUERIDA' },
        { letter: 'K', idx: 10, name: 'CANTIDAD' },
        { letter: 'N', idx: 13, name: 'PEDIDO' },
        { letter: 'R', idx: 17, name: 'BIN' },
        { letter: 'T', idx: 19, name: 'FASE_R' },
        { letter: 'V', idx: 21, name: 'LANZ' }
    ];

    for (let row = 43; row < 48; row++) {
        console.log(`\n--- FILA ${row + 1} (Excel) ---`);
        KEY_COLUMNS.forEach(({ letter, idx, name }) => {
            const value = getCellValue(row, idx);
            console.log(`   ${letter} (${name}): ${JSON.stringify(value)}`);
        });
    }

    console.log('\n✅ Análisis completado.\n');

} catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
}
