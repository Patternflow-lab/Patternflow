/**
 * The doc map: every link into this repository, and whether it lands.
 * `npm run doc-map` in web/ writes docs/investigations/2026-10-doc-map.csv,
 * and beside it the parity list, docs/investigations/2026-10-doc-parity.csv.
 *
 * Moving a file breaks the links that point at it, and only one kind of link
 * is watched: the relative ones in Markdown (.github/scripts/check_links.py).
 * The site points at the guides by absolute GitHub URL. The console pages the
 * device serves point at docs and at the site. The redirect table sends old
 * URLs to new ones. None of those fail a build when the file they name moves,
 * so the cleanup (docs/rfc-cleanup.md §2.2) maps them before it moves anything.
 *
 * Sources are the tracked .md, .mdx, .ts, .tsx and .h files, the console
 * pages, the .yml and .yaml files under .github/ (the issue forms and their
 * config.yml link the repository by absolute URL), and the redirect table in
 * next.config.ts. Vendored upstream code is skipped, as check_links.py skips
 * it, and so are the *_index.h headers, which are the console pages again.
 * Kinds:
 *
 *   relative       a path in Markdown, resolved against the file it is in
 *   absolute-blob  github.com/<owner>/Patternflow/blob|tree/<ref>/<path>
 *   absolute-raw   raw.githubusercontent.com/..., or .../raw/<ref>/<path>
 *   site           patternflow.work/<path>, a root-relative Markdown link, or
 *                  a redirect destination; checked against web/src/app,
 *                  web/public and the redirect and rewrite sources
 *   console        a root-relative link in a console page; checked against
 *                  the paths the firmware registers with .on("/path")
 *
 * An anchor into a Markdown file has to match one of its headings, slugged
 * the way GitHub slugs them. A ref other than main is read with git, and a
 * shallow clone has no tags: run `git fetch --tags` first or those rows say no.
 *
 * `--check absolute` is check:links-absolute (docs/rfc-cleanup.md §2.4). It
 * reads the same rows and writes nothing. It fails on an absolute row that does
 * not resolve, and on a tracked file outside the sources above that carries a
 * repository URL, since the map never reads that file. A row on a ref the clone
 * lacks is skipped, and the check says which refs. With PF_DRIFT_STRICT=1 a
 * skip fails as well.
 *
 * The parity list (docs/rfc-cleanup.md §2.3) is every text the repository
 * keeps in both Korean and English, one row per pair, and whether a side is
 * missing or short. Kinds:
 *
 *   file    a file beside its twin named for the other language: x.ko.md
 *           beside x.md, a journal post's x.en.mdx beside x.mdx
 *   route   a page under web/src/app beside its ko/ or en/ twin; the row only
 *           says both exist, since the words are the copy rows
 *   copy    an object in web/src with `en` and `ko`, walked side by side
 *   field   a field in web/src beside its Ko or En twin: title/titleKo
 *           (bare English), nm/nmEn (bare Korean)
 *
 * The three kinds §2.3 names (x.md beside x.ko.md, console page pairs, Ko
 * fields in features-data.ts) do not exist yet; when one lands it is a file or
 * a field row and needs no change here. Copy a component picks with
 * a ternary on the language is not read. en_chars and ko_chars count the
 * characters that are not whitespace once markup is stripped; how state
 * weighs them is at PER_SYLLABLE below. Nothing is translated: the list is
 * the deliverable.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const OUT = "docs/investigations/2026-10-doc-map.csv";
const PARITY = "docs/investigations/2026-10-doc-parity.csv";
const CONSOLE = "firmware/patternflow/console/";
const REDIRECTS = "web/next.config.ts";
const SKIP = /(^|\/)(hub75|webserver|pubsubclient)\//;
const CHECK = process.argv.includes("--check") ? (process.argv[process.argv.indexOf("--check") + 1] ?? "") : null;
if (CHECK !== null && CHECK !== "absolute") {
  console.error(`doc-map: --check takes "absolute", not "${CHECK}"`);
  process.exit(2);
}

const git = (args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
const files = new Set(tracked);
const dirs = new Set([""]);
for (const f of tracked) for (let d = path.posix.dirname(f); d !== "."; d = path.posix.dirname(d)) dirs.add(d);

// ── What a link can land on ──

const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
const attempt = <T>(f: () => T, fallback: T): T => {
  try {
    return f();
  } catch {
    return fallback;
  }
};
const decode = (p: string) => attempt(() => decodeURIComponent(p), p);
const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

const atRef = new Map<string, string | null>();
function contentAt(ref: string, p: string): string | null {
  if (ref === "main" || ref === "HEAD") return files.has(p) ? read(p) : dirs.has(p) ? "" : null;
  const key = `${ref}:${p}`;
  if (!atRef.has(key)) atRef.set(key, attempt<string | null>(() => git(["cat-file", "-p", key]), null));
  return atRef.get(key) ?? null;
}

// GitHub's heading ids: rendered text, lower-cased, punctuation dropped,
// spaces to hyphens, a repeat numbered -1, -2. Plus any explicit id= or name=.
function anchorsOf(md: string): Set<string> {
  const out = new Set<string>();
  const seen = new Map<string, number>();
  for (const line of md.replace(/```[\s\S]*?```/g, "").split("\n")) {
    const h = /^ {0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!h) continue;
    const text = h[1].replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").replace(/[*`~]/g, "");
    const base = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "").replace(/ /g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  for (const m of md.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) out.add(m[1].toLowerCase());
  return out;
}

// A route or redirect source as a regex; [[...x]], [...x], [x] and :x are its parameters.
const pattern = (route: string) => {
  const marked = route.replace(/\[\[\.\.\.\w+\]\]/g, "\u0001").replace(/\[\.\.\.\w+\]/g, "\u0002").replace(/\[\w+\]|:\w+\*?/g, "\u0003");
  const escaped = marked.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\/?\u0001/g, "(?:/.*)?");
  return new RegExp(`^${escaped.replace(/\u0002/g, ".+").replace(/\u0003/g, "[^/]+")}$`);
};

const publicFiles = new Set(tracked.filter((f) => f.startsWith("web/public/")).map((f) => f.slice("web/public".length)));
const siteRoutes = [pattern("/sitemap.xml"), pattern("/robots.txt")];
for (const f of tracked) {
  const app = /^web\/src\/app(\/.*)?\/(?:page|route)\.(?:tsx?|jsx?|mdx?)$/.exec(f);
  if (app) siteRoutes.push(pattern((app[1] ?? "").replace(/\/\([^/]+\)/g, "") || "/"));
}
// Redirect sources only: the headers() block has sources too, and they are not pages.
const redirects = read(REDIRECTS).split("async redirects()")[1]?.split("async rewrites()")[0] ?? "";
for (const m of redirects.matchAll(/\bsource: "(\/[^"]*)"/g)) siteRoutes.push(pattern(m[1]));
for (const m of read("web/src/lib/campaignRoutes.ts").matchAll(/\bpath: "(\/[^"]*)"/g)) siteRoutes.push(pattern(m[1]));

const deviceRoutes = new Set<string>();
for (const f of tracked.filter((f) => /^firmware\/patternflow\/.*\.(h|ino|cpp)$/.test(f)))
  for (const m of read(f).matchAll(/\.on\(\s*"(\/[^"]*)"/g)) deviceRoutes.add(m[1]);

// ── Reading links out of a file ──

// ref: the branch or tag a file row was read at, which the CSV folds into `to`.
type Row = { from: string; to: string; kind: string; anchor: string; resolves: "yes" | "no"; ref?: string };

const REPO_URL =
  /^https?:\/\/(?:www\.)?(?:github\.com\/(?:engmung|patternflow-lab)\/patternflow\/(blob|tree|raw|edit)|raw\.githubusercontent\.com\/(?:engmung|patternflow-lab)\/patternflow)\/([^/?#]+)\/?([^?#]*)/i;
const SITE_URL = /^https?:\/\/(?:www\.)?patternflow\.work(\/[^?#]*)?/i;
const URL_IN_TEXT = /https?:\/\/(?:www\.)?(?:github\.com|raw\.githubusercontent\.com|patternflow\.work)[^\s"'`<>)\]]*/gi;

