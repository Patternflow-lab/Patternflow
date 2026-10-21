import {
  ENCODER_CLICKS_PER_TURN,
  LOGICAL_KNOB_RANGES,
  LOGICAL_KNOB_WRAP,
  TURNS_PER_FULL_RANGE,
  knobDetentStep,
} from '@/lib/pattern/controls';

// What "Copy creation prompt" under the Live Editor puts on the clipboard
// (PatternPanel.tsx).
//
// The knob lines are worked out from the ranges the preview's knobs turn
// through. They used to be typed in, and said 0.05 a detent (0.10 for Knob 2)
// long after the encoder was counted at 24 detents a turn with two turns to a
// range, which makes Knob 2's detent 0.206.

// Three decimals, as the Lab's C++ prompt rounds the same step
// (lib/lab/cppPrompt.ts).
function roundStep(value: number) {
  return Math.round(value * 1000) / 1000;
}

export function knobRangeLines() {
  return LOGICAL_KNOB_RANGES.map(([min, max], index) => {
    const edges = LOGICAL_KNOB_WRAP[index] ? 'wraps' : 'clamps';
    const step = roundStep(knobDetentStep([min, max]));
    return `- Knob ${index + 1}: ${min.toFixed(1)} to ${max.toFixed(1)}, ${edges} at edges, step ${step} per detent.`;
  }).join('\n');
}

export const getVariantPrompt = (code: string) => `I am writing custom LED patterns in JavaScript for Patternflow's 128x64 LED matrix web preview.

I will give you one existing Patternflow pattern. Use it as a seed, not as a cage. Create exactly 5 distinct standalone variations that explore different visual directions.

Very important output rules:
- Return exactly 5 separate JavaScript code blocks.
- Each code block must be a complete standalone Patternflow pattern.
- Do not combine the 5 variations into one file.
- Do not add a mode selector, preset array, switch statement, or any code that contains multiple patterns in one output.
- Do not write wrapper text inside the code blocks.
- Put a short variation name before each code block.
- Do not include nested triple backticks inside any code block.

Required API for every variation:
- export function setup(params) {}
- export function update(dt, input, params) {}
- export function draw(display, params, time) {}
- Use input.knobValues as the primary control API. input.knobValues is an array of 4 absolute knob values after the min/max ranges are applied.
- input.knobNormalized is also available when a 0.0-1.0 value is useful.
- Keep input.knobDeltas only as compatibility fallback if needed.
- Use display.width and display.height in loops. Do not hardcode 128 or 64 inside draw().
- Use only plain JavaScript and Math.*. No browser APIs, DOM APIs, imports, async code, external libraries, dynamic evaluation, or per-pixel allocations.

Creative control mapping:
- It is okay to keep one knob as animation speed, preferably Knob 2, if that suits the variation.
- Do not keep all four knobs as the same old hue/speed/mode/frequency template unless it is genuinely the best fit.
- Redesign the other controls creatively for each variation. Examples: cell size, symmetry fold, glitch amount, palette split, trail length, scanline spacing, pulse width, inversion threshold, rotation, warp depth, density, edge thickness, phase offset, bloom-like gain, or motif selection.
- Each of the 5 variations should have a slightly different control personality. The controls should reveal the unique idea of that variation.
- Include a short comment near setup() or update() naming what the 4 knobs do for that specific variation.

Color direction:
- Make color part of the pattern logic, not just a global hue wash.
- Avoid relying on a single full-frame gradient or a uniform hue shift across the whole image.
- Prefer colors that respond to local pattern values: distance fields, cell seeds, stripe index, phase, brightness, threshold bands, motion direction, edge thickness, density, or mask state.
- Good examples: large values become red while small values become blue; interior/exterior use different palettes; threshold bands step through 3-5 colors; cell IDs pick related colors; moving fronts leave warmer highlights; thin edges are white while filled regions are saturated.
- Both smooth local gradients and stepped posterized color bands are welcome, as long as the color changes are tied to the geometry or signal of the pattern.
- Keep at least some pixels near full LED brightness.

Variation direction:
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
- Avoid smoothing/lerping knob-controlled values unless the visual idea specifically needs inertia.

Knob ranges for the Patternflow live editor. The encoder has ${ENCODER_CLICKS_PER_TURN} detents a turn, and ${TURNS_PER_FULL_RANGE} turns cross a knob's whole range:
${knobRangeLines()}

Existing pattern:
\`\`\`javascript
${code}
\`\`\``;
