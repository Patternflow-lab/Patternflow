// "Copy prompt" in the Code panel. A browser can refuse the clipboard write
// (no permission, a page served over plain http). The button used to keep its
// label and leave an unhandled rejection behind, so the next paste into the
// model carried whatever the clipboard held before.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodePanel from "./CodePanel";
import { useLabStore } from "@/lib/lab/store";

vi.mock("@monaco-editor/react", () => ({ default: () => <textarea aria-label="Code" /> }));

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

beforeEach(() => {
  useLabStore.getState().discardProject();
});

afterEach(() => {
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("CodePanel copy prompt", () => {
  it("says Copied once the prompt is on the clipboard", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    setClipboard({ writeText });
    render(<CodePanel />);

    fireEvent.click(screen.getByText("Copy prompt"));
    await act(async () => {});

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Copied")).toBeTruthy();
  });

  it("says Copy failed when the browser refuses the write", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")),
    );
    setClipboard({ writeText });
    render(<CodePanel />);

    fireEvent.click(screen.getByText("Copy prompt"));
    await act(async () => {});

    expect(screen.getByText("Copy failed")).toBeTruthy();
    expect(screen.queryByText("Copied")).toBeNull();
  });

  it("says Copy failed on a page with no clipboard at all", async () => {
    render(<CodePanel />);

    fireEvent.click(screen.getByText("Copy prompt"));
    await act(async () => {});

    expect(screen.getByText("Copy failed")).toBeTruthy();
  });

  it("goes back to Copy prompt after a moment", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      setClipboard({ writeText: () => Promise.reject(new Error("denied")) });
      render(<CodePanel />);

      fireEvent.click(screen.getByText("Copy prompt"));
      await act(async () => {});
      expect(screen.getByText("Copy failed")).toBeTruthy();

      act(() => vi.advanceTimersByTime(1200));
      expect(screen.getByText("Copy prompt")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
