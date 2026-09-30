import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deskSignal, type DeskRun } from "./deskStore";
import type { Pointer } from "./pointer";
import { DeskTutorial, type DeskEnv } from "./runner";
import type { Beat, BeatCtx, DeskWin } from "./types";

// The tutorial runner, with a stand-in pointer: it waits for the reader,
// moves on when the reader does it, acts out demos only in practice windows,
// never throws on a missing target, and leaves a step cleanly.

function fakePointer() {
  const calls: string[] = [];
  const p = {
    calls,
    goTo: vi.fn(async (aim: unknown) => {
      calls.push(aim ? "goTo" : "hide");
    }),
    replayFrom: vi.fn(async () => {
      calls.push("replayFrom");
    }),
    press: vi.fn(async () => {
      calls.push("press");
    }),
    hold: vi.fn(),
    halt: vi.fn(() => calls.push("halt")),
    mode: vi.fn(),
    setWaiting: vi.fn((on: boolean) => calls.push(on ? "wait" : "unwait")),
    ack: vi.fn(() => calls.push("ack")),
    say: vi.fn(),
  };
  return p;
}

function setup(opts: { ready?: () => boolean } = {}) {
  document.body.innerHTML = `
    <div id="community"><button id="post">Post</button><input id="field" /></div>
    <div id="lab"><button id="copy">Copy prompt</button></div>`;
  const runs: (DeskRun | null)[] = [];
  const roots: Record<DeskWin, ParentNode | null> = {
    community: document.getElementById("community"),
    lab: document.getElementById("lab"),
    ai: null,
  };
  const env: DeskEnv = {
    lang: () => "en",
    reduced: () => false,
    doc: () => document,
    root: (win) => roots[win],
    rectOf: (_win, el) => el.getBoundingClientRect(),
    box: () => ({ left: 0, top: 0, right: 500, bottom: 500, width: 500, height: 500 }) as DOMRect,
    ready: (win) => (win === "lab" && opts.ready ? opts.ready() : true),
    bringForward: () => {},
    report: (run) => runs.push(run),
  };
  const pointer = fakePointer();
  const t = new DeskTutorial(env, pointer as unknown as Pointer);
  const last = () => runs[runs.length - 1];
  return { t, pointer, runs, last };
}

