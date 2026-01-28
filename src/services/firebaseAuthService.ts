
import { getAuth, signInWithEmailAndPassword as fbSignIn, signOut as fbSignOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp, getFirebaseDb } from '../firebaseConfig';

export interface AppAuthUser {
  uid: string;
  email: string;
  displayName: string;
  appRole: 'HR' | 'EMPLOYEE' | 'MANAGEMENT';
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
  // Use the initialized DB with persistence
  const db = getFirebaseDb();

  // Intentar obtener rol de base de datos, si no existe, inferir por email
  try {
    // Modular SDK: doc(db, collection, id) y getDoc(ref)
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data();
      if (data?.isActive === false) throw new Error('Usuario desactivado.');

      return {
        uid: user.uid,
        email: user.email || '',
        displayName: data?.displayName || 'Usuario',
        appRole: data?.role,
        erpEmployeeId: data?.erpEmployeeId
      };
    }
  } catch (e) {
    console.warn("No se pudo conectar a Firestore, usando perfil local temporal.", e);
  }

  // Fallback si no hay DB conectada: Usar lista local MOCK para definir roles
  const localDef = MOCK_AUTH_USERS.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
  if (localDef) {
    return { ...localDef, uid: user.uid };
  }

  // Fallback final por defecto
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || 'Usuario',
    appRole: 'EMPLOYEE',
    erpEmployeeId: 0
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
