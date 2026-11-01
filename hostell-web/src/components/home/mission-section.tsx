import Image from "next/image";

import { Icon, type IconName } from "@/components/icons";
import styles from "./home.module.css";

const PILLARS: { icon: IconName; title: string; copy: string }[] = [
  {
    icon: "eye",
    title: "1. Discover places to stay",
    copy: "See where a property is, what sharing options it offers and roughly what it costs, all in one place.",
  },
  {
    icon: "chat",
    title: "2. Learn from real resident experiences",
    copy: "The people who have lived somewhere can offer perspectives that a property listing alone cannot.",
  },
  {
    icon: "people",
    title: "3. Help future hostellers make informed choices",
    copy: "A supportive community for students and young professionals, sharing what they learned so the next move is easier.",
  },
];

export function MissionSection() {
  return (
    <section id="about" className={styles.mission} aria-labelledby="about-heading">
      <div className="container">
        <div className={styles.missionHead}>
          <p className={styles.tag}>Community mission</p>
          <h2 id="about-heading" className={styles.sectionTitle}>
            Hostellers helping hostellers.
          </h2>
          <p className={styles.sectionLead}>
            Finding a hostel or PG can mean scattered listings and a lot of guesswork. HOSTELL is being built to make that decision
            more informed by bringing accommodation discovery and genuine resident experiences together.
          </p>
        </div>
        <div className={styles.missionGrid}>
          <figure className={styles.missionCard}>
            <div className={styles.missionImage}>
              <Image
                src="/homepage_hostel_dining.jpg"
                alt="Hostellers sharing a meal together in a hostel dining area"
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                className={styles.missionPhoto}
              />
              <figcaption className={styles.missionCaption}>
                <span className={styles.missionBadge}>Community mission</span>
                <p className={styles.missionQuote}>Real hostellers. Real experiences. Better stays.</p>
                <p className={styles.missionBy}>The HOSTELL community</p>
              </figcaption>
            </div>
            <div className={styles.missionFoot}>
              <p className={styles.missionFootTitle}>
                <Icon name="thumbsUp" size={20} />
                Genuine resident reviews
              </p>
              <p className={styles.missionNote}>
                We’re building it for people who know what it’s like to look for a room away from home: clear details first, so it’s
                easier to find somewhere that suits you.
              </p>
            </div>
          </figure>
          <ul className={styles.pillars}>
            {PILLARS.map((p) => (
              <li key={p.title} className={styles.pillar}>
                <span className={styles.pillarIcon}>
                  <Icon name={p.icon} size={24} />
                </span>
                <div>
                  <h3 className={styles.pillarTitle}>{p.title}</h3>
                  <p className={styles.pillarCopy}>{p.copy}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
