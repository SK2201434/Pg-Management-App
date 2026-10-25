// Pure model of the Add Property form: types, defaults, validation, summaries and the list of
// Firestore documents a form turns into. No React and no Firebase here, so it is unit-tested.
//
// Firestore shape (see firestore.rules):
//   properties/{pid}                         ownerUid, name, location, city, state, postalCode,
//                                            contactName, contactPhone, description?, amenities[] (keys of AMENITIES), geo? (GeoPoint), photos?[] and roomPhotos?[] (<= 4 each),
//                                            setupStatus ('draft' | 'ready'), createdAt, updatedAt
//   properties/{pid}/rooms/{rid}             ownerUid, propertyId, roomNumber, floor?, sharing
//                                            (= number of beds), ac, rentPerBedInr? (whole rupees),
//                                            updatedAt
//   properties/{pid}/rooms/{rid}/beds/{bid}  ownerUid, propertyId, roomId, label, status, updatedAt
// Occupancy is not stored anywhere: it comes from stays (future module). Rent lives on the room,
// once, and the property's min/max rent is derived from the rooms.

export const BedStatuses = { Available: 'available', Unavailable: 'unavailable' } as const;
export type BedStatus = (typeof BedStatuses)[keyof typeof BedStatuses];

/** Amenities an owner can tick for a property. The stored value is the `key`; unknown keys are ignored. */
export const AMENITIES = [
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'hot-water', label: 'Hot water' },
  { key: 'drinking-water', label: 'Drinking water' },
  { key: 'meals', label: 'Meals' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'housekeeping', label: 'Housekeeping' },
  { key: 'parking', label: 'Parking' },
  { key: 'power-backup', label: 'Power backup' },
  { key: 'cctv', label: 'CCTV' },
  { key: 'tv-lounge', label: 'TV / lounge' },
  { key: 'refrigerator', label: 'Refrigerator' },
  { key: 'lift', label: 'Lift' },
] as const;

export const amenityLabel = (key: string): string | null => AMENITIES.find((a) => a.key === key)?.label ?? null;

export const MAX_FLOORS = 30;
export const MAX_SHARING = 12;
/** Photos of the property itself, and (separately) of its rooms: 4 each. */
export const MAX_PHOTOS = 4;
export const MAX_ROOM_PHOTOS = 4;
export const MAX_ROOMS = 150;
export const MAX_RENT_INR = 1_000_000;
export const ROOM_NUMBER_MAX = 20;
export const BED_LABEL_MAX = 30;

export const LIMITS = {
  name: 120,
  location: 200,
  description: 1000,
  contactName: 100,
  contactPhone: 20,
  city: 100,
  state: 100,
  postalCode: 12,
} as const;

export type RoomDraft = {
  /** Stable local id, reused as the Firestore room id so a retried save never duplicates. */
  key: string;
  roomNumber: string;
  /** True while the number is the suggested one; it is renumbered when floors are switched on/off. */
  numberAuto: boolean;
  /** 0 = ground floor. `null` when the property is not organised by floor. */
  floor: number | null;
  /** Number of beds: 1 sharing, 2 sharing, 3 sharing and so on. */
  sharing: number;
  ac: boolean;
  /** Monthly rent per bed in whole rupees, as typed. Empty = not configured. */
  rent: string;
  /** Optional custom bed names by position. Kept even when sharing is reduced, until confirmed. */
  bedLabels: string[];
};

export type PhotoDraft = { uri: string; mimeType: string | null; fileSize: number | null };

export type PropertyForm = {
  name: string;
  location: string;
  city: string;
  state: string;
  postalCode: string;
  description: string;
  contactName: string;
  contactPhone: string;
  /** Keys from AMENITIES. */
  amenities: string[];
  photos: PhotoDraft[];
  /** The property photo chosen as its display image (`uri`); the first photo when unset. */
  coverUri: string | null;
  /** Photos of the rooms (up to MAX_ROOM_PHOTOS), kept apart from the property photos. */
  roomPhotos: PhotoDraft[];
  /**
   * Captured by "Use current location"; never typed or shown. `null` means the property gets its
   * coordinates later, from the badge on the Properties list.
   */
  geo: { latitude: number; longitude: number } | null;
  useFloors: boolean;
  floorCount: number;
  rooms: RoomDraft[];
};

export const emptyForm = (): PropertyForm => ({
  name: '',
  location: '',
  city: '',
  state: '',
  postalCode: '',
  description: '',
  contactName: '',
  contactPhone: '',
  amenities: [],
  photos: [],
  roomPhotos: [],
  coverUri: null,
  geo: null,
  useFloors: false,
  floorCount: 1,
  rooms: [],
});

export const floorLabel = (floor: number): string => (floor === 0 ? 'Ground floor' : `Floor ${floor}`);

