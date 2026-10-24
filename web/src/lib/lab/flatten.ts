// ── Layer-stack flattening ───────────────────────────────────────────────────
// Turns the lab's layered composition into ONE standalone JS pattern that any
// existing consumer understands: the community sandbox, "Open in Pattern Lab",
// the AI variation prompt, and — because the output is plain setup/update/draw
// with setPixel — the C++ conversion prompt for the ESP32 firmware (the .h
// path). That last consumer shapes every choice here:
//
//   · each code layer's color ramp is baked into a 256×4 RGBA LUT array —
//     no interpolation code to translate, just a table to copy
//   · pixel-art layers embed as base64 with a ~10-line alphabet decoder
//     (no atob), run-length coded as {count-1, r, g, b, a} — the same shape
//     the .h exporter writes — whenever that is smaller than the raw bytes.
//     Raw RGBA is 44 KB per 128×64 layer; the community caps a pattern at
//     CODE_MAX, so two raw layers could not be published at all. Typical
//     pixel art (transparent background, flat fills) runs to a few KB.
//   · blending is the same integer-friendly math as compositor.ts — keep the
//     two in sync
//
// Layer code is embedded inside an IIFE so same-named functions/consts in two
// layers can never collide; the wrapper feeds each layer a private display
// writing into its own RGBA buffer, then composites bottom → top.

import { buildRampLUTRGBA } from "@/lib/pattern/harness";
import { withMatrixAnnotation, type MatrixSize } from "@/lib/pattern/matrix";
import { codeUsesValueField } from "@/lib/pattern/ramp";
import { KNOBS_ANNOTATION_RE, buildKnobsAnnotationLine, defaultKnobState } from "./annotations";
import { exportStack } from "./compositor";
import { rampStateToHarness } from "./engine";
import { bytesToBase64 } from "./serialize";
import { TEXT_EFFECT_RATE, activeTextEffect, textEffectPeriod, type ActiveTextEffect } from "./textEffects";

/**
 * Run-length encode straight RGBA bytes as {count-1, r, g, b, a} tuples
 * (runs of up to 256 identical pixels). Mirrors `__rle` in the preamble
 * below and the RLE the .h exporter emits.
 */
export function rleEncodeRGBA(data: Uint8ClampedArray): Uint8ClampedArray {
  const pixels = data.length >> 2;
  const runs: number[] = [];
  let index = 0;
  while (index < pixels) {
    const base = index * 4;
    const r = data[base];
    const g = data[base + 1];
    const b = data[base + 2];
    const a = data[base + 3];
    let count = 1;
    while (
      count < 256 &&
      index + count < pixels &&
      data[(index + count) * 4] === r &&
      data[(index + count) * 4 + 1] === g &&
      data[(index + count) * 4 + 2] === b &&
      data[(index + count) * 4 + 3] === a
    ) {
      count++;
    }
    runs.push(count - 1, r, g, b, a);
    index += count;
  }
  return new Uint8ClampedArray(runs);
}

/** The embed expression for one pixel layer: RLE when it wins, raw otherwise. */
function pixelBufferLiteral(data: Uint8ClampedArray, length = "__W * __H * 4"): string {
  const rle = rleEncodeRGBA(data);
  return rle.length < data.length
    ? `__rle("${bytesToBase64(rle)}", ${length})`
    : `__b64("${bytesToBase64(data)}", ${length})`;
}
import { isRasterLayer, type CodeLayer, type KnobRange, type Layer, type RampLayer, type TextLayer } from "./types";

export type FlattenKnobs = { labels: string[]; ranges: KnobRange[] };

function stripForEmbedding(code: string): string {
  return (
    code
      .replace(/^\s*import\s+.*?;?\s*$/gm, "")
      .replace(/\bexport\s+function\b/g, "function")
      .replace(KNOBS_ANNOTATION_RE, "")
      .replace(/^[ \t]*\/\/[ \t]*@matrix[ \t].*$/gm, "")
      .replace(/^[ \t]*\/\/[ \t]*@ramp[ \t].*$/gm, "")
      // A layer pasted from a shared composition may still carry that
      // composition's @stack line. Left in, it sits before the one this
      // export appends — and the first match wins on reopen, restoring
      // somebody else's layers instead of these.
      .replace(/^[ \t]*\/\/[ \t]*@stack[ \t].*$/gm, "")
  );
}

