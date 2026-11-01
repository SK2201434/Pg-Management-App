import type { Firestore } from "firebase-admin/firestore";

import { PUBLIC_COLLECTION } from "./query";
import { toPublicProperty } from "./serialize";
import type { PublicProperty } from "./types";

const PROPERTY_ID = /^[A-Za-z0-9_-]{1,128}$/;

export const isValidPropertyId = (id: unknown): id is string => typeof id === "string" && PROPERTY_ID.test(id);

export class InvalidPropertyIdError extends Error {
  constructor() {
    super("Invalid property id.");
    this.name = "InvalidPropertyIdError";
  }
}

/**
 * One listed property from `publicListings`, serialized with the same allowlist as the collection
 * endpoint, or null when the document is missing, unlisted or unusable. Reads a single document by id;
 * nothing else is touched.
 */
export async function fetchPublicProperty(db: Pick<Firestore, "collection">, id: string): Promise<PublicProperty | null> {
  if (!isValidPropertyId(id)) throw new InvalidPropertyIdError();
  const snap = await db.collection(PUBLIC_COLLECTION).doc(id).get();
  return snap.exists ? toPublicProperty(snap.id, snap.data()) : null;
}
