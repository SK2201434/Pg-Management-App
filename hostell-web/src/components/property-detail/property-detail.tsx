import Link from "next/link";

import { DownloadCta } from "@/components/home/download-cta";
import { Icon } from "@/components/icons";
import { PropertyGrid } from "@/components/properties/property-grid";
import { formatLocation, formatRentRange, formatSharing, RENT_UNAVAILABLE_LABEL } from "@/lib/listings/format";
import type { PublicProperty } from "@/lib/listings/types";
import { PropertyGallery } from "./property-gallery";
import styles from "./detail.module.css";

type Props = { property: PublicProperty; others?: PublicProperty[]; downloadUrl: string | null };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Quick facts shown under the title; only facts the listing actually has. */
function specs(property: PublicProperty, rent: string, hasRent: boolean): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (property.sharingOptions.length > 0) out.push({ label: "Sharing types", value: property.sharingOptions.map(formatSharing).join(" · ") });
  if (hasRent) out.push({ label: "Rent", value: `${rent} / month` });
  const total = sum(property.roomTypes.map((r) => r.bedsTotal));
  if (total > 0) out.push({ label: "Beds available", value: `${sum(property.roomTypes.map((r) => r.bedsAvailable))} of ${total}` });
  const ac = sum(property.roomTypes.map((r) => r.acRooms));
  if (ac > 0) out.push({ label: "Climate", value: `${ac} AC ${ac === 1 ? "room" : "rooms"}` });
  return out;
}

/** Everything shown here comes from the public listing shape; sections with no data are omitted. */
export function PropertyDetail({ property, others = [], downloadUrl }: Props) {
  const location = formatLocation(property);
  const rent = formatRentRange(property);
  const hasRent = rent !== RENT_UNAVAILABLE_LABEL;
  const facts = specs(property, rent, hasRent);

  return (
    <article>
      <div className={styles.crumbBar}>
        <div className={`container ${styles.crumbInner}`}>
          <nav aria-label="Breadcrumb" className={styles.crumbs}>
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/#explore">Explore Properties</Link>
            <span aria-hidden="true">/</span>
            <span className={styles.crumbCurrent} aria-current="page">
              {property.name}
            </span>
          </nav>
          {location && <span className={styles.crumbLocation}>{location}</span>}
        </div>
      </div>

      <div className={`container ${styles.page}`}>
        <PropertyGallery property={property} />

        <div className={styles.content}>
          <div className={styles.main}>
            <section className={styles.card} aria-labelledby="property-title">
              {property.sharingOptions.length > 0 && (
                <ul className={styles.badges} aria-label="Sharing options">
                  {property.sharingOptions.map((n) => (
                    <li key={n} className={styles.badge}>
                      {formatSharing(n)}
                    </li>
                  ))}
                </ul>
              )}
              <h1 id="property-title" className={styles.title}>
                {property.name}
              </h1>
              {location && (
                <p className={styles.location}>
                  <Icon name="pin" size={18} />
                  {location}
                </p>
              )}
              {facts.length > 0 && (
                <dl className={styles.facts}>
                  {facts.map((f) => (
                    <div key={f.label} className={styles.fact}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {property.description && (
              <section className={styles.card} aria-labelledby="about-heading">
                <h2 id="about-heading" className={styles.h2}>
                  About this property
                </h2>
                <p className={styles.description}>{property.description}</p>
              </section>
            )}

            {property.roomTypes.length > 0 && (
              <section className={styles.card} aria-labelledby="rooms-heading">
                <h2 id="rooms-heading" className={styles.h2}>
                  Room &amp; sharing options
                </h2>
                <ul className={styles.rooms}>
                  {property.roomTypes.map((r) => {
                    const roomRent = formatRentRange({ rentMinInr: r.rentMinInr, rentMaxInr: r.rentMaxInr, roomTypes: [] });
                    const roomHasRent = roomRent !== RENT_UNAVAILABLE_LABEL;
                    return (
                      <li key={r.sharing} className={styles.room}>
                        <div className={styles.roomInfo}>
                          <div className={styles.roomHead}>
                            <h3 className={styles.roomName}>{formatSharing(r.sharing)} room</h3>
                            {r.acRooms > 0 && <span className={styles.roomTag}>AC available</span>}
                          </div>
                          {r.bedsTotal > 0 && (
                            <p className={styles.roomMeta}>
                              {r.rooms > 0 && `${r.rooms} ${r.rooms === 1 ? "room" : "rooms"} · `}
                              {r.bedsAvailable} of {r.bedsTotal} beds available
                            </p>
                          )}
                        </div>
                        <div className={styles.roomPrice}>
                          <span className={roomHasRent ? styles.roomRent : styles.roomRentMuted}>{roomRent}</span>
                          {roomHasRent && <span className={styles.roomUnit}>/ month</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {property.amenities.length > 0 && (
              <section className={styles.card} aria-labelledby="amenities-heading">
                <h2 id="amenities-heading" className={styles.h2}>
                  Amenities &amp; facilities
                </h2>
                <ul className={styles.amenities}>
                  {property.amenities.map((a) => (
                    <li key={a} className={styles.amenity}>
                      <span className={styles.amenityIcon}>
                        <Icon name="check" size={18} />
                      </span>
                      {a}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className={styles.sidebar} aria-labelledby="cta-heading">
            <div className={styles.priceCard}>
              <h2 id="cta-heading" className={styles.srOnly}>
                Pricing and contact
              </h2>
              <p className={hasRent ? styles.price : styles.priceMuted}>
                {rent}
                {hasRent && <span className={styles.priceUnit}> / month</span>}
              </p>
              <div className={styles.notice}>
                <p className={styles.noticeTitle}>
                  <Icon name="lock" size={18} />
                  Contact through the app
                </p>
                <p>Owner contact details aren’t shown on this site. Use the HOSTELL app to get in touch about this property.</p>
              </div>
              <div className={styles.ctaStack}>
                <DownloadCta url={downloadUrl} label="Contact owner in the app" />
                <Link href="/#download" className={styles.linkCta}>
                  <Icon name="download" size={18} />
                  About the HOSTELL app
                </Link>
              </div>
            </div>
          </aside>
        </div>

        {others.length > 0 && (
          <section className={styles.others} aria-labelledby="others-heading">
            <div className={styles.othersHead}>
              <div>
                <p className={styles.eyebrow}>Keep exploring</p>
                <h2 id="others-heading" className={styles.othersTitle}>
                  Explore more stays
                </h2>
              </div>
              <Link href="/#explore" className={styles.browseLink}>
                Browse all properties
                <Icon name="arrow" size={18} />
              </Link>
            </div>
            <PropertyGrid properties={others} />
          </section>
        )}

        <section className={styles.banner} aria-labelledby="banner-heading">
          <div className={styles.bannerGlow} aria-hidden="true" />
          <div className={styles.bannerCopy}>
            <h2 id="banner-heading" className={styles.bannerTitle}>
              Found a place you like?
            </h2>
            <p>Continue with the HOSTELL app to get in touch with the property owner and take the next step.</p>
            <DownloadCta url={downloadUrl} onDark />
          </div>
        </section>
      </div>
    </article>
  );
}
