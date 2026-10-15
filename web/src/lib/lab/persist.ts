// ── What the lab keeps in localStorage, and how ──────────────────────────────
// Every key the lab writes, in one place, with the owner and the version baked
// into the name. Until 2026-09 these were literals in five files, each with
// its own try/catch around window.localStorage; adding a persisted thing meant
// inventing a key and copying the boilerplate, and nobody could list what the
// lab stored without grepping for "patternflow_lab_".
//
// Bumping a version means: add the new key here, keep the old one, and write a
// migration that reads the old and writes the new. serialize.ts's
// migrateLegacyDraft is the precedent: it lifts _draft_v1 and _ramp_v1 into a
// _project_v2 project. The gallery was never migrated. It still lives under
// its _v1 key.

export const LAB_STORAGE = {
  /** The whole layered project — layers, knobs, ramps, director, gen settings. serialize.ts */
  project: "patternflow_lab_project_v2",
  /** The dockview layout. PatternLabClient.tsx */
  layout: "patternflow_lab_layout_v1",
  /** Ring of parked sessions, newest first. sessions.ts */
  sessions: "patternflow_lab_sessions_v1",
  /** Graphic Export output settings. capture/settings.ts */
  capture: "patternflow_lab_capture_v1",
  /** Shader twins by layer id / code hash. capture/shaderStore.ts */
  shader: "patternflow_lab_shader_v1",
  /**
   * The single-pattern draft, written by the lab's autosave from 25 July 2026
   * (e19fe19) until Pattern Lab v2 replaced it on 27 July (9be6e98). Nothing
   * writes it now. The migration reads it on every open where no project
   * restores, an empty canvas after a stash included. legacyDraft.ts
   */
  legacyDraft: "patternflow_lab_draft_v1",
  /**
   * The generated gallery. The lab's autosave has written it since 25 July
   * 2026 (e19fe19) and still does, because the gallery never moved into the
   * project. legacyDraft.ts
   */
  gallery: "patternflow_lab_gallery_v1",
  /**
   * The colour ramp, written by the lab on every ramp edit from 2 July 2026
   * (67b9798) until Pattern Lab v2 on 27 July (9be6e98). Nothing writes it
   * now. The migration reads it with the draft. serialize.ts
   */
  legacyRamp: "patternflow_ramp_v1",
} as const;

export type LabStorageKey = (typeof LAB_STORAGE)[keyof typeof LAB_STORAGE];

/** Raw string, or null when there is none — or no storage at all. */
export function readStorage(key: LabStorageKey): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** False on quota, private mode, or storage disabled. Never throws. */
export function writeStorage(key: LabStorageKey, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: LabStorageKey): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Private mode — nothing was there to remove.
  }
}

/** Parsed JSON, or null when absent, unreadable or malformed. */
export function readJson(key: LabStorageKey): unknown {
  const raw = readStorage(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeJson(key: LabStorageKey, value: unknown): boolean {
  return writeStorage(key, JSON.stringify(value));
}
