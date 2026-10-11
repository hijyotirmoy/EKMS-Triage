import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
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
    if (typeof window !== "undefined") {
      try {
        db = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch (e) {
        db = getFirestore(firebaseApp);
      }
    } else {
      db = getFirestore(firebaseApp);
    }
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

// ================= SECOND CRM FIREBASE DATABASE (ekms-triage) =================
const CRM_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDOtpV7lrQB1Igt4dPtGuBLkH-JzeAGYUE",
  authDomain: "ekms-triage.firebaseapp.com",
  projectId: "ekms-triage",
  storageBucket: "ekms-triage.firebasestorage.app",
  messagingSenderId: "49607245644",
  appId: "1:49607245644:web:7130c6c7beba4d70b159e9",
  measurementId: "G-DH2SR6GQFT",
};

let crmApp = null;
let crmDb = null;
let crmAuth = null;

export function getCrmFirebaseApp() {
  if (!crmApp) {
    const apps = getApps();
    const existing = apps.find((a) => a.name === "crmApp");
    crmApp = existing || initializeApp(CRM_FIREBASE_CONFIG, "crmApp");
  }
  return crmApp;
}

export function getCrmFirestoreDb() {
  if (!crmDb) {
    const appInstance = getCrmFirebaseApp();
    if (typeof window !== "undefined") {
      try {
        crmDb = initializeFirestore(appInstance, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch (e) {
        crmDb = getFirestore(appInstance);
      }
    } else {
      crmDb = getFirestore(appInstance);
    }
  }
  return crmDb;
}

export function getCrmFirebaseAuth() {
  if (!crmAuth) {
    const appInstance = getCrmFirebaseApp();
    crmAuth = getAuth(appInstance);
  }
  return crmAuth;
}

export { CRM_FIREBASE_CONFIG };
