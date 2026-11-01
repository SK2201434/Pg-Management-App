"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useId, useState } from "react";

import { Icon } from "./icons";
import { isActiveLink, NAV_LINKS } from "./nav-links";
import styles from "./site-chrome.module.css";

type LinksProps = { pathname: string; onNavigate: () => void };

function MenuLinks({ pathname, onNavigate }: LinksProps) {
  return (
    <ul className={styles.menuList}>
      {NAV_LINKS.map((l, i) => {
        const active = isActiveLink(l.href, pathname);
        // The last link is the download call to action, styled like the desktop button.
        if (i === NAV_LINKS.length - 1) {
          return (
            <li key={l.href} className={styles.menuCtaItem}>
              <Link href={l.href} className={`${styles.menuLink} ${styles.menuCta}`} onClick={onNavigate}>
                <Icon name="download" />
                {l.label}
              </Link>
            </li>
          );
        }
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              className={active ? `${styles.menuLink} ${styles.menuLinkActive}` : styles.menuLink}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ActiveMenuLinks({ onNavigate }: { onNavigate: () => void }) {
  return <MenuLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

/** Menu button and dropdown shown below the tablet breakpoint. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={styles.mobileOnly}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name={open ? "close" : "menu"} size={22} />
      </button>
      <nav id={menuId} aria-label="Primary" className={styles.menu} hidden={!open}>
        <Suspense fallback={<MenuLinks pathname="" onNavigate={close} />}>
          <ActiveMenuLinks onNavigate={close} />
        </Suspense>
      </nav>
    </div>
  );
}
