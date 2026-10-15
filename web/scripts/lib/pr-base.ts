/**
 * The commit a pull request starts from, and the files it changes since, for
 * scripts/human-lock.ts and scripts/voice-lint.ts. PF_LOCK_BASE names it (CI
 * passes the pull request's base SHA); at a desk it is the merge-base with
 * origin/dev, then origin/main. With none of the three, the check skips
 * (docs/investigations/2026-10-cleanup-step2-plan.md, D5).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
export const git = (args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const attempt = <T>(f: () => T, fallback: T): T => {
  try { return f(); } catch { return fallback; }
};
const commit = (ref: string) => attempt(() => git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).trim(), "");

export type Base = { sha: string; from: string } | { sha: null; why: string; fatal: boolean };

/** The base and where it came from, or why there is none: fatal when PF_LOCK_BASE names a commit this clone lacks. */
export function findBase(): Base {
  const named = process.env.PF_LOCK_BASE?.trim();
  if (named && !commit(named)) return { sha: null, why: `PF_LOCK_BASE is ${named}, and this clone has no such commit (check out with fetch-depth: 0)`, fatal: true };
  if (named) return { sha: commit(named), from: "PF_LOCK_BASE" };
  for (const ref of ["origin/dev", "origin/main"]) {
    const sha = commit(ref) && attempt(() => git(["merge-base", "HEAD", ref]).trim(), "");
    if (sha) return { sha, from: `the merge-base with ${ref}` };
  }
  return { sha: null, why: "no PF_LOCK_BASE, and no merge-base with origin/dev or origin/main", fatal: false };
}

export type Change = { path: string; status: "added" | "modified" | "deleted" };

/** What the working tree changes since base, untracked files included. A move is a deletion and an addition. */
export function changedSince(base: string): Change[] {
  const out = new Map<string, Change["status"]>();
  const fields = git(["diff", "--name-status", "--no-renames", "-z", base]).split("\0").filter(Boolean);
  for (let i = 0; i + 1 < fields.length; i += 2) out.set(fields[i + 1], fields[i] === "A" ? "added" : fields[i] === "D" ? "deleted" : "modified");
  for (const f of git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean)) out.set(f, "added");
  return [...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([p, status]) => ({ path: p, status }));
}

/** A file as it was at a commit, or as it is in the working tree; null if it is not there. */
export const readAt = (ref: string, file: string) => attempt<string | null>(() => git(["cat-file", "-p", `${ref}:${file}`]), null);
export const readNow = (file: string) => attempt<string | null>(() => fs.readFileSync(path.join(ROOT, file), "utf8"), null);
