"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { SIM_IP } from "@/lib/guide/deviceSim";
import { getSim, useGuideStore, type GuideLang } from "./store";
import styles from "./ConsoleWindow.module.css";

// The device console, working, in a browser window on the page.
//
// The window holds the demo in public/guide/console-demo/ (written by
// firmware/toolchain/console_demo.py): the core's real console pages with a
// simulated board behind them — one board per browser tab, kept in
// sessionStorage, so every window on the page shows the same one. This file
// is the other end of the demo's bridge (documented at the top of
// pf-demo.js): what the console does reaches the 3D board through getSim(),
// and the board's state goes back to the console, so a knob turned on the
// model and a slider dragged in the window act on the same device.
//
// In the card the window is a live miniature: its pages run and follow the
// board, but the card scrolls with the story, so it takes no input. A click
// lifts it — a full-size window floats over the page beside the board, with
// a frame of its own on the same board — until Esc, the close button or a
// click beside it.

export type ConsoleVariant = "desktop" | "phone";
export type ConsolePage = "home" | "patterns" | "wifi" | "knobs" | "update";
type Variant = ConsoleVariant;
type Page = ConsolePage;

const DEMO = "/guide/console-demo/";
const FILE: Record<Page, string> = {
  home: "index.html",
  patterns: "patterns.html",
  wifi: "wifi.html",
  knobs: "knobs.html",
  update: "update.html",
};
// The address bar shows the device's own paths, not the demo's files.
const DEVICE_PATH: Record<string, string> = {
  "index.html": "",
  "patterns.html": "/patterns",
  "status.html": "/status",
  "wifi.html": "/wifi",
  "knobs.html": "/knobs",
  "update.html": "/update",
};
// A laptop opens the name; a phone, as the guide says, the address from K2.
const HOST: Record<Variant, string> = { desktop: "patternflow.local", phone: SIM_IP };
// The page's viewport in CSS pixels. The miniature scales it into the card;
// the lifted phone shows it at this size, the lifted desktop at the window's.
const VIEW: Record<Variant, { w: number; h: number }> = {
  desktop: { w: 1024, h: 640 },
  phone: { w: 390, h: 720 },
};
// The lifted phone: bezel, the browser's top (status row + address bar), and
// the home indicator strip, around VIEW.phone.
// The miniature phone's bezel, in card pixels.
const MINI_BEZEL = 7;
const PHONE_BEZEL = 10;
const PHONE_TOP = 92;
const PHONE_FOOT = 22;
const PHONE_W = VIEW.phone.w + 2 * PHONE_BEZEL;
const PHONE_H = VIEW.phone.h + PHONE_TOP + PHONE_FOOT + 2 * PHONE_BEZEL;
// Names this page load in pf-sim: its encoder counts start at zero here.
const SID = Math.random().toString(36).slice(2, 10);
const LIFT_MS = 440;

const UI: Record<GuideLang, { open: string; close: string; label: string }> = {
  en: { open: "Open", close: "Close", label: "The device console" },
  ko: { open: "열기", close: "닫기", label: "기기 콘솔" },
};

type Msg = {
  type?: string;
  action?: string;
  modules?: string[];
  inv?: boolean[];
  sub?: number[];
  slug?: string;
  knob?: number;
  value?: number;
  level?: number;
  on?: boolean;
};

// ── the bridge ──────────────────────────────────────────────────────────────

/**
 * Drives the board from the frames' pf-console messages, and posts the
 * board's state (pf-sim) to the frames whenever it changes, at most four
 * times a second. What the console stores on the board — which modules it
 * has, how the knobs count — holds while the reader is in this window's
 * scene; the guide's other chapters keep the board they describe.
 */
