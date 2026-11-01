"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { isActiveLink, PAGE_LINKS } from "./nav-links";
import styles from "./site-chrome.module.css";

function NavItems({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary" className={styles.desktopNav}>
      <ul className={styles.navList}>
        {PAGE_LINKS.map((l) => {
          const active = isActiveLink(l.href, pathname);
          return (
            <li key={l.href}>
              <Link href={l.href} className={active ? styles.navLinkActive : styles.navLink} aria-current={active ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function ActiveNavItems() {
  return <NavItems pathname={usePathname()} />;
}

/** Page links beside the logo (tablet and up); the link for the current page is underlined. */
export function DesktopNav() {
  // Reading the path can suspend on dynamic routes, so show the same links without a highlight meanwhile.
  return (
    <Suspense fallback={<NavItems pathname="" />}>
      <ActiveNavItems />
    </Suspense>
  );
}
