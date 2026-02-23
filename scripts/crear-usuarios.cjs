/**
 * Crea usuarios en Firebase Auth usando la REST API (no necesita service account)
 * Ejecución: node scripts/crear-usuarios.js
 */

const https = require('https');

const API_KEY = 'AIzaSyC0_qixTZbKMN3eEp08dKCuw8zRnXuNAUc'; // app-presencia

const USUARIOS = [
  { email: 'a.barrientos@favram.com', displayName: 'ALBERTO', rol: 'OPERADOR' },
  { email: 'j.diaz@favram.com',       displayName: 'JORGE',   rol: 'GESTOR_TRABAJOS' },
  { email: 'r.ruiz@favram.com',       displayName: 'RAUL',    rol: 'GESTOR_TRABAJOS' },
];

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    };
    const req = https.request(url, options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n═══ Creando usuarios en Firebase Auth ═══\n');

  const uids = {};

  for (const u of USUARIOS) {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`;
    const res = await postJson(url, {
      email: u.email,
      password: 'Favram2026!',
      displayName: u.displayName,
      returnSecureToken: false,
    });

    if (res.status === 200 || res.body.localId) {
      console.log(`✅ ${u.email} → UID: ${res.body.localId}`);
      uids[u.email] = res.body.localId;
    } else if (res.body.error?.message === 'EMAIL_EXISTS') {
      console.log(`⚠️  ${u.email} ya existe — obteniendo UID...`);
      // Buscar por lookup endpoint
      const lookup = await postJson(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
        { email: [u.email] }
      );
      if (lookup.body.users?.[0]?.localId) {
        uids[u.email] = lookup.body.users[0].localId;
        console.log(`  → UID: ${uids[u.email]}`);
      }
    } else {
      console.error(`❌ Error con ${u.email}:`, JSON.stringify(res.body.error));
    }
  }

  console.log('\n═══ UIDs obtenidos ═══');
  for (const [email, uid] of Object.entries(uids)) {
    console.log(`  ${email}: ${uid}`);
  }
  console.log('\nCopia estos UIDs y dáselos al agente para que asigne los custom claims.');
}

main().catch(console.error);