/** A layer name inside a `//` comment: every line terminator JS knows, not just \n. */
function commentSafe(name: string): string {
  return name.replace(/[\r\n\u2028\u2029]/g, " ");
}

function lutLiteral(layer: RampLayer): string {
  const lut = buildRampLUTRGBA(rampStateToHarness(layer.ramp));
  return `[${Array.from(lut).join(",")}]`;
}

/**
 * The fx object of a moving text layer. Scroll and ramp read the source,
 * twinkle the bitmap; ramp brings its ramp as a LUT.
 */
function textFxLiteral(layer: TextLayer, effect: ActiveTextEffect): string {
  const source = effect === "twinkle" ? { x: 0, width: layer.width, data: layer.data } : layer.source!;
  return `{
    kind: "${effect}", knob: ${layer.spec.effectKnob}, rate: ${TEXT_EFFECT_RATE[effect]}, period: ${textEffectPeriod(effect, layer)}, phase: 0,
    srcX: ${source.x}, srcW: ${source.width}, lead: ${layer.width - source.x},
    lut: ${effect === "ramp" ? lutLiteral(layer) : "null"},
    src: ${pixelBufferLiteral(source.data, `${source.width} * __H * 4`)},
  }`;
}

// textEffects.ts, in the export's own words. Keep the two in step:
// textExport.test.ts compares them pixel for pixel.
const TEXT_FX_HELPERS = `
// Text effects: each frame a moving text layer is drawn again from what it
// carries, at a phase one knob speeds up (0 stands it still). Whole numbers
// per pixel, so the firmware header lights the same LEDs.
function __fxHash(x, y) {
  let h = Math.imul(x + 1, 0x9e3779b1) ^ Math.imul(y + 1, 0x85ebca77);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h & 255;
}

function __fxAdvance(F, dt, input) {
  const k = input && input.knobNormalized ? Number(input.knobNormalized[F.knob]) : 0;
  const n = k > 0 ? (k < 1 ? k : 1) : 0;
  let p = F.phase + dt * (n * F.rate);
  if (!(p >= 0)) p = 0;
  else if (p >= F.period) p %= F.period;
  F.phase = p;
}

function __fxDraw(L) {
  const F = L.fx, B = L.buf, S = F.src, W = F.srcW, s = Math.floor(F.phase);
  if (F.kind === "scroll") {
    const m = (((s + F.lead) % F.period) + F.period) % F.period, shift = m - __W;
    for (let y = 0; y < __H; y++) {
      for (let x = 0; x < __W; x++) {
        const j = (y * __W + x) * 4, c = x + shift;
        if (c < 0 || c >= W) { B[j] = B[j + 1] = B[j + 2] = B[j + 3] = 0; continue; }
        const i = (y * W + c) * 4;
        B[j] = S[i]; B[j + 1] = S[i + 1]; B[j + 2] = S[i + 2]; B[j + 3] = S[i + 3];
      }
    }
  } else if (F.kind === "twinkle") {
    for (let y = 0; y < __H; y++) {
      for (let x = 0; x < __W; x++) {
        const j = (y * __W + x) * 4, a = S[j + 3];
        B[j] = S[j]; B[j + 1] = S[j + 1]; B[j + 2] = S[j + 2];
        if (a === 0) { B[j + 3] = 0; continue; }
        const u = (s + __fxHash(x, y)) & 255, tri = u < 128 ? u : 255 - u;
        B[j + 3] = Math.floor((a * (255 - tri - (tri >> 1)) + 127) / 255);
      }
    }
  } else {
    const T = F.lut;
    for (let y = 0; y < __H; y++) {
      for (let x = 0; x < __W; x++) {
        const j = (y * __W + x) * 4, c = x - F.srcX, i = (y * W + c) * 4;
        const a = c < 0 || c >= W ? 0 : S[i + 3];
        if (a === 0) { B[j] = B[j + 1] = B[j + 2] = B[j + 3] = 0; continue; }
        const u = (S[i] + s) & 511, k = (u < 256 ? u : 511 - u) * 4;
        B[j] = T[k]; B[j + 1] = T[k + 1]; B[j + 2] = T[k + 2];
        B[j + 3] = Math.floor((a * T[k + 3] + 127) / 255);
      }
    }
  }
}`;

