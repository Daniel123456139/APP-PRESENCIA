/**
 * Renueva el access_token con el refresh_token del firebase CLI
 * y actualiza los documentos USUARIOS en Firestore
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const fbCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const REFRESH_TOKEN = fbCfg.tokens?.refresh_token;
const PROJECT_ID = 'app-presencia';
const BASE = 'firestore.googleapis.com';
const DB = `/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OAUTH_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const OAUTH_CLIENT_SECRET = 'j9iVZfS7D7eFOFP7w4sBqPDg';

if (!REFRESH_TOKEN) { console.error('Sin refresh_token'); process.exit(1); }

function postUrl(hostname, path, body, contentType = 'application/x-www-form-urlencoded') {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const headers = { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(data) };
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function refreshToken() {
  const body = `grant_type=refresh_token&client_id=${OAUTH_CLIENT_ID}&client_secret=${OAUTH_CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}`;
  const res = await postUrl('oauth2.googleapis.com', '/token', body);
  if (res.body.access_token) {
    console.log('✅ Token renovado');
    return res.body.access_token;
  }
  throw new Error('No se pudo renovar: ' + JSON.stringify(res.body));
}

function patch(token, collection, docId, fields) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ fields });
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) };
    const req = https.request({ hostname: BASE, path: `${DB}/${collection}/${docId}`, method: 'PATCH', headers }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sv(v) { return { stringValue: v }; }
function bv(v) { return { booleanValue: v }; }
function mv(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = typeof v === 'boolean' ? bv(v) : (typeof v === 'object' ? mv(v) : sv(v));
  }
  return { mapValue: { fields } };
}

function permisos(rol) {
  const m = {
    SUPER_ADMIN:     { presencia: { ver: true, editar: true }, talento: { ver: true, editar: true }, trabajos: { ver: true, editar: true }, configuracion: { ver: true, editar: true } },
    RRHH:            { presencia: { ver: true, editar: true }, talento: { ver: true, editar: true }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
    OPERADOR:        { presencia: { ver: true, editar: true }, talento: { ver: false, editar: false }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
    GESTOR_TRABAJOS: { presencia: { ver: false, editar: false }, talento: { ver: true, editar: false }, trabajos: { ver: true, editar: true }, configuracion: { ver: false, editar: false } },
  };
  return m[rol] || {};
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
  const token = await refreshToken();

  // Guardar el token renovado para otros scripts
  fbCfg.tokens.access_token = token;
  fs.writeFileSync(configPath, JSON.stringify(fbCfg, null, 2));
  console.log('✅ Token guardado en firebase-tools.json');

  console.log('\n═══ Actualizando USUARIOS en Firestore ═══\n');
  for (const u of USUARIOS) {
    const fields = {
      nombre: sv(u.nombre), email: sv(u.email), rol: sv(u.rol), activo: bv(true),
      permisos: mv(permisos(u.rol)),
    };
    const st = await patch(token, 'USUARIOS', u.uid, fields);
    console.log(`  ${st === 200 ? '✅' : '❌'} ${u.nombre} (${u.rol}) → HTTP ${st}`);
  }

  console.log('\n🎉 USUARIOS actualizado!\n');
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
