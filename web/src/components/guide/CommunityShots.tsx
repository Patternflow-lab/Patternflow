"use client";

// 05 Community — the community as it really is, inside a step's card: crops
// of the live public site (community.patternflow.work, logged out), captured
// at 2x by community_shots.py into web/public/guide/community/, shown one
// after another the way FlasherShots shows the flasher's dialog. A ring marks
// the control each screen is about, and the caption's bold line is the UI's
// own words, as it writes them. Nothing here is redrawn — if the site
// changes, re-run the script rather than editing the images; the rings are
// the fractions it prints.
//
// Used by every step of the chapter (copy/community.ts, extra
// "communityShots"); `step` picks that step's screens. They step on their
// own only while that step is on stage (the store's scene and step) and the
// frame is on screen, never under the pointer or keyboard focus, and not at
// all for reduced motion. Off stage, the set goes back to its first screen.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useGuideStore, type GuideLang } from "./store";
import styles from "./CommunityShots.module.css";

/** Where the control is, as fractions of the image (community_shots.py prints these). */
type Ring = { x: number; y: number; w: number; h: number };

type Shot = {
  /** web/public/guide/community/<file>.webp — a 3:2 crop at 2x. Two shots may share one. */
  file: string;
  rings: Ring[];
  /** The UI's own words, quoted exactly (English in both languages). */
  title: string;
  en: string;
  ko: string;
  /** Which page of the site it is. */
  where: Record<GuideLang, string>;
  /** How long this screen stays up before the next one (ms). */
  ms?: number;
};

const BASE = "/guide/community/";
const STEP_MS = 3600;
const LAST_HOLD_MS = 1200;

const WALL = { en: "Patterns", ko: "Patterns" };
const PATTERN = { en: "a pattern's page", ko: "패턴 페이지" };
const DECK_BAR = { en: "the bar at the bottom", ko: "아래쪽 바" };
const DECKS = { en: "Decks", ko: "Decks" };
const DECK = { en: "a deck's page", ko: "덱 페이지" };
const LAB = { en: "Pattern Lab", ko: "Pattern Lab" };

