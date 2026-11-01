import Image from "next/image";
import Link from "next/link";

import { DownloadCta } from "@/components/home/download-cta";
import { Icon, type IconName } from "@/components/icons";
import styles from "./about.module.css";

type Point = { icon: IconName; title: string; copy: string };

const STATUS_QUO: Point[] = [
  { icon: "close", title: "Photos that don’t tell the whole story", copy: "Wide-angle shots make small rooms look big and hide the things you only notice after moving in." },
  { icon: "close", title: "Calls you didn’t ask for", copy: "Share your number once and it can be passed around, leading to follow-up calls you never wanted." },
  { icon: "close", title: "Pressure to pay before you’re sure", copy: "Token advances are often requested before you’ve seen the terms or spoken to anyone who lives there." },
  { icon: "close", title: "Little visibility into daily life", copy: "Food, Wi-Fi, water and noise are hard to judge from a listing alone." },
];

const HOSTELL_WAY: Point[] = [
  { icon: "verified", title: "Clear details up front", copy: "See where a property is, what sharing options it offers and roughly what it costs before you do anything else." },
  { icon: "shield", title: "Browse without handing over your number", copy: "No account or phone number is needed to look around. Owner contact details are kept off the public site." },
  { icon: "book", title: "Learn from people who stayed", copy: "We’re building a place for residents to share honest experiences, so new joiners can decide with more context." },
  { icon: "chat", title: "Everyday tools in the app", copy: "Once you’ve found a place, the HOSTELL app helps residents and owners manage the stay." },
];

const PILLARS: { icon: IconName; title: string; copy: string; foot: string; footIcon: IconName }[] = [
  {
    icon: "search",
    title: "Open property discovery",
    copy: "Anyone can browse listings on the web without signing in or handing over a phone number. Finding a place to stay shouldn’t sit behind a wall.",
    foot: "No sign-in needed to browse",
    footIcon: "unlock",
  },
  {
    icon: "people",
    title: "Hostellers helping hostellers",
    copy: "Over time, we want people who have lived in a hostel to be able to share what it was really like, from food and Wi-Fi to noise and community.",
    foot: "Built on real stays",
    footIcon: "chat",
  },
  {
    icon: "lock",
    title: "Privacy and spam-free connection",
    copy: "Owner contact details aren’t published on this site. When you’re ready to get in touch, you do it through the HOSTELL app.",
    foot: "Contact details stay private",
    footIcon: "shield",
  },
];

const WEB_POINTS: Point[] = [
  { icon: "image", title: "Photos of each property", copy: "Browse photo galleries for every listed hostel and PG." },
  { icon: "receipt", title: "Published rent and sharing options", copy: "See the rent range and the room types on offer at a glance." },
  { icon: "pin", title: "Search by city or state", copy: "Narrow the list to the place you’re moving to." },
];

const HOSTELLER_FEATURES = ["Rent and payment records", "Requests to the property owner", "Reviews of places you’ve stayed", "Move-out and stay changes"];
const OWNER_FEATURES = ["Property and room management", "Tenant records and rent tracking", "Incoming stay requests", "Notifications"];

