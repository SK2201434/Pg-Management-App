import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor, InvalidCursorError } from "@/lib/listings/cursor";
import { fetchPublicProperties, InvalidLimitError, InvalidSearchError, parseLimit, parseSearch, PUBLIC_COLLECTION, searchPublicProperties } from "@/lib/listings/query";
import { fakeFirestore, listing, sharingRooms } from "./helpers";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i).padStart(3, "0")}`);
const docs = (list: string[]) => list.map((id) => ({ id, data: listing({ name: `PG ${id}` }) }));

describe("parseLimit", () => {
  it("defaults to 12 and accepts 1 to 24", () => {
    expect(parseLimit(null)).toBe(12);
    expect(parseLimit("")).toBe(12);
    expect(parseLimit("1")).toBe(1);
    expect(parseLimit("24")).toBe(24);
  });

  it.each(["0", "25", "-3", "abc", "1.5", "1e1", "0012x", "9999"])("rejects %j", (raw) => {
    expect(() => parseLimit(raw)).toThrow(InvalidLimitError);
  });
});

describe("cursor", () => {
  it("round-trips a document id", () => {
    expect(decodeCursor(encodeCursor("abc_123-XYZ"))).toBe("abc_123-XYZ");
  });

  it.each([
    "not a cursor!",
    "",
    "a".repeat(300),
    Buffer.from("{}").toString("base64url"),
    Buffer.from(JSON.stringify({ v: 2, id: "x" })).toString("base64url"),
    Buffer.from(JSON.stringify({ v: 1, id: "../users/x" })).toString("base64url"),
    Buffer.from(JSON.stringify({ v: 1, id: 5 })).toString("base64url"),
    Buffer.from("null").toString("base64url"),
    Buffer.from("not json").toString("base64url"),
  ])("rejects %j", (cursor) => {
    expect(() => decodeCursor(cursor)).toThrow(InvalidCursorError);
  });
});

describe("fetchPublicProperties", () => {
  it("queries only properties, and reads rooms (never beds) for the properties it shows", async () => {
    const { db, calls } = fakeFirestore(docs(ids(3)));
    await fetchPublicProperties(db, { limit: 12, cursor: null });
    expect(PUBLIC_COLLECTION).toBe("properties");
    expect([...new Set(calls.collections)]).toEqual([PUBLIC_COLLECTION]);
    expect(calls.where).toEqual([]);
    expect(calls.roomReads.sort()).toEqual(ids(3));
    expect(calls.bedReads).toEqual([]);
  });

  it("builds the rent range and sharing options from the rooms", async () => {
    const rooms = [
      { id: "r1", data: { sharing: 3, ac: false, rentPerBedInr: 4000 } },
      { id: "r2", data: { sharing: 1, ac: true, rentPerBedInr: 9000 } },
    ];
    const { db } = fakeFirestore([{ id: "a1", data: listing(), rooms }]);
    const page = await fetchPublicProperties(db, { limit: 12, cursor: null });
    expect(page.items[0]).toMatchObject({ sharingOptions: [1, 3], rentMinInr: 4000, rentMaxInr: 9000, roomTypes: [] });
  });

  it("still shows a property whose rooms cannot be read, without rent or sharing", async () => {
    const { db } = fakeFirestore(docs(["a1"]), { failRooms: new Error("boom") });
    const page = await fetchPublicProperties(db, { limit: 12, cursor: null });
    expect(page.items[0]).toMatchObject({ id: "a1", sharingOptions: [], rentMinInr: null });
  });

  it("never returns a draft or switched-off property, and keeps ones that predate setupStatus", async () => {
    const all = [
      ...docs(["a1"]),
      { id: "a2", data: listing({ status: "inactive" }) },
      { id: "a3", data: listing({ setupStatus: "draft" }) },
      { id: "a4", data: { name: "Legacy PG" } },
    ];
    const { db, calls } = fakeFirestore(all);
    const page = await fetchPublicProperties(db, { limit: 12, cursor: null });
    expect(page.items.map((i) => i.id)).toEqual(["a1", "a4"]);
    expect(calls.roomReads.sort()).toEqual(["a1", "a4"]); // rooms of hidden properties are never read
  });

  it("returns a next cursor when more results exist and null when they do not", async () => {
    const { db } = fakeFirestore(docs(ids(5)));
    const first = await fetchPublicProperties(db, { limit: 2, cursor: null });
    expect(first.items.map((i) => i.id)).toEqual(["p000", "p001"]);
    expect(first.hasMore).toBe(true);
    expect(decodeCursor(first.nextCursor!)).toBe("p001");

    const exact = await fetchPublicProperties(fakeFirestore(docs(ids(2))).db, { limit: 2, cursor: null });
    expect(exact).toMatchObject({ hasMore: false, nextCursor: null });
    expect(exact.items).toHaveLength(2);

    const empty = await fetchPublicProperties(fakeFirestore([]).db, { limit: 12, cursor: null });
    expect(empty).toEqual({ items: [], hasMore: false, nextCursor: null });
  });

  it("pages through every listing exactly once and then stops", async () => {
    const { db, calls } = fakeFirestore(docs(ids(7)));
    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Awaited<ReturnType<typeof fetchPublicProperties>> = await fetchPublicProperties(db, { limit: 3, cursor });
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 10);
    expect(seen).toEqual(ids(7));
    expect(new Set(seen).size).toBe(7);
    expect(pages).toBe(3);
    // One extra document is read per page to detect a further page; the whole collection is never read.
    expect(calls.limits.every((n) => n === 4)).toBe(true);
  });

  it("keeps advancing past an unusable document without repeating items", async () => {
    const all = docs(ids(4)).map((d, i) => (i === 1 ? { ...d, data: { setupStatus: "ready" } } : d)); // no name
    const { db } = fakeFirestore(all);
    const first = await fetchPublicProperties(db, { limit: 2, cursor: null });
    const second = await fetchPublicProperties(db, { limit: 2, cursor: first.nextCursor });
    const seen = [...first.items, ...second.items].map((i) => i.id);
    expect(seen).toEqual(["p000", "p002", "p003"]);
  });

  it("reads past drafts and switched-off properties so a page is still full", async () => {
    const all = ids(8).map((id, i) => ({ id, data: i % 2 === 1 ? listing({ status: "inactive" }) : listing({ name: `PG ${id}` }) }));
    const { db } = fakeFirestore(all);
    const first = await fetchPublicProperties(db, { limit: 2, cursor: null });
    expect(first.items.map((i) => i.id)).toEqual(["p000", "p002"]);
    expect(first.hasMore).toBe(true);
    const second = await fetchPublicProperties(db, { limit: 2, cursor: first.nextCursor });
    expect(second.items.map((i) => i.id)).toEqual(["p004", "p006"]);
    expect(second.hasMore).toBe(false);
  });

  it("rejects an invalid cursor before querying Firestore", async () => {
    const { db, calls } = fakeFirestore(docs(ids(2)));
    await expect(fetchPublicProperties(db, { limit: 2, cursor: "bad cursor" })).rejects.toBeInstanceOf(InvalidCursorError);
    expect(calls.startAfter).toEqual([]);
  });
});

describe("parseSearch", () => {
  it("trims the query and defaults to no filters", () => {
    expect(parseSearch(null, null)).toEqual({ q: "", sharing: "", type: "" });
    expect(parseSearch("  pune ", "more")).toEqual({ q: "pune", sharing: "more", type: "" });
    expect(parseSearch(null, null, "Coliving")).toEqual({ q: "", sharing: "", type: "Coliving" });
  });

  it.each([[null, "6", null], [null, "abc", null], ["x".repeat(101), null, null], [null, null, "Castle"]])("rejects %j / %j / %j", (q, sharing, type) => {
    expect(() => parseSearch(q, sharing, type)).toThrow(InvalidSearchError);
  });
});

describe("searchPublicProperties", () => {
  const all = [
    { id: "a1", data: listing({ name: "Green PG", city: "Hyderabad" }), rooms: sharingRooms(2, 3) },
    { id: "a2", data: listing({ name: "Blue Hostel", city: "Pune", state: "Maharashtra" }), rooms: sharingRooms(1) },
    { id: "a3", data: listing({ name: "Sunrise PG", city: "Pune", state: "Maharashtra" }), rooms: sharingRooms(2, 6) },
    { id: "a4", data: listing({ name: "Hidden", city: "Pune", status: "inactive" }) },
  ];

  it("matches name, city or state and skips switched-off properties", async () => {
    const { db } = fakeFirestore(all);
    const byCity = await searchPublicProperties(db, { q: "pune", sharing: "", limit: 12, cursor: null });
    expect(byCity.items.map((i) => i.id)).toEqual(["a2", "a3"]);
    const byName = await searchPublicProperties(db, { q: "green", sharing: "", limit: 12, cursor: null });
    expect(byName.items.map((i) => i.id)).toEqual(["a1"]);
    const byState = await searchPublicProperties(db, { q: "maharashtra", sharing: "", limit: 12, cursor: null });
    expect(byState.items.map((i) => i.id)).toEqual(["a2", "a3"]);
  });

  it("matches the address line without returning it", async () => {
    const { db } = fakeFirestore([
      { id: "m1", data: listing({ name: "Sunrise PG", city: "Hyderabad", location: "No 104 Kavuri Hills Road, Madhapur" }) },
      { id: "m2", data: listing({ name: "Other PG", city: "Hyderabad", location: "Gachibowli" }) },
    ]);
    const page = await searchPublicProperties(db, { q: "madhapur", sharing: "", limit: 12, cursor: null });
    expect(page.items.map((i) => i.id)).toEqual(["m1"]);
    expect(JSON.stringify(page)).not.toContain("Kavuri");
    expect((await searchPublicProperties(db, { q: "kavuri hills madhapur", sharing: "", limit: 12, cursor: null })).items).toHaveLength(1);
  });

  it("applies the sharing filter, alone or with a query", async () => {
    const { db } = fakeFirestore(all);
    const two = await searchPublicProperties(db, { q: "", sharing: "2", limit: 12, cursor: null });
    expect(two.items.map((i) => i.id)).toEqual(["a1", "a3"]);
    const more = await searchPublicProperties(db, { q: "pune", sharing: "more", limit: 12, cursor: null });
    expect(more.items.map((i) => i.id)).toEqual(["a3"]);
  });

  it("filters by property type, alone or with other filters, ignoring listings without one", async () => {
    const typed = [
      { id: "t1", data: listing({ name: "A", propertyType: "Men's Hostel" }), rooms: sharingRooms(2) },
      { id: "t2", data: listing({ name: "B", propertyType: "Women's Hostel" }), rooms: sharingRooms(2) },
      { id: "t3", data: listing({ name: "C", propertyType: "Women's Hostel" }), rooms: sharingRooms(3) },
      { id: "t4", data: listing({ name: "D" }) },
      { id: "t5", data: listing({ name: "E", propertyType: "Spaceship" }) },
    ];
    const { db } = fakeFirestore(typed);
    const women = await searchPublicProperties(db, { q: "", sharing: "", type: "Women's Hostel", limit: 12, cursor: null });
    expect(women.items.map((i) => i.id)).toEqual(["t2", "t3"]);
    expect(women.items.every((i) => i.propertyType === "Women's Hostel")).toBe(true);
    const womenTwo = await searchPublicProperties(db, { q: "", sharing: "2", type: "Women's Hostel", limit: 12, cursor: null });
    expect(womenTwo.items.map((i) => i.id)).toEqual(["t2"]);
    const any = await searchPublicProperties(db, { q: "", sharing: "", limit: 12, cursor: null });
    expect(any.items).toHaveLength(5);
  });

  it("reads rooms only for properties that match the text, and stops once the page is full", async () => {
    const { db, calls } = fakeFirestore([
      ...docs(ids(30)),
      { id: "zz", data: listing({ name: "Other", city: "Delhi" }) },
    ]);
    const page = await searchPublicProperties(db, { q: "pg", sharing: "", limit: 2, cursor: null });
    expect(page.items).toHaveLength(2);
    expect(calls.roomReads).not.toContain("zz");
    expect(calls.roomReads.length).toBeLessThanOrEqual(12); // one batch, not the whole scan
  });

  it("returns an empty page when nothing matches", async () => {
    const { db } = fakeFirestore(all);
    expect(await searchPublicProperties(db, { q: "delhi", sharing: "", limit: 12, cursor: null })).toEqual({ items: [], hasMore: false, nextCursor: null });
  });

  it("pages through matches with a cursor", async () => {
    const { db } = fakeFirestore(docs(ids(5)));
    const first = await searchPublicProperties(db, { q: "pg", sharing: "", limit: 2, cursor: null });
    expect(first.items.map((i) => i.id)).toEqual(["p000", "p001"]);
    expect(first.hasMore).toBe(true);
    const second = await searchPublicProperties(db, { q: "pg", sharing: "", limit: 2, cursor: first.nextCursor });
    expect(second.items.map((i) => i.id)).toEqual(["p002", "p003"]);
    const third = await searchPublicProperties(db, { q: "pg", sharing: "", limit: 2, cursor: second.nextCursor });
    expect(third).toMatchObject({ hasMore: false, nextCursor: null });
    expect(third.items.map((i) => i.id)).toEqual(["p004"]);
  });
});
