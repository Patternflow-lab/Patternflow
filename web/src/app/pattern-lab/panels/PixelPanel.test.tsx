// The pixel editor's behaviour, pinned before its component was split into
// hooks: every gesture below reads the layer's RGBA buffer in the store — the
// thing the device receives — not what the canvas shows.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createEvent, fireEvent, render, screen } from "@testing-library/react";
import PixelPanel from "./PixelPanel";
import { useLabStore } from "@/lib/lab/store";
import type { PixelLayer } from "@/lib/lab/types";

function pixelLayer(): PixelLayer {
  const layer = useLabStore.getState().layers.find((entry) => entry.type === "pixel");
  if (!layer || layer.type !== "pixel") throw new Error("no pixel layer");
  return layer;
}

function rgba(x: number, y: number): [number, number, number, number] {
  const layer = pixelLayer();
  const i = (y * layer.width + x) * 4;
  return [layer.data[i], layer.data[i + 1], layer.data[i + 2], layer.data[i + 3]];
}

function mount() {
  const utils = render(<PixelPanel />);
  const main = screen.getByLabelText(/bitmap$/);
  const overlay = main.nextElementSibling as HTMLCanvasElement;
  const viewport = utils.container.querySelector('[tabindex="0"]') as HTMLDivElement;
  return { ...utils, overlay, viewport };
}

const at = (x: number, y: number, extra: Record<string, unknown> = {}) => ({
  clientX: x,
  clientY: y,
  button: 0,
  buttons: 1,
  pointerId: 1,
  ...extra,
});

const ORANGE: [number, number, number, number] = [255, 77, 0, 255];
const CLEAR: [number, number, number, number] = [0, 0, 0, 0];

