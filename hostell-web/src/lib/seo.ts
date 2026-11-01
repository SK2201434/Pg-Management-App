import type { Metadata } from "next";

import { formatLocation, formatRentRange, RENT_UNAVAILABLE_LABEL } from "@/lib/listings/format";
import type { PublicProperty } from "@/lib/listings/types";
import { absoluteUrl } from "@/lib/site";

export const SITE_NAME = "HOSTELL";
export const DEFAULT_TITLE = "HOSTELL – Find hostels and PGs";
export const DEFAULT_DESCRIPTION =
  "Discover hostels and PG accommodation, see sharing options and rent at a glance, and find a place that suits you.";

/** Shared social preview image, served from /public. */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "HOSTELL" };

const MAX_DESCRIPTION = 160;

export function truncate(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

type PageMetadataInput = {
  title: string;
  description: string;
  /** Root-relative path, used for the canonical URL and og:url. */
  path: string;
  /** Replaces the shared preview image, for example a property's cover photo (https URL). */
  image?: string;
  /** Use the title as written instead of adding the " | HOSTELL" suffix. */
  absoluteTitle?: boolean;
  noindex?: boolean;
};

/** Title, description, canonical, Open Graph and Twitter tags for one page. A page's openGraph replaces the layout's, so each page supplies all of it. */
export function pageMetadata({ title, description, path, image, absoluteTitle = false, noindex = false }: PageMetadataInput): Metadata {
  const desc = truncate(description, MAX_DESCRIPTION);
  const fullTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  const images = image ? [{ url: image, alt: title }] : [OG_IMAGE];
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: desc,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", url: path, title: fullTitle, description: desc, images },
    twitter: { card: "summary_large_image", title: fullTitle, description: desc, images: [images[0].url] },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Organization and website data for the whole site. */
export function siteJsonLd() {
  const org = absoluteUrl("/#organization");
  return {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": org, name: SITE_NAME, url: absoluteUrl("/"), logo: absoluteUrl("/hostell-logo.png") },
      { "@type": "WebSite", "@id": absoluteUrl("/#website"), url: absoluteUrl("/"), name: SITE_NAME, description: DEFAULT_DESCRIPTION, inLanguage: "en", publisher: { "@id": org } },
    ],
  };
}

/** A hostel listing as schema.org structured data, built only from the public listing fields. */
export function propertyJsonLd(property: PublicProperty, path: string) {
  const location = formatLocation(property);
  const rent = formatRentRange(property);
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "Hostel",
    "@id": `${url}#property`,
    name: property.name,
    url,
    ...(property.description ? { description: truncate(property.description, 300) } : {}),
    ...(property.photoUrls.length > 0 ? { image: property.photoUrls.slice(0, 5) } : property.coverUrl ? { image: [property.coverUrl] } : {}),
    ...(location
      ? {
          address: {
            "@type": "PostalAddress",
            ...(property.city ? { addressLocality: property.city } : {}),
            ...(property.state ? { addressRegion: property.state } : {}),
            addressCountry: "IN",
          },
        }
      : {}),
    ...(rent !== RENT_UNAVAILABLE_LABEL ? { priceRange: rent } : {}),
    ...(property.amenities.length > 0
      ? { amenityFeature: property.amenities.map((name) => ({ "@type": "LocationFeatureSpecification", name, value: true })) }
      : {}),
  };
}

export function propertyBreadcrumbJsonLd(property: PublicProperty, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Explore Properties", item: absoluteUrl("/#explore") },
      { "@type": "ListItem", position: 3, name: property.name, item: absoluteUrl(path) },
    ],
  };
}

/** Serializes structured data for an inline script; "<" is escaped so listing text can never close the tag. */
export const serializeJsonLd = (data: unknown): string => JSON.stringify(data).replace(/</g, "\\u003c");
