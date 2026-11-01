import type { Metadata } from "next";

import { AboutPage } from "@/components/about/about-page";
import { getAppDownloadUrl } from "@/lib/app-download";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About us",
  description:
    "HOSTELL is built on a simple belief: hostellers helping hostellers. Learn how we help people discover hostels and PGs and give owners tools to manage them.",
  path: "/about",
});

export default function About() {
  return <AboutPage downloadUrl={getAppDownloadUrl()} />;
}
