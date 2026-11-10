import type { Firestore } from "firebase-admin/firestore";

type BedDoc = { id: string; data: Record<string, unknown> };
type RoomDoc = { id: string; data: Record<string, unknown>; beds?: BedDoc[] };
type Doc = { id: string; data: Record<string, unknown>; rooms?: RoomDoc[] };

/** A minimal stand-in for the Admin Firestore chain used by the listings query, recording what is asked of it. */
export function fakeFirestore(docs: Doc[], opts: { failWith?: unknown; failRooms?: unknown } = {}) {
  const calls = { collections: [] as string[], where: [] as unknown[][], startAfter: [] as unknown[], limits: [] as number[], docs: [] as string[], select: [] as string[][], roomReads: [] as string[], bedReads: [] as string[] };

  const makeQuery = (rows: Doc[]) => {
    const query = {
      where: (...args: unknown[]) => {
        calls.where.push(args);
        const [field, , value] = args as [string, string, unknown];
        return makeQuery(rows.filter((d) => d.data[field] === value));
      },
      orderBy: () => makeQuery([...rows].sort((a, b) => (a.id < b.id ? -1 : 1))),
      select: (...fields: string[]) => {
        calls.select.push(fields);
        return makeQuery(rows.map((d) => ({ id: d.id, data: Object.fromEntries(fields.filter((f) => f in d.data).map((f) => [f, d.data[f]])) })));
      },
      startAfter: (id: string) => {
        calls.startAfter.push(id);
        return makeQuery(rows.filter((d) => d.id > id));
      },
      limit: (n: number) => {
        calls.limits.push(n);
        return makeQuery(rows.slice(0, n));
      },
      get: async () => {
        if (opts.failWith) throw opts.failWith;
        return { docs: rows.map((d) => ({ id: d.id, data: () => d.data })) };
      },
    };
    return query;
  };

  const db = {
    collection: (name: string) => {
      calls.collections.push(name);
      return {
        ...makeQuery(docs),
        doc: (id: string) => ({
          get: async () => {
            calls.docs.push(id);
            if (opts.failWith) throw opts.failWith;
            const found = docs.find((d) => d.id === id);
            return { exists: found !== undefined, id, data: () => found?.data };
          },
          collection: (sub: string) => {
            if (sub !== "rooms") throw new Error(`unexpected subcollection ${sub}`);
            const rooms = docs.find((d) => d.id === id)?.rooms ?? [];
            return {
              get: async () => {
                calls.roomReads.push(id);
                if (opts.failRooms) throw opts.failRooms;
                return { docs: rooms.map((r) => ({ id: r.id, data: () => r.data })) };
              },
              doc: (roomId: string) => ({
                collection: (inner: string) => {
                  if (inner !== "beds") throw new Error(`unexpected subcollection ${inner}`);
                  return {
                    get: async () => {
                      calls.bedReads.push(`${id}/${roomId}`);
                      const beds = rooms.find((r) => r.id === roomId)?.beds ?? [];
                      return { docs: beds.map((b) => ({ id: b.id, data: () => b.data })) };
                    },
                  };
                },
              }),
            };
          },
        }),
      };
    },
  } as unknown as Pick<Firestore, "collection">;

  return { db, calls };
}

/** One room document per sharing type, with no rent and no beds read. */
export const sharingRooms = (...sharings: number[]): RoomDoc[] => sharings.map((n, i) => ({ id: `r${i}`, data: { sharing: n, ac: false } }));

/** A `properties` document as the owner app stores it: finished setup, nothing private left out on purpose. */
export const listing = (overrides: Record<string, unknown> = {}) => ({
  setupStatus: "ready",
  name: "Green PG",
  city: "Hyderabad",
  state: "Telangana",
  ...overrides,
});