function classify(from: string, raw: string, markdown: boolean): Row | null {
  const target = raw.replace(/^<|>$/g, "").replace(/[.,;:]+$/, "");
  if (target.includes("${")) return null; // a template the constants did not fill
  const anchor = target.includes("#") ? decode(target.slice(target.indexOf("#") + 1)) : "";
  const row = (to: string, kind: string, ok: boolean): Row => ({ from, to, kind, anchor, resolves: ok ? "yes" : "no" });
  const fileRow = (ref: string, p: string, kind: string) => {
    const body = contentAt(ref, p);
    const ok = body !== null && (!anchor || !/\.mdx?$/.test(p) || /^L\d+/.test(anchor) || anchorsOf(body).has(anchor.toLowerCase()));
    return { ...row(ref === "main" ? p : `${ref}:${p}`, kind, ok), ref };
  };
  const site = (p: string) => row(trim(p), "site", publicFiles.has(trim(p)) || siteRoutes.some((r) => r.test(trim(p))));

  const repo = REPO_URL.exec(target);
  if (repo) {
    const kind = repo[1] && repo[1].toLowerCase() !== "raw" ? "absolute-blob" : "absolute-raw";
    const p = decode(repo[3]).replace(/\/$/, "");
    return p ? fileRow(repo[2], p, kind) : null; // the repository's front page, which no move breaks
  }
  const web = SITE_URL.exec(target);
  if (web) return site(decode(web[1] ?? "/"));
  if (/^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(target)) return null;
  const p = decode(target.split("#")[0].split("?")[0]);
  if (from.startsWith(CONSOLE)) return p.startsWith("/") ? row(trim(p), "console", deviceRoutes.has(trim(p))) : null;
  if (!markdown || !p) return null;
  if (p.startsWith("/")) return site(p);
  const local = path.posix.normalize(path.posix.join(path.posix.dirname(from), p)).replace(/\/$/, "");
  return local.startsWith("../") ? null : fileRow("main", local, "relative"); // ../../releases is GitHub's page, not a file
}

