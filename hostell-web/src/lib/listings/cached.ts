import "server-only";

import { cacheLife } from "next/cache";

import { getAdminFirestore } from "@/lib/firebase/admin";
import { PAGE_SIZE } from "./client";
import { fetchPublicProperties, fetchPublicPropertyIndex } from "./query";
import type { PublicPropertiesPage } from "./types";

/** The first homepage page, shared across requests for a minute so crawlers and visitors do not each hit Firestore. A failure is thrown, so it is never cached. */
export async function getFirstPage(): Promise<PublicPropertiesPage> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 3600 });
  return fetchPublicProperties(getAdminFirestore(), { limit: PAGE_SIZE, cursor: null });
}

/** Every listed property's id and last update, for the sitemap; cached for an hour. */
export async function getPropertyIndex(): Promise<{ id: string; updatedAt: string | null }[]> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  return fetchPublicPropertyIndex(getAdminFirestore());
}
