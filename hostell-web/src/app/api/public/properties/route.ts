import { getAdminFirestore } from "@/lib/firebase/admin";
import { cacheHeader, errorResponse as error } from "@/lib/listings/http";
import { decodeCursor, InvalidCursorError } from "@/lib/listings/cursor";
import {
  fetchPublicProperties,
  InvalidLimitError,
  InvalidSearchError,
  MAX_QUERY_LENGTH,
  parseLimit,
  parseSearch,
  searchPublicProperties,
} from "@/lib/listings/query";

/**
 * GET /api/public/properties?limit=12&cursor=...&q=koramangala&sharing=2&type=Coliving
 * Public and read-only. `q` matches name, address, city or state; `sharing` is 1-5 or "more"; `type` is a property type. Returns `{ items, nextCursor, hasMore }`.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;

  let limit: number;
  try {
    limit = parseLimit(params.get("limit"));
  } catch (e) {
    if (e instanceof InvalidLimitError) return error(400, "invalid_limit", "limit must be a whole number from 1 to 24.");
    throw e;
  }

  let search: { q: string; sharing: string; type: string };
  try {
    search = parseSearch(params.get("q"), params.get("sharing"), params.get("type"));
  } catch (e) {
    if (e instanceof InvalidSearchError) return error(400, "invalid_search", `q must be at most ${MAX_QUERY_LENGTH} characters, sharing must be 1-5 or "more", and type must be a known property type.`);
    throw e;
  }

  const cursor = params.get("cursor") || null;
  try {
    if (cursor !== null) decodeCursor(cursor); // reject a bad cursor before any server configuration is touched
    const db = getAdminFirestore();
    const page =
      search.q === "" && search.sharing === "" && search.type === "" ? await fetchPublicProperties(db, { limit, cursor }) : await searchPublicProperties(db, { ...search, limit, cursor });
    return Response.json(page, { headers: { "Cache-Control": cacheHeader() } });
  } catch (e) {
    if (e instanceof InvalidCursorError) return error(400, "invalid_cursor", "cursor is not valid.");
    // Log only the error class and a Firestore code: messages can contain project details.
    const code = (e as { code?: unknown } | null)?.code;
    console.error("[api/public/properties] failed", e instanceof Error ? e.name : "UnknownError", typeof code === "string" || typeof code === "number" ? code : "");
    return error(503, "service_unavailable", "Listings are temporarily unavailable.");
  }
}
