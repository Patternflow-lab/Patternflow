// ── Text layer fonts ─────────────────────────────────────────────────────────
// A text layer's font comes from one of three places, and none of them sends
// anything anywhere:
//
//   site:…    the fonts the site already loads for its own pages
//             (app/layout.tsx), read through their CSS variables.
//   system:…  the generic families, so whatever the visitor's device has.
//   file:…    a .ttf, .otf, .woff or .woff2 the visitor picks. It is read in
//             this tab with FontFace and never uploaded. Remember keeps the
//             bytes in this browser's IndexedDB, so the next visit has it.
//
// The site carries no fonts of its own for text layers. The creator, 23
// October 2026: shipping them would put their weight on everyone's page, so a
// brand's font comes from the person who has it.
//
// A text layer keeps the bitmap it was last drawn as (lib/lab/text.ts), so a
// project whose file font this browser does not have still looks right. Only
// drawing it again needs the font, and the Text panel says when it is missing.

export type FontGroup = "site" | "system" | "file";
export type FontOption = { id: string; label: string; group: FontGroup };

const SITE_FONTS = [
  { id: "site:silkscreen", label: "Silkscreen (pixel)", variable: "--font-silkscreen", name: "Silkscreen" },
  { id: "site:inter", label: "Inter", variable: "--font-inter", name: "Inter" },
  { id: "site:jetbrains", label: "JetBrains Mono", variable: "--font-jetbrains", name: "JetBrains Mono" },
  { id: "site:newsreader", label: "Newsreader", variable: "--font-newsreader", name: "Newsreader" },
] as const;

const SYSTEM_FONTS = [
  { id: "system:sans-serif", label: "Sans-serif", css: "sans-serif" },
  { id: "system:serif", label: "Serif", css: "serif" },
  { id: "system:monospace", label: "Monospace", css: "monospace" },
] as const;

/** What an unknown or missing font draws with. */
export const FALLBACK_FONT_CSS = "sans-serif";

/** A 20 MB Korean font is ordinary; past this the tab is better off without it. */
export const MAX_FONT_FILE_BYTES = 32 * 1024 * 1024;

export const FONT_FILE_ACCEPT = ".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2";

type FileFont = { id: string; label: string; family: string; face: FontFace; remembered: boolean };

const fileFonts = new Map<string, FileFont>();
const listeners = new Set<(fontId: string) => void>();
const loading = new Map<string, Promise<void>>();