beforeEach(() => {
  // Timers only: the test setup pins requestAnimationFrame.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  // jsdom lays nothing out: give every element a box, so targets are "on screen".
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    left: 10,
    top: 10,
    right: 60,
    bottom: 30,
    width: 50,
    height: 20,
    x: 10,
    y: 10,
    toJSON: () => ({}),
  } as DOMRect);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("desk tutorial", () => {
  it("parks on the target and waits for the reader's own click", async () => {
    const { t, pointer, last } = setup();
    t.start("lab.2", [{ win: "lab", target: { text: "Copy prompt" }, do: "press", say: { en: "Press it", ko: "눌러요" } }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(last()).toMatchObject({ key: "lab.2", index: 0, waiting: true, done: false, say: "Press it" });
    expect(pointer.setWaiting).toHaveBeenLastCalledWith(true);
    document.getElementById("copy")!.click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(last()).toMatchObject({ key: "lab.2", done: true });
  });

  it("never clicks in the Lab, even in a demo; acts a practice window's demo out", async () => {
    const { t, last } = setup();
    const labClicks = vi.fn();
    const postClicks = vi.fn();
    document.getElementById("copy")!.addEventListener("click", labClicks);
    document.getElementById("post")!.addEventListener("click", postClicks);
    t.start("x.0", [
      { win: "lab", target: "#copy", do: "press", until: 200 },
      { win: "community", target: "#post", do: "press", until: 200 },
      { win: "community", target: "#field", do: "type", text: "hi", until: 200 },
    ]);
    await vi.advanceTimersByTimeAsync(4000);
    expect(labClicks).not.toHaveBeenCalled();
    expect(postClicks).toHaveBeenCalledTimes(1);
    expect((document.getElementById("field") as HTMLInputElement).value).toBe("hi");
    expect(last()).toMatchObject({ done: true });
  });

  it("hides the pointer and still waits when a target isn't there, without throwing", async () => {
    const { t, pointer, last } = setup();
    t.start("lab.5", [{ win: "lab", target: { text: "A button that was renamed" }, do: "press", signal: "later" }]);
    await vi.advanceTimersByTimeAsync(6000);
    expect(last()).toMatchObject({ waiting: true, done: false });
    expect(pointer.press).not.toHaveBeenCalled();
    deskSignal("later");
    await vi.advanceTimersByTimeAsync(1000);
    expect(last()).toMatchObject({ done: true });
  });

  it("takes done(), skipIf and a throwing hook in its stride", async () => {
    const { t, last } = setup();
    let ready = false;
    const beats: Beat[] = [
      { win: "community", target: "#post", do: "press", skipIf: () => true },
      {
        win: "community",
        target: "#post",
        do: "press",
        done: () => ready,
        run: () => {
          throw new Error("a hook that breaks");
        },
      },
    ];
    t.start("community.1", beats);
    await vi.advanceTimersByTimeAsync(2000);
    expect(last()).toMatchObject({ index: 1, waiting: true });
    ready = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(last()).toMatchObject({ done: true });
  });

  it("leaves a step cleanly: cleanups run, the old step's click no longer counts", async () => {
    const { t, runs, last } = setup();
    const cleanup = vi.fn();
    t.start("community.2", [
      { win: "community", target: "#post", do: "press", until: 100, run: () => cleanup },
      { win: "community", target: "#post", do: "press" },
    ]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(last()).toMatchObject({ key: "community.2", index: 1, waiting: true });
    t.start("community.3", []);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(last()).toBeNull();
    const before = runs.length;
    document.getElementById("post")!.click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(runs.length).toBe(before);
  });

  it("hears a reader who is quicker than the pointer: listening starts with the beat, not when it arrives", async () => {
    const { t, pointer, last } = setup();
    // A glide that takes its time.
    pointer.goTo.mockImplementation(
      (aim: unknown) =>
        new Promise<void>((resolve) => {
          pointer.calls.push(aim ? "goTo" : "hide");
          window.setTimeout(resolve, aim ? 1500 : 0);
        }),
    );
    t.start("lab.2", [{ win: "lab", target: "#copy", do: "press" }]);
    await vi.advanceTimersByTimeAsync(300);
    expect(last()).toMatchObject({ waiting: false, done: false });
    document.getElementById("copy")!.click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(pointer.halt).toHaveBeenCalled();
    expect(pointer.press).not.toHaveBeenCalled();
    expect(last()).toMatchObject({ done: true });
  });

  it("asks skipIf only once the Lab has loaded, and again while it waits", async () => {
    let loaded = false;
    let tabOpen = false;
    const { t, last } = setup({ ready: () => loaded });
    const asked: boolean[] = [];
    t.start("lab.3", [
      {
        win: "lab",
        target: "#copy",
        do: "press",
        skipIf: () => {
          asked.push(loaded);
          return tabOpen;
        },
      },
    ]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(asked).toEqual([]);
    loaded = true;
    await vi.advanceTimersByTimeAsync(3000);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every(Boolean)).toBe(true);
    expect(last()).toMatchObject({ waiting: true, done: false });
    // The Lab restores the tab a moment later: the beat passes without a click.
    tabOpen = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(last()).toMatchObject({ done: true });
  });

  it("gives each step a baseline: begin runs once as it starts, ctx.since and ctx.memo come with it", async () => {
    const { t, last } = setup();
    let value = 1;
    const begin = vi.fn((ctx: BeatCtx) => {
      ctx.memo.set("v", value);
    });
    t.start("lab.4", [{ win: "lab", target: "#copy", do: "press", on: [], begin, done: (ctx) => value !== ctx.memo.get("v") && ctx.since > 0 }]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(begin).toHaveBeenCalledTimes(1);
    expect(last()).toMatchObject({ waiting: true });
    value = 2;
    await vi.advanceTimersByTimeAsync(1000);
    expect(last()).toMatchObject({ done: true });
  });

  it("starts a practice window's step over when the reader leaves its target's page; never the Lab's", async () => {
    const { t, last } = setup();
    const first = vi.fn(() => true);
    t.start("community.3", [
      { win: "community", target: "#nav", do: "press", until: 100, skipIf: first },
      { win: "community", target: "#post", do: "press" },
    ]);
    await vi.advanceTimersByTimeAsync(3000);
    expect(last()).toMatchObject({ index: 1, waiting: true });
    const before = first.mock.calls.length;
    document.getElementById("post")!.remove();
    await vi.advanceTimersByTimeAsync(1600);
    expect(first.mock.calls.length).toBeGreaterThan(before);

    const { t: t2, last: last2 } = setup();
    const labFirst = vi.fn(() => true);
    t2.start("lab.7", [
      { win: "lab", target: "#nav", do: "press", until: 100, skipIf: labFirst },
      { win: "lab", target: "#copy", do: "press" },
    ]);
    await vi.advanceTimersByTimeAsync(3000);
    const labBefore = labFirst.mock.calls.length;
    document.getElementById("copy")!.remove();
    await vi.advanceTimersByTimeAsync(3000);
    expect(labFirst.mock.calls.length).toBe(labBefore);
    expect(last2()).toMatchObject({ index: 1, waiting: true });
  });

  it("keeps a finished step finished: coming back says Done, and Show me again still replays it", async () => {
    const { t, pointer, last } = setup();
    const beats: Beat[] = [{ win: "lab", target: "#copy", do: "press" }];
    t.start("lab.2", beats);
    await vi.advanceTimersByTimeAsync(3000);
    document.getElementById("copy")!.click();
    await vi.advanceTimersByTimeAsync(2000);
    expect(last()).toMatchObject({ done: true });
    t.start("lab.3", []);
    t.start("lab.2", beats);
    expect(last()).toMatchObject({ key: "lab.2", done: true, waiting: false });
    const presses = pointer.press.mock.calls.length;
    t.replay();
    await vi.advanceTimersByTimeAsync(3000);
    expect(pointer.press.mock.calls.length).toBe(presses + 1);
    expect(last()).toMatchObject({ done: true });
  });

  it("shows the gesture again on 'Show me again', and keeps waiting", async () => {
    const { t, pointer, last } = setup();
    t.start("lab.2", [{ win: "lab", target: "#copy", do: "press" }]);
    await vi.advanceTimersByTimeAsync(3000);
    const presses = pointer.press.mock.calls.length;
    t.replay();
    await vi.advanceTimersByTimeAsync(2000);
    expect(pointer.replayFrom).toHaveBeenCalled();
    expect(pointer.press.mock.calls.length).toBe(presses + 1);
    expect(last()).toMatchObject({ waiting: true, done: false });
  });
});
