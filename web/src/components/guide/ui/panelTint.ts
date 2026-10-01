"use client";

import { useEffect, type RefObject } from "react";
import styles from "../Guide.module.css";
import { addHue, clearHues, dominantHue, hueHistogram, oneColour } from "../stage/look/dominant";
import { getSim, useGuideStore } from "../store";
import { panelSignal } from "./panelSignal";

// The page answers the instrument.
//
// The LED panel is the only light in the guide's room, and the page is in
// that room: its accent — the kicker's dot, the numerals, the lit edge of the
// card being read, the chapter rail's marker, a link's underline — takes the
// colour of the pattern playing on the panel. Turn K1 on Origin and the page
// turns with it.
//
// One thing is written (Guide.module.css .world has its default):
//
//   --g-led-rgb: "255 106 61"      the accent, as three numbers
//   --g-lit: 0..1                   how lit the panel is at all
//
// and the sheet makes the rest from them (--g-led, --g-led-wash, every glow;
// the light on a card's edge is as strong as the panel is lit: with the
// power off, on the Build guide, the edge is only a marker).
// The colour is eased here and written only when it has moved far enough to
// see, and only on what is on screen (see "the loop", below), so a pattern
// that holds its colour costs the page nothing and one that does not costs
// it little.
//
// What it may become is fenced in (accentFor): the hue is the panel's, the
// lightness stays in a band where it reads on the room's dark as text and
// takes the dark ink of a button on top of it, and the chroma is held under
// what the hue can carry without shouting. A white or grey pattern has no hue
// to give: the accent pales toward the LED orange it started from. A dark
// panel — off, asleep, the Build guide before the power goes in — gives the
// orange back, and so does Make, where the device has left the room.
//
// The knob tags on the stage do not follow: they answer to the orange dots on
// the knobs' rings, which are the device's own and stay orange
// (Guide.module.css --g-led-fixed).

export type Rgb = [number, number, number];

/** The LED orange the guide starts from, and comes back to when the panel is dark. */
export const LED_ORANGE: Rgb = [255, 106, 61];

// ── OKLab ───────────────────────────────────────────────────────────────────

function toLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function fromLinear(v: number) {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, c)) * 255);
}
function linearToOklab(r: number, g: number, b: number): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToLinear(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
function inGamut([r, g, b]: Rgb) {
  const e = 0.0005;
  return r >= -e && r <= 1 + e && g >= -e && g <= 1 + e && b >= -e && b <= 1 + e;
}
/** The most chroma sRGB holds at this lightness and hue. */
function maxChroma(L: number, h: number) {
  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinear(L, mid * Math.cos(h), mid * Math.sin(h)))) lo = mid;
    else hi = mid;
  }
  return lo;
}

const ORANGE_LAB = linearToOklab(toLinear(LED_ORANGE[0]), toLinear(LED_ORANGE[1]), toLinear(LED_ORANGE[2]));
const ORANGE_HUE = Math.atan2(ORANGE_LAB[2], ORANGE_LAB[1]);
const ORANGE_CHROMA = Math.hypot(ORANGE_LAB[1], ORANGE_LAB[2]);

/** Relative luminance (WCAG) of an sRGB colour. */
export function luminance([r, g, b]: Rgb) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
/** WCAG contrast between two sRGB colours. */
export function contrast(a: Rgb, b: Rgb) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── the panel's colour ──────────────────────────────────────────────────────

/** What the panel is giving off: its colour as linear-light sums, and how much of it is lit. */
export type PanelLight = {
  /** The dominant colour, sRGB 0..255 — what colour the light is. */
  rgb: Rgb;
  /** 0..1: how much the panel has a colour to follow (0: black, white and grey only, or every hue at once). */
  colour: number;
  /** 0..1: how lit the panel is at all. */
  lit: number;
};

/**
 * The dominant colour of a panel frame (128×64 RGBA, deviceSim.frame). Pixels
 * are weighed by how coloured they are, so on a pattern of white with a red
 * heart the answer is the red: white is what every pattern has, the colour is
 * what this one is. And it is the fullest hue, not the mean of them all
 * (stage/look/dominant.ts): blue squares under an orange slider are blue,
 * not the pink between.
 *
 * Once the stage is up the page reads the stage's own signal instead
 * (ui/panelSignal.ts, from stage/look/panelGlow.ts — the same weighing, of
 * what the panel is *showing*: dark while the device is apart or its power is
 * held, fading when it is cut). This is for the moments before that, and for
 * the tests.
 */
