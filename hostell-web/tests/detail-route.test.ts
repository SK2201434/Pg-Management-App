import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeFirestore, listing } from "./helpers";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/firebase/admin", () => ({
  getAdminFirestore: () => {
    if (state.db instanceof Error) throw state.db;
    return state.db;
  },
}));

import { GET } from "@/app/api/public/properties/[id]/route";
import { loadPropertyDetail } from "@/lib/listings/load-detail";

const call = (id: string) => GET(new Request(`http://localhost/api/public/properties/${id}`), { params: Promise.resolve({ id }) });

const sensitive = {
  geo: { latitude: 12.97, longitude: 77.59 },
  houseRules: ["Gate closes at 9"],
  ownerUid: "owner-secret-uid",
  contactName: "Ravi Kumar",
  contactPhone: "9876543210",
  location: "12 MG Road, near Metro",
  postalCode: "560001",
  tenants: [{ name: "T1" }],
  payments: [{ amount: 1 }],
  stayRequests: [{ id: "r" }],
};

describe("GET /api/public/properties/[id]", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns a property with live availability from its rooms and beds", async () => {
    const bed = (id: string, occupied?: boolean) => ({ id, data: { status: "available", ...(occupied ? { occupied } : {}) } });
    state.db = fakeFirestore([
      {
        id: "p1",
        data: listing({ name: "Sunrise" }),
        rooms: [
          { id: "r1", data: { sharing: 2, ac: true, rentPerBedInr: 5000 }, beds: [bed("b1"), bed("b2", true)] },
          { id: "r2", data: { sharing: 3, ac: false }, beds: [bed("b3"), bed("b4"), bed("b5")] },
        ],
      },
    ]).db;
    const res = await call("p1");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.item).toMatchObject({ id: "p1", name: "Sunrise", city: "Hyderabad", sharingOptions: [2, 3], rentMinInr: 5000 });
    expect(body.item.roomTypes).toEqual([
      { sharing: 2, rooms: 1, bedsTotal: 2, bedsAvailable: 1, rentMinInr: 5000, rentMaxInr: 5000, acRooms: 1 },
      { sharing: 3, rooms: 1, bedsTotal: 3, bedsAvailable: 3, rentMinInr: null, rentMaxInr: null, acRooms: 0 },
    ]);
    expect(res.headers.get("cache-control")).toMatch(/^public, s-maxage=\d+/);
  });

  it("reads one property document plus its rooms and beds, never the bed claims", async () => {
    const fake = fakeFirestore([{ id: "p1", data: listing(), rooms: [{ id: "r1", data: { sharing: 2, ac: false }, beds: [{ id: "b1", data: { status: "available" } }] }] }]);
    state.db = fake.db;
    await call("p1");
    expect([...new Set(fake.calls.collections)]).toEqual(["properties"]);
    expect(fake.calls.docs).toEqual(["p1"]);
    expect(fake.calls.roomReads).toEqual(["p1"]);
    expect(fake.calls.bedReads).toEqual(["p1/r1"]);
  });

  it("returns 404 for a switched-off or draft property, without reading its rooms", async () => {
    const fake = fakeFirestore([{ id: "p1", data: listing({ status: "inactive" }) }, { id: "p2", data: listing({ setupStatus: "draft" }) }]);
    state.db = fake.db;
    expect((await call("p2")).status).toBe(404);
    expect(fake.calls.roomReads).toEqual([]);
    const res = await call("p1");
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 404 for a missing property", async () => {
    state.db = fakeFirestore([]).db;
    const res = await call("nope");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("not_found");
  });

  it("excludes sensitive fields and the location field", async () => {
    state.db = fakeFirestore([{ id: "p1", data: listing(sensitive) }]).db;
    const text = await (await call("p1")).text();
    for (const leaked of ["owner-secret-uid", "Ravi Kumar", "9876543210", "MG Road", "560001", "ownerUid", "contactName", "contactPhone", "location", "postalCode", "tenants", "payments", "stayRequests", "geo", "12.97", "houseRules", "Gate closes"]) {
      expect(text).not.toContain(leaked);
    }
  });

  it("omits descriptions containing contact information and keeps safe ones", async () => {
    state.db = fakeFirestore([
      { id: "bad", data: listing({ description: "Call me on 98765 43210 for details" }) },
      { id: "mail", data: listing({ description: "Write to owner@example.com" }) },
      { id: "good", data: listing({ description: "Quiet rooms near the university." }) },
    ]).db;
    expect((await (await call("bad")).json()).item.description).toBeNull();
    expect((await (await call("mail")).json()).item.description).toBeNull();
    expect((await (await call("good")).json()).item.description).toBe("Quiet rooms near the university.");
  });

  it.each(["a/b", "a b", "x".repeat(129), "..", "a.b"])("rejects invalid id %j with 400", async (id) => {
    const fake = fakeFirestore([]);
    state.db = fake.db;
    const res = await call(id);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_id");
    expect(fake.calls.docs).toEqual([]);
  });

  it("hides Firestore error details", async () => {
    const secret = "projects/hostell-685b3 PERMISSION_DENIED token=abc123";
    state.db = fakeFirestore([], { failWith: Object.assign(new Error(secret), { code: 7 }) }).db;
    const res = await call("p1");
    const text = await res.text();
    expect(res.status).toBe(503);
    for (const leaked of ["hostell-685b3", "PERMISSION_DENIED", "abc123", "stack"]) expect(text).not.toContain(leaked);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("abc123");
  });
});

describe("loadPropertyDetail (server page data)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns the property and other listed properties without duplicates", async () => {
    state.db = fakeFirestore([
      { id: "a", data: listing({ name: "A" }) },
      { id: "b", data: listing({ name: "B" }) },
      { id: "c", data: listing({ name: "C", status: "inactive" }) },
      { id: "d", data: listing({ name: "D" }) },
    ]).db;
    const r = await loadPropertyDetail("a");
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.property.name).toBe("A");
      expect(r.others.map((p) => p.id)).toEqual(["b", "d"]);
    }
  });

  it("maps invalid, missing and failing lookups to states", async () => {
    state.db = fakeFirestore([]).db;
    expect((await loadPropertyDetail("bad id!")).kind).toBe("invalid");
    expect((await loadPropertyDetail("missing")).kind).toBe("not_found");
    state.db = fakeFirestore([], { failWith: new Error("secret") }).db;
    expect((await loadPropertyDetail("x1")).kind).toBe("unavailable");
  });
});

describe("invalid ids without server configuration", () => {
  it("returns 400 before touching Firebase config", async () => {
    state.db = new Error("FIREBASE_PRIVATE_KEY missing");
    expect((await call("a.b")).status).toBe(400);
  });
});
