"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { LAB_STORAGE } from "@/lib/lab/persist";
import { useGuideStore, type GuideLang } from "../store";
import { DESK_APPS } from "./apps";
import { beatsFor, deskLayout, type Layout } from "./script";
import { setDeskFocuser, useDeskStore } from "./deskStore";
import { Pointer } from "./pointer";
import { DeskTutorial, type DeskEnv } from "./runner";
import { resolveTarget } from "./target";
import { usePrefersReducedMotion } from "./query";
import { DESK_WORDS, type DeskWords } from "./words";
import type { BigWin, DeskWin } from "./types";
import styles from "./Desk.module.css";

// The make page's stage (/guide/make, 01–02): a desk of app windows in the
// space left of the story, instead of the 3D device. A large window holds the
// reader's real Pattern Lab (/pattern-lab, same origin, its real storage); a
// practice community and a small practice AI (desk/apps/*) sit with it. Each
// step of the page says which windows are on the desk and which is in front
// (scenes/community.ts, scenes/lab.ts `desk`); windows come forward and
// recede with calm motion, and each is created once and kept alive — the Lab
// is never reloaded by scrolling.
//
// Over the windows, the guiding pointer (pointer.ts) plays the step's
// tutorial (tutorials/*.ts, runner.ts): it shows the way, then waits for the
// reader's own hands. In the Lab it never clicks anything.
//
// Mounted by GuideExperience only on a screen big enough (query.ts); below
// that, the make page's cards keep their screenshots instead.

const LAB_PATH = "/pattern-lab";
/** A real capture of the Lab as it opens (scratchpad lab_poster.py), shown until the frame has painted. */
const POSTER = "/guide/lab-window/lab.webp";
/**
 * The Lab's layout size: laid out at least this big, scaled down to the
 * window, never up — a big screen gets more Lab, not bigger type. It lays out
 * whole at 1024; the poster was captured at 1024 × 680.
 */
const LAB_W = 1024;
const LAB_H = 680;
/** What the keyboard can land on in a practice window. */
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Two big windows on the desk: the one behind peeks out this far above and left of the one in front. */
const CASCADE = 30;

type Role = "solo" | "fore" | "back" | "away";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// ── window chrome ───────────────────────────────────────────────────────────

