import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceSim } from "@/lib/guide/deviceSim";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";
import { knobIsTurned, turnBackNow, turnOn } from "../hubKnob";
import { GUIDE_ORDER, pagePath, placeAnchor, screenAt } from "../pages";
import { EXPLODE, EXPLODE_PARTS, explodeWanted, partAmount, partOffset } from "../stage/explodeParts";
import { getSim, useGuideStore, type GuideScreen } from "../store";
import { buildClock } from "../timing";
import { AWAY_SCALE, awayFraming, hubFraming } from "./framing";
import HubAnswers from "./HubAnswers";
import { DRAW_MS, MAKE_PATTERNS, RESTORE_MS, makeClock, makeIsDrawing, makeIsShown, makeNext, makeRestore } from "./hubMake";

// The guide is one world: one stage under the hub and the three guides. These
// are the rules that hold it together between two pages — which page the
// stage is playing, what the hub's answers do to the board and how they are
// put back, how the device is framed on each page, and how it comes apart.

const FRAME = 1 / 60;
const SCREENS: GuideScreen[] = ["hub", ...GUIDE_ORDER];

function freshStore() {
  buildClock.t = -1;
  useGuideStore.setState({
    page: "play",
    lang: "en",
    entered: false,
    preview: null,
    leaving: null,
    hubTop: 0,
    buildLive: false,
    cut: 0,
    scene: "opening",
    progress: 0,
    step: 0,
    cardIn: true,
    handsOn: false,
    flasher: null,
  });
}

describe("which page the stage plays", () => {
  beforeEach(freshStore);

  it("waits for a page to say which one it is", () => {
    expect(useGuideStore.getState().entered).toBe(false);
    useGuideStore.getState().enterPage("hub", "ko");
    expect(useGuideStore.getState()).toMatchObject({ entered: true, page: "hub", lang: "ko", scene: "opening", step: 0 });
  });

  it("starts another page's script from its top", () => {
    const s = useGuideStore.getState();
    s.enterPage("play", "en");
    s.setScroll("knobs", 0.4, 3);
    s.setHandsOn(true);
    s.enterPage("build", "en");
    expect(useGuideStore.getState()).toMatchObject({ page: "build", scene: "opening", step: 0, handsOn: false });
  });

  it("carries on where it is when the same page comes back in the other language", () => {
    const s = useGuideStore.getState();
    s.enterPage("play", "en");
    s.setScroll("knobs", 0.4, 3);
    s.leaveFor("play");
    s.enterPage("play", "ko");
    expect(useGuideStore.getState()).toMatchObject({ page: "play", lang: "ko", scene: "knobs", step: 3, leaving: null });
  });

  it("answers a guide only on the hub, and holds the chosen one's answer until the guide arrives", () => {
    const s = useGuideStore.getState();
    s.enterPage("play", "en");
    s.setPreview("build");
    expect(useGuideStore.getState().preview).toBeNull();

    s.enterPage("hub", "en");
    s.setPreview("play");
    expect(useGuideStore.getState().preview).toBe("play");
    // Chosen with a tap or a key, nothing pointed at: the choice is the answer.
    s.setPreview(null);
    s.leaveFor("build");
    expect(useGuideStore.getState()).toMatchObject({ leaving: "build", preview: "build" });
    // The pointer leaving the link on its way out changes nothing now.
    s.setPreview(null);
    s.setPreview("make");
    expect(useGuideStore.getState().preview).toBe("build");
    // The guide arrives: nothing is pointed at, nothing is being left.
    s.enterPage("build", "en");
    expect(useGuideStore.getState()).toMatchObject({ page: "build", preview: null, leaving: null });
  });

  it("keeps the hub's answer as it is for the hub's own language switch, and gives the words back if no page comes", () => {
    const s = useGuideStore.getState();
    s.enterPage("hub", "en");
    s.setPreview("make");
    s.leaveFor("hub");
    expect(useGuideStore.getState()).toMatchObject({ leaving: "hub", preview: "make" });
    s.leaveFor(null);
    expect(useGuideStore.getState().leaving).toBeNull();
  });

  it("keeps the Build stage on after its guide is left only while it is still showing the build", () => {
    const s = useGuideStore.getState();
    s.enterPage("build", "en");
    expect(useGuideStore.getState().buildLive).toBe(true);
    // Left before the stage ever drew: nothing to run back.
    s.enterPage("hub", "en");
    expect(useGuideStore.getState().buildLive).toBe(false);

    s.enterPage("build", "en");
    buildClock.t = 11.4;
    s.enterPage("hub", "en");
    expect(useGuideStore.getState().buildLive).toBe(true);
    // It takes itself off once the device is whole.
    s.setBuildLive(false);
    expect(useGuideStore.getState().buildLive).toBe(false);
    buildClock.t = -1;
  });

  it("counts the cuts it is asked for", () => {
    const before = useGuideStore.getState().cut;
    useGuideStore.getState().requestCut();
    useGuideStore.getState().requestCut();
    expect(useGuideStore.getState().cut).toBe(before + 2);
  });
});

