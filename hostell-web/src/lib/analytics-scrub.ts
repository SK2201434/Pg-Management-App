/** Paths whose query string carries a single-use credential; only the path is ever reported for them. */
const SENSITIVE_PATHS = ["/auth/"];

/**
 * Drops the query string and fragment from sensitive URLs before an analytics event leaves the browser.
 * Returns null (drop the event) for a URL that cannot be parsed.
 */
export function scrubSensitiveUrl<T extends { url: string }>(event: T): T | null {
  try {
    const url = new URL(event.url);
    if (SENSITIVE_PATHS.some((prefix) => url.pathname.startsWith(prefix))) {
      url.search = "";
      url.hash = "";
      return { ...event, url: url.toString() };
    }
  } catch {
    return null;
  }
  return event;
}