function Lights() {
  return (
    <span className={styles.lights} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function Address({ host, path }: { host: string; path: string }) {
  return (
    <span className={styles.address}>
      <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.lock}>
        <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M5.5 7V5.4a2.5 2.5 0 0 1 5 0V7" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <span className={styles.url}>
        {host}
        <span className={styles.path}>{path}</span>
      </span>
    </span>
  );
}

function DeskWindow({
  win,
  role,
  dim,
  style,
  title,
  address,
  badge,
  words,
  onRaise,
  bodyRef,
  children,
}: {
  win: DeskWin;
  role: Role;
  dim: boolean;
  style: CSSProperties;
  title: string;
  address?: { host: string; path: string };
  badge?: string;
  words: DeskWords;
  onRaise: () => void;
  bodyRef: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  return (
    <section
      className={styles.win}
      data-win={win}
      data-role={role}
      data-dim={dim ? "1" : "0"}
      style={style}
      aria-label={title}
      inert={role === "away"}
      // A dimmed window the reader reaches into with the keyboard comes forward.
      onFocusCapture={dim ? onRaise : undefined}
    >
      <div className={styles.bar}>
        <Lights />
        <span className={styles.tab}>
          <i className={styles.favicon} aria-hidden="true" />
          <span className={styles.tabTitle}>{title}</span>
        </span>
        {address ? <Address host={address.host} path={address.path} /> : <span className={styles.barFill} />}
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      <div className={styles.body} ref={bodyRef}>
        {children}
      </div>
      {/* Over a dimmed window: a click brings it forward, and nothing under it is pressed by accident. */}
      <div className={styles.cover} aria-hidden="true" title={dim ? words.bringForward(title) : undefined} onClick={dim ? onRaise : undefined} />
    </section>
  );
}

// ── the Lab ─────────────────────────────────────────────────────────────────

function isEditable(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return Boolean(el.isContentEditable || el.closest("input, textarea, select, [contenteditable], .cm-editor"));
}

/**
 * The real Pattern Lab in the Lab window: laid out at LAB_W × LAB_H or more
 * and scaled to fit, the poster under it until it has painted. Nothing here
 * writes the Lab's storage or changes the Lab: it reads the frame's title and
 * address, sends the Lab's links out of the Lab to a new tab, and says when
 * the Lab in another tab saved over this one.
 */
function LabFrame({
  mount,
  frame,
  words,
  onReady,
  onTitle,
  onPath,
}: {
  mount: boolean;
  frame: RefObject<HTMLIFrameElement | null>;
  words: DeskWords;
  onReady: (ready: boolean) => void;
  onTitle: (title: string) => void;
  onPath: (path: string) => void;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [inner, setInner] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [otherTab, setOtherTab] = useState(false);
  const detach = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) setInner({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => detach.current?.(), []);

  const scale = inner ? Math.min(1, inner.w / LAB_W, inner.h / LAB_H) : 1;
  const labW = inner ? Math.ceil(inner.w / scale) : LAB_W;
  const labH = inner ? Math.ceil(inner.h / scale) : LAB_H;

  const onLoad = useCallback(() => {
    detach.current?.();
    detach.current = null;
    const el = frame.current;
    const win = el?.contentWindow ?? null;
    const doc = safe(() => el?.contentDocument ?? null, null);
    if (!win || !doc) return;
    if (doc.title) onTitle(doc.title);
    // The frame is there for the Lab. If it ever lands anywhere else, that
    // page opens in a tab of its own and the Lab comes back here.
    if (win.location.pathname !== LAB_PATH) {
      window.open(win.location.href, "_blank", "noopener");
      win.location.replace(LAB_PATH);
      return;
    }
    onPath(win.location.pathname + win.location.search);
    // A link out of the Lab opens beside the guide, not in place of the Lab.
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
    // The Lab in another tab saving the same draft: say so (the frame's
    // window hears saves from every document but its own).
    const onStorage = (e: StorageEvent) => {
      if (e.key === LAB_STORAGE.project) setOtherTab(true);
    };
    // Esc in the Lab, when the Lab isn't using it, gives the page the keyboard back.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || isEditable(e.target)) return;
      el?.blur();
      window.focus();
    };
    // The title changes as the Lab names its pattern.
    const titleEl = doc.querySelector("title");
    const mo = titleEl ? new MutationObserver(() => doc.title && onTitle(doc.title)) : null;
    if (titleEl) mo?.observe(titleEl, { childList: true, characterData: true, subtree: true });
    doc.addEventListener("click", onClick, true);
    win.addEventListener("storage", onStorage);
    win.addEventListener("keydown", onKey);
    detach.current = () => {
      safe(() => {
        doc.removeEventListener("click", onClick, true);
        win.removeEventListener("storage", onStorage);
        win.removeEventListener("keydown", onKey);
        mo?.disconnect();
      }, undefined);
    };
    // Shown once it has painted, over the picture of it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setReady(true);
        onReady(true);
      }),
    );
  }, [frame, onReady, onTitle, onPath]);

  return (
    <div ref={viewport} className={styles.labView} data-ready={ready ? "1" : "0"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a fixed poster under the frame until it paints */}
      <img className={styles.poster} src={POSTER} alt="" width={LAB_W} height={LAB_H} style={{ width: LAB_W * scale }} decoding="async" />
      {mount && (
        <iframe
          ref={frame}
          className={styles.labFrame}
          src={LAB_PATH}
          title="Pattern Lab"
          allow="clipboard-read; clipboard-write"
          onLoad={onLoad}
          style={{ width: labW, height: labH, transform: `scale(${scale})` }}
        />
      )}
      {otherTab && (
        <p className={styles.notice} role="status">
          <span>{words.otherTab}</span>
          <button type="button" className={styles.noticeClose} onClick={() => setOtherTab(false)} aria-label="OK">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </p>
      )}
    </div>
  );
}

