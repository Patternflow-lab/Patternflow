// useDialog: the keys and the focus a Pattern Lab modal owes. Each case opens
// a small dialog from a real button, the way the lab does, so the focus has
// somewhere to come back to.

import { useState } from "react";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDialog } from "./useDialog";

function Dialog({ onClose }: { onClose: () => void }) {
  const cardRef = useDialog<HTMLDivElement>(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label="Example">
      <div ref={cardRef} tabIndex={-1} data-testid="card">
        <input aria-label="Field" />
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

function Page({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && <Dialog onClose={close} />}
    </>
  );
}

function open() {
  const opener = screen.getByText("Open");
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("useDialog", () => {
  it("moves the focus into the dialog when it opens", () => {
    render(<Page />);
    open();
    expect(screen.getByTestId("card")).toHaveFocus();
  });

  it("Esc closes it and the focus goes back to the button that opened it", () => {
    render(<Page />);
    const opener = open();
    fireEvent.keyDown(screen.getByLabelText("Field"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("Esc still closes it after the focus fell to the body", () => {
    render(<Page />);
    open();
    (document.activeElement as HTMLElement).blur();
    expect(document.body).toHaveFocus();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves an Esc that something inside already used", () => {
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    open();
    const field = screen.getByLabelText("Field");
    const used = createEvent.keyDown(field, { key: "Escape" });
    used.preventDefault();
    fireEvent(field, used);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("leaves an Esc that ends an IME composition", () => {
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    open();
    fireEvent.keyDown(screen.getByLabelText("Field"), { key: "Escape", isComposing: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("hears other keys as nothing", () => {
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    open();
    fireEvent.keyDown(screen.getByLabelText("Field"), { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stops listening once it is closed", () => {
    const onClose = vi.fn();
    render(<Page onClose={onClose} />);
    open();
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
