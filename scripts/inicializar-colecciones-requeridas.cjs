const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const COLECCIONES_REQUERIDAS = {
  USUARIOS: 'Perfiles de acceso y roles unificados',
  CONFIGURACION: 'Configuraciones globales compartidas',
  EMPLEADOS: 'Datos enriquecidos de empleados',
  EMPLEADOS_REF: 'Referencia compartida de empleados para migracion',
  COMPETENCIAS: 'Evaluaciones de competencias',
  NOTAS: 'Notas de seguimiento',
  SKILLS: 'Catalogo historico de habilidades (compatibilidad)',
  COMPETENCY_DEFINITIONS: 'Definiciones historicas de competencias (compatibilidad)',
  COMPETENCIAS_DEF: 'Catalogo unificado de competencias',
  CERTIFICACIONES: 'Certificaciones de empleados',
  HISTORIAL_EVALUACIONES: 'Historial de cambios en evaluaciones',
  FORMACIONES: 'Acciones formativas individuales',
  PLANES_FORMATIVOS_ANUALES: 'Planificacion anual de formacion',
  FORMACION_JUSTIFICACIONES: 'Justificaciones de fichajes de formacion',
  HOMOLOGACIONES_TECNICAS: 'Homologaciones tecnicas por persona',
  SICK_LEAVES: 'Bajas medicas activas',
  BAJAS: 'Historico de bajas cerradas',
  BAJAS_METADATA: 'Metadatos de seguimiento de bajas',
  INCIDENT_LOG: 'Registro inmutable de incidencias',
  APP_GENERATED_PUNCHES: 'Fichajes sinteticos generados por app',
  EMPLOYEE_ACCESS_LOG: 'Auditoria de accesos a ficha',
  TRABAJOS: 'Contenedor de gestion de trabajos'
};

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

async function main() {
  const aplicar = hasFlag('--aplicar');
  initAdmin();
  const db = admin.firestore();

  console.log('\n=== INICIALIZACION DE COLECCIONES REQUERIDAS ===');
  console.log(`- Modo: ${aplicar ? 'APLICAR' : 'DRY-RUN'}`);

  const existentes = new Set((await db.listCollections()).map((c) => c.id));

  for (const [name, desc] of Object.entries(COLECCIONES_REQUERIDAS)) {
    const exists = existentes.has(name);
    if (exists) {
      console.log(`- ${name}: ya existe`);
      continue;
    }

    console.log(`- ${name}: se creara (_meta)`);
    if (!aplicar) continue;

    await db.collection(name).doc('_meta').set({
      coleccion: name,
      descripcion: desc,
      inicializadaPor: 'script/inicializar-colecciones-requeridas.cjs',
      inicializadaEn: admin.firestore.FieldValue.serverTimestamp(),
      activo: true
    }, { merge: true });
  }

  console.log('\nProceso completado.');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
