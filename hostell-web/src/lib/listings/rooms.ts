import type { Firestore } from "firebase-admin/firestore";

import { PUBLIC_COLLECTION } from "./collection";
import type { PublicRoomType } from "./types";

/** A room as the public page needs it. `beds` is null when only the room document was read. */
export type RoomInput = {
  sharing: number;
  ac: boolean;
  rentPerBedInr: number | null;
  beds: { status: "available" | "unavailable"; occupied: boolean }[] | null;
};

const wholeNumber = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);

/**
 * The rooms of one property and, when `withBeds` is set, their beds. Only these fields are read from
 * each document; bed claims (`bedAllocations`, which name residents) are never touched. A bed counts
 * as taken when the owner blocked it or its `occupied` flag is set.
 */
export async function fetchRooms(db: Pick<Firestore, "collection">, propertyId: string, withBeds: boolean): Promise<RoomInput[]> {
  const rooms = db.collection(PUBLIC_COLLECTION).doc(propertyId).collection("rooms");
  const snap = await rooms.get();
  const out = await Promise.all(
    snap.docs.map(async (d): Promise<RoomInput | null> => {
      const data = d.data();
      const sharing = wholeNumber(data.sharing);
      if (sharing === null || sharing < 1) return null;
      let beds: RoomInput["beds"] = null;
      if (withBeds) {
        const bedSnap = await rooms.doc(d.id).collection("beds").get();
        beds = bedSnap.docs.map((b) => {
          const bed = b.data();
          return { status: bed.status === "unavailable" ? "unavailable" : "available", occupied: bed.occupied === true };
        });
      }
      return { sharing, ac: data.ac === true, rentPerBedInr: wholeNumber(data.rentPerBedInr), beds };
    }),
  );
  return out.flatMap((r) => (r ? [r] : []));
}

/** Rent range, sharing options and (when beds were read) per-sharing availability for a property's rooms. */
export function summarizeRooms(all: readonly RoomInput[]): {
  rentMinInr: number | null;
  rentMaxInr: number | null;
  sharingOptions: number[];
  roomTypes: PublicRoomType[];
} {
  const rooms = all.filter((r) => r.sharing >= 1);
  const rents = rooms.map((r) => r.rentPerBedInr).filter((r): r is number => r !== null);
  const sharingOptions = [...new Set(rooms.map((r) => r.sharing))].sort((a, b) => a - b);

  const roomTypes: PublicRoomType[] = [];
  if (rooms.length > 0 && rooms.every((r) => r.beds !== null)) {
    const bySharing = new Map<number, PublicRoomType>();
    for (const r of rooms) {
      const t = bySharing.get(r.sharing) ?? { sharing: r.sharing, rooms: 0, bedsTotal: 0, bedsAvailable: 0, rentMinInr: null, rentMaxInr: null, acRooms: 0 };
      const beds = r.beds ?? [];
      t.rooms += 1;
      t.bedsTotal += beds.length;
      t.bedsAvailable += beds.filter((b) => b.status === "available" && !b.occupied).length;
      if (r.ac) t.acRooms += 1;
      if (r.rentPerBedInr !== null) {
        t.rentMinInr = t.rentMinInr === null ? r.rentPerBedInr : Math.min(t.rentMinInr, r.rentPerBedInr);
        t.rentMaxInr = t.rentMaxInr === null ? r.rentPerBedInr : Math.max(t.rentMaxInr, r.rentPerBedInr);
      }
      bySharing.set(r.sharing, t);
    }
    roomTypes.push(...[...bySharing.values()].sort((a, b) => a.sharing - b.sharing));
  }

  return {
    rentMinInr: rents.length ? Math.min(...rents) : null,
    rentMaxInr: rents.length ? Math.max(...rents) : null,
    sharingOptions,
    roomTypes,
  };
}
