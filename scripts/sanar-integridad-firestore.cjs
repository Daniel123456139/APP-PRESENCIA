const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const COLECCIONES_OBJETIVO = ['COMPETENCIAS', 'INCIDENT_LOG'];

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

async function main() {
  initAdmin();
  const db = admin.firestore();
  const aplicar = hasFlag('--aplicar');
  const eliminarOrigen = hasFlag('--eliminar-origen');
  const employeeSet = await getEmployeeSet(db);

  console.log('\n=== SANEAR INTEGRIDAD (SIN PERDIDA DE INFO) ===');
  console.log(`- Modo: ${aplicar ? 'APLICAR' : 'DRY-RUN'}`);
  console.log(`- Eliminar origen: ${eliminarOrigen ? 'SI' : 'NO'}`);

  let totalInvalidos = 0;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const safeSet = async (ref, payload) => {
    let attempt = 0;
    while (attempt < 5) {
      try {
        await ref.set(payload, { merge: true });
        return true;
      } catch (err) {
        attempt += 1;
        const isQuota = String(err?.message || '').includes('RESOURCE_EXHAUSTED');
        if (!isQuota || attempt >= 5) {
          throw err;
        }
        await wait(750 * attempt);
      }
    }
    return false;
  };

  for (const col of COLECCIONES_OBJETIVO) {
    const snap = await db.collection(col).get();
    let invalidos = 0;

    for (const d of snap.docs) {
      if (d.id === '_meta') continue;
      const data = d.data();
      const employeeId = resolveEmployeeId(data);
      const valid = employeeId && employeeSet.has(employeeId);
      if (valid) continue;

      invalidos++;
      totalInvalidos++;

      if (!aplicar) continue;

      const quarantineId = `${col}__${d.id}`;
      await safeSet(db.collection('INTEGRIDAD_CUARENTENA').doc(quarantineId), {
        origenColeccion: col,
        origenDocId: d.id,
        motivo: employeeId ? 'employeeId_sin_empleado' : 'employeeId_faltante',
        employeeIdDetectado: employeeId || null,
        payload: data,
        movidoEn: admin.firestore.FieldValue.serverTimestamp()
      });

      await wait(120);

      if (eliminarOrigen) {
        await d.ref.delete();
      }
    }

    console.log(`- ${col}: invalidos=${invalidos}`);
  }

  console.log(`\nTotal invalidos detectados: ${totalInvalidos}`);
  if (!aplicar) {
    console.log('Sin cambios. Ejecuta con --aplicar para guardar en INTEGRIDAD_CUARENTENA.');
  }
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
