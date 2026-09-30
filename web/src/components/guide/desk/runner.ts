import type { GuideLang } from "../store";
import { deskApp, onDeskSignal, type DeskRun } from "./deskStore";
import type { Aim, Pointer } from "./pointer";
import { fieldOf, resolveTarget, setFieldValue, targetHas } from "./target";
import type { Beat, BeatCtx, BeatDo, DeskWin, Target } from "./types";

// A step's tutorial, played: beat by beat, the pointer glides to the beat's
// target, shows the gesture, and — on a "reader" beat — parks there until
// the reader has done it themselves. Leaving the step (start() with another
// key, or stop()) cancels it cleanly: listeners off, timers off, every
// cleanup a beat's `run` returned called.
//
// A reader beat listens from the moment it starts, not from when the pointer
// arrives: a reader who is quicker than the pointer is not kept waiting for
// something they already did. A step the reader has finished stays finished
// for the visit: coming back to it shows "Done", and "Show me again" replays
// its gestures.
//
// Nothing here throws into the page: a target that isn't there hides the
// pointer, a hook that throws counts as false, and the step reads fine
// without any of it.

/** What the runner needs from the desk (DeskStage provides it). */
export type DeskEnv = {
  lang: () => GuideLang;
  reduced: () => boolean;
  /** A window's document: the Lab's frame document, or this page. */
  doc: (win: DeskWin) => Document | null;
  /** Where a window's targets are looked for. */
  root: (win: DeskWin) => ParentNode | null;
  /** An element of a window, in page px (through the Lab frame's scale). */
  rectOf: (win: DeskWin, el: Element) => DOMRect | null;
  /** A window's visible content box in page px; null when it isn't on the desk. */
  box: (win: DeskWin) => DOMRect | null;
  /** The window's content has loaded (the Lab's frame); practice windows always have. */
  ready: (win: DeskWin) => boolean;
  /** A beat points into this window: bring it to the front if it's on the desk behind another. */
  bringForward: (win: DeskWin) => void;
  /** The point (page px) shows this window, not another window over it. Optional: default yes. */
  owns?: (win: DeskWin, x: number, y: number) => boolean;
  report: (run: DeskRun | null) => void;
};

type Token = {
  dead: boolean;
  aborts: Set<() => void>;
  cleanups: (() => void)[];
};

/** A token that dies with its parent, or on its own when killed. */
type Child = Token & { kill: () => void };

/** How a reader beat ended: done, the step was left, or the reader wandered off and the step starts over. */
type Outcome = "done" | "left" | "restart";

const DEFAULT_ON: Record<BeatDo, string[]> = {
  point: ["click"],
  press: ["click"],
  type: ["input"],
  paste: ["paste"],
  drag: ["drop", "pointerup"],
  scroll: ["wheel", "scroll"],
};

/** How long a beat looks for its target before the pointer gives up showing it (it still listens). */
const FIND_MS = { lab: 4000, other: 1500 };
/** How long a waiting beat's target (in a practice window) may be gone before the step starts over. */
const LOST_MS = 1000;
/** How often a waiting beat asks done(), skipIf() and whether its target is still there. */
const POLL_MS = 250;
/** At most this many starts-over a visit to a step: a target that keeps going never loops the step for good. */
const MAX_RESTARTS = 6;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isMac() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

function kill(t: Token) {
  if (t.dead) return;
  t.dead = true;
  for (const a of t.aborts) a();
  t.aborts.clear();
}

export class DeskTutorial {
  private env: DeskEnv;
  private pointer: Pointer;
  private tok: Token | null = null;
  private key = "";
  private beats: Beat[] = [];
  private index = 0;
  private waiting = false;
  private done = false;
  private replaying = false;
  /** A "Show me again" in progress: killed when its beat is over. */
  private ghost: Child | null = null;
  /** When the step began, and its notes (BeatCtx.since, .memo). */
  private since = 0;
  private memo = new Map<string, unknown>();
  /** Steps the reader has finished this visit ("scene.step"). */
  private finished = new Set<string>();

