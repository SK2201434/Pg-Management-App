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

  it("returns a listed property", async () => {
    state.db = fakeFirestore([{ id: "p1", data: listing({ name: "Sunrise", sharingOptions: [2, 3], rentMinInr: 5000 }) }]).db;
    const res = await call("p1");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.item).toMatchObject({ id: "p1", name: "Sunrise", city: "Hyderabad", sharingOptions: [2, 3], rentMinInr: 5000 });
    expect(res.headers.get("cache-control")).toMatch(/^public, s-maxage=\d+/);
  });

  it("reads one document from publicListings only", async () => {
    const fake = fakeFirestore([{ id: "p1", data: listing() }]);
    state.db = fake.db;
    await call("p1");
    expect(fake.calls.collections).toEqual(["publicListings"]);
    expect(fake.calls.docs).toEqual(["p1"]);
  });

  it("returns 404 for an unlisted property", async () => {
    state.db = fakeFirestore([{ id: "p1", data: listing({ listed: false }) }]).db;
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
    for (const leaked of ["owner-secret-uid", "Ravi Kumar", "9876543210", "MG Road", "560001", "ownerUid", "contactName", "contactPhone", "location", "postalCode", "tenants", "payments", "stayRequests"]) {
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
      { id: "c", data: listing({ name: "C", listed: false }) },
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