export function readPanel(frame: Uint8ClampedArray, out: PanelLight = { rgb: [0, 0, 0], colour: 0, lit: 0 }, hues = hueHistogram()): PanelLight {
  clearHues(hues);
  let weight = 0;
  let light = 0;
  let n = 0;
  // Every 13th pixel: about 630 of the 8192, and no two rows start alike.
  for (let i = 0; i < frame.length; i += 52) {
    const pr = frame[i];
    const pg = frame[i + 1];
    const pb = frame[i + 2];
    const max = pr > pg ? (pr > pb ? pr : pb) : pg > pb ? pg : pb;
    const min = pr < pg ? (pr < pb ? pr : pb) : pg < pb ? pg : pb;
    // Coloured and bright counts; a dim wash of colour counts little.
    const w = ((max - min) / 255) * (max / 255);
    addHue(hues, pr, pg, pb, w);
    weight += w;
    light += max;
    n++;
  }
  const share = weight > 0.0001 ? dominantHue(hues, LEAD) : 0;
  if (share > 0) {
    out.rgb[0] = LEAD.r * 255;
    out.rgb[1] = LEAD.g * 255;
    out.rgb[2] = LEAD.b * 255;
  } else {
    out.rgb[0] = out.rgb[1] = out.rgb[2] = 0;
  }
  // A twentieth of the panel in full colour is already "a coloured pattern" — if it is one colour.
  out.colour = Math.min(1, weight / n / 0.05) * oneColour(share);
  out.lit = Math.min(1, light / n / 255 / 0.04);
  return out;
}

const LEAD = { r: 0, g: 0, b: 0 };

/** Hue distance, 0..π. */
function hueGap(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/**
 * The page's accent for a panel light, as OKLab. Always readable: lightness
 * 0.72–0.78 (≥ 4.5:1 on the room's dark, and under the buttons' dark ink),
 * chroma no more than the hue carries quietly. No colour to follow: the LED
 * orange, paler the whiter the panel is.
 */
export function accentLab(panel: PanelLight): Rgb {
  const follow = panel.lit * panel.colour;
  // A lit panel with no colour in it (white, grey): a pale orange.
  const pale = panel.lit * (1 - panel.colour);
  let hue = ORANGE_HUE;
  if (follow > 0.001) {
    const lab = linearToOklab(toLinear(panel.rgb[0]), toLinear(panel.rgb[1]), toLinear(panel.rgb[2]));
    const h = Math.atan2(lab[2], lab[1]);
    // The short way round from the orange to the panel's hue.
    hue = ORANGE_HUE + Math.atan2(Math.sin(h - ORANGE_HUE), Math.cos(h - ORANGE_HUE)) * Math.min(1, follow * 1.6);
  }
  // Warm hues keep the orange's own strength; the cool ones are held lower
  // (a full green or blue beside cream type shouts) and set a little lighter
  // (blue is dark for its lightness).
  //
  // Yellow and lime are the other way about: they are only themselves when
  // they are light. Held in the same band as the rest a yellow panel gave a
  // khaki page and a green one an olive — the two hues that are brightest on
  // the panel came out the muddiest on the page. So between about 85° and
  // 150° the band rises with the hue (up to 0.88) and takes more of the
  // chroma the hue has there. Lighter only helps the reading: more contrast
  // on the dark, and more under the dark ink.
  const warm = 1 - Math.min(1, hueGap(hue, ORANGE_HUE) / 1.1);
  const bright = brightHue(hue);
  const base = COOL_L + (ORANGE_LAB[0] - COOL_L) * warm;
  const L = base + (BRIGHT_L - base) * bright;
  const cool = Math.min(maxChroma(L, hue) * 0.92, COOL_CHROMA + (BRIGHT_CHROMA - COOL_CHROMA) * bright);
  const cap = cool + (ORANGE_CHROMA - cool) * warm * (1 - bright);
  const chroma = cap * (1 - 0.55 * pale);
  return [L + (PALE_L - L) * pale * 0.6, chroma * Math.cos(hue), chroma * Math.sin(hue)];
}
/** A cool accent's lightness (the orange's own is 0.71) and the most chroma it is given. */
const COOL_L = 0.775;
const COOL_CHROMA = 0.118;
/** Yellow's and lime's: lighter, and with more of their own colour. */
const BRIGHT_L = 0.88;
const BRIGHT_CHROMA = 0.168;
/** 0..1: how much a hue (OKLab angle, radians) is one of the light ones — all of it from 97° to 135°, none below 72° or above 162°. */
function brightHue(h: number) {
  const deg = ((h * 180) / Math.PI + 360) % 360;
  const up = Math.min(1, Math.max(0, (deg - 72) / 25));
  const down = Math.min(1, Math.max(0, (162 - deg) / 27));
  const t = Math.min(up, down);
  return t * t * (3 - 2 * t);
}
/** A white panel's accent is lighter as well as paler. */
const PALE_L = 0.8;

/** OKLab → sRGB 0..255, chroma pulled in until it fits. */
export function labToRgb([L, a, b]: Rgb): Rgb {
  let lin = oklabToLinear(L, a, b);
  if (!inGamut(lin)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear(L, a * mid, b * mid))) lo = mid;
      else hi = mid;
    }
    lin = oklabToLinear(L, a * lo, b * lo);
  }
  return [fromLinear(lin[0]), fromLinear(lin[1]), fromLinear(lin[2])];
}