  constructor(env: DeskEnv, pointer: Pointer) {
    this.env = env;
    this.pointer = pointer;
  }

  /** Play a step's beats (cancelling whatever was playing). An empty list: no pointer. */
  start(key: string, beats: Beat[]) {
    if (key === this.key && beats === this.beats && this.tok) return;
    this.stop();
    this.key = key;
    this.beats = beats;
    this.index = 0;
    this.waiting = false;
    this.done = false;
    this.since = typeof performance !== "undefined" ? performance.now() : Date.now();
    this.memo = new Map();
    if (beats.length === 0) {
      this.env.report(null);
      void this.pointer.goTo(null);
      this.pointer.say(null);
      return;
    }
    const tok: Token = { dead: false, aborts: new Set(), cleanups: [] };
    this.tok = tok;
    if (this.finished.has(key)) {
      // Done already this visit: say so, and don't ask for it again.
      this.index = beats.length;
      this.done = true;
      this.report({ say: null });
      void this.pointer.goTo(null);
      this.pointer.say(null);
      return;
    }
    void this.play(tok);
  }

  stop() {
    const tok = this.tok;
    this.tok = null;
    this.replaying = false;
    this.endGhost();
    this.pointer.setWaiting(false);
    this.pointer.hold(false);
    this.pointer.mode(null);
    this.pointer.say(null);
    if (!tok) return;
    kill(tok);
    for (const c of tok.cleanups.splice(0)) safe(c, undefined);
  }

  /** "Show me again": the waiting beat's gesture again; when the step is done, all its beats' gestures (no actions, no waiting). */
  replay() {
    const tok = this.tok;
    if (!tok || this.replaying) return;
    if (this.done) void this.ghostAll(tok);
    else if (this.waiting) void this.ghostOne(tok, this.index);
  }

  // ── playing ────────────────────────────────────────────────────────────────

  private report(extra: Partial<DeskRun> = {}) {
    const beat = this.beats[this.index];
    this.env.report({
      key: this.key,
      index: this.index,
      total: this.beats.length,
      waiting: this.waiting,
      done: this.done,
      say: beat?.say ? beat.say[this.env.lang()] : null,
      ...extra,
    });
  }

  private async play(tok: Token) {
    const beats = this.beats;
    // The windows' content first (the Lab's frame may still be loading): what
    // a skipIf or a baseline reads off a Lab that isn't there is wrong.
    for (const win of new Set(beats.map((b) => b.win))) {
      if (!(await this.ready(tok, win))) return;
    }
    for (const b of beats) safe(() => b.begin?.(this.ctx(b)), undefined);

    let restarts = 0;
    for (let i = 0; i < beats.length; i++) {
      if (tok.dead) return;
      const beat = beats[i];
      this.index = i;
      this.waiting = false;
      this.report();
      if (!(await this.ready(tok, beat.win))) return;
      if (this.skips(beat)) continue;

      this.env.bringForward(beat.win);
      const until = beat.until ?? ((beat.do ?? "point") === "point" ? 1400 : "reader");
      if (typeof until === "number") {
        const found = await this.find(tok, beat);
        if (tok.dead) return;
        if (found) await this.gesture(tok, beat, false);
        else void this.pointer.goTo(this.aimFor(beat, beat.target)); // hidden until it turns up
        if (tok.dead) return;
        if (!(await this.sleep(tok, until))) return;
        continue;
      }

      const out = await this.readerBeat(tok, beat);
      this.endGhost();
      if (out === "left" || tok.dead) return;
      if (out === "restart" && restarts < MAX_RESTARTS) {
        // The reader went elsewhere in the window: from the top, where the
        // skipIfs pass what is done and the first beats lead them back.
        restarts++;
        this.pointer.setWaiting(false);
        i = -1;
        continue;
      }
      if (out === "restart") continue;
      this.pointer.ack();
      if (!(await this.sleep(tok, 420))) return;
    }
    if (tok.dead) return;
    this.index = beats.length;
    this.done = true;
    this.finished.add(this.key);
    this.report({ say: null });
    this.pointer.say(null);
    if (!(await this.sleep(tok, 900))) return;
    void this.pointer.goTo(null);
  }

