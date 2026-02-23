# Migracion Firebase + Hosting (APP PRESENCIA)

## Estado actual analizado

- La app ya usa autenticacion Firebase y perfil en `USUARIOS/{uid}`.
- Existen colecciones antiguas (`EMPLEADOS`) y nuevas (`EMPLEADOS_REF`) en reglas.
- Las reglas estaban basadas en claims `role` con valores `hr/admin`, pero la app y scripts usan claim `rol` con valores `SUPER_ADMIN/RRHH/OPERADOR/GESTOR_TRABAJOS`.
- El frontend es SPA con `BrowserRouter`, por lo que requiere `rewrite` a `index.html` en hosting.
- No existia `.firebaserc` ni bloque `hosting` en `firebase.json`.

## Cambios aplicados en esta adaptacion

1. **Compatibilidad de esquema de empleados**
   - Nuevo servicio: `src/services/firebaseSchemaService.ts`.
   - Resuelve automaticamente la coleccion activa entre `EMPLEADOS_REF` y `EMPLEADOS`.
   - Aplicado en:
     - `src/hooks/useEmployeeData.ts`
     - `src/hooks/useFirestoreSync.ts`
     - `src/services/employeeService.ts`
     - `src/services/firestoreService.ts`

2. **Correccion de mapeo de rol en login**
   - `src/services/firebaseAuthService.ts`.
   - `SUPER_ADMIN` ya no cae como `HR` por orden de condiciones.

3. **Ajuste de reglas Firestore al nuevo modelo de roles**
   - `firestore.rules`:
     - soporte para `token.rol` y fallback a `token.role`;
     - helpers `isSuperAdmin`, `isHrRole`, `canUsePortal`;
     - reglas para `USUARIOS` y `CONFIGURACION`;
     - migracion de checks `hr/admin` a `SUPER_ADMIN/RRHH`.

4. **Base de hosting Firebase lista para publicar**
   - `firebase.json` con bloque `hosting`:
     - `public: dist`
     - `rewrites` SPA a `index.html`
   - `.firebaserc` con proyecto por defecto `app-presencia`.
   - `package.json` con scripts:
     - `hosting:serve`
     - `hosting:deploy`
     - `firebase:deploy`

## Riesgos detectados (recomendado cerrar)

1. **Inconsistencia de claims y permisos**
   - Verificar que todos los usuarios tengan `customClaims.rol` correcto.

2. **Indices de Firestore**
   - Si aparecen errores de indice en produccion, generar `firestore.indexes.json` desde consola y desplegarlo.

3. **Dependencia API local (fuera de Firebase)**
   - El frontend se puede publicar, pero parte funcional depende de ERP/API privada (`VITE_API_BASE_URL`).
   - Para acceso externo real, exponer backend por VPN/reverse proxy/Cloud Run y usar HTTPS.

4. **Scripts con secretos en repositorio**
   - Hay archivos sensibles en `scripts/` (service account/exportes). No deben subirse a remoto.

## Checklist de despliegue externo

1. Configurar `.env` de build con variables `VITE_FIREBASE_*` y `VITE_API_BASE_URL` publica.
2. Compilar: `npm run build`.
3. Validar local hosting: `npm run hosting:serve`.
4. Publicar: `npm run hosting:deploy`.
5. Publicar reglas: `firebase deploy --only firestore:rules` (o `npm run firebase:deploy`).
