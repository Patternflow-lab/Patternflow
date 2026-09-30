// The reader's own Pattern Lab draft, as one pattern the guide's board can run.
//
// The lab keeps the whole project in localStorage (lib/lab/persist.ts,
// LAB_STORAGE.project). This file READS it — never writes, removes or
// migrates anything — and turns it into one runnable pattern the way the lab
// does for hardware (PatternLabClient buildExportCode): a stack that needs it
// is flattened (lib/lab/flatten.ts), a single plain code layer runs as it is
// with its own ramp and recolor. The knobs are the project's: its four names,
// ranges and values.
//
// What the lab opens with, in its own order (store/project.ts hydrate):
//   1. the saved project (loadProject);
//   2. else a v1 single-pattern draft, lifted into a project in memory
//      (migrateLegacyDraft — which only reads; the lab itself writes the
//      result later, from its autosave, and only when the lab is open);
//   3. else its starter (store/shared.ts defaultProject).
// Every step here is a read. Nothing in this file imports lib/lab/store.ts:
// that module creates the lab's store and its autosave subscription.
//
// The lab autosaves 600 ms after an edit, or 3 s into a run of them
// (lib/lab/autosave.ts). Another tab — or a window on this page — writing
// the key reaches here as a `storage` event; subscribeLabMirror passes it on.

import type { SimMirror } from "@/lib/guide/deviceSim";
import { rampStateToHarness } from "@/lib/lab/engine";
import { flattenLayers, needsFlatten } from "@/lib/lab/flatten";
import { LAB_STORAGE } from "@/lib/lab/persist";
import { deserializeProject, migrateLegacyDraft } from "@/lib/lab/serialize";
import { defaultProject } from "@/lib/lab/store/shared";
import { isCodeLayer, type CodeLayer, type LabProject } from "@/lib/lab/types";

export type LabMirror = SimMirror & {
  /** "draft": the reader's saved work. "starter": nothing saved, so the lab's own opening pattern. */
  source: "draft" | "starter";
  /** When the lab last saved it (0 for the starter, or a draft that never said). */
  savedAt: number;
};

/** The keys the lab opens from, in the order it reads them. */
export const LAB_MIRROR_KEYS: readonly string[] = [LAB_STORAGE.project, LAB_STORAGE.legacyDraft, LAB_STORAGE.legacyRamp];

/**
 * The name the lab gives what it is building (store.ts labPatternName, copied
 * here so as not to import the store): the project's name, else the focus
 * code layer's, else any layer's, else "pattern".
 */
export function labMirrorName(project: Pick<LabProject, "name" | "layers" | "activeLayerId">): string {
  const own = project.name.trim();
  if (own) return own;
  const active = project.layers.find((layer) => layer.id === project.activeLayerId);
  const layer = isCodeLayer(active) ? active : (project.layers.find(isCodeLayer) ?? project.layers[0]);
  return layer?.name.trim() || "pattern";
}

/** One project as one runnable pattern, as the lab's hardware and publish path builds it. */
export function mirrorOfProject(project: LabProject, source: LabMirror["source"], savedAt = 0): LabMirror {
  const matrix = project.matrix;
  const knobs = {
    labels: project.knobLabels.slice(0, 4),
    ranges: project.ranges.slice(0, 4).map((r): [number, number] => [r[0], r[1]]),
    values: project.knobs.slice(0, 4),
  };
  const base = { name: labMirrorName(project), width: matrix.width, height: matrix.height, ...knobs, source, savedAt };
  if (needsFlatten(project.layers)) {
    return {
      ...base,
      code: flattenLayers(project.layers, matrix, { labels: project.knobLabels, ranges: project.ranges }),
      // Each layer's ramp is baked into the flattened code as a table.
      ramp: null,
      recolor: false,
    };
  }
  // needsFlatten is false only for exactly one visible paint code layer.
  const layer = project.layers.find(
    (entry): entry is CodeLayer => entry.visible && entry.opacity > 0 && entry.type === "code",
  ) as CodeLayer;
  return { ...base, code: layer.code, ramp: rampStateToHarness(layer.ramp), recolor: layer.recolor };
}

function read(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let cache: { storage: Storage | null; raws: (string | null)[]; mirror: LabMirror } | null = null;

/**
 * What Pattern Lab would open with in this browser, as a pattern. Parsed
 * again only when the stored text has changed since the last call, so the
 * same object comes back until it has.
 */
export function readLabMirror(storage: Storage | null = localStorageOrNull()): LabMirror {
  const raws = LAB_MIRROR_KEYS.map((key) => read(storage, key));
  if (cache && cache.storage === storage && cache.raws.every((r, i) => r === raws[i])) return cache.mirror;

  let mirror: LabMirror | null = null;
  const raw = raws[0];
  const saved = raw ? deserializeProject(raw) : null;
  if (saved) {
    const { savedAt, ...project } = saved;
    mirror = mirrorOfProject(project, "draft", savedAt);
  } else if (storage) {
    // migrateLegacyDraft reads through lib/lab/persist, i.e. window.localStorage.
    const legacy = storage === localStorageOrNull() ? migrateLegacyDraft() : null;
    if (legacy) {
      const { savedAt, ...project } = legacy;
      mirror = mirrorOfProject(project, "draft", savedAt);
    }
  }
  if (!mirror) mirror = mirrorOfProject(defaultProject(), "starter", 0);
  cache = { storage, raws, mirror };
  return mirror;
}

/**
 * Calls `onChange` when the lab's saved project may have changed: a `storage`
 * event for one of its keys (another tab, or the lab in a window on this
 * page, saved), a storage clear, or this page coming back into view (an
 * event can be missed while a page is frozen in the back/forward cache).
 */
export function subscribeLabMirror(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || LAB_MIRROR_KEYS.includes(e.key)) onChange();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", onChange);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", onChange);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
