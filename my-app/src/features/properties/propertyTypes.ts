/** The owner's active/inactive switch. Absent on older documents, which count as active. */
export type PropertyStatus = 'active' | 'inactive';

/**
 * A document of `properties/{propertyId}`, as the Firestore rules allow it:
 * the list shows `name`/`location`; the full field list is documented in propertySetup.ts.
 * `setupStatus` is separate from `status` and only tracks an unfinished Add Property save.
 */
export type Property = {
  id: string;
  ownerUid: string;
  name: string;
  /** Free-text address/area. Absent on properties created before the field existed. */
  location: string | null;
  /** `draft` while an Add Property save is incomplete; everything else is `ready`. */
  setupStatus: 'draft' | 'ready';
  status: PropertyStatus;
  /** Whether coordinates are stored. The coordinates themselves are never shown. */
  hasGeo: boolean;
  /** Download URL of the display image (the first property photo), if any. */
  coverUrl: string | null;
};

/** Bed totals of the portfolio. Computed from room/bed records once that module exists. */
export type PortfolioOccupancy = { totalBeds: number; occupiedBeds: number };

/** A property's full document, for the Property Details screen. Optional fields are `null` when absent. */
export type PropertyDetail = Property & {
  description: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

/** `occupant` is the name of the resident holding the bed (a `bedAllocations` claim), else null. */
export type RoomBed = { id: string; label: string; status: 'available' | 'unavailable'; occupant: string | null };

/** A room of `properties/{pid}/rooms/{rid}` with the bed records found under it. */
export type PropertyRoom = {
  id: string;
  roomNumber: string;
  floor: number | null;
  /** Beds the owner configured for the room (the room document's `sharing`). */
  sharing: number;
  ac: boolean;
  rentPerBedInr: number | null;
  beds: RoomBed[];
};

/**
 * A tenant who joined the property (`properties/{pid}/members/{tenantUid}`, created by the referral
 * join). It says nothing about a room or bed: there is no allocation model yet.
 */
export type PropertyTenant = {
  tenantUid: string;
  name: string;
  status: 'active' | 'inactive';
  /** Milliseconds since epoch, when the membership was created. */
  joinedAtMs: number | null;
  /**
   * `joined`: signed up with an invite code (a `members` document). `added`: entered by the owner
   * (a `residents` document), which also carries the stay below.
   */
  source: 'joined' | 'added';
  roomNumber: string | null;
  bedLabel: string | null;
  sharing: number | null;
  rentInr: number | null;
};
