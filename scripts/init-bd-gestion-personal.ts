/**
 * SCRIPT DE INICIALIZACIÓN — BD.GESTION-PERSONAL
 * Crea los documentos base en Firestore para la nueva arquitectura.
 *
 * Ejecución: npx ts-node scripts/init-bd-gestion-personal.ts
 * (desde el directorio raíz de cualquiera de las tres apps)
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// ─── Config del proyecto app-presencia ────────────────────────────
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: 'app-presencia',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── Usuarios existentes (UIDs obtenidos de Firebase Auth) ────────
const USUARIOS = [
  {
    uid: '08skiaqJ9PUxWC1ghoxKZEdGZpG2',
    nombre: 'DANI',
    email: 'd.soler@favram.com',
    rol: 'SUPER_ADMIN',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: true, editar: true },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: true, editar: true },
    },
  },
  {
    uid: 'BSzx9PdQEQfXWLXJEUxLF8VM4dE2',
    nombre: 'ESTHER',
    email: 'e.juvera@favram.com',
    rol: 'RRHH',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: true, editar: true },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: false, editar: false },
    },
  },
  {
    uid: 'FnoRJEUWzXfhp2iArcUq0ZaagR53',
    nombre: 'RRHH',
    email: 'rrhh@favram.com',
    rol: 'RRHH',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: true, editar: true },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: false, editar: false },
    },
  },
  {
    uid: 'iOCgmwlrgWerN669DUXPxxA8rDG2',
    nombre: 'LUIS',
    email: 'l.asensio@favram.com',
    rol: 'OPERADOR',
    permisos: {
      presencia: { ver: true, editar: true },
      talento: { ver: false, editar: false },
      trabajos: { ver: true, editar: true },
      configuracion: { ver: false, editar: false },
    },
  },
  // NOTA: Alberto (a.barrientos@favram.com), Jorge (j.diaz@favram.com)
  // y Raúl (r.ruiz@favram.com) deben crearse primero en Firebase Auth.
  // Una vez creados, ejecutar el bloque de abajo con sus UIDs reales.
];

async function inicializarBD() {
  console.log('🚀 Iniciando configuración BD.GESTION-PERSONAL...\n');

  // ── 1. CONFIGURACION/sistema ─────────────────────────────────
  await setDoc(doc(db, 'CONFIGURACION', 'sistema'), {
    nombre: 'BD.GESTION-PERSONAL',
    version: '1.0.0',
    fechaCreacion: serverTimestamp(),
    descripcion: 'Base de datos unificada para APP-PRESENCIA, APP-TALENTO y APP-GESTION-TRABAJOS — Favram S.L.',
    apps: ['APP-PRESENCIA', 'APP-TALENTO', 'APP-GESTION-TRABAJOS'],
    roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR', 'GESTOR_TRABAJOS'],
  });
  console.log('✅ CONFIGURACION/sistema creado');

  // ── 2. CONFIGURACION/calendarios ──────────────────────────────
  await setDoc(doc(db, 'CONFIGURACION', 'calendarios'), {
    descripcion: 'Festivos por año — rellenar manualmente o via app',
    festivos2025: [],
    festivos2026: [],
  });
  console.log('✅ CONFIGURACION/calendarios creado');

  // ── 3. Documentos USUARIOS (usuarios existentes) ──────────────
  for (const usuario of USUARIOS) {
    await setDoc(doc(db, 'USUARIOS', usuario.uid), {
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      permisos: usuario.permisos,
      activo: true,
      creadoEn: serverTimestamp(),
    });
    console.log(`✅ USUARIOS/${usuario.uid} (${usuario.nombre}) creado`);
  }

  // ── 4. Documento inicial en TRABAJOS (estructura de ejemplo) ──
  await setDoc(doc(db, 'TRABAJOS', '_placeholder'), {
    _info: 'Colección TRABAJOS inicializada para APP-GESTION-TRABAJOS',
    _borrar: true,
  });
  console.log('✅ TRABAJOS/ colección inicializada');

  // ── 5. Documento inicial en COMPETENCIAS_DEF ─────────────────
  await setDoc(doc(db, 'COMPETENCIAS_DEF', '_placeholder'), {
    _info: 'Catálogo unificado de competencias — migrado de COMPETENCY_DEFINITIONS y SKILLS',
    _borrar: true,
  });
  console.log('✅ COMPETENCIAS_DEF/ colección inicializada');

  console.log('\n🎉 Inicialización completada correctamente.');
  console.log('\n⚠️  PENDIENTE:');
  console.log('  1. Crear en Firebase Auth los usuarios: Alberto, Jorge y Raúl');
  console.log('  2. Añadir sus UIDs a este script y ejecutar el bloque de USUARIOS pendientes');
  console.log('  3. Asignar custom claim "rol" a cada uno via Firebase MCP o Admin SDK');
}

inicializarBD().catch(console.error);
