import { describe, expect, it } from "vitest";

import type { RoomInput } from "@/lib/listings/rooms";
import { toPublicProperty } from "@/lib/listings/serialize";
import { listing } from "./helpers";

const SENSITIVE = {
  ownerUid: "owner-secret-uid",
  contactName: "Ravi Kumar",
  contactPhone: "+91 98765 43210",
  location: "12 MG Road, Near Metro Pillar 14",
  postalCode: "500081",
  propertyId: "p1",
  geo: { latitude: 17.4, longitude: 78.3 },
  houseRules: ["No guests after 10pm"],
  moveOutPolicy: { notice: 30 },
};

describe("toPublicProperty", () => {
  it("returns a browsable property with its rooms summarised", () => {
    const rooms: RoomInput[] = [
      { sharing: 2, ac: true, rentPerBedInr: 5000, beds: [{ status: "available", occupied: false }, { status: "available", occupied: true }] },
      { sharing: 2, ac: false, rentPerBedInr: 6000, beds: [{ status: "unavailable", occupied: false }, { status: "available", occupied: false }] },
      { sharing: 1, ac: false, rentPerBedInr: null, beds: [{ status: "available", occupied: false }] },
    ];
    const item = toPublicProperty(
      "p1",
      listing({
        propertyType: "Coliving",
        description: "Quiet rooms close to the IT park.",
        photos: [{ url: "https://res.cloudinary.com/demo/a.jpg" }, { url: "https://res.cloudinary.com/demo/b.jpg" }],
        roomPhotos: [{ url: "https://res.cloudinary.com/demo/c.jpg" }],
        amenities: ["wifi", "meals"],
        updatedAt: { toDate: () => new Date("2026-01-02T03:04:05Z") },
      }),
      rooms,
    );
    expect(item).toEqual({
      id: "p1",
      name: "Green PG",
      propertyType: "Coliving",
      city: "Hyderabad",
      state: "Telangana",
      description: "Quiet rooms close to the IT park.",
      coverUrl: "https://res.cloudinary.com/demo/a.jpg",
      photoUrls: ["https://res.cloudinary.com/demo/a.jpg", "https://res.cloudinary.com/demo/b.jpg", "https://res.cloudinary.com/demo/c.jpg"],
      roomTypes: [
        { sharing: 1, rooms: 1, bedsTotal: 1, bedsAvailable: 1, rentMinInr: null, rentMaxInr: null, acRooms: 0 },
        { sharing: 2, rooms: 2, bedsTotal: 4, bedsAvailable: 2, rentMinInr: 5000, rentMaxInr: 6000, acRooms: 1 },
      ],
      amenities: ["wifi", "meals"],
      rentMinInr: 5000,
      rentMaxInr: 6000,
      sharingOptions: [1, 2],
      updatedAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it("gives sharing options and rent but no availability when only rooms were read", () => {
    const item = toPublicProperty("p1", listing(), [{ sharing: 3, ac: false, rentPerBedInr: 4500, beds: null }]);
    expect(item).toMatchObject({ sharingOptions: [3], rentMinInr: 4500, rentMaxInr: 4500, roomTypes: [] });
  });

  it("keeps only a known property type", () => {
    expect(toPublicProperty("p", listing({ propertyType: "Women's Hostel" }))?.propertyType).toBe("Women's Hostel");
    expect(toPublicProperty("p", listing({ propertyType: "Castle" }))?.propertyType).toBeNull();
    expect(toPublicProperty("p", listing())?.propertyType).toBeNull();
  });

  it("excludes drafts and switched-off properties, and keeps ones that predate setupStatus", () => {
    expect(toPublicProperty("p", listing({ setupStatus: "draft" }))).toBeNull();
    expect(toPublicProperty("p", listing({ status: "inactive" }))).toBeNull();
    expect(toPublicProperty("p", listing({ status: "active" }))).not.toBeNull();
    expect(toPublicProperty("p", { name: "Legacy" })).not.toBeNull();
    expect(toPublicProperty("p", undefined)).toBeNull();
  });

  it("excludes listings without a usable name", () => {
    expect(toPublicProperty("p", listing({ name: "  " }))).toBeNull();
    expect(toPublicProperty("p", listing({ name: 42 }))).toBeNull();
  });

  it("never returns sensitive fields, nor the free-text location", () => {
    const item = toPublicProperty("p1", listing(SENSITIVE));
    const json = JSON.stringify(item);
    for (const key of ["ownerUid", "contactName", "contactPhone", "location", "postalCode", "propertyId", "geo", "houseRules", "moveOutPolicy"]) {
      expect(item).not.toHaveProperty(key);
    }
    for (const value of ["owner-secret-uid", "Ravi Kumar", "98765", "MG Road", "500081", "17.4", "guests after"]) {
      expect(json).not.toContain(value);
    }
  });

  it("does not leak unknown extra fields", () => {
    const item = toPublicProperty("p1", listing({ upiId: "x@upi", internalNote: "private", tenants: ["a"] }));
    expect(Object.keys(item!).sort()).toEqual(
      ["amenities", "city", "coverUrl", "description", "id", "name", "photoUrls", "propertyType", "rentMaxInr", "rentMinInr", "roomTypes", "sharingOptions", "state", "updatedAt"],
    );
  });

  it("copes with missing optional fields", () => {
    expect(toPublicProperty("p1", { name: "Bare" })).toEqual({
      id: "p1",
      name: "Bare",
      propertyType: null,
      city: null,
      state: null,
      description: null,
      coverUrl: null,
      photoUrls: [],
      roomTypes: [],
      amenities: [],
      rentMinInr: null,
      rentMaxInr: null,
      sharingOptions: [],
      updatedAt: null,
    });
  });

  it("copes with wrongly typed fields", () => {
    const item = toPublicProperty(
      "p1",
      listing({
        photos: "nope",
        roomPhotos: [null, 5, { url: 7 }],
        amenities: [1, "wifi", null],
        updatedAt: "yesterday",
      }),
      [
        { sharing: 0, ac: false, rentPerBedInr: 1, beds: null },
        { sharing: 3, ac: false, rentPerBedInr: null, beds: null },
      ],
    );
    expect(item?.photoUrls).toEqual([]);
    expect(item?.amenities).toEqual(["wifi"]);
    expect(item?.sharingOptions).toEqual([3]);
    expect(item?.rentMinInr).toBeNull(); // a room without a valid sharing is ignored, rent included
    expect(item?.updatedAt).toBeNull();
  });

  it("keeps only https photo URLs, falls back to the first photo for the cover, and caps the gallery", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ url: `https://img.example/${i}.jpg` }));
    const item = toPublicProperty("p1", listing({ photos: [{ url: "javascript:alert(1)" }, { url: "http://x/y.jpg" }, ...many] }));
    expect(item?.photoUrls).toHaveLength(8);
    expect(item?.photoUrls.every((u) => u.startsWith("https://"))).toBe(true);
    expect(item?.coverUrl).toBe("https://img.example/0.jpg");
  });

  it("omits a description that contains a phone number", () => {
    expect(toPublicProperty("p1", listing({ description: "Call 98765 43210 for a visit" }))?.description).toBeNull();
    expect(toPublicProperty("p1", listing({ description: "Clean rooms, near metro." }))?.description).toBe("Clean rooms, near metro.");
    expect(toPublicProperty("p1", listing({}))?.description).toBeNull();
  });
});
