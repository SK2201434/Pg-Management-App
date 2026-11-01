import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AppPromoSection } from "@/components/home/app-promo-section";
import { DiscoveryProvider } from "@/components/home/discovery-context";
import { Hero } from "@/components/home/hero";
import { MissionSection } from "@/components/home/mission-section";
import { PropertySection } from "@/components/properties/property-section";
import { getAppDownloadUrl } from "@/lib/app-download";
import { parsePage } from "@/lib/listings/client";
import { getFirstPage } from "@/lib/listings/cached";
import type { PublicPropertiesPage } from "@/lib/listings/types";
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: "/", absoluteTitle: true });

/**
 * The first page of listings is rendered on the server, so search engines see real property links
 * in the HTML. If it cannot be read, the browser fetches it instead, exactly as before.
 */
async function HomeProperties() {
  await connection();
  let initialPage: PublicPropertiesPage | undefined;
  try {
    initialPage = parsePage(await getFirstPage());
  } catch {
    initialPage = undefined;
  }
  return <PropertySection initialPage={initialPage} />;
}

export default function Home() {
  return (
    <>
      <DiscoveryProvider>
        <Hero />
        <Suspense fallback={<PropertySection />}>
          <HomeProperties />
        </Suspense>
      </DiscoveryProvider>
      <MissionSection />
      <AppPromoSection downloadUrl={getAppDownloadUrl()} />
    </>
  );
}
