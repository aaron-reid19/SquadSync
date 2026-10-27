import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const DATA_SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "firebase" ? "firebase" : "mock";
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
