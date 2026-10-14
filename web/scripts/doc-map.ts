/**
 * The doc map: every link into this repository, and whether it lands.
 * `npm run doc-map` in web/ writes docs/investigations/2026-10-doc-map.csv.
 *
 * Moving a file breaks the links that point at it, and only one kind of link
 * is watched: the relative ones in Markdown (.github/scripts/check_links.py).
 * The site points at the guides by absolute GitHub URL. The console pages the
 * device serves point at docs and at the site. The redirect table sends old
 * URLs to new ones. None of those fail a build when the file they name moves,
 * so the cleanup (docs/rfc-cleanup.md §2.2) maps them before it moves anything.
 *
 * Sources are the tracked .md, .mdx, .ts, .tsx and .h files, the console
 * pages, and the redirect table in next.config.ts. Vendored upstream code is
 * skipped, as check_links.py skips it, and so are the *_index.h headers,
 * which are the console pages again. Kinds:
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
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const OUT = "docs/investigations/2026-10-doc-map.csv";
const CONSOLE = "firmware/patternflow/console/";
const REDIRECTS = "web/next.config.ts";
const SKIP = /(^|\/)(hub75|webserver|pubsubclient)\//;

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

type Row = { from: string; to: string; kind: string; anchor: string; resolves: "yes" | "no" };

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
    return row(ref === "main" ? p : `${ref}:${p}`, kind, ok);
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
  (f.endsWith(".h") && !f.endsWith("_index.h")) || (f.startsWith(CONSOLE) && f.endsWith(".html"))));
const key = (r: Row) => [r.from, r.to, r.anchor, r.kind].join("\0");
const rows = new Map<string, Row>();
for (const f of sources) for (const r of linksIn(f)) rows.set(key(r), r);

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
// Code-point order, not the locale's, so the file is the same on every machine.
const sorted = [...rows.values()].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
const csv = ["from,to,kind,anchor,resolves", ...sorted.map((r) => [r.from, r.to, r.kind, r.anchor, r.resolves].map(cell).join(","))];
fs.writeFileSync(path.join(ROOT, OUT), csv.join("\n") + "\n");

const broken = sorted.filter((r) => r.resolves === "no");
console.log(`${sorted.length} links from ${new Set(sorted.map((r) => r.from)).size} files → ${OUT}`);
console.log(`${broken.length} do not resolve`);
for (const r of broken) console.log(`  ${r.from} → ${r.to}${r.anchor ? "#" + r.anchor : ""} (${r.kind})`);
