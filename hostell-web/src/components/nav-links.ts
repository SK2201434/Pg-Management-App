/** Site navigation shared by the header and footer. The last entry is the header's call-to-action button. */
export const NAV_LINKS = [
  { href: "/#explore", label: "Explore Properties" },
  { href: "/about", label: "About" },
  { href: "/#download", label: "Download App" },
] as const;

/** Links that sit beside the logo; the download link is rendered separately as a button. */
export const PAGE_LINKS = NAV_LINKS.slice(0, 2);

/** Whether a nav link belongs to the page being viewed. Property pages count as part of "Explore Properties". */
export function isActiveLink(href: string, pathname: string): boolean {
  if (href === "/about") return pathname === "/about";
  if (href === "/#explore") return pathname === "/" || pathname.startsWith("/properties");
  return false;
}