/** The page's accent for a panel frame, sRGB — the whole of the mapping, for the tests. */
export function accentFor(frame: Uint8ClampedArray): Rgb {
  return labToRgb(accentLab(readPanel(frame)));
}

// ── the loop ────────────────────────────────────────────────────────────────
//
// Where it is written matters more than how often. A custom property set on
// the world would make the browser work out the style of every element of
// the page again, each time (7–9 ms on a guide's page: a dropped frame, a
// few times a second, for as long as a pattern keeps changing colour). So
// the colour is written only where it can be seen: the stage's glow, the top
// bar, and the page's blocks that are on screen or about to be — the card
// being read, a chapter's title — a hundred elements or so. A block that
// comes onto the screen is given the colour as it does.

/** How fast the page's colour follows the panel's: the time to cover 63% of the way, seconds. */
const FOLLOW_S = 0.45;
/**
 * And no faster than this, in OKLab per second, however far it has to go:
 * about 70° of hue a second at the accent's chroma. A knob turned a detent is
 * well inside it; a pattern swapped for one of another colour is a turn of
 * the page's colour over a second, not a jump.
 */
const MAX_SPEED = 0.2;
/** The panel is read this often, ms. */
const READ_MS = 110;
/** The page is written no more often than this, ms. */
const WRITE_MS = 48;
/** A step smaller than this in every channel is not written (0..255). */
const WRITE_STEP = 2;
/** A block this far off the screen (a share of its height) is already kept in colour. */
const NEAR = "30% 0px";

let users = 0;
let raf = 0;
let lastRead = 0;
let lastWrite = 0;
let lastTick = 0;
const panel: PanelLight = { rgb: [0, 0, 0], colour: 0, lit: 0 };
const panelHues = hueHistogram();
const NONE: PanelLight = { rgb: [0, 0, 0], colour: 0, lit: 0 };
let want: Rgb = accentLab(NONE);
let now: Rgb = [...want];
let written: Rgb = [...LED_ORANGE];
/** How lit the panel is, wanted / eased / as written (0..1). */
let wantLit = 0;
let nowLit = 0;
let writtenLit = -1;
/** What is in colour now: the stage, the top bar, the blocks on screen. */
const lit = new Set<HTMLElement>();

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function paint(el: HTMLElement) {
  if (written[0] === LED_ORANGE[0] && written[1] === LED_ORANGE[1] && written[2] === LED_ORANGE[2]) el.style.removeProperty("--g-led-rgb");
  else el.style.setProperty("--g-led-rgb", `${written[0]} ${written[1]} ${written[2]}`);
  if (writtenLit <= 0) el.style.removeProperty("--g-lit");
  else el.style.setProperty("--g-lit", writtenLit.toFixed(2));
}

