import { getAdminFirestore } from "@/lib/firebase/admin";
import { fetchPublicProperty, isValidPropertyId } from "@/lib/listings/detail";
import { cacheHeader, errorResponse as error } from "@/lib/listings/http";

/**
 * GET /api/public/properties/[id]
 * Public and read-only. Returns `{ item }` for a listed property, 404 otherwise.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!isValidPropertyId(id)) return error(400, "invalid_id", "Property id is not valid."); // before any server configuration is touched
  try {
    const item = await fetchPublicProperty(getAdminFirestore(), id);
    if (item === null) return error(404, "not_found", "Property not found.");
    return Response.json({ item }, { headers: { "Cache-Control": cacheHeader() } });
  } catch (e) {
    const code = (e as { code?: unknown } | null)?.code;
    console.error("[api/public/properties/id] failed", e instanceof Error ? e.name : "UnknownError", typeof code === "string" || typeof code === "number" ? code : "");
    return error(503, "service_unavailable", "Listings are temporarily unavailable.");
  }
}