  /**
   * A beat that waits for the reader: listening starts now, while the pointer
   * is still on its way and showing the gesture; if the reader does it first,
   * the pointer stops where it is. Otherwise it parks on the target and waits.
   */
  private async readerBeat(tok: Token, beat: Beat): Promise<Outcome> {
    const watch = this.watch(tok, beat);
    const show = this.child(tok);
    const shown = (async () => {
      try {
        const found = await this.find(show, beat);
        if (show.dead) return;
        if (found) await this.gesture(show, beat, false);
      } catch {
        // A gesture never breaks the step.
      }
    })();
    let out = await Promise.race([shown.then(() => null), watch]);
    if (out === null && !tok.dead) {
      // Park on the target (a drag's start) and wait for the reader.
      void this.pointer.goTo(this.aimFor(beat, beat.target));
      this.pointer.say(beat.say?.[this.env.lang()] ?? null, this.chipOf(beat));
      this.waiting = true;
      this.pointer.setWaiting(true);
      this.report();
      out = await watch;
      this.waiting = false;
    } else if (out !== null && !show.dead) {
      // The reader was quicker than the pointer: it stops where it is.
      show.kill();
      this.pointer.hold(false);
      this.pointer.mode(null);
      this.pointer.halt();
    }
    show.kill();
    return out ?? "left";
  }

  private skips(beat: Beat): boolean {
    return safe(() => Boolean(beat.skipIf?.(this.ctx(beat))), false);
  }

  private ctx(beat: Beat): BeatCtx {
    const env = this.env;
    return {
      lang: env.lang(),
      el: beat.target ? resolveTarget(env.root(beat.win), beat.target) : null,
      doc: env.doc,
      root: env.root,
      app: deskApp,
      since: this.since,
      memo: this.memo,
    };
  }

  /** Aim at a target in a beat's window (no target: the middle of the window). The element is looked up again at most every 250 ms. */
  private aimFor(beat: Beat, target: Target | undefined): Aim {
    const env = this.env;
    const win = beat.win;
    let el: Element | null = null;
    let at = 0;
    return {
      rect: () => {
        const box = env.box(win);
        if (!box) return null;
        if (!target) return new DOMRect(box.left + box.width * 0.45, box.top + box.height * 0.4, 1, 1);
        const now = performance.now();
        if (!el || !el.isConnected || now - at > 250) {
          el = resolveTarget(env.root(win), target);
          at = now;
        }
        return el ? env.rectOf(win, el) : null;
      },
      box: () => env.box(win),
      at: beat.at,
      bubble: beat.bubble,
      // The halo only rings what the reader can see: not a control another window covers.
      shows: env.owns ? (r) => safe(() => env.owns!(win, r.left + r.width / 2, r.top + r.height / 2), true) : undefined,
    };
  }

  /** Wait (bounded) for a window's content: the Lab's frame loading. False only when the step is left. */
  private async ready(tok: Token, win: DeskWin): Promise<boolean> {
    for (let n = 0; n < 200 && !this.env.ready(win); n++) {
      if (!(await this.sleep(tok, 150))) return false;
    }
    return !tok.dead;
  }

  /** Wait (a little) for the beat's window and target to be there. */
  private async find(tok: Token, beat: Beat): Promise<boolean> {
    const env = this.env;
    const limit = beat.win === "lab" ? FIND_MS.lab : FIND_MS.other;
    let t = 0;
    // The Lab's frame may still be loading: that wait doesn't count.
    if (!(await this.ready(tok, beat.win))) return false;
    for (;;) {
      if (env.box(beat.win) && (!beat.target || resolveTarget(env.root(beat.win), beat.target))) return true;
      if (t >= limit) return false;
      if (!(await this.sleep(tok, 150))) return false;
      t += 150;
    }
  }

  private chipOf(beat: Beat): string | null {
    const d = beat.do ?? "point";
    if (d === "paste") return isMac() ? "⌘ V" : "Ctrl V";
    if (d === "scroll") return "↕";
    return null;
  }

