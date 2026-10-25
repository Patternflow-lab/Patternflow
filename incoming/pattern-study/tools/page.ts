/**
 * index.html: one file that runs on its own, opened from disk or from any
 * static host. The script is tools/gallery.ts bundled by esbuild together with
 * LabEngine, the Lab preview's engine, so a tile on the page renders what
 * Pattern Lab renders at the same knobs. Each pattern carries the layer that
 * codeLayerFromSource builds (without its code) and the study's start knobs
 * (lab.ts), computed here, and the map gets the measures study.ts took.
 *
 * The page groups the patterns the way shelf.json beside them sorts them, a
 * group to a folded section. A pattern the shelf does not name yet, such as
 * one a round has just added, lands in a group of its own at the top.
 *
 * Each pattern's code is in the file once, in JSON blocks after the list.
 * The block for the groups that open by themselves comes before the script
 * and the rest after it, so the first screen runs while the remaining code is
 * still arriving. A pattern's code is read from its block when its tile first
 * comes into view.
 *
 * The one-line Korean note beside each card comes from the README's table of
 * patterns, the row that links patterns/<slug>.js. Without a row, the card
 * shows the pattern's own Idea line. The "// Knob N:" and "// Buttons:"
 * lines stay in the code, and gallery.ts reads them when a card opens. A
 * family's name and colour come from families.json beside the patterns, so a
 * round that opens a family adds a line there and leaves tools/ alone.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type * as Esbuild from "esbuild";

import { stripRampAnnotation } from "@/lib/pattern/ramp";

import { loadFamilies, roundOf, STUDY } from "./lab";
import type { Result } from "./study";

const esbuild = createRequire(path.resolve(STUDY, "../../web/package.json"))("esbuild") as typeof Esbuild;

export const SHELF_FILE = path.join(STUDY, "shelf.json");

export type ShelfGroup = {
  key: string;
  label: string;
  why: string;
  /** Opens by itself when the page loads. */
  open?: boolean;
  patterns: string[];
  /** A line of its own for a pattern, shown under its tile. */
  notes?: Record<string, string>;
};
export type Shelf = { date: string; about: string; groups: ShelfGroup[] };

export function loadShelf(): Shelf {
  if (!fs.existsSync(SHELF_FILE)) return { date: "", about: "", groups: [] };
  return JSON.parse(fs.readFileSync(SHELF_FILE, "utf8")) as Shelf;
}

/** What is wrong with shelf.json, given the patterns there are. A pattern the shelf leaves out is not wrong: it is new. */
export function shelfProblems(slugs: string[]): string[] {
  let shelf: Shelf;
  try {
    shelf = loadShelf();
  } catch (error) {
    return [`cannot read it: ${(error as Error).message.split("\n")[0]}`];
  }
  const problems: string[] = [];
  const known = new Set(slugs);
  const seen = new Map<string, string>();
  const keys = new Set<string>();
  for (const group of shelf.groups ?? []) {
    if (!/^[a-z][a-z0-9-]*$/.test(group.key ?? "")) problems.push(`"${group.key}" is not a lowercase group key`);
    else if (keys.has(group.key) || group.key === NEW_GROUP) problems.push(`group "${group.key}" is there twice`);
    keys.add(group.key);
    for (const field of ["label", "why"] as const) if (typeof group[field] !== "string" || !group[field].trim()) problems.push(`${group.key} has no ${field}`);
    for (const slug of group.patterns ?? []) {
      if (!known.has(slug)) problems.push(`${group.key} names ${slug}, which is not in patterns/`);
      if (seen.has(slug)) problems.push(`${slug} is in ${seen.get(slug)} and ${group.key}`);
      seen.set(slug, group.key);
    }
    for (const slug of Object.keys(group.notes ?? {})) if (!(group.patterns ?? []).includes(slug)) problems.push(`${group.key} has a note for ${slug}, which it does not hold`);
  }
  return problems;
}

const NEW_GROUP = "new";

function readmeNotes(): Map<string, string> {
  const notes = new Map<string, string>();
  const file = path.join(STUDY, "README.md");
  if (!fs.existsSync(file)) return notes;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const row = line.match(/^\|\s*\[[^\]]+\]\(patterns\/([a-z0-9-]+)\.js\)\s*\|[^|]*\|\s*(.+?)\s*\|\s*$/);
    if (row) notes.set(row[1], row[2]);
  }
  return notes;
}

