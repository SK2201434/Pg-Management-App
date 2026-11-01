import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PropertyDetail } from "@/components/property-detail/property-detail";
import { PropertyCard } from "@/components/properties/property-card";
import { propertyHref } from "@/lib/listings/format";
import { propertyMetadata } from "@/lib/listings/load-detail";
import type { PublicProperty } from "@/lib/listings/types";

const property = (o: Partial<PublicProperty> = {}): PublicProperty => ({
  id: "abc123",
  name: "Green PG",
  propertyType: null,
  city: "Hyderabad",
  state: "Telangana",
  description: null,
  coverUrl: null,
  photoUrls: [],
  roomTypes: [],
  amenities: [],
  rentMinInr: null,
  rentMaxInr: null,
  sharingOptions: [],
  updatedAt: null,
  ...o,
});

describe("homepage card links", () => {
  it("links the card to its detail route", () => {
    const html = renderToStaticMarkup(createElement(PropertyCard, { property: property() }));
    expect(html).toContain('href="/properties/abc123"');
  });
  it("encodes ids so they stay one path segment", () => {
    expect(propertyHref("a/b c")).toBe("/properties/a%2Fb%20c");
  });
});

describe("PropertyDetail", () => {
  it("renders a sparse property without optional sections", () => {
    const html = renderToStaticMarkup(createElement(PropertyDetail, { property: property(), downloadUrl: null }));
    expect(html).toContain("Green PG");
    expect(html).toContain("Hyderabad, Telangana");
    expect(html).toContain("Pricing not listed");
    expect(html).toContain("No photos available");
    expect(html).toContain("App coming soon");
    for (const absent of ["Room &amp; sharing options", "Amenities", "About this property", "Explore more stays"]) expect(html).not.toContain(absent);
  });

  it("renders available fields, dedupes photos and links the download CTA", () => {
    const html = renderToStaticMarkup(
      createElement(PropertyDetail, {
        property: property({
          description: "Quiet rooms.",
          coverUrl: "https://img.example/a.jpg",
          photoUrls: ["https://img.example/a.jpg", "https://img.example/b.jpg"],
          roomTypes: [{ sharing: 2, rooms: 3, bedsTotal: 6, bedsAvailable: 1, rentMinInr: 6000, rentMaxInr: 7000, acRooms: 1 }],
          amenities: ["WiFi"],
          rentMinInr: 6000,
          rentMaxInr: 7000,
          sharingOptions: [2],
        }),
        others: [property({ id: "other1", name: "Other" })],
        downloadUrl: "https://example.com/app",
      }),
    );
    expect(html).toContain("₹6,000 – ₹7,000");
    expect(html).toContain("Room &amp; sharing options");
    expect(html).toContain("WiFi");
    expect(html).toContain("Quiet rooms.");
    expect(html).toContain('href="/properties/other1"');
    expect(html).toContain('href="https://example.com/app"');
    expect(html.match(/<img[^>]*a\.jpg/g)?.length).toBe(1); // each photo is rendered once as a slide, not duplicated
  });

  it("never renders private-looking data", () => {
    const html = renderToStaticMarkup(createElement(PropertyDetail, { property: property(), downloadUrl: null }));
    for (const s of ["ownerUid", "contactPhone", "location\""]) expect(html).not.toContain(s);
  });
});

describe("propertyMetadata", () => {
  it("builds title and description from public fields", () => {
    const m = propertyMetadata({ kind: "ok", property: property({ rentMinInr: 5000, sharingOptions: [2, 3] }), others: [] });
    expect(m.title).toBe("Green PG in Hyderabad, Telangana");
    expect(m.description).toContain("Hyderabad, Telangana");
    expect(m.description).toContain("₹5,000");
    expect(m.description).toContain("2-sharing, 3-sharing");
  });
  it("falls back when the property is unavailable", () => {
    expect(propertyMetadata({ kind: "not_found" }).title).toBe("Property details");
  });
});
