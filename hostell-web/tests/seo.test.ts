import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPublicPropertyIndex } from "@/lib/listings/query";
import { DEFAULT_TITLE, pageMetadata, propertyBreadcrumbJsonLd, propertyJsonLd, serializeJsonLd, siteJsonLd, truncate } from "@/lib/seo";
import { absoluteUrl, parseSiteUrl } from "@/lib/site";
import type { PublicProperty } from "@/lib/listings/types";
import { fakeFirestore, listing } from "./helpers";

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

afterEach(() => vi.unstubAllEnvs());

describe("site url", () => {
  it("accepts http(s) origins and drops any path", () => {
    expect(parseSiteUrl("https://www.example.com/")).toBe("https://www.example.com");
    expect(parseSiteUrl(" https://example.com/some/path ")).toBe("https://example.com");
  });
  it("falls back to localhost for missing or invalid values", () => {
    for (const bad of [undefined, "", "  ", "not a url", "javascript:alert(1)", "ftp://example.com"]) expect(parseSiteUrl(bad)).toBe("http://localhost:3000");
  });
  it("builds absolute urls from SITE_URL", () => {
    vi.stubEnv("SITE_URL", "https://hostell.example");
    expect(absoluteUrl("/about")).toBe("https://hostell.example/about");
    expect(absoluteUrl("/")).toBe("https://hostell.example/");
  });
});

describe("pageMetadata", () => {
  it("sets canonical, Open Graph and Twitter tags", () => {
    const m = pageMetadata({ title: "About us", description: "Desc", path: "/about" });
    expect(m.alternates?.canonical).toBe("/about");
    expect(m.openGraph).toMatchObject({ url: "/about", title: "About us | HOSTELL", siteName: "HOSTELL" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
    expect(m.robots).toBeUndefined();
  });
  it("uses the title as written when asked and never doubles the suffix on the home page", () => {
    const m = pageMetadata({ title: DEFAULT_TITLE, description: "d", path: "/", absoluteTitle: true });
    expect(m.title).toEqual({ absolute: DEFAULT_TITLE });
    expect(m.openGraph).toMatchObject({ title: DEFAULT_TITLE });
  });
  it("uses a property's own photo as the preview image and can block indexing", () => {
    const m = pageMetadata({ title: "x", description: "d", path: "/properties/a", image: "https://img.example/a.jpg", noindex: true });
    expect(m.openGraph).toMatchObject({ images: [{ url: "https://img.example/a.jpg" }] });
    expect(m.robots).toEqual({ index: false, follow: false });
  });
  it("keeps descriptions to 160 characters", () => {
    const m = pageMetadata({ title: "x", description: "word ".repeat(100), path: "/" });
    expect((m.description as string).length).toBeLessThanOrEqual(160);
    expect(truncate("short text", 160)).toBe("short text");
  });
});

describe("structured data", () => {
  it("describes the site as an organization and website", () => {
    const graph = (siteJsonLd() as { "@graph": { "@type": string }[] })["@graph"];
    expect(graph.map((g) => g["@type"])).toEqual(["Organization", "WebSite"]);
  });
  it("describes a property from public fields only", () => {
    const data = propertyJsonLd(
      property({ description: "Quiet rooms.", photoUrls: ["https://img.example/a.jpg"], rentMinInr: 6000, rentMaxInr: 7000, amenities: ["WiFi"] }),
      "/properties/abc123",
    ) as Record<string, unknown>;
    expect(data["@type"]).toBe("Hostel");
    expect(data).toMatchObject({ name: "Green PG", priceRange: "₹6,000 – ₹7,000", address: { addressLocality: "Hyderabad", addressRegion: "Telangana", addressCountry: "IN" } });
    expect(data.image).toEqual(["https://img.example/a.jpg"]);
    expect(JSON.stringify(data)).not.toMatch(/ownerUid|contact|phone/i);
  });
  it("omits fields the listing does not have", () => {
    const data = propertyJsonLd(property({ city: null, state: null }), "/properties/abc123");
    for (const key of ["address", "priceRange", "image", "amenityFeature", "description"]) expect(data).not.toHaveProperty(key);
  });
  it("lists the breadcrumb trail ending at the property", () => {
    const items = (propertyBreadcrumbJsonLd(property(), "/properties/abc123") as { itemListElement: { name: string }[] }).itemListElement;
    expect(items.map((i) => i.name)).toEqual(["Home", "Explore Properties", "Green PG"]);
  });
  it("escapes < so listing text cannot close the script tag", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(JSON.parse(out).name).toBe("</script><script>alert(1)</script>");
  });
});

describe("fetchPublicPropertyIndex", () => {
  it("returns id and last update for listed, usable properties, reading only the fields it needs", async () => {
    const { db, calls } = fakeFirestore([
      { id: "a", data: listing() },
      { id: "b", data: listing({ listed: false }) },
      { id: "c", data: { listed: true } },
      { id: "d", data: listing({ ownerUid: "secret" }) },
    ]);
    const index = await fetchPublicPropertyIndex(db, 100);
    expect(index).toEqual([
      { id: "a", updatedAt: null },
      { id: "d", updatedAt: null },
    ]);
    expect(calls.collections).toEqual(["publicListings"]);
    expect(calls.where).toEqual([["listed", "==", true]]);
    expect(calls.select).toEqual([["listed", "name", "updatedAt"]]);
    expect(calls.limits).toEqual([100]);
  });
});
