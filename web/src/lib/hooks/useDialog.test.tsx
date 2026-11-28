// useDialog: the keys and the focus a Pattern Lab modal owes. Each case opens
// a small dialog from a real button, the way the lab does, so the focus has
// somewhere to come back to.

import { useState, type ReactNode } from "react";
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

function Page({
  onClose,
  dialog = (close) => <Dialog onClose={close} />,
}: {
  onClose?: () => void;
  dialog?: (close: () => void) => ReactNode;
}) {
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
      {open && dialog(close)}
    </>
  );
}

function RadioDialog({ onClose }: { onClose: () => void }) {
  const cardRef = useDialog<HTMLDivElement>(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label="Radios">
      <div ref={cardRef} tabIndex={-1}>
        <button type="button" onClick={onClose}>
          Close
        </button>
        {["A", "B", "C"].map((name) => (
          <label key={name}>
            <input type="radio" name="reason" value={name} />
            {name}
          </label>
        ))}
      </div>
    </div>
  );
}

// A window drawn inside another, the way To hardware draws Send.
function Outer({ onClose }: { onClose: () => void }) {
  const [inner, setInner] = useState(false);
  const cardRef = useDialog<HTMLDivElement>(() => (inner ? setInner(false) : onClose()));
  return (
    <div role="dialog" aria-modal="true" aria-label="Outer">
      <div ref={cardRef} tabIndex={-1}>
        <input aria-label="Field" />
        <button type="button" onClick={() => setInner(true)}>
          Open inner
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
        {inner && <Inner onClose={() => setInner(false)} />}
      </div>
    </div>
  );
}

function Inner({ onClose }: { onClose: () => void }) {
  const cardRef = useDialog<HTMLDivElement>(onClose);
  return (
    <div role="dialog" aria-modal="true" aria-label="Inner">
      <div ref={cardRef} tabIndex={-1}>
        <input aria-label="Inner field" />
        <button type="button" onClick={onClose}>
          Close inner
        </button>
      </div>
    </div>
  );
}

function Nested() {
  return <Page dialog={(close) => <Outer onClose={close} />} />;
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

  it("Tab goes round the dialog's own controls", () => {
    render(<Page />);
    open();
    const field = screen.getByLabelText("Field");
    const close = screen.getByText("Close");

    // From the card Tab starts at the first control, Shift+Tab at the last.
    fireEvent.keyDown(screen.getByTestId("card"), { key: "Tab" });
    expect(field).toHaveFocus();
    fireEvent.keyDown(field, { key: "Tab", shiftKey: true });
    expect(close).toHaveFocus();
    expect(fireEvent.keyDown(close, { key: "Tab" })).toBe(false);
    expect(field).toHaveFocus();
    // Between the two the browser moves the focus itself.
    expect(fireEvent.keyDown(field, { key: "Tab" })).toBe(true);
  });

  it("brings a Tab from the page behind back into the dialog", () => {
    render(<Page />);
    const opener = open();
    opener.focus();
    fireEvent.keyDown(opener, { key: "Tab" });
    expect(screen.getByLabelText("Field")).toHaveFocus();
  });

  it("leaves a Tab that something inside already used", () => {
    render(<Page />);
    open();
    const close = screen.getByText("Close");
    close.focus();
    const used = createEvent.keyDown(close, { key: "Tab" });
    used.preventDefault();
    fireEvent(close, used);
    expect(close).toHaveFocus();
  });

  // A in a group of three, last in the dialog: the browser's next stop after
  // A is outside, so A is the one to wrap from, not C.
  it("counts a radio group with a choice made as one stop", () => {
    render(<Page dialog={(close) => <RadioDialog onClose={close} />} />);
    open();
    const a = screen.getByLabelText("A");
    fireEvent.click(a);
    a.focus();
    expect(fireEvent.keyDown(a, { key: "Tab" })).toBe(false);
    expect(screen.getByText("Close")).toHaveFocus();
  });

  it("holds the page still while it is open and lets it go after", () => {
    document.body.style.overflow = "auto";
    render(<Page />);
    open();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByText("Close"));
    expect(document.body.style.overflow).toBe("auto");
    document.body.style.overflow = "";
  });

  it("gives Tab to the window on top and holds the page until the last one closes", () => {
    render(<Nested />);
    open();
    fireEvent.click(screen.getByText("Open inner"));
    const innerClose = screen.getByText("Close inner");
    innerClose.focus();
    fireEvent.keyDown(innerClose, { key: "Tab" });
    expect(screen.getByLabelText("Inner field")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(innerClose);
    expect(screen.queryByLabelText("Inner field")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    const outerClose = screen.getByText("Close");
    outerClose.focus();
    fireEvent.keyDown(outerClose, { key: "Tab" });
    expect(screen.getByLabelText("Field")).toHaveFocus();

    fireEvent.click(outerClose);
    expect(document.body.style.overflow).toBe("");
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