  /** Glide there and show the gesture. `ghost`: a replay — never act, never run hooks. */
  private async gesture(tok: Token, beat: Beat, ghost: boolean) {
    const env = this.env;
    const lang = env.lang();
    this.pointer.say(beat.say?.[lang] ?? null, this.chipOf(beat));
    const aim = this.aimFor(beat, beat.target);
    await this.pointer.goTo(aim);
    if (tok.dead) return;
    // A practice window's demo acts for real; the Lab is the reader's, never.
    const act = !ghost && beat.win !== "lab" && typeof beat.until === "number";
    const el = beat.target ? resolveTarget(env.root(beat.win), beat.target) : null;
    switch (beat.do ?? "point") {
      case "point":
        break;
      case "press":
        await this.pointer.press();
        if (!tok.dead && act && el) safe(() => (el as HTMLElement).click(), undefined);
        break;
      case "paste":
        await this.pointer.press();
        if (!tok.dead && act && el) {
          const f = fieldOf(el);
          if (f) safe(() => setFieldValue(f, beat.text ?? ""), undefined);
        }
        break;
      case "type": {
        this.pointer.mode("type");
        if (act && el) await this.typeInto(tok, el, beat.text ?? "");
        else await this.sleep(tok, 800);
        if (!tok.dead) this.pointer.mode(null);
        break;
      }
      case "scroll":
        this.pointer.mode("scroll");
        if (act && el) safe(() => el.scrollBy({ top: 240, behavior: env.reduced() ? "auto" : "smooth" }), undefined);
        await this.sleep(tok, 900);
        if (!tok.dead) this.pointer.mode(null);
        break;
      case "drag":
        if (beat.to) {
          this.pointer.hold(true);
          await this.sleep(tok, 160);
          if (tok.dead) return;
          await this.pointer.goTo(this.aimFor(beat, beat.to));
          await this.sleep(tok, 180);
          if (tok.dead) return;
          this.pointer.hold(false);
          await this.pointer.press();
        }
        break;
    }
    if (tok.dead || ghost || !beat.run) return;
    const cleanup = safe(() => beat.run?.(this.ctx(beat)), undefined);
    if (typeof cleanup === "function") tok.cleanups.push(cleanup);
  }

  /** A demo types into a practice field, a letter at a time (at once under reduced motion). */
  private async typeInto(tok: Token, el: Element, text: string) {
    const f = fieldOf(el);
    if (!f) return;
    if (this.env.reduced()) {
      safe(() => setFieldValue(f, text), undefined);
      return;
    }
    for (let i = 1; i <= text.length; i++) {
      if (tok.dead) return;
      safe(() => setFieldValue(f, text.slice(0, i)), undefined);
      if (!(await this.sleep(tok, 45))) return;
    }
  }

