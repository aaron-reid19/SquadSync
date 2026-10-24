import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE === "firebase" ? "firebase" : "mock";
export const firebaseConfigured = Boolean(config.apiKey && config.projectId);

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

/** Lazily initialise Firebase. Returns undefined when the env vars are missing. */
export function getDb(): Firestore | undefined {
  if (!firebaseConfigured) return undefined;
  if (!db) {
    app = getApps().length ? getApp() : initializeApp(config);
    db = getFirestore(app);
  }
  return db;
}
