/**
 * Firestore adapter for the same DB shape the mock store uses.
 * One collection per top-level array: users, squads, events, messages (document id = item id).
 *
 * Only used when NEXT_PUBLIC_DATA_SOURCE=firebase. It is deliberately simple for the MVP:
 * load everything once, then write back only the documents that changed.
 * Next steps for production: per-squad queries, onSnapshot listeners for chat/voting,
 * Firebase Auth instead of the hard-coded admin, and security rules (see firestore.rules).
 */
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { getDb } from "./firebase";
import type { DB } from "./types";
import { DB_VERSION } from "./seed";

const COLLECTIONS = ["users", "squads", "events", "messages"] as const;
type CollectionName = (typeof COLLECTIONS)[number];

export async function loadFromFirestore(): Promise<DB | null> {
  const db = getDb();
  if (!db) return null;
  const result = { version: DB_VERSION } as DB;
  for (const name of COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    (result[name] as unknown[]) = snap.docs.map((d) => d.data());
  }
  return result.users.length ? result : null; // empty project: caller seeds it
}

/** Write every document whose object identity changed since `prev` (the store updates immutably). */
export async function saveChangesToFirestore(prev: DB | null, next: DB) {
  const db = getDb();
  if (!db) return;
  const batch = writeBatch(db);
  let writes = 0;
  for (const name of COLLECTIONS) {
    const before = new Map((prev?.[name] ?? []).map((item) => [item.id, item]));
    const after = next[name] as { id: string }[];
    for (const item of after) {
      if (before.get(item.id) !== item) {
        batch.set(doc(db, name as CollectionName, item.id), stripUndefined(item));
        writes++;
      }
      before.delete(item.id);
    }
    for (const id of before.keys()) {
      batch.delete(doc(db, name, id));
      writes++;
    }
  }
  if (writes) await batch.commit();
}

// Firestore rejects `undefined` field values.
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