export const sharingLabel = (beds: number): string =>
  `${beds} sharing`;

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export function newKey(): string {
  let id = '';
  for (let i = 0; i < 20; i += 1) id += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  return id;
}

/** Suggested next room number; the owner can edit it. */
export function suggestRoomNumber(rooms: readonly RoomDraft[], floor: number | null): string {
  const onScope = rooms.filter((r) => r.floor === floor).length + 1;
  if (floor === null) return String(rooms.length + 1);
  return floor === 0 ? `G${onScope}` : String(floor * 100 + onScope);
}

/**
 * Regenerates the suggested numbers after rooms move between floors (e.g. floors switched on, so
 * "1" becomes "G1"). Numbers the owner typed themselves are never touched.
 */
export function renumberAutoRooms(rooms: readonly RoomDraft[]): RoomDraft[] {
  const done: RoomDraft[] = [];
  for (const room of rooms) {
    done.push(room.numberAuto ? { ...room, roomNumber: suggestRoomNumber(done, room.floor) } : room);
  }
  return done;
}

export function newRoom(rooms: readonly RoomDraft[], floor: number | null, from?: RoomDraft): RoomDraft {
  return {
    key: newKey(),
    roomNumber: suggestRoomNumber(rooms, floor),
    numberAuto: true,
    floor,
    sharing: from?.sharing ?? 2,
    ac: from?.ac ?? false,
    rent: from?.rent ?? '',
    bedLabels: [],
  };
}

export const defaultBedLabel = (index: number) => `Bed ${index + 1}`;

/** The bed names a room will be saved with: custom label if given, else "Bed n". */
export function bedLabelsFor(room: RoomDraft): string[] {
  return Array.from({ length: room.sharing }, (_, i) => {
    const custom = room.bedLabels[i]?.trim();
    return custom ? custom.slice(0, BED_LABEL_MAX) : defaultBedLabel(i);
  });
}

/** Custom labels that a reduction to `newSharing` beds would drop. */
export function labelsLostBy(room: RoomDraft, newSharing: number): string[] {
  return room.bedLabels.slice(newSharing, room.sharing).filter((l) => l.trim() !== '');
}

/** Whole rupees from the typed rent, or null when empty / not a positive integer in range. */
export function parseRent(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d{1,7}$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_RENT_INR ? value : null;
}

const norm = (value: string) => value.trim().toLowerCase();

export type FormErrors = {
  name?: string;
  location?: string;
  contactPhone?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  contactName?: string;
  /** Per room key. */
  rooms: Record<string, string>;
};

export function validateForm(form: PropertyForm): FormErrors {
  const errors: FormErrors = { rooms: {} };
  const name = form.name.trim();
  const location = form.location.trim();
  if (!name) errors.name = 'Enter the property name.';
  else if (name.length > LIMITS.name) errors.name = `Use at most ${LIMITS.name} characters.`;
  if (!location) errors.location = 'Enter the property address or location.';
  else if (location.length > LIMITS.location) errors.location = `Use at most ${LIMITS.location} characters.`;

  const city = form.city.trim();
  if (!city) errors.city = 'Enter the city.';
  if (!form.state.trim()) errors.state = 'Enter the state.';
  const postal = form.postalCode.trim();
  if (!postal) errors.postalCode = 'Enter the postal code.';
  else if (!/^[A-Za-z0-9 \-]{3,12}$/.test(postal)) errors.postalCode = 'Enter a valid postal code.';
  if (!form.contactName.trim()) errors.contactName = 'Enter the contact name.';
  const phone = form.contactPhone.trim();
  if (!phone) errors.contactPhone = 'Enter the contact phone number.';
  else if (!/^\+?[0-9][0-9 \-]{6,18}$/.test(phone)) errors.contactPhone = 'Enter a valid phone number.';

  const seen = new Set<string>();
  for (const room of form.rooms) {
    const number = room.roomNumber.trim();
    // With floors, a number only has to be unique on its floor; otherwise across the property.
    const scope = `${form.useFloors ? room.floor : '-'}|${norm(number)}`;
    if (!number) errors.rooms[room.key] = 'Enter a room number.';
    else if (number.length > ROOM_NUMBER_MAX) errors.rooms[room.key] = `Use at most ${ROOM_NUMBER_MAX} characters.`;
    else if (seen.has(scope)) errors.rooms[room.key] = 'This room number is already used.';
    else if (room.rent.trim() !== '' && parseRent(room.rent) === null) {
      errors.rooms[room.key] = `Rent must be a whole number from 1 to ${MAX_RENT_INR.toLocaleString('en-IN')}.`;
    }
    seen.add(scope);
  }
  return errors;
}

export const hasErrors = (e: FormErrors) =>
  !!(e.name || e.location || e.city || e.state || e.postalCode || e.contactName || e.contactPhone) || Object.keys(e.rooms).length > 0;

