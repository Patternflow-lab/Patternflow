// useDismiss: the Pattern Lab's header menus (Recent, Panels) closed only
// when the mouse left them. The fixture is built the way the lab builds them,
// a wrapper holding the toggle and the menu, with a field and a canvas beside
// it to press on and tab to.

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDismiss } from "./useDismiss";

function Header() {
  const [open, setOpen] = useState(false);
  const wrapRef = useDismiss<HTMLDivElement>(open, () => setOpen(false));
  return (
    <>
      <div ref={wrapRef}>
        <button type="button" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          Panels ▾
        </button>
        {open && (
          <div data-testid="menu">
            <button type="button">Preview</button>
            <button type="button">Pixel</button>
          </div>
        )}
      </div>
      <input aria-label="Pattern name" />
      {/* Like the dock, it keeps its presses from going any further. */}
      <canvas
        data-testid="canvas"
        ref={(canvas) => canvas?.addEventListener("pointerdown", (event) => event.stopPropagation())}
      />
    </>
  );
}

function openMenu() {
  const toggle = screen.getByText("Panels ▾");
  toggle.focus();
  fireEvent.click(toggle);
  expect(screen.getByTestId("menu")).toBeTruthy();
  return toggle;
}

describe("useDismiss", () => {
  it("a press outside the menu closes it", () => {
    render(<Header />);
    openMenu();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId("menu")).toBeNull();
  });

  it("a press on a canvas that keeps its presses still closes it", () => {
    render(<Header />);
    openMenu();
    fireEvent.pointerDown(screen.getByTestId("canvas"));
    expect(screen.queryByTestId("menu")).toBeNull();
  });

  it("a press on an item leaves it open", () => {
    render(<Header />);
    openMenu();
    fireEvent.pointerDown(screen.getByText("Pixel"));
    expect(screen.getByTestId("menu")).toBeTruthy();
  });

  it("the toggle still closes it, in one press", () => {
    render(<Header />);
    const toggle = openMenu();
    fireEvent.pointerDown(toggle);
    fireEvent.click(toggle);
    expect(screen.queryByTestId("menu")).toBeNull();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("Esc closes it and puts the focus back on the toggle", () => {
    render(<Header />);
    const toggle = openMenu();
    const item = screen.getByText("Pixel");
    item.focus();
    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.queryByTestId("menu")).toBeNull();
    expect(toggle).toHaveFocus();
  });

  it("Tab from its last item to the next field closes it", () => {
    render(<Header />);
    openMenu();
    const field = screen.getByLabelText("Pattern name");
    fireEvent.focusOut(screen.getByText("Pixel"), { relatedTarget: field });
    expect(screen.queryByTestId("menu")).toBeNull();
  });

  it("the focus moving between its own items leaves it open", () => {
    render(<Header />);
    openMenu();
    fireEvent.focusOut(screen.getByText("Preview"), { relatedTarget: screen.getByText("Pixel") });
    expect(screen.getByTestId("menu")).toBeTruthy();
  });

  it("a closed menu hears nothing", () => {
    render(<Header />);
    const toggle = screen.getByText("Panels ▾");
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(screen.getByTestId("menu")).toBeTruthy();
  });
});
