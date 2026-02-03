
import { generateGapStrategy } from '../src/services/incidentStrategies';

// Mock data
// We cast to any to avoid needing the full type definition for the test
const mockEmployee: any = {
    operario: 1,
    nombre: 'Test User',
    colectivo: 'Test Dept',
    turnoAsignado: 'M' // 07:00 - 15:00
};

const mockGap: any = {
    date: '2026-01-30',
    start: '08:00', // Middle gap start
    end: '11:00',   // Middle gap end
    originPunchId: undefined
};

const mockReason = { id: 2, desc: 'Médico' };

console.log('--- Testing Middle Gap Logic ---');
console.log(`Shift: 07:00 - 15:00`);
console.log(`Gap: ${mockGap.start} - ${mockGap.end}`);

try {
    const result = generateGapStrategy(mockGap, mockReason, mockEmployee);

    console.log('Result Description:', result.description);
    // console.log('Rows to Insert:', JSON.stringify(result.rowsToInsert, null, 2));

    // Validations
    const entryRow = result.rowsToInsert.find((r: any) => r.Entrada === 1);
    const exitRow = result.rowsToInsert.find((r: any) => r.Entrada === 0);

    let success = true;

    if (!entryRow || !exitRow) {
        console.error('FAIL: Missing entry or exit row');
        success = false;
    } else {
        // Expect Entry at 08:01
        // Expect Exit at 10:59
        if (entryRow.Hora === '08:01') {
            console.log('PASS: Entry time is 08:01');
        } else {
            console.error(`FAIL: Entry time is ${entryRow.Hora}, expected 08:01`);
            success = false;
        }

        if (exitRow.Hora === '10:59') {
            console.log('PASS: Exit time is 10:59');
        } else {
            console.error(`FAIL: Exit time is ${exitRow.Hora}, expected 10:59`);
            success = false;
        }
    }

    if (success) {
        console.log('--- VERIFICATION SUCCESSFUL ---');
        process.exit(0);
    } else {
        console.error('--- VERIFICATION FAILED ---');
        process.exit(1);
    }
} catch (error) {
    console.error('Runtime Error:', error);
    process.exit(1);
}
