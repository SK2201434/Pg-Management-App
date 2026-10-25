import { useEffect, useRef, useState } from 'react';
import { backfillListings, syncListing } from '@/features/discovery/discoveryService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectOwner } from '@/features/auth/ownerAuthSelectors';
import { getCurrentCoordinates } from '@/features/properties/currentAddress';
import {
  fetchOwnerProperties,
  fetchPropertyDetail,
  createRoomWithBeds,
  fetchPropertyRooms,
  fetchPropertyTenants,
  setPropertyGeo,
  setPropertyStatus,
} from '@/features/properties/propertyService';
import { hasRoomNumber } from '@/features/properties/propertyDetailsModel';
import { buildRoomWrite, type PropertyForm, type RoomDraft } from '@/features/properties/propertySetup';
import type { PropertyEditData } from '@/features/properties/propertyEdit';
import { fetchPropertyForEdit, savePropertyEdit, type EditProgress, type EditResult } from '@/features/properties/propertyEditService';
import { useAppSelector } from '@/store/hooks';

export const ownerPropertiesQueryKey = (ownerUid: string | undefined) =>
  ['properties', ownerUid] as const;

/** The signed-in owner's properties, cached per owner UID. */
export function useOwnerProperties() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: ownerPropertiesQueryKey(ownerUid),
    queryFn: () => fetchOwnerProperties(ownerUid as string),
    enabled: ownerUid !== undefined,
  });
}

// Detail keys extend the list key, so invalidating the list also refreshes every open detail.
export const propertyDetailQueryKey = (ownerUid: string | undefined, propertyId: string) =>
  ['properties', ownerUid, 'detail', propertyId] as const;
export const propertyRoomsQueryKey = (ownerUid: string | undefined, propertyId: string) =>
  ['properties', ownerUid, 'rooms', propertyId] as const;

/** One property of the signed-in owner; `propertyId` must already be validated. */
export function usePropertyDetail(propertyId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: propertyDetailQueryKey(ownerUid, propertyId ?? ''),
    queryFn: () => fetchPropertyDetail(propertyId as string, ownerUid as string),
    enabled: ownerUid !== undefined && propertyId !== null,
    // A missing or foreign property will not appear on retry; only a network failure is retried.
    retry: (count, error) => (error as { kind?: string }).kind === 'unavailable' && count < 2,
  });
}

/** The property's rooms with their beds. Separate from the detail query, so a failure stays local. */
export function usePropertyRooms(propertyId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: propertyRoomsQueryKey(ownerUid, propertyId ?? ''),
    queryFn: () => fetchPropertyRooms(propertyId as string, ownerUid as string),
    enabled: ownerUid !== undefined && propertyId !== null,
  });
}

export const propertyTenantsQueryKey = (ownerUid: string | undefined, propertyId: string) =>
  ['properties', ownerUid, 'tenants', propertyId] as const;

/** The tenants of one property. The key holds the property id, so switching property never reuses another's list. */
export function usePropertyTenants(propertyId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: propertyTenantsQueryKey(ownerUid, propertyId ?? ''),
    queryFn: () => fetchPropertyTenants(propertyId as string, ownerUid as string),
    enabled: ownerUid !== undefined && propertyId !== null,
  });
}

/**
 * Captures the phone's current position and stores it as the property's coordinates. The caller
 * confirms with the owner first (they must be at the property).
 */
export function useCapturePropertyGeo() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (propertyId) => setPropertyGeo(propertyId, await getCurrentCoordinates()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) }),
  });
}

/** Thrown when another room with the same number already exists (checked against fresh data). */
export class DuplicateRoomError extends Error {
  constructor() {
    super('This property already has a room with this number.');
    this.name = 'DuplicateRoomError';
  }
}

/**
 * Adds one room with its vacant beds in one batch, then refreshes the property's lists. Room
 * numbers are re-read first so a stale list cannot let a duplicate through. Retrying with the same
 * draft key rewrites the same documents.
 */
export function useAddRoom(propertyId: string) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, { draft: RoomDraft; includeFloor: boolean }>({
    mutationFn: async ({ draft, includeFloor }) => {
      const current = await fetchPropertyRooms(propertyId, ownerUid as string);
      const alreadyWritten = current.some((r) => r.id === draft.key);
      if (!alreadyWritten && hasRoomNumber(current, draft.roomNumber)) throw new DuplicateRoomError();
      await createRoomWithBeds(propertyId, ownerUid as string, buildRoomWrite(draft, includeFloor));
    },
    onSuccess: () => {
      // New beds change what the public listing shows.
      if (ownerUid) void syncListing(propertyId, ownerUid);
      return queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) });
    },
  });
}

/** Activates or deactivates a property, then refreshes the list and open details. */
export function useSetPropertyStatus() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  return useMutation<void, Error, { propertyId: string; status: 'active' | 'inactive' }>({
    mutationFn: ({ propertyId, status }) => setPropertyStatus(propertyId, status),
    onSuccess: (_, { propertyId }) => {
      // A switched-off property leaves discovery; a switched-on one returns (best effort).
      if (ownerUid) void syncListing(propertyId, ownerUid);
      return queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) });
    },
  });
}

/**
 * One-time catch-up: lists the owner's existing ready properties that have no public listing. It
 * runs once per session after the property list loads, and never blocks or fails the screen.
 */
export function useListingBackfill() {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const { data } = useOwnerProperties();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !ownerUid || !data) return;
    done.current = true;
    void backfillListings(ownerUid, data.map((p) => p.id));
  }, [ownerUid, data]);
}

/** One of the owner's own properties, loaded for editing; a property of another owner is refused. */
export function usePropertyForEdit(propertyId: string | null) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  return useQuery({
    queryKey: [...ownerPropertiesQueryKey(ownerUid), 'edit', propertyId] as const,
    queryFn: () => fetchPropertyForEdit(propertyId as string, ownerUid as string),
    enabled: ownerUid !== undefined && propertyId !== null,
    retry: false,
    // The form is edited locally, so it is not refreshed under the owner's hands.
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    gcTime: 0,
  });
}

/** Saves an edit, then refreshes the list, the details and the edit data. */
export function useSavePropertyEdit(propertyId: string) {
  const ownerUid = useAppSelector(selectOwner)?.uid;
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<EditProgress | null>(null);
  const mutation = useMutation<EditResult, Error, { form: PropertyForm; original: PropertyEditData }>({
    mutationFn: ({ form, original }) =>
      savePropertyEdit({ propertyId, ownerUid: ownerUid as string, form, original, report: setProgress }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerPropertiesQueryKey(ownerUid) }),
    onSettled: () => setProgress(null),
  });
  return { ...mutation, progress };
}
