"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LAB_STORAGE } from "@/lib/lab/persist";
import { setStageArea } from "./stage/stageArea";
import { useGuideStore, type GuideLang } from "./store";
import styles from "./LabWindow.module.css";

// 06 Pattern Lab, "Open the Lab." — the real Pattern Lab in a window lifted
// over the page, the way ConsoleWindow lifts the device's real console, while
// the device on stage plays the reader's own draft (the step's `mirror`,
// scenes/lab.ts; lib/guide/labMirror.ts).
//
// The window is /pattern-lab itself, same origin, same browser storage: what
// the reader does in it is their real draft, saved by the lab as it always
// saves, and the board beside it follows those saves. This file never writes,
// removes or migrates a patternflow_lab_* key, and does nothing to the frame
// that would: it reads the frame's address and title, keeps Esc and the
// page's scroll with the window, sends the lab's links to a new tab rather
// than away from the lab, and listens for another tab's saves.
//
// In the card: a picture of the lab as it opens (a real capture,
// public/guide/lab-window/lab.webp, scratchpad lab_poster.py) and nothing
// loaded, so scrolling past never starts the lab. A click lifts the window
// beside the board: the lab loads at 1024 CSS px wide or more, scaled to fit,
// and the stage frames the device in what the window leaves (stageArea.ts).
// Esc, the close button or a click beside it puts it back. A screen too
// small for both gets a link that opens the lab in a new tab instead.
//
// Used by a step whose copy has extra: "labWindow" (copy/lab.ts step 0).

const LAB_PATH = "/pattern-lab";
const POSTER = "/guide/lab-window/lab.webp";
/**
 * The lab's layout width: it is laid out at this many CSS px, or more, and
 * scaled to fit. The lab lays out whole at 1024; at 1280 the scale on a
 * 1280–1440 px laptop left its 11–12 px UI at 7–9 px. The poster is captured
 * at this size (lab_poster.py).
 */
const LAB_W = 1024;
const LAB_H = 680;
const BAR_H = 40;
const LIFT_MS = 440;
/**
 * How long the frame stays loaded, hidden, after the window closes. The lab
 * saves 600 ms after the last edit (lib/lab/autosave.ts); an edit made just
 * before closing is saved by the lab's own timer before the frame goes.
 */
const UNLOAD_MS = 1100;
/** Wide and tall enough for the window and the board beside it. */
const LIFT_QUERY = "(min-width: 1180px) and (min-height: 640px)";

type Words = {
  open: string;
  close: string;
  label: string;
  newTab: string;
  phoneOpen: string;
  otherTab: string;
};

export const LAB_WINDOW_WORDS: Record<GuideLang, Words> = {
  en: {
    open: "Open",
    close: "Close",
    label: "Pattern Lab",
    newTab: "Open in a new tab",
    phoneOpen: "Open Pattern Lab",
    otherTab: "Pattern Lab just saved from another tab. Edit in one place: two open Labs overwrite each other's saves.",
  },
  ko: {
    open: "열기",
    close: "닫기",
    label: "패턴 랩",
    newTab: "새 탭에서 열기",
    phoneOpen: "패턴 랩 열기",
    otherTab: "다른 탭의 패턴 랩이 방금 저장했어요. 한 곳에서만 고쳐 주세요. 둘 다 열려 있으면 서로의 저장을 덮어써요.",
  },
};

// ── what the browser says ───────────────────────────────────────────────────

