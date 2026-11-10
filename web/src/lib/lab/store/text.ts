// ── Lab store slice: text layers: add one, change what it says and how, draw it again ──
// One of the slices store.ts composes. Every change to a text layer's spec
// draws its bitmap again here (lib/lab/text.ts), so the engine, the masks and
// the exports only ever read the bitmap.

import { drawTextLayer } from "../text";
import { createTextLayer, nextLayerName, normalizeTextSpec } from "../types";
import type { LabStore } from "../store";
import type { SliceSet, SliceGet } from "./kinds";

type TextSlice = Pick<LabStore, "addTextLayer" | "setTextSpec" | "redrawTextLayers">;

export function createTextSlice(set: SliceSet, get: SliceGet): TextSlice {
  return {
    addTextLayer: () => {
      const state = get();
      const layer = drawTextLayer(createTextLayer(state.matrix, nextLayerName(state.layers, "Text")));
      set({ layers: [layer, ...state.layers], activeLayerId: layer.id });
    },

    setTextSpec: (id, patch) =>
      set((state) => ({
        layers: state.layers.map((layer) =>
          layer.id === id && layer.type === "text"
            ? drawTextLayer({
                ...layer,
                spec: normalizeTextSpec({ ...layer.spec, ...patch }, layer.spec, layer),
              })
            : layer,
        ),
      })),

    redrawTextLayers: (fontId) => {
      const state = get();
      if (!state.layers.some((layer) => layer.type === "text" && (fontId === undefined || layer.spec.font === fontId))) {
        return;
      }
      set({
        layers: state.layers.map((layer) =>
          layer.type === "text" && (fontId === undefined || layer.spec.font === fontId)
            ? drawTextLayer(layer)
            : layer,
        ),
      });
    },
  };
}
