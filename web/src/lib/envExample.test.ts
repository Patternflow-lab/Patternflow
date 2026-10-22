import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// web/.env.example is the list of what a deployment can set, and
// ARCHITECTURE.md and docs/SERVICES.md send people to it as the whole list.
// For two months after the worker stopped building firmware images it still
// offered ARDUINO_CLI_PATH and BUILD_FQBN, which nothing read, and left out
// PF_XTENSA_BIN, which the Pi's worker cannot compile without.

/** web/: this file is web/src/lib/. */
const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Read by the code but not set by a deployment: Node's own, the Arduino and
// PlatformIO installs the compiler search walks (builderRev.ts), the one
// next.config.ts sets at build time, and the check scripts' switches.
const NOT_DEPLOYMENT = new Set([
  "NODE_ENV",
  "INIT_CWD",
  "ARDUINO_DIRECTORIES_DATA",
  "LOCALAPPDATA",
  "PLATFORMIO_CORE_DIR",
  "PATTERN_SANDBOX_VERSION",
  "PF_DRIFT_STRICT",
  "PF_LOCK_BASE",
]);

// Listed, and read by a library rather than by this code: Better Auth takes
// its base URL from the environment itself.
const READ_BY_LIBRARY = new Set(["BETTER_AUTH_URL"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    if (!/\.(ts|tsx|mjs)$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

/** Every name the site, the worker and the scripts read as `process.env.NAME`. */
function namesTheCodeReads(): Set<string> {
  const files = [
    ...sourceFiles(path.join(WEB, "src")),
    ...sourceFiles(path.join(WEB, "scripts")),
    path.join(WEB, "next.config.ts"),
    path.join(WEB, "drizzle.config.ts"),
  ];
  const names = new Set<string>();
  for (const file of files) {
    for (const match of readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

/** `NAME=` and `#NAME=` lines: set, or offered commented out. */
function namesTheExampleLists(): string[] {
  const text = readFileSync(path.join(WEB, ".env.example"), "utf8");
  return [...text.matchAll(/^#?([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
}

/** The backticked names in ARCHITECTURE.md's "Environment variables" table. */
function namesTheArchitectureTableLists(): string[] {
  const text = readFileSync(path.join(WEB, "ARCHITECTURE.md"), "utf8");
  const section = text.split("## Environment variables")[1]?.split(/\n## /)[0] ?? "";
  const rows = section.split("\n").filter((line) => line.startsWith("|") && !line.includes(":---"));
  return rows.slice(1).flatMap((row) => [...row.split("|")[2].matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((m) => m[1]));
}

describe("web/.env.example", () => {
  it("lists every variable the code reads", () => {
    const listed = new Set(namesTheExampleLists());
    const missing = [...namesTheCodeReads()].filter((name) => !NOT_DEPLOYMENT.has(name) && !listed.has(name));
    expect(missing).toEqual([]);
  });

  it("lists nothing the code has stopped reading", () => {
    const read = namesTheCodeReads();
    const unread = namesTheExampleLists().filter((name) => !read.has(name) && !READ_BY_LIBRARY.has(name));
    expect(unread).toEqual([]);
  });

  it("lists each variable once", () => {
    const names = namesTheExampleLists();
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });

  it("names the same variables as the table in ARCHITECTURE.md", () => {
    const table = namesTheArchitectureTableLists();
    expect(table.length).toBeGreaterThan(0);
    expect([...table].sort()).toEqual([...namesTheExampleLists()].sort());
  });
});