const round = (v: number) => Number(v.toFixed(4));
const inline = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export function buildPage(results: Result[]): string {
  const notes = readmeNotes();
  const shelf = loadShelf();
  const measured = results.filter((r) => r.measures);

  // The groups in page order. Patterns no group names come first, newest first.
  const placed = new Set(shelf.groups.flatMap((g) => g.patterns));
  const fresh = measured
    .filter((r) => !placed.has(r.pattern.slug))
    .sort((a, b) => roundOf(b.pattern.code) - roundOf(a.pattern.code) || a.pattern.title.localeCompare(b.pattern.title))
    .map((r) => r.pattern.slug);
  const groups: ShelfGroup[] = [
    ...(fresh.length
      ? [{ key: NEW_GROUP, label: "아직 안 추린 것", why: "추린 뒤에 들어온 패턴이에요. 아직 어느 묶음에도 넣지 않았어요.", open: true, patterns: fresh }]
      : []),
    ...shelf.groups,
  ];

  const bySlug = new Map(measured.map((r) => [r.pattern.slug, r]));
  const groupOf = new Map<string, ShelfGroup>();
  for (const group of groups) for (const slug of group.patterns) groupOf.set(slug, group);

  // Code blocks: one for every group that opens by itself, then one per group.
  const blocks: string[][] = [[]];
  for (const group of groups) {
    const slugs = group.patterns.filter((s) => bySlug.has(s));
    if (group.open) blocks[0].push(...slugs);
    else blocks.push(slugs);
  }
  const blockOf = new Map<string, number>();
  blocks.forEach((slugs, i) => slugs.forEach((s) => blockOf.set(s, i)));

  const patterns = measured.map((r) => {
    const p = r.pattern;
    // The Lab drops the @ramp line from the code it runs. The page takes the
    // code from the file and drops it the same way.
    const ramped = p.layer.code !== p.code;
    if (ramped && p.layer.code !== stripRampAnnotation(p.code))
      throw new Error(`${p.slug}: the Lab's layer code is not the file without its @ramp line`);
    const { code: _code, ...layer } = p.layer;
    return {
      slug: p.slug,
      title: p.title,
      family: p.family,
      round: roundOf(p.code),
      // Without a README row, the pattern's own Idea line.
      note: notes.get(p.slug) || p.idea,
      why: groupOf.get(p.slug)?.notes?.[p.slug] ?? "",
      block: blockOf.get(p.slug) ?? 0,
      ramped,
      layer: { ...layer, id: `layer-${p.slug}` },
      matrix: p.matrix,
      knobs: p.knobs,
      start: p.start,
      measures: Object.fromEntries(Object.entries(r.measures!).map(([k, v]) => [k, round(v)])),
      knobResponse: r.knobResponse.map(round),
    };
  });
  const used = new Set(patterns.map((p) => p.family));
  const known = loadFamilies();
  const families = Object.fromEntries(
    [...used].sort().map((f) => [f, known[f] ?? { label: f, color: "#cccccc" }]),
  );
  const data = {
    patterns,
    families,
    shelf: {
      date: shelf.date,
      about: shelf.about,
      groups: groups.map((g) => ({ key: g.key, label: g.label, why: g.why, open: Boolean(g.open), patterns: g.patterns.filter((s) => bySlug.has(s)) })),
    },
  };

  const codeBlock = (i: number) =>
    `<script type="application/json" id="code-${i}">${inline(Object.fromEntries(blocks[i].map((s) => [s, bySlug.get(s)!.pattern.code])))}</script>`;

  const bundle = esbuild.buildSync({
    entryPoints: [path.join(STUDY, "tools", "gallery.ts")],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: ["es2018"],
    minifyWhitespace: true,
    minifySyntax: true,
    legalComments: "none",
    logLevel: "warning",
  });
  const js = bundle.outputFiles[0].text.trimEnd();
  if (js.includes("</script")) throw new Error("the bundle contains '</script' and cannot be inlined");

  const template = fs.readFileSync(path.join(STUDY, "tools", "page.html"), "utf8");
  return template
    .replace("/*__DATA__*/", () => inline(data))
    .replace("<!--__CODE_FIRST__-->", () => codeBlock(0))
    .replace("/*__SCRIPT__*/", () => js)
    .replace("<!--__CODE_REST__-->", () => blocks.slice(1).map((_, i) => codeBlock(i + 1)).join("\n"));
}
