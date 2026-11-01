import Image from "next/image";
import Link from "next/link";

import { DesktopNav } from "./desktop-nav";
import { Icon } from "./icons";
import { MobileNav } from "./mobile-nav";
import { NAV_LINKS } from "./nav-links";
import styles from "./site-chrome.module.css";

const DOWNLOAD_LINK = NAV_LINKS[NAV_LINKS.length - 1];

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <div className={styles.left}>
          <Link href="/" className={styles.brand}>
            <Image src="/hostell-logo.png" alt="HOSTELL home" width={640} height={157} className={styles.logo} preload />
          </Link>
          <DesktopNav />
        </div>
        <div className={styles.right}>
          <div className={styles.desktopNav}>
            <Link href={DOWNLOAD_LINK.href} className={styles.navCta}>
              <Icon name="download" />
              {DOWNLOAD_LINK.label}
            </Link>
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
