// ── Lab store: helpers the slices share ──────────────────────────────────────
// Pure functions over project state — building a layer from source, the
// default project, resizing pixel layers to a new matrix — that more than
// one slice needs. No store access here; the slices do that. The one thing
// outside the state a resize touches is the Pixel panel's undo stack.

import { DEFAULT_MATRIX, matchMatrixAnnotation, parseMatrixAnnotation, type MatrixSize } from "@/lib/pattern/matrix";
import { parseRampAnnotation, stripRampAnnotation } from "@/lib/pattern/ramp";
import { livePresets } from "@/lib/presets";
import { applyKnobEntries, defaultKnobState, matchKnobsAnnotation, parseKnobsAnnotation, type KnobAnnotationEntry } from "../annotations";
import { emptyShow } from "../director/types";
import { snapshotPixels } from "../pixelHistory";
import { resizeSurface } from "../pixelTools";
import { drawTextLayer } from "../text";
import { DEFAULT_RAMP_STATE, cloneRampState, isRampLayer, layerId, type CodeLayer, type LabProject, type Layer, type RampLayer, type RampState, type RasterLayer } from "../types";
const labPresets = livePresets.filter((preset) => preset.labOnly);
export const initialLabPreset = labPresets[0] ?? livePresets[0];

// The starter reads knob 2 for speed and knob 3 for spacing, the two the
// default preset labels Speed and Freq, so turning a knob moves the new layer
// along with the pattern under it.
export const STARTER_CODE = `// New layer — draws scrolling bands as a value field, colored by this layer's ramp.
// Knob 2 sets the speed, knob 3 how many bands fit across.
// Replace with your own pattern. Only draw() is required.
export function setup(params) {
  params.phase = 0;
}

export function update(dt, input, params) {
  const k = input.knobNormalized || [];
  params.phase = (params.phase + dt * 0.5 * (k[1] ?? 0.5)) % 1;
}

export function draw(display, params, time) {
  const k = params.knobNormalized || [];
  const bands = 1 + 7 * (k[2] ?? 0.5);
  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) {
      const v = ((x / display.width) * bands + params.phase) % 1;
      display.setValue(x, y, v);
    }
  }
}
`;

export const MIN_RANGE_SPAN = 0.001;

/**
 * Build a fresh code layer from source, applying the @ramp annotation to the
 * layer and returning any @knobs state for the caller to merge into the
 * PROJECT-level knobs (knobs are one shared set, unlike per-layer ramps).
 */
export function codeLayerFromSource(
  code: string,
  name: string,
): {
  layer: CodeLayer;
  matrix: MatrixSize | null;
  knobEntries: KnobAnnotationEntry[] | null;
} {
  const rampAnnotation = parseRampAnnotation(code);
  let ramp: RampState = cloneRampState(DEFAULT_RAMP_STATE);
  let recolor = false;
  let cleanCode = code;
  if (rampAnnotation) {
    ramp = {
      stops: rampAnnotation.stops.map((stop) => ({
        position: stop.position,
        color: stop.color,
        alpha: 1,
      })),
      mode: rampAnnotation.mode,
      wrap: rampAnnotation.wrap,
    };
    recolor = rampAnnotation.recolor;
    cleanCode = stripRampAnnotation(code);
  }

  const knobEntries = parseKnobsAnnotation(cleanCode);

  const layer: CodeLayer = {
    id: layerId(),
    type: "code",
    name,
    visible: true,
    opacity: 1,
    blend: "normal",
    role: "paint",
    maskInvert: false,
    code: cleanCode,
    ramp,
    recolor,
    knobsAnnotationRaw: matchKnobsAnnotation(cleanCode),
    matrixAnnotationRaw: matchMatrixAnnotation(cleanCode),
  };
  return { layer, matrix: parseMatrixAnnotation(cleanCode), knobEntries };
}

export function defaultProject(): LabProject {
  const { layer, matrix, knobEntries } = codeLayerFromSource(initialLabPreset.code, "Code 1");
  const base = defaultKnobState();
  const knobState = knobEntries ? applyKnobEntries(knobEntries, base) : base;
  return {
    name: "",
    matrix: matrix ?? DEFAULT_MATRIX,
    layers: [layer],
    activeLayerId: layer.id,
    knobs: knobState.knobs,
    ranges: knobState.ranges,
    knobLabels: knobState.labels,
    forkOf: null,
    editOf: null,
    gen: { colorMode: "vfield" },
    director: emptyShow(),
  };
}

/**
 * Bitmap layers re-centred on a new frame. A text layer's bitmap moves with
 * the rest and its place moves by the same offset, so the next time it is
 * drawn it lands where it already is. A pixel layer goes on its undo stack
 * first, so Undo in the Pixel panel brings back what a smaller frame cut off.
 */
export function resizePixelLayers(layers: Layer[], matrix: MatrixSize): Layer[] {
  return layers.map((layer) => {
    if (layer.type === "code") return layer;
    if (layer.width === matrix.width && layer.height === matrix.height) return layer;
    if (layer.type === "pixel") snapshotPixels(layer.id, layer, true);
    const data = resizeSurface(layer.data, layer.width, layer.height, matrix.width, matrix.height);
    const resized: RasterLayer = {
      ...layer,
      width: matrix.width,
      height: matrix.height,
      data,
      rev: layer.rev + 1,
    };
    if (resized.type === "text") {
      const dx = Math.floor((matrix.width - layer.width) / 2);
      resized.spec = {
        ...resized.spec,
        x: resized.spec.x + dx,
        y: resized.spec.y + Math.floor((matrix.height - layer.height) / 2),
      };
      // The source keeps its columns and moves by the same offset; its rows
      // are cut or padded the way the bitmap's are.
      const source = resized.source;
      resized.source = source
        ? {
            x: source.x + dx,
            width: source.width,
            data: resizeSurface(source.data, source.width, layer.height, source.width, matrix.height),
          }
        : null;
    }
    return resized;
  });
}


export function updateLayer(layers: Layer[], id: string, patch: (layer: Layer) => Layer): Layer[] {
  return layers.map((layer) => (layer.id === id ? patch(layer) : layer));
}

/**
 * Patch the ramp of a code or text layer. A text layer filled with its ramp,
 * or running it, is drawn again, since its colours live in its bitmap.
 */
export function updateRampLayer(
  layers: Layer[],
  id: string,
  patch: (layer: RampLayer) => RampLayer,
): Layer[] {
  return layers.map((layer) => {
    if (layer.id !== id || !isRampLayer(layer)) return layer;
    const next = patch(layer);
    return next.type === "text" && next.ramp !== layer.ramp && (next.spec.fill !== "solid" || next.spec.effect === "ramp")
      ? drawTextLayer(next)
      : next;
  });
}

export function updateCodeLayer(
  layers: Layer[],
  id: string,
  patch: (layer: CodeLayer) => CodeLayer,
): Layer[] {
  return layers.map((layer) => (layer.id === id && layer.type === "code" ? patch(layer) : layer));
}
