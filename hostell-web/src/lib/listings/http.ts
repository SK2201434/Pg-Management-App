/** Cache policy and error shape shared by the public listing endpoints. */
export function cacheHeader(): string {
  const seconds = Number(process.env.PUBLIC_LISTINGS_CACHE_SECONDS ?? 60);
  const s = Number.isFinite(seconds) ? Math.min(Math.max(Math.trunc(seconds), 0), 3600) : 60;
  return s === 0 ? "no-store" : `public, s-maxage=${s}, stale-while-revalidate=${s * 2}`;
}

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}
