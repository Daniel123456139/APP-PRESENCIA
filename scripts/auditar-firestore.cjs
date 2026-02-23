const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { COLECCIONES_PROTEGIDAS, COLECCIONES_LEGADO } = require('./firestore-governance.config.cjs');

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

  return admin.app();
}

async function contarColeccion(db, nombre) {
  try {
    const snap = await db.collection(nombre).count().get();
    return snap.data().count || 0;
  } catch {
    return null;
  }
}

function clasificarColeccion(nombre) {
  if (COLECCIONES_PROTEGIDAS.includes(nombre)) {
    if (COLECCIONES_LEGADO.includes(nombre)) return 'LEGADO_MANTENER';
    return 'ACTIVA';
  }
  return 'CANDIDATA_ELIMINAR';
}

async function main() {
  console.log('\n=== AUDITORIA FIRESTORE (BD COMPARTIDA) ===\n');
  inicializarAdmin();
  const db = admin.firestore();

  const collections = await db.listCollections();
  const nombres = collections.map(c => c.id).sort((a, b) => a.localeCompare(b));

  const resultado = [];
  for (const nombre of nombres) {
    const totalDocs = await contarColeccion(db, nombre);
    resultado.push({
      coleccion: nombre,
      estado: clasificarColeccion(nombre),
      totalDocs
    });
  }

  const activas = resultado.filter(r => r.estado === 'ACTIVA').length;
  const legado = resultado.filter(r => r.estado === 'LEGADO_MANTENER').length;
  const candidatas = resultado.filter(r => r.estado === 'CANDIDATA_ELIMINAR').length;

  console.log('Colecciones detectadas:\n');
  for (const row of resultado) {
    const docsTxt = row.totalDocs === null ? 'n/d' : row.totalDocs;
    console.log(`- ${row.coleccion.padEnd(28)} | ${String(docsTxt).padStart(6)} docs | ${row.estado}`);
  }

  console.log('\nResumen:');
  console.log(`- Activas: ${activas}`);
  console.log(`- Legado mantener: ${legado}`);
  console.log(`- Candidatas a eliminar: ${candidatas}`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'docs', 'firebase-auditorias');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `auditoria-firestore-${timestamp}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ generadoEn: new Date().toISOString(), resultado }, null, 2), 'utf8');

  console.log(`\nInforme guardado en: ${outPath}`);

  const candidatasList = resultado
    .filter(r => r.estado === 'CANDIDATA_ELIMINAR')
    .map(r => r.coleccion);

  if (candidatasList.length > 0) {
    console.log('\nSugerencia de limpieza (dry-run):');
    console.log(`node scripts/limpiar-firestore.cjs --colecciones ${candidatasList.join(',')}`);
    console.log('Aplicar borrado real: añade --aplicar');
  }
}

main().catch(err => {
  console.error('\nError en auditoria:', err.message);
  process.exit(1);
});