/**
 * The code layer a single plain pattern is made of: the one layer left
 * showing, drawn over the panel's black exactly as its code draws it. Null
 * when the composition is a stack. The community upload and To hardware both
 * take this layer, so the board gets what was published.
 */
export function loneCodeLayer(layers: Layer[]): CodeLayer | null {
  const visible = layers.filter(
    (layer) => layer.visible && (layer.role === "mask" || layer.opacity > 0),
  );
  if (visible.length !== 1) return null;
  const [layer] = visible;
  if (layer.type !== "code" || layer.role === "mask") return null;
  // Over black, normal, add and screen at 100% leave the code's pixels as
  // they are. Under 100% they dim, and multiply turns them black: a white
  // layer at 50% showed 128 in the preview, and its code alone lit the board
  // at 255. Such a layer goes out as a stack of one, opacity and blend kept.
  return layer.opacity >= 1 && layer.blend !== "multiply" ? layer : null;
}

/** Does this composition even need flattening, or is it a single plain pattern? */
export function needsFlatten(layers: Layer[]): boolean {
  return loneCodeLayer(layers) === null;
}

export function flattenLayers(
  layers: Layer[],
  matrix: MatrixSize,
  knobConfig?: FlattenKnobs,
): string {
  // Bottom → top for compositing. Masks ride along regardless of their own
  // opacity (opacity is a paint concept; a mask is binary), unless they rest
  // on a 0% layer: those gate nothing, in the preview too.
  const stack = exportStack(layers);

  const manifest = stack
    .map(
      (layer, index) =>
        `//   ${index + 1}. ${commentSafe(layer.name)} (${layer.type}, ${
          layer.role === "mask"
            ? `MASK${layer.maskInvert ? " inverted" : ""}`
            : `${layer.blend}, ${Math.round(layer.opacity * 100)}%`
        })`,
    )
    .join("\n");

  const parts: string[] = [];
  parts.push(`// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
${manifest}
const __W = ${matrix.width}, __H = ${matrix.height};
const __stack = [];

function __b64(s, n) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = new Uint8ClampedArray(n);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < s.length && o < n; i++) {
    const v = A.indexOf(s[i]);
    if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
  }
  return out;
}

// Run-length coded RGBA: base64 of {count-1, r, g, b, a} tuples.
function __rle(s, n) {
  const t = __b64(s, (s.length * 3) >> 2), out = new Uint8ClampedArray(n);
  let o = 0;
  for (let i = 0; i + 4 < t.length && o < n; i += 5) {
    for (let k = t[i] + 1; k > 0 && o < n; k--) {
      out[o++] = t[i + 1]; out[o++] = t[i + 2]; out[o++] = t[i + 3]; out[o++] = t[i + 4];
    }
  }
  return out;
}

// The preview's display rules (harness.ts): a coordinate floors, so a point
// at y = -0.5 falls off the top instead of landing on row 0, and a colour
// rounds half up, with anything that is not a finite number drawn as 0.
function __byte(v) {
  return Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(v))) : 0;
}

function __mkDisplay(L) {
  return {
    width: __W, height: __H,
    setPixel(x, y, r, g, b) {
      const xi = Math.floor(x), yi = Math.floor(y);
      if (xi < 0 || xi >= __W || yi < 0 || yi >= __H) return;
      const i = (yi * __W + xi) * 4, B = L.buf;
      if (Array.isArray(r)) { B[i] = __byte(r[0]); B[i + 1] = __byte(r[1]); B[i + 2] = __byte(r[2]); }
      else { B[i] = __byte(r); B[i + 1] = __byte(g); B[i + 2] = __byte(b); }
      B[i + 3] = 255;
    },
    setValue(x, y, v) {
      const xi = Math.floor(x), yi = Math.floor(y);
      if (xi < 0 || xi >= __W || yi < 0 || yi >= __H) return;
      v = Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0;
      const i = (yi * __W + xi) * 4, B = L.buf, T = L.lut;
      if (T) {
        const li = Math.round(v * 255) * 4;
        B[i] = T[li]; B[i + 1] = T[li + 1]; B[i + 2] = T[li + 2]; B[i + 3] = T[li + 3];
      } else {
        const byte = Math.round(v * 255);
        B[i] = byte; B[i + 1] = byte; B[i + 2] = byte; B[i + 3] = 255;
      }
    },
  };
}`);

  // Text layers that move: each carries what it moves and a phase the knob
  // speeds up. The helpers are textEffects.ts step for step.
  const effects = new Map<TextLayer, ActiveTextEffect>();
  for (const layer of stack) {
    const effect = layer.type === "text" ? activeTextEffect(layer) : null;
    if (layer.type === "text" && effect) effects.set(layer, effect);
  }
  if (effects.size > 0) parts.push(TEXT_FX_HELPERS);

  for (const layer of stack) {
    const roleProps = `role: "${layer.role}", maskInvert: ${layer.maskInvert}`;
    const effect = layer.type === "text" ? effects.get(layer) : undefined;
    if (layer.type === "text" && effect) {
      parts.push(`
// ── text layer, ${effect} on knob ${layer.spec.effectKnob + 1}: ${commentSafe(layer.name)} ──
__stack.push({
  kind: "pixel", opacity: ${layer.opacity}, blend: "${layer.blend}", ${roleProps},
  buf: new Uint8ClampedArray(__W * __H * 4),
  fx: ${textFxLiteral(layer, effect)},
});`);
      continue;
    }
    if (isRasterLayer(layer)) {
      // A text layer travels as the pixels it was last drawn as: the font
      // stays in the browser that has it.
      parts.push(`
// ── ${layer.type === "text" ? "text layer, as drawn" : "pixel layer"}: ${commentSafe(layer.name)} ──
__stack.push({
  kind: "pixel", opacity: ${layer.opacity}, blend: "${layer.blend}", ${roleProps},
  buf: ${pixelBufferLiteral(layer.data)},
});`);
      continue;
    }

    const usesValue = codeUsesValueField(layer.code);
    const needsLUT = usesValue || layer.recolor;
    parts.push(`
// ── code layer: ${commentSafe(layer.name)} ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;
  // The layer's code gets a scope of its own below the shadows, so
  // \`const draw = …\` declares a new draw instead of clashing with the var.
  const __fns = (function () {
${stripForEmbedding(layer.code)}
    return {
      setup: typeof setup === "function" ? setup : null,
      update: typeof update === "function" ? update : null,
      draw: typeof draw === "function" ? draw : null,
    };
  })();
  __stack.push({
    kind: "code", opacity: ${layer.opacity}, blend: "${layer.blend}", recolor: ${layer.recolor}, ${roleProps},
    lut: ${needsLUT ? lutLiteral(layer) : "null"},
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: __fns.setup,
    fUpdate: __fns.update,
    fDraw: __fns.draw,
  });
})();`);
  }

  parts.push(`
// Mask grouping: a mask layer paints nothing — it gates the nearest paint
// layer BELOW it (stacked masks intersect). Binary threshold: pixel-art masks
// switch on where alpha >= 0.5, code masks where luminance × alpha >= 0.5.
const __groups = [];
{
  let last = null;
  for (const L of __stack) {
    if (L.role === "mask") { if (last) last.masks.push(L); continue; }
    L.masks = [];
    last = L;
    if (L.opacity > 0) __groups.push(L);
  }
}

function __maskOn(M, j) {
  const B = M.buf;
  let on;
  if (M.kind === "pixel") on = B[j + 3] >= 128;
  else on = (0.2126 * B[j] + 0.7152 * B[j + 1] + 0.0722 * B[j + 2]) * (B[j + 3] / 255) >= 127.5;
  return M.maskInvert ? !on : on;
}

// One shared knob set: every layer receives the same input, exactly like
// patterns running on the device's four physical encoders.
function __mirror(L) {
  const inp = L.lastInput;
  if (!inp) return;
  L.params.knobValues = inp.knobValues;
  L.params.knobNormalized = inp.knobNormalized;
  L.params.knobDeltas = inp.knobDeltas;
  L.params.knobRanges = inp.knobRanges;
  L.params.btnPressed = inp.btnPressed;
  L.params.btnHeld = inp.btnHeld;
}

export function setup(params) {
  for (const L of __stack) {
    if (L.kind !== "code") continue;
    L.display = __mkDisplay(L);
    if (L.fSetup) L.fSetup(L.params);
  }
}

export function update(dt, input, params) {
  for (const L of __stack) {
    if (L.fx) __fxAdvance(L.fx, dt, input);
    if (L.kind !== "code") continue;
    L.lastInput = input;
    __mirror(L);
    if (L.fUpdate) L.fUpdate(dt, input, L.params);
  }
}

export function draw(display, params, time) {
  for (const L of __stack) {
    if (L.fx) __fxDraw(L);
    if (L.kind !== "code" || !L.fDraw) continue;
    L.buf.fill(0);
    __mirror(L);
    L.fDraw(L.display, L.params, time);
    if (L.recolor && L.lut) {
      const B = L.buf, T = L.lut;
      for (let i = 0; i < B.length; i += 4) {
        if (B[i + 3] === 0) continue;
        const lum = Math.round(0.2126 * B[i] + 0.7152 * B[i + 1] + 0.0722 * B[i + 2]) * 4;
        B[i] = T[lum]; B[i + 1] = T[lum + 1]; B[i + 2] = T[lum + 2]; B[i + 3] = T[lum + 3];
      }
    }
  }

  // Composite bottom → top over the panel's opaque black.
  const count = __W * __H;
  for (let i = 0; i < count; i++) {
    const j = i * 4;
    let r = 0, g = 0, b = 0;
    for (const L of __groups) {
      let hidden = false;
      for (let m = 0; m < L.masks.length; m++) {
        if (!__maskOn(L.masks[m], j)) { hidden = true; break; }
      }
      if (hidden) continue;
      const B = L.buf;
      const a = (B[j + 3] / 255) * L.opacity;
      if (a <= 0) continue;
      const sr = B[j], sg = B[j + 1], sb = B[j + 2], inv = 1 - a;
      if (L.blend === "add") { r += sr * a; g += sg * a; b += sb * a; }
      else if (L.blend === "multiply") {
        r = r * inv + ((r * sr) / 255) * a;
        g = g * inv + ((g * sg) / 255) * a;
        b = b * inv + ((b * sb) / 255) * a;
      } else if (L.blend === "screen") {
        r = r * inv + (255 - ((255 - r) * (255 - sr)) / 255) * a;
        g = g * inv + (255 - ((255 - g) * (255 - sg)) / 255) * a;
        b = b * inv + (255 - ((255 - b) * (255 - sb)) / 255) * a;
      } else {
        r = r * inv + sr * a;
        g = g * inv + sg * a;
        b = b * inv + sb * a;
      }
    }
    display.setPixel(i % __W, (i / __W) | 0, r, g, b);
  }
}`);

  // Carry the shared knob labels/ranges so reopening the flattened pattern
  // restores the same tuning.
  const hasCode = stack.some((layer): layer is CodeLayer => layer.type === "code") || effects.size > 0;
  const knobState = knobConfig ?? {
    labels: defaultKnobState().labels,
    ranges: defaultKnobState().ranges,
  };
  const knobsLine = hasCode
    ? buildKnobsAnnotationLine(knobState.labels, knobState.ranges)
    : null;

  const body = parts.join("\n");
  return withMatrixAnnotation(knobsLine ? `${knobsLine}\n${body}` : body, matrix);
}