function tick(t: number) {
  raf = requestAnimationFrame(tick);
  const dt = Math.min(0.25, (t - lastTick) / 1000);
  lastTick = t;
  if (t - lastRead >= READ_MS) {
    lastRead = t;
    const s = useGuideStore.getState();
    // The device has left the room on Make, and has not arrived before a page says so.
    const here = s.entered && s.page !== "make" && s.leaving !== "make";
    const light = !here ? NONE : panelSignal.live ? panelSignal : readPanel(getSim().frame, panel, panelHues);
    // While the pattern list is open (K4 held: the board's "select" screen)
    // the panel shows a pattern a moment and then the next, each its own
    // colour. The page does not chase them: it keeps the colour it had, and
    // takes the chosen pattern's when the list closes.
    const browsing = here && getSim().snapshot().mode === "select";
    if (!browsing) want = accentLab(light);
    // On Make the light is the desk's windows, and they are always on.
    wantLit = here ? light.lit : s.entered ? 1 : 0;
  }
  const still = reducedMotion();
  const k = still ? 1 : 1 - Math.exp(-dt / FOLLOW_S);
  const d0 = (want[0] - now[0]) * k;
  const d1 = (want[1] - now[1]) * k;
  const d2 = (want[2] - now[2]) * k;
  const far = Math.hypot(d0, d1, d2);
  const cap = still || far <= MAX_SPEED * dt ? 1 : (MAX_SPEED * dt) / far;
  now[0] += d0 * cap;
  now[1] += d1 * cap;
  now[2] += d2 * cap;
  nowLit += (wantLit - nowLit) * k;
  if (t - lastWrite < WRITE_MS) return;
  const rgb = labToRgb(now);
  // In steps of a twentieth, and all the way to each end.
  const level = Math.abs(wantLit - nowLit) < 0.03 ? wantLit : Math.round(nowLit * 20) / 20;
  if (level === writtenLit && Math.abs(rgb[0] - written[0]) < WRITE_STEP && Math.abs(rgb[1] - written[1]) < WRITE_STEP && Math.abs(rgb[2] - written[2]) < WRITE_STEP) return;
  lastWrite = t;
  written = rgb;
  writtenLit = level;
  lit.forEach(paint);
}

/** The accent as it is on the page now, sRGB (the preloader's lit pixels are this colour). */
export function accentNow(): Rgb {
  return written;
}

/**
 * The page follows the panel while a page of the guide is mounted: `root` is
 * the page (GuideHub's, GuideExperience's). One loop and one colour for the
 * whole guide: it carries on across a move between two pages (the next page
 * takes it over before the last lets go), so the colour never starts over.
 */
export function usePanelTint(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const page = root.current;
    if (!page) return;
    if (users++ === 0) {
      lastTick = performance.now();
      raf = requestAnimationFrame(tick);
    }
    const mine: HTMLElement[] = [];
    const add = (el: HTMLElement | null | undefined) => {
      if (!el) return;
      mine.push(el);
      lit.add(el);
      paint(el);
    };
    // Always in colour: the room's glow behind the device, and the top bar.
    const stage = page.closest("[data-guide-world]")?.querySelector<HTMLElement>(`.${styles.stage}`);
    add(stage);
    add(page.querySelector<HTMLElement>("header"));
    // The page's blocks, as they come near the screen.
    const blocks = Array.from(page.querySelectorAll<HTMLElement>('main [data-leaves=""]'));
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === "undefined") blocks.forEach(add);
    else {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) {
              lit.add(el);
              paint(el);
            } else lit.delete(el);
          }
        },
        { rootMargin: NEAR },
      );
      blocks.forEach((b) => io?.observe(b));
    }
    return () => {
      io?.disconnect();
      blocks.forEach((b) => lit.delete(b));
      mine.forEach((el) => el !== stage && lit.delete(el));
      // Let the next page take the loop first (a move between pages unmounts, then mounts).
      window.setTimeout(() => {
        if (--users > 0) return;
        cancelAnimationFrame(raf);
        raf = 0;
        // Out of the guide: the next visit starts from the orange.
        now = [...accentLab(NONE)];
        written = [...LED_ORANGE];
        wantLit = nowLit = 0;
        writtenLit = -1;
        lit.forEach(paint);
        lit.clear();
      }, 400);
    };
  }, [root]);
}
