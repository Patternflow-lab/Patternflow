"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { GLCD_FONT } from "@/lib/guide/glcdFont";
import { accentNow } from "./panelTint";
import { stageLoad } from "./stageLoad";
import css from "./Preloader.module.css";

// The first load.
//
// The stage is three.js, four models and their shaders, and on a first visit
// that is a second or three — on a slow line, many more — of nothing where
// the device should be. So on a first visit one small thing is lit in that
// place: a counter, in the panel's own face — the firmware's 5×7 font
// (lib/guide/glcdFont.ts, the bytes the device draws its screens with), each
// font pixel a block of four LEDs, dark between them, the unlit ones just
// visible the way a panel's are. It counts what is really arriving
// (ui/stageLoad.ts: the stage's chunk, then the models as three's loader
// reports them, then the device drawn and the frames smooth); when the stage
// is ready its figures roll up the rest of the way, a row of LEDs at a time,
// and at 100 it goes out row by row as the device comes up where it stood.
//
// It covers the stage, not the page. The words are in the HTML and arrive
// with the first paint, as they always did; the counter stands where the
// device will (Preloader.module.css places it per page), under the story and
// over the canvas, which it keeps out until the count is done
// (`[data-cover]` on the world, Guide.module.css). It used to be a cover over
// everything, and on a slow line the page's words — there at half a second —
// waited fourteen for a 3D model.
//
// It is in the page's own markup, so it is there from the first paint. And
// it is skipped when there is nothing to wait for:
//   - a browser that has loaded the stage before (localStorage; the files are
//     cached): a script right after it, run before the first paint, turns it
//     off, and the page opens as it always did;
//   - any later page of the same visit: the stage is up, and stays up;
//   - Make, which has no device.
//   - a browser that cannot draw the stage at all (stageLoad.failed).
// It goes after GIVE_UP_MS whatever the stage is doing, and with no scripts
// at all its own animation takes it off.

const SEEN_KEY = "pf-guide-stage";
/** Bumped when the stage's files change enough that an old visit's cache no longer covers them. */
const SEEN = "1";
/** Run in place, before the first paint: a browser that has the stage cached never sees the cover. */
const SKIP = `(function(){try{if(localStorage.getItem(${JSON.stringify(SEEN_KEY)})===${JSON.stringify(SEEN)}){var s=document.currentScript;s&&s.parentNode&&s.parentNode.setAttribute("data-off","skip")}}catch(e){}})()`;

/** The counter goes after this, ready or not, ms — from when the page was asked for, not from when its scripts ran. */
const GIVE_UP_MS = 20000;
/** At 100: how long it holds before it goes out, ms. */
const HOLD_MS = 180;
/** The count never stands still for longer than a figure takes at this pace (per second) while it is under CREEP_TO… */
const CREEP = 4;
/** …and never runs faster than this, however much arrived at once. */
const RUN = 60;
const CREEP_TO = 90;
/** The rows go out over this, ms; the cover's own fade is the sheet's. */
const WIPE_MS = 380;
/** The cover's fade (Preloader.module.css), ms: it is taken away after. */
const LIFT_MS = 700;

// The matrix: three figures, each font pixel 2×2 LEDs.
const K = 2;
const GLYPH_W = 5 * K;
const GLYPH_H = 7 * K;
const GAP = 1 * K;
const PAD_X = 3;
const PAD_Y = 3;
/** A figure's travel when it rolls to the next, rows of LEDs: its height and the dark between two. */
const ROLL = GLYPH_H + 4;
export const COLS = PAD_X * 2 + GLYPH_W * 3 + GAP * 2;
export const ROWS = PAD_Y * 2 + GLYPH_H;

/** One visit: the first page to mount takes it, the rest have nothing to cover. */
let handled = false;

const noop = () => () => {};

/** Is this LED of a figure lit? (col, row) in font pixels. */
function fontPixel(digit: number, col: number, row: number) {
  return (GLCD_FONT[(48 + digit) * 5 + col] >> row) & 1;
}