function subscribeMedia(onChange: () => void) {
  const mq = window.matchMedia(LIFT_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const canLift = () => window.matchMedia(LIFT_QUERY).matches;
const noop = () => () => {};
const pageHost = () => window.location.host;

// ── bits of the window ──────────────────────────────────────────────────────

function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M9 3h4v4M13 3L8.5 7.5M7 3.5H3.5v9h9V9" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function Address({ host }: { host: string }) {
  return (
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
  );
}

function Lights() {
  return (
    <span className={styles.lights} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

// ── the lifted window ───────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number };

// The board keeps the left of the screen, about a third of it; the window
// takes the rest, full height.
function placement(vw: number, vh: number): Box {
  const m = 20;
  const x = Math.round(Math.min(600, Math.max(340, vw * 0.3)));
  return { x, y: m, w: vw - x - m, h: vh - 2 * m };
}

function isEditable(t: EventTarget | null): boolean {
  if (!t || typeof (t as Element).closest !== "function") return false;
  const el = t as HTMLElement;
  return Boolean(el.isContentEditable || el.closest("input, textarea, select, [contenteditable], .cm-editor"));
}

function Lifted({
  lang,
  host,
  from,
  frame,
  closing,
  onClose,
}: {
  lang: GuideLang;
  host: string;
  from: HTMLElement;
  frame: RefObject<HTMLIFrameElement | null>;
  closing: boolean;
  onClose: () => void;
}) {
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
  const [ready, setReady] = useState(false);
  const [otherTab, setOtherTab] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  /** The lab's part of the window, measured (a notice above it takes some). */
  const [inner, setInner] = useState<{ w: number; h: number } | null>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const tabLink = useRef<HTMLAnchorElement>(null);
  const [title, setTitle] = useState("Pattern Lab / Patternflow");
  const box = placement(geo.vw, geo.vh);
  const words = LAB_WINDOW_WORDS[lang];

  // The lab's own size: at least LAB_W × LAB_H, scaled down to the window,
  // never up — a big screen gets more lab, not bigger type.
  const innerW = inner?.w ?? box.w - 2;
  const innerH = inner?.h ?? box.h - BAR_H - 2;
  const scale = Math.min(1, innerW / LAB_W, innerH / LAB_H);
  const labW = Math.ceil(innerW / scale);
  const labH = Math.ceil(innerH / scale);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setInner({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // The stage frames the device left of the window while it is open (and
  // starts moving there as the window lifts); closing gives the card back.
  useEffect(() => {
    if (closing) setStageArea(null);
    else setStageArea({ l: 24, r: box.x - 28, t: 64, b: geo.vh - 32 });
  }, [closing, box.x, geo.vh]);
  useEffect(() => () => setStageArea(null), []);

  useEffect(() => {
    if (shown && !closing) closeBtn.current?.focus({ preventScroll: true });
  }, [shown, closing]);

  // The story must not move under the window — its step, and with it the
  // board, would change. Wheel and touch on the backdrop are held; so are the
  // scrolling keys; focus stays in the window (the close button, the lab).
  useEffect(() => {
    const el = layer.current;
    if (!el || closing) return;
    const hold = (e: Event) => e.preventDefault();
    el.addEventListener("wheel", hold, { passive: false });
    el.addEventListener("touchmove", hold, { passive: false });
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const onButton = e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement;
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      if (e.key === " " && !onButton) e.preventDefault();
      if (e.key === "Tab" && document.activeElement !== frame.current) {
        // Three stops, round and round: the new-tab link, close, the lab.
        e.preventDefault();
        const stops: HTMLElement[] = [];
        for (const el of [tabLink.current, closeBtn.current, frame.current]) if (el) stops.push(el);
        const at = stops.indexOf(document.activeElement as HTMLElement);
        const next = at < 0 ? 1 : (at + (e.shiftKey ? stops.length - 1 : 1)) % stops.length;
        stops[Math.min(next, stops.length - 1)]?.focus();
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
  }, [frame, onClose, closing]);

  // The lab in the frame: read-only hooks, nothing that writes storage.
  const detach = useRef<(() => void) | null>(null);
  useEffect(() => () => detach.current?.(), []);
  const onLoad = useCallback(() => {
    detach.current?.();
    detach.current = null;
    const win = frame.current?.contentWindow;
    let doc: Document | null = null;
    try {
      doc = frame.current?.contentDocument ?? null;
    } catch {
      doc = null;
    }
    if (!win || !doc) return;
    if (doc.title) setTitle(doc.title);
    // The frame is there for the lab. If it ever lands anywhere else, that
    // page opens in a tab of its own and the lab comes back here.
    if (win.location.pathname !== LAB_PATH) {
      window.open(win.location.href, "_blank", "noopener");
      win.location.replace(LAB_PATH);
      return;
    }
    // A wheel the lab doesn't use must not scroll the story behind it.
    const style = doc.createElement("style");
    style.textContent = "html, body { overscroll-behavior: none; }";
    doc.head.appendChild(style);
    // Esc closes the window unless the lab is using it (a field, the code
    // editor, a menu that took it).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isEditable(e.target)) return;
      onClose();
    };
    // A link out of the lab opens beside the guide, not in place of the lab.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || e.defaultPrevented || e.button !== 0) return;
      const url = new URL(a.href, win.location.href);
      const stays = url.origin === win.location.origin && url.pathname === LAB_PATH;
      if (stays || a.target === "_blank" || a.hasAttribute("download")) return;
      e.preventDefault();
      e.stopPropagation();
      window.open(url.href, "_blank", "noopener");
    };
    // Another tab's lab saving the same draft: say so (the frame's window
    // hears saves from every document but its own; this page never writes).
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAB_STORAGE.project) setOtherTab(true);
    };
    win.addEventListener("keydown", onKey);
    doc.addEventListener("click", onClick, true);
    win.addEventListener("storage", onStorage);
    detach.current = () => {
      try {
        win.removeEventListener("keydown", onKey);
        doc?.removeEventListener("click", onClick, true);
        win.removeEventListener("storage", onStorage);
      } catch {
        /* the frame is gone */
      }
    };
    // Shown once it has painted, over the picture of it.
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, [frame, onClose]);

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

  return (
    <div ref={layer} className={styles.layer} data-shown={at ? "1" : "0"} data-closing={closing ? "1" : "0"}>
      <div className={styles.backdrop} onClick={onClose} />
      <div
        className={styles.lift}
        role="dialog"
        aria-modal="true"
        aria-label={words.label}
        style={{ left: box.x, top: box.y, width: box.w, height: box.h, ...travel }}
      >
        <div className={styles.window}>
          <div className={styles.bar} style={{ height: BAR_H }}>
            <Lights />
            <span className={styles.tabTitle}>{title}</span>
            <Address host={host} />
            <a
              ref={tabLink}
              className={styles.barLink}
              href={LAB_PATH}
              target="_blank"
              rel="noopener"
              // One lab at a time: the window closes as the tab opens.
              onClick={onClose}
            >
              {words.newTab}
              <OpenIcon />
            </a>
            <button ref={closeBtn} type="button" className={styles.close} onClick={onClose} aria-label={words.close}>
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {otherTab && (
            <p className={styles.otherTab} role="status">
              {words.otherTab}
            </p>
          )}
          <div ref={viewport} className={styles.viewport} data-ready={ready ? "1" : "0"}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a fixed poster under the frame until it paints */}
            <img className={styles.posterBig} src={POSTER} alt="" width={LAB_W} height={LAB_H} style={{ width: LAB_W * scale }} />
            <iframe
              ref={frame}
              className={styles.frame}
              src={LAB_PATH}
              title={words.label}
              onLoad={onLoad}
              style={{ width: labW, height: labH, transform: `scale(${scale})` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── the card ────────────────────────────────────────────────────────────────

export default function LabWindow({ lang, step }: { lang: GuideLang; step: number }) {
  const lift = useSyncExternalStore(subscribeMedia, canLift, () => false);
  const host = useSyncExternalStore(noop, pageHost, () => "patternflow.work");
  const narrow = useGuideStore((s) => s.narrow);
  const opener = useRef<HTMLButtonElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [open, setOpen] = useState<{ from: HTMLElement; closing: boolean } | null>(null);
  const words = LAB_WINDOW_WORDS[lang];

  const close = useCallback(() => {
    setOpen((o) => (o && !o.closing ? { ...o, closing: true } : o));
  }, []);

  // Closing: focus goes back to the card once the window has flown back to
  // it; the frame stays loaded (hidden) until the lab's own save has run.
  useEffect(() => {
    if (!open?.closing) return;
    const back = window.setTimeout(() => opener.current?.focus({ preventScroll: true }), LIFT_MS);
    const gone = window.setTimeout(() => setOpen(null), UNLOAD_MS);
    return () => {
      window.clearTimeout(back);
      window.clearTimeout(gone);
    };
  }, [open?.closing]);

  // The screen got too small for the window and the board: close it.
  useEffect(() => {
    const mq = window.matchMedia(LIFT_QUERY);
    const onMedia = () => {
      if (!mq.matches) close();
    };
    mq.addEventListener("change", onMedia);
    const offNarrow = useGuideStore.subscribe((s, prev) => {
      if (s.narrow && !prev.narrow) close();
    });
    return () => {
      mq.removeEventListener("change", onMedia);
      offNarrow();
    };
  }, [close]);

  const chrome = (end: ReactNode) => (
    <span className={styles.miniBar}>
      <Lights />
      <Address host={host} />
      <span className={styles.chip} aria-hidden="true">
        {end}
        <OpenIcon />
      </span>
    </span>
  );
  const poster = (
    <span className={styles.mini}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a real capture of the lab, shown as is */}
      <img className={styles.poster} src={POSTER} alt="" width={LAB_W} height={LAB_H} loading="lazy" decoding="async" />
    </span>
  );

  if (!lift || narrow) {
    // A phone, or a screen too small for both: the lab in a tab of its own.
    return (
      <div className={styles.root} data-extra="labWindow" data-step-index={step}>
        <a className={styles.opener} href={LAB_PATH} target="_blank" rel="noopener" aria-label={`${words.phoneOpen} (${host}${LAB_PATH})`}>
          <span className={styles.miniWindow}>
            {chrome(words.open)}
            {poster}
          </span>
        </a>
      </div>
    );
  }

  return (
    <div className={styles.root} data-extra="labWindow" data-step-index={step}>
      <button
        ref={opener}
        type="button"
        className={styles.opener}
        aria-label={`${words.label} — ${words.open}`}
        aria-haspopup="dialog"
        aria-expanded={Boolean(open && !open.closing)}
        data-lifted={open && !open.closing ? "1" : "0"}
        onClick={(e) => setOpen({ from: e.currentTarget, closing: false })}
      >
        <span className={styles.miniWindow}>
          {chrome(words.open)}
          {poster}
        </span>
      </button>
      {open &&
        createPortal(
          <Lifted lang={lang} host={host} from={open.from} frame={frame} closing={open.closing} onClose={close} />,
          document.body,
        )}
    </div>
  );
}
