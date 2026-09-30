import { describe, expect, it } from "vitest";
import { PAGES, pagePath, scriptMismatches } from "./pages";
import { scenesOf } from "./scenes";
import type { GuidePageId } from "./store";

// The guide's two pages: every chapter's words and its script line up, in
// both languages, and the chapters number on from one page to the next.

const pages = Object.keys(PAGES) as GuidePageId[];

describe("guide pages", () => {
  it.each(pages)("%s: copy and script agree", (page) => {
    expect(scriptMismatches(page)).toEqual([]);
  });

  it("numbers its chapters 01.. across both pages, in order", () => {
    for (const lang of ["en", "ko"] as const) {
      const nums = [...PAGES.start.text(lang).chapters, ...PAGES.make.text(lang).chapters].map((c) => c.copy.num);
      expect(nums).toEqual(["01", "02", "03", "04", "05", "06"]);
    }
  });

  it("opens every page on a powered board; the make page's with the Basics deck on it, running", () => {
    for (const page of pages) {
      const opening = scenesOf(page).find((s) => s.id === "opening");
      expect(opening?.steps[0].power).toBe(true);
    }
    const make = scenesOf("make");
    expect(make[0]).toMatchObject({ id: "opening" });
    expect(make[0].steps[0]).toMatchObject({ power: true, pack: "basics", mode: "run" });
  });

  it("keeps the Lab's first step as fixed", () => {
    const lab = scenesOf("make").find((s) => s.id === "lab");
    expect(lab?.steps[0]).toMatchObject({ view: "labSide", power: true, pack: "basics", mode: "run", mirror: true });
    expect(PAGES.make.text("en").chapters[1].copy.steps[0]).toMatchObject({ kicker: "Pattern Lab", title: "Open the Lab.", extra: "labWindow" });
    expect(PAGES.make.text("ko").chapters[1].copy.steps[0]).toMatchObject({ title: "랩을 열어요.", extra: "labWindow" });
  });

  it("gives each page an address per language", () => {
    expect(pagePath("start", "en")).toBe("/guide");
    expect(pagePath("start", "ko")).toBe("/guide/ko");
    expect(pagePath("make", "en")).toBe("/guide/make");
    expect(pagePath("make", "ko")).toBe("/guide/make/ko");
  });
});
