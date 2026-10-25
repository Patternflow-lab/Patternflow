// The practice wall's card turns its knobs the way components/community/
// PatternCard.tsx does. It kept its own copy of that card's old step, floored
// at 0.001 and rounded to three decimals, so a knob declared 0.0001..0.0004
// fell to 0, below its range, on the first notch, and its bar showed the
// middle of that range as 15%.

import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { knobWheelValue } from "@/lib/pattern/controls";
import type { PracticePattern } from "./data";
import { PatternCard } from "./parts";
import { usePractice } from "./state";

const FINE: PracticePattern = {
  id: "fine",
  title: "Fine",
  code: "// @knobs Fine=0.0001..0.0004, Tight=0.001..0.002, Hue=0..1, Speed=0.1..10\nfunction draw(display) {}",
  hasCpp: false,
  handle: "engmung",
  license: "MIT",
};

const fresh = usePractice.getState();

function card() {
  const { container } = render(<PatternCard p={FINE} />);
  const el = container.querySelector<HTMLElement>('[data-pc-card="fine"]');
  if (!el) throw new Error("no card");
  return { container, el };
}

describe("practice wall card", () => {
  beforeEach(() => {
    usePractice.setState({ ...fresh, knobs: { fine: [0.00025, 0.0015, 0.5, 5.05] }, demo: null });
  });

  it("turns a fine knob a 25th of its range a notch, as the community's card does", () => {
    const { el } = card();
    fireEvent.keyDown(el, { key: "ArrowUp" });
    const turned = usePractice.getState().knobs.fine[0];
    expect(turned).toBe(0.000262);
    expect(turned).toBe(knobWheelValue(0.00025, [0.0001, 0.0004], 1));
  });

  it("stops a fine knob at the bottom of its range, not at 0", () => {
    usePractice.setState({ knobs: { fine: [0.0001, 0.0015, 0.5, 5.05] } });
    const { el } = card();
    fireEvent.keyDown(el, { key: "ArrowDown" });
    expect(usePractice.getState().knobs.fine[0]).toBe(0.0001);
  });

  it("fills the knob's bar to where the value sits in a fine range", () => {
    const { container } = card();
    const fill = container.querySelector<HTMLElement>(".metaKnobFill");
    expect(fill?.style.width).toBe("50%");
  });
});
