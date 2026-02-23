const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const COLECCIONES_POR_APP = {
  PRESENCIA: [
    'USUARIOS',
    'CONFIGURACION',
    'EMPLEADOS_REF',
    'EMPLEADOS',
    'COMPETENCIAS',
    'NOTAS',
    'SICK_LEAVES',
    'BAJAS',
    'INCIDENT_LOG',
    'BAJAS_METADATA',
    'APP_GENERATED_PUNCHES',
    'EMPLOYEE_ACCESS_LOG'
  ],
  GESTION_TRABAJOS: [
    'USUARIOS',
    'EMPLEADOS_REF',
    'EMPLEADOS',
    'COMPETENCIAS',
    'NOTAS',
    'SICK_LEAVES',
    'BAJAS',
    'INCIDENT_LOG',
    'APP_GENERATED_PUNCHES',
    'EMPLOYEE_ACCESS_LOG'
  ],
  TALENTO: [
    'USUARIOS',
    'EMPLEADOS',
    'COMPETENCIAS',
    'NOTAS',
    'SKILLS',
    'COMPETENCY_DEFINITIONS',
    'CERTIFICACIONES',
    'HISTORIAL_EVALUACIONES',
    'FORMACIONES',
    'PLANES_FORMATIVOS_ANUALES',
    'FORMACION_JUSTIFICACIONES',
    'HOMOLOGACIONES_TECNICAS'
  ],
  FUTURO_COMPARTIDO: [
    'TRABAJOS',
    'COMPETENCIAS_DEF'
  ]
};

function inicializarAdmin() {
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

async function countDocs(db, collectionName) {
  try {
    const snap = await db.collection(collectionName).count().get();
    return snap.data().count || 0;
  } catch {
    return null;
  }
}

function resumenUsoPorApp(collectionName) {
  const apps = Object.entries(COLECCIONES_POR_APP)
    .filter(([, names]) => names.includes(collectionName))
    .map(([app]) => app);
  return apps;
}

async function main() {
  inicializarAdmin();
  const db = admin.firestore();

  const existentes = (await db.listCollections()).map((c) => c.id);
  const requeridas = Array.from(new Set(Object.values(COLECCIONES_POR_APP).flat()));
  const universo = Array.from(new Set([...existentes, ...requeridas])).sort((a, b) => a.localeCompare(b));

  const filas = [];
  for (const col of universo) {
    const docs = await countDocs(db, col);
    const existe = existentes.includes(col);
    const apps = resumenUsoPorApp(col);
    const estado = apps.length === 0
      ? (existe ? 'NO_REFERENCIADA' : 'NO_USADA')
      : (existe ? 'ACTIVA_O_LISTA' : 'FALTA_CREAR');

    filas.push({
      coleccion: col,
      existe,
      totalDocs: docs,
      apps,
      estado
    });
  }

  const faltantes = filas.filter((f) => f.estado === 'FALTA_CREAR');
  const noReferenciadas = filas.filter((f) => f.estado === 'NO_REFERENCIADA');

  console.log('\n=== AUDITORIA DE INTERCONEXION (3 APPS) ===\n');
  filas.forEach((f) => {
    const docsTxt = f.totalDocs === null ? 'n/d' : String(f.totalDocs);
    const appsTxt = f.apps.length ? f.apps.join(',') : '-';
    console.log(`- ${f.coleccion.padEnd(28)} | ${docsTxt.padStart(6)} docs | ${f.estado.padEnd(14)} | ${appsTxt}`);
  });

  console.log('\nResumen:');
  console.log(`- Total analizadas: ${filas.length}`);
  console.log(`- Faltan por crear: ${faltantes.length}`);
  console.log(`- No referenciadas: ${noReferenciadas.length}`);

  const outDir = path.join(process.cwd(), 'docs', 'firebase-auditorias');
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(outDir, `auditoria-interconexion-${ts}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ generadoEn: new Date().toISOString(), filas }, null, 2), 'utf8');
  console.log(`\nInforme guardado en: ${outPath}`);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
