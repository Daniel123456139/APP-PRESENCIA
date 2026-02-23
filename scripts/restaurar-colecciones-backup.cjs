const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return '';
  return process.argv[idx + 1] || '';
}

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

async function restoreFile(db, filePath, aplicar) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(raw);
  const collectionName = payload.coleccion;
  const docs = payload.docs || [];

  console.log(`- ${collectionName}: ${docs.length} docs en backup`);

  if (!aplicar) {
    console.log('  > DRY-RUN: sin escritura');
    return;
  }

  const batchSize = 350;
  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const batch = db.batch();
    chunk.forEach((item) => {
      batch.set(db.collection(collectionName).doc(item.id), item.data, { merge: true });
    });
    await batch.commit();
  }

  console.log('  > Restaurada correctamente');
}

async function main() {
  const backupDir = getArg('--backupDir');
  const filesArg = getArg('--archivos');
  const aplicar = hasFlag('--aplicar');

  if (!backupDir || !filesArg) {
    throw new Error('Uso: node scripts/restaurar-colecciones-backup.cjs --backupDir <ruta> --archivos A.json,B.json [--aplicar]');
  }

  initAdmin();
  const db = admin.firestore();

  const files = filesArg.split(',').map((f) => f.trim()).filter(Boolean);

  console.log('\n=== RESTAURACION DE COLECCIONES ===');
  console.log(`- Modo: ${aplicar ? 'APLICAR' : 'DRY-RUN'}`);
  console.log(`- Backup: ${backupDir}`);

  for (const fileName of files) {
    const filePath = path.join(backupDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.log(`- ${fileName}: no existe en backup`);
      continue;
    }
    await restoreFile(db, filePath, aplicar);
  }

  console.log('\nProceso de restauracion completado.');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
