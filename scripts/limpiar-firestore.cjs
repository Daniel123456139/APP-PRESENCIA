const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { COLECCIONES_PROTEGIDAS } = require('./firestore-governance.config.cjs');

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return '';
  return process.argv[idx + 1] || '';
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function inicializarAdmin() {
  if (admin.apps.length > 0) return admin.app();

  const credPathFromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credPathLocal = path.join(__dirname, 'serviceAccount.json');
  const credPath = credPathFromEnv || credPathLocal;

  if (!fs.existsSync(credPath)) {
    throw new Error(
      'No se encontro credencial de Firebase Admin. Define GOOGLE_APPLICATION_CREDENTIALS o crea scripts/serviceAccount.json'
    );
  }

  const serviceAccount = require(credPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id || 'app-presencia'
  });
}

async function exportarColeccion(db, nombre, backupDir) {
  const snap = await db.collection(nombre).get();
  const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  const outPath = path.join(backupDir, `${nombre}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ coleccion: nombre, total: docs.length, docs }, null, 2), 'utf8');
  return docs.length;
}

async function eliminarColeccion(db, nombre) {
  const batchSize = 400;
  let totalEliminados = 0;

  while (true) {
    const snap = await db.collection(nombre).limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    totalEliminados += snap.size;
  }

  return totalEliminados;
}

async function main() {
  const csv = argValue('--colecciones');
  if (!csv) {
    throw new Error('Debes indicar --colecciones COL1,COL2');
  }

  const aplicar = hasFlag('--aplicar');
  const colecciones = csv
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const protegidasSolicitadas = colecciones.filter(c => COLECCIONES_PROTEGIDAS.includes(c));
  if (protegidasSolicitadas.length > 0) {
    throw new Error(`Bloqueado por seguridad. No se pueden borrar colecciones protegidas: ${protegidasSolicitadas.join(', ')}`);
  }

  inicializarAdmin();
  const db = admin.firestore();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'scripts', 'backups', 'firestore', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  console.log('\n=== LIMPIEZA FIRESTORE ===');
  console.log(`- Modo: ${aplicar ? 'APLICAR BORRADO' : 'DRY-RUN (sin borrar)'}`);
  console.log(`- Colecciones objetivo: ${colecciones.join(', ')}`);
  console.log(`- Backup: ${backupDir}\n`);

  for (const nombre of colecciones) {
    const existe = (await db.listCollections()).some(c => c.id === nombre);
    if (!existe) {
      console.log(`- ${nombre}: no existe, se omite`);
      continue;
    }

    const totalExportados = await exportarColeccion(db, nombre, backupDir);
    console.log(`- ${nombre}: backup OK (${totalExportados} docs)`);

    if (!aplicar) {
      console.log(`  > DRY-RUN: no se elimina ${nombre}`);
      continue;
    }

    const eliminados = await eliminarColeccion(db, nombre);
    console.log(`  > Eliminada ${nombre} (${eliminados} docs)`);
  }

  console.log('\nProceso completado.');
}

main().catch(err => {
  console.error('\nError en limpieza:', err.message);
  process.exit(1);
});
