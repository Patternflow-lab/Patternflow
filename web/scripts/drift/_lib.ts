/**
 * What the drift checks share. A check is a file beside this one: it reads
 * two lists the tree keeps by hand, gives them to compare(), and ends with
 * done(). scripts/drift.ts runs them (docs/rfc-cleanup.md §2.4).
 *
 * compare() prints both sides and what is on one side only, so a red run in
 * CI says what drifted without anyone checking the branch out. A side a check
 * cannot read where it runs (a tag the clone lacks, no gh login, no pdftotext)
 * goes to skip(), which says why and passes. Under PF_DRIFT_STRICT=1, which
 * the CI workflow sets, a skip fails.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();

/** How a check that skipped and found no drift exits. scripts/drift.ts reads it. */
export const SKIPPED = 75;

let files: string[] | undefined;
/** Tracked files, relative to the repository root, all of them or those under one folder. */
export function tracked(under = ""): string[] {
  files ??= execFileSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 })
    .split("\0")
    .filter(Boolean);
  return files.filter((f) => f.startsWith(under));
}

export const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

export type Side = { label: string; items: Iterable<string> };

let failed = 0;
let skipped = 0;

const counts = (items: Iterable<string>) => {
  const out = new Map<string, number>();
  for (const x of items) out.set(x, (out.get(x) ?? 0) + 1);
  return out;
};
// What a has more times than b: an item listed twice against once is on one side once.
const extra = (a: Map<string, number>, b: Map<string, number>) =>
  [...a].flatMap(([x, n]) => Array<string>(Math.max(0, n - (b.get(x) ?? 0))).fill(x)).sort();
const list = (xs: string[]) => (xs.length ? xs.join(", ") : "(none)");

/** Prints both sides and what is on one side only. True when the two hold the same items. */
export function compare(name: string, left: Side, right: Side): boolean {
  const [l, r] = [counts(left.items), counts(right.items)];
  const [onlyLeft, onlyRight] = [extra(l, r), extra(r, l)];
  const all = (m: Map<string, number>) => [...m].flatMap(([x, n]) => Array<string>(n).fill(x)).sort();
  const ok = !onlyLeft.length && !onlyRight.length;
  console.log(`${name}: ${ok ? "same" : "drift"}`);
  console.log(`  ${left.label} (${all(l).length}): ${list(all(l))}`);
  console.log(`  ${right.label} (${all(r).length}): ${list(all(r))}`);
  if (onlyLeft.length) console.log(`  only in ${left.label}: ${list(onlyLeft)}`);
  if (onlyRight.length) console.log(`  only in ${right.label}: ${list(onlyRight)}`);
  if (!ok) failed++;
  return ok;
}

/** A side this check cannot read here. Says why; passes, or fails under PF_DRIFT_STRICT=1. */
export function skip(name: string, why: string): void {
  console.log(`${name}: skipped, ${why}`);
  skipped++;
}

/** The check's result as its exit code: 1 on drift or a strict skip, SKIPPED on a skip, 0 otherwise. */
export function done(): void {
  const strict = process.env.PF_DRIFT_STRICT === "1";
  if (!failed && skipped && strict) console.log("PF_DRIFT_STRICT=1, so a skip fails");
  process.exitCode = failed || (skipped && strict) ? 1 : skipped ? SKIPPED : 0;
}
