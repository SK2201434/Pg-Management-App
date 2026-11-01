"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { scrubSensitiveUrl } from "@/lib/analytics-scrub";

/** Vercel Web Analytics (visitors, page views) and Speed Insights (Core Web Vitals) for every page. */
export function SiteAnalytics() {
  return (
    <>
      <Analytics beforeSend={scrubSensitiveUrl} />
      <SpeedInsights beforeSend={scrubSensitiveUrl} />
    </>
  );
}
