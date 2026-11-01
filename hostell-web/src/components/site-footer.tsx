import Image from "next/image";
import Link from "next/link";

import { getAppDownloadUrl } from "@/lib/app-download";
import { NAV_LINKS } from "./nav-links";
import styles from "./site-chrome.module.css";

export function SiteFooter() {
  const downloadUrl = getAppDownloadUrl();
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerBrand}>
          <Image src="/hostell-logo.png" alt="HOSTELL" width={640} height={157} className={styles.logoSmall} />
          <p className={styles.footerText}>Hostellers helping hostellers, one better stay at a time.</p>
        </div>
        <nav aria-label="Footer">
          <ul className={styles.footerLinks}>
            {NAV_LINKS.slice(0, 2).map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={styles.footerLink}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              {downloadUrl ? (
                <a href={downloadUrl} className={styles.footerLink} target="_blank" rel="noopener noreferrer">
                  Download the app<span className={styles.srOnly}> (opens in a new tab)</span>
                </a>
              ) : (
                <span className={styles.footerSoon}>App coming soon</span>
              )}
            </li>
          </ul>
        </nav>
      </div>
      <div className="container">
        <p className={styles.footerBase}>© HOSTELL. All rights reserved.</p>
      </div>
    </footer>
  );
}
