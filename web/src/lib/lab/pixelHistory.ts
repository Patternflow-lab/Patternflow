// ── Pixel layer undo / redo ──────────────────────────────────────────────────
// Snapshots of a pixel layer's RGBA buffer, keyed by layer id, kept outside
// React: buffers, not state. The Pixel panel calls snapshot() before a stroke,
// undo()/redo() on the keys, and prune() with the live layer ids so a deleted
// layer's stacks — up to MAX_UNDO frames of RGBA — do not live for the tab.
// A frame change calls snapshot() too, before it crops or pads the layer.
// Right after the change that snapshot, put back at the new size, is the
// picture as it is, so undo goes past it to the step before. It counts once
// the frame grows back and it brings in what the smaller frame cut off.
//
// A frame keeps the size it was taken at. Changing the matrix size gives the
// layer a new buffer under the same id (resizePixelLayers in store/shared.ts),
// so an older frame goes back through resizeSurface, centred and cropped or
// padded the way the resize treated the layer itself.

import { resizeSurface, type PixelSurface } from "./pixelTools";

export const MAX_UNDO = 40;

type Frame = PixelSurface & { frameChange: boolean };
type History = { undo: Frame[]; redo: Frame[] };

const histories = new Map<string, History>();

function historyFor(id: string): History {
  let history = histories.get(id);
  if (!history) {
    history = { undo: [], redo: [] };
    histories.set(id, history);
  }
  return history;
}

function frameOf(surface: PixelSurface, frameChange = false): Frame {
  return { data: new Uint8ClampedArray(surface.data), width: surface.width, height: surface.height, frameChange };
}

function restore(surface: PixelSurface, frame: PixelSurface): void {
  surface.data.set(resizeSurface(frame.data, frame.width, frame.height, surface.width, surface.height));
}

function showsTheSame(frame: PixelSurface, surface: PixelSurface): boolean {
  const data = resizeSurface(frame.data, frame.width, frame.height, surface.width, surface.height);
  for (let i = 0; i < data.length; i++) if (data[i] !== surface.data[i]) return false;
  return true;
}

/**
 * Remember the surface as it is now, before it changes. Clears the redo stack.
 * `frameChange` marks the snapshot a matrix resize takes.
 */
export function snapshotPixels(id: string, surface: PixelSurface, frameChange = false): void {
  const history = historyFor(id);
  history.undo.push(frameOf(surface, frameChange));
  if (history.undo.length > MAX_UNDO) history.undo.shift();
  history.redo = [];
}

/**
 * Restore the previous snapshot INTO `surface.data`, at its size, passing
 * over a frame change's that would change nothing. False when there is none.
 */
export function undoPixels(id: string, surface: PixelSurface): boolean {
  const history = historyFor(id);
  let previous = history.undo.pop();
  while (previous?.frameChange && showsTheSame(previous, surface)) previous = history.undo.pop();
  if (!previous) return false;
  history.redo.push(frameOf(surface));
  restore(surface, previous);
  return true;
}

/** Re-apply the last undone snapshot INTO `surface.data`, at its size. False when there is none. */
export function redoPixels(id: string, surface: PixelSurface): boolean {
  const history = historyFor(id);
  const next = history.redo.pop();
  if (!next) return false;
  history.undo.push(frameOf(surface));
  restore(surface, next);
  return true;
}

/** Drop the stacks of every layer not in `liveIds`. */
export function prunePixelHistories(liveIds: Iterable<string>): void {
  const live = new Set(liveIds);
  for (const id of Array.from(histories.keys())) {
    if (!live.has(id)) histories.delete(id);
  }
}
