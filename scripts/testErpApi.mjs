// Script de prueba directa contra el API del ERP
// Ejecutar con: node testErpApi.mjs

const ERP_URL = 'http://10.0.0.19:8000/fichajes/insertarFichaje';

// Payload EXACTO del ejemplo en la documentación del API
const testPayload = {
    "Entrada": 0,
    "Fecha": "03/12/2025",
    "Hora": "10:00:00",
    "IDOperario": "999",
    "MotivoAusencia": "14",
    "Usuario": "TEST_USER"
};

console.log("🚀 Probando API del ERP directamente...");
console.log("📍 URL:", ERP_URL);
console.log("📤 Payload:", JSON.stringify(testPayload, null, 2));

try {
    const response = await fetch(ERP_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify(testPayload)
    });

    console.log("\n📥 Status HTTP:", response.status, response.statusText);

    const text = await response.text();
    console.log("📥 Response body:", text);

    try {
        const json = JSON.parse(text);
        if (json.status === 'ok') {
            console.log("\n✅ ¡ÉXITO! El API funciona correctamente.");
        } else if (json.status === 'error') {
            console.log("\n❌ ERROR del servidor:", json.message);
        }
    } catch (e) {
        console.log("⚠️ Respuesta no es JSON válido");
    }
} catch (error) {
    console.error("\n❌ Error de conexión:", error.message);
}
