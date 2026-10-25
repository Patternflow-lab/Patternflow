import { useCallback, useEffect, useRef, useState } from "react";
import { useLabStore } from "@/lib/lab/store";
import { drawTextLayer } from "@/lib/lab/text";
import { cloneRampState, isRampLayer, type RampState } from "@/lib/lab/types";

const HISTORY_LIMIT = 40;
type Snapshot = { ramp: RampState; recolor: boolean; selection: number };
type History = { past: Snapshot[]; future: Snapshot[] };
const emptyHistory = (): History => ({ past: [], future: [] });

function readSnapshot(id: string): Snapshot | null {
  const state = useLabStore.getState();
  const layer = state.layers.find((entry) => entry.id === id);
  if (!isRampLayer(layer)) return null;
  return {
    ramp: cloneRampState(layer.ramp),
    recolor: layer.type === "code" && layer.recolor,
    selection: state.rampSelection[id] ?? 0,
  };
}

function changed(before: Snapshot, after: Snapshot): boolean {
  return before.recolor !== after.recolor || JSON.stringify(before.ramp) !== JSON.stringify(after.ramp);
}

/** One mounted layer editor owns a bounded history. External ramp replacement
 * (a pasted annotation or restored session) invalidates it; an undo can never
 * silently overwrite an unrelated import. Pointer gestures form one entry.
 */
export function useRampHistory(id: string) {
  const [history, setHistory] = useState<History>(emptyHistory);
  const ownUpdate = useRef(false);
  const gesture = useRef<Snapshot | null>(null);

  useEffect(() => useLabStore.subscribe((state, previous) => {
    if (ownUpdate.current) return;
    const layer = state.layers.find((entry) => entry.id === id);
    const before = previous.layers.find((entry) => entry.id === id);
    if (!isRampLayer(layer) || !isRampLayer(before) || layer.ramp !== before.ramp ||
        (layer.type === "code" && before.type === "code" && layer.recolor !== before.recolor)) {
      gesture.current = null;
      setHistory(emptyHistory());
    }
  }), [id]);

  const record = useCallback((before: Snapshot | null, after: Snapshot | null) => {
    if (!before || !after || !changed(before, after)) return;
    setHistory((current) => ({ past: [...current.past, before].slice(-HISTORY_LIMIT), future: [] }));
  }, []);

  const endGesture = useCallback(() => {
    const before = gesture.current;
    gesture.current = null;
    record(before, readSnapshot(id));
  }, [id, record]);

  const beginGesture = useCallback(() => {
    if (!gesture.current) gesture.current = readSnapshot(id);
  }, [id]);

  const edit = useCallback((action: () => void) => {
    const before = readSnapshot(id);
    ownUpdate.current = true;
    try {
      action();
    } finally {
      ownUpdate.current = false;
    }
    if (!gesture.current) record(before, readSnapshot(id));
  }, [id, record]);

  const restore = useCallback((snapshot: Snapshot) => {
    ownUpdate.current = true;
    try {
      // One store notification, preserving code, knobs, and every other layer.
      useLabStore.setState((state) => ({
        layers: state.layers.map((layer) => layer.id !== id
          ? layer
          : layer.type === "code"
            ? { ...layer, ramp: cloneRampState(snapshot.ramp), recolor: snapshot.recolor }
            : layer.type === "text"
              ? drawTextLayer({ ...layer, ramp: cloneRampState(snapshot.ramp) })
              : layer),
        rampSelection: { ...state.rampSelection, [id]: snapshot.selection },
      }));
    } finally {
      ownUpdate.current = false;
    }
  }, [id]);

  const undo = useCallback(() => {
    const current = readSnapshot(id);
    const previous = history.past.at(-1);
    if (!current || !previous) return;
    restore(previous);
    setHistory({ past: history.past.slice(0, -1), future: [...history.future, current] });
  }, [history, id, restore]);

  const redo = useCallback(() => {
    const current = readSnapshot(id);
    const next = history.future.at(-1);
    if (!current || !next) return;
    restore(next);
    setHistory({ past: [...history.past, current], future: history.future.slice(0, -1) });
  }, [history, id, restore]);

  return { edit, beginGesture, endGesture, undo, redo, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
