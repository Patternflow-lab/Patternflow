// Until 24 October 2026 the Lab's modules held 13 classes that no component
// put on an element, and 220 lines of rules for them. The test that came with
// that cleanup read the Lab alone, and until 25 October 2026 five modules
// outside it held 23 more: the roadmap's legend and zoom buttons, the
// community's sign-in gate, 241 lines with a keyframe and three variables
// nothing read.

import path from "node:path";
import { describe, expect, it } from "vitest";
import { bareCss, cssModules, readers, src } from "../test/cssModules";

describe("CSS modules", () => {
  // A class counts as used when a file importing its module reads
  // `styles.name` or `styles["name"]`, or a rule in the same file composes it.
  // A module read by a computed name counts as used whole. A class inside
  // `:global(…)` is the page's, not the module's.
  it("define no class that no component uses", () => {
    const unused: Record<string, string[]> = {};
    for (const file of cssModules) {
      const bare = bareCss(file).replace(/:global\([^)]*\)/g, "");
      const defined = new Set([...bare.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
      const used = new Set([...bare.matchAll(/composes:([^;]+);/g)].flatMap((m) => m[1].trim().split(/\s+/)));
      const read = readers(file);
      for (const cls of read?.keys() ?? []) used.add(cls);
      const dead = read === null ? [] : [...defined].filter((cls) => !used.has(cls)).sort();
      if (dead.length) unused[path.relative(src, file)] = dead;
    }
    expect(cssModules.length).toBeGreaterThan(40);
    expect(unused).toEqual({});
  });
});
