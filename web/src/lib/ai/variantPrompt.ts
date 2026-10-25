// The prompt Pattern Lab's Copy prompt puts on the clipboard (CodePanel.tsx):
// the focused code layer as a seed, the frame, the knobs as they stand and
// the API rules, for whatever AI chat the user pastes it into. Two places copy
// its wording. The guide's practice AI tells it apart by lines it always
// writes (components/guide/desk/ai/answers.ts, checked by answers.test.ts),
// and the community atlas mirrors it (lib/atlas/data.ts). Change them with it.

import { buildMatrixAnnotationLine, describeMatrixShape, type MatrixSize } from "@/lib/pattern/matrix";
import type { ColorMode } from "./settings";

const KNOB_LABELS = ["Knob 1", "Knob 2", "Knob 3", "Knob 4"];

function controlLines(knobs: number[], ranges: Array<[number, number]>) {
  return ranges
    .map(
      (range, index) =>
        `- ${KNOB_LABELS[index]} range: ${range[0]} to ${range[1]}, current value: ${knobs[index]}`,
    )
    .join("\n");
}

// ── Frame ───────────────────────────────────────────────────────────────────
// One honest statement of the pixel grid, derived from the numbers alone. This
// is the ONLY place the model is told about shape — no compensating axis
// flips, no second "orientation" knob to disagree with it.
function frameLine(matrix: MatrixSize) {
  const { width, height } = matrix;
  const shape = describeMatrixShape(matrix);
  const shapeNote =
    shape === "landscape"
      ? `It is WIDER than it is tall (${(width / height).toFixed(2)}:1). Compose for a wide frame.`
      : shape === "portrait"
        ? `It is TALLER than it is wide (1:${(height / width).toFixed(2)}). Compose for a tall frame — a design meant for a wide frame will read as cramped and over-zoomed here.`
        : "It is SQUARE. Compose for a square frame.";
  return `Frame — the pattern is drawn into a ${width} × ${height} pixel grid: ${width} wide (x = 0..${width - 1}) and ${height} tall (y = 0..${height - 1}). ${shapeNote} Lay the composition, bands, and motion out for these proportions.`;
}

function variantIntro(matrix: MatrixSize) {
  return `I am writing custom LED patterns in JavaScript for a Patternflow ${matrix.width}x${matrix.height} LED matrix web preview.

${frameLine(matrix)}

I will give you one existing Patternflow pattern. Use it as a seed, not as a cage. Create exactly 5 distinct standalone variations that explore different visual directions.`;
}

// Technical + quality spec (API rules, controls, color).
// Split into pieces so the pixel-write rule and the color section can swap
// depending on ColorMode.
const TECH_API_COMMON = `Required API for every pattern:
- export function setup(params) {}
- export function update(dt, input, params) {}
- export function draw(display, params, time) {}
- Use input.knobValues as the primary control API. input.knobValues is an array of 4 absolute knob values after the min/max ranges are applied.
- Declare the ranges your 4 knobs want with ONE comment line near the top of the file, exactly this format:
  // @knobs Folds=3..12, Speed=0.1..10, Zoom=2..17, Contrast=0.1..1
  (exactly 4 comma-separated entries, Name=min..max, short names). Pattern Lab parses this line, renames the on-screen knobs, and sets their min/max automatically — the user can then retune any range and your pattern follows, because you read the values back through input.knobValues.
- Read input.knobValues[i] directly as the parameter value (matching your @knobs ranges). Do NOT read input.knobNormalized and remap it with baked constants such as 3 + kn[0] * 9 — that disconnects Pattern Lab's range editor (the user's min/max edits stop doing anything). input.knobNormalized is acceptable only for a truly unitless 0..1 blend where any range would mean the same thing.
- Keep input.knobDeltas only as compatibility fallback if needed.
- Optional: each knob also has a push button. input.btnPressed[i] is true only on the frame it is pressed (edge); input.btnHeld[i] is true while it is held down. Use these for momentary actions like reset, freeze, cycle, or trigger. Do not use long-press or mode-switching; that is a reserved system gesture.
- IMPORTANT: input is passed ONLY to update(dt, input, params). draw's signature is draw(display, params, time) with NO input argument — params.input does not exist. To read knob or button values inside draw, use params.knobValues / params.knobNormalized / params.knobDeltas / params.btnPressed / params.btnHeld (the harness mirrors the latest input onto params every frame), or stash whatever you need on params during update. Never read input.* or params.input.* inside draw.
- Use display.width and display.height in loops. Never hardcode the frame's pixel dimensions inside draw() — the same pattern is run at other resolutions, and a hardcoded size crops or zooms it.
- Declare the frame you composed for with ONE comment line near the top of the file, exactly this format:
  {{MATRIX_LINE}}
  Use exactly the dimensions given above. Pattern Lab reads this line to set the preview resolution, and the firmware uses it to map the pattern onto the physical panel.`;

const TECH_PIXEL_RGB = `- Write each pixel with display.setPixel(x, y, r, g, b) — EXACTLY five arguments, where r, g, b are three SEPARATE integer arguments in the range 0–255. Never pass a color array such as display.setPixel(x, y, [r, g, b]); never pass a packed color or a 4th alpha argument. The array form renders pure black.
- Use only plain JavaScript and Math.*. No browser APIs, DOM APIs, imports, async code, external libraries, dynamic evaluation, or per-pixel allocations.`;

const TECH_PIXEL_VFIELD = `- Write each pixel with display.setValue(x, y, v) — EXACTLY three arguments, where v is a single number from 0.0 to 1.0. Do NOT call display.setPixel anywhere.
- Use only plain JavaScript and Math.*. No browser APIs, DOM APIs, imports, async code, external libraries, dynamic evaluation, or per-pixel allocations.`;

