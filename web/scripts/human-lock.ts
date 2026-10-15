/**
 * The lock on the maintainer's own writing: `npm run check:human-lock` in web/
 * (docs/rfc-cleanup.md §2.9). A pull request may change the markup, layout and
 * link and image paths in locked text, not a word of it. A typo is reported in
 * the PR description, not fixed.
 *
 * Locked: web/content/journal/, docs/manifesto.md, docs/releases/*.md, three
 * README sections (README_SECTIONS, each to the next ## heading), Part 1 of
 * each docs/rfc-*.md, each roadmap node's detail and detailKo (keyed by its id),
 * and each path in docs/.human-written, a directory locking what is under it.
 *
 * Each is compared as plain text, the base's (scripts/lib/pr-base.ts) against
 * the working tree's, with the Markdown and MDX syntax and all whitespace gone:
 * marks, fences (not the code in them), pipes, rules, comments, entities, tags,
 * link targets, URLs and front matter keys. A tag's alt, title and aria-label
 * stay, and so do front matter values that are not a path or a URL.
 *
 * A locked file the base lacks is new, and passes. Text that leaves its place
 * passes only if it turns up word for word in a file this diff adds or changes:
 * a move, which needs the maintainer's approval on the PR. Taking a path off
 * docs/.human-written fails, since only the maintainer does that.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { ROOT, changedSince, findBase, git, readAt, readNow } from "./lib/pr-base";

const README_SECTIONS = ["Where it began", "The community responded", "Story so far"];
const ROADMAP = "web/src/app/roadmap/roadmap-data.ts";
const LIST = "docs/.human-written";

// ── Plain text ──
// The characters kept, and the offset of each in the text they came from.
// Syntax is blanked to spaces rather than cut, so every offset stays where it
// was and a changed word can be shown in its line.
type Plain = { text: string; at: number[] };
const blank = (s: string) => s.replace(/[^\n]/g, " ");
const keep = (_m: string, open: string, text: string, close: string) => blank(open) + text + blank(close);
// A tag goes, but the words in its alt, title and aria-label stay.
const tag = (m: string) =>
  m.replace(/\b(alt|title|aria-label)=(["'])([^"']*)\2|[^\n]/g, (_x, a?: string, q?: string, w?: string) => (a ? blank(`${a}=${q}`) + w + blank(q!) : " "));
function frontMatter(m: string, body: string): string {
  const values = body.split("\n").map((line) => {
    const kv = /^(\s*[\w-]+:\s*)(["']?)(.*?)(\2\s*)$/.exec(line);
    return !kv ? line : blank(kv[1] + kv[2]) + (/^(?:\.{0,2}\/|https?:)/.test(kv[3]) ? blank(kv[3]) : kv[3]) + blank(kv[4]);
  });
  return blank(m.slice(0, m.indexOf("\n") + 1)) + values.join("\n") + blank(m.slice(m.lastIndexOf("\n")));
}

const SYNTAX: [RegExp, (m: string, ...g: string[]) => string][] = [
  [/^\uFEFF?---[ \t]*\n([\s\S]*?)\n---(?=[ \t]*(?:\n|$))/, frontMatter],
  [/<!--[\s\S]*?-->/g, blank],
  [/^[ \t]*(?:```|~~~).*$/gm, blank], // the fences; the code between them is text
  [/^[ \t]*\[[^\]\n]+\]:[ \t]*\S.*$/gm, blank], // reference definitions
  [/<\/?[A-Za-z][^>]*>/g, tag], // tags and autolinks
  [/(!\[)([^\]]*)(\]\([^)]*\))/g, keep], // images, then the links that may hold them
  [/(\[)([^\]]*)(\](?:\([^)]*\)|\[[^\]]*\]))/g, keep],
  [/https?:\/\/[^\s)\]>]+/g, blank],
  [/^ {0,3}#{1,6}(?=\s)/gm, blank],
  [/^[ \t]*(?:>[ \t]?)+/gm, blank],
  [/^[ \t]*(?:[-*+]|\d+[.)])(?=[ \t])/gm, blank],
  [/^[ \t|:=*_-]*$/gm, blank], // rules, setext underlines, table delimiter rows
  [/&(?:#x[\da-f]+|#\d+|[a-z]+);/gi, blank],
  [/\\(?=[!-/:-@[-`{-~])/g, blank],
  [/[*~`|]/g, blank],
  [/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, blank], // emphasis, not snake_case
];
const MDX: [RegExp, (m: string) => string] = [/^(?:import|export)\s.*$/gm, blank];

function plain(src: string, mdx: boolean): Plain {
  let s = src.replace(/\r/g, " ");
  for (const [re, f] of mdx ? [MDX, ...SYNTAX] : SYNTAX) s = s.replace(re, f as (m: string, ...g: string[]) => string);
  const at: number[] = [];
  for (let i = 0; i < s.length; i++) if (!/\s/.test(s[i])) at.push(i);
  return { text: at.map((i) => s[i]).join(""), at };
}
function slice(p: Plain, from: number, to: number): Plain {
  const [i, j] = [from, to].map((x) => p.at.findIndex((a) => a >= x)).map((k) => (k < 0 ? p.at.length : k));
  return { text: p.text.slice(i, j), at: p.at.slice(i, j) };
}

// ── What is locked ──
type Unit = { key: string; file: string; src: string; line0: number; plain: Plain };

const listOf = (text: string | null) =>
  (text ?? "").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.replace(/^\.?\//, ""));

function kindOf(f: string, listed: string[]): string | null {
  if (listed.some((p) => f === p || f.startsWith(p.replace(/\/*$/, "/")))) return "listed";
  if (f.startsWith("web/content/journal/")) return "journal";
  if (/^docs\/releases\/[^/]+\.md$/.test(f)) return "release";
  if (f === "docs/manifesto.md") return "manifesto";
  if (f === "README.md") return "readme";
  if (/^docs\/(?:[^/]+\/)*rfc-[^/]+\.md$/.test(f)) return "rfc";
  return f === ROADMAP ? "roadmap" : null;
}

// The headings outside code fences that `wanted` picks, each to the next heading of its level or higher.
function sections(src: string, wanted: (level: number, title: string) => boolean) {
  const out: { title: string; from: number; to: number }[] = [];
  let open: { level: number; title: string; from: number } | null = null;
  let [fence, at] = [false, 0];
  for (const line of src.split("\n")) {
    if (/^ {0,3}(?:```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h && open && h[1].length <= open.level) {
      out.push({ ...open, to: at });
      open = null;
    }
    if (h && !open && wanted(h[1].length, h[2])) open = { level: h[1].length, title: h[2], from: at };
    at += line.length + 1;
  }
  if (open) out.push({ ...open, to: src.length });
  return out;
}

// Each node's detail and detailKo, read with the TypeScript parser. A string
// that is not a plain literal is not read, and so is reported removed.
function roadmapStrings(src: string): Unit[] {
  const sf = ts.createSourceFile(ROADMAP, src, ts.ScriptTarget.Latest, true);
  const literal = (e?: ts.Expression) => (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : null);
  const out: Unit[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isObjectLiteralExpression(n)) {
      const props = n.properties.filter(ts.isPropertyAssignment);
      const named = (k: string) => props.find((p) => (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === k)?.initializer;
      for (const field of ["detail", "detailKo"]) {
        const [text, e] = [literal(named(field)), named(field)];
        const line = e ? sf.getLineAndCharacterOfPosition(e.getStart()).line + 1 : 0;
        const key = `${ROADMAP} › ${literal(named("id")) ?? `line ${line}`}.${field}`;
        if (text !== null) out.push({ key, file: ROADMAP, src: text, line0: line, plain: plain(text, false) });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

function unitsOf(f: string, src: string, kind: string): Unit[] {
  if (kind === "roadmap") return roadmapStrings(src);
  const whole = plain(src, f.endsWith(".mdx"));
  const cut = (key: string, s: { from: number; to: number }): Unit => ({ key, file: f, src, line0: 1, plain: slice(whole, s.from, s.to) });
  if (kind === "readme") return sections(src, (l, t) => l === 2 && README_SECTIONS.includes(t)).map((s) => cut(`${f} › ${s.title}`, s));
  if (kind === "rfc") return sections(src, (_, t) => /^Part 1\b/.test(t)).map((s) => cut(`${f} › Part 1`, s));
  return [{ key: f, file: f, src, line0: 1, plain: whole }];
}

// ── Showing a change ──
// The source around plain characters [p, q), 30 of them each side, with the stretch marked «…».
function excerpt(u: Unit, p: number, q: number): string {
  const { src, plain: { at } } = u;
  const markFrom = p < q ? at[p] : p > 0 ? at[p - 1] + 1 : (at[0] ?? 0);
  const markTo = p < q ? at[q - 1] + 1 : markFrom;
  const from = Math.min(markFrom, at[Math.max(0, p - 30)] ?? markFrom);
  const to = Math.max(markTo, (at[Math.min(at.length, q + 30) - 1] ?? markTo - 1) + 1);
  const flat = (s: string) => s.replace(/\s+/g, " ");
  const marked = flat(src.slice(markFrom, markTo));
  const line = u.line0 + (src.slice(0, markFrom).match(/\n/g)?.length ?? 0);
  return `${u.file}:${line}  …${flat(src.slice(from, markFrom))}«${marked.length > 200 ? `${marked.slice(0, 200)}…` : marked}»${flat(src.slice(markTo, to))}…`;
}
function difference(a: Unit, b: Unit): [string, string] {
  const [x, y] = [a.plain.text, b.plain.text];
  let [p, s] = [0, 0];
  while (p < x.length && p < y.length && x[p] === y[p]) p++;
  while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s++;
  return [excerpt(a, p, x.length - s), excerpt(b, p, y.length - s)];
}

// ── The check ──
const strict = process.env.PF_DRIFT_STRICT === "1";
const base = findBase();
if (base.sha === null) {
  console.log(`check:human-lock: ${base.fatal ? base.why : `skipped, ${base.why}${strict ? "\nPF_DRIFT_STRICT=1, so a skip fails" : ""}`}`);
  process.exit(base.fatal || strict ? 1 : 0);
}
const BASE = base.sha;
const plural = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;

const [listedBefore, listedNow] = [listOf(readAt(BASE, LIST)), listOf(readNow(LIST))];
const listed = [...new Set([...listedBefore, ...listedNow])];
const unlisted = listedBefore.filter((p) => !listedNow.includes(p));

// What is locked at HEAD, counted, so a run says what it looked at.
const count = new Map<string, number>();
for (const f of git(["ls-files", "-z"]).split("\0")) {
  const kind = kindOf(f, listedNow);
  if (kind && kind !== "listed") count.set(kind, (count.get(kind) ?? 0) + (["readme", "rfc", "roadmap"].includes(kind) ? unitsOf(f, readNow(f) ?? "", kind).length : 1));
}
const n = (kind: string) => count.get(kind) ?? 0;
console.log(`base: ${BASE.slice(0, 7)} (${base.from})`);
console.log(`locked: ${n("journal")} journal files, ${n("release")} release files, docs/manifesto.md, ${n("readme")} README sections, Part 1 of ${n("rfc")} RFCs, ${n("roadmap")} roadmap strings, ${plural(listedNow.length, "path")} in ${LIST}`);
const changes = changedSince(BASE);
const touched = changes.filter((c) => kindOf(c.path, listed));
console.log(`this diff touches ${plural(touched.length, "locked file")}`);
if (touched.length || unlisted.length) console.log("");
for (const p of unlisted) console.log(`unlisted ${LIST} no longer names ${p}; only the maintainer takes a path off it`);

// Where vanished text may have gone: every file this diff adds or changes.
let corpus: { file: string; text: string }[] | undefined;
function whereIs(text: string): string | null {
  corpus ??= changes.flatMap(({ path: f, status }) => {
    const raw = status !== "deleted" && fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f)) : null;
    if (!raw || raw.includes(0)) return [];
    const parts = kindOf(f, listed) === "roadmap" ? roadmapStrings(raw.toString("utf8")).map((u) => u.plain.text) : [];
    return [plain(raw.toString("utf8"), f.endsWith(".mdx")).text, ...parts].map((t) => ({ file: f, text: t }));
  });
  return corpus.find((c) => c.text.includes(text))?.file ?? null;
}

let [failed, moved] = [0, 0];
for (const c of touched) {
  const kind = kindOf(c.path, listed)!;
  const units = (src: string | null) => new Map((src === null ? [] : unitsOf(c.path, src, kind)).map((u) => [u.key, u]));
  const [old, cur] = [units(c.status === "added" ? null : readAt(BASE, c.path)), units(c.status === "deleted" ? null : readNow(c.path))];
  let same = 0;
  for (const [key, a] of old) {
    const b = cur.get(key);
    if (b ? a.plain.text === b.plain.text : !a.plain.text) same++;
    else if (b) {
      const [was, is] = difference(a, b);
      console.log(`changed  ${key}\n           base  ${was}\n           head  ${is}`);
      failed++;
    } else {
      const to = whereIs(a.plain.text);
      console.log(to ? `moved    ${key} → ${to}, word for word` : `removed  ${key}: its words are in no file this diff adds or changes`);
      if (to) moved++;
      else failed++;
    }
  }
  const fresh = [...cur.keys()].filter((k) => !old.has(k)).length;
  const what = kind === "roadmap" ? "strings" : "sections";
  if (same) console.log(`same     ${c.path}${old.size > 1 ? ` (${same} of ${old.size} locked ${what})` : ""}`);
  if (fresh) console.log(`new      ${c.path}${cur.size > 1 ? ` (${fresh} locked ${what})` : ""}`);
}

console.log("");
if (moved) console.log("Moving locked text needs the maintainer's approval on the PR (docs/rfc-cleanup.md §2.9).");
const wrong = [failed && `${plural(failed, "locked text")} changed`, unlisted.length && `${plural(unlisted.length, "path")} taken off ${LIST}`];
if (failed || unlisted.length) {
  console.log(`check:human-lock: ${wrong.filter(Boolean).join(", ")}`);
  if (failed) console.log("Markup, layout and link and image paths may change in locked text; words may not. A typo is reported in the PR description, not fixed.");
  process.exitCode = 1;
} else console.log("check:human-lock: no locked words changed");
