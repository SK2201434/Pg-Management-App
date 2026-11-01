import { describe, expect, it } from "vitest";

import { toPublicProperty } from "@/lib/listings/serialize";
import { listing } from "./helpers";

const SENSITIVE = {
  ownerUid: "owner-secret-uid",
  contactName: "Ravi Kumar",
  contactPhone: "+91 98765 43210",
  location: "12 MG Road, Near Metro Pillar 14",
  postalCode: "500081",
  propertyId: "p1",
  listed: true,
};

describe("toPublicProperty", () => {
  it("returns a valid listed property", () => {
    const item = toPublicProperty(
      "p1",
      listing({
        propertyType: "Coliving",
        description: "Quiet rooms close to the IT park.",
        coverUrl: "https://res.cloudinary.com/demo/a.jpg",
        photoUrls: ["https://res.cloudinary.com/demo/a.jpg", "https://res.cloudinary.com/demo/b.jpg"],
        roomTypes: [{ sharing: 2, rooms: 3, bedsTotal: 6, bedsAvailable: 2, rentMinInr: 5000, rentMaxInr: 6000, acRooms: 1 }],
        amenities: ["wifi", "meals"],
        rentMinInr: 5000,
        rentMaxInr: 6000,
        sharingOptions: [2, 1],
        updatedAt: { toDate: () => new Date("2026-01-02T03:04:05Z") },
      }),
    );
    expect(item).toEqual({
      id: "p1",
      name: "Green PG",
      propertyType: "Coliving",
      city: "Hyderabad",
      state: "Telangana",
      description: "Quiet rooms close to the IT park.",
      coverUrl: "https://res.cloudinary.com/demo/a.jpg",
      photoUrls: ["https://res.cloudinary.com/demo/a.jpg", "https://res.cloudinary.com/demo/b.jpg"],
      roomTypes: [{ sharing: 2, rooms: 3, bedsTotal: 6, bedsAvailable: 2, rentMinInr: 5000, rentMaxInr: 6000, acRooms: 1 }],
      amenities: ["wifi", "meals"],
      rentMinInr: 5000,
      rentMaxInr: 6000,
      sharingOptions: [1, 2],
      updatedAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it("keeps only a known property type", () => {
    expect(toPublicProperty("p", listing({ propertyType: "Women's Hostel" }))?.propertyType).toBe("Women's Hostel");
    expect(toPublicProperty("p", listing({ propertyType: "Castle" }))?.propertyType).toBeNull();
    expect(toPublicProperty("p", listing())?.propertyType).toBeNull();
  });

  it("excludes listings that are not listed === true", () => {
    expect(toPublicProperty("p", listing({ listed: false }))).toBeNull();
    expect(toPublicProperty("p", listing({ listed: "true" }))).toBeNull();
    expect(toPublicProperty("p", { name: "No flag" })).toBeNull();
    expect(toPublicProperty("p", undefined)).toBeNull();
  });

  it("excludes listings without a usable name", () => {
    expect(toPublicProperty("p", listing({ name: "  " }))).toBeNull();
    expect(toPublicProperty("p", listing({ name: 42 }))).toBeNull();
  });

  it("never returns sensitive fields, nor the free-text location", () => {
    const item = toPublicProperty("p1", listing(SENSITIVE));
    const json = JSON.stringify(item);
    for (const key of ["ownerUid", "contactName", "contactPhone", "location", "postalCode", "propertyId", "listed"]) {
      expect(item).not.toHaveProperty(key);
    }
    for (const value of ["owner-secret-uid", "Ravi Kumar", "98765", "MG Road", "500081"]) {
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
    expect(toPublicProperty("p1", { listed: true, name: "Bare" })).toEqual({
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
        photoUrls: "nope",
        roomTypes: [null, 5, { sharing: "x" }, { sharing: 3 }],
        amenities: [1, "wifi", null],
        sharingOptions: ["a", 0, 2, 2],
        rentMinInr: "5000",
        updatedAt: "yesterday",
      }),
    );
    expect(item?.photoUrls).toEqual([]);
    expect(item?.roomTypes).toEqual([{ sharing: 3, rooms: 0, bedsTotal: 0, bedsAvailable: 0, rentMinInr: null, rentMaxInr: null, acRooms: 0 }]);
    expect(item?.amenities).toEqual(["wifi"]);
    expect(item?.sharingOptions).toEqual([2]);
    expect(item?.rentMinInr).toBeNull();
    expect(item?.updatedAt).toBeNull();
  });

  it("keeps only https photo URLs, falls back to the first photo for the cover, and caps the gallery", () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://img.example/${i}.jpg`);
    const item = toPublicProperty("p1", listing({ coverUrl: "http://insecure/x.jpg", photoUrls: ["javascript:alert(1)", "http://x/y.jpg", ...many] }));
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