// One list per step of the chapter, in the step's order.
const STEPS: Shot[][] = [
  // 0 — the wall
  [
    {
      file: "wall-sorts",
      rings: [{ x: 0.2456, y: 0.1964, w: 0.7172, h: 0.1082 }],
      title: "Newest · Oldest · Most liked · Most forked · In decks",
      en: "The orders the wall comes in. Oldest goes back to the very first patterns.",
      ko: "벽을 늘어놓는 순서예요. Oldest를 누르면 맨 처음 패턴부터 나와요.",
      where: WALL,
    },
    {
      file: "wall-search",
      rings: [
        { x: 0.0332, y: 0.056, w: 0.5752, h: 0.1671 },
        { x: 0.031, y: 0.2557, w: 0.4948, h: 0.0928 },
      ],
      title: "Search titles or @author",
      en: "A title, or @ and a name. @engmung is the person who made Patternflow.",
      ko: "제목으로, 또는 @와 이름으로 찾아요. @engmung은 패턴플로우를 만든 사람이에요.",
      where: WALL,
    },
    {
      file: "wall-hover",
      rings: [{ x: 0.5259, y: 0.0573, w: 0.4664, h: 0.2538 }],
      title: "scroll on a screen to turn its knobs · hover to play",
      en: "The screen is split K1 to K4, left to right. The wheel turns the knob under the pointer.",
      ko: "화면이 왼쪽부터 K1–K4로 나뉘어 있어요. 휠은 포인터 아래 노브를 돌려요.",
      where: WALL,
      ms: 4200,
    },
  ],
  // 1 — .h
  [
    {
      file: "h-badge",
      rings: [{ x: 0.5238, y: 0.0542, w: 0.0681, h: 0.0863 }],
      title: "Hardware ready — ships a .h firmware header",
      en: "The right one can go on a board. The left one is JS only: it plays here, not there.",
      ko: "오른쪽은 보드에 올라가요. 왼쪽은 JS뿐이라 여기서만 돌아요.",
      where: WALL,
    },
    {
      file: "h-filter",
      rings: [{ x: 0.6393, y: 0.1326, w: 0.2907, h: 0.096 }],
      title: ".h Flashable now",
      en: "The same wall, only the patterns that ship a .h.",
      ko: "같은 벽에서 .h가 있는 패턴만 보여줘요.",
      where: WALL,
    },
    {
      file: "h-port",
      rings: [{ x: 0.2694, y: 0.4027, w: 0.296, h: 0.1108 }],
      title: "Port this pattern (.h)",
      en: "On a pattern with no .h yet. Ran it on your own board? Propose the .h: signed in, and credited to you.",
      ko: "아직 .h가 없는 패턴에 있어요. 내 보드에서 돌려 봤다면 .h를 제안해요. 로그인해야 하고, 내 이름으로 올라가요.",
      where: PATTERN,
      ms: 4200,
    },
  ],
  // 2 — one pattern onto the board
  [
    {
      file: "p-actions",
      rings: [{ x: 0.5395, y: 0.8552, w: 0.426, h: 0.1352 }],
      title: "↗ Send to my Patternflow",
      en: "On the page of any pattern with a .h. No account needed.",
      ko: ".h가 있는 패턴 페이지마다 있어요. 계정이 필요 없어요.",
      where: PATTERN,
    },
    {
      file: "p-send-dialog",
      rings: [{ x: 0.0668, y: 0.6516, w: 0.8664, h: 0.1641 }],
      title: "Send over Wi-Fi",
      en: "Opens your board's Patterns page with this pattern linked. That page fetches it and installs it.",
      ko: "보드의 Patterns 페이지가 열리고, 그 페이지가 이 패턴을 받아서 설치해요.",
      where: PATTERN,
      ms: 4200,
    },
    {
      file: "p-send-dialog",
      rings: [{ x: 0.0668, y: 0.8097, w: 0.4352, h: 0.1641 }],
      title: "Download .zip",
      en: "Board out of reach from here, on a VPN say? Drop the .zip on the board's Patterns page, as it is — don't unzip it.",
      ko: "여기서 보드에 닿지 않으면(VPN 등) .zip을 받아 보드의 Patterns 페이지에 그대로 올려요. 압축은 풀지 않아요.",
      where: PATTERN,
      ms: 4200,
    },
  ],
  // 3 — your own deck
  [
    {
      file: "d-plus",
      rings: [{ x: 0.4834, y: 0.5399, w: 0.083, h: 0.1246 }],
      title: "Add to your deck",
      en: "The + on a card with a .h. Pressed, it turns into a −.",
      ko: ".h가 있는 카드의 +예요. 누르면 −로 바뀌어요.",
      where: WALL,
    },
    {
      file: "d-dock",
      rings: [{ x: 0.0056, y: 0.8, w: 0.5752, h: 0.1917 }],
      title: "Your deck 4 / 20",
      en: "Along the bottom of every page with patterns on it. The numbers are the order.",
      ko: "패턴이 있는 페이지마다 아래에 붙어 있어요. 숫자가 순서예요.",
      where: DECK_BAR,
    },
    {
      file: "d-drag",
      rings: [{ x: 0.3006, y: 0.8028, w: 0.0778, h: 0.1889 }],
      title: "drag to rearrange · ✕ removes",
      en: "Carry a slot sideways and the others make room. Let go on ✕ and it's out.",
      ko: "칸을 옆으로 끌면 다른 칸이 비켜 줘요. ✕ 위에서 놓으면 빠져요.",
      where: DECK_BAR,
    },
    {
      file: "d-empty",
      rings: [{ x: 0.5696, y: 0.8, w: 0.4248, h: 0.1917 }],
      title: "press ✕ again to empty all 4",
      en: "✕ pressed on its own asks first. A second press empties the deck, and there is no undo.",
      ko: "✕만 누르면 먼저 물어요. 한 번 더 누르면 덱이 비워지고, 되돌릴 수 없어요.",
      where: DECK_BAR,
    },
    {
      file: "d-dock-end",
      rings: [{ x: 0.6359, y: 0.8441, w: 0.2993, h: 0.1256 }],
      title: "Send to my board",
      en: "Builds the deck as modules for your board. Needs you signed in — and so does Share deck, beside it.",
      ko: "덱을 보드용 모듈로 빌드해요. 로그인이 필요해요. 옆의 Share deck도 마찬가지예요.",
      where: DECK_BAR,
      ms: 4200,
    },
  ],
  // 4 — other people's decks
  [
    {
      file: "k-shelf",
      rings: [{ x: 0.5317, y: 0.229, w: 0.4633, h: 0.4827 }],
      title: "Community decks",
      en: "Everyone's public decks: the first few patterns, in order, then how many more.",
      ko: "모두의 공개 덱이에요. 앞의 패턴 몇 개가 순서대로, 나머지는 개수로 보여요.",
      where: DECKS,
    },
    {
      file: "k-deck",
      rings: [{ x: 0.0268, y: 0.266, w: 0.2757, h: 0.1256 }],
      title: "Install to my board",
      en: "On a public deck. No sign-in: your board's Patterns page opens with the whole deck queued.",
      ko: "공개 덱에 있어요. 로그인 없이, 보드의 Patterns 페이지가 덱 전체를 담은 채로 열려요.",
      where: DECK,
    },
    {
      file: "k-deck",
      rings: [{ x: 0.0536, y: 0.8708, w: 0.9411, h: 0.0783 }],
      title: "A deck's .zip also carries its running order",
      en: "On the board its patterns come first — right after Origin, in the deck's order.",
      ko: "보드에선 덱의 패턴이 맨 앞, Origin 바로 다음부터 덱 순서대로 놓여요.",
      where: DECK,
    },
    {
      file: "k-copy",
      rings: [{ x: 0.0341, y: 0.1351, w: 0.4904, h: 0.1256 }],
      title: "Press again — this replaces your deck",
      en: "Copy into my deck, with a deck already in your bar: it asks before it replaces yours.",
      ko: "바에 이미 덱이 있으면, Copy into my deck은 내 덱을 바꾸기 전에 한 번 물어요.",
      where: DECK,
      ms: 4200,
    },
  ],
  // 5 — open it in the Lab
  [
    {
      file: "p-actions",
      rings: [{ x: 0.1975, y: 0.8552, w: 0.3462, h: 0.1352 }],
      title: "Open in Pattern Lab",
      en: "On every pattern's page, with a .h or without.",
      ko: "모든 패턴 페이지에 있어요. .h가 있든 없든요.",
      where: PATTERN,
    },
    {
      file: "lab-header",
      rings: [{ x: 0.3136, y: 0.0863, w: 0.2273, h: 0.0648 }],
      title: "forking from koi pond",
      en: "The copy arrives marked as a fork. If it's no longer a remix, × takes the mark off.",
      ko: "복사본에 포크 표시가 붙어서 와요. 더는 리믹스가 아니면 ×로 떼요.",
      where: LAB,
      ms: 4200,
    },
    {
      file: "lab-header",
      rings: [{ x: 0.6982, y: 0.0275, w: 0.1094, h: 0.105 }],
      title: "Share",
      en: "Publishes it to the community as your fork. Needs you signed in.",
      ko: "커뮤니티에 내 포크로 올려요. 로그인이 필요해요.",
      where: LAB,
    },
  ],
];

