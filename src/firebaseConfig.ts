
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import logger from './utils/logger';

// Configuración pública de Firebase
// SECURITY UPDATE: Fallbacks removed to prevent leakage. Must use .env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validación de Configuración Crítica
const requiredEnvVars = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const missingVars = requiredEnvVars.filter(key => !firebaseConfig[key as keyof typeof firebaseConfig]);

if (missingVars.length > 0) {
  logger.error("🚨 CRITICAL SECURITY: Falta configuración de Firebase en .env", `Faltan: ${missingVars.join(', ')}`);
  console.error(`🔥 FIREBASE CONFIG ERROR: Missing environment variables: ${missingVars.join(', ')}. \nPlease create a .env file with VITE_FIREBASE_* variables.`);
  // No throw error here to allow app to render a "Configuration Error" UI if needed, but Firestore will fail.
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    const existingApps = getApps();
    app = existingApps.length ? getApp() : initializeApp(firebaseConfig);
  }
  return app;
};

export const getFirebaseDb = (): Firestore => {
  if (!db) {
    const appInstance = getFirebaseApp();
    try {
      // Initialize with offline persistence
      db = initializeFirestore(appInstance, {
        localCache: persistentLocalCache()
      });
      logger.info("🔥", "Firestore initialized with offline persistence enabled.");
    } catch (error: any) {
      if (error.code === 'failed-precondition') {
        logger.warn("⚠️ Firestore: Multiple tabs open, persistence can only be enabled in one tab at a time.");
      } else if (error.code === 'unimplemented') {
        logger.warn("⚠️ Firestore: The current browser does not support all features required to enable persistence.");
      }
      // Fallback to default
      db = getFirestore(appInstance);
    }
  }
  return db;
};

export const getFirebaseStorage = (): FirebaseStorage => {
  if (!storage) {
    const appInstance = getFirebaseApp();
    storage = getStorage(appInstance);
    logger.info("📦 Firebase Storage initialized.");
  }
  return storage;
};
