"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { getSim, useGuideStore, type GuideLang } from "./store";
import styles from "./EditorWindow.module.css";

// Audio · A browser tab, "Each knob is a box on the spectrum." — the
// extension's real mapping editor (tools/patternflow-audio-extension), on its
// own demo source, in a browser window in the card; what it maps drives the
// board on the stage.
//
// The window holds public/guide/audio-editor/ (written by
// firmware/toolchain/editor_demo.py): the extension's editor files as they
// are, plus bridge.js, whose header comment documents this file's other end.
// Each tick the frame posts {type:"pf-audio", outputs:[v|null ×4]} — what the
// extension would send the board, 0…1 per knob, null for a muted band — and
// this hands them on: getSim().setLane("editor", knob, v). The board takes
// them only on the step that declares `lanes: "editor"` (scenes/audio.ts), so
// nothing here knows which step is on stage; a lane no longer written lets go
// by itself, as a real board's does.
//
// In the card the window is a live miniature and takes no input (the card
// scrolls with the story). A click lifts it: a full-size window over the
// page, beside the board, with a frame of its own, until Esc or the close
// button. Beside it the board is still the reader's: the card says to take a
// knob, so the stage left of the window takes the pointer as it does with no
// window up, and the rest of the page (the top bar, what shows round the
// window) does not. On a phone the window covers the screen, and a click
// beside it closes it too. The two frames are one editor: the mapping is kept
// per tab (bridge.js), so an edit made in the window is the miniature's too,
// and goes on driving the board after the window is closed — on a phone,
// where the window covers the board, that is when the reader sees it.
//
// The window's shell (bar, lift, placement, focus) follows ConsoleWindow's,
// and is a copy on purpose: that file is Play's console, wired to its own
// demo and load queue, and stays as it is.
//
// Used by a step whose copy has extra: "editorLive" (copy/audio.ts, browser
// step 4). Its words are this file's own, as LabWindow's are. The editor's
// own text is the extension's, and English on both pages.

type Words = { label: string; open: string; close: string; caption: string };

export const EDITOR_WINDOW_WORDS: Record<GuideLang, Words> = {
  en: {
    label: "The mapping editor",
    open: "Open",
    close: "Close",
    caption: "The editor on its own demo source. Opened from the extension, it shows what your tab is playing.",
  },
  ko: {
    label: "매핑 에디터",
    open: "열기",
    close: "닫기",
    caption: "에디터가 자체 데모 신호로 돌고 있어요. 확장 프로그램에서 열면 내 탭에서 나는 소리가 보여요. 에디터 안의 글자는 영어 그대로예요.",
  },
};

const SRC = "/guide/audio-editor/index.html";
// The tab and the address the extension's page has. The part between is the
// extension's id, which is each installation's own.
const TITLE = "Patternflow Audio — Mapping";
const ADDRESS = ["chrome-extension://…", "/editor.html"];
// The miniature's viewport in CSS pixels, scaled into the card: the editor
// down to its four knob tabs — the source bar, the toolbar and the plot.
const VIEW = { w: 760, h: 480 };
const LIFT_MS = 440;

type Msg = { type?: string; action?: string; outputs?: unknown };

// ── browser chrome ──────────────────────────────────────────────────────────

function Bar({ title, end }: { title: string; end: ReactNode }) {
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
        <span className={styles.address}>
          <span className={styles.url}>
            <span className={styles.scheme}>{ADDRESS[0]}</span>
            {ADDRESS[1]}
          </span>
        </span>
      </span>
    </span>
  );
}

// ── the lifted window ───────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number };

// Beside the board, not on it: on a wide screen the board and the readouts
// at its knobs hold the left 55% of the stage, and those readouts are what a
// drag in the editor is watched on, so the window keeps to the rest (the
// editor lays out for half a screen and narrower). On a narrow screen it
// takes the screen, and the miniature shows the edit once it is closed.
function placement(from: DOMRect, vw: number, vh: number, narrow: boolean): Box {
  const m = narrow ? 10 : 24;
  const cx = narrow ? vw / 2 : from.left + from.width / 2;
  const w = narrow ? vw - 2 * m : Math.min(1100, Math.max(560, Math.round(vw * 0.45) - m), vw - 2 * m);
  const h = narrow ? vh - 2 * m : Math.min(860, vh - 2 * m);
  const x = Math.max(m, Math.min(vw - w - m, cx - w / 2));
  return { x, y: Math.round((vh - h) / 2), w, h };
}

