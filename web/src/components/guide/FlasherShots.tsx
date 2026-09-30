"use client";

// The web flasher as it really looks: ESP Web Tools 10.4.0's own install
// dialog, captured screen by screen (web/public/guide/flasher/*.webp) with
// this site's manifest and the answers the Patternflow firmware really gives
// over Improv (firmware "Patternflow", version "3.10.4", ESP32-S3, an empty
// network scan). Nothing here is redrawn — if the library or the manifest
// changes, re-shoot the images rather than editing them.
//
// One screen at a time, stepping on its own only while it is on screen, never
// under the pointer or keyboard focus, and not at all for reduced motion.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useGuideStore, type GuideLang } from "./store";
import styles from "./FlasherShots.module.css";

export type FlasherSet = "install" | "wifi" | "dashboard";

type Shot = {
  /** File in /guide/flasher/, captured at 2x. */
  src: string;
  /** The dialog's size in CSS px (half the image). */
  w: number;
  h: number;
  /** The dialog's own wording, quoted as it appears (English in both languages). */
  title: string;
  en: string;
  ko: string;
  /** How long this screen stays up before the next one (ms). */
  ms?: number;
};

const BASE = "/guide/flasher/";
const STEP_MS = 2400;
const LAST_HOLD_MS = 1200;

const CONNECTED: Shot = {
  src: "wifi-connected.webp",
  w: 280,
  h: 276,
  title: "Device connected to the network!",
  en: "Visit Device opens the panel's console at its new address.",
  ko: "Visit Device를 누르면 패널의 새 주소로 콘솔이 열려요.",
};

const SETS: Record<FlasherSet, Shot[]> = {
  install: [
    {
      src: "install-dashboard.webp",
      w: 280,
      h: 216,
      title: "Install Patternflow",
      en: "After you pick the port, the dialog opens here. Choose Install Patternflow.",
      ko: "포트를 고르면 이 창이 떠요. Install Patternflow를 누르세요.",
    },
    {
      src: "install-confirm.webp",
      w: 314,
      h: 228,
      title: "Confirm Installation",
      en: "A new install wipes the board first. Press Install.",
      ko: "새로 설치할 땐 보드를 먼저 싹 지워요. Install을 누르세요.",
      ms: 2800,
    },
    {
      src: "install-erasing.webp",
      w: 280,
      h: 188,
      title: "Erasing",
      en: "Clearing the whole flash. It can sit here a while.",
      ko: "플래시 전체를 지우는 중이에요. 여기서 좀 머물 수 있어요.",
    },
    {
      src: "install-writing.webp",
      w: 320,
      h: 248,
      title: "Installing",
      en: "Writing, with a percentage. Keep this tab in front.",
      ko: "퍼센트가 올라가요. 이 탭을 앞에 띄워 두세요.",
      ms: 2800,
    },
    {
      src: "install-wrapping.webp",
      w: 320,
      h: 248,
      title: "Wrapping up",
      en: "The new firmware boots and answers. Up to 20 seconds.",
      ko: "새 펌웨어가 부팅해서 대답하길 기다려요. 20초까지 걸려요.",
    },
    {
      src: "install-complete.webp",
      w: 280,
      h: 212,
      title: "Installation complete!",
      en: "Next takes you straight to Wi-Fi.",
      ko: "Next를 누르면 바로 와이파이 설정으로 넘어가요.",
    },
  ],
  wifi: [
    {
      src: "wifi-scanning.webp",
      w: 280,
      h: 188,
      title: "Scanning for networks",
      en: "Patternflow doesn't send a network list, so this spins about ten seconds.",
      ko: "Patternflow는 주변 네트워크 목록을 보내지 않아서 10초쯤 돌아요.",
      ms: 2800,
    },
    {
      src: "wifi-form.webp",
      w: 368,
      h: 404,
      title: "Configure Wi-Fi",
      en: "Leave Join other…, type the network name exactly (2.4 GHz only), the password, then Connect.",
      ko: "Join other…는 그대로 두고, 네트워크 이름을 정확히(2.4 GHz만 돼요) 적고 비밀번호를 넣은 뒤 Connect.",
      ms: 3600,
    },
    {
      src: "wifi-connecting.webp",
      w: 280,
      h: 188,
      title: "Trying to connect",
      en: "The panel gives the network up to 30 seconds.",
      ko: "패널이 최대 30초 동안 접속을 시도해요.",
    },
    CONNECTED,
  ],
  dashboard: [
    {
      src: "dashboard.webp",
      w: 280,
      h: 344,
      title: "Connect to Wi-Fi",
      en: "Some boards don't restart into Patternflow on their own after flashing. Press RST, then Flash Patternflow and the port again, and choose Connect to Wi-Fi.",
      ko: "굽고 나서 패턴플로우로 스스로 재시작하지 않는 보드가 있어요. RST를 한 번 누르고 Flash Patternflow를 다시 눌러 포트를 고른 뒤 Connect to Wi-Fi를 골라요.",
      ms: 3600,
    },
    {
      src: "dashboard-wifi-form.webp",
      w: 368,
      h: 404,
      title: "Configure Wi-Fi",
      en: "The same form. Here the left button reads Back instead of Skip.",
      ko: "같은 입력 칸이에요. 여기선 왼쪽 버튼이 Skip 대신 Back이에요.",
      ms: 3200,
    },
    CONNECTED,
  ],
};