/** Step 1 (details) is complete enough to continue. */
export const detailsValid = (form: PropertyForm) => {
  const e = validateForm({ ...form, rooms: [] });
  return !hasErrors(e);
};

export type Summary = {
  rooms: number;
  beds: number;
  /** Rent per bed range over rooms with a rent; null when none is configured. */
  rent: { min: number; max: number } | null;
  roomsWithoutRent: number;
  /** Property photos. */
  photos: number;
  roomPhotos: number;
};

export function summarize(form: PropertyForm): Summary {
  const rents = form.rooms.map((r) => parseRent(r.rent)).filter((v): v is number => v !== null);
  return {
    rooms: form.rooms.length,
    beds: form.rooms.reduce((sum, r) => sum + r.sharing, 0),
    rent: rents.length > 0 ? { min: Math.min(...rents), max: Math.max(...rents) } : null,
    roomsWithoutRent: form.rooms.length - rents.length,
    photos: form.photos.length,
    roomPhotos: form.roomPhotos.length,
  };
}

export const formatInr = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

export function formatRentRange(rent: Summary['rent']): string {
  if (rent === null) return 'Not configured';
  return rent.min === rent.max
    ? `${formatInr(rent.min)} / bed`
    : `${formatInr(rent.min)} – ${formatInr(rent.max)} / bed`;
}

/** The property photo used as the display image: the chosen one if still present, else the first. */
export function coverPhoto(form: PropertyForm): PhotoDraft | null {
  return form.photos.find((p) => p.uri === form.coverUri) ?? form.photos[0] ?? null;
}

/**
 * Property photos with the display image first. `photos[0]` on the property document is its
 * display image, so choosing one is just putting it first.
 */
export function orderedPhotos(form: PropertyForm): PhotoDraft[] {
  const cover = coverPhoto(form);
  return cover ? [cover, ...form.photos.filter((p) => p !== cover)] : [];
}

/** Whether anything has been entered (to confirm before discarding). */
export function isDirty(form: PropertyForm): boolean {
  return (
    [form.name, form.location, form.city, form.state, form.postalCode, form.description, form.contactName, form.contactPhone].some(
      (v) => v.trim() !== '',
    ) ||
    form.photos.length > 0 ||
    form.roomPhotos.length > 0 ||
    form.rooms.length > 0
  );
}

export type RoomDoc = Record<string, string | number | boolean>;
export type BedDoc = { id: string; data: { label: string; status: BedStatus } };
export type RoomWrite = { roomId: string; room: RoomDoc; beds: BedDoc[] };

/** The room document and its initial (vacant) beds. Bed ids derive from the room key, so a retry rewrites, never duplicates. */
export function buildRoomWrite(room: RoomDraft, includeFloor: boolean): RoomWrite {
  const rent = parseRent(room.rent);
  const data: RoomDoc = {
    roomNumber: room.roomNumber.trim(),
    sharing: room.sharing,
    ac: room.ac,
    ...(includeFloor && room.floor !== null ? { floor: room.floor } : {}),
    ...(rent !== null ? { rentPerBedInr: rent } : {}),
  };
  const beds = bedLabelsFor(room).map((label, i) => ({
    id: `${room.key}_b${i + 1}`,
    data: { label, status: BedStatuses.Available },
  }));
  return { roomId: room.key, room: data, beds };
}

/** The room and bed documents (without server fields) the form will create. */
export function buildRoomWrites(form: PropertyForm): RoomWrite[] {
  return form.rooms.map((room) => buildRoomWrite(room, form.useFloors));
}

/**
 * Splits writes into batches of at most `max` documents, never splitting one room from its beds
 * (a Firestore batch holds 500 writes; the default leaves headroom).
 */
export function chunkRoomWrites(writes: readonly RoomWrite[], max = 250): RoomWrite[][] {
  const chunks: RoomWrite[][] = [];
  let current: RoomWrite[] = [];
  let size = 0;
  for (const write of writes) {
    const cost = 1 + write.beds.length;
    if (current.length > 0 && size + cost > max) {
      chunks.push(current);
      current = [];
      size = 0;
    }
    current.push(write);
    size += cost;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Optional text fields trimmed, empty ones dropped, ready to store on the property. */
export function propertyFields(form: PropertyForm) {
  const optional = (v: string) => v.trim() || undefined;
  const out: Record<string, string> = { name: form.name.trim(), location: form.location.trim() };
  const extras = {
    description: optional(form.description),
    contactName: optional(form.contactName),
    contactPhone: optional(form.contactPhone),
    city: optional(form.city),
    state: optional(form.state),
    postalCode: optional(form.postalCode),
  };
  for (const [key, value] of Object.entries(extras)) if (value !== undefined) out[key] = value;
  return out;
}
