/**
 * The only top-level collection the public API reads: the owners' own `properties`. There is no
 * separately published copy; the serializer's allowlist is what keeps private fields out. The rooms
 * and beds under a property are read as well (see `rooms.ts`); nothing else is touched.
 */
export const PUBLIC_COLLECTION = "properties";
