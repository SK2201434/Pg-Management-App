import { Icon, type IconName } from "@/components/icons";
import { DownloadCta } from "./download-cta";
import styles from "./home.module.css";

const FEATURES: { icon: IconName; title: string; copy: string }[] = [
  { icon: "chat", title: "Direct Owner Chat", copy: "Talk to your property owner directly." },
  { icon: "tool", title: "Ticket Tracking", copy: "Raise and follow maintenance requests." },
  { icon: "receipt", title: "Digital Receipts", copy: "Clear, auditable rent records." },
];

/** Decorative phone with placeholder content; not a screenshot of the app. */
function PhoneMockup() {
  return (
    <div className={styles.phone} aria-hidden="true">
      <div className={styles.phoneNotch} />
      <div className={styles.phoneScreen}>
        <div className={styles.phoneTop}>
          <span className={styles.phoneAvatar}>H</span>
          <span className={styles.phoneTitle}>My Stay</span>
        </div>
        <div className={styles.phoneCard}>
          <span className={styles.phoneKicker}>House notice</span>
          <p>Community terrace open this weekend</p>
        </div>
        <div className={styles.phoneCard}>
          <div className={styles.phoneRow}>
            <span className={styles.phoneKicker}>Request</span>
            <span className={styles.phoneBadge}>Resolved</span>
          </div>
          <p>Wi-Fi router checkup</p>
        </div>
        <div className={styles.phoneChat}>
          <span className={styles.bubbleIn}>Your parcel has arrived at reception.</span>
          <span className={styles.bubbleOut}>Thanks, picking it up shortly.</span>
        </div>
      </div>
    </div>
  );
}

export function AppPromoSection({ downloadUrl }: { downloadUrl: string | null }) {
  return (
    <section id="download" className={styles.app} aria-labelledby="download-heading">
      <div className="container">
        <div className={styles.appPanel}>
          <div className={styles.appGlow} aria-hidden="true" />
          <div className={styles.appCopyCol}>
            <p className={styles.appPill}>
              <span className={styles.appPillDot} aria-hidden="true" />
              HOSTELL mobile app
            </p>
            <h2 id="download-heading" className={styles.appTitle}>
              More than finding a place. A better way to manage your stay.
            </h2>
            <p className={styles.appCopy}>
              Discover accommodation on the website. Use the HOSTELL app for owner property-management tools and resident stay
              features, from rent to maintenance requests.
            </p>
            <DownloadCta url={downloadUrl} />
            <ul className={styles.features}>
              {FEATURES.map((f) => (
                <li key={f.title}>
                  <span className={styles.featureIcon}>
                    <Icon name={f.icon} size={20} />
                  </span>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureCopy}>{f.copy}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.phoneWrap}>
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
