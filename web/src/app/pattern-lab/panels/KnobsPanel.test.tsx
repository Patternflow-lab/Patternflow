// The Knobs panel's sliders under the keyboard. A range input steps by its
// `step` on an arrow key, 0.001, so Freq's 10..120 took 110,000 presses; the
// panel turns one encoder detent instead and leaves the other keys alone.

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import KnobsPanel from "./KnobsPanel";
import { useLabStore } from "@/lib/lab/store";
import { knobDetentStep } from "@/lib/pattern/controls";
import { DETENTS_PER_TURN, TURNS_PER_FULL_RANGE } from "@/lib/shared/constants";

const store = () => useLabStore.getState();

beforeEach(() => {
  store().discardProject();
  useLabStore.setState({
    knobLabels: ["Hue", "Speed", "Quantize", "Freq"],
    ranges: [[0, 1], [0.1, 10], [2, 6], [10, 120]],
    knobs: [0, 2, 2, 10],
  });
});

describe("KnobsPanel", () => {
  it("turns a knob one detent on an arrow key, and keeps the input's own step from running", () => {
    render(<KnobsPanel />);
    const freq = screen.getByRole("slider", { name: "Freq value" });

    expect(fireEvent.keyDown(freq, { key: "ArrowRight" })).toBe(false);
    expect(store().knobs[3]).toBe(10 + knobDetentStep([10, 120]));
    expect(screen.getByText("12.292")).toBeInTheDocument();

    fireEvent.keyDown(freq, { key: "ArrowDown" });
    expect(store().knobs[3]).toBe(10);
    expect(store().knobs.slice(0, 3)).toEqual([0, 2, 2]);
  });

  it("crosses a knob's range in two turns of presses, as the encoder does", () => {
    render(<KnobsPanel />);
    const quantize = screen.getByRole("slider", { name: "Quantize value" });
    for (let press = 0; press < DETENTS_PER_TURN * TURNS_PER_FULL_RANGE; press++) {
      fireEvent.keyDown(quantize, { key: "ArrowUp" });
    }
    expect(store().knobs[2]).toBe(6);
    fireEvent.keyDown(quantize, { key: "ArrowRight" });
    expect(store().knobs[2]).toBe(6);
  });

  it("leaves Home, End, Page keys and Alt-arrows to the slider and the browser", () => {
    render(<KnobsPanel />);
    const speed = screen.getByRole("slider", { name: "Speed value" });
    for (const init of [{ key: "Home" }, { key: "End" }, { key: "PageUp" }, { key: "ArrowLeft", altKey: true }]) {
      expect(fireEvent.keyDown(speed, init)).toBe(true);
    }
    expect(store().knobs[1]).toBe(2);
  });
});
