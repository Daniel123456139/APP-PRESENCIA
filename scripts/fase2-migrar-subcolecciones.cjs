const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const MIGRACIONES = [
  { origen: 'COMPETENCIAS', destino: 'talento_competencias' },
  { origen: 'NOTAS', destino: 'talento_notas' },
  { origen: 'CERTIFICACIONES', destino: 'talento_certificaciones' },
  { origen: 'FORMACIONES', destino: 'talento_formaciones' },
  { origen: 'HISTORIAL_EVALUACIONES', destino: 'talento_historial_evaluaciones' },
  { origen: 'INCIDENT_LOG', destino: 'presencia_incidencias' },
  { origen: 'APP_GENERATED_PUNCHES', destino: 'presencia_fichajes_app' },
  { origen: 'TRABAJOS', destino: 'trabajos_partes' }
];

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function initAdmin() {
  if (admin.apps.length > 0) return;
  const credPathEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credPathLocal = path.join(__dirname, 'serviceAccount.json');
  const credPath = credPathEnv || credPathLocal;

  if (!fs.existsSync(credPath)) {
    throw new Error('No se encontro credencial Admin SDK. Usa GOOGLE_APPLICATION_CREDENTIALS o scripts/serviceAccount.json');
  }

  const serviceAccount = require(credPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'app-presencia'
  });
}

function formatEmployeeId(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw.padStart(3, '0');
  return raw;
}

function resolveEmployeeId(data) {
  const candidates = [
    data.employeeId,
    data.IDOperario,
    data.operario,
    data.operarioId,
    data.idOperario,
    data.uidEmpleado,
    data.empId
  ];

  for (const value of candidates) {
    const normalized = formatEmployeeId(value);
    if (normalized) return normalized;
  }

  return null;
}

async function getEmployeeIndex(db) {
  const byId = new Set();
  const snap = await db.collection('EMPLEADOS').get();
  snap.docs.forEach((d) => byId.add(formatEmployeeId(d.id)));
  return byId;
}

async function upsertSubDoc(db, employeeId, subCollection, docId, payload, aplicar) {
  if (!aplicar) return;
  await db
    .collection('EMPLEADOS')
    .doc(employeeId)
    .collection(subCollection)
    .doc(docId)
    .set(payload, { merge: true });
}

async function migrarBajas(db, aplicar, employeeIndex) {
  let total = 0;
  let migradas = 0;
  let omitidas = 0;

  const active = await db.collection('SICK_LEAVES').get();
  for (const d of active.docs) {
    total++;
    const data = d.data();
    const employeeId = formatEmployeeId(data.employeeId);
    if (!employeeId || !employeeIndex.has(employeeId)) {
      omitidas++;
      continue;
    }
    const destino = data.status === 'Cerrada' ? 'presencia_bajas_historico' : 'presencia_bajas_activas';
    await upsertSubDoc(db, employeeId, destino, d.id, { ...data, origen: 'SICK_LEAVES' }, aplicar);
    migradas++;
  }

  const historic = await db.collection('BAJAS').get();
  for (const d of historic.docs) {
    total++;
    const data = d.data();
    const employeeId = formatEmployeeId(data.employeeId);
    if (!employeeId || !employeeIndex.has(employeeId)) {
      omitidas++;
      continue;
    }
    await upsertSubDoc(db, employeeId, 'presencia_bajas_historico', d.id, { ...data, origen: 'BAJAS' }, aplicar);
    migradas++;
  }

  return { origen: 'SICK_LEAVES+BAJAS', destino: 'presencia_bajas_*', total, migradas, omitidas };
}

async function migrarColeccion(db, mapping, aplicar, employeeIndex) {
  const snap = await db.collection(mapping.origen).get();
  let total = 0;
  let migradas = 0;
  let omitidas = 0;

  for (const d of snap.docs) {
    total++;
    const data = d.data();
    const employeeId = resolveEmployeeId(data);

    if (!employeeId || !employeeIndex.has(employeeId)) {
      omitidas++;
      continue;
    }

    await upsertSubDoc(
      db,
      employeeId,
      mapping.destino,
      d.id,
      { ...data, origen: mapping.origen },
      aplicar
    );
    migradas++;
  }

  return {
    origen: mapping.origen,
    destino: mapping.destino,
    total,
    migradas,
    omitidas
  };
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const aplicar = hasFlag('--aplicar');

  const employeeIndex = await getEmployeeIndex(db);

  console.log('\n=== FASE 2: MIGRACION A SUBCOLECCIONES ===');
  console.log(`- Empleados base: ${employeeIndex.size}`);
  console.log(`- Modo: ${aplicar ? 'APLICAR' : 'DRY-RUN'}`);

  const resultados = [];
  resultados.push(await migrarBajas(db, aplicar, employeeIndex));

  for (const mapping of MIGRACIONES) {
    resultados.push(await migrarColeccion(db, mapping, aplicar, employeeIndex));
  }

  console.log('\nDetalle:');
  resultados.forEach((r) => {
    console.log(`- ${r.origen} -> ${r.destino}: total=${r.total}, migradas=${r.migradas}, omitidas=${r.omitidas}`);
  });

  const migradasTotal = resultados.reduce((acc, r) => acc + r.migradas, 0);
  const omitidasTotal = resultados.reduce((acc, r) => acc + r.omitidas, 0);
  console.log(`\nTotales: migradas=${migradasTotal}, omitidas=${omitidasTotal}`);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
