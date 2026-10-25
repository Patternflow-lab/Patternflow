// What the CSS module tests read. jsdom applies none of the modules, so a
// test reads the stylesheet and the files that import it.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/** `web/src/`. */
export const src = path.resolve(__dirname, "../src");

const files = readdirSync(src, { recursive: true }) as string[];

/** Every `*.module.css` under `src/`. */
export const cssModules = files.filter((file) => file.endsWith(".module.css")).map((file) => path.join(src, file));

/** Every `.tsx` and `.ts` under `src/`, tests left out. */
const sources = files
  .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
  .map((file) => path.join(src, file))
  .map((file) => ({ file, text: readFileSync(file, "utf8") }));

/** A stylesheet with its comments and quoted strings taken out. */
export const bareCss = (file: string) =>
  readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"]*"|'[^']*'/g, "");

/** Each class of the module at `file` that a file importing it reads as
 *  `styles.name` or `styles["name"]`, with the files that read it. Null when
 *  one of them reads the module by a computed name. */
export function readers(file: string): Map<string, Set<string>> | null {
  const read = new Map<string, Set<string>>();
  for (const { file: from, text } of sources) {
    for (const [, local, spec] of text.matchAll(/import (\w+) from ["']([^"']+\.module\.css)["']/g)) {
      const target = spec.startsWith("@/") ? path.join(src, spec.slice(2)) : path.resolve(path.dirname(from), spec);
      if (target !== file) continue;
      if (new RegExp(`\\b${local}\\[(?!["'\`])`).test(text)) return null;
      for (const m of text.matchAll(new RegExp(`\\b${local}(?:\\.(\\w+)|\\[["'\`]([\\w-]+)["'\`]\\])`, "g"))) {
        const name = m[1] ?? m[2];
        read.set(name, (read.get(name) ?? new Set<string>()).add(from));
      }
    }
  }
  return read;
}
