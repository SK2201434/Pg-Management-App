/** One sharing type of a property, e.g. all of its 2-sharing rooms. */
export type PublicRoomType = {
  sharing: number;
  rooms: number;
  bedsTotal: number;
  bedsAvailable: number;
  rentMinInr: number | null;
  rentMaxInr: number | null;
  acRooms: number;
};

/**
 * The only shape the public API ever returns. It is built field by field, so nothing from the
 * Firestore document (ownerUid, contact details, street-level `location`, postal code) can pass through.
 */
/** The kinds of property an owner can list; the owner app stores the label itself. */
export const PROPERTY_TYPES = ["Men's Hostel", "Women's Hostel", "Coliving"] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const isPropertyType = (v: unknown): v is PropertyType => PROPERTY_TYPES.some((t) => t === v);

export type PublicProperty = {
  id: string;
  name: string;
  /** Null for listings published before the owner app asked for it. */
  propertyType: PropertyType | null;
  city: string | null;
  state: string | null;
  description: string | null;
  coverUrl: string | null;
  photoUrls: string[];
  roomTypes: PublicRoomType[];
  amenities: string[];
  rentMinInr: number | null;
  rentMaxInr: number | null;
  sharingOptions: number[];
  /** ISO 8601, or null when the document has no usable timestamp. */
  updatedAt: string | null;
};

export type PublicPropertiesPage = {
  items: PublicProperty[];
  nextCursor: string | null;
  hasMore: boolean;
};
