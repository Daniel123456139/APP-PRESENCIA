const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const VALIDACIONES = [
  ['COMPETENCIAS', 'talento_competencias'],
  ['NOTAS', 'talento_notas'],
  ['CERTIFICACIONES', 'talento_certificaciones'],
  ['FORMACIONES', 'talento_formaciones'],
  ['HISTORIAL_EVALUACIONES', 'talento_historial_evaluaciones'],
  ['INCIDENT_LOG', 'presencia_incidencias'],
  ['APP_GENERATED_PUNCHES', 'presencia_fichajes_app'],
  ['TRABAJOS', 'trabajos_partes']
];

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

async function countTop(db, collectionName) {
  const snap = await db.collection(collectionName).count().get();
  return snap.data().count || 0;
}

async function countSub(db, subCollection) {
  const snap = await db.collectionGroup(subCollection).get();
  let total = 0;
  snap.docs.forEach((d) => {
    if (d.id !== '_meta') total++;
  });
  return total;
}

async function main() {
  initAdmin();
  const db = admin.firestore();

  console.log('\n=== FASE 2: VALIDACION SUBCOLECCIONES ===\n');
  for (const [origen, sub] of VALIDACIONES) {
    const top = await countTop(db, origen);
    const subCount = await countSub(db, sub);
    const ratio = top === 0 ? 'n/a' : `${((subCount / top) * 100).toFixed(1)}%`;
    console.log(`- ${origen.padEnd(24)} | top=${String(top).padStart(5)} | sub(${sub})=${String(subCount).padStart(5)} | cobertura=${ratio}`);
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
