"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent as ReactPointerEvent } from "react";
import cs from "@/components/community/Community.module.css";
import { deskSignal } from "../deskStore";
import { COMMUNITY_SIGNAL } from "./handle";
import { DECK_MAX, MODULE_KB, patternById } from "./data";
import { PRACTICE_DRAG_TYPE, Screen } from "./parts";
import { usePractice } from "./state";
import ps from "./Practice.module.css";

// The deck bar along the bottom (components/community/DeckDock.tsx), on the
// practice's local deck: drag a slot to reorder it, drag it onto ✕ to throw
// it out, press ✕ twice to empty the lot, drop a card from the wall onto the
// bar to add it. Send to my board does not reach a build server here: it
// says what would (words.ts "built") and shows the bar's own next states.

/** The row never shows fewer places than this (DeckDock MIN_PLACES). */
const MIN_PLACES = 3;
const buildExpectedS = (n: number) => Math.ceil(6 + 1.5 * Math.max(1, n));

type Drag = { index: number; startX: number; dx: number; step: number; overTrash: boolean };

export default function Dock() {
  const deck = usePractice((s) => s.deck);
  const build = usePractice((s) => s.build);
  const builtN = usePractice((s) => s.builtN);
  const knobs = usePractice((s) => s.knobs);
  const st = usePractice.getState;

  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [settling, setSettling] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [dropNote, setDropNote] = useState<string | null>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const settleRef = useRef(0);
  const timers = useRef<number[]>([]);
  useEffect(
    () => () => {
      cancelAnimationFrame(settleRef.current);
      for (const t of timers.current) window.clearTimeout(t);
    },
    [],
  );
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  // Send to my board goes disabled while it builds and then gives way to
  // Send over Wi-Fi: the keyboard is handed on to it rather than dropped.
  const wifiRef = useRef<HTMLButtonElement>(null);
  const handOn = useRef(false);
  useEffect(() => {
    if (build === "done" && handOn.current) {
      handOn.current = false;
      wifiRef.current?.focus({ preventScroll: true });
    }
  }, [build]);

  // ── dragging a slot (DeckDock's own maths) ──────────────────────────────────

  const landing = drag ? Math.max(0, Math.min(deck.length - 1, drag.index + Math.round(drag.dx / drag.step))) : -1;

  const endDrag = useCallback(() => {
    const cur = dragRef.current;
    dragRef.current = null;
    if (!cur) {
      setDrag(null);
      return;
    }
    setSettling(true);
    const now = usePractice.getState();
    if (cur.overTrash) {
      const doomed = now.deck[cur.index];
      if (doomed) {
        now.remove(doomed);
        deskSignal(COMMUNITY_SIGNAL.removed);
      }
    } else {
      const to = Math.max(0, Math.min(now.deck.length - 1, cur.index + Math.round(cur.dx / cur.step)));
      if (to !== cur.index) {
        now.reorder(cur.index, to);
        deskSignal(COMMUNITY_SIGNAL.reordered);
      }
    }
    setDrag(null);
    cancelAnimationFrame(settleRef.current);
    settleRef.current = requestAnimationFrame(() => {
      settleRef.current = requestAnimationFrame(() => setSettling(false));
    });
  }, []);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      const bin = trashRef.current?.getBoundingClientRect();
      const overTrash = bin ? e.clientX >= bin.left && e.clientX <= bin.right && e.clientY >= bin.top && e.clientY <= bin.bottom : false;
      const next = { ...cur, dx: e.clientX - cur.startX, overTrash };
      dragRef.current = next;
      setDrag(next);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [drag, endDrag]);

  const startDrag = (index: number) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    const row = slotsRef.current;
    if (!row) return;
    e.preventDefault();
    const boxes = [...row.children].map((c) => c.getBoundingClientRect());
    const step = boxes.length > 1 ? boxes[1].left - boxes[0].left : (boxes[0]?.width ?? 34);
    const started = { index, startX: e.clientX, dx: 0, step, overTrash: false };
    dragRef.current = started;
    setDrag(started);
  };

  const shiftFor = (index: number): string => {
    if (!drag) return "";
    if (index === drag.index) return `translateX(${drag.dx}px)`;
    if (drag.overTrash) return "";
    if (drag.index < landing && index > drag.index && index <= landing) return `translateX(${-drag.step}px)`;
    if (drag.index > landing && index < drag.index && index >= landing) return `translateX(${drag.step}px)`;
    return "";
  };

  // ── a card dropped in from the wall ─────────────────────────────────────────

  const carries = (e: DragEvent) => e.dataTransfer.types.includes(PRACTICE_DRAG_TYPE);
  const onDragOver = (e: DragEvent) => {
    if (!carries(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dropping) setDropping(true);
  };
  const onDrop = (e: DragEvent) => {
    if (!carries(e)) return;
    e.preventDefault();
    setDropping(false);
    const id = e.dataTransfer.getData(PRACTICE_DRAG_TYPE);
    const now = usePractice.getState();
    if (now.deck.includes(id)) return;
    if (now.add(id)) deskSignal(COMMUNITY_SIGNAL.added);
    else {
      setDropNote(`A deck holds ${DECK_MAX} patterns — that is what fits in one build. Take one out to make room.`);
      later(() => setDropNote(null), 2500);
    }
  };

  const shown = Math.min(DECK_MAX, Math.max(MIN_PLACES, deck.length + 1));
  const slots = Array.from({ length: shown }, (_, i) => deck[i] ?? null);
  const running = build === "running";
  const done = build === "done";

  return (
    <div
      className={`${cs.deckDock} ${ps.dock}`}
      data-dragging={drag !== null}
      data-settling={settling}
      data-dropping={dropping}
      data-pc="dock"
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false);
      }}
      onDrop={onDrop}
    >
      <span className={`${cs.deckDockLabel} ${ps.dockLabel}`}>
        Your deck
        <b>
          {deck.length} / {DECK_MAX}
        </b>
      </span>

      <div className={cs.deckDockSlots} ref={slotsRef} data-pc="slots">
        {slots.map((id, i) => {
          const p = id ? patternById(id) : null;
          return p ? (
            <span
              key={p.id}
              className={cs.deckDockSlot}
              data-drag={drag?.index === i}
              data-doomed={drag?.index === i && drag.overTrash}
              data-pc-slot={i}
              data-pc-last={i === deck.length - 1 ? "1" : undefined}
              style={{ transform: shiftFor(i) }}
              title={`${i + 1}. ${p.title} — drag to reorder, or onto the ✕ to remove`}
              aria-label={`${i + 1}. ${p.title} — drag to reorder, or onto the ✕ to remove`}
              // The keyboard's drag (the practice's own addition): ← → move the slot, Delete takes it out.
              tabIndex={0}
              onKeyDown={(e) => {
                const now = usePractice.getState();
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const to = i + (e.key === "ArrowLeft" ? -1 : 1);
                  if (to < 0 || to >= now.deck.length) return;
                  now.reorder(i, to);
                  deskSignal(COMMUNITY_SIGNAL.reordered);
                  const row = slotsRef.current;
                  requestAnimationFrame(() => row?.querySelector<HTMLElement>(`[data-pc-slot="${to}"]`)?.focus({ preventScroll: true }));
                } else if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  now.remove(p.id);
                  deskSignal(COMMUNITY_SIGNAL.removed);
                }
              }}
              onPointerDown={startDrag(i)}
            >
              <div className={cs.canvasFill}>
                <Screen skey={p.id} code={p.code} knobs={knobs[p.id]} />
              </div>
              <span className={cs.deckDockOrder}>{i + 1}</span>
            </span>
          ) : i === deck.length ? (
            <span key={`next-${i}`} className={cs.deckDockNext} aria-hidden="true" data-pc="next">
              +
            </span>
          ) : (
            <span key={`empty-${i}`} className={cs.deckDockEmpty} aria-hidden="true" />
          );
        })}
      </div>

      <span className={cs.deckDockBinArea}>
        <button
          type="button"
          ref={trashRef}
          className={cs.deckDockTrash}
          data-armed={drag?.overTrash === true}
          data-confirm={confirmEmpty}
          data-pc="bin"
          disabled={deck.length === 0}
          aria-label={confirmEmpty ? "Press again to empty the deck" : "Empty the deck, or drag a pattern here to remove it"}
          title={confirmEmpty ? "Press again to empty the deck" : "Drag a pattern here to remove it — or click to empty the deck"}
          onClick={() => {
            if (deck.length === 0) return;
            if (confirmEmpty) {
              st().clear();
              setConfirmEmpty(false);
            } else {
              setConfirmEmpty(true);
              later(() => setConfirmEmpty(false), 4000);
            }
          }}
        >
          ✕
        </button>
        <span className={cs.deckDockCount} data-warn={confirmEmpty}>
          {dropNote
            ? dropNote
            : confirmEmpty
              ? `press ✕ again to empty all ${deck.length}`
              : dropping
                ? "drop it here to add it"
                : deck.length === 0
                  ? "drag a pattern down here, or press its +"
                  : "drag to rearrange · ✕ removes"}
        </span>
      </span>

      <span className={cs.deckDockSpacer} />

      {done ? (
        <>
          <span className={cs.buildDoneNote}>
            ✓ {builtN} module{builtN === 1 ? "" : "s"} · {builtN * MODULE_KB} KB
          </span>
          <button type="button" className={cs.deckDockLink} onClick={() => st().say("zip")}>
            ↓ .zip
          </button>
          <button type="button" ref={wifiRef} className={cs.deckDockSend} data-pc="dock-wifi" onClick={() => st().say("sentDeck", builtN)}>
            Send over Wi-Fi
          </button>
          <button type="button" className={cs.deckDockLink} aria-label="Dismiss the finished build" onClick={() => st().clearBuild()}>
            ✕
          </button>
        </>
      ) : (
        <>
          {deck.length > 0 && !running && (
            <button type="button" className={cs.deckDockLink} onClick={() => st().say("share")}>
              Share deck
            </button>
          )}
          {running && (
            <span className={cs.buildRunningNote} title={`About half a second per pattern, and under ${buildExpectedS(builtN)} on a busy server.`}>
              <span className={cs.buildSpinner} aria-hidden="true" />
              Building {builtN} module{builtN === 1 ? "" : "s"}
              <em>usually under {buildExpectedS(builtN)} s</em>
            </span>
          )}
          <button
            type="button"
            className={cs.deckDockSend}
            data-pc="dock-send"
            disabled={deck.length === 0 || running}
            title={deck.length === 0 ? "Add patterns to the deck first" : "Build the deck as loadable modules and install it over Wi-Fi"}
            onClick={(e) => {
              handOn.current = document.activeElement === e.currentTarget;
              st().startBuild();
            }}
          >
            {running ? "Building…" : "Send to my board"}
          </button>
        </>
      )}
    </div>
  );
}
