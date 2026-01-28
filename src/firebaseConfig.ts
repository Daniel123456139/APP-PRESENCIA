
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, Firestore } from 'firebase/firestore';
import { getAnalytics, Analytics } from 'firebase/analytics';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import logger from './utils/logger';

// Configuración pública de Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC0_qixTZbKMN3eEp08dKCuw8zRnXuNAUc',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'app-presencia.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'app-presencia',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'app-presencia.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '426717771094',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:426717771094:web:f667103fc2c020bdd6d2f7',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-TX18GMW4SG'
};

// Validación de Configuración Crítica
if (!firebaseConfig.projectId) {
  logger.error("🚨 CRITICAL: Falta VITE_FIREBASE_PROJECT_ID en .env", "Firestore fallará con 'Invalid segment'");
  console.error("Firebase Config Error: Missing projectId. Check your .env file.");
}

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let analytics: Analytics | undefined;
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

export const getFirebaseAnalytics = (): Analytics => {
  if (!analytics) {
    const appInstance = getFirebaseApp();
    analytics = getAnalytics(appInstance);
  }
  return analytics;
};

export const getFirebaseStorage = (): FirebaseStorage => {
  if (!storage) {
    const appInstance = getFirebaseApp();
    storage = getStorage(appInstance);
    logger.info("📦 Firebase Storage initialized.");
  }
  return storage;
};
