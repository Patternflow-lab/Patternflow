import type { ComponentType } from "react";
import type { GuideLang } from "../store";

// The make page's desk (/guide/make): app windows left of the story, and a
// drawn pointer that shows the reader what to do in them. These are the types
// the chapters write against:
//
//   scenes/community.ts, scenes/lab.ts   which windows each step shows   (DeskPlacement)
//   tutorials/community.ts, tutorials/lab.ts   what the pointer does there  (Tutorial of Beats)
//   desk/apps/community.tsx, desk/apps/ai.tsx   the practice windows' content (DeskApp)
//
// The Lab window is the real /pattern-lab in a frame and belongs to the desk
// itself (DeskStage.tsx); the other two are practice windows the chapters
// fill in.

/** The desk's windows: the real Pattern Lab, the practice community, the practice AI. */
export type DeskWin = "lab" | "community" | "ai";

/** The two big windows; the AI window is small and sits over a corner of them. */
export type BigWin = Exclude<DeskWin, "ai">;

/**
 * Which windows a step puts on the desk (a make-page scene step's `desk`).
 *
 * `front` is the one the step is about: on top and lit. The others in `show`
 * stay on the desk: a big window behind it (dimmed, its title bar peeking
 * out — a click brings it forward), the AI window over a bottom corner. A
 * window not in `show` leaves the desk, but its content is kept alive: the
 * Lab is never reloaded, a practice window keeps its state.
 */
export type DeskPlacement = {
  front: DeskWin;
  /**
   * Default: just `front` — and, if `front` is the AI, the Lab under it.
   * List `front` here too when you give it.
   */
  show?: DeskWin[];
  /** Which bottom corner the AI window sits in (default "br"). */
  ai?: "br" | "bl";
  /**
   * The AI window's height, as a share of the desk's (default 0.64; it stays
   * within 300–520 px). Lower it where the window would cover the control the
   * step is about.
   */
  aiHeight?: number;
  /** Nothing is being shown yet: every window dimmed (the opening, the end). */
  rest?: boolean;
};

/**
 * What the pointer is to point at, inside its window: a CSS selector; an
 * element whose words match (its text, aria-label, title, placeholder or a
 * button's value — equal after collapsing whitespace, or a RegExp), among
 * `among` (default: target.ts CONTROLS — buttons, links, fields, tabs); or a
 * function given the window's root.
 *
 * In the Lab it is looked for in the Lab's own document (the frame), in a
 * practice window only inside that window's content. The first match that
 * takes up room on screen wins; `nth` picks a later one.
 */
export type Target =
  | string
  | { text: string | RegExp; among?: string; nth?: number }
  | ((root: ParentNode) => Element | null);

/** What the pointer does at its target. */
export type BeatDo = "point" | "press" | "type" | "paste" | "drag" | "scroll";

/** Handed to a beat's hooks. */
export type BeatCtx = {
  lang: GuideLang;
  /** The beat's target as found now (null if it isn't there). */
  el: Element | null;
  /** A window's document: the Lab's frame document for "lab", this page for the others; null if not there yet. */
  doc: (win: DeskWin) => Document | null;
  /** Where a window's targets are looked for: the Lab's document, or a practice window's content element. */
  root: (win: DeskWin) => ParentNode | null;
  /** The handle a practice window registered (registerDeskApp), if any. */
  app: <T = unknown>(win: DeskWin) => T | null;
  /** When the step began (performance.now()): what a practice window stamps later happened during this step. */
  since: number;
  /** The step's notes: a beat's `begin` writes a baseline here as the step starts, its `done`/`skipIf` read it. */
  memo: Map<string, unknown>;
};

