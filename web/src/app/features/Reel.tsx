import styles from "./Features.module.css";
import type { Reel as ReelData } from "./features-data";

// An Instagram post, embedded by its permalink.
//
// Instagram serves a self-contained page at <permalink>embed/ that needs no
// script of theirs on this site, which keeps the page static and keeps their
// JavaScript out of it. The frame is lazy, so nothing is fetched from
// Instagram until the reel scrolls into view — and the permalink under it is
// the way out when an embed is blocked, or when a phone would rather open
// the app.
//
// The frame's title carries the feature's name. Seven frames all called
// "Reel on Instagram" are one name seven times in a screen reader's list.
export default function Reel({ reel, feature }: { reel: ReelData; feature: string }) {
  return (
    <figure className={styles.reel}>
      <iframe
        className={styles.reelFrame}
        src={`${reel.url}embed/`}
        title={`${feature}: reel on Instagram`}
        loading="lazy"
        allow="encrypted-media; picture-in-picture"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <figcaption className={styles.reelCap}>
        {reel.caption}{" "}
        <a href={reel.url} target="_blank" rel="noopener">
          Open on Instagram
        </a>
      </figcaption>
    </figure>
  );
}
