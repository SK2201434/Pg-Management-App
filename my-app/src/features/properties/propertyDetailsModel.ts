// Pure helpers for the Property Details screen: route-param validation and what can honestly be
// said about a property from its room and bed records. No React, no Firebase.
import { MAX_ROOMS, ROOM_NUMBER_MAX, parseRent, sharingLabel } from '@/features/properties/propertySetup';
import type { PropertyRoom } from '@/features/properties/propertyTypes';

/** Firestore auto-IDs and this app's keys are alphanumeric; anything else is never a property. */
export function parsePropertyId(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}

export type RoomTotals = {
  totalRooms: number;
  totalBeds: number;
  /** Beds that can be given to a tenant: status `available` and not held by a resident. */
  availableBeds: number;
  /** Beds held by a resident (a bed allocation). */
  occupiedBeds: number;
  /** Distinct floors the rooms are on; 0 when the property is not organised by floor. */
  floorCount: number;
  /** Rooms whose bed records do not match the configured number of beds. */
  incompleteRooms: number;
  /** Rent per bed range over rooms with a rent; null when none is configured. */
  rent: { min: number; max: number } | null;
};

export function summarizeRooms(rooms: readonly PropertyRoom[]): RoomTotals {
  const floors = new Set<number>();
  let totalBeds = 0;
  let availableBeds = 0;
  let occupiedBeds = 0;
  let incompleteRooms = 0;
  const rents: number[] = [];
  for (const room of rooms) {
    totalBeds += room.beds.length;
    availableBeds += availableBedCount(room);
    occupiedBeds += occupiedBedCount(room);
    if (room.beds.length !== room.sharing) incompleteRooms += 1;
    if (room.floor !== null) floors.add(room.floor);
    if (room.rentPerBedInr !== null) rents.push(room.rentPerBedInr);
  }
  return {
    totalRooms: rooms.length,
    totalBeds,
    availableBeds,
    occupiedBeds,
    floorCount: floors.size,
    incompleteRooms,
    rent: rents.length > 0 ? { min: Math.min(...rents), max: Math.max(...rents) } : null,
  };
}

/** Floor, then room number with digits compared as numbers (2 before 10). */
export function sortRooms(rooms: readonly PropertyRoom[]): PropertyRoom[] {
  return [...rooms].sort(
    (a, b) =>
      (a.floor ?? -1) - (b.floor ?? -1) ||
      a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

/**
 * occupied / total as a whole percentage clamped to 0-100. `null` when occupancy cannot be stated:
 * occupied beds unknown (no stay is linked to a bed yet) or no beds to divide by.
 */
export function occupancyPercent(occupiedBeds: number | null, totalBeds: number): number | null {
  if (occupiedBeds === null || totalBeds <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((occupiedBeds / totalBeds) * 100)));
}

/** Beds that can be allocated: status `available` and no resident. Owner-blocked beds never count. */
export const availableBedCount = (room: PropertyRoom): number =>
  room.beds.filter((b) => b.status === 'available' && b.occupant === null).length;

export const occupiedBedCount = (room: PropertyRoom): number => room.beds.filter((b) => b.occupant !== null).length;

export type RoomListFilter = 'all' | 'available' | 'occupied';
export type SharingFilter = 'any' | 1 | 2 | 3 | '4+';

export type RoomQuery = { search: string; filter: RoomListFilter; sharing: SharingFilter };

const matchesSharing = (sharing: number, filter: SharingFilter) =>
  filter === 'any' || (filter === '4+' ? sharing >= 4 : sharing === filter);

/** Rooms matching all three controls. "Available Beds" = rooms with a bed free to allocate; "Occupied" = rooms with at least one resident. */
export function filterRooms(rooms: readonly PropertyRoom[], { search, filter, sharing }: RoomQuery): PropertyRoom[] {
  const needle = search.trim().toLowerCase();
  return rooms.filter((room) => {
    if (filter === 'available' && availableBedCount(room) === 0) return false;
    if (filter === 'occupied' && occupiedBedCount(room) === 0) return false;
    if (!matchesSharing(room.sharing, sharing)) return false;
    if (!needle) return true;
    const haystack = [room.roomNumber, sharingLabel(room.sharing), room.ac ? 'ac' : 'non-ac', ...room.beds.map((b) => b.label)]
      .join('\n')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export type NewRoomInput = { roomNumber: string; rent: string; floor: string };
export type NewRoomErrors = { roomNumber?: string; rent?: string; floor?: string; form?: string };

export const hasRoomNumber = (rooms: readonly PropertyRoom[], roomNumber: string) =>
  rooms.some((r) => r.roomNumber.trim().toLowerCase() === roomNumber.trim().toLowerCase());

/** Required: a room number unique in the property. Optional: rent (whole rupees) and floor 0-60. */
export function validateNewRoom(input: NewRoomInput, rooms: readonly PropertyRoom[]): NewRoomErrors {
  const errors: NewRoomErrors = {};
  const number = input.roomNumber.trim();
  if (!number) errors.roomNumber = 'Enter a room number.';
  else if (number.length > ROOM_NUMBER_MAX) errors.roomNumber = `Use at most ${ROOM_NUMBER_MAX} characters.`;
  else if (hasRoomNumber(rooms, number)) errors.roomNumber = 'This property already has a room with this number.';
  if (input.rent.trim() && parseRent(input.rent) === null) errors.rent = 'Enter whole rupees, 1 to 10,00,000.';
  if (input.floor.trim() && !(/^\d{1,2}$/.test(input.floor.trim()) && Number(input.floor) <= 60)) {
    errors.floor = 'Enter a floor from 0 (ground) to 60.';
  }
  if (rooms.length >= MAX_ROOMS) errors.form = `A property can have up to ${MAX_ROOMS} rooms here.`;
  return errors;
}