const UI = {
  en: { label: "ESP Web Tools, screen by screen", step: "Screen", sets: "Which flasher screens" },
  ko: { label: "ESP Web Tools 화면 순서", step: "화면", sets: "플래셔 화면 고르기" },
} as const;

// A viewer can hold more than one sequence (the Wi-Fi card: straight after
// the install, and after RST), picked with a pair of tabs above the frame.
const SET_LABEL: Record<FlasherSet, Record<GuideLang, string>> = {
  install: { en: "Install", ko: "설치" },
  wifi: { en: "After the install", ko: "설치 다음" },
  dashboard: { en: "No Wi-Fi step?", ko: "와이파이 단계가 없었다면" },
};

// Space around the dialog inside the frame, in the dialog's CSS px.
const PAD = 14;
const MAX_VH = 33;
// On a phone the card sits under the stage and has to leave it room: the
// screens are pictures, the captions under them carry the words.
const MAX_VH_NARROW = 27;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// On the server nothing moves; the client decides after hydration.
const getReducedMotionServer = () => true;

export default function FlasherShots({
  set,
  lang,
  waitForKit = false,
}: {
  set: FlasherSet | FlasherSet[];
  lang: GuideLang;
  /**
   * Hold the first screen until the DevKit on stage is held up in front of
   * the reader: arriving from far away (scrolling back up), it is still on
   * its way, and the screens would run ahead of the board they are about.
   */
  waitForKit?: boolean;
}) {
  const sets = Array.isArray(set) ? set : [set];
  const [which, setWhich] = useState(0);
  const current = sets[Math.min(which, sets.length - 1)];
  const shots = SETS[current];
  const n = shots.length;
  const ui = UI[lang];
  // Every screen of every sequence, once each (the success screen is shared),
  // so switching tabs shows images that are already decoded.
  const every = sets.flatMap((k) => SETS[k]).filter((s, i, all) => all.findIndex((o) => o.src === s.src) === i);

  const rootRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionServer);

  const active = index % n;
  const kitHere = useGuideStore((s) => s.kitPresented);
  const running = visible && !hovered && !focused && !reduced && (!waitForKit || kitHere);

  // Tell the stage which screen is up while this viewer is on screen.
  const setKey = sets.join(",");
  useEffect(() => {
    const store = useGuideStore.getState();
    if (visible) store.setFlasher({ set: current, index: active });
    else if (store.flasher && setKey.split(",").includes(store.flasher.set)) store.setFlasher(null);
  }, [visible, current, active, setKey]);
  useEffect(
    () => () => {
      const store = useGuideStore.getState();
      if (store.flasher && setKey.split(",").includes(store.flasher.set)) store.setFlasher(null);
    },
    [setKey],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // Out of view, it goes back to its first screen, so a reader who comes
    // to it sees the sequence from the start and not from wherever it was.
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.35);
        if (!entry.isIntersecting) {
          setIndex(0);
          setWhich(0);
        }
      },
      { threshold: [0, 0.35] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // One timeout per screen, so a click restarts the clock on the new screen.
  // With more than one sequence, the end of one plays on into the next tab,
  // so a reader who never clicks still sees both.
  const setCount = sets.length;
  useEffect(() => {
    if (!running) return;
    const shot = shots[active];
    const ms = (shot.ms ?? STEP_MS) + (active === n - 1 ? LAST_HOLD_MS : 0);
    const t = window.setTimeout(() => {
      if (active === n - 1 && setCount > 1) {
        setWhich((w) => (w + 1) % setCount);
        setIndex(0);
      } else setIndex((i) => (i + 1) % n);
    }, ms);
    return () => window.clearTimeout(t);
  }, [running, active, n, shots, setCount]);

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }, []);

  // The frame is sized for the largest screen of the set, and every screen
  // is drawn at the same scale, so a small dialog looks small — as it does.
  // Across every sequence, so switching tabs doesn't resize the card.
  const unitW = Math.max(...every.map((s) => s.w)) + PAD * 2;
  const unitH = Math.max(...every.map((s) => s.h)) + PAD * 2;
  const onSrc = shots[active].src;

  return (
    <figure
      ref={rootRef}
      className={styles.shots}
      aria-label={ui.label}
      data-reduced={reduced ? "1" : "0"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      {sets.length > 1 && (
        <div className={styles.sets} role="group" aria-label={ui.sets}>
          {sets.map((k, i) => (
            <button
              key={k}
              type="button"
              className={styles.setTab}
              aria-pressed={k === current}
              onClick={() => {
                setWhich(i);
                setIndex(0);
              }}
            >
              {SET_LABEL[k][lang]}
            </button>
          ))}
        </div>
      )}
      <div
        className={styles.frame}
        // On a wide screen, never taller than MAX_VH of it: the tall Wi-Fi
        // form would push its card past the viewport (FlasherShots.module.css).
        style={
          {
            aspectRatio: `${unitW} / ${unitH}`,
            "--cap": `${((unitW / unitH) * MAX_VH).toFixed(2)}vh`,
            "--cap-narrow": `${((unitW / unitH) * MAX_VH_NARROW).toFixed(2)}vh`,
          } as React.CSSProperties
        }
      >
        {every.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.src}
            src={BASE + s.src}
            width={s.w}
            height={s.h}
            alt={s.src === onSrc ? s.title : ""}
            aria-hidden={s.src === onSrc ? undefined : true}
            decoding="async"
            draggable={false}
            className={styles.shot}
            data-on={s.src === onSrc ? "1" : "0"}
            style={{ width: `${(s.w / unitW) * 100}%` }}
          />
        ))}
      </div>

      <figcaption className={styles.caption}>
        <div className={styles.dots} role="group" aria-label={ui.label}>
          {shots.map((s, i) => (
            <button
              key={`${current}:${s.src}`}
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
          <span className={styles.count} aria-hidden="true">
            {active + 1} / {n}
          </span>
        </div>
        {/* Every caption of every sequence in one grid cell: the block is as
            tall as the longest, whichever tab and screen is up. */}
        <div className={styles.texts} aria-live={running ? "off" : "polite"}>
          {sets.flatMap((k) =>
            SETS[k].map((s, i) => {
              const on = k === current && i === active;
              return (
                <p key={`${k}:${s.src}`} className={styles.text} data-on={on ? "1" : "0"} aria-hidden={on ? undefined : true}>
                  <b>{s.title}</b>
                  <span>{s[lang]}</span>
                </p>
              );
            }),
          )}
        </div>
      </figcaption>
    </figure>
  );
}