/** Called with a font id when that font can now be drawn with. */
export function subscribeFonts(listener: (fontId: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(fontId: string) {
  for (const listener of listeners) listener(fontId);
}

export function isFileFont(id: string): boolean {
  return id.startsWith("file:");
}

/** The name a file font goes by in the picker: its file name without the extension. */
export function fontLabelFromFileName(fileName: string): string {
  const base = fileName.replace(/\.(ttf|otf|woff2?)$/i, "").trim();
  return (base || "Font").slice(0, 60);
}

export function fileFontId(label: string): string {
  return `file:${label}`;
}

/** Picker entries: the site's fonts, the system families, then this tab's files. */
export function fontOptions(): FontOption[] {
  return [
    ...SITE_FONTS.map(({ id, label }) => ({ id, label, group: "site" as const })),
    ...SYSTEM_FONTS.map(({ id, label }) => ({ id, label, group: "system" as const })),
    ...[...fileFonts.values()].map(({ id, label }) => ({ id, label, group: "file" as const })),
  ];
}

/** The label for any font id, loaded or not. */
export function fontLabel(id: string): string {
  const known = fontOptions().find((option) => option.id === id);
  if (known) return known.label;
  return isFileFont(id) ? id.slice("file:".length) : id;
}

export function isFontRemembered(id: string): boolean {
  return fileFonts.get(id)?.remembered ?? false;
}

function quoteFamily(family: string): string {
  return `"${family.replace(/["\\]/g, "")}"`;
}

function siteFamily(variable: string, name: string): string {
  if (typeof document !== "undefined" && typeof getComputedStyle === "function") {
    const value = getComputedStyle(document.body ?? document.documentElement).getPropertyValue(variable).trim();
    if (value) return value;
  }
  return quoteFamily(name);
}

export type ResolvedFont = {
  /** A CSS font-family list for the canvas. */
  css: string;
  /** True for a file font this browser does not have loaded: it draws with the fallback. */
  missing: boolean;
};

export function resolveFont(id: string): ResolvedFont {
  const site = SITE_FONTS.find((entry) => entry.id === id);
  if (site) return { css: `${siteFamily(site.variable, site.name)}, ${FALLBACK_FONT_CSS}`, missing: false };
  const system = SYSTEM_FONTS.find((entry) => entry.id === id);
  if (system) return { css: system.css, missing: false };
  const file = fileFonts.get(id);
  if (file) return { css: `${quoteFamily(file.family)}, ${FALLBACK_FONT_CSS}`, missing: false };
  return { css: FALLBACK_FONT_CSS, missing: isFileFont(id) };
}

/**
 * True when the font can be drawn with right now. A site font is fetched on
 * first use (layout.tsx preloads none of them for the lab), so the first
 * drawing falls back and the listeners hear when the real one arrives.
 */
export function ensureFontReady(id: string, size: number): boolean {
  if (typeof document === "undefined" || !document.fonts) return true;
  if (!id.startsWith("site:")) return true;
  // The first family only. next/font follows it with a "… Fallback" face
  // made from local("Arial"), and on a device without Arial loading the
  // whole list fails with a NetworkError, so the real font never drew.
  const family = resolveFont(id).css.split(",")[0].trim();
  const spec = `${Math.max(1, Math.round(size))}px ${family}`;
  let ready = true;
  try {
    ready = document.fonts.check(spec);
  } catch {
    return true;
  }
  if (ready || loading.has(id)) return ready;
  // One attempt per font and tab: a font that fails to load must not redraw forever.
  loading.set(
    id,
    document.fonts
      .load(spec)
      .then(() => notify(id))
      .catch(() => undefined),
  );
  return false;
}

// ── file fonts ──

async function registerFontBytes(label: string, bytes: ArrayBuffer, remembered: boolean): Promise<FontOption> {
  if (typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts) {
    throw new Error("This browser can't load font files.");
  }
  const id = fileFontId(label);
  const family = `Patternflow file ${label}`;
  const face = new FontFace(family, bytes);
  try {
    await face.load();
  } catch {
    throw new Error("That file isn't a font this browser can read.");
  }
  // The same name again replaces the earlier file: one face per family.
  const previous = fileFonts.get(id);
  if (previous) document.fonts.delete(previous.face);
  document.fonts.add(face);
  fileFonts.set(id, { id, label, family, face, remembered: remembered || (previous?.remembered ?? false) });
  notify(id);
  return { id, label, group: "file" };
}

/** Read a font file into this tab and, when asked, into this browser. */
export async function addFontFile(file: File, remember: boolean): Promise<FontOption> {
  if (file.size > MAX_FONT_FILE_BYTES) {
    throw new Error(`That font is ${Math.round(file.size / 1024 / 1024)} MB; the lab takes up to ${MAX_FONT_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const bytes = await file.arrayBuffer();
  const label = fontLabelFromFileName(file.name);
  const option = await registerFontBytes(label, bytes, false);
  if (remember) await rememberFont(option.id, bytes);
  return option;
}

// ── remembering: IndexedDB, this browser only ──

const DB_NAME = "patternflow_lab_fonts_v1";
const STORE = "fonts";
type StoredFont = { id: string; label: string; bytes: ArrayBuffer; savedAt: number };

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function done(transaction: IDBTransaction): Promise<boolean> {
  return new Promise((resolve) => {
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
}

async function rememberFont(id: string, bytes: ArrayBuffer): Promise<boolean> {
  const font = fileFonts.get(id);
  const db = await openDb();
  if (!font || !db) return false;
  try {
    const transaction = db.transaction(STORE, "readwrite");
    const record: StoredFont = { id, label: font.label, bytes, savedAt: Date.now() };
    transaction.objectStore(STORE).put(record);
    const ok = await done(transaction);
    if (ok) font.remembered = true;
    return ok;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

/** Drop a font from this browser's storage. It stays loaded until the tab closes. */
export async function forgetFont(id: string): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  try {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).delete(id);
    const ok = await done(transaction);
    const font = fileFonts.get(id);
    if (ok && font) font.remembered = false;
    return ok;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

let remembered: Promise<void> | null = null;

/** Load every font this browser remembers, once per tab. */
export function loadRememberedFonts(): Promise<void> {
  remembered ??= (async () => {
    const db = await openDb();
    if (!db) return;
    let records: StoredFont[] = [];
    try {
      const transaction = db.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).getAll();
      records = await new Promise<StoredFont[]>((resolve) => {
        request.onsuccess = () => resolve((request.result as StoredFont[]) ?? []);
        request.onerror = () => resolve([]);
      });
    } catch {
      records = [];
    } finally {
      db.close();
    }
    for (const record of records) {
      if (!record || typeof record.label !== "string" || !(record.bytes instanceof ArrayBuffer)) continue;
      try {
        await registerFontBytes(record.label, record.bytes, true);
      } catch {
        // A stored file this browser no longer reads: leave it, the picker just lacks it.
      }
    }
  })();
  return remembered;
}
