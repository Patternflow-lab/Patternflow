import { describe, expect, it } from "vitest";
import { GUIDE_ORDER, HUB_PATH, PAGES, pagePath } from "./pages";
import { scriptMismatches } from "./checks";
import { scenesOf, type Step } from "./scenes";
import { HUB_COPY } from "./copy/hub";
import { LEGACY_GUIDE_REDIRECT, legacyGuideTarget } from "./legacy";
import type { GuidePageId } from "./store";

// The guide: a hub and four guides. Every chapter's words and its script
// line up, in both languages; each guide numbers its own chapters from 01 —
// but Audio, whose sections are in no order and carry no number; and the
// Play guide's old addresses under /guide still land on it.

const pages = Object.keys(PAGES) as GuidePageId[];

describe("guide pages", () => {
  it.each(pages)("%s: copy and script agree", (page) => {
    expect(scriptMismatches(page)).toEqual([]);
  });

  it("numbers each guide's chapters from 01, in order", () => {
    for (const page of pages.filter((p) => p !== "audio")) {
      for (const lang of ["en", "ko"] as const) {
        const nums = PAGES[page].text(lang).chapters.map((c) => c.copy.num);
        expect(nums).toEqual(nums.map((_, i) => String(i + 1).padStart(2, "0")));
      }
    }
    expect(PAGES.play.text("en").chapters.map((c) => `${c.copy.num} ${c.label}`)).toEqual(["01 Flash", "02 Knobs", "03 Patterns", "04 Console"]);
    expect(PAGES.make.text("en").chapters.map((c) => `${c.copy.num} ${c.label}`)).toEqual(["01 Community", "02 Pattern Lab"]);
  });

  it("gives Audio's chapters no number: the edition first, then three sections in no order", () => {
    for (const lang of ["en", "ko"] as const) {
      const { opening, chapters } = PAGES.audio.text(lang);
      expect(chapters.map((c) => c.id)).toEqual(["edition", "browser", "mic", "midi"]);
      expect(chapters.map((c) => c.copy.num)).toEqual([undefined, undefined, undefined, undefined]);
      expect(chapters.map((c) => c.first ?? false)).toEqual([true, false, false, false]);
      expect(chapters.map((c) => c.copy.steps.length)).toEqual([3, 4, 7, 5]);
      // Each section opens cold: it says what it needs, and where that is.
      expect(chapters.map((c) => c.copy.needs?.href)).toEqual([undefined, "#edition", "#edition", "#edition"]);
      expect(opening.groups?.first).toBeTruthy();
      expect(opening.groups?.rest).toBeTruthy();
    }
    expect(PAGES.audio.text("en").chapters.map((c) => c.label)).toEqual(["The Audio edition", "A browser tab", "The microphone", "MIDI & your DAW"]);
  });

  it("puts one thing on each Audio card: the editor once, and every set of captures once", () => {
    const extras = PAGES.audio.text("en").chapters.flatMap((c) => c.copy.steps.map((s, i) => [`${c.id}-${i + 1}`, s.extra] as const).filter(([, extra]) => extra));
    expect(Object.fromEntries(extras)).toEqual({
      "edition-2": "editionsLink",
      "browser-2": "audioShots:popup",
      "browser-3": "audioShots:popupStates",
      "browser-4": "editorLive",
      "mic-1": "audioShots:micPart",
      "mic-3": "audioShots:micWiring",
      "mic-4": "audioShots:micSeated",
      "mic-5": "audioShots:audioIn",
      "mic-6": "audioShots:audioInMap",
      "mic-7": "audioShots:audioInNoMic",
      "midi-1": "audioShots:rtpmidi",
      "midi-2": "audioShots:liveRemote",
      "midi-4": "audioShots:midiPage",
      "midi-5": "audioShots:midiSession",
    });
    // The editor's card is the one the lanes are open on (scenes/audio.ts).
    const scene = scenesOf("audio").find((s) => s.id === "browser");
    expect((scene?.steps[3] as Step).lanes).toBe("editor");
  });

  it("runs the Audio edition only where a step says so, and the lanes on one step", () => {
    const steps = (page: "audio" | "play" | "build" | "hub") => scenesOf(page).flatMap((s) => s.steps.map((step, i) => ({ at: `${s.id}-${i + 1}`, step: step as Step })));
    for (const page of ["play", "build", "hub"] as const) {
      for (const { step } of steps(page)) {
        expect(step.edition).toBeUndefined();
        expect(step.lanes).toBeUndefined();
      }
    }
    expect(steps("audio").filter(({ step }) => step.lanes).map(({ at }) => at)).toEqual(["browser-4"]);
    // Nothing is installed on this guide: the pack never changes (stage/Fx.tsx flashes on Origin → Basics).
    for (const { step } of steps("audio")) expect(step.pack).toBe("origin");
  });

  it("orders the guides Build, Play, Make, Audio, and names each in both languages", () => {
    expect(GUIDE_ORDER).toEqual(["build", "play", "make", "audio"]);
    for (const page of GUIDE_ORDER) {
      for (const lang of ["en", "ko"] as const) {
        expect(PAGES[page].text(lang).name).toBeTruthy();
        expect(HUB_COPY[lang].guides[page].situation).toBeTruthy();
      }
    }
  });

  it("opens Play on a powered board, the Make page on its desk at rest", () => {
    const opening = scenesOf("play").find((s) => s.id === "opening");
    expect(opening?.steps[0]).toMatchObject({ power: true });
    const make = scenesOf("make");
    expect(make[0]).toMatchObject({ id: "opening" });
    expect(make[0].steps[0]).toMatchObject({ desk: { rest: true } });
  });

  it("gives every step of the Make page a desk, and none of the 3D pages'", () => {
    for (const scene of scenesOf("make")) for (const step of scene.steps) expect(step).toHaveProperty("desk.front");
    for (const page of ["play", "build", "audio", "hub"] as const) {
      for (const scene of scenesOf(page)) for (const step of scene.steps) expect(step).not.toHaveProperty("desk");
    }
  });

  it("plays Play's opening on the hub", () => {
    expect(scenesOf("hub")).toEqual([scenesOf("play")[0]]);
  });

  it("keeps the Lab's first step as fixed", () => {
    const lab = scenesOf("make").find((s) => s.id === "lab");
    expect(lab?.steps[0]).toMatchObject({ desk: { front: "lab" } });
    expect(PAGES.make.text("en").chapters[1].copy.steps[0]).toMatchObject({ kicker: "Pattern Lab", title: "Open the Lab.", extra: "labWindow" });
    expect(PAGES.make.text("ko").chapters[1].copy.steps[0]).toMatchObject({ title: "랩을 열어요.", extra: "labWindow" });
  });

  it("gives each page an address per language", () => {
    expect(pagePath("hub", "en")).toBe("/guide");
    expect(pagePath("hub", "ko")).toBe("/guide/ko");
    expect(HUB_PATH).toEqual({ en: "/guide", ko: "/guide/ko" });
    expect(pagePath("build", "en")).toBe("/guide/build");
    expect(pagePath("build", "ko")).toBe("/guide/build/ko");
    expect(pagePath("play", "en")).toBe("/guide/play");
    expect(pagePath("play", "ko")).toBe("/guide/play/ko");
    expect(pagePath("make", "en")).toBe("/guide/make");
    expect(pagePath("make", "ko")).toBe("/guide/make/ko");
    expect(pagePath("audio", "en")).toBe("/guide/audio");
    expect(pagePath("audio", "ko")).toBe("/guide/audio/ko");
  });

  it("links every guide's opening back to the hub", () => {
    for (const page of pages) for (const lang of ["en", "ko"] as const) expect(PAGES[page].text(lang).opening.back?.to).toBe("hub");
  });

  it("never offers a kit or an assembled board", () => {
    const words = JSON.stringify([HUB_COPY, ...pages.flatMap((p) => [PAGES[p].text("en"), PAGES[p].text("ko")])]);
    expect(words).not.toMatch(/\bkits?\b|pre-?assembled|assembled board|키트|완제품/i);
  });
});

