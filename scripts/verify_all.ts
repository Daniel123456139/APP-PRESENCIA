
import { generateGapStrategy } from '../src/services/incidentStrategies';
import { validateNewIncidents } from '../src/services/validationService';
import { generateProcessedData } from '../src/services/dataProcessor';
import { RawDataRow, UnjustifiedGap, User } from '../src/types';

// Mock helpers
const createMockUser = (id: number): User => ({
    id,
    name: `User ${id}`,
    role: 'Operario' as any
});

// --- TEST 1: Gap Strategy (Leave and Return) ---
console.log('\n--- TEST 1: Gap Strategy (Leave and Return) ---');
const mockGap: UnjustifiedGap = {
    date: '2026-01-30',
    start: '08:00',
    end: '11:00'
};
const mockReason = { id: 2, desc: 'Médico' };
const mockEmployee = { operario: 1, nombre: 'Test', turnoAsignado: 'M' } as any;

const strategy = generateGapStrategy(mockGap, mockReason, mockEmployee);
const entryRow = strategy.rowsToInsert.find(r => r.Entrada === 1);
const exitRow = strategy.rowsToInsert.find(r => r.Entrada === 0);

if (entryRow?.Hora === '08:01' && exitRow?.Hora === '10:59') {
    console.log('✅ PASS: Strategy generates 08:01 Entry and 10:59 Exit.');
} else {
    console.error('❌ FAIL: Strategy outputs:', entryRow?.Hora, exitRow?.Hora);
    process.exit(1);
}


// --- TEST 2: Validation Performance ---
console.log('\n--- TEST 2: Validation Performance (Optimization) ---');
console.log('Generating 50,000 mock rows...');
const hugeDataset: RawDataRow[] = [];
for (let i = 0; i < 50000; i++) {
    hugeDataset.push({
        IDOperario: Math.floor(i / 100),
        Fecha: '2025-01-01',
        Hora: '08:00',
        Entrada: 1,
        DescDepartamento: 'Test',
        DescOperario: 'Test',
        MotivoAusencia: 0,
        DescMotivoAusencia: '',
        Computable: 'Sí',
        IDTipoTurno: null,
        Inicio: '00:00',
        Fin: '00:00',
        TipoDiaEmpresa: 0,
        TurnoTexto: 'M'
    });
}

const rowsToValidate: RawDataRow[] = [{
    IDOperario: 9999, // New employee, not in dataset
    Fecha: '2026-01-30',
    Hora: '08:00',
    Entrada: 1,
    DescDepartamento: 'Test',
    DescOperario: 'New Guy',
    MotivoAusencia: 0,
    DescMotivoAusencia: '',
    Computable: 'Sí',
    IDTipoTurno: null,
    Inicio: '00:00',
    Fin: '00:00',
    TipoDiaEmpresa: 0,
    TurnoTexto: 'M'
}];

const start = performance.now();
const issues = validateNewIncidents(hugeDataset, rowsToValidate);
const end = performance.now();
const duration = end - start;

console.log(`Validation took ${duration.toFixed(2)}ms`);
if (duration < 50) { // Should be super fast O(1) mostly
    console.log('✅ PASS: Validation is performant.');
} else {
    console.warn(`⚠️ WARN: Validation took longer than expected (${duration.toFixed(2)}ms), but might be acceptable depending on environment.`);
}


// --- TEST 3: TAJ Aggregation (Manual Code 14) ---
console.log('\n--- TEST 3: TAJ Aggregation (Manual Code 14) ---');
const tajRows: RawDataRow[] = [
    // 07:00 Entry
    {
        IDOperario: 1, Fecha: '2026-01-30', Hora: '07:00:00', Entrada: 1,
        DescDepartamento: 'Dep', DescOperario: 'User 1', MotivoAusencia: 0, DescMotivoAusencia: '', Computable: 'Sí', IDTipoTurno: 'M', Inicio: '00:00', Fin: '00:00', TipoDiaEmpresa: 0, TurnoTexto: 'M'
    },
    // 09:00 Exit (TAJ Code 14) - 2 hours duration
    {
        IDOperario: 1, Fecha: '2026-01-30', Hora: '09:00:00', Entrada: 0,
        DescDepartamento: 'Dep', DescOperario: 'User 1', MotivoAusencia: 14, DescMotivoAusencia: 'TAJ Manual', Computable: 'Sí', IDTipoTurno: 'M',
        Inicio: '07:00', Fin: '09:00', // IMPORTANT: Processor uses Inicio/Fin if available for range calc? No, it uses prev row logic mostly but let's see.
        TipoDiaEmpresa: 0, TurnoTexto: 'M'
    },
    // 09:00 Entry
    {
        IDOperario: 1, Fecha: '2026-01-30', Hora: '09:00:00', Entrada: 1,
        DescDepartamento: 'Dep', DescOperario: 'User 1', MotivoAusencia: 0, DescMotivoAusencia: '', Computable: 'Sí', IDTipoTurno: 'M', Inicio: '00:00', Fin: '00:00', TipoDiaEmpresa: 0, TurnoTexto: 'M'
    },
    // 15:00 Exit
    {
        IDOperario: 1, Fecha: '2026-01-30', Hora: '15:00:00', Entrada: 0,
        DescDepartamento: 'Dep', DescOperario: 'User 1', MotivoAusencia: 0, DescMotivoAusencia: '', Computable: 'Sí', IDTipoTurno: 'M', Inicio: '00:00', Fin: '00:00', TipoDiaEmpresa: 0, TurnoTexto: 'M'
    }
];

const processed = generateProcessedData(tajRows, [createMockUser(1)]);
const employee = processed.get(1);

if (employee) {
    console.log('Processed Stats:', {
        hTAJ: employee.hTAJ,
        horasJustificadas: employee.horasJustificadas, // Should be 0, as TAJ is not "justified" in the "paid" sense
        horasDia: employee.horasDia
    });

    if (employee.hTAJ === 2) {
        console.log('✅ PASS: hTAJ increased by 2 hours.');
    } else {
        console.error('❌ FAIL: hTAJ is', employee.hTAJ, 'expected 2');
    }
} else {
    console.error('❌ FAIL: Employee not processed');
}
