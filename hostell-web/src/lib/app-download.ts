/**
 * The public app download destination, from NEXT_PUBLIC_APP_DOWNLOAD_URL. Returns null unless it is
 * a valid http(s) URL, so callers never render a broken link.
 */
export function parseAppDownloadUrl(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const getAppDownloadUrl = (): string | null => parseAppDownloadUrl(process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL);
