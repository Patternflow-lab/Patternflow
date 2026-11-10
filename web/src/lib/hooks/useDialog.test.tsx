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

// A window that opens on top of this one, the way To hardware opens Publish:
// the state comes back from a promise, so React commits it on its own
// schedule and runs the passive effects later still.
function UnderTop({ closed }: { closed: string[] }) {
  const [top, setTop] = useState(false);
  const cardRef = useDialog<HTMLDivElement>(() => closed.push(top ? "top" : "under"));
  return (
    <div role="dialog" aria-modal="true" aria-label="Under">
      <div ref={cardRef} tabIndex={-1}>
        <button type="button" onClick={() => void Promise.resolve().then(() => setTop(true))}>
          Open on top
        </button>
        {top && <p>On top</p>}
      </div>
    </div>
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

  it("an Esc that comes as soon as a window opened on top closes that window", async () => {
    // Until 24 October 2026 the newest onClose was taken in a passive effect.
    // An Esc between the commit and that effect closed the window underneath,
    // and on GitHub's runners the HardwareModal test sometimes landed there.
    const closed: string[] = [];
    render(<UnderTop closed={closed} />);
    const pressed = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (!screen.queryByText("On top")) return;
        observer.disconnect();
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        resolve();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    fireEvent.click(screen.getByText("Open on top"));
    await pressed;
    expect(closed).toEqual(["top"]);
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
