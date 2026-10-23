// ── Pattern Lab layer model ──────────────────────────────────────────────────
// The lab composes a stack of layers into one LED frame, Photoshop-style:
//
//   code layers    a JS pattern (setup/update/draw) with its OWN color ramp,
//                  knob values/ranges and error state. The ramp is chained to
//                  the code because two stacked patterns rarely share colors.
//   pixel layers   a hand-drawn / imported RGBA bitmap, edited in the pixel
//                  panel. Transparency is real alpha, so cutouts layer over
//                  the patterns beneath.
//   text layers    a line or two of text in a font the user picks, drawn
//                  into the same kind of RGBA bitmap a pixel layer holds
//                  (lib/lab/text.ts). The bitmap is what composites, masks
//                  and exports; the text, size and font are how it is redrawn.
//
// Convention: `layers[0]` is the TOP of the stack (what the Layers panel shows
// first), so compositing walks the array back-to-front.

import type { RampMode } from "@/lib/pattern/harness";
import type { MatrixSize } from "@/lib/pattern/matrix";
import type { ColorMode } from "@/lib/ai/settings";
import type { DirectorShow } from "./director/types";

export type KnobRange = [number, number];

// Kept deliberately small: every mode here must stay cheap to replicate on the
// ESP32 (integer math per pixel), so the flattened export can bake it 1:1.
export type BlendMode = "normal" | "add" | "multiply" | "screen";
export const BLEND_MODES: BlendMode[] = ["normal", "add", "multiply", "screen"];

// UI-facing ramp state: hex strings for <input type="color">, alpha 0..1 per
// stop. The harness ColorRamp (RGB tuples + alpha) is derived from this.
export type RampStopState = { position: number; color: string; alpha: number };
export type RampState = { stops: RampStopState[]; mode: RampMode; wrap: boolean };

export const MAX_RAMP_STOPS = 64;

// The neutral baseline: 0 = black, 1 = white. Doubles as the mask-friendly
// default — a value field maps straight to the 0.5 mask threshold.
export const DEFAULT_RAMP_STATE: RampState = {
  stops: [
    { position: 0, color: "#000000", alpha: 1 },
    { position: 1, color: "#ffffff", alpha: 1 },
  ],
  mode: "linear",
  wrap: false,
};

/**
 * What a layer contributes to the composite:
 *   paint  draws its pixels (the normal case)
 *   mask   draws NOTHING — instead it clips the next paint layer below it,
 *          binary: a pixel of that layer shows only where the mask is "on".
 *          Pixel-art mask: on where alpha ≥ 0.5 (wherever color was drawn).
 *          Code mask: on where luminance × alpha ≥ 0.5 — the layer's color
 *          ramp shapes what crosses the threshold, so the ramp IS the mask
 *          control. Binary on purpose: one compare per pixel on the ESP32.
 */
export type LayerRole = "paint" | "mask";

type LayerCommon = {
  id: string;
  name: string;
  visible: boolean;
  /** Layer-wide opacity multiplier, 0..1 — on top of any per-pixel alpha. */
  opacity: number;
  blend: BlendMode;
  role: LayerRole;
  /** Mask polarity: false = bright/colored reveals; true = flips it. */
  maskInvert: boolean;
};

export type CodeLayer = LayerCommon & {
  type: "code";
  code: string;
  ramp: RampState;
  /** Recolor the layer's RGB output through its ramp by luminance. */
  recolor: boolean;
  // Raw `// @knobs` / `// @matrix` lines last applied, so an annotation is
  // re-applied only when the line itself changes (manual tuning survives
  // ordinary edits) — same trick the single-pattern lab used. Knobs
  // themselves are PROJECT-level: there is one physical set of four
  // encoders, shared by every layer (unlike ramps, which chain per layer).
  knobsAnnotationRaw: string | null;
  matrixAnnotationRaw: string | null;
};

type Raster = {
  width: number;
  height: number;
  /**
   * Straight (non-premultiplied) RGBA bytes, width × height × 4. Pixel tools
   * mutate this buffer in place for speed; every mutation bumps `rev` so React
   * and the persistence layer notice.
   */
  data: Uint8ClampedArray;
  rev: number;
};

export type PixelLayer = LayerCommon & Raster & {
  type: "pixel";
};

export type TextAlign = "left" | "center" | "right";
export const TEXT_ALIGNS: TextAlign[] = ["left", "center", "right"];

/** solid: one colour. rampX / rampY: the layer's ramp runs across / down the letters. */
export type TextFill = "solid" | "rampX" | "rampY";
export const TEXT_FILLS: TextFill[] = ["solid", "rampX", "rampY"];

/**
 * What moves the letters, frame by frame, at a speed one knob sets
 * (lib/lab/textEffects.ts):
 *   scroll   the lines run out to the left and come back in from the right
 *   twinkle  each LED dims and brightens on its own beat
 *   ramp     the colours run along the layer's ramp and back
 */
