import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { JsonLd } from "@/components/json-ld";
import { InvalidPropertyState, PropertyDetailSkeleton, PropertyUnavailableState } from "@/components/property-detail/detail-states";
import { PropertyDetail } from "@/components/property-detail/property-detail";
import { getAppDownloadUrl } from "@/lib/app-download";
import { propertyHref } from "@/lib/listings/format";
import { loadPropertyDetail, propertyMetadata } from "@/lib/listings/load-detail";
import { pageMetadata, propertyBreadcrumbJsonLd, propertyJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await loadPropertyDetail(id);
  return pageMetadata({
    ...propertyMetadata(result),
    path: propertyHref(id),
    image: result.kind === "ok" ? (result.property.coverUrl ?? undefined) : undefined,
    // Error and missing states must never be indexed.
    noindex: result.kind !== "ok",
  });
}

async function PropertyContent({ params }: Props) {
  const { id } = await params;
  const result = await loadPropertyDetail(id);
  switch (result.kind) {
    case "ok": {
      const path = propertyHref(id);
      return (
        <>
          <JsonLd data={propertyJsonLd(result.property, path)} />
          <JsonLd data={propertyBreadcrumbJsonLd(result.property, path)} />
          <PropertyDetail property={result.property} others={result.others} downloadUrl={getAppDownloadUrl()} />
        </>
      );
    }
    case "invalid":
      return <InvalidPropertyState />;
    case "unavailable":
      return <PropertyUnavailableState retryHref={`/properties/${encodeURIComponent(id)}`} />;
    case "not_found":
      notFound();
  }
}

export default function PropertyPage({ params }: Props) {
  return (
    <Suspense fallback={<PropertyDetailSkeleton />}>
      <PropertyContent params={params} />
    </Suspense>
  );
}
