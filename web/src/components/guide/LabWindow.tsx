"use client";

import { useSyncExternalStore } from "react";
import type { GuideLang } from "./store";
import styles from "./LabWindow.module.css";

// Make · 02 Pattern Lab, "Open the Lab." — where the make page has no desk (a phone,
// a small window: desk/query.ts), the card shows the Lab as it opens (a real
// capture, public/guide/lab-window/lab.webp, scratchpad lab_poster.py) in a
// small browser window, and the whole of it opens the real Pattern Lab in a
// tab of its own. With the desk, the Lab is on it, beside the card, and this
// is hidden (Extras.tsx .offDesk).
//
// Used by a step whose copy has extra: "labWindow" (copy/lab.ts step 0).

const LAB_PATH = "/pattern-lab";
const POSTER = "/guide/lab-window/lab.webp";
/** The poster's size: the Lab as it lays out at 1024 CSS px. */
const LAB_W = 1024;
const LAB_H = 680;

type Words = {
  open: string;
  phoneOpen: string;
};

export const LAB_WINDOW_WORDS: Record<GuideLang, Words> = {
  en: { open: "Open", phoneOpen: "Open Pattern Lab" },
  ko: { open: "열기", phoneOpen: "패턴 랩 열기" },
};

const noop = () => () => {};
const pageHost = () => window.location.host;

function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9 3h4v4M13 3L8.5 7.5M7 3.5H3.5v9h9V9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function LabWindow({ lang, step }: { lang: GuideLang; step: number }) {
  const host = useSyncExternalStore(noop, pageHost, () => "patternflow.work");
  const words = LAB_WINDOW_WORDS[lang];
  return (
    <div className={styles.root} data-extra="labWindow" data-step-index={step}>
      <a className={styles.opener} href={LAB_PATH} target="_blank" rel="noopener" aria-label={`${words.phoneOpen} (${host}${LAB_PATH})`}>
        <span className={styles.miniWindow}>
          <span className={styles.miniBar}>
            <span className={styles.lights} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className={styles.address}>
              <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.lock}>
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              <span className={styles.url}>
                {host}
                <span className={styles.path}>{LAB_PATH}</span>
              </span>
            </span>
            <span className={styles.chip} aria-hidden="true">
              {words.open}
              <OpenIcon />
            </span>
          </span>
          <span className={styles.mini}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a real capture of the lab, shown as is */}
            <img className={styles.poster} src={POSTER} alt="" width={LAB_W} height={LAB_H} loading="lazy" decoding="async" />
          </span>
        </span>
      </a>
    </div>
  );
}