export type TextEffect = "none" | "scroll" | "twinkle" | "ramp";
export const TEXT_EFFECTS: TextEffect[] = ["none", "scroll", "twinkle", "ramp"];

export type TextSpec = {
  /** What it says. A line break starts a new line. */
  text: string;
  /** Font size in LED pixels (CSS px on a 1:1 canvas). */
  size: number;
  /**
   * Where the text sits, in LED pixels. x is the left edge, the middle or the
   * right edge of each line, by `align`; y is the middle of the whole block.
   */
  x: number;
  y: number;
  align: TextAlign;
  /** A font id from lib/lab/textFonts.ts: site:…, system:… or file:…. */
  font: string;
  /** The solid fill, as #rrggbb. */
  color: string;
  fill: TextFill;
  /** Every LED fully on or off, the way pixel art is. Off keeps the font's soft edges as dimmer LEDs. */
  sharp: boolean;
  effect: TextEffect;
  /** The knob that sets the effect's speed, 0..3. Turned all the way down, the effect stands still. */
  effectKnob: number;
};

export const TEXT_SIZE_MIN = 4;
export const TEXT_SIZE_MAX = 128;
export const TEXT_MAX_CHARS = 200;

/**
 * What the scroll and ramp effects work from, drawn with the bitmap: every
 * row of the frame, but only the columns the letters reach, `x` being the
 * first of them in frame pixels. It may start left of the frame and run past
 * its right edge, so a line longer than the panel scrolls through whole.
 *   scroll  the letters in colour
 *   ramp    in each pixel, red is where it sits on the ramp (0..255) and
 *           alpha is how much of it the letters cover
 */
export type TextSource = { x: number; width: number; data: Uint8ClampedArray };

export type TextLayer = LayerCommon & Raster & {
  type: "text";
  spec: TextSpec;
  /** Used when `spec.fill` is a ramp; edited in the Color Ramp panel like a code layer's. */
  ramp: RampState;
  /** Null with no effect, for twinkle (it works on the bitmap) and when no letter lands. */
  source: TextSource | null;
};

export type Layer = CodeLayer | PixelLayer | TextLayer;

/** The layers that hold a bitmap: they composite, mask and export the same way. */
export type RasterLayer = PixelLayer | TextLayer;

/** The layers with a colour ramp of their own. */
export type RampLayer = CodeLayer | TextLayer;

/**
 * `license` is the parent's SPDX id, used to narrow the publish picker to what
 * a derivative may legally use. Optional because drafts saved before it existed
 * do not carry it — the publish API enforces the same rule either way.
 */
export type ForkRef = { id: string; title: string; license?: string | null } | null;

/**
 * The published pattern this project IS — set when its own author opened their
 * post to revise it. The opposite end of `forkOf`: a fork becomes a NEW
 * pattern, an edit updates the row it came from, so Share turns into Update
 * and the community keeps one post with its likes, comments and forks intact.
 *
 * Title, description and visibility ride along so the Update modal opens with
 * what is already published rather than empty fields; `hasCpp` is here because
 * changing the JavaScript detaches the pattern's firmware header, and that is
 * worth saying before the button is pressed, not after.
 */
export type EditRef = {
  id: string;
  title: string;
  description: string | null;
  visibility: string;
  hasCpp: boolean;
  /** How many community ports a code change would send stale. */
  portCount: number;
} | null;

/**
 * What Copy prompt asks an AI for. Until 23 October 2026 this also held the
 * AI gallery's batch size, thinking level and reference count; a project
 * saved then still carries them, and readGen (serialize.ts) lets them go.
 */
export type GenSettings = {
  colorMode: ColorMode;
};

export type LabProject = {
  /**
   * The piece's name — one identity for every hand-off: the hardware
   * export's NAME (and through it the .pfm module slug), the Director's
   * .pfs filename and opening pattern cue, and the publish default. Layer
   * names are parts; this is the work. Empty = unnamed, and consumers fall
   * back to the focus code layer's name via labPatternName().
   */
  name: string;
  matrix: MatrixSize;
  layers: Layer[];
  activeLayerId: string;
  // One physical knob set for the whole composition — every code layer
  // receives the same input, exactly like patterns on the device. (A future
  // "knob button targets a layer" mode stays possible on top of this.)
  knobs: number[];
  ranges: KnobRange[];
  knobLabels: string[];
  forkOf: ForkRef;
  /** Set instead of `forkOf` when this project is the author's own post,
   *  reopened to be revised in place. Never both at once. */
  editOf: EditRef;
  gen: GenSettings;
  /** Knob automation over time — the Director panel's show (see director/). */
  director: DirectorShow;
};