describe("the guide's addresses", () => {
  it("reads every page back off its address, in both languages", () => {
    for (const page of SCREENS) {
      for (const lang of ["en", "ko"] as const) {
        expect(screenAt(pagePath(page, lang))).toEqual({ page, lang });
        expect(screenAt(pagePath(page, lang) + "/")).toEqual({ page, lang });
      }
    }
  });

  it("knows what is not the guide", () => {
    expect(screenAt("/")).toBeNull();
    expect(screenAt("/guide/flash")).toBeNull();
    expect(screenAt("/pattern-lab")).toBeNull();
  });

  it("says where the reader is as an anchor the other language's page has too", () => {
    expect(placeAnchor("opening", 0, true)).toBe("");
    expect(placeAnchor("flash", 2, true)).toBe("#flash-3");
    // A chapter's title, its first card not on screen yet.
    expect(placeAnchor("knobs", 0, false)).toBe("#knobs");
    expect(placeAnchor("next", 0, true)).toBe("#next");
  });
});

describe("how the device is framed", () => {
  it("stands it above the hub's choices, where the hub's own canvas used to", () => {
    // The old canvas was a box 99 − top/3 from the top and top × 1.667 − 213
    // tall, and kept 64 px free above and 32 px below.
    const { free, scale } = hubFraming(1440, 900, 600, false);
    const boxTop = 99 - 600 / 3;
    const boxH = 600 * 1.667 - 213;
    expect(free).toEqual({ l: 24, r: 1416, t: boxTop + 64, b: boxTop + boxH - 32 });
    // The same size on screen: the camera further back by the window's height over the box's.
    expect(scale).toBeCloseTo(900 / boxH, 9);
    // Its middle is halfway down to the choices, a touch lower.
    expect((free.t + free.b) / 2).toBeCloseTo(600 / 2 + 8.5, 0);
    expect((free.l + free.r) / 2).toBe(720);
  });

  it("keeps it above the choices on a phone, and never in less than 36% of the height", () => {
    expect(hubFraming(390, 844, 430, true)).toEqual({ free: { l: 12, r: 378, t: 56, b: 416 }, scale: 1 });
    // Choices that start very high (a short phone on its side): the floor of 36%.
    expect(hubFraming(700, 360, 60, true).free.b).toBeCloseTo(360 * 0.36, 9);
  });

  it("frames it somewhere sensible before the hub has been measured", () => {
    const { free, scale } = hubFraming(1440, 900, 0, false);
    expect(free.b).toBeGreaterThan(free.t + 200);
    expect(scale).toBeGreaterThan(1);
    expect(scale).toBeLessThan(1.6);
  });

  it("stands it well back for Make, in the middle of the room", () => {
    const { free, scale } = awayFraming(1440, 900);
    expect(scale).toBe(AWAY_SCALE);
    expect(scale).toBeGreaterThan(2);
    expect((free.l + free.r) / 2).toBe(720);
  });
});

