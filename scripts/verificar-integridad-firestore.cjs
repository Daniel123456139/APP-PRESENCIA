const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

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

function normalizeEmployeeId(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  return /^\d+$/.test(raw) ? raw.padStart(3, '0') : raw;
}

function resolveEmployeeId(data) {
  const keys = ['employeeId', 'IDOperario', 'operario', 'operarioId', 'idOperario', 'uidEmpleado'];
  for (const key of keys) {
    const id = normalizeEmployeeId(data?.[key]);
    if (id) return id;
  }
  return null;
}

async function getEmployeeSet(db) {
  const ids = new Set();
  const snap = await db.collection('EMPLEADOS').get();
  snap.docs.forEach((d) => ids.add(normalizeEmployeeId(d.id)));
  return ids;
}

async function checkCollectionRefs(db, employeeSet, collectionName) {
  const snap = await db.collection(collectionName).get();
  let total = 0;
  let valid = 0;
  let invalid = 0;
  let sinEmployeeId = 0;

  for (const d of snap.docs) {
    if (d.id === '_meta' || d.id === '_placeholder') continue;
    total++;
    const data = d.data();
    const employeeId = resolveEmployeeId(data);
    if (!employeeId) {
      sinEmployeeId++;
      continue;
    }
    if (employeeSet.has(employeeId)) valid++;
    else invalid++;
  }

  return { collectionName, total, valid, invalid, sinEmployeeId };
}

async function checkSubcollectionRefs(db, employeeSet, subCollectionName) {
  const snap = await db.collectionGroup(subCollectionName).get();
  let total = 0;
  let valid = 0;
  let invalid = 0;
  let sinEmployeeId = 0;

  for (const d of snap.docs) {
    if (d.id === '_meta') continue;
    total++;
    const data = d.data();
    const employeeId = resolveEmployeeId(data);
    if (!employeeId) {
      sinEmployeeId++;
      continue;
    }
    if (employeeSet.has(employeeId)) valid++;
    else invalid++;
  }

  return { subCollectionName, total, valid, invalid, sinEmployeeId };
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const employeeSet = await getEmployeeSet(db);

  const colecciones = [
    'COMPETENCIAS',
    'NOTAS',
    'SICK_LEAVES',
    'BAJAS',
    'INCIDENT_LOG',
    'APP_GENERATED_PUNCHES',
    'CERTIFICACIONES',
    'FORMACIONES',
    'HISTORIAL_EVALUACIONES'
  ];

  const subcolecciones = [
    'talento_competencias',
    'talento_notas',
    'talento_certificaciones',
    'talento_formaciones',
    'talento_historial_evaluaciones',
    'presencia_bajas_activas',
    'presencia_bajas_historico',
    'presencia_incidencias',
    'presencia_fichajes_app',
    'trabajos_partes'
  ];

  console.log('\n=== VERIFICACION DE INTEGRIDAD FIRESTORE ===\n');
  console.log(`Empleados base detectados: ${employeeSet.size}\n`);

  const report = {
    generadoEn: new Date().toISOString(),
    empleadosBase: employeeSet.size,
    colecciones: [],
    subcolecciones: []
  };

  for (const name of colecciones) {
    const r = await checkCollectionRefs(db, employeeSet, name);
    report.colecciones.push(r);
    console.log(`- ${name.padEnd(24)} total=${String(r.total).padStart(5)} valid=${String(r.valid).padStart(5)} invalid=${String(r.invalid).padStart(5)} sinId=${String(r.sinEmployeeId).padStart(5)}`);
  }

  console.log('\nSubcolecciones:\n');
  for (const name of subcolecciones) {
    const r = await checkSubcollectionRefs(db, employeeSet, name);
    report.subcolecciones.push(r);
    console.log(`- ${name.padEnd(28)} total=${String(r.total).padStart(5)} valid=${String(r.valid).padStart(5)} invalid=${String(r.invalid).padStart(5)} sinId=${String(r.sinEmployeeId).padStart(5)}`);
  }

  const outDir = path.join(process.cwd(), 'docs', 'firebase-auditorias');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `integridad-firestore-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nInforme guardado en: ${outPath}`);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