function PointList({ points, tone }: { points: Point[]; tone: "bad" | "good" }) {
  return (
    <ul className={styles.points}>
      {points.map((p) => (
        <li key={p.title} className={styles.point}>
          <span className={tone === "bad" ? styles.pointIconBad : styles.pointIconGood}>
            <Icon name={p.icon} size={20} />
          </span>
          <div>
            <strong className={styles.pointTitle}>{p.title}</strong>
            <span className={styles.pointCopy}>{p.copy}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AboutPage({ downloadUrl }: { downloadUrl: string | null }) {
  return (
    <>
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroCopy}>
            <p className={styles.pill}>
              <span className={styles.pillDot} aria-hidden="true" />
              About our mission
            </p>
            <h1 id="about-title" className={styles.heroTitle}>
              Built around the people who call a hostel home.
            </h1>
            <p className={styles.lead}>
              HOSTELL is built on a simple belief: hostellers helping hostellers. We want to make it easier to discover accommodation
              and, over time, learn from honest experiences shared by people who have actually stayed in those places. Our aim is to
              help new joiners make more informed decisions while giving property owners useful tools to manage their properties
              through the HOSTELL app.
            </p>
            <div className={styles.heroActions}>
              <Link href="/#explore" className={styles.primaryCta}>
                Explore Properties
                <Icon name="arrow" />
              </Link>
              <span className={styles.note}>
                <Icon name="unlock" size={20} />
                No sign-up needed to browse
              </span>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <div className={styles.heroImage}>
              <Image
                src="/AboutPageTenants.png"
                alt="Friends laughing together in a shared hostel room"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className={styles.photo}
                preload
              />
              <div className={styles.heroCaption}>
                <div>
                  <p className={styles.captionTitle}>Shared living, honestly told</p>
                  <p className={styles.captionCopy}>Hostellers helping hostellers</p>
                </div>
                <Icon name="chat" size={24} />
              </div>
            </div>
            <div className={styles.floatCard}>
              <p className={styles.floatTitle}>
                <Icon name="people" size={16} />
                Peer-driven
              </p>
              <p>Peer transparency over commercial hype.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.band} aria-labelledby="reality-heading">
        <div className="container">
          <div className={styles.sectionHead}>
            <p className={styles.tag}>The current reality</p>
            <h2 id="reality-heading" className={styles.h2}>
              The reality of finding a place to stay
            </h2>
            <p className={styles.sectionLead}>
              Choosing accommodation is often stressful: photos that hide the details that matter, unwanted calls, and commitments
              made before you really know the place.
            </p>
          </div>
          <div className={styles.compare}>
            <div className={styles.compareCard}>
              <div className={styles.compareHead}>
                <span className={styles.compareTitle}>The Generic Way</span>
                <span className={styles.compareBadgeBad}>Common friction</span>
              </div>
              <PointList points={STATUS_QUO} tone="bad" />
            </div>
            <div className={`${styles.compareCard} ${styles.compareGood}`}>
              <div className={`${styles.compareHead} ${styles.compareHeadGood}`}>
                <span className={styles.compareTitleGood}>The HOSTELL Way</span>
                <span className={styles.compareBadgeGood}>Resident first</span>
              </div>
              <PointList points={HOSTELL_WAY} tone="good" />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pillars-heading">
        <div className="container">
          <div className={styles.pillarsHead}>
            <div>
              <p className={styles.eyebrow}>What we stand for</p>
              <h2 id="pillars-heading" className={styles.h2}>
                The three pillars of HOSTELL
              </h2>
            </div>
            <p className={styles.sectionLeadNarrow}>Designed to remove the hurdles of discovery without turning shared living into a commodity.</p>
          </div>
          <ul className={styles.pillars}>
            {PILLARS.map((p, i) => (
              <li key={p.title} className={styles.pillar}>
                <div className={styles.pillarBody}>
                  <span className={i === 1 ? styles.pillarIconAlt : styles.pillarIcon}>
                    <Icon name={p.icon} size={28} />
                  </span>
                  <span className={styles.pillarNo}>Pillar 0{i + 1}</span>
                  <h3 className={styles.h3}>{p.title}</h3>
                  <p className={styles.pillarCopy}>{p.copy}</p>
                </div>
                <p className={styles.pillarFoot}>
                  <Icon name={p.footIcon} size={18} />
                  {p.foot}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.band} aria-labelledby="ecosystem-heading">
        <div className="container">
          <div className={`${styles.sectionHead} ${styles.centered}`}>
            <p className={styles.eyebrow}>One product, two journeys</p>
            <h2 id="ecosystem-heading" className={styles.h2}>
              The website and the app
            </h2>
            <p className={styles.sectionLead}>Explore freely on the web when you’re searching, and use the app to manage the stay once you’ve found a place.</p>
          </div>
          <div className={styles.ecosystem}>
            <div className={styles.ecoCard}>
              <div>
                <div className={styles.ecoHead}>
                  <span className={styles.ecoIcon}>
                    <Icon name="laptop" size={24} />
                  </span>
                  <div>
                    <p className={styles.eyebrowMuted}>Exploration</p>
                    <h3 className={styles.h3}>On the web: discover</h3>
                  </div>
                </div>
                <p className={styles.ecoCopy}>Designed for taking your time to look around, with no sign-up prompts getting in the way.</p>
                <ul className={styles.ecoList}>
                  {WEB_POINTS.map((p) => (
                    <li key={p.title} className={styles.ecoItem}>
                      <span className={styles.ecoItemIcon}>
                        <Icon name={p.icon} size={22} />
                      </span>
                      <div>
                        <h4 className={styles.h4}>{p.title}</h4>
                        <p>{p.copy}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/#explore" className={styles.textLink}>
                Open the property directory
                <Icon name="arrow" size={16} />
              </Link>
            </div>

            <div className={styles.ecoCard}>
              <div>
                <div className={styles.ecoHead}>
                  <span className={styles.ecoIconAlt}>
                    <Icon name="phone" size={24} />
                  </span>
                  <div>
                    <p className={styles.eyebrow}>Active residence</p>
                    <h3 className={styles.h3}>In the app: manage</h3>
                  </div>
                </div>
                <p className={styles.ecoCopy}>For residents and owners once a stay begins, so everyday routines are easier to handle from a phone.</p>
                <div className={styles.audiences}>
                  <div className={styles.audience}>
                    <p className={styles.audienceTitle}>For hostellers</p>
                    <ul>
                      {HOSTELLER_FEATURES.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className={`${styles.audience} ${styles.audienceOwner}`}>
                    <p className={styles.audienceTitleOwner}>For property owners</p>
                    <ul>
                      {OWNER_FEATURES.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <Link href="#download" className={styles.textLink}>
                Get the mobile app
                <Icon name="arrow" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="download" className={styles.section} aria-labelledby="final-heading">
        <div className="container">
          <div className={styles.final}>
            <div className={styles.finalGlow} aria-hidden="true" />
            <div className={styles.finalCopy}>
              <h2 id="final-heading" className={styles.finalTitle}>
                Ready to discover your next stay?
              </h2>
              <p>Browse properties on the web without barriers, then use the HOSTELL app when you’re ready to take the next step.</p>
              <div className={styles.finalActions}>
                <DownloadCta url={downloadUrl} onDark />
                <Link href="/#explore" className={styles.ghostCta}>
                  Explore properties on the web
                  <Icon name="arrow" size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