// ── the pointer's elements ──────────────────────────────────────────────────

function PointerLayer({ layerRef }: { layerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={layerRef} className={styles.pointerLayer} data-shown="0" data-waiting="0" aria-hidden="true">
      <div className={styles.halo} data-part="halo" data-on="0" />
      <div className={styles.ripple} data-part="ripple" data-on="0" />
      <div className={styles.cursor} data-part="cursor">
        <svg viewBox="0 0 24 28" width="24" height="28">
          <path
            d="M3 2.2 L3 21.6 L8.1 16.9 L11.6 25 L15 23.5 L11.5 15.6 L18.6 15.3 Z"
            fill="#ff6a3d"
            stroke="#150a06"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M5 6.4 L5 17 L8.4 13.9" fill="none" stroke="rgba(255,236,224,0.7)" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
      </div>
      <div className={styles.bubble} data-part="bubble" data-on="0">
        <span className={styles.chip} data-part="chip" hidden />
        <span data-part="text" />
      </div>
    </div>
  );
}

function pointerEls(layer: HTMLDivElement) {
  const q = (part: string) => layer.querySelector<HTMLElement>(`[data-part="${part}"]`)!;
  return {
    layer,
    cursor: q("cursor"),
    ripple: q("ripple"),
    halo: q("halo"),
    bubble: q("bubble"),
    bubbleText: q("text"),
    bubbleChip: q("chip"),
  };
}

// ── the desk ────────────────────────────────────────────────────────────────

function roles(l: Layout): Record<BigWin, Role> {
  const big: BigWin[] = (["lab", "community"] as const).filter((w) => l.shown.has(w));
  const out: Record<BigWin, Role> = { lab: "away", community: "away" };
  if (big.length === 1) out[big[0]] = "solo";
  else if (big.length === 2) {
    out[l.top] = "fore";
    out[l.top === "lab" ? "community" : "lab"] = "back";
  }
  return out;
}

function bigStyle(role: Role, size: { w: number; h: number } | null, i: number): CSSProperties {
  const w = size?.w ?? 1000;
  const h = size?.h ?? 700;
  const s = Math.min((w - CASCADE) / w, (h - CASCADE) / h);
  switch (role) {
    case "solo":
      return { transform: "none", transformOrigin: "50% 50%", zIndex: 3 };
    case "fore":
      return { transform: `scale(${s.toFixed(4)})`, transformOrigin: "100% 100%", zIndex: 3 };
    case "back":
      return { transform: `scale(${s.toFixed(4)})`, transformOrigin: "0 0", zIndex: 2 };
    case "away":
      return { transform: `translate3d(${i ? 24 : -24}px, 22px, 0) scale(0.97)`, transformOrigin: "50% 50%", zIndex: 1 };
  }
}

