// jsdom applies none of the CSS modules, so the rules are read from the files.
// The global `.panel-body p` (app/globals.css) is (0,1,1): 20px, 17px under
// 900px, and a 28px bottom margin. A paragraph styled by one module class loses
// to it. On 24 October, at 1440, the Pattern tab's advanced note and both To
// hardware notes were 20px instead of 14px under an 18px title, the To hardware
// block ran 572px, and the Build tab's other-paths line was 20px instead of 15px.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(path.resolve(__dirname, name), "utf8");

/** Every selector in the file, comma lists split, comments dropped. */
function selectors(css: string): string[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  for (const m of bare.matchAll(/([^{}]+)\{/g)) {
    for (const s of m[1].split(",")) found.push(s.trim().replace(/\s+/g, " "));
  }
  return found;
}

// Each one renders inside a `.panel-body`.
const panels = [
  "PatternPanel",
  "BuildPanel",
  "InsidePanel",
  "CasePicker",
  "InsideGlobe/BuildCard",
];

describe("paragraphs styled by a module class under .panel-body", () => {
  for (const panel of panels) {
    const tsx = read(`${panel}.tsx`);
    const rules = selectors(read(`${panel}.module.css`));
    const names = [...new Set([...tsx.matchAll(/<p className=\{styles\.(\w+)\}/g)].map((m) => m[1]))];

    for (const name of names) {
      it(`${panel} .${name} is scoped through a second class`, () => {
        expect(rules, `a bare .${name} loses to .panel-body p`).not.toContain(`.${name}`);
        const scoped = rules.find((s) => new RegExp(`^\\.(\\w+) \\.${name}$`).test(s));
        expect(scoped, `no ".scope .${name}" rule`).toBeDefined();
        const scope = scoped!.split(" ")[0].slice(1);
        expect(tsx, `.${scope} is not on an element in ${panel}.tsx`).toContain(`styles.${scope}`);
      });
    }
  }

  it("finds the four notes this guards", () => {
    const all = panels.flatMap((panel) =>
      [...read(`${panel}.tsx`).matchAll(/<p className=\{styles\.(\w+)\}/g)].map((m) => m[1]),
    );
    expect(all).toEqual(expect.arrayContaining(["advancedNote", "hardwareNote", "otherPaths"]));
    expect(all.filter((n) => n === "hardwareNote")).toHaveLength(2);
  });
});