describe("the device coming apart", () => {
  beforeEach(freshStore);

  it("is whole at 0 and fully apart at 1, every part", () => {
    const o = { x: 0, y: 0, z: 0 };
    for (const part of EXPLODE_PARTS) {
      expect(partAmount(part, 0)).toBe(0);
      expect(partAmount(part, 1)).toBe(1);
      expect(partOffset(part, 0, o)).toEqual({ x: 0, y: 0, z: 0 });
      const [x, y, z] = EXPLODE[part].offset;
      expect(partOffset(part, 1, o)).toEqual({ x, y, z });
    }
  });

  it("moves each part one way only, never back on itself", () => {
    for (const part of EXPLODE_PARTS) {
      let last = 0;
      for (let i = 0; i <= 100; i++) {
        const a = partAmount(part, i / 100);
        expect(a).toBeGreaterThanOrEqual(last);
        expect(a).toBeLessThanOrEqual(1);
        last = a;
      }
    }
  });

  it("takes each part along the way it goes on", () => {
    const at = (part: (typeof EXPLODE_PARTS)[number]) => EXPLODE[part].offset;
    // From the front: the knobs onto their shafts, the panel into the frame.
    for (const part of ["knobs", "panel"] as const) {
      expect(at(part)[0]).toBe(0);
      expect(at(part)[1]).toBe(0);
      expect(at(part)[2]).toBeGreaterThan(0);
    }
    // From behind, in the order they go in: the board, the DevKit onto it, the back over both.
    for (const part of ["board", "devkit", "backPlate"] as const) {
      expect(at(part)[0]).toBe(0);
      expect(at(part)[1]).toBe(0);
      expect(at(part)[2]).toBeLessThan(0);
    }
    expect(at("devkit")[2]).toBeLessThan(at("board")[2]);
    expect(at("backPlate")[2]).toBeLessThan(at("devkit")[2]);
    // The two covers slide, out of the case's knob side; the back cover goes with the back.
    expect(at("slider")[0]).toBeGreaterThan(0);
    expect(at("lid")[0]).toBeGreaterThan(0);
    expect(at("slider")[2]).toBe(at("backPlate")[2]);
    // Nothing leaves the bench's height.
    for (const part of EXPLODE_PARTS) expect(at(part)[1]).toBe(0);
  });

  it("opens from the outside in, and closes from the inside out", () => {
    // Early on the way out the covers and knobs lead and the board has not started.
    expect(partAmount("knobs", 0.2)).toBeGreaterThan(0);
    expect(partAmount("slider", 0.2)).toBeGreaterThan(0);
    expect(partAmount("board", 0.2)).toBe(0);
    // Near home again, the board is seated while the back cover is still off —
    // which is what keeps the panel dark until the device is whole (KitFx).
    expect(partAmount("board", 0.1)).toBe(0);
    expect(partAmount("slider", 0.1)).toBeGreaterThan(0);
  });

  it("is asked for only by the hub with Build pointed at, and not while the Build stage still has the device", () => {
    const s = useGuideStore.getState();
    s.enterPage("hub", "en");
    expect(explodeWanted()).toBe(false);
    s.setPreview("play");
    expect(explodeWanted()).toBe(false);
    s.setPreview("build");
    expect(explodeWanted()).toBe(true);
    // The Build stage is still winding the build back on this canvas.
    buildClock.t = 3.2;
    expect(explodeWanted()).toBe(false);
    buildClock.t = -1;
    // Chosen: it stays apart until the guide arrives, then settles.
    s.leaveFor("build");
    expect(explodeWanted()).toBe(true);
    s.enterPage("build", "en");
    expect(explodeWanted()).toBe(false);
  });
});

/** The share of the frame's columns (down the device, from its top) that match `other` exactly. */
function sameColumns(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean[] {
  const out: boolean[] = [];
  for (let x = 0; x < PANEL_W; x++) {
    let same = true;
    for (let y = 0; y < PANEL_H && same; y++) {
      const i = (y * PANEL_W + x) * 4;
      same = a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2];
    }
    out.push(same);
  }
  return out;
}

