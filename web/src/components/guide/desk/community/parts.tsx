"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { knobSetupFromCode } from "@/lib/community/knobs";
import { describeMatrixShape, matrixFromCode } from "@/lib/pattern/matrix";
import cs from "@/components/community/Community.module.css";
import { deskSignal } from "../deskStore";
import type { GuideLang } from "../../store";
import { COMMUNITY_SIGNAL } from "./handle";
import { attachScreen, type ScreenCtl } from "./live";
import { DECK_MAX, type PracticePattern } from "./data";
import { usePractice } from "./state";
import { PRACTICE_WORDS, type NoteKey } from "./words";
import ps from "./Practice.module.css";

// The practice community's small parts: a pattern on its screen, the wall's
// card (components/community/PatternCard.tsx, rebuilt on local state), the
// link the real site's <Link>s become, and the practice's own note.

/** What a card drags onto the deck bar (the real one is lib/community/deck.ts DECK_DRAG_TYPE). */
export const PRACTICE_DRAG_TYPE = "application/x-patternflow-practice";

/**
 * The real site's links, here: an <a> (so the community's `a` styles apply
 * and the keyboard reaches it) that stays on this page and does `go`.
 */
export function PLink({
  go,
  className,
  children,
  pc,
  active,
  current = false,
  title,
}: {
  go: () => void;
  className?: string;
  children: ReactNode;
  /** A name for the tutorial to find it by (data-pc). */
  pc?: string;
  /** The real link's data-active, when it has one. */
  active?: boolean;
  /** It is the page shown (aria-current). */
  current?: boolean;
  title?: string;
}) {
  return (
    <a
      href="#practice"
      className={className}
      data-pc={pc}
      data-active={active}
      aria-current={current ? "page" : undefined}
      title={title}
      onClick={(e) => {
        e.preventDefault();
        go();
      }}
    >
      {children}
    </a>
  );
}

/** A pattern on a canvas, turned a quarter for the 1:2 wells as the real cards turn it. */
export function Screen({
  skey,
  code,
  knobs,
  playing = false,
}: {
  skey: string;
  code: string;
  knobs?: number[];
  playing?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<ScreenCtl | null>(null);
  const setup = useMemo(() => knobSetupFromCode(code), [code]);
  const values = knobs ?? setup.values;
  const rotate = describeMatrixShape(matrixFromCode(code)) === "landscape";
  // The first knobs and play state, for attaching; later ones go through set().
  const first = useRef({ values, playing });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    ctl.current = attachScreen(c, {
      key: skey,
      code,
      knobs: first.current.values,
      ranges: setup.ranges,
      playing: first.current.playing,
    });
    return () => {
      ctl.current?.detach();
      ctl.current = null;
    };
  }, [skey, code, setup]);

  useEffect(() => {
    ctl.current?.set({ knobs: values, playing });
  }, [values, playing]);

  return (
    <div className={rotate ? cs.screenRotator : cs.screenUpright}>
      <canvas ref={ref} className={ps.canvas} aria-hidden="true" />
    </div>
  );
}

