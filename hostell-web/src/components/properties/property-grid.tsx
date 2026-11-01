import type { PublicProperty } from "@/lib/listings/types";
import { PropertyCard } from "./property-card";
import styles from "./properties.module.css";

export function PropertyGrid({ properties }: { properties: PublicProperty[] }) {
  return (
    <ul className={styles.grid}>
      {properties.map((p) => (
        <li key={p.id} className={styles.gridItem}>
          <PropertyCard property={p} />
        </li>
      ))}
    </ul>
  );
}