function Lifted({
  words,
  from,
  frame,
  closing,
  onClose,
  onClosed,
}: {
  words: Words;
  from: HTMLElement;
  frame: RefObject<HTMLIFrameElement | null>;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const narrow = useGuideStore((s) => s.narrow);
  // The viewport a fixed layer spans: without the scrollbar. And where the
  // guide's top bar ends (the page's first child): its rail would move the
  // story, so it is kept under the guard.
  const measure = useCallback(
    () => ({
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
      src: from.getBoundingClientRect(),
      bar: Math.ceil(from.closest("[data-page]")?.querySelector(":scope > header")?.getBoundingClientRect().bottom ?? 0),
    }),
    [from],
  );
  const [geo, setGeo] = useState(measure);
  const [reduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [shown, setShown] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const box = placement(geo.src, geo.vw, geo.vh, narrow);

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
  // board, would change. Wheel and touch are held wherever on the page they
  // land (the stage beside the window is under the pointer, and would scroll
  // it); the editor's own never come here, and its frame keeps what is left
  // of a scroll at its end to itself (bridge.js). So are the scrolling keys;
  // focus stays in the window.
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const hold = (e: Event) => {
      if (e.cancelable) e.preventDefault();
    };
    const held = { passive: false, capture: true };
    window.addEventListener("wheel", hold, held);
    window.addEventListener("touchmove", hold, held);
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
    // A press that began on the stage is the stage's until it is let go. Over
    // the editor its moves and its release would go to the frame's document,
    // and a knob let go there would stay held, turning with the pointer. So
    // the frame takes no pointer meanwhile (EditorWindow.module.css), and
    // has it back at the release — or, should the release never arrive (a
    // menu took it), at the first move with no button down.
    const away = (e: PointerEvent) => {
      if (e.target instanceof Node && el.contains(e.target)) delete el.dataset.away;
      else el.dataset.away = "1";
    };
    const back = (e: PointerEvent) => {
      if (e.type !== "pointermove" || e.buttons === 0) delete el.dataset.away;
    };
    window.addEventListener("keydown", keys, true);
    document.addEventListener("focusin", keep);
    window.addEventListener("pointerdown", away, true);
    for (const type of ["pointerup", "pointercancel", "pointermove"] as const) window.addEventListener(type, back, true);
    return () => {
      window.removeEventListener("wheel", hold, true);
      window.removeEventListener("touchmove", hold, true);
      window.removeEventListener("keydown", keys, true);
      document.removeEventListener("focusin", keep);
      window.removeEventListener("pointerdown", away, true);
      for (const type of ["pointerup", "pointercancel", "pointermove"] as const) window.removeEventListener(type, back, true);
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

  const close = (
    <button ref={closeBtn} type="button" className={styles.close} onClick={onClose} aria-label={words.close}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );

  // What of the page is not to be touched while the window is up. A phone:
  // all of it, and a click there closes. A wide screen: all but the stage
  // left of the window, under the top bar — the board — and a click on the
  // guard does nothing (a press that missed a knob must not close the window).
  const guard = narrow ? (
    <div className={styles.guard} onClick={onClose} />
  ) : (
    <div
      className={styles.guard}
      style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, ${box.x}px 100%, ${box.x}px ${geo.bar}px, 0 ${geo.bar}px)` }}
    />
  );

  return (
    <div ref={layer} className={styles.layer} data-shown={at ? "1" : "0"} data-narrow={narrow ? "1" : "0"}>
      <div className={styles.backdrop} />
      {guard}
      <div
        className={styles.lift}
        role="dialog"
        aria-modal="true"
        aria-label={words.label}
        style={{ left: box.x, top: box.y, width: box.w, height: box.h, ...travel }}
      >
        <div className={`${styles.window} ${styles.big}`}>
          <Bar title={TITLE} end={close} />
          <div className={styles.viewport}>
            <iframe ref={frame} className={styles.frame} src={SRC} title={words.label} lang="en" style={{ width: "100%", height: "100%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── the window ──────────────────────────────────────────────────────────────

export default function EditorWindow({ lang, step }: { lang: GuideLang; step: number }) {
  const words = EDITOR_WINDOW_WORDS[lang];
  const root = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const inline = useRef<HTMLIFrameElement>(null);
  const liftedFrame = useRef<HTMLIFrameElement>(null);
  const [near, setNear] = useState(false);
  const [width, setWidth] = useState(0);
  const [lift, setLift] = useState<{ from: HTMLElement; closing: boolean } | null>(null);
  /** The lifted frame has started mapping: from then on it drives the board. */
  const liftLive = useRef(false);
  const lifted = Boolean(lift);

  const close = useCallback(() => setLift((l) => (l && !l.closing ? { ...l, closing: true } : l)), []);
  const closed = useCallback(() => setLift(null), []);

  // The bridge: what the editor maps goes to the board. One frame drives at a
  // time — the window while it is up, the miniature otherwise — and the
  // miniature keeps the lanes until the window's first frame, so the knobs
  // are not let go while it loads.
  useEffect(() => {
    if (!lifted) liftLive.current = false;
  }, [lifted]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.source) return;
      const fromLift = liftedFrame.current?.contentWindow === e.source;
      const fromMini = inline.current?.contentWindow === e.source;
      if (!fromLift && !fromMini) return;
      const m = e.data as Msg;
      if (!m || m.type !== "pf-audio") return;
      if (m.action === "escape") {
        if (fromLift) close();
        return;
      }
      if (!Array.isArray(m.outputs)) return;
      if (fromLift) liftLive.current = true;
      else if (liftLive.current) return;
      const sim = getSim();
      for (let i = 0; i < 4; i++) {
        const v: unknown = m.outputs[i];
        // A muted band's slot is null: that lane is left alone, and lets go.
        if (typeof v === "number") sim.setLane("editor", i, v);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [close]);

  // The frame runs only near the screen: loaded when its card is about to be
  // on it, gone again when the reader is well past (the mapping is kept, so
  // coming back finds the same editor).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const arrive = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), {
      rootMargin: "60% 0px",
    });
    const leave = new IntersectionObserver((entries) => entries.every((e) => !e.isIntersecting) && setNear(false), {
      rootMargin: "250% 0px",
    });
    arrive.observe(el);
    leave.observe(el);
    return () => {
      arrive.disconnect();
      leave.disconnect();
    };
  }, []);

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

  // Focus goes back to the button that opened the window, once the window is
  // gone (while it is mounted its focus trap would take the focus back).
  const wasLifted = useRef(false);
  useEffect(() => {
    if (lift) {
      wasLifted.current = true;
      return;
    }
    if (!wasLifted.current) return;
    wasLifted.current = false;
    opener.current?.focus({ preventScroll: true });
  }, [lift]);

  const scale = Math.max(0, width - 2) / VIEW.w;
  const chip = (
    <span className={styles.openChip} aria-hidden="true">
      {words.open}
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M9 3h4v4M13 3L8.5 7.5M7 3.5H3.5v9h9V9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </span>
  );

  return (
    <figure ref={root} className={styles.root} data-editor-window="" data-extra="editorLive" data-step-index={step}>
      <button
        ref={opener}
        type="button"
        className={styles.opener}
        aria-label={`${words.label} — ${words.open}`}
        aria-haspopup="dialog"
        aria-expanded={lifted}
        data-lifted={lift && !lift.closing ? "1" : "0"}
        onClick={(e) => setLift({ from: e.currentTarget, closing: false })}
      >
        <span className={styles.window}>
          <Bar title={TITLE} end={chip} />
          <span className={styles.mini} style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }} inert>
            {(near || lifted) && (
              <iframe
                ref={inline}
                className={styles.frame}
                src={SRC}
                title={words.label}
                lang="en"
                tabIndex={-1}
                style={{ width: VIEW.w, height: VIEW.h, transform: `scale(${scale})` }}
              />
            )}
          </span>
        </span>
      </button>
      <figcaption className={styles.caption}>{words.caption}</figcaption>
      {lift &&
        createPortal(
          <Lifted words={words} from={lift.from} frame={liftedFrame} closing={lift.closing} onClose={close} onClosed={closed} />,
          document.body,
        )}
    </figure>
  );
}
