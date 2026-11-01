import { describe, expect, it } from "vitest";

import { parseAppDownloadUrl } from "@/lib/app-download";
import { normalizeProperty, parsePage } from "@/lib/listings/client";
import { filterByLocation, matchesLocation, mergeUnique, normalizeSearchText } from "@/lib/listings/filter";
import { formatLocation, formatRentRange, formatSharing, imageCandidates, RENT_UNAVAILABLE_LABEL } from "@/lib/listings/format";

const base = { roomTypes: [], rentMinInr: null, rentMaxInr: null };

describe("formatRentRange", () => {
  it("formats a range in INR with Indian grouping", () => {
    expect(formatRentRange({ ...base, rentMinInr: 6000, rentMaxInr: 125000 })).toBe("₹6,000 – ₹1,25,000");
  });
  it("collapses equal bounds and handles a single bound", () => {
    expect(formatRentRange({ ...base, rentMinInr: 7000, rentMaxInr: 7000 })).toBe("₹7,000");
    expect(formatRentRange({ ...base, rentMinInr: 7000 })).toBe("₹7,000");
  });
  it("falls back to room types, then to a neutral label", () => {
    const rt = { sharing: 2, rooms: 1, bedsTotal: 2, bedsAvailable: 1, rentMinInr: 5000, rentMaxInr: 8000, acRooms: 0 };
    expect(formatRentRange({ ...base, roomTypes: [rt] })).toBe("₹5,000 – ₹8,000");
    expect(formatRentRange(base)).toBe(RENT_UNAVAILABLE_LABEL);
  });
});

describe("formatting helpers", () => {
  it("joins city and state, tolerating nulls", () => {
    expect(formatLocation({ city: "Pune", state: "Maharashtra" })).toBe("Pune, Maharashtra");
    expect(formatLocation({ city: null, state: "Goa" })).toBe("Goa");
    expect(formatLocation({ city: null, state: null })).toBeNull();
  });
  it("labels sharing", () => {
    expect(formatSharing(1)).toBe("Single");
    expect(formatSharing(3)).toBe("3-sharing");
  });
  it("keeps cover first and drops duplicates and non-https urls", () => {
    expect(imageCandidates({ coverUrl: "https://a/x.jpg", photoUrls: ["https://a/x.jpg", "http://b/y.jpg", "nope", "https://c/z.jpg"] })).toEqual([
      "https://a/x.jpg",
      "https://c/z.jpg",
    ]);
    expect(imageCandidates({ coverUrl: null, photoUrls: [] })).toEqual([]);
  });
});

describe("location filtering", () => {
  it("normalizes case, accents, punctuation and whitespace", () => {
    expect(normalizeSearchText("  Pondichéry,   TN ")).toBe("pondichery tn");
  });
  it("matches city or state case-insensitively, all words required", () => {
    const p = { city: "Bengaluru", state: "Karnataka" };
    expect(matchesLocation(p, "BENGAL")).toBe(true);
    expect(matchesLocation(p, "karnataka")).toBe(true);
    expect(matchesLocation(p, "Bengaluru, Karnataka")).toBe(true);
    expect(matchesLocation(p, "Bengaluru Kerala")).toBe(false);
    expect(matchesLocation(p, "   ")).toBe(true);
    expect(matchesLocation({ city: null, state: null }, "pune")).toBe(false);
  });
  it("filters lists", () => {
    const items = [
      { id: "1", city: "Pune", state: "Maharashtra" },
      { id: "2", city: "Delhi", state: "Delhi" },
    ];
    expect(filterByLocation(items, "pune").map((i) => i.id)).toEqual(["1"]);
  });
});

describe("mergeUnique", () => {
  it("skips ids that are already present, including repeats within a page", () => {
    const merged = mergeUnique([{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }, { id: "c" }]);
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("API response parsing", () => {
  it("rejects malformed bodies", () => {
    expect(() => parsePage(null)).toThrow();
    expect(() => parsePage({ items: "x" })).toThrow();
  });
  it("drops unusable items, coerces bad fields and never keeps unknown fields", () => {
    const page = parsePage({
      items: [
        { id: "1", name: "Sunrise", city: 5, rentMinInr: "9", sharingOptions: [3, 2, 2, "x", 0], ownerUid: "secret", phone: "123" },
        { name: "no id" },
        null,
      ],
      nextCursor: "abc",
      hasMore: true,
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({ id: "1", city: null, rentMinInr: null, sharingOptions: [2, 3] });
    expect(page.items[0]).not.toHaveProperty("ownerUid");
    expect(page.items[0]).not.toHaveProperty("phone");
    expect(page.nextCursor).toBe("abc");
  });
  it("only reports more pages when a cursor exists", () => {
    expect(parsePage({ items: [], nextCursor: null, hasMore: true }).hasMore).toBe(false);
    expect(normalizeProperty({ id: "1", name: " " })).toBeNull();
  });
});

describe("parseAppDownloadUrl", () => {
  it("accepts http(s) urls only", () => {
    expect(parseAppDownloadUrl("https://example.com/app")).toBe("https://example.com/app");
    expect(parseAppDownloadUrl("javascript:alert(1)")).toBeNull();
    expect(parseAppDownloadUrl("not a url")).toBeNull();
    expect(parseAppDownloadUrl("  ")).toBeNull();
    expect(parseAppDownloadUrl(undefined)).toBeNull();
  });
});