const NONE: Shot[] = [];

const UI = {
  en: { label: "The community, screen by screen", step: "Screen" },
  ko: { label: "커뮤니티 화면 순서", step: "화면" },
} as const;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// On the server nothing moves; the client decides after hydration.
const getReducedMotionServer = () => true;

export default function CommunityShots({ lang, step }: { lang: GuideLang; step: number }) {
  const shots = STEPS[step] ?? NONE;
  const n = shots.length;
  const ui = UI[lang];
  // Each image once, however many shots look at it.
  const files = shots.map((s) => s.file).filter((f, i, all) => all.indexOf(f) === i);

  const rootRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionServer);

  // This step on stage. Leaving it puts the set back to its first screen, so
  // a reader who comes back sees it from the start.
  const onStage = useGuideStore((s) => s.page === "make" && s.scene === "community" && s.step === step);
  const [wasOnStage, setWasOnStage] = useState(onStage);
  if (wasOnStage !== onStage) {
    setWasOnStage(onStage);
    if (!onStage) setIndex(0);
  }

  const active = n ? index % n : 0;
  const running = n > 1 && onStage && visible && !hovered && !focused && !reduced;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.35), {
      threshold: [0, 0.35],
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One timeout per screen, so a click restarts the clock on the new one.
  useEffect(() => {
    if (!running) return;
    const ms = (shots[active].ms ?? STEP_MS) + (active === n - 1 ? LAST_HOLD_MS : 0);
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % n), ms);
    return () => window.clearTimeout(t);
  }, [running, active, n, shots]);

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }, []);

  if (!n) return null;
  const on = shots[active];

  return (
    <figure
      ref={rootRef}
      className={styles.shots}
      aria-label={ui.label}
      data-extra="communityShots"
      data-reduced={reduced ? "1" : "0"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <div className={styles.frame}>
        {files.map((file) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={file}
            src={`${BASE}${file}.webp`}
            alt={file === on.file ? on.title : ""}
            aria-hidden={file === on.file ? undefined : true}
            loading="lazy"
            decoding="async"
            draggable={false}
            className={styles.shot}
            data-on={file === on.file ? "1" : "0"}
          />
        ))}
        {on.rings.map((r, i) => (
          <span
            // The same page keeps its ring, which glides to the next control;
            // a new page gets a new one.
            key={`${on.file}:${i}`}
            className={styles.ring}
            aria-hidden="true"
            style={{
              left: `${r.x * 100}%`,
              top: `${r.y * 100}%`,
              width: `${r.w * 100}%`,
              height: `${r.h * 100}%`,
            }}
          />
        ))}
      </div>

      <figcaption className={styles.caption}>
        <div className={styles.dots} role="group" aria-label={ui.label}>
          {shots.map((s, i) => (
            <button
              key={`${s.file}:${i}`}
              type="button"
              className={styles.dot}
              data-on={i === active ? "1" : "0"}
              data-done={i < active ? "1" : "0"}
              aria-label={`${ui.step} ${i + 1}: ${s.title}`}
              aria-current={i === active ? "step" : undefined}
              onClick={() => setIndex(i)}
            >
              <span>{i + 1}</span>
            </button>
          ))}
          <span className={styles.where}>{on.where[lang]}</span>
        </div>
        {/* Every caption in one grid cell: the block is as tall as the longest. */}
        <div className={styles.texts} aria-live={running ? "off" : "polite"}>
          {shots.map((s, i) => (
            <p key={`${s.file}:${i}`} className={styles.text} data-on={i === active ? "1" : "0"} aria-hidden={i === active ? undefined : true}>
              <b>{s.title}</b>
              <span>{s[lang]}</span>
            </p>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
