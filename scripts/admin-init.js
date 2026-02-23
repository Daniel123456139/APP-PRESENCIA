/**
 * ADMIN SCRIPT — Crear usuarios faltantes e inicializar BD.GESTION-PERSONAL
 * 
 * REQUISITOS:
 *   npm install firebase-admin
 * 
 * EJECUCIÓN:
 *   node scripts/admin-init.js
 * 
 * NOTA: Necesitas descargar el service account JSON desde:
 *   Firebase Console > Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada
 *   y guardarlo como scripts/serviceAccount.json (NO subas este fichero a Git)
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'app-presencia',
});

const auth = admin.auth();
const db = admin.firestore();

// ─── Usuarios a crear ─────────────────────────────────────────────
const USUARIOS_A_CREAR = [
  { nombre: 'ALBERTO', email: 'a.barrientos@favram.com', rol: 'OPERADOR' },
  { nombre: 'JORGE',   email: 'j.diaz@favram.com',        rol: 'GESTOR_TRABAJOS' },
  { nombre: 'RAUL',    email: 'r.ruiz@favram.com',         rol: 'GESTOR_TRABAJOS' },
];

// ─── Usuarios ya existentes (UIDs conocidos) ──────────────────────
const USUARIOS_EXISTENTES = [
  {
    uid: '08skiaqJ9PUxWC1ghoxKZEdGZpG2', nombre: 'DANI',
    email: 'd.soler@favram.com', rol: 'SUPER_ADMIN',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: true, editar: true },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: true, editar: true },
    },
  },
  {
    uid: 'BSzx9PdQEQfXWLXJEUxLF8VM4dE2', nombre: 'ESTHER',
    email: 'e.juvera@favram.com', rol: 'RRHH',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: true, editar: true },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: false, editar: false },
    },
  },
  {
    uid: 'FnoRJEUWzXfhp2iArcUq0ZaagR53', nombre: 'RRHH',
    email: 'rrhh@favram.com', rol: 'RRHH',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: true, editar: true },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: false, editar: false },
    },
  },
  {
    uid: 'iOCgmwlrgWerN669DUXPxxA8rDG2', nombre: 'LUIS',
    email: 'l.asensio@favram.com', rol: 'OPERADOR',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: false, editar: false },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: false, editar: false },
    },
  },
];

function permisosParaRol(rol) {
  switch (rol) {
    case 'SUPER_ADMIN':
      return {
        presencia: { ver: true, editar: true },
        talento: { ver: true, editar: true },
        trabajos: { ver: true, editar: true },
        configuracion: { ver: true, editar: true },
      };
    case 'RRHH':
      return {
        presencia: { ver: true, editar: true },
        talento: { ver: true, editar: true },
        trabajos: { ver: true, editar: true },
        configuracion: { ver: false, editar: false },
      };
    case 'OPERADOR':
      return {
        presencia: { ver: true, editar: true },
        talento: { ver: false, editar: false },
        trabajos: { ver: true, editar: true },
        configuracion: { ver: false, editar: false },
      };
    case 'GESTOR_TRABAJOS':
      return {
        presencia: { ver: false, editar: false },
        talento: { ver: true, editar: false }, // solo ver (sin fichas empleado)
        trabajos: { ver: true, editar: true },
        configuracion: { ver: false, editar: false },
      };
    default:
      return {};
  }
}

async function main() {
  console.log('\n════════════════════════════════════════════');
  console.log('  INICIALIZACIÓN BD.GESTION-PERSONAL');
  console.log('════════════════════════════════════════════\n');

  const batch = db.batch();

  // ── PASO 1: Crear nuevos usuarios en Auth ─────────────────────
  console.log('📋 PASO 1: Creando usuarios en Firebase Auth...');
  const uidsNuevos = {};

  for (const usuario of USUARIOS_A_CREAR) {
    try {
      const userRecord = await auth.createUser({
        email: usuario.email,
        password: 'Favram2026!',
        displayName: usuario.nombre,
        emailVerified: false,
      });
      console.log(`  ✅ Creado: ${usuario.email} → UID: ${userRecord.uid}`);
      uidsNuevos[usuario.email] = userRecord.uid;

      // Asignar custom claim 'rol'
      await auth.setCustomUserClaims(userRecord.uid, { rol: usuario.rol });
      console.log(`  ✅ Claim asignado: ${usuario.rol} → ${usuario.email}`);
    } catch (err) {
      if (err.code === 'auth/email-already-exists') {
        console.log(`  ⚠️  Ya existe: ${usuario.email}`);
        const existing = await auth.getUserByEmail(usuario.email);
        uidsNuevos[usuario.email] = existing.uid;
        await auth.setCustomUserClaims(existing.uid, { rol: usuario.rol });
        console.log(`  ✅ Claim actualizado: ${usuario.rol} → ${usuario.email}`);
      } else {
        console.error(`  ❌ Error creando ${usuario.email}:`, err.message);
      }
    }
  }

  // ── PASO 2: Documentos USUARIOS (existentes) ──────────────────
  console.log('\n📋 PASO 2: Creando documentos USUARIOS para usuarios existentes...');
  for (const u of USUARIOS_EXISTENTES) {
    const ref = db.collection('USUARIOS').doc(u.uid);
    batch.set(ref, {
      nombre: u.nombre,
      email: u.email,
      rol: u.rol,
      permisos: u.permisos,
      activo: true,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  ✅ USUARIOS/${u.uid} (${u.nombre}) preparado`);
  }

  // ── PASO 3: Documentos USUARIOS (nuevos) ─────────────────────
  console.log('\n📋 PASO 3: Creando documentos USUARIOS para nuevos usuarios...');
  for (const usuario of USUARIOS_A_CREAR) {
    const uid = uidsNuevos[usuario.email];
    if (!uid) continue;
    const ref = db.collection('USUARIOS').doc(uid);
    batch.set(ref, {
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      permisos: permisosParaRol(usuario.rol),
      activo: true,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  ✅ USUARIOS/${uid} (${usuario.nombre}) preparado`);
  }

  // ── PASO 4: CONFIGURACION/sistema ─────────────────────────────
  console.log('\n📋 PASO 4: Creando CONFIGURACION/sistema...');
  batch.set(db.collection('CONFIGURACION').doc('sistema'), {
    nombre: 'BD.GESTION-PERSONAL',
    version: '1.0.0',
    descripcion: 'Base de datos unificada para APP-PRESENCIA, APP-TALENTO y APP-GESTION-TRABAJOS — Favram S.L.',
    apps: ['APP-PRESENCIA', 'APP-TALENTO', 'APP-GESTION-TRABAJOS'],
    roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR', 'GESTOR_TRABAJOS'],
    creadoEn: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  // ── PASO 5: CONFIGURACION/calendarios ────────────────────────
  batch.set(db.collection('CONFIGURACION').doc('calendarios'), {
    descripcion: 'Festivos por año — rellenar manualmente o via app',
    festivos2025: [],
    festivos2026: [],
  }, { merge: true });

  // ── PASO 6: Placeholder TRABAJOS (crea la colección) ─────────
  console.log('📋 PASO 5: Inicializando colección TRABAJOS...');
  batch.set(db.collection('TRABAJOS').doc('_placeholder'), {
    _info: 'Colección TRABAJOS inicializada para APP-GESTION-TRABAJOS',
    _borrar: true,
  });

  // ── PASO 7: Placeholder COMPETENCIAS_DEF ─────────────────────
  batch.set(db.collection('COMPETENCIAS_DEF').doc('_placeholder'), {
    _info: 'Catálogo unificado — migrado de COMPETENCY_DEFINITIONS y SKILLS',
    _borrar: true,
  });

  // ── Commit del batch ──────────────────────────────────────────
  await batch.commit();
  console.log('\n✅ Batch de Firestore completado correctamente.');

  console.log('\n════════════════════════════════════════════');
  console.log('  🎉 INICIALIZACIÓN COMPLETADA');
  console.log('════════════════════════════════════════════');
  console.log('\nResumen de UIDs creados:');
  for (const [email, uid] of Object.entries(uidsNuevos)) {
    console.log(`  ${email} → ${uid}`);
  }
  console.log('\n⚠️  IMPORTANTE: Los 3 nuevos usuarios tienen contraseña temporal: Favram2026!');
  console.log('   Comunícalo a los usuarios para que la cambien en su primer acceso.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});
