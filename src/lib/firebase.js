import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAPNBkYTc5IXcy2PMZXkWgM_ob8MmEAlFA",
  authDomain: "triage2-b07fc.firebaseapp.com",
  projectId: "triage2-b07fc",
  storageBucket: "triage2-b07fc.firebasestorage.app",
  messagingSenderId: "413992734264",
  appId: "1:413992734264:web:bcdf1595f161c548d0a0cd",
  measurementId: "G-BRKZM6JX4R",
};

let app = null;
let db = null;
let auth = null;

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

export function getFirebaseAuth() {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    auth = getAuth(firebaseApp);
  }
  return auth;
}

export { DEFAULT_FIREBASE_CONFIG };
