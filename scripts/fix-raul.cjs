/**
 * Elimina la entrada corrupta de Raúl y la recrea con contraseña correcta
 * Usa múltiples estrategias de eliminación
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const configPath = path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json');
const fbCfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const TOKEN = fbCfg.tokens?.access_token;
const PROJECT_ID = 'app-presencia';
const API_KEY = 'AIzaSyC0_qixTZbKMN3eEp08dKCuw8zRnXuNAUc';

function post(url, body, bearer = false) {
  return new Promise((resolve, reject) => {
    const { hostname, pathname } = new URL(url);
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (bearer) headers['Authorization'] = `Bearer ${TOKEN}`;
    const req = https.request({ hostname, path: pathname, method: 'POST', headers }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : {} }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Estrategia: list all accounts con Admin API y buscar el correcto
  const listRes = await post(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:query`,
    { expression: [{ email: 'r.ruiz@favram.com' }] },
    true
  );
  console.log('Query result:', listRes.status, JSON.stringify(listRes.body).substring(0, 200));

  // Estrategia 2: batchDelete con email (no UID)
  const batchRes = await post(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:batchDelete`,
    { localIds: [], force: true },
    true
  );
  console.log('BatchDelete result:', batchRes.status, JSON.stringify(batchRes.body).substring(0, 200));

  // Intentar resetear la contraseña para poder hacer signIn y luego deleteAccount
  const resetRes = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    { requestType: 'PASSWORD_RESET', email: 'r.ruiz@favram.com' },
    false
  );
  console.log('Reset password result:', resetRes.status, JSON.stringify(resetRes.body).substring(0, 200));

  // Intentar update de email/password via Admin (override)
  const updateRes = await post(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`,
    { email: 'r.ruiz@favram.com', password: 'Favram2026!', returnSecureToken: true },
    true
  );
  console.log('Update result:', updateRes.status, JSON.stringify(updateRes.body).substring(0, 300));
  
  if (updateRes.body.localId) {
    console.log('\n✅ UID de Raúl obtenido:', updateRes.body.localId);
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