export function layerId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `layer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function cloneRampState(ramp: RampState): RampState {
  return {
    stops: ramp.stops.map((stop) => ({ ...stop })),
    mode: ramp.mode,
    wrap: ramp.wrap,
  };
}

export function createPixelLayer(matrix: MatrixSize, name: string): PixelLayer {
  return {
    id: layerId(),
    type: "pixel",
    name,
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    width: matrix.width,
    height: matrix.height,
    data: new Uint8ClampedArray(matrix.width * matrix.height * 4),
    rev: 0,
  };
}

export function isCodeLayer(layer: Layer | undefined | null): layer is CodeLayer {
  return layer?.type === "code";
}

export function isPixelLayer(layer: Layer | undefined | null): layer is PixelLayer {
  return layer?.type === "pixel";
}

export function isTextLayer(layer: Layer | undefined | null): layer is TextLayer {
  return layer?.type === "text";
}

export function isRasterLayer(layer: Layer | undefined | null): layer is RasterLayer {
  return layer?.type === "pixel" || layer?.type === "text";
}

export function isRampLayer(layer: Layer | undefined | null): layer is RampLayer {
  return layer?.type === "code" || layer?.type === "text";
}

/** A text layer's ramp until someone edits it: warm to cool across the letters. */
export const TEXT_RAMP_STATE: RampState = {
  stops: [
    { position: 0, color: "#ff5a1f", alpha: 1 },
    { position: 0.5, color: "#ffd23f", alpha: 1 },
    { position: 1, color: "#3fa7ff", alpha: 1 },
  ],
  mode: "oklab",
  wrap: false,
};

/**
 * A new text layer's words, font and place: centred, in the site's pixel font
 * and its LED orange. White vanished into the starter pattern's white rings.
 */
export function defaultTextSpec(matrix: MatrixSize): TextSpec {
  return {
    text: "Hello",
    size: 16,
    x: Math.round(matrix.width / 2),
    y: Math.round(matrix.height / 2),
    align: "center",
    font: "site:silkscreen",
    color: "#e8552e",
    fill: "solid",
    sharp: true,
    effect: "none",
    // The second knob is the firmware's Speed, and the only one whose
    // starting value is not at the bottom of its range.
    effectKnob: 1,
  };
}

/** How far off the frame a text may be pushed, in frames: enough to slide it out of sight. */
const OFF_FRAME = 4;

const HEX = /^#[0-9a-f]{6}$/i;

function whole(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

/**
 * A spec every reader can trust: whole pixels, a size the panel offers, a
 * known alignment and fill. `previous` supplies anything missing or broken.
 */
export function normalizeTextSpec(
  raw: Partial<TextSpec>,
  previous: TextSpec,
  frame: { width: number; height: number },
): TextSpec {
  const reachX = frame.width * OFF_FRAME;
  const reachY = frame.height * OFF_FRAME;
  return {
    text: typeof raw.text === "string" ? raw.text.slice(0, TEXT_MAX_CHARS) : previous.text,
    size: whole(raw.size, previous.size, TEXT_SIZE_MIN, TEXT_SIZE_MAX),
    x: whole(raw.x, previous.x, -reachX, reachX),
    y: whole(raw.y, previous.y, -reachY, reachY),
    align: TEXT_ALIGNS.includes(raw.align as TextSpec["align"]) ? (raw.align as TextSpec["align"]) : previous.align,
    font: typeof raw.font === "string" && raw.font ? raw.font.slice(0, 120) : previous.font,
    color: typeof raw.color === "string" && HEX.test(raw.color) ? raw.color.toLowerCase() : previous.color,
    fill: TEXT_FILLS.includes(raw.fill as TextSpec["fill"]) ? (raw.fill as TextSpec["fill"]) : previous.fill,
    sharp: typeof raw.sharp === "boolean" ? raw.sharp : previous.sharp,
    effect: TEXT_EFFECTS.includes(raw.effect as TextEffect) ? (raw.effect as TextEffect) : previous.effect,
    effectKnob: whole(raw.effectKnob, previous.effectKnob, 0, 3),
  };
}

/** An undrawn text layer: lib/lab/store/text.ts draws its bitmap. */
export function createTextLayer(matrix: MatrixSize, name: string): TextLayer {
  return {
    id: layerId(),
    type: "text",
    name,
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    width: matrix.width,
    height: matrix.height,
    data: new Uint8ClampedArray(matrix.width * matrix.height * 4),
    rev: 0,
    spec: defaultTextSpec(matrix),
    ramp: cloneRampState(TEXT_RAMP_STATE),
    source: null,
  };
}

/** Next free "Prefix N" name given the existing stack. */
export function nextLayerName(layers: Layer[], prefix: string): string {
  let max = 0;
  for (const layer of layers) {
    const match = layer.name.match(new RegExp(`^${prefix}\\s+(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix} ${max + 1}`;
}
