const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'app-presencia' });
const db = admin.firestore();
const auth = admin.auth();

function permisos(rol) {
  return {
    SUPER_ADMIN:     { presencia: { ver: true, editar: true }, talento: { ver: true, editar: true }, trabajos: { ver: true, editar: true }, configuracion: { ver: true, editar: true } },
    RRHH:            { presencia: { ver: true, editar: true }, talento: { ver: true, editar: true }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
    OPERADOR:        { presencia: { ver: true, editar: true }, talento: { ver: false, editar: false }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
    GESTOR_TRABAJOS: { presencia: { ver: false, editar: false }, talento: { ver: true, editar: false }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
  }[rol] || {};
}

const USUARIOS = [
  { uid: 'p9gAi7YhYodilsgUyc9F8ceggDr2', nombre: 'DANI',    email: 'd.soler@favram.com',        rol: 'SUPER_ADMIN' },
  { uid: 'u36nsTO4cRMUTEHfl6TTBnORzEV2', nombre: 'ESTHER',  email: 'e.juvera@favram.com',       rol: 'RRHH' },
  { uid: 'ginVkFA1nkdgZ1zZFGtrvAk18832', nombre: 'RRHH',    email: 'rrhh@favram.com',            rol: 'RRHH' },
  { uid: '2jxteltppDdjLlpxkZ5dUCqUAVs2', nombre: 'LUIS',    email: 'l.asensio@favram.com',      rol: 'OPERADOR' },
  { uid: '5czSXMTFEpTAUrHNY2BjPU4tJ5h1', nombre: 'ALBERTO', email: 'a.barrientos@favram.com',  rol: 'OPERADOR' },
  { uid: 'wKn7I23cgDPEnpRULFjfmHu94Xr1', nombre: 'JORGE',   email: 'j.diaz@favram.com',         rol: 'GESTOR_TRABAJOS' },
  { uid: 'Enz3ppLo0WXSqrKDvlZQORuqQDd2', nombre: 'RAUL',    email: 'r.ruiz@favram.com',          rol: 'GESTOR_TRABAJOS' },
];

async function main() {
  console.log('\n═══════════════════════════════════════');
  console.log('  INICIALIZACIÓN BD.GESTION-PERSONAL');
  console.log('═══════════════════════════════════════\n');

  const batch = db.batch();

  // CONFIGURACION/sistema
  batch.set(db.collection('CONFIGURACION').doc('sistema'), {
    nombre: 'BD.GESTION-PERSONAL', version: '1.0.0',
    descripcion: 'Base de datos unificada para APP-PRESENCIA, APP-TALENTO y APP-GESTION-TRABAJOS — Favram S.L.',
    apps: ['APP-PRESENCIA', 'APP-TALENTO', 'APP-GESTION-TRABAJOS'],
    roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR', 'GESTOR_TRABAJOS'],
    actualizadoEn: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // CONFIGURACION/calendarios
  batch.set(db.collection('CONFIGURACION').doc('calendarios'), {
    descripcion: 'Festivos por año', festivos2025: [], festivos2026: [],
  }, { merge: true });

  // TRABAJOS placeholder
  batch.set(db.collection('TRABAJOS').doc('_placeholder'), {
    _info: 'Colección TRABAJOS inicializada', _borrar: true,
  }, { merge: true });

  // COMPETENCIAS_DEF placeholder
  batch.set(db.collection('COMPETENCIAS_DEF').doc('_placeholder'), {
    _info: 'Catálogo unificado de competencias', _borrar: true,
  }, { merge: true });

  // USUARIOS — 7 documentos con nuevos UIDs
  console.log('📋 Preparando documentos USUARIOS...');
  for (const u of USUARIOS) {
    batch.set(db.collection('USUARIOS').doc(u.uid), {
      nombre: u.nombre, email: u.email, rol: u.rol, activo: true,
      permisos: permisos(u.rol),
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  → ${u.nombre} (${u.rol})`);
  }

  await batch.commit();
  console.log('\n✅ Batch Firestore completado!\n');

  // Verificar custom claims
  console.log('🔐 Verificando custom claims en Auth...');
  for (const u of USUARIOS) {
    const user = await auth.getUser(u.uid);
    const claim = user.customClaims?.rol || '(sin claim)';
    const ok = claim === u.rol;
    console.log(`  ${ok ? '✅' : '⚠️ '} ${u.nombre}: claim="${claim}" ${!ok ? '← CORREGIDO' : ''}`);
    if (!ok) {
      await auth.setCustomUserClaims(u.uid, { rol: u.rol });
      console.log(`     → Claim "${u.rol}" asignado`);
    }
  }

  console.log('\n🎉 BD.GESTION-PERSONAL inicializada correctamente!');
  console.log('\n────── RESUMEN DE USUARIOS ──────');
  for (const u of USUARIOS) {
    console.log(`  ${u.nombre.padEnd(10)} | ${u.rol.padEnd(16)} | ${u.uid}`);
  }
  console.log('──────────────────────────────────\n');
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1); });
