// ── The answers pasted into To hardware ─────────────────────────────────────
// A header is the slow part of getting a pattern onto the board: copy the
// prompt, wait on a model, paste what comes back. The paste lived in the
// modal's state, so Esc, a press outside it or a reload threw it away, and
// the way back was to ask the model again.
//
// It is kept for the tab now, in sessionStorage, filed under the prompt it
// answers. The knob positions are left out of that key. They say where the
// board starts each knob, and turning one in the Knobs panel is no reason to
// ask again. Anything else that changes the prompt (an edit to the code, a
// resize, another ramp) leaves the paste answering a question nobody is
// asking now. It is not offered back, and the next edit in the modal drops it.
//
// It is sessionStorage, not the lab's localStorage (persist.ts). Each write
// replaces the record with what the modal shows, so two lab tabs sharing one
// record would wipe each other's pastes. A tab's record ends with the tab,
// and nothing has to prune it.

const KEY = "patternflow_lab_hardware_pastes_v1";

/**
 * The prompt as a short key, with each knob's "current" value taken out.
 * Both prompts write the positions as ", current <value>" on the knob lines.
 */
export function promptKey(prompt: string): string {
  const asked = prompt.replace(/, current [^,\n]*/g, "");
  let h = 2166136261;
  for (let i = 0; i < asked.length; i++) {
    h ^= asked.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${asked.length}:${(h >>> 0).toString(36)}`;
}

/** Every paste this tab kept, by the key of the prompt it answers. */
export function readPastes(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.sessionStorage.getItem(KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object") return {};
    const pastes: Record<string, string> = {};
    for (const [key, text] of Object.entries(parsed)) {
      if (typeof text === "string") pastes[key] = text;
    }
    return pastes;
  } catch {
    return {};
  }
}

/** Keeps these and nothing else. Without storage the modal keeps them while it is open. */
export function writePastes(pastes: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    if (Object.keys(pastes).length === 0) window.sessionStorage.removeItem(KEY);
    else window.sessionStorage.setItem(KEY, JSON.stringify(pastes));
  } catch {
    // Private mode or a full quota.
  }
}
