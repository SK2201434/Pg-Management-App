import Link from "next/link";

import { Icon } from "@/components/icons";
import { formatLocation, formatRentRange, formatSharing, propertyHref, RENT_UNAVAILABLE_LABEL } from "@/lib/listings/format";
import type { PublicProperty } from "@/lib/listings/types";
import { PropertyImage } from "./property-image";
import styles from "./properties.module.css";

const MAX_AMENITIES = 4;
const MAX_SHARING_BADGES = 2;

export function PropertyCard({ property }: { property: PublicProperty }) {
  const location = formatLocation(property);
  const rent = formatRentRange(property);
  const hasRent = rent !== RENT_UNAVAILABLE_LABEL;
  const amenities = property.amenities.slice(0, MAX_AMENITIES);
  const sharing = property.sharingOptions.slice(0, MAX_SHARING_BADGES);
  const alt = location ? `${property.name} in ${location}` : `Photo of ${property.name}`;

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        <PropertyImage property={property} alt={alt} />
        {sharing.length > 0 && (
          <ul className={styles.badges} aria-label="Sharing options">
            {sharing.map((n) => (
              <li key={n} className={styles.badge}>
                {formatSharing(n)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.info}>
          <h3 className={styles.name}>
            <Link href={propertyHref(property.id)} className={styles.cardLink}>
              {property.name}
            </Link>
          </h3>
          {location && (
            <p className={styles.location}>
              <Icon name="pin" size={16} />
              {location}
            </p>
          )}
          {amenities.length > 0 && (
            <ul className={styles.amenities} aria-label="Amenities">
              {amenities.map((a) => (
                <li key={a} className={styles.amenity}>
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.footer}>
          <div>
            <span className={styles.footerLabel}>Published monthly</span>
            <p className={hasRent ? styles.rent : styles.rentMuted}>
              {rent}
              {hasRent && <span className={styles.perMonth}> / month</span>}
            </p>
          </div>
          <span className={styles.viewButton} aria-hidden="true">
            View Property
          </span>
        </div>
      </div>
    </article>
  );
}