describe("the Play guide's old addresses", () => {
  it("sends /guide's old anchors to /guide/play, in both languages", () => {
    expect(legacyGuideTarget("/guide", "", "#flash")).toBe("/guide/play#flash");
    expect(legacyGuideTarget("/guide", "", "#flash-3")).toBe("/guide/play#flash-3");
    expect(legacyGuideTarget("/guide/", "", "#knobs-7")).toBe("/guide/play#knobs-7");
    expect(legacyGuideTarget("/guide", "?x=1", "#console")).toBe("/guide/play?x=1#console");
    expect(legacyGuideTarget("/guide/ko", "", "#patterns-2")).toBe("/guide/play/ko#patterns-2");
    expect(legacyGuideTarget("/guide", "", "#next")).toBe("/guide/play#next");
  });

  it("covers every chapter and step anchor Play has", () => {
    const play = PAGES.play.text("en");
    for (const c of play.chapters) {
      expect(legacyGuideTarget("/guide", "", `#${c.id}`)).toBe(`/guide/play#${c.id}`);
      c.copy.steps.forEach((_, i) => expect(legacyGuideTarget("/guide", "", `#${c.id}-${i + 1}`)).toBe(`/guide/play#${c.id}-${i + 1}`));
    }
  });

  it("leaves everything else on the hub, and other pages alone", () => {
    expect(legacyGuideTarget("/guide", "", "")).toBeNull();
    expect(legacyGuideTarget("/guide", "", "#top")).toBeNull();
    expect(legacyGuideTarget("/guide", "", "#community")).toBeNull();
    expect(legacyGuideTarget("/guide", "", "#flashy")).toBeNull();
    expect(legacyGuideTarget("/guide/play", "", "#flash")).toBeNull();
    expect(legacyGuideTarget("/guide/make", "", "#lab-2")).toBeNull();
    expect(legacyGuideTarget("/", "", "#flash")).toBeNull();
  });

  it("does the same as the root layout's inline script", () => {
    const cases: [string, string, string][] = [
      ["/guide", "", "#flash-3"],
      ["/guide/ko", "?a=b", "#console"],
      ["/guide", "", "#top"],
      ["/guide/play", "", "#flash"],
      ["/", "", "#knobs"],
    ];
    for (const [pathname, search, hash] of cases) {
      let replaced: string | null = null;
      const style: Record<string, string> = {};
      const location = { pathname, search, hash, replace: (to: string) => (replaced = to) };
      const document = { documentElement: { style } };
      new Function("location", "document", LEGACY_GUIDE_REDIRECT)(location, document);
      expect(replaced).toBe(legacyGuideTarget(pathname, search, hash));
      expect(style.visibility).toBe(replaced ? "hidden" : undefined);
    }
  });
});
