/**
 * The lock on the maintainer's own writing: `npm run check:human-lock` in web/
 * (docs/rfc-cleanup.md §2.9). A pull request may change the markup, layout and
 * link and image paths in locked text. It may not change a word. A typo is
 * reported in the PR description, not fixed.
 *
 * Locked:
 *
 *   web/content/journal/   every file, every language
 *   docs/manifesto.md
 *   docs/releases/*.md
 *   README.md              "Where it began", "The community responded" and
 *                          "Story so far", each from its ## heading to the next
 *   docs/rfc-*.md          Part 1, from its heading to the next of its level
 *   roadmap-data.ts        each node's detail and detailKo, read with the
 *                          TypeScript parser and keyed by the node's id
 *   docs/.human-written    each path in it, a directory locking what is under it
 *
 * Each locked file or region is compared as plain text, the base's against the
 * working tree's. Plain text is what is left once the Markdown and MDX syntax
 * and all whitespace are gone. The syntax is heading, quote and list marks,
 * emphasis and code marks, code fences (not the code in them), table pipes and
 * rules, comments, tags, link targets, bare URLs and front matter keys. A
 * tag's alt, title and aria-label stay, being words, and so do front matter
 * values, unless one is a path or a URL.
 *
 * The base comes from scripts/lib/pr-base.ts. A locked file the base lacks is
 * new, and passes. Locked text that leaves its place passes only if it turns
 * up word for word in a file this diff adds or changes. That is a move, and the
 * run says it needs the maintainer's approval on the PR. Taking a path off
 * docs/.human-written fails: only the maintainer does that.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { ROOT, changedSince, findBase, git, readAt, readNow, type Base } from "./lib/pr-base";

const README_SECTIONS = ["Where it began", "The community responded", "Story so far"];
const ROADMAP = "web/src/app/roadmap/roadmap-data.ts";
const LIST = "docs/.human-written";

// ── Plain text ──

// The characters kept, and the offset of each in the text they came from.
type Plain = { text: string; at: number[] };

// Syntax is blanked to spaces rather than cut, so every offset stays where it
// was and a changed word can be shown in its line.
const blank = (s: string) => s.replace(/[^\n]/g, " ");
// [text](target): the brackets and the target go, the text stays.
const keep = (_m: string, open: string, text: string, close: string) => blank(open) + text + blank(close);
const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function entity(m: string): string {
  const body = m.slice(1, -1);
  const code = body[0] === "#" ? Number(/^#x/i.test(body) ? `0${body.slice(1)}` : body.slice(1)) : NaN;
  const c = body[0] === "#" ? (code <= 0x10ffff ? String.fromCodePoint(code) : undefined) : ENTITIES[body.toLowerCase()];
  return c === undefined ? m : c + " ".repeat(m.length - c.length);
}
// A tag goes, but the words in its alt, title and aria-label stay.
function tag(m: string): string {
  let out = blank(m);
  for (const a of m.matchAll(/\b(?:alt|title|aria-label)=(["'])([^"']*)\1/g)) {
    const at = (a.index ?? 0) + a[0].indexOf(a[1]) + 1;
    out = out.slice(0, at) + a[2] + out.slice(at + a[2].length);
  }
  return out;
}
function frontMatter(m: string, body: string): string {
  const values = body.split("\n").map((line) => {
    const kv = /^(\s*[\w-]+:\s*)(["']?)(.*?)(\2\s*)$/.exec(line);
    if (!kv) return line;
    return blank(kv[1] + kv[2]) + (/^(?:\.{0,2}\/|https?:)/.test(kv[3]) ? blank(kv[3]) : kv[3]) + blank(kv[4]);
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
  [/&(?:#x[\da-f]+|#\d+|[a-z]+);/gi, entity],
  [/\\(?=[!-/:-@[-`{-~])/g, blank],
  [/[*~`|]/g, blank],
  [/(?<![\p{L}\p{N}])_+|_+(?![\p{L}\p{N}])/gu, blank], // emphasis, not snake_case
];
const MDX: [RegExp, (m: string) => string] = [/^(?:import|export)\s.*$/gm, blank];

function plain(src: string, mdx: boolean): Plain {
  let s = src.replace(/\r/g, " ");
  for (const [re, f] of mdx ? [MDX, ...SYNTAX] : SYNTAX) s = s.replace(re, f as (m: string, ...g: string[]) => string);
  const out: Plain = { text: "", at: [] };
  const chars: string[] = [];
  for (let i = 0; i < s.length; i++)
    if (!/\s/.test(s[i])) {
      chars.push(s[i]);
      out.at.push(i);
    }
  out.text = chars.join("");
  return out;
}

function slice(p: Plain, from: number, to: number): Plain {
  const [a, b] = [p.at.findIndex((x) => x >= from), p.at.findIndex((x) => x >= to)];
  const [i, j] = [a < 0 ? p.at.length : a, b < 0 ? p.at.length : b];
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
  if (f === ROADMAP) return "roadmap";
  return null;
}

// Headings outside code fences that `wanted` picks, each running to the next
// heading of its level or higher.
function sections(src: string, wanted: (level: number, title: string) => boolean) {
  const out: { title: string; from: number; to: number }[] = [];
  let open: { level: number; title: string; from: number } | null = null;
  let fence = false;
  let at = 0;
  for (const line of src.split("\n")) {
    if (/^ {0,3}(?:```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (h && open && h[1].length <= open.level) {
      out.push({ title: open.title, from: open.from, to: at });
      open = null;
    }
    if (h && !open && wanted(h[1].length, h[2])) open = { level: h[1].length, title: h[2], from: at };
    at += line.length + 1;
  }
  if (open) out.push({ title: open.title, from: open.from, to: src.length });
  return out;
}

// A string the parser can read without running anything: a literal, a
// template's fixed parts, or literals joined with +.
function literal(e: ts.Expression): string | null {
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isTemplateExpression(e)) return [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join("");
  if (ts.isParenthesizedExpression(e)) return literal(e.expression);
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const [l, r] = [literal(e.left), literal(e.right)];
    return l === null || r === null ? null : l + r;
  }
  return null;
}

function roadmapStrings(src: string): Unit[] {
  const sf = ts.createSourceFile(ROADMAP, src, ts.ScriptTarget.Latest, true);
  const out: Unit[] = [];
  const name = (p: ts.ObjectLiteralElementLike) =>
    ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
  const visit = (n: ts.Node): void => {
    if (ts.isObjectLiteralExpression(n)) {
      const idProp = n.properties.find((p) => name(p) === "id");
      const id = idProp && ts.isPropertyAssignment(idProp) ? literal(idProp.initializer) : null;
      for (const p of n.properties) {
        const field = name(p);
        if (!ts.isPropertyAssignment(p) || (field !== "detail" && field !== "detailKo")) continue;
        const text = literal(p.initializer);
        const line = sf.getLineAndCharacterOfPosition(p.initializer.getStart()).line + 1;
        if (text !== null) out.push({ key: `${ROADMAP} › ${id ?? `line ${line}`}.${field}`, file: ROADMAP, src: text, line0: line, plain: plain(text, false) });
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
  const cut = (key: string, from: number, to: number): Unit => ({ key, file: f, src, line0: 1, plain: slice(whole, from, to) });
  if (kind === "readme")
    return sections(src, (level, title) => level === 2 && README_SECTIONS.includes(title)).map((s) => cut(`${f} › ${s.title}`, s.from, s.to));
  if (kind === "rfc") return sections(src, (_, title) => /^Part 1\b/.test(title)).map((s) => cut(`${f} › Part 1`, s.from, s.to));
  return [{ key: f, file: f, src, line0: 1, plain: whole }];
}

// ── Showing a change ──

const CONTEXT = 30;
const LONGEST = 200;

// The source around plain characters [p, q), with that stretch marked «…».
function excerpt(u: Unit, p: number, q: number): string {
  const { src, plain: { at } } = u;
  const markFrom = p < q ? at[p] : p > 0 ? at[p - 1] + 1 : (at[0] ?? 0);
  const markTo = p < q ? at[q - 1] + 1 : markFrom;
  const from = Math.min(markFrom, at[Math.max(0, p - CONTEXT)] ?? markFrom);
  const to = Math.max(markTo, (at[Math.min(at.length, q + CONTEXT) - 1] ?? markTo - 1) + 1);
  const flat = (s: string) => s.replace(/\s+/g, " ");
  let marked = flat(src.slice(markFrom, markTo));
  if (marked.length > LONGEST) marked = `${marked.slice(0, LONGEST)}…`;
  const line = u.line0 + (src.slice(0, markFrom).match(/\n/g)?.length ?? 0);
  return `${u.file}:${line}  …${flat(src.slice(from, markFrom))}«${marked}»${flat(src.slice(markTo, to))}…`;
}

function difference(a: Unit, b: Unit): [string, string] {
  const [x, y] = [a.plain.text, b.plain.text];
  let p = 0;
  while (p < x.length && p < y.length && x[p] === y[p]) p++;
  let s = 0;
  while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s++;
  return [excerpt(a, p, x.length - s), excerpt(b, p, y.length - s)];
}

// ── The check ──

const strict = process.env.PF_DRIFT_STRICT === "1";
let base: Base;
try {
  base = findBase();
} catch (e) {
  console.log(`check:human-lock: ${(e as Error).message}`);
  process.exit(1);
}
if (base.sha === null) {
  console.log(`check:human-lock: skipped, ${base.why}`);
  if (strict) console.log("PF_DRIFT_STRICT=1, so a skip fails");
  process.exit(strict ? 1 : 0);
}
const BASE = base.sha;

const listedBefore = listOf(readAt(BASE, LIST));
const listedNow = listOf(readNow(LIST));
const listed = [...new Set([...listedBefore, ...listedNow])];

// What is locked at HEAD, counted, so a run says what it looked at.
const count = new Map<string, number>();
for (const f of git(["ls-files", "-z"]).split("\0").filter(Boolean)) {
  const kind = kindOf(f, listedNow);
  if (!kind || kind === "listed") continue;
  const n = kind === "readme" || kind === "rfc" || kind === "roadmap" ? unitsOf(f, readNow(f) ?? "", kind).length : 1;
  count.set(kind, (count.get(kind) ?? 0) + n);
}
const n = (kind: string) => count.get(kind) ?? 0;
console.log(`base: ${BASE.slice(0, 7)} (${base.from})`);
console.log(
  `locked: ${n("journal")} journal files, ${n("release")} release files, docs/manifesto.md, ${n("readme")} README sections, ` +
    `Part 1 of ${n("rfc")} RFCs, ${n("roadmap")} roadmap strings, ${listedNow.length} path${listedNow.length === 1 ? "" : "s"} in ${LIST}`,
);

const changes = changedSince(BASE);
const touched = changes.filter((c) => kindOf(c.path, listed));
console.log(`this diff touches ${touched.length} locked file${touched.length === 1 ? "" : "s"}`);

let failed = 0;
let moved = 0;
const unlisted = listedBefore.filter((p) => !listedNow.includes(p));
if (touched.length || unlisted.length) console.log("");
for (const p of unlisted) console.log(`unlisted ${LIST} no longer names ${p}; only the maintainer takes a path off it`);

// Where vanished text may have gone: every file this diff adds or changes.
let corpus: { file: string; text: string }[] | undefined;
function whereIs(text: string): string | null {
  corpus ??= changes.flatMap((c) => {
    if (c.status === "deleted") return [];
    const raw = fs.existsSync(path.join(ROOT, c.path)) ? fs.readFileSync(path.join(ROOT, c.path)) : null;
    if (!raw || raw.includes(0)) return [];
    const src = raw.toString("utf8");
    const kind = kindOf(c.path, listed);
    const parts = kind === "roadmap" ? unitsOf(c.path, src, kind).map((u) => u.plain.text) : [];
    return [plain(src, c.path.endsWith(".mdx")).text, ...parts].map((text) => ({ file: c.path, text }));
  });
  return corpus.find((c) => c.text.includes(text))?.file ?? null;
}

for (const c of touched) {
  const kind = kindOf(c.path, listed)!;
  const before = c.status === "added" ? null : readAt(BASE, c.path);
  const now = c.status === "deleted" ? null : readNow(c.path);
  const old = new Map((before === null ? [] : unitsOf(c.path, before, kind)).map((u) => [u.key, u]));
  const cur = new Map((now === null ? [] : unitsOf(c.path, now, kind)).map((u) => [u.key, u]));
  let same = 0;
  for (const [key, a] of old) {
    const b = cur.get(key);
    if (b && a.plain.text === b.plain.text) same++;
    else if (b) {
      const [was, is] = difference(a, b);
      console.log(`changed  ${key}`);
      console.log(`           base  ${was}`);
      console.log(`           head  ${is}`);
      failed++;
    } else if (!a.plain.text) same++;
    else {
      const to = whereIs(a.plain.text);
      console.log(to ? `moved    ${key} → ${to}, word for word` : `removed  ${key}: its words are in no file this diff adds or changes`);
      if (to) moved++;
      else failed++;
    }
  }
  const fresh = [...cur.keys()].filter((k) => !old.has(k)).length;
  if (same) console.log(`same     ${c.path}${old.size > 1 ? ` (${same} of ${old.size} locked ${kind === "roadmap" ? "strings" : "sections"})` : ""}`);
  if (fresh) console.log(`new      ${c.path}${cur.size > 1 ? ` (${fresh} locked ${kind === "roadmap" ? "strings" : "sections"})` : ""}`);
}

console.log("");
if (moved) console.log("Moving locked text needs the maintainer's approval on the PR (docs/rfc-cleanup.md §2.9).");
const plural = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
const wrong = [
  failed && `${plural(failed, "locked text", "locked texts")} changed`,
  unlisted.length && `${plural(unlisted.length, "path", "paths")} taken off ${LIST}`,
].filter(Boolean);
if (wrong.length) {
  console.log(`check:human-lock: ${wrong.join(", ")}`);
  if (failed) console.log("Markup, layout and link and image paths may change in locked text; words may not. A typo is reported in the PR description, not fixed.");
  process.exitCode = 1;
} else console.log("check:human-lock: no locked words changed");
