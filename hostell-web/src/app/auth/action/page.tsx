import type { Metadata } from "next";
import { Suspense } from "react";

import { EmailAction } from "@/components/auth/email-action";
import { readActionParams } from "@/lib/auth/email-action";

export const metadata: Metadata = {
  title: "Confirm your HOSTELL account",
  robots: { index: false, follow: false },
  // The URL carries a single-use code; keep it out of Referer headers sent to other sites.
  referrer: "no-referrer",
};

type Query = Promise<Record<string, string | string[] | undefined>>;

// Reading searchParams is request-time data, so it sits inside Suspense and the page shell prerenders.
async function ActionFromQuery({ searchParams }: { searchParams: Query }) {
  return <EmailAction params={readActionParams(await searchParams)} />;
}

export default function AuthActionPage({ searchParams }: { searchParams: Query }) {
  return (
    <div style={{ background: "#f5f4ef", padding: "var(--space-12) var(--gutter)" }}>
      <Suspense fallback={null}>
        <ActionFromQuery searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
