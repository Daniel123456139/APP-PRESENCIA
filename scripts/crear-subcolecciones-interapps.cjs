const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

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

const SUBCOLECCIONES_EMPLEADO = [
  { nombre: 'talento_competencias', app: 'TALENTO', descripcion: 'Competencias evaluadas del empleado' },
  { nombre: 'talento_notas', app: 'TALENTO', descripcion: 'Notas de seguimiento del empleado' },
  { nombre: 'talento_certificaciones', app: 'TALENTO', descripcion: 'Certificaciones y documentos tecnicos' },
  { nombre: 'talento_formaciones', app: 'TALENTO', descripcion: 'Formaciones registradas para el empleado' },
  { nombre: 'talento_historial_evaluaciones', app: 'TALENTO', descripcion: 'Historial de cambios de evaluacion' },
  { nombre: 'presencia_bajas_activas', app: 'PRESENCIA', descripcion: 'Bajas activas por empleado' },
  { nombre: 'presencia_bajas_historico', app: 'PRESENCIA', descripcion: 'Historico de bajas por empleado' },
  { nombre: 'presencia_incidencias', app: 'PRESENCIA', descripcion: 'Incidencias de presencia por empleado' },
  { nombre: 'presencia_fichajes_app', app: 'PRESENCIA', descripcion: 'Fichajes sinteticos generados por app' },
  { nombre: 'trabajos_partes', app: 'GESTION_TRABAJOS', descripcion: 'Partes y trazabilidad de trabajos del empleado' }
];

async function getEmployeeDocs(db) {
  const refSnap = await db.collection('EMPLEADOS_REF').get();
  if (!refSnap.empty) {
    return refSnap.docs.map((d) => ({ id: d.id, source: 'EMPLEADOS_REF' }));
  }
  const legacySnap = await db.collection('EMPLEADOS').get();
  return legacySnap.docs.map((d) => ({ id: d.id, source: 'EMPLEADOS' }));
}

async function crearSubcoleccionesEmpleado(db, employeeId, aplicar) {
  const now = admin.firestore.FieldValue.serverTimestamp();

  if (!aplicar) {
    return SUBCOLECCIONES_EMPLEADO.length;
  }

  const batch = db.batch();
  for (const sub of SUBCOLECCIONES_EMPLEADO) {
    const metaRef = db
      .collection('EMPLEADOS')
      .doc(employeeId)
      .collection(sub.nombre)
      .doc('_meta');

    batch.set(metaRef, {
      subcoleccion: sub.nombre,
      appPropietaria: sub.app,
      descripcion: sub.descripcion,
      empleadoId: employeeId,
      activo: true,
      actualizadoEn: now
    }, { merge: true });
  }
  await batch.commit();
  return SUBCOLECCIONES_EMPLEADO.length;
}

async function crearMetadatoGlobal(db, aplicar) {
  if (!aplicar) return;
  await db.collection('CONFIGURACION').doc('interconexion_apps').set({
    nombre: 'Interconexion entre aplicaciones',
    version: '1.0.0',
    descripcion: 'Estructura compartida entre APP PRESENCIA, APP TALENTO y APP GESTION TRABAJOS',
    subcoleccionesEmpleado: SUBCOLECCIONES_EMPLEADO,
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const aplicar = hasFlag('--aplicar');

  const empleados = await getEmployeeDocs(db);

  console.log('\n=== CREACION DE SUBCOLECCIONES INTERAPPS ===');
  console.log(`- Empleados detectados: ${empleados.length}`);
  console.log(`- Subcolecciones por empleado: ${SUBCOLECCIONES_EMPLEADO.length}`);
  console.log(`- Modo: ${aplicar ? 'APLICAR' : 'DRY-RUN'}`);

  let total = 0;
  for (const emp of empleados) {
    const creadas = await crearSubcoleccionesEmpleado(db, emp.id, aplicar);
    total += creadas;
  }

  await crearMetadatoGlobal(db, aplicar);

  console.log(`\nTotal subcolecciones procesadas: ${total}`);
  if (!aplicar) {
    console.log('No se escribio nada. Ejecuta con --aplicar para crear la estructura.');
  } else {
    console.log('Estructura creada correctamente.');
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