function useBridge(frames: RefObject<HTMLIFrameElement | null>[], root: RefObject<HTMLElement | null>, onEscape: () => void) {
  const stored = useRef<{ modules: string[] | null; inv: boolean[] | null; sub: number[] | null }>({
    modules: null,
    inv: null,
    sub: null,
  });
  const here = useRef<boolean | null>(null);
  const last = useRef({ key: "", at: 0 });
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  }, [onEscape]);

  const post = useCallback(
    (force: boolean) => {
      const state = getSim().consoleState();
      const key = JSON.stringify(state);
      const t = performance.now();
      if (!force && (key === last.current.key || t - last.current.at < 250)) return;
      last.current = { key, at: t };
      const msg = { type: "pf-sim", sid: SID, ...state };
      for (const f of frames) f.current?.contentWindow?.postMessage(msg, window.location.origin);
    },
    [frames],
  );

  const apply = useCallback(() => {
    if (!here.current) return;
    const sim = getSim();
    const s = stored.current;
    if (s.modules) sim.setModules(s.modules);
    if (s.inv && s.sub) sim.setKnobSettings(s.inv, s.sub);
  }, []);

  // In this scene, the console's board; out of it, the guide's.
  useEffect(() => {
    const scene = root.current?.closest<HTMLElement>("[data-scene]")?.dataset.scene ?? null;
    const follow = (current: string) => {
      const now = scene === null || current === scene;
      if (now === here.current) return;
      here.current = now;
      if (now) apply();
      else {
        const sim = getSim();
        sim.setModules(null);
        sim.setKnobSettings([false, false, false, false], [4, 4, 4, 4]);
      }
    };
    follow(useGuideStore.getState().scene);
    return useGuideStore.subscribe((s) => follow(s.scene));
  }, [root, apply]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (!frames.some((f) => f.current && f.current.contentWindow === e.source)) return;
      const m = e.data as Msg;
      if (!m || m.type !== "pf-console") return;
      const sim = getSim();
      // The reader has the board: the scripted demos stand aside.
      const hands = () => useGuideStore.getState().setHandsOn(true);
      switch (m.action) {
        case "ready":
          stored.current = { modules: m.modules ?? null, inv: m.inv ?? null, sub: m.sub ?? null };
          apply();
          post(true);
          break;
        case "select":
          if (typeof m.slug === "string") sim.selectPattern(m.slug);
          hands();
          break;
        case "knob":
          if (typeof m.knob === "number" && typeof m.value === "number") sim.applyRemoteParam(m.knob, m.value);
          hands();
          break;
        case "brightness":
          if (typeof m.level === "number") sim.setBrightnessLevel(m.level);
          hands();
          break;
        case "sleep":
          sim.setSleeping(Boolean(m.on));
          hands();
          break;
        case "modules":
          stored.current.modules = m.modules ?? null;
          apply();
          break;
        case "knobSettings":
          stored.current.inv = m.inv ?? null;
          stored.current.sub = m.sub ?? null;
          apply();
          break;
        case "escape":
          escape.current();
          break;
      }
    };
    window.addEventListener("message", onMessage);
    const timer = window.setInterval(() => post(false), 200);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(timer);
    };
  }, [frames, post, apply]);
}

/** Which demo page a frame is on, for its tab and address bar. */
function useFramePage(frame: RefObject<HTMLIFrameElement | null>, initial: string) {
  const [file, setFile] = useState(initial);
  const [title, setTitle] = useState("Patternflow");
  const onLoad = useCallback(() => {
    try {
      const path = frame.current?.contentWindow?.location.pathname ?? "";
      if (path.startsWith(DEMO)) setFile(path.slice(DEMO.length) || "index.html");
      const t = frame.current?.contentDocument?.title;
      if (t) setTitle(t);
    } catch {
      /* not ours to read */
    }
  }, [frame]);
  return { file, title, onLoad };
}

// ── browser chrome ──────────────────────────────────────────────────────────

