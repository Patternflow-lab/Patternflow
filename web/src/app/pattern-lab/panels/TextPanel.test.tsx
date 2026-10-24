// The Text panel and the drag on Preview. jsdom has no FontFace and no
// document.fonts, so both are stood in for: the panel's font file path runs
// for real up to the browser handing back a loaded face. The canvas that
// measures letters is replaced by a 2×2 block per character (text.test.ts
// has the same stand-in and says why).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("@/lib/lab/textRaster", () => ({
  textCoverage: (spec: { text: string; x: number; y: number }, _font: string, width: number, height: number, left = 0) => {
    const coverage = new Uint8ClampedArray(width * height);
    for (let x = spec.x; x < spec.x + spec.text.length * 2; x++) {
      for (let y = spec.y - 1; y < spec.y + 1; y++) {
        if (x - left >= 0 && x - left < width && y >= 0 && y < height) coverage[y * width + x - left] = 255;
      }
    }
    return coverage;
  },
  // A scroll draws the whole line: where the blocks above start and end.
  textReach: (spec: { text: string; x: number }) => ({ left: spec.x - 1, right: spec.x + spec.text.length * 2 + 1 }),
}));

import TextPanel from "./TextPanel";
import KnobsPanel from "./KnobsPanel";
import PreviewPanel from "./PreviewPanel";
import RampPanel from "./RampPanel";
import { useLabStore } from "@/lib/lab/store";
import type { TextLayer } from "@/lib/lab/types";

const store = () => useLabStore.getState();
const text = (): TextLayer => {
  const layer = store().layers.find((entry) => entry.id === store().activeLayerId);
  if (layer?.type !== "text") throw new Error("active layer is not text");
  return layer;
};

class FakeFontFace {
  family: string;
  constructor(family: string, readonly bytes: ArrayBuffer) {
    this.family = family;
  }
  load() {
    // A file whose first byte is 0 stands for one the browser can't read.
    return new Uint8Array(this.bytes)[0] === 0 ? Promise.reject(new Error("bad")) : Promise.resolve(this);
  }
}

const fontSet = { add: vi.fn(), delete: vi.fn(), check: () => true, load: () => Promise.resolve([]) };

