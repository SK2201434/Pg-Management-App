const FALLBACK_SITE_URL = "http://localhost:3000";

/** The public origin from SITE_URL (for example https://www.hostell.in); anything that is not an http(s) URL falls back to localhost. */
export function parseSiteUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return FALLBACK_SITE_URL;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : FALLBACK_SITE_URL;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const getSiteUrl = (): string => parseSiteUrl(process.env.SITE_URL);

/** An absolute URL on this site for a root-relative path such as "/about". */
export const absoluteUrl = (path: string): string => new URL(path, `${getSiteUrl()}/`).toString();