  /**
   * Until the reader has done it ("done"), the step is left ("left"), or —
   * in a practice window — the target the reader had on screen has been gone
   * a while ("restart").
   */
  private watch(tok: Token, beat: Beat): Promise<Outcome> {
    const env = this.env;
    return new Promise<Outcome>((resolve) => {
      if (tok.dead) {
        resolve("left");
        return;
      }
      const offs: (() => void)[] = [];
      let settled = false;
      const finish = (v: Outcome) => {
        if (settled) return;
        settled = true;
        for (const f of offs) safe(f, undefined);
        tok.aborts.delete(abort);
        resolve(v);
      };
      const abort = () => finish("left");
      tok.aborts.add(abort);

      const types = beat.on ? (Array.isArray(beat.on) ? beat.on : [beat.on]) : DEFAULT_ON[beat.do ?? "point"];
      const within = beat.do === "drag" && beat.to ? beat.to : beat.target;
      const onEvent = (e: Event) => {
        const root = env.root(beat.win);
        if (!root) return;
        if (within ? targetHas(root, within, e.target) : safe(() => (root as Node).contains(e.target as Node), false)) finish("done");
      };
      // The Lab's document can change under us (the frame reloaded): follow it.
      let doc: Document | null = null;
      let detach: (() => void) | null = null;
      const attach = () => {
        const d = env.doc(beat.win);
        if (d === doc) return;
        detach?.();
        detach = null;
        doc = d;
        if (!d) return;
        for (const t of types) d.addEventListener(t, onEvent, true);
        detach = () => {
          for (const t of types) safe(() => d.removeEventListener(t, onEvent, true), undefined);
        };
      };
      attach();
      // For a practice window's "the reader went elsewhere": the target was
      // seen while waiting, and has been missing this many polls in a row.
      let seen = false;
      let missing = 0;
      const lostWatch = beat.win !== "lab" && Boolean(beat.target);
      const poll = window.setInterval(() => {
        attach();
        if (beat.done && safe(() => Boolean(beat.done?.(this.ctx(beat))), false)) {
          finish("done");
          return;
        }
        // Past it some other way (a tab the Lab restored late, a step done out of order).
        if (beat.skipIf && this.skips(beat)) {
          finish("done");
          return;
        }
        if (lostWatch && env.box(beat.win)) {
          if (resolveTarget(env.root(beat.win), beat.target)) {
            seen = true;
            missing = 0;
          } else if (seen && ++missing * POLL_MS >= LOST_MS) finish("restart");
        }
      }, POLL_MS);
      offs.push(
        () => window.clearInterval(poll),
        () => detach?.(),
      );
      if (beat.signal) {
        const name = beat.signal;
        offs.push(onDeskSignal((n) => n === name && finish("done")));
      }
    });
  }

  private sleep(tok: Token, ms: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (tok.dead) {
        resolve(false);
        return;
      }
      const abort = () => {
        window.clearTimeout(id);
        resolve(false);
      };
      const id = window.setTimeout(() => {
        tok.aborts.delete(abort);
        resolve(!tok.dead);
      }, ms);
      tok.aborts.add(abort);
    });
  }

  /** A token of its own under `tok`: killed with it, or alone. */
  private child(tok: Token): Child {
    const c: Child = {
      dead: false,
      aborts: new Set(),
      cleanups: tok.cleanups,
      kill: () => {
        tok.aborts.delete(onParent);
        kill(c);
      },
    };
    const onParent = () => kill(c);
    tok.aborts.add(onParent);
    return c;
  }

  // ── show me again ──────────────────────────────────────────────────────────

  private endGhost() {
    const g = this.ghost;
    this.ghost = null;
    if (g) {
      g.kill();
      this.replaying = false;
    }
  }

  private async ghostOne(tok: Token, index: number) {
    const beat = this.beats[index];
    if (!beat) return;
    const g = this.child(tok);
    this.ghost = g;
    this.replaying = true;
    this.pointer.setWaiting(false);
    this.env.bringForward(beat.win);
    await this.pointer.replayFrom();
    if (!g.dead) await this.gesture(g, beat, true);
    if (g.dead) return;
    this.ghost = null;
    this.replaying = false;
    // Back to waiting where it was — if it still is.
    if (this.waiting && this.index === index) {
      void this.pointer.goTo(this.aimFor(beat, beat.target));
      this.pointer.say(beat.say?.[this.env.lang()] ?? null, this.chipOf(beat));
      this.pointer.setWaiting(true);
    }
  }

  private async ghostAll(tok: Token) {
    this.replaying = true;
    for (let i = 0; i < this.beats.length; i++) {
      if (tok.dead) return;
      const beat = this.beats[i];
      this.report({ index: i, done: false, waiting: false });
      this.env.bringForward(beat.win);
      if (!(await this.find(tok, beat))) continue;
      await this.gesture(tok, beat, true);
      if (!(await this.sleep(tok, 650))) return;
    }
    if (tok.dead) return;
    this.replaying = false;
    this.report({ index: this.beats.length, done: true, say: null });
    this.pointer.say(null);
    if (!(await this.sleep(tok, 900))) return;
    void this.pointer.goTo(null);
  }
}