export default function DeskStage({ lang }: { lang: GuideLang }) {
  const words = DESK_WORDS[lang];
  const scene = useGuideStore((s) => s.scene);
  const step = useGuideStore((s) => s.step);
  const key = `${scene}.${step}`;
  const raised = useDeskStore((s) => (s.raised && s.raised.key === key ? s.raised.win : null));
  const layout = useMemo(() => deskLayout(scene, step, raised), [scene, step, raised]);
  const reduced = usePrefersReducedMotion();

  const desk = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const bodies = useRef<Record<DeskWin, HTMLDivElement | null>>({ lab: null, community: null, ai: null });
  const contents = useRef<Record<"community" | "ai", HTMLDivElement | null>>({ community: null, ai: null });
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [labTitle, setLabTitle] = useState(words.labTitle);
  const [labPath, setLabPath] = useState(LAB_PATH);
  const [paths, setPaths] = useState({
    community: DESK_APPS.community.chrome.address?.path ?? "",
    ai: DESK_APPS.ai.chrome.address?.path ?? "",
  });
  // The Lab's frame is made the first time the Lab is on the desk for real
  // (not at rest behind the opening), then kept for the rest of the visit.
  const [labMounted, setLabMounted] = useState(false);
  const wantLab = layout.shown.has("lab") && !layout.rest;
  if (wantLab && !labMounted) setLabMounted(true);
  const labReady = useRef(false);

  // What the tutorial reads, current without re-making it.
  const now = useRef({ lang, reduced, layout, key, scene, step });
  useLayoutEffect(() => {
    now.current = { lang, reduced, layout, key, scene, step };
  });

  useLayoutEffect(() => {
    const el = desk.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The desk is up (the card's cue line shows), and the card can put focus in
  // it: in the window the pointer is working in now — on the control it
  // points at, when the keyboard can reach that — else the window in front.
  useEffect(() => {
    const st = useDeskStore.getState();
    st.setOn(true);
    setDeskFocuser(() => {
      const { layout: l, key: k, scene: sc, step: sp } = now.current;
      const run = useDeskStore.getState().run;
      const beat = run && run.key === k ? beatsFor(sc, sp)[run.index] : undefined;
      const win: DeskWin = beat && l.shown.has(beat.win) ? beat.win : l.front;
      if (win === "lab") {
        frame.current?.focus();
        return;
      }
      const root = contents.current[win];
      if (!root) return;
      let el: HTMLElement | null = null;
      if (beat?.win === win && beat.target) {
        const t = resolveTarget(root, beat.target);
        el = (t?.closest(FOCUSABLE) as HTMLElement | null) ?? null;
        if (el && !root.contains(el)) el = null;
      }
      // The practice AI: its message box, when the beat's target isn't something to press (its answer being written).
      if (!el && win === "ai") el = root.querySelector<HTMLElement>("[data-ai-input]");
      el ??= root.querySelector<HTMLElement>(FOCUSABLE);
      (el ?? root).focus();
    });
    return () => {
      setDeskFocuser(null);
      useDeskStore.getState().setOn(false);
      useDeskStore.getState().setRun(null);
    };
  }, []);

  // The tutorial and its pointer: made once, told each step.
  const tutorial = useRef<DeskTutorial | null>(null);
  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const pointer = new Pointer(pointerEls(el), () => now.current.reduced);
    const labDoc = () => safe(() => frame.current?.contentDocument ?? null, null);
    const env: DeskEnv = {
      lang: () => now.current.lang,
      reduced: () => now.current.reduced,
      doc: (win) => (win === "lab" ? labDoc() : document),
      root: (win) => (win === "lab" ? labDoc() : contents.current[win]),
      rectOf: (win, target) => {
        const r = target.getBoundingClientRect();
        if (win !== "lab") return r;
        const f = frame.current;
        if (!f || f.clientWidth < 1) return null;
        const fr = f.getBoundingClientRect();
        const k = fr.width / f.clientWidth;
        return new DOMRect(fr.left + r.left * k, fr.top + r.top * k, r.width * k, r.height * k);
      },
      box: (win) => {
        if (!now.current.layout.shown.has(win)) return null;
        return bodies.current[win]?.getBoundingClientRect() ?? null;
      },
      ready: (win) => (win === "lab" ? labReady.current : true),
      owns: (win, x, y) => {
        // The pointer's layer takes no pointer events: this is what's under it.
        const hit = document.elementFromPoint(x, y);
        const at = hit?.closest("[data-win]");
        return !at || at.getAttribute("data-win") === win;
      },
      bringForward: (win) => {
        const { layout: l, key: k } = now.current;
        if (win === "ai" || !l.shown.has(win) || l.top === win) return;
        useDeskStore.getState().raise(k, win);
      },
      report: (run) => useDeskStore.getState().setRun(run),
    };
    const t = new DeskTutorial(env, pointer);
    tutorial.current = t;
    const offReplay = useDeskStore.subscribe((s, prev) => {
      if (s.replay !== prev.replay && s.replay.key === now.current.key) t.replay();
    });
    return () => {
      offReplay();
      t.stop();
      pointer.destroy();
      tutorial.current = null;
    };
  }, []);

  useEffect(() => {
    tutorial.current?.start(key, beatsFor(scene, step));
  }, [key, scene, step]);

  const onLabReady = useCallback((r: boolean) => {
    labReady.current = r;
  }, []);
  const raise = useCallback((win: DeskWin) => useDeskStore.getState().raise(now.current.key, win), []);

  const r = roles(layout);
  const host = typeof window !== "undefined" ? window.location.host : "patternflow.work";
  const aiShown = layout.shown.has("ai");
  const aiW = Math.round(Math.max(300, Math.min(400, (size?.w ?? 900) * 0.42)));
  const aiH = Math.round(Math.max(300, Math.min(520, (size?.h ?? 700) * layout.aiHeight)));
  const aiRole: Role = aiShown ? "solo" : "away";

  const dimBig = (w: BigWin) => r[w] === "back" || (layout.rest && r[w] !== "away") || (layout.front === "ai" && r[w] !== "away");
  const appProps = (win: "community" | "ai") => ({
    lang,
    shown: layout.shown.has(win),
    front: layout.front === win,
    scene,
    step,
    reduced,
    setPath: (path: string) => setPaths((p) => (p[win] === path ? p : { ...p, [win]: path })),
  });

  const Community = DESK_APPS.community.Component;
  const Ai = DESK_APPS.ai.Component;
  const cc = DESK_APPS.community.chrome;
  const ac = DESK_APPS.ai.chrome;

  return (
    <div
      ref={desk}
      className={styles.desk}
      data-rest={layout.rest ? "1" : "0"}
      data-front={layout.front}
      data-reduced={reduced ? "1" : "0"}
      role="region"
      aria-label={words.deskLabel}
    >
      <DeskWindow
        win="community"
        role={r.community}
        dim={dimBig("community")}
        style={bigStyle(r.community, size, 0)}
        title={cc.title[lang]}
        address={cc.address ? { host: cc.address.host, path: paths.community } : undefined}
        badge={cc.badge?.[lang]}
        words={words}
        onRaise={() => raise("community")}
        bodyRef={(el) => {
          bodies.current.community = el;
        }}
      >
        <div
          className={styles.appRoot}
          ref={(el) => {
            contents.current.community = el;
          }}
        >
          <Community {...appProps("community")} />
        </div>
      </DeskWindow>

      <DeskWindow
        win="lab"
        role={r.lab}
        dim={dimBig("lab")}
        style={bigStyle(r.lab, size, 1)}
        title={labTitle}
        address={{ host, path: labPath }}
        badge={words.labBadge}
        words={words}
        onRaise={() => raise("lab")}
        bodyRef={(el) => {
          bodies.current.lab = el;
        }}
      >
        <LabFrame mount={labMounted} frame={frame} words={words} onReady={onLabReady} onTitle={setLabTitle} onPath={setLabPath} />
      </DeskWindow>

      <DeskWindow
        win="ai"
        role={aiRole}
        dim={layout.rest && aiShown}
        style={{
          width: aiW,
          height: aiH,
          ...(layout.ai === "bl" ? { left: 18, right: "auto" } : { right: 18, left: "auto" }),
          zIndex: 6,
        }}
        title={ac.title[lang]}
        address={ac.address ? { host: ac.address.host, path: paths.ai } : undefined}
        badge={ac.badge?.[lang]}
        words={words}
        onRaise={() => raise("ai")}
        bodyRef={(el) => {
          bodies.current.ai = el;
        }}
      >
        <div
          className={styles.appRoot}
          ref={(el) => {
            contents.current.ai = el;
          }}
        >
          <Ai {...appProps("ai")} />
        </div>
      </DeskWindow>

      <PointerLayer layerRef={layer} />
    </div>
  );
}
