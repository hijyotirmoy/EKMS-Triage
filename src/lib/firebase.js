import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const DEFAULT_FIREBASE_CONFIG = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyDOtpV7lrQB1Igt4dPtGuBLkH-JzeAGYUE",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "ekms-triage.firebaseapp.com",
  projectId:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "ekms-triage",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "ekms-triage.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
    "49607245644",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:49607245644:web:7130c6c7beba4d70b159e9",
};

let app = null;
let db = null;

export function getFirebaseApp() {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp(DEFAULT_FIREBASE_CONFIG);
  }
  return app;
}

export function getFirestoreDb() {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    db = getFirestore(firebaseApp);
  }
  return db;
}

export { DEFAULT_FIREBASE_CONFIG };
