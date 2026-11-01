import type { MetadataRoute } from "next";
import { connection } from "next/server";

import { getPropertyIndex } from "@/lib/listings/cached";
import { propertyHref } from "@/lib/listings/format";
import { absoluteUrl } from "@/lib/site";

/** The site's pages plus every listed property. If listings cannot be read, the static pages are still returned. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Read at request time (the listings are cached separately), so the build never needs Firestore.
  await connection();

  const pages: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/about"), changeFrequency: "monthly", priority: 0.6 },
  ];

  try {
    const properties = await getPropertyIndex();
    return [
      ...pages,
      ...properties.map(({ id, updatedAt }) => ({
        url: absoluteUrl(propertyHref(id)),
        ...(updatedAt ? { lastModified: new Date(updatedAt) } : {}),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
    ];
  } catch (e) {
    console.error("[sitemap] listings unavailable", e instanceof Error ? e.name : "UnknownError");
    return pages;
  }
}