// `const REPO = "https://github.com/…"`, `${REPO}/blob/main/x` and one-line
// helpers like `blob("x")` are how the site writes its GitHub links.
function expandConstants(text: string): string {
  const consts = new Map<string, string>();
  for (let pass = 0; pass < 3; pass++) {
    for (const m of text.matchAll(/\bconst (\w+) = (["'`])(https?:\/\/[^"'`$]*)\2/g)) consts.set(m[1], m[3]);
    text = text.replace(/\$\{(\w+)\}/g, (s, n: string) => consts.get(n) ?? s);
  }
  for (const m of text.matchAll(/\bconst (\w+) = \((\w+)(?:: string)?\) =>\s*`(https?:\/\/[^`$]*)\$\{\2\}`/g))
    text = text.replace(new RegExp(`\\b${m[1]}\\((["'])([^"']*)\\1\\)`, "g"), (_s, _q, arg: string) => m[3] + arg);
  return text;
}

function linksIn(f: string): Row[] {
  const markdown = /\.mdx?$/.test(f);
  let text = read(f);
  const found: [string, boolean][] = [];
  if (markdown) text = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  if (/\.tsx?$/.test(f)) text = expandConstants(text);
  // In code, `a[i](x)` looks like a Markdown link; only a path that starts like one counts.
  for (const m of text.matchAll(/\]\(\s*(<[^>]+>|[^)\s]+)/g)) found.push([m[1], markdown || /^\.{0,2}\//.test(m[1])]);
  if (markdown) for (const m of text.matchAll(/^\s*\[(?!\^)[^\]]+\]:\s*(\S+)/gm)) found.push([m[1], true]);
  for (const m of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)) found.push([m[1], markdown]);
  for (const m of text.matchAll(URL_IN_TEXT)) found.push([m[0], false]);
  if (f === REDIRECTS) for (const m of text.matchAll(/\bdestination: "(\/[^"]*)"/g)) found.push([m[1], true]);
  return found.map(([raw, md]) => classify(f, raw, md)).filter((r): r is Row => r !== null);
}

// ── The map ──

const sources = tracked.filter((f) => !SKIP.test(f) && (/\.(mdx?|tsx?)$/.test(f) ||
  (f.endsWith(".h") && !f.endsWith("_index.h")) || (f.startsWith(CONSOLE) && f.endsWith(".html")) ||
  (f.startsWith(".github/") && /\.ya?ml$/.test(f))));
const key = (r: Row) => [r.from, r.to, r.anchor, r.kind].join("\0");
const rows = new Map<string, Row>();
for (const f of sources) for (const r of linksIn(f)) rows.set(key(r), r);

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
// Code-point order, not the locale's, so the file is the same on every machine.
const sorted = [...rows.values()].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
const show = (r: Row) => `  ${r.from} → ${r.to}${r.anchor ? "#" + r.anchor : ""} (${r.kind})`;

// ── The check ──

if (CHECK) {
  const strict = process.env.PF_DRIFT_STRICT === "1";
  const absolute = sorted.filter((r) => r.kind.startsWith("absolute-"));
  const refOf = (r: Row) => r.ref ?? "main";
  const perRef = new Map<string, number>();
  for (const r of absolute) perRef.set(refOf(r), (perRef.get(refOf(r)) ?? 0) + 1);
  const lacking = new Set([...perRef.keys()].filter((ref) =>
    ref !== "main" && ref !== "HEAD" && !attempt(() => !!git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]), false)));
  const unread = absolute.filter((r) => lacking.has(refOf(r)));
  const broken = absolute.filter((r) => r.resolves === "no" && !lacking.has(refOf(r)));

  // A repository URL in a file the map does not read. The *_index.h headers
  // are the console pages again, and vendored code is upstream's.
  const mapped = new Set(sources);
  const hits = attempt(() => git(["grep", "-z", "-l", "-I", "-i", "-E",
    "github\\.com/(engmung|patternflow-lab)/patternflow/(blob|tree|raw|edit)/|raw\\.githubusercontent\\.com/(engmung|patternflow-lab)/patternflow/"]), "");
  const strays = hits.split("\0").filter((f) => f && !mapped.has(f) && !SKIP.test(f) && !f.endsWith("_index.h"))
    .flatMap((f) => [...read(f).matchAll(URL_IN_TEXT)].map((m) => classify(f, m[0], false)))
    .filter((r): r is Row => !!r?.kind.startsWith("absolute-"));

  const at = [...perRef].sort().map(([ref, n]) => `${ref === "main" ? "main at HEAD" : ref} (${n})`).join(", ");
  console.log(`${absolute.length} absolute links from ${new Set(absolute.map((r) => r.from)).size} files, against ${at}`);
  console.log(`${broken.length} do not resolve`);
  for (const r of broken) console.log(show(r));
  console.log(`${strays.length} in files the map does not read`);
  for (const r of strays) console.log(show(r));
  if (unread.length) {
    console.log(`${unread.length} not read: this clone lacks ${[...lacking].sort().join(", ")}; run git fetch --tags`);
    if (strict) console.log("PF_DRIFT_STRICT=1, so a link not read fails");
  }
  const failed = broken.length > 0 || strays.length > 0 || (unread.length > 0 && strict);
  console.log(`links-absolute: ${failed ? "failed" : unread.length ? "skipped" : "passed"}`);
  process.exit(failed ? 1 : 0);
}

const csv = ["from,to,kind,anchor,resolves", ...sorted.map((r) => [r.from, r.to, r.kind, r.anchor, r.resolves].map(cell).join(","))];
fs.writeFileSync(path.join(ROOT, OUT), csv.join("\n") + "\n");

const broken = sorted.filter((r) => r.resolves === "no");
console.log(`${sorted.length} links from ${new Set(sorted.map((r) => r.from)).size} files → ${OUT}`);
console.log(`${broken.length} do not resolve`);
for (const r of broken) console.log(show(r));

// ── The parity list ──

type Side = string | null | undefined; // the side's prose; null: it does not exist; undefined: not measured
type Pair = { kind: string; en: string; ko: string; enText: Side; koText: Side };
const pairs: Pair[] = [];

// Prose with the markup gone; a path or a URL on its own is not prose.
const prose = (s: string) =>
  /^\s*(?:https?:\/\/|\/)\S*\s*$/.test(s) ? "" : s
    .replace(/^---\n[\s\S]*?\n---\n/, "").replace(/```[\s\S]*?```/g, "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^(?:import|export) .*$/gm, "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "")
    .replace(/https?:\/\/\S+/g, "").replace(/[*_~`#>|]/g, "");
const chars = (s: Side) => (typeof s === "string" ? [...s.replace(/\s/g, "")].length : null);

// Files and routes: the twin carries the language it adds, the bare one is the other.
const TWIN = /^(.*?)([./])(en|ko)\2(page\.tsx|[^./]+)$/;
const ROUTE = /^web\/src\/app\/([^/]+)\/.*page\.tsx$/;
// The journal is written post by post in Korean (x.mdx) and English (x.en.mdx):
// a post with one side is missing the other.
const PAIRED_FOLDERS = ["web/content/journal/"];
const routeTwins = new Map<string, string>(); // a route folder → the language its twins add
const twinned = new Set<string>();
for (const f of tracked) {
  const m = TWIN.exec(f);
  if (!m || (m[2] === "/" && m[4] !== "page.tsx")) continue;
  const bare = `${m[1]}${m[2] === "/" ? "/" : "."}${m[4]}`;
  const route = m[2] === "/";
  const [en, ko] = m[3] === "ko" ? [bare, f] : [f, bare];
  const text = (p: string) => (!files.has(p) ? null : route ? undefined : prose(read(p)));
  pairs.push({ kind: route ? "route" : "file", en, ko, enText: text(en), koText: text(ko) });
  twinned.add(bare);
  if (route) routeTwins.set(ROUTE.exec(f)?.[1] ?? "", m[3]);
}
for (const f of tracked) {
  if (twinned.has(f) || TWIN.test(f)) continue;
  const top = ROUTE.exec(f)?.[1];
  if (PAIRED_FOLDERS.some((d) => f.startsWith(d)) && /\.mdx?$/.test(f)) pairs.push({ kind: "file", en: f.replace(/(\.mdx?)$/, ".en$1"), ko: f, enText: null, koText: prose(read(f)) });
  else if (top && routeTwins.has(top) && !/\/(en|ko)\//.test(f)) {
    const twin = f.replace(/page\.tsx$/, `${routeTwins.get(top)}/page.tsx`);
    pairs.push(routeTwins.get(top) === "ko"
      ? { kind: "route", en: f, ko: twin, enText: undefined, koText: null }
      : { kind: "route", en: twin, ko: f, enText: null, koText: undefined });
  }
}

// Code: an object with `en` and `ko` (walked side by side when both are
// objects), and a field beside its `Ko` or `En` twin (bare English beside Ko,
// bare Korean beside En). A list where some items have the twin and some
// do not has a missing side.
const unwrap = (e: ts.Expression): ts.Expression =>
  ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e) ? unwrap(e.expression) : e;
const nameOf = (n: ts.PropertyName) => (ts.isIdentifier(n) || ts.isStringLiteral(n) ? n.text : null);
function propsOf(o: ts.ObjectLiteralExpression): Map<string, ts.Node> {
  const out = new Map<string, ts.Node>();
  for (const p of o.properties) {
    const n = p.name && nameOf(p.name);
    if (!n) continue;
    out.set(n, ts.isPropertyAssignment(p) ? unwrap(p.initializer) : ts.isShorthandPropertyAssignment(p) ? p.name : p);
  }
  return out;
}
// The strings in a value: a literal, a template's fixed parts, literals joined
// with +, or every literal in a function.
function textOf(n: ts.Node | undefined): Side {
  if (!n) return null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return prose(n.text);
  if (ts.isTemplateExpression(n)) return prose([n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(""));
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const [l, r] = [textOf(unwrap(n.left)), textOf(unwrap(n.right))];
    return l === undefined && r === undefined ? undefined : (l ?? "") + (r ?? "");
  }
  if (!ts.isFunctionLike(n)) return undefined;
  const parts: string[] = [];
  const walk = (c: ts.Node): void => {
    if (ts.isStringLiteral(c) || ts.isNoSubstitutionTemplateLiteral(c) || ts.isTemplateLiteralToken(c)) parts.push(c.text);
    ts.forEachChild(c, walk);
  };
  walk(n);
  return prose(parts.join(" "));
}

function codePairs(f: string) {
  const sf = ts.createSourceFile(f, read(f), ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const consts = new Map<string, ts.Expression>();
  for (const s of sf.statements)
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) consts.set(d.name.text, d.initializer);
  const deref = (n: ts.Node | undefined) => {
    const e = n && ts.isIdentifier(n) ? (consts.get(n.text) ?? n) : n;
    return e && ts.isExpression(e) ? unwrap(e) : e;
  };
  const push = (kind: string, en: string, ko: string, enText: Side, koText: Side) => {
    if (enText === undefined && koText === undefined) return;
    if (!chars(enText) && !chars(koText)) return; // a path, a URL or an empty string on both sides
    pairs.push({ kind, en: `${f}#${en}`, ko: `${f}#${ko}`, enText, koText });
  };

  function sideBySide(base: string, rest: string, en: ts.Node | undefined, ko: ts.Node | undefined) {
    const [a, b] = [deref(en), deref(ko)];
    if (a && b && ts.isObjectLiteralExpression(a) && ts.isObjectLiteralExpression(b)) {
      const [pa, pb] = [propsOf(a), propsOf(b)];
      for (const k of new Set([...pa.keys(), ...pb.keys()])) sideBySide(base, `${rest}.${k}`, pa.get(k), pb.get(k));
    } else if (a && b && ts.isArrayLiteralExpression(a) && ts.isArrayLiteralExpression(b)) {
      for (let i = 0; i < Math.max(a.elements.length, b.elements.length); i++)
        sideBySide(base, `${rest}[${i}]`, a.elements[i], b.elements[i]);
    } else push("copy", `${base}.en${rest}`, `${base}.ko${rest}`, textOf(a), textOf(b));
  }

  function fields(at: string, props: Map<string, ts.Node>, twins: Set<string>) {
    for (const k of twins) {
      const [bare, lang] = [k.slice(0, -2), k.slice(-2)];
      if (!props.has(bare) && !props.has(k)) continue;
      const [en, ko] = lang === "Ko" ? [bare, k] : [k, bare];
      push("field", `${at}.${en}`, `${at}.${ko}`, textOf(props.get(en)), textOf(props.get(ko)));
    }
  }
  const twinsIn = (props: Map<string, ts.Node>) =>
    [...props.keys()].filter((k) => /[a-z](Ko|En)$/.test(k) && props.has(k.slice(0, -2)));

  function visit(n: ts.Node, at: string): void {
    if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name && ts.isIdentifier(n.name)) {
      const here = at ? `${at}.${n.name.text}` : n.name.text;
      ts.forEachChild(n, (c) => visit(c, here));
    } else if (ts.isObjectLiteralExpression(n)) {
      const props = propsOf(n);
      const paired = props.has("en") && props.has("ko");
      if (paired) sideBySide(at, "", props.get("en"), props.get("ko"));
      if (!ts.isArrayLiteralExpression(n.parent)) fields(at, props, new Set(twinsIn(props)));
      for (const [k, v] of props) if (!(paired && (k === "en" || k === "ko"))) visit(v, `${at}.${k}`);
    } else if (ts.isArrayLiteralExpression(n)) {
      const items = n.elements.map((e) => (ts.isObjectLiteralExpression(unwrap(e)) ? propsOf(unwrap(e) as ts.ObjectLiteralExpression) : null));
      const twins = new Set(items.flatMap((p) => (p ? twinsIn(p) : [])));
      n.elements.forEach((e, i) => {
        const id = items[i]?.get("id");
        const here = `${at}[${id && ts.isStringLiteral(id) ? id.text : i}]`;
        if (items[i]) fields(here, items[i]!, twins);
        visit(e, here);
      });
    } else ts.forEachChild(n, (c) => visit(c, at));
  }
  visit(sf, "");
}
for (const f of tracked) if (/^web\/src\/.*\.tsx?$/.test(f) && !/\.(test|d)\.tsx?$/.test(f)) codePairs(f);

// Korean says in one syllable what English says in about two and a half
// letters: over the journal's 37 pairs (2026-10-14) a Hangul syllable stands
// for 2.4 English characters, the other characters for one. Sides are compared
// at that size. A side under two thirds of the other is short; a line whose
// longer side is under a sentence (SENTENCE) is a label or a title, and the
// comparison means nothing there. The same sentence on both sides is a
// translation not made yet; the same short value is an id, a file name or a
// brand, not a translation, and is left out.
const HANGUL = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7a3]/;
const PER_SYLLABLE = 2.4;
const SENTENCE = 40;
const size = (s: string) => {
  const hangul = [...s].filter((c) => HANGUL.test(c)).length;
  return (chars(s) ?? 0) - hangul + PER_SYLLABLE * hangul;
};
function state(p: Pair): string | null {
  if (p.enText === null) return "missing-en";
  if (p.koText === null) return "missing-ko";
  if (p.enText === undefined || p.koText === undefined) return "ok";
  const [en, ko] = [size(p.enText), size(p.koText)];
  if (p.enText.trim() === p.koText.trim())
    return Math.max(en, ko) < SENTENCE || !/\s/.test(p.enText.trim()) ? null : HANGUL.test(p.enText) ? "missing-en" : "missing-ko";
  if (Math.max(en, ko) < SENTENCE) return "ok";
  if (ko < (2 / 3) * en) return "ko-short";
  if (en < (2 / 3) * ko) return "en-short";
  return "ok";
}
const pkey = (p: Pair) => [p.kind, p.en, p.ko].join("\0");
const listed = [...new Map(pairs.map((p) => [pkey(p), p])).values()].sort((a, b) => (pkey(a) < pkey(b) ? -1 : pkey(a) > pkey(b) ? 1 : 0));
const num = (n: number | null) => (n === null ? "" : String(n));
const parity = listed.flatMap((p) => {
  const s = state(p);
  return s ? [{ ...p, state: s }] : [];
});
fs.writeFileSync(
  path.join(ROOT, PARITY),
  ["kind,en,ko,en_chars,ko_chars,state", ...parity.map((p) => [p.kind, p.en, p.ko, num(chars(p.enText)), num(chars(p.koText)), p.state].map(cell).join(","))].join("\n") + "\n",
);
const tally = new Map<string, number>();
for (const p of parity) tally.set(p.state, (tally.get(p.state) ?? 0) + 1);
console.log(`${parity.length} Korean/English pairs → ${PARITY}`);
console.log([...tally].sort().map(([s, n]) => `${n} ${s}`).join(", "));