describe("the hub's Make answer", () => {
  let sim: DeviceSim;
  let now = 0;
  beforeEach(() => {
    freshStore();
    now = 1000;
    makeClock.now = () => now;
    sim = new DeviceSim();
    sim.tick(FRAME);
  });
  afterEach(() => {
    makeRestore(sim);
    turnBackNow(sim);
    makeClock.now = () => performance.now();
  });

  it("has every one of its patterns on a board with the Basics pack", () => {
    sim.setPack("basics");
    for (const slug of MAKE_PATTERNS) {
      sim.showPattern(slug);
      expect(sim.consoleState().patternSlug, slug).toBe(slug);
    }
  });

  it("shows someone's pattern, then the next, and puts Origin and its pack back", () => {
    expect(makeIsShown()).toBe(false);
    makeNext(sim);
    expect(makeIsShown()).toBe(true);
    expect(sim.consoleState().patternSlug).toBe(MAKE_PATTERNS[0]);
    expect(sim.snapshot().pack).toBe("basics");
    makeNext(sim);
    expect(sim.consoleState().patternSlug).toBe(MAKE_PATTERNS[1]);

    makeRestore(sim);
    expect(makeIsShown()).toBe(false);
    expect(sim.consoleState().patternSlug).toBe("origin");
    expect(sim.snapshot().pack).toBe("origin");
    // And starts from its first pattern the next time.
    makeNext(sim);
    expect(sim.consoleState().patternSlug).toBe(MAKE_PATTERNS[0]);
  });

  it("does nothing to a board it never changed", () => {
    sim.setPack("basics");
    sim.showPattern("wave_saw");
    makeRestore(sim);
    expect(sim.consoleState().patternSlug).toBe("wave_saw");
    expect(sim.snapshot().pack).toBe("basics");
  });

  it("draws the new pattern in from the top of the device, over the old one", () => {
    const origin = sim.frame.slice();
    makeNext(sim);
    // Halfway through: the top half of the device (the frame's last columns) is new, the rest still Origin.
    now += DRAW_MS / 2;
    sim.tick(0);
    expect(makeIsDrawing()).toBe(true);
    const mid = sameColumns(sim.frame, origin);
    expect(mid.slice(0, PANEL_W / 2 - 2).every(Boolean)).toBe(true);
    expect(mid.slice(PANEL_W / 2 + 2).some((same) => !same)).toBe(true);
    // Done: nothing of Origin is left on the panel.
    now += DRAW_MS;
    sim.tick(0);
    expect(makeIsDrawing()).toBe(false);
    const done = sim.frame.slice();
    sim.tick(0);
    expect(sameColumns(sim.frame, done).every(Boolean)).toBe(true);
    expect(sameColumns(done, origin).every(Boolean)).toBe(false);
  });

  it("never draws over a panel that is off", () => {
    makeNext(sim);
    sim.setMode("off");
    now += DRAW_MS / 2;
    sim.tick(FRAME);
    for (let i = 0; i < sim.frame.length; i += 4) expect(sim.frame[i] + sim.frame[i + 1] + sim.frame[i + 2]).toBe(0);
  });

  it("leaves Origin's hue where it was", () => {
    sim.turn(0, 7);
    sim.tick(FRAME);
    const hue = sim.knobReadout(0).value;
    makeNext(sim);
    now += DRAW_MS * 2;
    sim.tick(FRAME);
    makeRestore(sim);
    now += RESTORE_MS * 2;
    sim.tick(FRAME);
    expect(sim.knobReadout(0).value).toBe(hue);
  });
});