beforeEach(() => {
  vi.stubGlobal("FontFace", FakeFontFace);
  Object.defineProperty(document, "fonts", { value: fontSet, configurable: true });
  store().discardProject();
  store().setMatrix({ width: 16, height: 8 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function fontFile(name: string, firstByte = 1): File {
  const bytes = new Uint8Array([firstByte, 2, 3, 4]);
  const file = new File([bytes], name, { type: "font/ttf" });
  // jsdom's File has no arrayBuffer(); every browser the lab runs in does.
  return Object.assign(file, { arrayBuffer: () => Promise.resolve(bytes.buffer) });
}

describe("TextPanel", () => {
  it("offers to add a text layer when none is selected", () => {
    render(<TextPanel />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add text layer" }));
    expect(text().spec.text).toBe("Hello");
  });

  it("writes what is typed into the layer", () => {
    store().addTextLayer();
    render(<TextPanel />);
    fireEvent.change(screen.getByRole("textbox", { name: "Text" }), { target: { value: "PATTERN\nFLOW" } });
    expect(text().spec.text).toBe("PATTERN\nFLOW");
  });

  it("aligns left, center and right", () => {
    store().addTextLayer();
    render(<TextPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Right" }));
    expect(text().spec.align).toBe("right");
    expect(screen.getByRole("button", { name: "Right" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not commit a size on the way to the one being typed", () => {
    store().addTextLayer();
    render(<TextPanel />);
    const size = screen.getByRole("spinbutton", { name: "Size" });
    fireEvent.focus(size);
    fireEvent.change(size, { target: { value: "2" } });
    expect(text().spec.size).toBe(16);
    fireEvent.change(size, { target: { value: "24" } });
    expect(text().spec.size).toBe(24);
  });

  it("sets the text in a font file from the device, without uploading it", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    store().addTextLayer();
    render(<TextPanel />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Font file"), { target: { files: [fontFile("Brand Sans.otf")] } });
    });
    await waitFor(() => expect(text().spec.font).toBe("file:Brand Sans"));
    expect(fontSet.add).toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    const group = screen.getByRole("group", { name: "Your font files" });
    expect(within(group).getByRole("option", { name: "Brand Sans" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Brand Sans is loaded for this visit.");
  });

  it("says so when a file is not a font, and keeps the font it had", async () => {
    store().addTextLayer();
    render(<TextPanel />);
    await act(async () => {
      fireEvent.change(screen.getByLabelText("Font file"), { target: { files: [fontFile("notes.ttf", 0)] } });
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("That file isn't a font this browser can read."),
    );
    expect(text().spec.font).toBe("site:silkscreen");
  });

  it("names a file font this browser doesn't have", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { font: "file:Gone Grotesk" });
    render(<TextPanel />);
    expect(screen.getByRole("status")).toHaveTextContent("Gone Grotesk isn't loaded in this browser.");
    expect(screen.getByRole("combobox", { name: "Font" })).toHaveValue("file:Gone Grotesk");
  });
});

describe("an effect on the text", () => {
  it("scrolls on the Speed knob by default, and says where that knob is", () => {
    store().addTextLayer();
    render(<TextPanel />);
    expect(screen.queryByRole("combobox", { name: "Speed knob" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Effect" }), { target: { value: "scroll" } });
    expect(text().spec.effect).toBe("scroll");
    expect(text().source).not.toBeNull();
    expect(screen.getByRole("combobox", { name: "Speed knob" })).toHaveValue("1");
    const { knobLabels, knobs, ranges } = store();
    const share = Math.round(((knobs[1] - ranges[1][0]) / (ranges[1][1] - ranges[1][0])) * 100);
    expect(share).toBeGreaterThan(0);
    expect(screen.getByText(`${knobLabels[1]} sets how fast the letters run out to the left`, { exact: false })).toHaveTextContent(
      `It is at ${share}% now. All the way down stands the effect still.`,
    );
  });

  it("says nothing moves while the chosen knob is all the way down", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { effect: "twinkle" });
    render(<TextPanel />);
    useLabStore.setState({ knobs: [store().ranges[0][0], ...store().knobs.slice(1)] });
    fireEvent.change(screen.getByRole("combobox", { name: "Speed knob" }), { target: { value: "0" } });
    expect(text().spec.effectKnob).toBe(0);
    expect(screen.getByText(`${store().knobLabels[0]} sets how fast each LED dims`, { exact: false })).toHaveTextContent(
      "It is all the way down, so nothing moves yet: turn it up here or in Knobs.",
    );
  });

  it("turns the speed knob beside its picker, the same knob Knobs turns", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { effect: "scroll" });
    useLabStore.setState({ knobLabels: ["Hue", "Rate", "Mode", "Shift"] });
    const [low, high] = store().ranges[1];
    const textPanel = within(render(<TextPanel />).container);
    const knobsPanel = within(render(<KnobsPanel />).container);
    const here = textPanel.getByRole("slider", { name: "Rate" });
    const there = knobsPanel.getByRole("slider", { name: "Rate value" });

    fireEvent.change(here, { target: { value: String(high) } });
    expect(store().knobs[1]).toBe(high);
    expect(there).toHaveValue(String(high));
    expect(textPanel.getByText(/Rate sets how fast/)).toHaveTextContent("It is at 100% now.");

    fireEvent.change(there, { target: { value: String(low) } });
    expect(here).toHaveValue(String(low));
    expect(textPanel.getByText(/Rate sets how fast/)).toHaveTextContent("turn it up here or in Knobs.");
  });

  it("moves the slider to the knob a new pick names, and has none without an effect", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { effect: "twinkle" });
    useLabStore.setState({ knobLabels: ["Hue", "Rate", "Mode", "Shift"] });
    const { ranges } = store();
    useLabStore.setState({ knobs: [ranges[0][1], ranges[1][0], ranges[2][0], ranges[3][0]] });
    render(<TextPanel />);
    expect(screen.getByRole("slider", { name: "Rate" })).toHaveValue(String(ranges[1][0]));
    fireEvent.change(screen.getByRole("combobox", { name: "Speed knob" }), { target: { value: "0" } });
    expect(screen.queryByRole("slider", { name: "Rate" })).toBeNull();
    const hue = screen.getByRole("slider", { name: "Hue" });
    expect(hue).toHaveValue(String(ranges[0][1]));
    fireEvent.change(hue, { target: { value: String(ranges[0][0]) } });
    expect(store().knobs).toEqual([ranges[0][0], ranges[1][0], ranges[2][0], ranges[3][0]]);

    fireEvent.change(screen.getByRole("combobox", { name: "Effect" }), { target: { value: "none" } });
    expect(screen.queryByRole("slider")).toBeNull();
  });

  it("names the knobs as the Knobs panel does", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { effect: "scroll" });
    useLabStore.setState({ knobLabels: ["Hue", "Rate", "Mode", "Shift"] });
    render(<TextPanel />);
    expect(screen.getByRole("option", { name: "Rate" })).toBeInTheDocument();
    expect(screen.getByText(/Rate sets how fast/)).toBeInTheDocument();
  });

  it("running the ramp puts away the one color, which it does not use", () => {
    store().addTextLayer();
    render(<TextPanel />);
    expect(screen.getByLabelText("Color")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Effect" }), { target: { value: "ramp" } });
    expect(screen.queryByLabelText("Color")).toBeNull();
    expect(screen.getByText(/The colors are this layer's Color Ramp/)).toBeInTheDocument();
  });

  it("the Color Ramp panel no longer calls a one-color text that runs the ramp one colour", () => {
    store().addTextLayer();
    const { unmount } = render(<RampPanel />);
    expect(screen.getByText(/This text is one colour/)).toBeInTheDocument();
    unmount();
    store().setTextSpec(text().id, { effect: "ramp" });
    render(<RampPanel />);
    expect(screen.queryByText(/This text is one colour/)).toBeNull();
    expect(screen.getByText(/run through these colours all together/)).toBeInTheDocument();
  });
});

describe("Copy as code", () => {
  function clipboard() {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    return writeText;
  }

  it("copies the letters as they are drawn now, and the new ones after an edit", async () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { text: "ab", x: 2, y: 4 });
    const writeText = clipboard();
    render(<TextPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Copy as code" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Copied ✓" })).toBeTruthy();
    const first = String(writeText.mock.calls[0][0]);
    expect(first).toContain('// Text: "ab"');
    // Two letters, a 2×2 block each: a 4 × 2 sprite.
    expect(first).toContain("const SPRITE_W = 4, SPRITE_H = 2;");

    fireEvent.change(screen.getByRole("textbox", { name: "Text" }), { target: { value: "abcd" } });
    fireEvent.click(screen.getByRole("button", { name: "Copied ✓" }));
    const second = String(writeText.mock.calls[1][0]);
    expect(second).toContain('// Text: "abcd"');
    expect(second).toContain("const SPRITE_W = 8, SPRITE_H = 2;");
  });

  it("says so when no letter is on the frame", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { text: "" });
    const writeText = clipboard();
    render(<TextPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Copy as code" }));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "No letters on the frame" })).toBeTruthy();
  });

  it("says so when the browser refuses the clipboard", async () => {
    store().addTextLayer();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    });
    render(<TextPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Copy as code" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Copy failed" })).toBeTruthy();
  });
});

describe("dragging text on Preview", () => {
  it("moves the selected text by whole LED pixels", () => {
    store().addTextLayer();
    store().setTextSpec(text().id, { x: 4, y: 4 });
    render(<PreviewPanel />);
    const canvas = screen.getByLabelText(/Composite preview/);
    // The frame drawn 160 × 80 CSS px: 10 px to an LED.
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({ x: 0, y: 0, left: 0, top: 0, width: 160, height: 80, right: 160, bottom: 80, toJSON: () => ({}) }),
    });
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 81, clientY: 29 });
    expect([text().spec.x, text().spec.y]).toEqual([7, 2]);
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 150, clientY: 70 });
    expect([text().spec.x, text().spec.y]).toEqual([7, 2]);
  });

  it("leaves the frame alone when the selected layer isn't text", () => {
    render(<PreviewPanel />);
    const canvas = screen.getByLabelText(/Composite preview/);
    expect(canvas.getAttribute("style")).not.toContain("touch-action");
    expect(canvas).not.toHaveAttribute("title");
  });
});