beforeEach(() => {
  useLabStore.getState().discardProject();
  useLabStore.getState().addPixelLayer();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PixelPanel", () => {
  it("offers to add a pixel layer when the active layer is code", () => {
    const state = useLabStore.getState();
    state.selectLayer(state.layers.find((entry) => entry.type === "code")!.id);
    render(<PixelPanel />);
    fireEvent.click(screen.getByText("+ Add pixel layer"));
    expect(useLabStore.getState().layers.filter((entry) => entry.type === "pixel")).toHaveLength(2);
  });

  // The hint called every other layer a code pattern, written before text
  // layers came in (#184).
  it("names the selected layer's kind and the panel that edits it", () => {
    const state = useLabStore.getState();
    state.selectLayer(state.layers.find((entry) => entry.type === "code")!.id);
    const { unmount } = render(<PixelPanel />);
    expect(
      screen.getByText("The selected layer is a code pattern. Edit it in the Code panel, or select a pixel layer to draw."),
    ).toBeTruthy();
    unmount();

    useLabStore.getState().addTextLayer();
    render(<PixelPanel />);
    expect(
      screen.getByText("The selected layer is text. Edit it in the Text panel, or select a pixel layer to draw."),
    ).toBeTruthy();
  });

  it("pen: a press paints a dot, a drag paints a line, release commits", () => {
    const { overlay } = mount();
    const before = pixelLayer().rev;
    fireEvent.pointerDown(overlay, at(5, 5));
    expect(rgba(5, 5)).toEqual(ORANGE);
    fireEvent.pointerMove(overlay, at(9, 5));
    expect(rgba(7, 5)).toEqual(ORANGE);
    fireEvent.pointerUp(overlay, at(9, 5));
    expect(pixelLayer().rev).toBe(before + 1);
  });

  it("right-drag erases", () => {
    const { overlay } = mount();
    fireEvent.pointerDown(overlay, at(3, 3));
    fireEvent.pointerUp(overlay, at(3, 3));
    expect(rgba(3, 3)).toEqual(ORANGE);
    fireEvent.pointerDown(overlay, at(3, 3, { button: 2, buttons: 2 }));
    fireEvent.pointerUp(overlay, at(3, 3, { button: 2, buttons: 0 }));
    expect(rgba(3, 3)).toEqual(CLEAR);
  });

  it("undo and redo through the keyboard, and through the buttons", () => {
    const { overlay, viewport } = mount();
    fireEvent.pointerDown(overlay, at(1, 1));
    fireEvent.pointerUp(overlay, at(1, 1));
    expect(rgba(1, 1)).toEqual(ORANGE);
    fireEvent.keyDown(viewport, { key: "z", ctrlKey: true });
    expect(rgba(1, 1)).toEqual(CLEAR);
    fireEvent.keyDown(viewport, { key: "z", ctrlKey: true, shiftKey: true });
    expect(rgba(1, 1)).toEqual(ORANGE);
    fireEvent.click(screen.getByTitle(/^Undo/));
    expect(rgba(1, 1)).toEqual(CLEAR);
    fireEvent.click(screen.getByTitle(/^Redo/));
    expect(rgba(1, 1)).toEqual(ORANGE);
  });

  it("undo still works after the matrix size changes", () => {
    const { overlay, viewport } = mount();
    fireEvent.pointerDown(overlay, at(40, 20));
    fireEvent.pointerUp(overlay, at(40, 20));
    // 128×64 to 64×32 keeps the middle: (40, 20) becomes (8, 4)
    act(() => useLabStore.getState().setMatrix({ width: 64, height: 32 }));
    expect(pixelLayer().width).toBe(64);
    expect(rgba(8, 4)).toEqual(ORANGE);
    fireEvent.keyDown(viewport, { key: "z", ctrlKey: true });
    expect(rgba(8, 4)).toEqual(CLEAR);
    fireEvent.keyDown(viewport, { key: "z", ctrlKey: true, shiftKey: true });
    expect(rgba(8, 4)).toEqual(ORANGE);
  });

  it("tool keys switch tools: e erases, g fills, b is the pen again", () => {
    const { overlay, viewport } = mount();
    fireEvent.keyDown(viewport, { key: "g" });
    expect(screen.getByText("Fill")).toHaveAttribute("data-active", "true");
    fireEvent.pointerDown(overlay, at(10, 10));
    fireEvent.pointerUp(overlay, at(10, 10));
    expect(rgba(0, 0)).toEqual(ORANGE);
    expect(rgba(127, 63)).toEqual(ORANGE);
    fireEvent.keyDown(viewport, { key: "e" });
    fireEvent.pointerDown(overlay, at(0, 0));
    fireEvent.pointerUp(overlay, at(0, 0));
    expect(rgba(0, 0)).toEqual(CLEAR);
    expect(rgba(1, 0)).toEqual(ORANGE);
    fireEvent.keyDown(viewport, { key: "b" });
    expect(screen.getByText("Pen")).toHaveAttribute("data-active", "true");
  });

  it("[ and ] change the brush size, and a wider pen paints a wider dot", () => {
    const { overlay, viewport } = mount();
    fireEvent.keyDown(viewport, { key: "]" });
    fireEvent.keyDown(viewport, { key: "]" });
    expect(screen.getByLabelText("Brush size")).toHaveValue(3);
    fireEvent.pointerDown(overlay, at(20, 20));
    fireEvent.pointerUp(overlay, at(20, 20));
    expect(rgba(19, 19)).toEqual(ORANGE);
    expect(rgba(21, 21)).toEqual(ORANGE);
    expect(rgba(22, 22)).toEqual(CLEAR);
    fireEvent.keyDown(viewport, { key: "[" });
    expect(screen.getByLabelText("Brush size")).toHaveValue(2);
  });

  it("alt-click picks the colour under the pointer", () => {
    const { overlay } = mount();
    fireEvent.change(screen.getByLabelText("Drawing color"), { target: { value: "#2ec27e" } });
    fireEvent.pointerDown(overlay, at(4, 4));
    fireEvent.pointerUp(overlay, at(4, 4));
    fireEvent.change(screen.getByLabelText("Drawing color"), { target: { value: "#ffffff" } });
    fireEvent.pointerDown(overlay, at(4, 4, { altKey: true }));
    fireEvent.pointerUp(overlay, at(4, 4, { altKey: true }));
    expect(screen.getByLabelText("Drawing color")).toHaveValue("#2ec27e");
  });

  it("shape tools preview until release: a filled rect lands on pointer-up", () => {
    const { overlay, viewport } = mount();
    fireEvent.keyDown(viewport, { key: "r" });
    fireEvent.pointerDown(overlay, at(2, 2));
    fireEvent.pointerMove(overlay, at(5, 4));
    expect(rgba(3, 3)).toEqual(CLEAR);
    fireEvent.pointerUp(overlay, at(5, 4));
    expect(rgba(3, 3)).toEqual(ORANGE);
    expect(rgba(5, 4)).toEqual(ORANGE);
    expect(rgba(6, 4)).toEqual(CLEAR);
  });

  it("select: box, lift, nudge, commit — and escape puts the pixels back", () => {
    const { overlay, viewport } = mount();
    fireEvent.pointerDown(overlay, at(10, 10));
    fireEvent.pointerUp(overlay, at(10, 10));
    fireEvent.keyDown(viewport, { key: "s" });
    // box around the dot
    fireEvent.pointerDown(overlay, at(9, 9));
    fireEvent.pointerMove(overlay, at(11, 11));
    fireEvent.pointerUp(overlay, at(11, 11));
    // press inside the box lifts it
    fireEvent.pointerDown(overlay, at(10, 10));
    fireEvent.pointerUp(overlay, at(10, 10));
    expect(rgba(10, 10)).toEqual(CLEAR);
    expect(screen.getByTitle(/Stamp the selection down/)).toBeTruthy();
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    fireEvent.keyDown(viewport, { key: "Enter" });
    expect(rgba(12, 10)).toEqual(ORANGE);
    expect(rgba(10, 10)).toEqual(CLEAR);

    // lift again, then escape: the cut goes back where it was
    fireEvent.pointerDown(overlay, at(11, 9));
    fireEvent.pointerMove(overlay, at(13, 11));
    fireEvent.pointerUp(overlay, at(13, 11));
    fireEvent.pointerDown(overlay, at(12, 10));
    fireEvent.pointerUp(overlay, at(12, 10));
    expect(rgba(12, 10)).toEqual(CLEAR);
    fireEvent.keyDown(viewport, { key: "Escape" });
    expect(rgba(12, 10)).toEqual(ORANGE);
  });

  it("switching tools with a floating cut stamps it first", () => {
    const { overlay, viewport } = mount();
    fireEvent.pointerDown(overlay, at(30, 30));
    fireEvent.pointerUp(overlay, at(30, 30));
    fireEvent.keyDown(viewport, { key: "s" });
    fireEvent.pointerDown(overlay, at(30, 30));
    fireEvent.pointerMove(overlay, at(30, 30));
    fireEvent.pointerUp(overlay, at(30, 30));
    fireEvent.pointerDown(overlay, at(30, 30));
    fireEvent.pointerUp(overlay, at(30, 30));
    expect(rgba(30, 30)).toEqual(CLEAR);
    fireEvent.keyDown(viewport, { key: "ArrowDown" });
    fireEvent.click(screen.getByText("Pen"));
    expect(rgba(30, 31)).toEqual(ORANGE);
  });

  it("clear empties the layer and undo brings it back", () => {
    const { overlay, viewport } = mount();
    fireEvent.pointerDown(overlay, at(7, 7));
    fireEvent.pointerUp(overlay, at(7, 7));
    fireEvent.click(screen.getByTitle(/Clear the layer/));
    expect(rgba(7, 7)).toEqual(CLEAR);
    fireEvent.keyDown(viewport, { key: "z", ctrlKey: true });
    expect(rgba(7, 7)).toEqual(ORANGE);
  });

  it("copy as code puts a standalone pattern on the clipboard", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { overlay, unmount } = mount();
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByTitle(/Copy this drawing/));
    expect(screen.getByText("Layer is empty")).toBeTruthy();
    fireEvent.pointerDown(overlay, at(1, 1));
    fireEvent.pointerUp(overlay, at(1, 1));
    fireEvent.click(screen.getByText("Layer is empty").closest("button")!);
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain("draw(");
    await act(async () => {});
    expect(screen.getByText("Copied ✓")).toBeTruthy();
    // The label's way back to "Copy as code" goes with the panel. A timer
    // left here fired after the test file had torn its DOM down. Focusing
    // the viewport leaves a zero-delay timer of jsdom's own, so what is due
    // now runs first.
    unmount();
    vi.advanceTimersByTime(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("opens the image import modal", () => {
    mount();
    fireEvent.click(screen.getByTitle(/Import an image/));
    expect(screen.getByLabelText("Import image")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close"));
    expect(screen.queryByLabelText("Import image")).toBeNull();
  });

  it("zoom buttons and the status line agree", () => {
    mount();
    expect(screen.getByText("zoom 6×")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("zoom 7×")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Zoom out"));
    fireEvent.click(screen.getByLabelText("Zoom out"));
    expect(screen.getByText("zoom 5×")).toBeTruthy();
  });

  // jsdom lays nothing out, so every element measures 0×0 unless told.
  const panelSize = (width: number, height: number) => {
    vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(() => width);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => height);
  };

  it("on a phone the picture opens fitted, all of it in view", () => {
    // the Pixel viewport on a 390×844 phone, measured in Chromium
    panelSize(372, 151);
    mount();
    expect(screen.getByText("zoom 1×")).toBeTruthy();
    // and the zoom stays the user's to change
    fireEvent.click(screen.getByLabelText("Zoom in"));
    expect(screen.getByText("zoom 2×")).toBeTruthy();
  });

  it("a desktop panel narrower than the picture at 6× opens fitted too", () => {
    // 1440×900: the viewport is 649×648, and 6× is 768 px across
    panelSize(649, 648);
    mount();
    expect(screen.getByText("zoom 4×")).toBeTruthy();
  });

  it("a panel the picture already fits keeps 6×", () => {
    panelSize(1200, 800);
    mount();
    expect(screen.getByText("zoom 6×")).toBeTruthy();
  });

  it("a panel laid out after it mounts is fitted when it gets its size, and only then", () => {
    const observers: { fire: () => void }[] = [];
    const Original = window.ResizeObserver;
    class CapturingObserver {
      private live = true;
      constructor(private readonly callback: ResizeObserverCallback) {
        observers.push({ fire: () => this.live && this.callback([], this as unknown as ResizeObserver) });
      }
      observe() {}
      unobserve() {}
      disconnect() {
        this.live = false;
      }
    }
    Object.defineProperty(window, "ResizeObserver", { configurable: true, value: CapturingObserver });
    try {
      // a tab behind another: mounted, 0×0
      let size = { width: 0, height: 0 };
      vi.spyOn(Element.prototype, "clientWidth", "get").mockImplementation(() => size.width);
      vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(() => size.height);
      mount();
      expect(screen.getByText("zoom 6×")).toBeTruthy();
      size = { width: 372, height: 151 };
      act(() => observers.forEach((observer) => observer.fire()));
      expect(screen.getByText("zoom 1×")).toBeTruthy();
      // a later resize leaves the user's zoom alone
      fireEvent.click(screen.getByLabelText("Zoom in"));
      size = { width: 200, height: 100 };
      act(() => observers.forEach((observer) => observer.fire()));
      expect(screen.getByText("zoom 2×")).toBeTruthy();
    } finally {
      Object.defineProperty(window, "ResizeObserver", { configurable: true, value: Original });
    }
  });

  it("the wheel zooms the drawing and does not scroll the panel", () => {
    const { viewport } = mount();
    const up = createEvent.wheel(viewport, { deltaY: -100 });
    fireEvent(viewport, up);
    expect(up.defaultPrevented).toBe(true);
    expect(screen.getByText("zoom 7×")).toBeTruthy();
    const down = createEvent.wheel(viewport, { deltaY: 100 });
    fireEvent(viewport, down);
    expect(down.defaultPrevented).toBe(true);
    expect(screen.getByText("zoom 6×")).toBeTruthy();
    // a sideways wheel has no up or down: it scrolls the viewport, zoom stays
    const sideways = createEvent.wheel(viewport, { deltaX: 100, deltaY: 0 });
    fireEvent(viewport, sideways);
    expect(sideways.defaultPrevented).toBe(false);
    expect(screen.getByText("zoom 6×")).toBeTruthy();
  });

  it("the wheel zooms once a pixel layer is picked after a code layer", () => {
    const state = useLabStore.getState();
    state.selectLayer(state.layers.find((entry) => entry.type === "code")!.id);
    const { container } = render(<PixelPanel />);
    act(() => useLabStore.getState().selectLayer(pixelLayer().id));
    const viewport = container.querySelector('[tabindex="0"]') as HTMLDivElement;
    const up = createEvent.wheel(viewport, { deltaY: -100 });
    fireEvent(viewport, up);
    expect(up.defaultPrevented).toBe(true);
    expect(screen.getByText("zoom 7×")).toBeTruthy();
  });

  it("the wheel zooms by how far it turned, not by how many events came", () => {
    const { viewport } = mount();
    const wheel = (init: WheelEventInit) => fireEvent(viewport, createEvent.wheel(viewport, init));
    // a trackpad swipe: thirty small events, 120 px in all, one notch's step
    for (let i = 0; i < 30; i++) wheel({ deltaY: -4 });
    expect(screen.getByText("zoom 7×")).toBeTruthy();
    // one fast flick of three notches
    wheel({ deltaY: -300 });
    expect(screen.getByText("zoom 10×")).toBeTruthy();
    // a wheel that counts in lines: three lines are a notch
    wheel({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(screen.getByText("zoom 9×")).toBeTruthy();
  });

  it("turning the wheel back drops what was left of the other way", () => {
    const { viewport } = mount();
    const wheel = (init: WheelEventInit) => fireEvent(viewport, createEvent.wheel(viewport, init));
    for (let i = 0; i < 9; i++) wheel({ deltaY: -10 });
    expect(screen.getByText("zoom 6×")).toBeTruthy();
    wheel({ deltaY: 100 });
    expect(screen.getByText("zoom 5×")).toBeTruthy();
  });

  it("the wheel keeps the cell under the cursor where it was", () => {
    const { overlay, viewport } = mount();
    // A laid-out viewport: the picture starts 16 px in (the padding), is
    // pixel.width × zoom wide, and moves left as the viewport scrolls.
    const stage = overlay.parentElement as HTMLDivElement;
    Object.defineProperty(overlay, "getBoundingClientRect", {
      configurable: true,
      value: () => {
        const left = 16 - viewport.scrollLeft;
        const top = 16 - viewport.scrollTop;
        const width = parseFloat(stage.style.width);
        const height = parseFloat(stage.style.height);
        return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
      },
    });
    // the middle of cell (50, 20) at 6×
    const cursor = { clientX: 16 + 50.5 * 6, clientY: 16 + 20.5 * 6 };
    const hover = () => fireEvent.pointerMove(overlay, at(cursor.clientX, cursor.clientY, { buttons: 0 }));
    hover();
    expect(screen.getByText("50,20")).toBeTruthy();
    for (const [deltaY, zoom] of [[-100, 7], [-300, 10], [200, 8]] as const) {
      fireEvent(viewport, createEvent.wheel(viewport, { deltaY, ...cursor }));
      expect(screen.getByText(`zoom ${zoom}×`)).toBeTruthy();
      hover();
      expect(screen.getByText("50,20")).toBeTruthy();
    }
    expect(viewport.scrollLeft).toBeGreaterThan(0);
    expect(viewport.scrollTop).toBeGreaterThan(0);
  });

  it("switching layers drops the selection", () => {
    const { overlay, viewport } = mount();
    fireEvent.keyDown(viewport, { key: "s" });
    fireEvent.pointerDown(overlay, at(1, 1));
    fireEvent.pointerMove(overlay, at(4, 4));
    fireEvent.pointerUp(overlay, at(4, 4));
    expect(screen.getByText(/drag inside it to lift/)).toBeTruthy();
    const state = useLabStore.getState();
    state.addPixelLayer();
    // a fresh layer: the select tool is still on, but nothing is selected
    // (the hint reads the same); lifting where the old box was lifts nothing
    fireEvent.pointerDown(overlay, at(2, 2));
    fireEvent.pointerUp(overlay, at(2, 2));
    expect(screen.queryByTitle(/Stamp the selection down/)).toBeNull();
  });
});
