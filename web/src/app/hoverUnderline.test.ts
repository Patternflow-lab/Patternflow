import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// globals.css underlines every link on hover with `a:hover`, which is (0,1,1).
// A CSS module class that says `text-decoration: none` is (0,1,0) and loses
// to it, so a link drawn as a button or a card grew an underline when pointed
// at: 453 links on 16 pages in Chromium on 21 October, and the guide's
// "Stuck? Tell us" drew one under the line it already draws. Each such class
// says it again in a `:hover` rule. Community (31 classes), editions and
// compliance still lose. They are left out below until they are done the
// same way.

const SRC = path.resolve(__dirname, '..');
const LEFT_OUT = ['components/community', 'app/community', 'app/editions', 'app/compliance', 'app/journal'];

function modules(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return modules(full);
    return entry.name.endsWith('.module.css') ? [full] : [];
  });
}

interface Rule {
  selectors: string[];
  body: string;
}

/** Every rule with no braces inside it; an @media block's rules come out on their own. */
function rules(css: string): Rule[] {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1].split(',').map((s) => s.trim()),
    body: m[2],
  }));
}

const NO_LINE = /text-decoration(-line)?:\s*none/;

/** Classes that turn the line off on their own, with no :hover rule saying anything about it. */
function losing(css: string): string[] {
  const all = rules(css);
  const off = new Set(
    all.flatMap((r) => (NO_LINE.test(r.body) ? r.selectors.filter((s) => /^\.[\w-]+$/.test(s)) : [])),
  );
  return [...off].filter((cls) => {
    const own = all.filter((r) => r.selectors.includes(cls));
    // A class that takes no pointer is never hovered (update's .goDisabled).
    if (own.some((r) => /pointer-events:\s*none/.test(r.body))) return false;
    return !all.some((r) => r.selectors.includes(`${cls}:hover`) && /text-decoration/.test(r.body));
  });
}

describe('hover underline', () => {
  it('is still the global rule the classes have to beat', () => {
    const globals = fs.readFileSync(path.join(SRC, 'app/globals.css'), 'utf8');
    expect(globals).toMatch(/\n\s*a:hover \{ text-decoration: underline;/);
  });

  it('stays off on hover for every class that turns it off', () => {
    const files = modules(SRC).filter((f) => !LEFT_OUT.some((dir) => f.includes(`${path.sep}${dir}${path.sep}`)));
    const found = files.flatMap((f) =>
      losing(fs.readFileSync(f, 'utf8')).map((cls) => `${path.relative(SRC, f)} ${cls}`),
    );
    expect(found).toEqual([]);
  });

  it('finds the class the rule was written for', () => {
    expect(losing('.card { text-decoration: none; }\n.card:hover { color: red; }')).toEqual(['.card']);
    expect(losing('.card { text-decoration: none; }\n.card:hover { text-decoration: none; }')).toEqual([]);
    expect(losing('@media (x) {\n  .card { text-decoration: none; }\n}')).toEqual(['.card']);
    expect(losing('.row a { text-decoration: none; }')).toEqual([]);
  });
});