describe("the hub's answers, between pages", () => {
  const sim = getSim();
  beforeEach(() => {
    // Not requestAnimationFrame: the test setup pins its own.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "performance", "Date"] });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }),
    });
    freshStore();
    sim.setPack("origin");
    sim.setMode("run");
    sim.tick(FRAME);
  });
  afterEach(() => {
    makeRestore(sim);
    turnBackNow(sim);
    vi.useRealTimers();
  });

  /** Timers and the board's frames, as on the stage. */
  function run(ms: number) {
    for (let t = 0; t < ms; t += 16) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
      sim.tick(FRAME);
    }
  }

  it("turns K1 while Play is pointed at, and turns it back when the reader points away", () => {
    render(<HubAnswers />);
    act(() => useGuideStore.getState().enterPage("hub", "en"));
    act(() => useGuideStore.getState().setPreview("play"));
    run(1000);
    expect(knobIsTurned()).toBe(true);
    expect(sim.knobReadout(0).value).toBeGreaterThan(0);
    act(() => useGuideStore.getState().setPreview(null));
    run(800);
    expect(knobIsTurned()).toBe(false);
    expect(sim.knobReadout(0).value).toBe(0);
  });

  it("finishes turning K1 back in Play, a click at a time, when Play is chosen", () => {
    render(<HubAnswers />);
    act(() => useGuideStore.getState().enterPage("hub", "en"));
    act(() => useGuideStore.getState().setPreview("play"));
    run(1000);
    const turnedTo = sim.knobReadout(0).value;
    act(() => useGuideStore.getState().leaveFor("play"));
    act(() => useGuideStore.getState().enterPage("play", "en"));
    // Not at once: the colour comes home in Play's opening.
    expect(sim.knobReadout(0).value).toBe(turnedTo);
    run(800);
    expect(knobIsTurned()).toBe(false);
    expect(sim.knobReadout(0).value).toBe(0);
  });

  it("has K1 home before Build's first frame, which is dark", () => {
    render(<HubAnswers />);
    act(() => useGuideStore.getState().enterPage("hub", "en"));
    act(() => useGuideStore.getState().setPreview("play"));
    run(1000);
    expect(knobIsTurned()).toBe(true);
    // Straight from Play's answer into Build, no frame in between: inside the store's own update.
    act(() => {
      useGuideStore.getState().leaveFor("build");
      useGuideStore.getState().enterPage("build", "en");
      expect(knobIsTurned()).toBe(false);
      expect(sim.knobReadout(0).value).toBe(0);
    });
  });

  it("puts Origin back, with its own hue, when the hub is left with Make's pattern on the panel", () => {
    render(<HubAnswers />);
    act(() => useGuideStore.getState().enterPage("hub", "en"));
    // K1 turned by Play's answer, then straight on to Make before it has turned back.
    act(() => useGuideStore.getState().setPreview("play"));
    run(600);
    act(() => useGuideStore.getState().setPreview("make"));
    run(2500);
    expect(makeIsShown()).toBe(true);
    expect(sim.snapshot().pack).toBe("basics");
    act(() => useGuideStore.getState().leaveFor("make"));
    act(() => useGuideStore.getState().enterPage("make", "en"));
    expect(makeIsShown()).toBe(false);
    expect(sim.consoleState().patternSlug).toBe("origin");
    expect(sim.snapshot().pack).toBe("origin");
    expect(knobIsTurned()).toBe(false);
    expect(sim.knobReadout(0).value).toBe(0);
  });

  it("readies the Build stage once the reader lingers on Build, and keeps it only for Build", () => {
    render(<HubAnswers />);
    act(() => useGuideStore.getState().enterPage("hub", "en"));
    // A pointer passing over Build on its way elsewhere readies nothing.
    act(() => useGuideStore.getState().setPreview("build"));
    run(300);
    act(() => useGuideStore.getState().setPreview(null));
    run(1000);
    expect(useGuideStore.getState().buildLive).toBe(false);
    // Lingering does; it stays in standby while the hub is up.
    act(() => useGuideStore.getState().setPreview("build"));
    run(1000);
    expect(useGuideStore.getState().buildLive).toBe(true);
    act(() => useGuideStore.getState().setPreview(null));
    run(300);
    expect(useGuideStore.getState().buildLive).toBe(true);
    // Chosen: it is the guide's stage now.
    act(() => useGuideStore.getState().enterPage("build", "en"));
    expect(useGuideStore.getState().buildLive).toBe(true);
    // Had the reader gone to Play instead, it is taken off: it never drew anything.
    act(() => useGuideStore.getState().enterPage("hub", "en"));
    act(() => useGuideStore.getState().setBuildLive(true));
    act(() => useGuideStore.getState().enterPage("play", "en"));
    expect(useGuideStore.getState().buildLive).toBe(false);
  });

  it("answers nothing under reduced motion", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({ matches: true, media: query, addEventListener() {}, removeEventListener() {} }),
    });
    render(<HubAnswers />);
    act(() => useGuideStore.getState().enterPage("hub", "en"));
    act(() => useGuideStore.getState().setPreview("play"));
    run(600);
    expect(knobIsTurned()).toBe(false);
    act(() => useGuideStore.getState().setPreview("make"));
    run(600);
    expect(makeIsShown()).toBe(false);
    expect(explodeWanted()).toBe(false);
  });

  // turnOn is the answer's one click; used here so the import is the same one the component makes.
  it("counts only its own clicks", () => {
    turnOn(sim);
    sim.tick(FRAME);
    expect(knobIsTurned()).toBe(true);
    turnBackNow(sim);
    expect(sim.knobReadout(0).value).toBe(0);
  });
});
