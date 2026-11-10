// ── Lab store slice: per-layer colour ramps and the ramp editor's selection ──
// Code and text layers each carry a ramp; recolor is a code layer's alone.
// One of the slices store.ts composes. Bodies are unchanged from the single
// 800-line store they came out of; only the file boundary is new.

import type { LabStore } from "../store";
import type { SliceSet } from "./kinds";
import { updateCodeLayer, updateRampLayer } from "./shared";

type RampSlice = Pick<LabStore, "setRampSelection" | "setLayerRecolor" | "setLayerRampMode" | "setLayerRampWrap" | "updateLayerRampStop" | "addLayerRampStop" | "deleteLayerRampStop" | "setLayerRampStops">;

export function createRampSlice(set: SliceSet): RampSlice {
  return {
    setRampSelection: (layerId, index) =>
      set((state) => ({ rampSelection: { ...state.rampSelection, [layerId]: index } })),

    setLayerRecolor: (id, recolor) =>
      set((state) => ({
        layers: updateCodeLayer(state.layers, id, (layer) => ({ ...layer, recolor })),
      })),

    setLayerRampMode: (id, mode) =>
      set((state) => ({
        layers: updateRampLayer(state.layers, id, (layer) => ({
          ...layer,
          ramp: { ...layer.ramp, mode },
        })),
      })),

    setLayerRampWrap: (id, wrap) =>
      set((state) => ({
        layers: updateRampLayer(state.layers, id, (layer) => ({
          ...layer,
          ramp: { ...layer.ramp, wrap },
        })),
      })),

    updateLayerRampStop: (id, stopIndex, patch) =>
      set((state) => ({
        layers: updateRampLayer(state.layers, id, (layer) => ({
          ...layer,
          ramp: {
            ...layer.ramp,
            stops: layer.ramp.stops.map((stop, index) =>
              index === stopIndex ? { ...stop, ...patch } : stop,
            ),
          },
        })),
      })),

    addLayerRampStop: (id, stop) =>
      set((state) => ({
        layers: updateRampLayer(state.layers, id, (layer) =>
          layer.ramp.stops.length >= 64
            ? layer
            : { ...layer, ramp: { ...layer.ramp, stops: [...layer.ramp.stops, stop] } },
        ),
      })),

    deleteLayerRampStop: (id, stopIndex) =>
      set((state) => ({
        layers: updateRampLayer(state.layers, id, (layer) =>
          layer.ramp.stops.length <= 1
            ? layer
            : {
                ...layer,
                ramp: {
                  ...layer.ramp,
                  stops: layer.ramp.stops.filter((_, index) => index !== stopIndex),
                },
              },
        ),
      })),

    setLayerRampStops: (id, stops) =>
      set((state) => ({
        layers: updateRampLayer(state.layers, id, (layer) => ({
          ...layer,
          ramp: { ...layer.ramp, stops: stops.slice(0, 64) },
        })),
      })),
  };
}
