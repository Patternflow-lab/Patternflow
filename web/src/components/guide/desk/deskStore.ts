import { create } from "zustand";
import type { DeskWin } from "./types";

// The desk's shared state: what the pointer's tutorial is doing (for the
// step card's cue line, DeskCue), the reader's own choice of window in
// front, and the two ways a practice window talks to the tutorial — a handle
// it registers (registerDeskApp) and a named signal it raises (deskSignal).

/** Where the current step's tutorial is. `key` is "scene.step". */
export type DeskRun = {
  key: string;
  /** The beat on now (== total when done). */
  index: number;
  total: number;
  /** The pointer is parked on its target, waiting for the reader. */
  waiting: boolean;
  done: boolean;
  /** The current beat's hint, in the page's language (null if none). */
  say: string | null;
};

type DeskState = {
  /** The desk is up: the make page on a screen big enough for it (query.ts). */
  on: boolean;
  run: DeskRun | null;
  /** Bumped to replay: the key it is for, and a counter. */
  replay: { key: string; n: number };
  /** A window brought forward — by the reader clicking it, or by a beat pointing into it — for this step ("scene.step"). */
  raised: { key: string; win: DeskWin } | null;
  setOn: (on: boolean) => void;
  setRun: (run: DeskRun | null) => void;
  askReplay: (key: string) => void;
  raise: (key: string, win: DeskWin) => void;
};

export const useDeskStore = create<DeskState>((set, get) => ({
  on: false,
  run: null,
  replay: { key: "", n: 0 },
  raised: null,
  setOn: (on) => {
    if (get().on !== on) set({ on });
  },
  setRun: (run) => {
    const cur = get().run;
    if (
      cur === run ||
      (cur &&
        run &&
        cur.key === run.key &&
        cur.index === run.index &&
        cur.total === run.total &&
        cur.waiting === run.waiting &&
        cur.done === run.done &&
        cur.say === run.say)
    )
      return;
    set({ run });
  },
  askReplay: (key) => set({ replay: { key, n: get().replay.n + 1 } }),
  raise: (key, win) => {
    const cur = get().raised;
    if (cur && cur.key === key && cur.win === win) return;
    set({ raised: { key, win } });
  },
}));

// ── the card ⇄ the desk ─────────────────────────────────────────────────────

let focuser: (() => void) | null = null;

/** The desk says how to put keyboard focus where the pointer is working (DeskStage). */
export function setDeskFocuser(fn: (() => void) | null) {
  focuser = fn;
}

/** Put keyboard focus where the pointer is working: its window, on its control when that can take focus (the card's "Go to the window"). */
export function focusDesk() {
  focuser?.();
}

// ── practice windows ⇄ tutorial ─────────────────────────────────────────────

const apps = new Map<DeskWin, unknown>();

/**
 * A practice window hands the tutorial a handle (anything: functions a beat's
 * `run` or `done` can call through ctx.app(win)). Returns the unregister.
 */
export function registerDeskApp(win: DeskWin, handle: unknown): () => void {
  apps.set(win, handle);
  return () => {
    if (apps.get(win) === handle) apps.delete(win);
  };
}

export function deskApp<T = unknown>(win: DeskWin): T | null {
  return (apps.get(win) as T | undefined) ?? null;
}

type SignalListener = (name: string) => void;
const signalListeners = new Set<SignalListener>();

/** A practice window says something happened ("ai:answered"); a beat waiting on that `signal` goes on. */
export function deskSignal(name: string) {
  for (const l of signalListeners) l(name);
}

export function onDeskSignal(l: SignalListener): () => void {
  signalListeners.add(l);
  return () => {
    signalListeners.delete(l);
  };
}
