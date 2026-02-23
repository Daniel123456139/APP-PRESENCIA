/**
 * Inicializa Firestore via REST API usando el access_token del Firebase CLI
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const fbConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const ACCESS_TOKEN = fbConfig.tokens?.access_token;
const PROJECT_ID = 'app-presencia';
const BASE_URL = `firestore.googleapis.com`;
const DB_PATH = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

if (!ACCESS_TOKEN) { console.error('Sin access_token'); process.exit(1); }
console.log('✅ Token encontrado');

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({ hostname: BASE_URL, path, method, headers }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// Convierte un objeto JS a formato Firestore Document
function toDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string') fields[k] = { stringValue: v };
    else if (typeof v === 'boolean') fields[k] = { booleanValue: v };
    else if (typeof v === 'number') fields[k] = { integerValue: String(v) };
    else if (Array.isArray(v)) fields[k] = { arrayValue: { values: v.map(i => ({ stringValue: i })) } };
    else if (typeof v === 'object' && v !== null) {
      fields[k] = { mapValue: { fields: {} } };
      for (const [k2, v2] of Object.entries(v)) {
        if (typeof v2 === 'object') {
          fields[k].mapValue.fields[k2] = { mapValue: { fields: {} } };
          for (const [k3, v3] of Object.entries(v2)) {
            fields[k].mapValue.fields[k2].mapValue.fields[k3] = { booleanValue: v3 };
          }
        } else fields[k].mapValue.fields[k2] = { booleanValue: v2 };
      }
    }
  }
  return { fields };
}

async function setDoc(collection, docId, data) {
  const p = `${DB_PATH}/${collection}/${docId}`;
  const res = await request('PATCH', p + '?currentDocument.exists=false', toDoc(data));
  if (res.status === 200 || res.status === 409) { // 409 = ya existe, ok
    const res2 = await request('PATCH', p, toDoc(data));
    return res2.status;
  }
  return res.status;
}

function permisos(rol) {
  const m = {
    SUPER_ADMIN: { presencia: { ver: true, editar: true }, talento: { ver: true, editar: true }, trabajos: { ver: true, editar: true }, configuracion: { ver: true, editar: true } },
    RRHH:        { presencia: { ver: true, editar: true }, talento: { ver: true, editar: true }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
    OPERADOR:    { presencia: { ver: true, editar: true }, talento: { ver: false, editar: false }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
    GESTOR_TRABAJOS: { presencia: { ver: false, editar: false }, talento: { ver: true, editar: false }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
  };
  return m[rol] || {};
}

const USUARIOS = [
  { uid: '08skiaqJ9PUxWC1ghoxKZEdGZpG2', nombre: 'DANI',    email: 'd.soler@favram.com',        rol: 'SUPER_ADMIN' },
  { uid: 'BSzx9PdQEQfXWLXJEUxLF8VM4dE2', nombre: 'ESTHER',  email: 'e.juvera@favram.com',      rol: 'RRHH' },
  { uid: 'FnoRJEUWzXfhp2iArcUq0ZaagR53', nombre: 'RRHH',    email: 'rrhh@favram.com',           rol: 'RRHH' },
  { uid: 'iOCgmwlrgWerN669DUXPxxA8rDG2', nombre: 'LUIS',    email: 'l.asensio@favram.com',     rol: 'OPERADOR' },
  { uid: 'jJ91JFbibBb59WLuRT6OTsxYzxu1', nombre: 'ALBERTO', email: 'a.barrientos@favram.com', rol: 'OPERADOR' },
  { uid: 'TTe5e1jp4GZRQXV3f3ArOuhx6Rj1', nombre: 'JORGE',   email: 'j.diaz@favram.com',       rol: 'GESTOR_TRABAJOS' },
];

async function main() {
  console.log('\n═══ Inicializando Firestore via REST API ═══\n');

  // CONFIGURACION/sistema
  let st = await setDoc('CONFIGURACION', 'sistema', {
    nombre: 'BD.GESTION-PERSONAL', version: '1.0.0',
    descripcion: 'Base de datos unificada para las tres apps de Favram S.L.',
    apps: ['APP-PRESENCIA', 'APP-TALENTO', 'APP-GESTION-TRABAJOS'],
    roles: ['SUPER_ADMIN', 'RRHH', 'OPERADOR', 'GESTOR_TRABAJOS'],
  });
  console.log(`✅ CONFIGURACION/sistema (${st})`);

  // CONFIGURACION/calendarios
  st = await setDoc('CONFIGURACION', 'calendarios', { descripcion: 'Festivos por año', festivos2025: [], festivos2026: [] });
  console.log(`✅ CONFIGURACION/calendarios (${st})`);

  // TRABAJOS/_placeholder
  st = await setDoc('TRABAJOS', '_placeholder', { _info: 'Colección TRABAJOS inicializada para APP-GESTION-TRABAJOS', _borrar: true });
  console.log(`✅ TRABAJOS/_placeholder (${st})`);

  // COMPETENCIAS_DEF/_placeholder
  st = await setDoc('COMPETENCIAS_DEF', '_placeholder', { _info: 'Catálogo unificado de competencias', _borrar: true });
  console.log(`✅ COMPETENCIAS_DEF/_placeholder (${st})`);

  // USUARIOS
  console.log('\n📋 Creando documentos USUARIOS...');
  for (const u of USUARIOS) {
    st = await setDoc('USUARIOS', u.uid, { nombre: u.nombre, email: u.email, rol: u.rol, activo: true, permisos: permisos(u.rol) });
    console.log(`  ✅ ${u.nombre} (${u.rol}) → ${st}`);
  }

  console.log('\n🎉 Firestore inicializado correctamente.');
  console.log('\n⚠️  PENDIENTE (manual): Raúl (r.ruiz@favram.com) tiene conflicto de email en Auth.');
  console.log('   Solucionarlo en la consola Firebase: Authentication → buscar r.ruiz → eliminar → el agente recreará automáticamente.');
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
