/**
 * The voice lint: `npm run check:voice` in web/ (docs/rfc-cleanup.md §2.10).
 * New or rewritten text over 20 lines goes through it before the pull request
 * opens, and a person still reads the text before merge. CI does not run it.
 *
 * With files as arguments it reads all of each (`-` reads Markdown from
 * stdin, for a PR description). With none it reads the lines this branch adds
 * since the base the lock uses (scripts/lib/pr-base.ts), untracked files
 * included. Each finding is printed as file:line, the rule and the words.
 *
 *   banned  a word or phrase in docs/voice-banned.txt. An English entry
 *           matches whole words and their endings; a Korean one, anywhere.
 *   threes  three adjectives or clauses in a row, joined by commas.
 *   opener  a sentence that says what the text is about.
 *   closer  a closing summary, the kind that starts "In conclusion".
 *
 * Only the prose of a file is read: Markdown without code, tags, link targets
 * or URLs; an HTML page's text; a script's comments, strings and JSX text; the
 * comments of C, Python, shell and YAML. Text in double quotes or 「」 is
 * someone's words being quoted, and is skipped. So is a section under a
 * "Writing voice" heading, which has to quote what it forbids.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { ROOT, changedSince, findBase, git } from "./lib/pr-base";

const BANNED = "docs/voice-banned.txt";
// Files the rules would read as their own examples, each with the reason.
const EXEMPT: Record<string, string> = {
  [BANNED]: "it is the list the banned rule reads",
};
const VOICE_HEADING = /^ {0,3}(#{1,6})\s+(?:[\d.]+\s+)?Writing voice\b/i;

// ── Prose ──
// Each reader returns its file with everything but the prose blanked to
// spaces, newlines kept, so a match's offset still names its line.
const blank = (s: string) => s.replace(/[^\n]/g, " ");
type Reader = (src: string, file: string) => string;
type Range = [from: number, to: number];

function only(src: string, keep: Range[]): string {
  const out = blank(src).split("");
  for (const [a, b] of keep) for (let i = a; i < b; i++) out[i] = src[i];
  return out.join("");
}
// The matches of re that keep() accepts, trimmed by the delimiters it returns.
const pick = (re: RegExp, keep: (m: string) => number | null): Reader => (src) =>
  only(src, [...src.matchAll(re)].flatMap((m): Range[] => {
    const cut = keep(m[0]);
    return cut === null ? [] : [[m.index + cut, m.index + m[0].length - cut]];
  }));

function markdown(src: string, mdx: boolean): string {
  let [fence, quiet, front] = [false, 0, src.startsWith("---\n")];
  const lines = src.split("\n").map((line, i) => {
    if (front) {
      if (i > 0 && /^---\s*$/.test(line)) front = false;
      return i > 0 && front ? line.replace(/^\s*[\w-]+:/, blank) : ""; // front matter: the values are text
    }
    if (/^ {0,3}(?:```|~~~)/.test(line)) fence = !fence;
    if (fence || /^ {0,3}(?:```|~~~)/.test(line)) return "";
    const h = /^ {0,3}(#{1,6})\s/.exec(line);
    if (h && quiet && h[1].length <= quiet) quiet = 0;
    quiet ||= VOICE_HEADING.exec(line)?.[1].length ?? 0;
    return quiet || (mdx && /^(?:import|export)\s/.test(line)) ? "" : line;
  });
  return lines.join("\n")
    .replace(/^ {0,3}\[[^\]\n]+\]:.*$/gm, blank)
    .replace(/`[^`\n]*`|\]\([^)\n]*\)|\]\[[^\]\n]*\]|<\/?[A-Za-z][^>\n]*>|<!--|-->|&(?:#x[\da-f]+|#\d+|[a-z]+);/gi, blank);
}

const html: Reader = (src) =>
  src.replace(/<(script|style)\b[\s\S]*?<\/\1\s*>|<[^>]*>|&(?:#x[\da-f]+|#\d+|[a-z]+);/gi, blank);

// A script's comments, strings and JSX text, found by the TypeScript parser so
// a regular expression or a template cannot pass for a comment.
function script(src: string, file: string): string {
  const kind = /x$/.test(file) ? ts.ScriptKind.TSX : /\.[cm]?js$/.test(file) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const keep: Range[] = [];
  const seen = new Set<number>();
  const comment = (pos: number, end: number) => {
    if (!seen.has(pos)) keep.push([pos, end]);
    seen.add(pos);
  };
  const visit = (n: ts.Node): void => {
    if (n.kind >= ts.SyntaxKind.FirstJSDocNode && n.kind <= ts.SyntaxKind.LastJSDocNode) return;
    if (ts.isJsxText(n)) {
      keep.push([n.pos, n.end]);
      return;
    }
    ts.forEachLeadingCommentRange(src, n.pos, comment);
    if (ts.isStringLiteral(n)) keep.push([n.getStart(sf) + 1, n.end - 1]);
    else if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) keep.push([n.getStart(sf), n.end]);
    n.getChildren(sf).forEach(visit);
  };
  visit(sf);
  return only(src, keep);
}

const STRINGS = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;
const cLike = pick(new RegExp(String.raw`\/\*[\s\S]*?\*\/|\/\/[^\n]*|${STRINGS}`, "g"), (m) => (m[0] === "/" ? 0 : null));
const hash = pick(new RegExp(String.raw`${STRINGS}|#[^\n]*`, "g"), (m) => (m[0] === "#" ? 0 : null));
const python = pick(new RegExp(String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''|${STRINGS}|#[^\n]*`, "g"), (m) => (m[0] === "#" ? 0 : /^("""|''')/.test(m) ? 3 : null));
const asMarkdown: Reader = (src, file) => markdown(src, file.endsWith(".mdx"));

const plain: Reader = (s) => s;
const READERS: Record<string, Reader | undefined> = {
  ".md": asMarkdown, ".mdx": asMarkdown, ".txt": plain, ".html": html,
  ".ts": script, ".tsx": script, ".js": script, ".jsx": script, ".mjs": script, ".cjs": script,
  ".h": cLike, ".hpp": cLike, ".c": cLike, ".cpp": cLike, ".ino": cLike, ".kt": cLike, ".java": cLike,
  ".py": python, ".sh": hash, ".yml": hash, ".yaml": hash, ".toml": hash,
};

// URLs, and quoted words: double quotes on one paragraph, or 「」 and 『』.
// Runs of blanks shrink to one space; the newlines stay.
const prose = (src: string, read: Reader, file: string) =>
  read(src.replace(/\r/g, ""), file)
    .replace(/https?:\/\/[^\s)\]>"'`]+/g, blank)
    .replace(/"(?:[^"\n]|\n(?![ \t]*\n)){1,300}?"|“[^”]{1,300}”|「[^」]{1,300}」|『[^』]{1,300}』/g, blank)
    .replace(/[^\S\n]+/g, " ");

// ── The rules ──
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "ensure" catches "ensures", "ensured" and "ensuring"; "robust", "robustly".
function forms(w: string): string {
  if (!/^[a-z]+$/.test(w)) return escape(w);
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}(?:y|ies|ied|ying|ily|iness)`;
  if (w.endsWith("e")) return `${w.slice(0, -1)}(?:e|es|ed|ing|ely|eness|ation|ations)`;
  return `${w}(?:s|es|ed|ing|ly|ness|ment|ments)?`;
}
function bannedRule(): RegExp {
  const entries = fs.readFileSync(path.join(ROOT, BANNED), "utf8").split("\n")
    .map((l) => l.trim().toLowerCase().replace(/’/g, "'")).filter((l) => l && !l.startsWith("#"));
  const korean = entries.filter((e) => /\p{Script=Hangul}/u.test(e)).map(escape);
  const english = entries.filter((e) => !/\p{Script=Hangul}/u.test(e)).map((e) => {
    const words = e.split(/\s+/);
    return [...words.slice(0, -1).map(escape), forms(words[words.length - 1])].join(String.raw`\s+`).replace(/'/g, "['’]").replace(/-/g, String.raw`[-\s]`);
  });
  const alt = [english.length && String.raw`(?<![\p{L}\p{N}])(?:${english.join("|")})(?![\p{L}\p{N}])`, korean.length && korean.join("|")];
  return new RegExp(alt.filter(Boolean).join("|") || "(?!)", "giu");
}

// A sentence starts at a line's first letter, or after . ! or ? and a space.
const START = String.raw`(?<=^[^\p{L}\p{N}\n]*|[.!?]["'”’)\]]*\s)`;
// Three items of the same length in words, the last after a serial comma
// ("fast, simple, and reliable"), none starting with an article or the like
// (that is a list of things), not part of a longer list. In Korean the first
// two end the way a clause or an adjective does.
const EN_WORD = String.raw`(?!(?:and|or|but|nor)\b)[a-z][a-z'’-]*`;
const EN_DET = String.raw`(?!(?:[Tt]he|[Aa]n?|[Ii]ts|[Tt]heir|[Hh]is|[Hh]er|[Oo]ur|[Yy]our|[Ee]ach|[Ee]very|[Oo]ne|[Tt]wo)\s)`;
const EN_ITEM = (n: number, first = "[a-z]") => String.raw`${EN_DET}${first}[a-z'’-]*(?:\s${EN_WORD}){${n - 1}}`;
const EN_THREE = (n: number) => String.raw`${EN_ITEM(n, "[A-Za-z]")},\s${EN_ITEM(n)},\s(?:and|or)\s${EN_ITEM(n)}`;
const KO_WORD = String.raw`[\p{Script=Hangul}]+`;
const KO_JOIN = String.raw`${KO_WORD}(?:고|며|하게|롭게|한|적인|로운|있는|없는|된)`;
const KO_ITEM = (last: string) => String.raw`(?:${KO_WORD}\s){0,2}${last}`;
// Patterns are regex literals, so a run on this file does not read them as prose.
const OPENERS = [
  /(?:This|The following)\s(?:document|doc|file|page|guide|section|chapter|post|article|note|README|PR|pull request|commit|change|RFC|plan|report|tutorial|module|script|spec|specification|repository|repo)\s(?:describes|explains|covers|introduces|provides|contains|outlines|presents|documents|details|lists|summari[sz]es|discusses|defines|walks|aims|is about|will)\b/u,
  /In\sthis\s(?:document|doc|file|page|guide|section|chapter|post|article|README|PR|pull request|RFC|plan|report|tutorial),?\s(?:we|you|I)\b/u,
  /(?:이|본|이번)\s(?:문서|글|페이지|파일|가이드|안내서|절|장|섹션|PR|커밋|스크립트|모듈|계획서|보고서|RFC)\s?(?:은|는|에서는|에서)\s[^.!?\n]{0,60}?(?:설명|소개|다루|다룹|다룬|안내|살펴|담고|담았)/u,
];
const CLOSERS = /(?:In conclusion|In summary|To summari[sz]e|To sum up|All in all|In closing|Overall,|TL;\s?DR)/u;
const CLOSERS_KO = /결론적으로|요약하면|요약하자면|정리하자면|종합하면|종합하자면|요컨대|마치며/u;
const RULES: [name: string, re: RegExp, why: string][] = [
  ["banned", bannedRule(), `a word ${BANNED} lists. A sentence that needs one to stand up is a sentence to cut`],
  ["threes", new RegExp([
    String.raw`(?<!,\s?)(?<![\p{L}'’-])(?:${[1, 2, 3].map(EN_THREE).join("|")})(?![\p{L}'’-]|\s(?:and|or)\s)`,
    String.raw`(?<!,\s?)(?<![\p{L}])${KO_ITEM(KO_JOIN)},\s${KO_ITEM(KO_JOIN)},\s${KO_ITEM(KO_WORD)}(?!(?:\s${KO_WORD}){0,3},)(?![\p{L}])`,
  ].join("|"), "gu"), "three in a row. One reason is a reason; three is a pattern"],
  ["opener", new RegExp(`${START}(?:${OPENERS.map((r) => r.source).join("|")})`, "gmu"), "says what the text is about. Start with the thing"],
  ["closer", new RegExp(`${START}${CLOSERS.source}|${CLOSERS_KO.source}`, "gmu"), "a closing summary. A paragraph stops when it is said"],
];

// ── What is read ──
type Target = { file: string; src: string; read: Reader; lines: Set<number> | null };
const plural = (k: number, one: string) => `${k} ${one}${k === 1 ? "" : "s"}`;
const strict = process.env.PF_DRIFT_STRICT === "1";
const args = process.argv.slice(2);
const targets: Target[] = [];
const skipped: string[] = [];

function add(file: string, lines: Set<number> | null, explicit: boolean, abs = path.join(ROOT, file)) {
  const read = READERS[path.extname(file).toLowerCase()] ?? (explicit ? plain : undefined);
  const raw = read && fs.existsSync(abs) && fs.statSync(abs).isFile() ? fs.readFileSync(abs) : null;
  if (EXEMPT[file]) skipped.push(`${file}: ${EXEMPT[file]}`);
  else if (explicit && !raw) skipped.push(`${file}: no such file`);
  else if (read && raw && !raw.includes(0)) targets.push({ file, src: raw.toString("utf8"), read, lines });
}

if (args.length) {
  const cwd = process.env.INIT_CWD ?? process.cwd();
  for (const a of args) {
    if (a === "-") targets.push({ file: "(stdin)", src: fs.readFileSync(0, "utf8"), read: asMarkdown, lines: null });
    else {
      const abs = path.resolve(cwd, a);
      const rel = path.relative(ROOT, abs);
      add(rel.startsWith("..") ? a : rel.split(path.sep).join("/"), null, true, abs);
    }
  }
} else {
  const base = findBase();
  if (base.sha === null) {
    console.log(`check:voice: ${base.fatal ? base.why : `skipped, ${base.why}${strict ? "\nPF_DRIFT_STRICT=1, so a skip fails" : ""}`}`);
    process.exit(base.fatal || strict ? 1 : 0);
  }
  console.log(`base: ${base.sha.slice(0, 7)} (${base.from})`);
  // Each file's added lines: all of a new file, the + side of each hunk otherwise.
  const added = new Map<string, Set<number> | null>();
  for (const c of changedSince(base.sha)) if (c.status === "added") added.set(c.path, null);
  let file = "";
  for (const line of git(["-c", "core.quotePath=false", "diff", "-U0", "--no-renames", "--no-color", "--no-ext-diff", base.sha]).split("\n")) {
    const f = /^\+\+\+ (?:b\/(.*?)\t?|\/dev\/null)$/.exec(line);
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (f) file = f[1] ?? "";
    else if (h && file && added.get(file) !== null) {
      const set = added.get(file) ?? new Set<number>();
      for (let i = 0; i < Number(h[2] ?? 1); i++) set.add(Number(h[1]) + i);
      added.set(file, set);
    }
  }
  for (const [f, lines] of added) if (lines === null || lines.size) add(f, lines, false);
}

// ── The lint ──
type Finding = { at: string; rule: string; words: string };
const findings: Finding[] = [];
let count = 0;
for (const t of targets) {
  const lines = prose(t.src, t.read, t.file).split("\n");
  const wanted = (i: number) => t.lines === null || t.lines.has(i + 1);
  count += lines.filter((_, i) => wanted(i)).length;
  // Runs of wanted lines, matched as one text so a phrase may wrap.
  for (let i = 0; i < lines.length; i++) {
    if (!wanted(i)) continue;
    let j = i;
    while (j + 1 < lines.length && wanted(j + 1)) j++;
    const text = lines.slice(i, j + 1).join("\n");
    for (const [rule, re] of RULES)
      for (const m of text.matchAll(re)) {
        const line = i + 1 + (text.slice(0, m.index).match(/\n/g)?.length ?? 0);
        const words = m[0].replace(/\s+/g, " ").trim();
        findings.push({ at: `${t.file}:${line}`, rule, words: words.length > 70 ? `${words.slice(0, 70)}…` : words });
      }
    i = j;
  }
}
findings.sort((a, b) => a.at.localeCompare(b.at, undefined, { numeric: true }));

console.log(`read: ${plural(count, args.length ? "line" : "added line")} in ${plural(targets.length, "file")}`);
for (const s of skipped) console.log(`skipped ${s}`);
if (findings.length) console.log("");
const width = Math.max(0, ...findings.map((f) => f.at.length));
for (const f of findings) console.log(`${f.at.padEnd(width)}  ${f.rule}  ${f.words}`);
console.log("");
if (!findings.length) console.log("check:voice: nothing found");
else {
  const files = new Set(findings.map((f) => f.at.replace(/:\d+$/, ""))).size;
  console.log(`check:voice: ${plural(findings.length, "finding")} in ${plural(files, "file")}`);
  for (const [rule, , why] of RULES) if (findings.some((f) => f.rule === rule)) console.log(`  ${rule}  ${why}`);
  console.log("The rules are docs/rfc-cleanup.md §2.10; the voice is docs/voice.md. A person reads the text before merge either way.");
  process.exitCode = 1;
}