function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9 3h4v4M13 3L8.5 7.5M7 3.5H3.5v9h9V9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CloseButton({ label, onClick, btnRef }: { label: string; onClick: () => void; btnRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <button ref={btnRef} type="button" className={styles.close} onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function Address({ host, file }: { host: string; file: string }) {
  return (
    <span className={styles.address}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.info}>
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 7.3v3.9M8 4.9v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className={styles.url}>
        {host}
        <span className={styles.path}>{DEVICE_PATH[file] ?? ""}</span>
      </span>
    </span>
  );
}

function DesktopBar({ host, file, title, end }: { host: string; file: string; title: string; end: ReactNode }) {
  return (
    <span className={styles.bar}>
      <span className={styles.tabs}>
        <span className={styles.lights} aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className={styles.tab}>
          <i className={styles.favicon} aria-hidden="true" />
          <span className={styles.tabTitle}>{title}</span>
        </span>
        <span className={styles.barEnd}>{end}</span>
      </span>
      <span className={styles.toolbar}>
        <span className={styles.navIcons} aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="M10 3.5L5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <svg viewBox="0 0 16 16">
            <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <svg viewBox="0 0 16 16">
            <path d="M12.7 6.3A5 5 0 1 0 13 9.6M13 2.9v3.6H9.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </span>
        <Address host={host} file={file} />
      </span>
    </span>
  );
}

function PhoneTop({ host, file, end }: { host: string; file: string; end: ReactNode }) {
  return (
    <span className={styles.phoneTop}>
      <span className={styles.status} aria-hidden="true">
        <span className={styles.clock}>9:41</span>
        <span className={styles.island} />
        <span className={styles.statusIcons}>
          <svg viewBox="0 0 18 12">
            <path
              d="M9 11l2.1-2.5a3.3 3.3 0 0 0-4.2 0zM4.4 6a7 7 0 0 1 9.2 0l-1.3 1.5a5 5 0 0 0-6.6 0zM1.8 3.1a10.8 10.8 0 0 1 14.4 0l-1.3 1.5a8.8 8.8 0 0 0-11.8 0z"
              fill="currentColor"
            />
          </svg>
          <i className={styles.battery} />
        </span>
      </span>
      <span className={styles.phoneBar}>
        <Address host={host} file={file} />
        {end}
      </span>
    </span>
  );
}

// ── the lifted window ───────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number };

// Where the lifted window stands: beside the board, not on it. On a wide
// screen the board holds the left of the stage and the story the right, so
// the window centres on the card it came from as far as the screen allows,
// which leaves the board in view; on a narrow screen it takes the screen.
function placement(variant: Variant, from: DOMRect, vw: number, vh: number, narrow: boolean): { box: Box; scale: number } {
  const m = narrow ? 10 : 24;
  const cx = narrow ? vw / 2 : from.left + from.width / 2;
  if (variant === "desktop") {
    const w = narrow ? vw - 2 * m : Math.min(1100, Math.max(720, vw - 660), vw - 2 * m);
    const h = narrow ? vh - 2 * m : Math.min(780, vh - 2 * m);
    const x = Math.max(m, Math.min(vw - w - m, cx - w / 2));
    return { box: { x, y: Math.round((vh - h) / 2), w, h }, scale: 1 };
  }
  // The phone keeps its size and shrinks to fit.
  const scale = Math.min(1, (vh - 2 * m) / PHONE_H, (vw - 2 * m) / PHONE_W);
  const w = PHONE_W * scale;
  const h = PHONE_H * scale;
  const x = Math.max(m, Math.min(vw - w - m, cx - w / 2));
  return { box: { x, y: Math.round((vh - h) / 2), w, h }, scale };
}

function Lifted({
  variant,
  lang,
  file,
  from,
  frame,
  closing,
  onClose,
  onClosed,
}: {
  variant: Variant;
  lang: GuideLang;
  file: string;
  from: HTMLElement;
  frame: RefObject<HTMLIFrameElement | null>;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const narrow = useGuideStore((s) => s.narrow);
  // The viewport a fixed layer spans: without the scrollbar.
  const measure = useCallback(
    () => ({
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
      src: from.getBoundingClientRect(),
    }),
    [from],
  );
  const [geo, setGeo] = useState(measure);
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [shown, setShown] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const page = useFramePage(frame, file);
  const { box, scale } = placement(variant, geo.src, geo.vw, geo.vh, narrow);

  useEffect(() => {
    const onResize = () => setGeo(measure());
    window.addEventListener("resize", onResize);
    // One frame laid out at the card, then the move.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [measure]);

  useEffect(() => {
    if (shown && !closing) closeBtn.current?.focus({ preventScroll: true });
  }, [shown, closing]);

  useEffect(() => {
    if (!closing) return;
    const t = window.setTimeout(onClosed, reduced ? 180 : LIFT_MS);
    return () => window.clearTimeout(t);
  }, [closing, onClosed, reduced]);

  // The story must not move under the window — its step, and with it the
  // board, would change. Wheel and touch on the backdrop are held; so are the
  // scrolling keys; focus stays in the window.
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const hold = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", hold, { passive: false });
    el.addEventListener("touchmove", hold, { passive: false });
    const keys = (e: KeyboardEvent) => {
      const onButton = e.target instanceof HTMLButtonElement;
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      if (e.key === " " && !onButton) e.preventDefault();
      if (e.key === "Tab" && !frame.current?.contains(document.activeElement)) {
        // Two stops: the close button and the page.
        e.preventDefault();
        if (document.activeElement === closeBtn.current) frame.current?.focus();
        else closeBtn.current?.focus();
      }
    };
    const keep = (e: FocusEvent) => {
      if (e.target instanceof Node && !el.contains(e.target)) closeBtn.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", keys, true);
    document.addEventListener("focusin", keep);
    return () => {
      el.removeEventListener("wheel", hold);
      el.removeEventListener("touchmove", hold);
      window.removeEventListener("keydown", keys, true);
      document.removeEventListener("focusin", keep);
    };
  }, [frame]);

  // From the card to its place, and back.
  const at = shown && !closing;
  const k = geo.src.width / box.w;
  const travel: CSSProperties = reduced
    ? { opacity: at ? 1 : 0 }
    : at
      ? { transform: "none", opacity: 1 }
      : {
          transform: `translate3d(${geo.src.left - box.x}px, ${geo.src.top - box.y}px, 0) scale(${k})`,
          opacity: 0,
        };

  const host = HOST[variant];
  const ui = UI[lang];
  const close = <CloseButton label={ui.close} onClick={onClose} btnRef={closeBtn} />;
  const iframe = (
    <iframe
      ref={frame}
      className={styles.frame}
      src={DEMO + file}
      name={`pf-demo host=${host}`}
      title={ui.label}
      onLoad={page.onLoad}
      style={variant === "desktop" ? { width: "100%", height: "100%" } : { width: VIEW.phone.w, height: VIEW.phone.h }}
    />
  );

  return (
    <div ref={layer} className={styles.layer} data-shown={at ? "1" : "0"} data-narrow={narrow ? "1" : "0"}>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        className={styles.lift}
        role="dialog"
        aria-modal="true"
        aria-label={ui.label}
        style={{ left: box.x, top: box.y, width: box.w, height: box.h, ...travel }}
      >
        {variant === "desktop" ? (
          <div className={`${styles.window} ${styles.big}`}>
            <DesktopBar host={host} file={page.file} title={page.title} end={close} />
            <div className={styles.viewport}>{iframe}</div>
          </div>
        ) : (
          <div className={styles.phoneScale} style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}>
            <div
              className={`${styles.phone} ${styles.big}`}
              style={{ "--bezel": `${PHONE_BEZEL}px`, "--top": `${PHONE_TOP}px`, "--foot": `${PHONE_FOOT}px` } as CSSProperties}
            >
              <PhoneTop host={host} file={page.file} end={close} />
              <div className={styles.phoneView} style={{ width: VIEW.phone.w, height: VIEW.phone.h }}>
                {iframe}
              </div>
              <i className={styles.homeBar} aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── loading the frames ──────────────────────────────────────────────────────
//
// A frame boots the console on the page's own main thread: arriving in the
// middle of a camera move, it stalled the stage for half a second. So the
// windows load early and one at a time, while the reader is in the chapter
// before and has stopped on a step (the camera has settled) — or at once
// when a jump lands right beside one.

const EARLY_SCENES = new Set(["patterns", "console", "next"]);
const SETTLED_MS = 1200;
const queue: (() => void)[] = [];
let queueBusy = false;
let queueTimer = 0;
let stepChangedAt = 0;
let unsubscribe: (() => void) | null = null;

function pumpQueue() {
  if (queueBusy || !queue.length) return;
  const { scene } = useGuideStore.getState();
  if (!EARLY_SCENES.has(scene) || performance.now() - stepChangedAt < SETTLED_MS) return;
  const next = queue.shift();
  if (!next) return;
  queueBusy = true;
  const go = () => next();
  if ("requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 600 });
  else go();
}

function enqueue(load: () => void) {
  queue.push(load);
  if (!unsubscribe) {
    stepChangedAt = performance.now();
    unsubscribe = useGuideStore.subscribe((s, prev) => {
      if (s.scene !== prev.scene || s.step !== prev.step) stepChangedAt = performance.now();
    });
  }
  if (!queueTimer) queueTimer = window.setInterval(pumpQueue, 300);
}

function dequeue(load: () => void) {
  const i = queue.indexOf(load);
  if (i >= 0) queue.splice(i, 1);
}

/** A frame the queue started has loaded (or given up): the next may go. */
function queueDone() {
  window.setTimeout(() => {
    queueBusy = false;
  }, 400);
}

// ── the window ──────────────────────────────────────────────────────────────

export default function ConsoleWindow({ variant, page = "home", lang }: { variant: Variant; page?: Page; lang: GuideLang }) {
  const root = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const inline = useRef<HTMLIFrameElement>(null);
  const liftedFrame = useRef<HTMLIFrameElement>(null);
  const [frames] = useState(() => [inline, liftedFrame]);
  const [near, setNear] = useState(false);
  /** This frame was started by the load queue, which waits for it. */
  const fromQueue = useRef(false);
  const [width, setWidth] = useState(0);
  const [lift, setLift] = useState<{ from: HTMLElement; closing: boolean } | null>(null);
  const mini = useFramePage(inline, FILE[page]);

  // Closing: the miniature goes to the page the window was left on while the
  // window flies back over it, and shows again once that page has loaded.
  const [reloading, setReloading] = useState(false);
  const miniFile = useRef(mini.file);
  useEffect(() => {
    miniFile.current = mini.file;
  }, [mini.file]);
  const close = useCallback(() => {
    let file = "";
    try {
      const p = liftedFrame.current?.contentWindow?.location.pathname ?? "";
      if (p.startsWith(DEMO)) file = p.slice(DEMO.length);
    } catch {
      /* not ours to read */
    }
    if (file && file !== miniFile.current && inline.current) {
      inline.current.src = DEMO + file;
      setReloading(true);
    }
    setLift((l) => (l && !l.closing ? { ...l, closing: true } : l));
  }, []);
  useBridge(frames, root, close);
  useEffect(() => {
    if (!reloading) return;
    const t = window.setTimeout(() => setReloading(false), 2500);
    return () => window.clearTimeout(t);
  }, [reloading]);
  const onMiniLoad = useCallback(() => {
    mini.onLoad();
    setReloading(false);
    if (fromQueue.current) {
      fromQueue.current = false;
      queueDone();
    }
  }, [mini]);

  // Loaded early through the queue above, or at once when it is about to be
  // on screen; then kept.
  useEffect(() => {
    const el = root.current;
    if (!el || near) return;
    const load = () => {
      fromQueue.current = true;
      setNear(true);
      // Should the frame never report back, don't hold the others forever.
      window.setTimeout(queueDone, 4000);
    };
    enqueue(load);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        dequeue(load);
        setNear(true);
      },
      { rootMargin: "60% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      dequeue(load);
    };
  }, [near]);

  // The miniature scales with the card.
  useEffect(() => {
    const el = opener.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!lift || lift.closing) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [lift, close]);

  const closed = useCallback(() => {
    setLift(null);
    opener.current?.focus({ preventScroll: true });
  }, []);

  const host = HOST[variant];
  const view = VIEW[variant];
  // The desktop page fills the window's width; the phone's sits in its bezel.
  const inner = Math.max(0, width - (variant === "desktop" ? 2 : 2 * MINI_BEZEL + 2));
  const scale = inner / view.w;
  // The height is the page's proportion, set in CSS, so the card has its size
  // before anything is measured.
  const ratio = { aspectRatio: `${view.w} / ${view.h}` };
  const ui = UI[lang];
  const chip = (
    <span className={styles.openChip} aria-hidden="true">
      {ui.open}
      <OpenIcon />
    </span>
  );
  const frame = near && (
    <iframe
      ref={inline}
      className={styles.frame}
      src={DEMO + FILE[page]}
      name={`pf-demo host=${host}`}
      title={ui.label}
      tabIndex={-1}
      onLoad={onMiniLoad}
      style={{ width: view.w, height: view.h, transform: `scale(${scale})` }}
    />
  );

  return (
    <div ref={root} className={styles.root} data-variant={variant}>
      <button
        ref={opener}
        type="button"
        className={styles.opener}
        aria-label={`${ui.label} — ${ui.open}`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(lift)}
        data-lifted={(lift && !lift.closing) || reloading ? "1" : "0"}
        onClick={(e) => {
          setLift({ from: e.currentTarget, closing: false });
          // The reader has the board now: the scripted demos stand aside.
          useGuideStore.getState().setHandsOn(true);
        }}
      >
        {variant === "desktop" ? (
          <span className={styles.window}>
            <DesktopBar host={host} file={mini.file} title={mini.title} end={chip} />
            <span className={styles.mini} style={ratio} inert>
              {frame}
            </span>
          </span>
        ) : (
          <span className={styles.phone} style={{ "--bezel": `${MINI_BEZEL}px` } as CSSProperties}>
            <PhoneTop host={host} file={mini.file} end={chip} />
            <span className={styles.mini} style={ratio} inert>
              {frame}
            </span>
            <i className={styles.homeBar} aria-hidden="true" />
          </span>
        )}
      </button>
      {lift &&
        createPortal(
          <Lifted
            variant={variant}
            lang={lang}
            file={mini.file}
            from={lift.from}
            frame={liftedFrame}
            closing={lift.closing}
            onClose={close}
            onClosed={closed}
          />,
          document.body,
        )}
    </div>
  );
}

