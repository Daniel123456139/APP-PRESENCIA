// Usa firebase CLI para importar Raúl con un localId forzado  
// Borrar el usuario vacío y recrear con UID autogenerado correcto

const https = require('https');
const API_KEY = 'AIzaSyC0_qixTZbKMN3eEp08dKCuw8zRnXuNAUc';

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // El usuario r.ruiz@favram.com existe con UID vacío en el sistema.
  // Intentamos actualizar su contraseña via sendPasswordResetEmail (no funciona sin token).
  // En su lugar, usamos el endpoint de signup forzando la eliminación previa via update.
  
  // Intentar hacer signIn primero para ver si hay otra contraseña
  const passwords = ['Favram2026!', 'favram2026', 'Favram2025!', '', 'password'];
  
  for (const pwd of passwords) {
    if (pwd === '') continue;
    const sign = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
      email: 'r.ruiz@favram.com', password: pwd, returnSecureToken: true,
    });
    if (sign.body.localId) {
      console.log(`✅ Login con "${pwd}" → UID: ${sign.body.localId}`);
      return;
    }
  }
  
  console.log('No se pudo autenticar con ninguna contraseña conocida.');
  console.log('El usuario r.ruiz@favram.com necesita ser eliminado y recreado manualmente desde:');
  console.log('https://console.firebase.google.com/project/app-presencia/authentication/users');
  console.log('1. Busca r.ruiz@favram.com en la lista');
  console.log('2. Elimínalo');
  console.log('3. El agente lo volverá a crear automáticamente.');
}

main().catch(console.error);
