"use client";

import type { GuideLang } from "../store";
import { beatsFor } from "./script";
import { focusDesk, useDeskStore } from "./deskStore";
import { DESK_WORDS } from "./words";
import styles from "./Desk.module.css";

// A line in a make-page step's card, under a step with a tutorial: where the
// pointer is ("Follow the pointer", its hint while it waits for the reader,
// "Done"), a "Show me again" button, and — for the keyboard — a way into the
// window the pointer is working in (deskStore focusDesk). Only on a screen with the desk (Desk.module.css hides it
// elsewhere, so a card doesn't jump when the desk comes up); a step without
// a tutorial has none.

export default function DeskCue({ scene, index, lang }: { scene: string; index: number; lang: GuideLang }) {
  const key = `${scene}.${index}`;
  const run = useDeskStore((s) => (s.run && s.run.key === key ? s.run : null));
  if (beatsFor(scene, index).length === 0) return null;
  const words = DESK_WORDS[lang];
  const status = !run ? words.watch : run.done ? words.done : run.waiting ? (run.say ?? words.yourTurn) : words.watch;
  return (
    <div className={styles.cue} data-state={run?.done ? "done" : run?.waiting ? "waiting" : "watch"}>
      <span className={styles.cueDot} aria-hidden="true" />
      <span className={styles.cueText} aria-live="polite">
        {status}
      </span>
      <button type="button" className={styles.cueAgain} onClick={() => useDeskStore.getState().askReplay(key)}>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M12.7 6.3A5 5 0 1 0 13 9.6M13 2.9v3.6H9.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        {words.again}
      </button>
      <button type="button" className={styles.cueJump} onClick={focusDesk}>
        {words.toWindow}
      </button>
    </div>
  );
}
