import type { Firestore } from "firebase-admin/firestore";

import { PUBLIC_COLLECTION } from "./collection";
import { fetchRooms } from "./rooms";
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
 * One browsable property from `properties` with its rooms and beds, serialized with the same allowlist
 * as the collection endpoint, or null when it is missing, a draft, switched off or unusable. The
 * rooms and beds are read only for a property that will be shown.
 */
export async function fetchPublicProperty(db: Pick<Firestore, "collection">, id: string): Promise<PublicProperty | null> {
  if (!isValidPropertyId(id)) throw new InvalidPropertyIdError();
  const snap = await db.collection(PUBLIC_COLLECTION).doc(id).get();
  if (!snap.exists || toPublicProperty(snap.id, snap.data()) === null) return null;
  return toPublicProperty(snap.id, snap.data(), await fetchRooms(db, id, true));
}
