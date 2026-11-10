// useBackdropClose: which presses on a modal's backdrop close it. A press is
// a pointerdown and then a click. Where the two land apart, the click is
// where Chromium sends it: the element both ends share, which for a drag out
// of the card is the backdrop.

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBackdropClose } from "./useBackdropClose";

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children?: ReactNode }) {
  const closeOnBackdrop = useBackdropClose(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} {...closeOnBackdrop}>
      <div>
        <textarea aria-label={`${label} text`} defaultValue="#pragma once" />
        <canvas
          aria-label={`${label} canvas`}
          onPointerDown={(event) => event.stopPropagation()}
        />
        {children}
      </div>
    </div>
  );
}

const backdrop = (label = "Outer") => screen.getByRole("dialog", { name: label });

afterEach(cleanup);

describe("useBackdropClose", () => {
  it("closes on a press that goes down and comes up on the backdrop", () => {
    const onClose = vi.fn();
    render(<Modal label="Outer" onClose={onClose} />);
    fireEvent.pointerDown(backdrop());
    fireEvent.click(backdrop());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when a drag across the text lets go on the backdrop", () => {
    const onClose = vi.fn();
    render(<Modal label="Outer" onClose={onClose} />);
    fireEvent.pointerDown(screen.getByLabelText("Outer text"));
    fireEvent.click(backdrop());
    expect(onClose).not.toHaveBeenCalled();
  });

  // A press on the backdrop that a scroll took over makes no click. The next
  // press began on a canvas that keeps its pointerdown to itself, and its
  // drag ended outside.
  it("hears a press that something inside keeps to itself", () => {
    const onClose = vi.fn();
    render(<Modal label="Outer" onClose={onClose} />);
    fireEvent.pointerDown(backdrop());
    fireEvent.pointerDown(screen.getByLabelText("Outer canvas"));
    fireEvent.click(backdrop());
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reads each click by its own press", () => {
    const onClose = vi.fn();
    render(<Modal label="Outer" onClose={onClose} />);
    fireEvent.pointerDown(backdrop());
    fireEvent.click(backdrop());
    fireEvent.click(backdrop());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // To hardware opens Send and Publish inside its own backdrop.
  it("closes the window on top alone", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Modal label="Outer" onClose={outer}>
        <Modal label="Inner" onClose={inner} />
      </Modal>,
    );
    fireEvent.pointerDown(backdrop("Inner"));
    fireEvent.click(backdrop("Inner"));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});