/**
 * One beat of a step's tutorial: the pointer glides to `target` in `win`,
 * does `do` there, and then waits — for the reader (`until: "reader"`, the
 * default for everything but "point") or for `until` ms ("point" defaults
 * to 1400 ms).
 *
 * The reader has done it when, after the beat starts, any of these happens:
 * an `on` event inside the target (default: press/point → click, type →
 * input, paste → paste, drag → drop or pointerup inside `to`, scroll → wheel
 * or scroll), the named `signal` is raised (deskSignal, from a practice
 * window), or `done()` answers true (asked four times a second). A reader
 * beat listens from the moment it starts, while the pointer is still on its
 * way: a reader quicker than the pointer is not missed. Events and signals
 * only count once the beat has started, so give a beat that can be done
 * early (in the gap while the previous one is acknowledged) a `done()` that
 * reads state — ctx.since and ctx.memo are for that. `skipIf` true when the
 * beat starts (and at any time while it waits) passes it without waiting
 * (the reader is already past it); it must not have side effects — note a
 * baseline in `begin` instead.
 *
 * In a practice window, when a waiting beat's target was on screen and has
 * been gone a second (the reader wandered off to another page), the step
 * starts over from its first beat: write the first beats so their `skipIf`s
 * pass what is done and lead the reader back.
 *
 * The pointer never clicks, types or pastes in the Lab: there it only shows
 * the gesture, and the reader's own hands do the work. In a practice window
 * a beat that does NOT wait for the reader (`until` is a number) acts it out
 * for real — press clicks the target, type types `text` into it, paste puts
 * `text` in it, scroll scrolls it — so a demo can run before handing over.
 * "Show me again" replays the pointer's movement only, never these actions.
 */
export type Beat = {
  win: DeskWin;
  /** None: the pointer rests in the middle of the window. */
  target?: Target;
  /** Default "point". */
  do?: BeatDo;
  /** Where a drag ends (same window). */
  to?: Target;
  /** What a demo types or pastes (practice windows only). */
  text?: string;
  /** "reader": wait for the reader; a number: go on after that many ms. */
  until?: "reader" | number;
  /** DOM events (inside the target — or `to`, for a drag) that count as the reader doing it. */
  on?: string | string[];
  /** A deskSignal name that counts as the reader doing it. */
  signal?: string;
  done?: (ctx: BeatCtx) => boolean;
  skipIf?: (ctx: BeatCtx) => boolean;
  /**
   * Called once for every beat of the step as the step starts (after its
   * windows have loaded), before the first beat plays: note a baseline in
   * ctx.memo for this beat's `done` to compare with.
   */
  begin?: (ctx: BeatCtx) => void;
  /**
   * A side effect when the gesture happens (practice windows; never during
   * "Show me again"). May return a cleanup, run when the step is left.
   */
  run?: (ctx: BeatCtx) => void | (() => void);
  /** A short hint beside the pointer (and in the card's cue line). */
  say?: Record<GuideLang, string>;
  /**
   * Where the hint sits (default: below right of the tip, flipped to stay on
   * the desk): "above" the target, or "left" of it — for a target whose
   * neighbours below the reader needs to read.
   */
  bubble?: "above" | "left";
  /** Where on the target the tip rests, as fractions of its box (default [0.5, 0.6]; big targets are capped near their top left). */
  at?: [number, number];
};

/** A chapter's tutorial: the beats of each step, by step index (a missing or empty entry: no pointer on that step). */
export type Tutorial = (Beat[] | undefined)[];

/** What a practice window's content is given. */
export type DeskAppProps = {
  lang: GuideLang;
  /** On the desk this step (in front or not). */
  shown: boolean;
  /** The one the step is about (lit, on top). */
  front: boolean;
  /** Where the reader is (the page's scene and step), e.g. "community", 2. */
  scene: string;
  step: number;
  /** The reader asked for less motion: no typing effects, no glides. */
  reduced: boolean;
  /** Change the path in the window's address bar (a practice site moving between its pages). */
  setPath: (path: string) => void;
};

/** A practice window: its chrome and its content. */
export type DeskApp = {
  chrome: {
    /** The tab's (or, with no address, the window's) title. */
    title: Record<GuideLang, string>;
    /** An address bar, for a website; none for an app. */
    address?: { host: string; path: string };
    /** A small tag at the end of the bar, e.g. "Practice". */
    badge?: Record<GuideLang, string>;
  };
  Component: ComponentType<DeskAppProps>;
};