const TECH_CONTROLS = `Creative control mapping:
- It is okay to keep one knob as animation speed, preferably Knob 2, if that suits the pattern.
- Do not keep all four knobs as the same old hue/speed/mode/frequency template unless it is genuinely the best fit.
- Redesign the controls creatively for each pattern. Examples: cell size, symmetry fold, glitch amount, palette split, trail length, scanline spacing, pulse width, inversion threshold, rotation, warp depth, density, edge thickness, phase offset, bloom-like gain, or motif selection.
- Each pattern should have a slightly different control personality. The controls should reveal the unique idea of that pattern.
- Include a short comment near setup() or update() naming what the 4 knobs do for that specific pattern.`;

const TECH_COLOR_RGB = `Color direction:
- Make color part of the pattern logic, not just a global hue wash.
- Avoid relying on a single full-frame gradient or a uniform hue shift across the whole image.
- Prefer colors that respond to local pattern values: distance fields, cell seeds, stripe index, phase, brightness, threshold bands, motion direction, edge thickness, density, or mask state.
- Good examples: large values become red while small values become blue; interior/exterior use different palettes; threshold bands step through 3-5 colors; cell IDs pick related colors; moving fronts leave warmer highlights; thin edges are white while filled regions are saturated.
- Both smooth local gradients and stepped posterized color bands are welcome, as long as the color changes are tied to the geometry or signal of the pattern.
- Keep at least some pixels near full LED brightness.`;

const TECH_COLOR_VFIELD = `Value-field direction (IMPORTANT — there is NO color in this pattern):
- The pattern outputs only a scalar value field via display.setValue(x, y, v). Color is applied OUTSIDE the pattern by a user-controlled color ramp that maps v = 0..1 to colors.
- Do NOT compute any colors, palettes, hues, RGB values, or hsvToRgb helpers anywhere. No color logic at all — pour all effort into geometry, structure, and motion.
- Treat v as the pattern's tonal value and design the field so it reads well under ANY ramp:
  - Use the full 0..1 range every frame: some pixels near 0, some near 1.
  - Build deliberate tonal structure tied to the geometry: edges, bands, plateaus, gradients driven by distance, phase, cell id, density, or masks.
  - Value contrast is your only material — sharp boundaries, layered levels, and clear figure/ground separation matter more than in RGB mode.
  - Avoid uniform mid-grey mush (everything hovering near 0.5) and avoid pure binary output unless the idea is intentionally hard-edged.
- Knobs must control geometry/motion/structure, never color (no hue knobs — color belongs to the ramp).`;

function buildTechGuide(colorMode: ColorMode, matrix: MatrixSize) {
  const pixelRule = colorMode === "vfield" ? TECH_PIXEL_VFIELD : TECH_PIXEL_RGB;
  const colorSection = colorMode === "vfield" ? TECH_COLOR_VFIELD : TECH_COLOR_RGB;
  const api = TECH_API_COMMON.replace("{{MATRIX_LINE}}", buildMatrixAnnotationLine(matrix));
  return `${api}\n${pixelRule}\n\n${TECH_CONTROLS}\n\n${colorSection}`;
}

// Seed-based direction: remix one existing pattern.
const VARIANT_SEED_DIRECTION = `Variation direction:
- Keep the general intent and the four control roles understandable, but do not copy the original structure too literally.
- At least 3 of the 5 variations must change the main drawing algorithm, not only constants, colors, thresholds, or speed.
- Avoid making all 5 outputs feel like the same pattern with different parameter values.
- Do not reuse the same grid, shape, distance formula, or composition in every variation.
- Give each variation a different dominant idea. Use these five directions:
  1. Structural remix: change the main geometry or repetition system.
  2. Motion remix: change how time moves through the pattern.
  3. Palette/material remix: change color logic, brightness rhythm, or foreground/background relationship.
  4. Domain remix: warp, mirror, fold, scroll, rotate, or otherwise remap coordinates.
  5. Contrast remix: make a clearly different sparse/dense, hard/soft, or organic/mechanical interpretation.
- The variations can be bold. They should still feel related to the seed, but not trapped inside its exact look.
- Keep the patterns bright enough for an LED matrix and reasonably ESP32-friendly.
- Avoid smoothing/lerping knob-controlled values unless the visual idea specifically needs inertia.`;


// The model returns 5 markdown code blocks, in the ColorMode picked beside the
// button.
export function buildVariantCopyPrompt(
  code: string,
  knobs: number[],
  ranges: Array<[number, number]>,
  colorMode: ColorMode = "rgb",
  matrix: MatrixSize = { width: 128, height: 64 },
) {
  return `${variantIntro(matrix)}

Very important output rules:
- Return exactly 5 separate JavaScript code blocks.
- Each code block must be a complete standalone Patternflow pattern.
- Do not combine the 5 variations into one file.
- Do not add a mode selector, preset array, switch statement, or any code that contains multiple patterns in one output.
- Do not write wrapper text inside the code blocks.
- Put a short variation name before each code block.
- Do not include nested triple backticks inside any code block.

${buildTechGuide(colorMode, matrix)}

${VARIANT_SEED_DIRECTION}

Current Pattern Lab controls:
${controlLines(knobs, ranges)}

Existing pattern${
    colorMode === "vfield"
      ? " (NOTE: if this seed calls display.setPixel and computes colors, it is an older RGB-mode pattern — take only its geometry/motion ideas; every variation you output must use display.setValue(x, y, v) with NO color logic)"
      : ""
  }:
\`\`\`javascript
${code}
\`\`\``;
}