/**
 * The lit LEDs for a count of 0..100, as a ROWS × COLS grid of levels (0 dark,
 * 1 full; leading zeros are dimmer). Figures roll like a counter's: the units
 * all the time, the tens through the last unit before each ten, a row of LEDs
 * at a time — an LED is on or off, never between. `roll` false: no rolling,
 * each figure is the one it is.
 */
export function countMatrix(value: number, out: Float32Array, roll = true): Float32Array {
  out.fill(0);
  const v = Math.max(0, Math.min(100, value));
  const whole = Math.floor(v + 1e-6);
  for (let place = 0; place < 3; place++) {
    const unit = 10 ** place;
    // The figure showing, and how far it has rolled toward the next (0..1).
    const figure = Math.floor(v / unit) % 10;
    const frac = place === 0 ? v - Math.floor(v) : Math.max(0, (v % unit) - (unit - 1));
    const rows = roll ? Math.round(frac * ROLL) : 0;
    const x0 = PAD_X + (2 - place) * (GLYPH_W + GAP);
    for (const [digit, top] of [
      [figure, -rows],
      [(figure + 1) % 10, ROLL - rows],
    ] as const) {
      if (top >= GLYPH_H) continue;
      // A zero in front of the number is there, and faint. (The figure rolling in is never one.)
      const level = digit === figure && place > 0 && whole < unit ? 0.2 : 1;
      for (let r = 0; r < GLYPH_H; r++) {
        const y = top + r;
        if (y < 0 || y >= GLYPH_H) continue;
        for (let c = 0; c < GLYPH_W; c++) {
          if (fontPixel(digit, Math.floor(c / K), Math.floor(r / K))) out[(PAD_Y + y) * COLS + x0 + c] = level;
        }
      }
    }
  }
  return out;
}

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export default function Preloader() {
  // On the server and while its markup is being taken up, the script that can
  // turn it off is part of it; rendered afresh in the browser there is no
  // script (it would not run), and the same check is made below.
  const hydrating = useSyncExternalStore(
    noop,
    () => false,
    () => true,
  );
  const [show, setShow] = useState(() => !handled);
  const [off, setOff] = useState(false);
  const cover = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  /** This is the page that took the visit's one cover (an effect run twice in development is still the same page). */
  const mine = useRef(false);

  useLayoutEffect(() => {
    if (handled && !mine.current) return;
    handled = true;
    mine.current = true;
    const el = cover.current;
    const cv = canvas.current;
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === SEEN;
    } catch {
      /* no storage: it is a first visit every time */
    }
    if (!el || !cv || seen || el.getAttribute("data-off") === "skip" || stageLoad.get().ready || stageLoad.get().failed) {
      setShow(false);
      return;
    }
    // The canvas stays out under the counter until the count is done (Guide.module.css).
    const world = el.closest<HTMLElement>("[data-guide-world]");
    world?.setAttribute("data-cover", "1");
    const ctx = cv.getContext("2d");
    const still = reducedMotion();
    const pitch = el.clientWidth < 520 ? 6 : 7;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = COLS * pitch * dpr;
    cv.height = ROWS * pitch * dpr;
    el.style.setProperty("--pitch", `${pitch}px`);
    const grid = new Float32Array(COLS * ROWS);

    // Counted from when the page was asked for (performance.now() is from the
    // navigation's start); a page reached inside the guide starts from here.
    const t0 = performance.now() < 5000 ? 0 : performance.now();
    let raf = 0;
    let timer = 0;
    let last = performance.now();
    let value = 0;
    let shown = 0;
    let fullAt = 0;
    let lifted = false;

    const draw = (count: number, dark: number, roll = false) => {
      if (!ctx) return;
      countMatrix(count, grid, roll && !still);
      const [r, g, b] = accentNow();
      ctx.clearRect(0, 0, cv.width, cv.height);
      const cell = pitch * dpr;
      const led = (pitch - 2) * dpr;
      const core = Math.max(1, led * 0.44);
      for (let y = dark; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const level = grid[y * COLS + x];
          if (!level) continue;
          const px = x * cell + dpr;
          const py = y * cell + dpr;
          ctx.fillStyle = `rgba(${r},${g},${b},${level})`;
          ctx.fillRect(px, py, led, led);
          // An emitter is brightest in its middle.
          ctx.fillStyle = `rgba(255,244,232,${0.55 * level})`;
          ctx.fillRect(px + (led - core) / 2, py + (led - core) / 2, core, core);
        }
      }
    };

    const lift = () => {
      if (lifted) return;
      lifted = true;
      setOff(true);
      world?.removeAttribute("data-cover");
      try {
        if (stageLoad.get().ready) window.localStorage.setItem(SEEN_KEY, SEEN);
      } catch {
        /* no storage */
      }
      timer = window.setTimeout(() => setShow(false), LIFT_MS);
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(100, t - last);
      last = t;
      const s = stageLoad.get();
      // No stage is coming: there is nothing to count.
      if (s.failed) {
        cancelAnimationFrame(raf);
        raf = 0;
        ctx?.clearRect(0, 0, cv.width, cv.height);
        lift();
        return;
      }
      const late = t - t0 > GIVE_UP_MS;
      // What has really arrived: the stage's chunk (until it has, a slow creep
      // that never gets there), then the models, then the device on screen.
      const target = s.ready || late ? 1 : s.staged ? 0.3 + 0.66 * s.frac : 0.3 * (1 - Math.exp(-(t - t0) / 1600));
      value += (target - value) * (1 - Math.exp(-dt / 240));
      // Ready: the count runs out the rest at a pace, however far it had to go.
      if (target === 1) value = Math.min(1, value + dt / 900);
      if (value > 0.9995) value = 1;
      const whole = Math.floor(value * 100 + 1e-6);
      // While things are still arriving the figures change at once, as an LED
      // counter's do: the page is at its busiest then (scripts being read,
      // models unpacked), frames go missing, and a figure caught half-way
      // through a roll and held there for half a second reads as a fault.
      // Once the stage is ready the frames are smooth — that is what ready
      // means — and the count runs out the rest rolling, a row of LEDs at a
      // time, like a counter coming up to its number.
      //
      // And it never stalls: what arrives comes in lumps (a 1.6 MB model is
      // nothing, then everything), and a number that sits on 019 for a second
      // and then leaps to 052 looks frozen, then broken. So the figure shown
      // runs after the real one at a pace with a floor and a ceiling — a
      // slow creep while nothing is reported, a run when a lot is — and only
      // the last ten wait for the stage itself.
      const rolling = s.ready && !late;
      const behind = whole - shown;
      const pace = late
        ? RUN * 3
        : rolling
          ? Math.min(RUN, Math.max(behind * 7, 22))
          : behind > 0
            ? Math.min(RUN, Math.max(behind * 5, CREEP))
            : shown < CREEP_TO
              ? CREEP
              : 0;
      // (Never back: the creep may have got ahead of what was reported.)
      shown = Math.max(shown, Math.min(rolling || late ? whole : Math.max(whole, CREEP_TO), shown + (pace * dt) / 1000));
      // (Not rolling, the figures are whole: an LED is on or off.)
      if (shown < 100) {
        draw(rolling ? shown : Math.floor(shown + 1e-6), 0, rolling);
        return;
      }
      if (!fullAt) fullAt = t;
      const since = t - fullAt - HOLD_MS;
      if (since < 0) {
        draw(100, 0);
        return;
      }
      // Out, a row at a time from the top, as the cover lifts.
      lift();
      const dark = still ? ROWS : Math.min(ROWS, Math.floor((since / WIPE_MS) * ROWS));
      draw(100, dark);
      if (dark >= ROWS) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      world?.removeAttribute("data-cover");
    };
  }, []);

  if (!show) return null;
  return (
    <div ref={cover} className={css.cover} data-preloader="" data-off={off ? "lift" : undefined} aria-hidden="true" suppressHydrationWarning>
      <div className={css.matrix} style={{ "--cols": COLS, "--rows": ROWS } as React.CSSProperties}>
        <canvas ref={canvas} className={css.lit} />
      </div>
      {hydrating && <script dangerouslySetInnerHTML={{ __html: SKIP }} />}
    </div>
  );
}
