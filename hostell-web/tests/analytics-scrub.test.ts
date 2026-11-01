import { describe, expect, it } from "vitest";

import { scrubSensitiveUrl } from "@/lib/analytics-scrub";

describe("scrubSensitiveUrl", () => {
  it("removes the query string and fragment from /auth pages", () => {
    const out = scrubSensitiveUrl({ type: "pageview", url: "https://hostell.in/auth/action?mode=verifyEmail&oobCode=SECRET&apiKey=k#x" });
    expect(out).toEqual({ type: "pageview", url: "https://hostell.in/auth/action" });
  });

  it("leaves other pages untouched", () => {
    const event = { type: "pageview", url: "https://hostell.in/properties/abc?utm_source=ad" };
    expect(scrubSensitiveUrl(event)).toBe(event);
  });

  it("drops events with an unparsable URL", () => {
    expect(scrubSensitiveUrl({ url: "not a url" })).toBeNull();
  });
});
