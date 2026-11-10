// ── Short hash of a string ───────────────────────────────────────────────────
// 32-bit FNV-1a over UTF-16 code units. Two of its callers file things in the
// browser under it: a To hardware paste (hardwarePastes.ts) and a shader twin
// (capture/shaderStore.ts). A change here orphans both, so hash.test.ts pins
// their keys.

export function fnv1a(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
