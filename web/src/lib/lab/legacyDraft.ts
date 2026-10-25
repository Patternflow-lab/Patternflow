// ── Pattern Lab: the July draft ──────────────────────────────────────────────
// The lab's autosave (e19fe19, 25 July 2026) stored the working session under
// two keys on purpose: the draft (small, always worth keeping: code, knobs,
// ranges, ...) and the AI gallery (up to hundreds of KB of generated
// patterns). A quota failure while writing the large gallery must never take
// the small draft down with it, hence the split.
//
// Pattern Lab v2 (9be6e98, 27 July) moved the working session into the layered
// project and stopped writing the draft. loadDraft stays for serialize.ts's
// migrateLegacyDraft. The gallery kept its key until the lab dropped it on
// 23 October 2026, and dropAiGallery clears what it left behind. Every read is
// defensive: a draft written by an older build, or hand-edited, must degrade
// to "no draft" rather than crash the lab on boot.

import { COLOR_MODES } from "@/lib/ai/settings";
import type { ColorMode } from "@/lib/ai/settings";
import { isValidMatrix, type MatrixSize } from "@/lib/pattern/matrix";

import { LAB_STORAGE, readJson, removeStorage as remove } from "./persist";

const DRAFT_STORAGE = LAB_STORAGE.legacyDraft;

// Guard rail so one runaway value can't blow the whole quota.
const MAX_CODE_CHARS = 200_000;

/** The July draft also kept the gallery's count, thinking and refs; only this outlived it. */
type DraftGenSettings = {
  colorMode: ColorMode;
};

type LabDraft = {
  savedAt: number;
  code: string;
  knobs: number[];
  ranges: [number, number][];
  knobLabels: string[];
  /** Not part of the ramp payload, but the user's ramp decision all the same. */
  recolor: boolean;
  /**
   * Fallback only. The code's own `// @matrix` line is authoritative — this
   * covers drafts whose code predates the annotation.
   */
  matrix: MatrixSize;
  forkOf: { id: string; title: string } | null;
  gen: DraftGenSettings;
};

function numberArray(value: unknown, length: number): number[] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  const result = value.map(Number);
  return result.every(Number.isFinite) ? result : null;
}

function rangeArray(value: unknown, length: number): [number, number][] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  const result: [number, number][] = [];
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const min = Number(entry[0]);
    const max = Number(entry[1]);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
    result.push([min, max]);
  }
  return result;
}

function stringArray(value: unknown, length: number): string[] | null {
  if (!Array.isArray(value) || value.length !== length) return null;
  if (!value.every((entry) => typeof entry === "string")) return null;
  return (value as string[]).map((entry) => entry.slice(0, 40));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

// Accepts the current `{width, height}` shape and the older `resPreset: "128x64"`
// string, so a draft written before the frame rework still restores.
function readMatrix(raw: Record<string, unknown>): MatrixSize | undefined {
  const candidate = raw.matrix as Partial<MatrixSize> | undefined;
  if (isValidMatrix(candidate)) {
    return { width: Number(candidate!.width), height: Number(candidate!.height) };
  }
  if (typeof raw.resPreset === "string") {
    const [w, h] = raw.resPreset.split("x");
    const legacy = { width: Number(w), height: Number(h) };
    if (isValidMatrix(legacy)) return legacy;
  }
  return undefined;
}

export function loadDraft(knobCount: number): Partial<LabDraft> | null {
  const parsed = readJson(DRAFT_STORAGE);
  if (!parsed || typeof parsed !== "object") return null;
  const raw = parsed as Record<string, unknown>;

  const code = typeof raw.code === "string" ? raw.code : null;
  if (code === null || code.length > MAX_CODE_CHARS) return null;

  const forkOf =
    raw.forkOf && typeof raw.forkOf === "object"
      ? (() => {
          const entry = raw.forkOf as Record<string, unknown>;
          return typeof entry.id === "string" && typeof entry.title === "string"
            ? { id: entry.id, title: entry.title.slice(0, 120) }
            : null;
        })()
      : null;

  const gen = (raw.gen ?? {}) as Record<string, unknown>;

  // Each field falls back independently: a draft missing (or corrupting) one
  // value still restores everything else.
  return {
    savedAt: Number(raw.savedAt) || 0,
    code,
    knobs: numberArray(raw.knobs, knobCount) ?? undefined,
    ranges: rangeArray(raw.ranges, knobCount) ?? undefined,
    knobLabels: stringArray(raw.knobLabels, knobCount) ?? undefined,
    recolor: typeof raw.recolor === "boolean" ? raw.recolor : undefined,
    matrix: readMatrix(raw),
    forkOf,
    gen: {
      colorMode: oneOf<ColorMode>(gen.colorMode, COLOR_MODES, "vfield"),
    },
  };
}

export function clearDraft() {
  remove(DRAFT_STORAGE);
}

/**
 * The AI gallery's patterns and the Gemini key it kept. Nothing writes either
 * since 23 October 2026. hydrate calls this on every open of the lab, so a
 * browser that held them loses them the first time, and one that never did
 * loses nothing.
 */
export function dropAiGallery() {
  remove(LAB_STORAGE.gallery);
  remove(LAB_STORAGE.geminiKey);
}
