import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeCursor } from "@/lib/listings/cursor";
import { fakeFirestore, listing } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => {
    if (state.db instanceof Error) throw state.db;
    return state.db;
  },
}));

import { GET } from "@/app/api/public/properties/route";

const call = (query = "") => GET(new Request(`http://localhost/api/public/properties${query}`));

describe("GET /api/public/properties", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns items, nextCursor and hasMore, with only public fields", async () => {
    state.db = fakeFirestore([
      { id: "p1", data: listing({ ownerUid: "u1", contactPhone: "9876543210", contactName: "R", location: "1 Street" }) },
      { id: "p2", data: listing({ status: "inactive" }) },
      { id: "p3", data: listing({ name: "Third" }) },
    ]).db;
    const res = await call("?limit=2");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items.map((i: { id: string }) => i.id)).toEqual(["p1", "p3"]);
    expect(body).toMatchObject({ hasMore: false, nextCursor: null });
    const raw = JSON.stringify(body);
    for (const leaked of ["u1", "9876543210", "1 Street", "ownerUid", "contactPhone", "location"]) expect(raw).not.toContain(leaked);
  });

  it("returns a cursor that fetches the following page", async () => {
    state.db = fakeFirestore(Array.from({ length: 3 }, (_, i) => ({ id: `p${i}`, data: listing() }))).db;
    const first = await (await call("?limit=2")).json();
    expect(first.hasMore).toBe(true);
    const second = await (await call(`?limit=2&cursor=${first.nextCursor}`)).json();
    expect(second.items.map((i: { id: string }) => i.id)).toEqual(["p2"]);
    expect(second.nextCursor).toBeNull();
  });

  it.each(["?limit=0", "?limit=25", "?limit=abc"])("rejects %s with 400", async (q) => {
    state.db = fakeFirestore([]).db;
    const res = await call(q);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_limit");
  });

  it("rejects an invalid cursor with 400", async () => {
    state.db = fakeFirestore([]).db;
    const res = await call("?cursor=%24%24%24");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_cursor");
    expect((await call(`?cursor=${encodeCursor("ok1")}`)).status).toBe(200);
  });

  it("hides Firestore error details", async () => {
    const secret = "projects/hostell-685b3/databases/(default) PERMISSION_DENIED token=abc123";
    state.db = fakeFirestore([], { failWith: Object.assign(new Error(secret), { code: 7 }) }).db;
    const res = await call();
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toEqual({ error: { code: "service_unavailable", message: "Listings are temporarily unavailable." } });
    for (const leaked of ["hostell-685b3", "PERMISSION_DENIED", "abc123", "stack"]) expect(text).not.toContain(leaked);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("abc123");
  });

  it("hides missing-configuration details", async () => {
    state.db = new Error("FIREBASE_PRIVATE_KEY is garbage: -----BEGIN");
    const res = await call();
    const text = await res.text();
    expect(res.status).toBe(503);
    expect(text).not.toContain("BEGIN");
    expect(text).not.toContain("FIREBASE_PRIVATE_KEY");
  });

  it("sets a public cache header on success and no-store on errors", async () => {
    state.db = fakeFirestore([]).db;
    expect((await call()).headers.get("cache-control")).toMatch(/^public, s-maxage=\d+/);
    expect((await call("?limit=0")).headers.get("cache-control")).toBe("no-store");
  });
});