// The card's two corner marks, as PatternCard draws them.
const ICON = { viewBox: "0 0 16 16", width: 15, height: 15 } as const;

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg {...ICON} aria-hidden="true" focusable="false">
      <path
        d="M8 13.55 3.05 8.6a3.05 3.05 0 0 1 4.31-4.31L8 4.93l.64-.64a3.05 3.05 0 0 1 4.31 4.31z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusMinusIcon({ minus }: { minus: boolean }) {
  return (
    <svg {...ICON} aria-hidden="true" focusable="false">
      <path d={minus ? "M3.6 8h8.8" : "M3.6 8h8.8M8 3.6v8.8"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

/** One notch of a card's knob, as the wheel turns it (PatternCard handleWheel: a 25th of its range). */
function turnKnob(id: string, ranges: Array<[number, number]>, k: number, dir: 1 | -1) {
  const st = usePractice.getState();
  const next = st.knobsOf(id).slice();
  const [min, max] = ranges[k] ?? [0, 1];
  next[k] = Number(Math.max(min, Math.min(max, (next[k] ?? min) + (dir * Math.max(0.001, max - min)) / 25)).toFixed(3));
  st.setKnobs(id, next);
  deskSignal(COMMUNITY_SIGNAL.turned);
}

/**
 * One wall card, as components/community/PatternCard.tsx: it plays while the
 * mouse is on it, the wheel over its screen turns the knob under the pointer
 * (the screen is K1–K4, left to right), + puts a pattern with a .h in the
 * deck, and the card drags onto the deck bar. The heart is local.
 */
export function PatternCard({ p }: { p: PracticePattern }) {
  const setup = useMemo(() => knobSetupFromCode(p.code), [p.code]);
  const knobs = usePractice((s) => s.knobs[p.id]) ?? setup.values;
  const inDeck = usePractice((s) => s.deck.includes(p.id));
  const liked = usePractice((s) => Boolean(s.liked[p.id]));
  const demo = usePractice((s) => (s.demo && s.demo.id === p.id ? s.demo : null));
  const [hovered, setHovered] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [overlayPos, setOverlayPos] = useState<"bottom" | "top">("bottom");
  const [activeKnob, setActiveKnob] = useState(0);
  const [deckNote, setDeckNote] = useState<string | null>(null);
  const rootRef = useRef<HTMLAnchorElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const live = useRef({ activeKnob });
  useEffect(() => {
    live.current = { activeKnob };
  });

  // The wheel belongs to the knobs on a card (PatternCard's non-passive
  // listener: preventDefault is the point). Ctrl+wheel passes to the wall.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      e.preventDefault();
      if (!thumbRef.current?.contains(e.target as Node)) return;
      turnKnob(p.id, setup.ranges, live.current.activeKnob, e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [p.id, setup]);

  const lit = hovered || demo !== null;
  const overlayShowing = (hovered && onScreen) || demo !== null;
  const pos = demo ? "top" : overlayPos;
  const k = demo ? 0 : activeKnob;
  const edge = overlayShowing && pos === "bottom" ? cs.deckTop : cs.deckBottom;
  const noteEdge = overlayShowing && pos === "bottom" ? cs.deckNoteTop : cs.deckNoteBottom;
  const label = setup.labels[k] ?? `Knob ${k + 1}`;
  const value = knobs[k] ?? 0;
  const [kMin, kMax] = setup.ranges[k] ?? [0, 1];
  const norm = (value - kMin) / Math.max(0.001, kMax - kMin);

  const open = () => usePractice.getState().go({ kind: "pattern", id: p.id });
  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <a
      ref={rootRef}
      href="#practice"
      className={`${cs.card} ${lit ? ps.lit : ""}`}
      data-pc-card={p.id}
      onClick={(e) => {
        e.preventDefault();
        open();
      }}
      // The keyboard's wheel (the practice's own addition): ↑ ↓ turn K1 while the card has focus.
      onKeyDown={(e) => {
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        turnKnob(p.id, setup.ranges, 0, e.key === "ArrowUp" ? 1 : -1);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setOnScreen(false);
        setOverlayPos("bottom");
      }}
      onDragStart={(e) => {
        if (!p.hasCpp) return;
        e.dataTransfer.setData(PRACTICE_DRAG_TYPE, p.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
    >
      <div
        ref={thumbRef}
        className={`${cs.cardThumb} ${ps.thumb}`}
        data-pc-screen={p.id}
        onMouseEnter={() => setOnScreen(true)}
        onMouseLeave={() => setOnScreen(false)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
          const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
          setActiveKnob(Math.min(3, Math.floor((x / r.width) * 4)));
          const fy = y / r.height;
          if (fy > 0.55) setOverlayPos("top");
          else if (fy < 0.45) setOverlayPos("bottom");
        }}
      >
        {p.hasCpp && (
          <span className={cs.cardHwBadge} title="Hardware ready — ships a .h firmware header" data-pc="hw">
            .h
          </span>
        )}
        <Screen skey={p.id} code={p.code} knobs={knobs} playing={lit} />

        {p.hasCpp && (
          <button
            type="button"
            className={`${cs.cardDeckBtn} ${ps.cornerBtn} ${edge} ${inDeck ? cs.cardDeckBtnOn : ""}`}
            title={inDeck ? "In your deck — click to remove" : "Add to your deck"}
            aria-label={inDeck ? "Remove from your deck" : "Add to your deck"}
            data-pc-plus={p.id}
            onClick={(e) => {
              stop(e);
              const st = usePractice.getState();
              if (st.deck.includes(p.id)) {
                st.remove(p.id);
                return;
              }
              if (st.add(p.id)) deskSignal(COMMUNITY_SIGNAL.added);
              else {
                setDeckNote(`A deck holds ${DECK_MAX} patterns — that is what fits in one build. Take one out to make room.`);
                window.setTimeout(() => setDeckNote(null), 2500);
              }
            }}
          >
            <PlusMinusIcon minus={inDeck} />
          </button>
        )}
        <button
          type="button"
          className={`${cs.cardDeckBtn} ${ps.cornerBtn} ${p.hasCpp ? cs.cardLikeBtnBeside : ""} ${edge} ${liked ? cs.cardLikeBtnOn : ""}`}
          title={liked ? "Liked — click to unlike" : "Like this pattern"}
          aria-pressed={liked}
          aria-label={liked ? "Unlike this pattern" : "Like this pattern"}
          onClick={(e) => {
            stop(e);
            usePractice.getState().toggleLike(p.id);
          }}
        >
          <HeartIcon filled={liked} />
        </button>
        {deckNote && <span className={`${cs.cardDeckNote} ${noteEdge}`}>{deckNote}</span>}

        <div
          className={`${cs.knobOverlay} ${pos === "top" ? cs.overlayTop : cs.overlayBottom}`}
          style={{ opacity: overlayShowing ? 1 : 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <div className={cs.knobZoneBarInMeta}>
            {setup.labels.map((l, i) => (
              <div key={i} className={`${cs.knobSegmentInMeta} ${i === k ? cs.activeKnobSegment : ""}`}>
                <span>K{i + 1}</span>
              </div>
            ))}
          </div>
          <div className={cs.metaKnobStatus}>
            <div className={cs.metaKnobInfoRow}>
              <span className={cs.metaKnobLabel}>
                K{k + 1} {label.slice(0, 8)}
              </span>
              <strong className={cs.metaKnobVal}>{value}</strong>
            </div>
            <div className={cs.metaKnobTrack}>
              <div className={cs.metaKnobFill} style={{ width: `${Math.round(norm * 100)}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className={cs.cardMeta}>
        <div className={cs.cardTitle}>
          <span className={cs.cardTitleText} data-pc-title={p.id}>
            {p.title}
          </span>
        </div>
        <div className={cs.cardByline}>
          <span className={cs.userLink}>@{p.handle}</span>
          <span className={cs.cardStats}>{liked && <span title="1 likes">LIK 01</span>}</span>
        </div>
      </div>
    </a>
  );
}

/** A deck's strip of its first patterns (DeckCard, ShippedPackCard): five cells, stills. */
export function DeckStrip({ cells, total }: { cells: { key: string; skey?: string; code: string }[]; total: number }) {
  const shown = cells.slice(0, 4);
  const more = total - shown.length;
  const blanks = Math.max(0, 5 - shown.length - (more > 0 ? 1 : 0));
  return (
    <div className={cs.deckStrip}>
      {shown.map((c) => (
        <div key={c.key} className={cs.deckStripSlot}>
          {/* Keyed by pattern where it has one, so a pattern's still is made once for every strip it is in. */}
          <Screen skey={c.skey ?? c.key} code={c.code} />
        </div>
      ))}
      {more > 0 && <span className={cs.deckStripMore}>+{more}</span>}
      {Array.from({ length: blanks }, (_, i) => (
        <span key={`blank-${i}`} className={cs.deckStripBlank} aria-hidden="true" />
      ))}
    </div>
  );
}

/** The practice's own note: what would happen for real, and that here nothing did. */
export function PracticeNote({
  lang,
  noteKey,
  n,
  inline = false,
  onClose,
}: {
  lang: GuideLang;
  noteKey: NoteKey;
  n: number;
  inline?: boolean;
  onClose?: () => void;
}) {
  const w = PRACTICE_WORDS[lang];
  return (
    <div className={`${ps.note} ${inline ? ps.noteInline : ""}`} role="status" data-pc-note={noteKey}>
      <span className={ps.noteTag}>{w.tag}</span>
      <span className={ps.noteText}>{w.note(noteKey, n)}</span>
      {onClose && (
        <button type="button" className={ps.noteClose} onClick={onClose} aria-label={w.close}>
          ✕
        </button>
      )}
    </div>
  );
}
