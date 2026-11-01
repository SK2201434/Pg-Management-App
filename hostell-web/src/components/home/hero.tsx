import Image from "next/image";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { HeroSearch } from "./hero-search";
import styles from "./home.module.css";

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.glows} aria-hidden="true">
        <div className={styles.glowA} />
        <div className={styles.glowB} />
      </div>
      <div className={`container ${styles.heroInner}`}>
        <p className={styles.pill}>
          <span className={styles.pillDot} aria-hidden="true" />
          Hostels &amp; PG accommodation
        </p>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <h1 id="hero-heading" className={styles.heroTitle}>
              Find a place that <span className={styles.heroAccent}>feels right.</span>
            </h1>
            <p className={styles.heroLead}>
              Explore hostels and PGs. Discover the spaces and details that make a stay feel like home, with sharing options and rent
              at a glance.
            </p>
            <div className={styles.heroActions}>
              <Link href="/#explore" className={styles.primaryCta}>
                Explore Properties
                <Icon name="arrow" />
              </Link>
              <Link href="/#download" className={styles.secondaryCta}>
                <Icon name="download" size={19} />
                Get the HOSTELL App
              </Link>
            </div>
          </div>
          <div className={styles.heroVisualWrap}>
            <div className={styles.heroVisual}>
              <Image
                src="/HomepageFindAPlaceright.png"
                alt="A bright, tidy hostel room with a single bed, a study desk and a sunny window"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className={styles.heroPhoto}
                preload
              />
            </div>
            <div className={styles.priceCard}>
              <span className={styles.priceDot} aria-hidden="true" />
              <div className={styles.priceInfo}>
                <p className={styles.priceName}>Ayyappa Society 4th Block</p>
                <p className={styles.priceSub}>Single &amp; shared rooms</p>
              </div>
              <span className={styles.priceTag}>₹14,500/mo</span>
            </div>
            <div className={styles.amenityCard}>
              <span className={styles.amenityIcon} aria-hidden="true">
                <Icon name="verified" size={20} />
              </span>
              <div>
                <p className={styles.amenityTitle}>Genuine reviews</p>
                <p className={styles.amenitySub}>Honest feedback from tenants</p>
              </div>
            </div>
          </div>
        </div>
        <HeroSearch />
      </div>
    </section>
  );
}
