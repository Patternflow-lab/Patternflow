// A preview's sandbox compiles its pattern and runs setup() on every pf-load.
// The mount, two timers, the iframe's load event and its pf-ready each sent
// one, so a sandbox that was already listening loaded its pattern five times.

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SandboxPreview from "./SandboxPreview";

const RANGES: [number, number][] = [
  [0, 1],
  [0, 1],
  [0, 1],
  [0, 1],
];

function mount(code = "// one") {
  const view = render(<SandboxPreview code={code} knobValues={[0.5, 0.5, 0.5, 0.5]} knobRanges={RANGES} />);
  const frame = view.container.querySelector("iframe") as HTMLIFrameElement;
  const sandbox = frame.contentWindow as Window;
  const post = vi.spyOn(sandbox, "postMessage");
  return { view, frame, sandbox, post };
}

// The spy goes on after the mount's own send, so that one is counted apart.
const loads = (post: ReturnType<typeof vi.spyOn>) =>
  post.mock.calls.filter(([message]) => (message as { type?: string }).type === "pf-load").length;

function say(sandbox: Window, data: object) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { data, source: sandbox }));
  });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a sandbox preview", () => {
  it("loads its pattern once into a sandbox that comes up after it", () => {
    const { frame, sandbox, post } = mount();
    fireEvent.load(frame);
    say(sandbox, { type: "pf-ready" });
    say(sandbox, { type: "pf-status", ok: true });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(loads(post)).toBe(1);
  });

  it("counts an answer to the blind send as heard, and sends nothing more", () => {
    // The pattern page's iframe is in the server's HTML: its load event and
    // pf-ready came before React did.
    const { sandbox, post } = mount();
    say(sandbox, { type: "pf-status", ok: true });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(loads(post)).toBe(0);
  });

  it("sends once more to a sandbox that said nothing for 1.5 s", () => {
    const { post } = mount();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(loads(post)).toBe(1);
  });

  it("loads new code when the code changes", () => {
    const { view, frame, sandbox, post } = mount();
    fireEvent.load(frame);
    say(sandbox, { type: "pf-ready" });
    view.rerender(<SandboxPreview code="// two" knobValues={[0.5, 0.5, 0.5, 0.5]} knobRanges={RANGES} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(loads(post)).toBe(2);
    expect((post.mock.calls.at(-1)?.[0] as { code: string }).code).toBe("// two");
  });
});
