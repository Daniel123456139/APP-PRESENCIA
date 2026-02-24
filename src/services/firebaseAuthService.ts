
import { getAuth, signInWithEmailAndPassword as fbSignIn, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp, getFirebaseDb } from '../firebaseConfig';

export interface AppAuthUser {
  uid: string;
  email: string;
  displayName: string;
  appRole: 'HR' | 'EMPLOYEE' | 'MANAGEMENT' | 'OPERADOR' | 'GESTOR_TRABAJOS' | 'SUPER_ADMIN';
  rolUnificado: string;
  erpEmployeeId: number;
}

// --- MOCK DATA (Basado en CSV proporcionado) ---
// Estos usuarios funcionarán en modo "Offline" o si Firebase no está configurado
const MOCK_AUTH_USERS: AppAuthUser[] = []; // Empty for security

const MOCK_STORAGE_KEY = 'mock_auth_user';

// --- SERVICE IMPLEMENTATION ---

export async function signInWithEmailPassword(email: string, password: string): Promise<AppAuthUser> {
  let auth;

  try {
    const app = getFirebaseApp();
    auth = getAuth(app);
  } catch (e) {
    console.warn("Firebase Auth no disponible, usando Mock:", e);
    return mockLogin(email, password);
  }

  // REAL FIREBASE LOGIN
  try {
    const userCredential = await fbSignIn(auth, email, password);
    const user = userCredential.user;
    if (!user) throw new Error('No user returned from Firebase');
    return await fetchUserProfile(user);
  } catch (error: any) {
    console.error("Firebase Login Error:", error);
    throw new Error(mapAuthError(error.code));
  }
}

// Helper para login simulado
async function mockLogin(email: string, _password: string): Promise<AppAuthUser> {
  // ELIMINADO: Ya no se permiten logins mock con contraseñas hardcoded en producción.
  // Solo se permite si el usuario ya está predefinido y es un entorno controlado.
  await new Promise(resolve => setTimeout(resolve, 800));

  throw new Error('El modo de autenticación local está desactivado por seguridad.');
}

export async function signOutApp(): Promise<void> {
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    await fbSignOut(auth);
  } catch (e) {
    // Fallback si no hay auth real
  }
  // Siempre limpiar storage local por si estamos en modo mock
  localStorage.removeItem(MOCK_STORAGE_KEY);
  window.dispatchEvent(new Event('storage'));
}

export function subscribeToAuthChanges(callback: (user: AppAuthUser | null) => void): () => void {
  try {
    const app = getFirebaseApp();
    const auth = getAuth(app);

    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const appUser = await fetchUserProfile(firebaseUser);
          callback(appUser);
        } catch (error) {
          console.error("Error fetching user profile on state change:", error);
          callback(null);
        }
      } else {
        // Si no hay usuario en Firebase, comprobar si hay usuario Mock en localstorage
        const stored = localStorage.getItem(MOCK_STORAGE_KEY);
        if (stored) {
          callback(JSON.parse(stored));
        } else {
          callback(null);
        }
      }
    });
  } catch (error) {
    console.error("Firebase initialization failed during subscription:", error);
    callback(null);
    return () => { };
  }
}

// --- Helpers Internos ---

async function fetchUserProfile(user: FirebaseUser): Promise<AppAuthUser> {
  const db = getFirebaseDb();
  let rolUnificado = 'USER';
  let displayName = user.displayName || 'Usuario';
  let erpEmployeeId = 0;

  try {
    // 1. Intentar leer desde la nueva colección USUARIOS unificada
    const userDocRef = doc(db, 'USUARIOS', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data?.activo === false) throw new Error('Usuario desactivado.');

      rolUnificado = data?.rol || 'USER';
      displayName = data?.nombre || displayName;
    } else {
      // 2. Fallback: usar custom claims
      const tokenResult = await user.getIdTokenResult();
      rolUnificado = (tokenResult.claims.rol as string) || 'USER';
    }
  } catch (e: any) {
    if (e.message === 'Usuario desactivado.') throw e;
    console.warn("Error leyendo perfil de Firestore, usando fallback:", e);
    try {
      const tokenResult = await user.getIdTokenResult();
      rolUnificado = (tokenResult.claims.rol as string) || rolUnificado;
      displayName = (tokenResult.claims.nombre as string) || displayName;
    } catch (tokenError) {
      console.warn('No se pudo leer el rol desde custom claims:', tokenError);
    }
  }

  // Mapeo a roles internos de la App Presencia (para compatibilidad de UI existente)
  let appRole: AppAuthUser['appRole'] = 'EMPLOYEE';
  if (rolUnificado === 'SUPER_ADMIN') {
    appRole = 'SUPER_ADMIN';
  } else if (rolUnificado === 'RRHH') {
    appRole = 'HR';
  } else if (rolUnificado === 'OPERADOR') {
    appRole = 'OPERADOR';
  } else if (rolUnificado === 'GESTOR_TRABAJOS') {
    appRole = 'GESTOR_TRABAJOS';
  }

  return {
    uid: user.uid,
    email: user.email || '',
    displayName,
    appRole,
    rolUnificado,
    erpEmployeeId
  };
}

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Credenciales incorrectas.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos fallidos. Inténtalo más tarde.';
    case 'auth/network-request-failed':
      return 'Error de conexión con Firebase.';
    default:
      return 'Error al iniciar sesión.';
  }
}
