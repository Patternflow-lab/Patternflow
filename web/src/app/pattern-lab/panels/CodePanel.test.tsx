// "Copy prompt" in the Code panel. A browser can refuse the clipboard write
// (no permission, a page served over plain http). The button used to keep its
// label and leave an unhandled rejection behind, so the next paste into the
// model carried whatever the clipboard held before.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CodePanel from "./CodePanel";
import { useLabStore } from "@/lib/lab/store";

// A textarea standing in for Monaco: typing is onChange, and leaving it is the
// blur listener the panel registers in onMount.
vi.mock("@monaco-editor/react", async () => {
  const { useEffect, useRef } = await import("react");
  type Props = {
    value?: string;
    onChange?: (value: string | undefined) => void;
    onMount?: (editor: { onDidBlurEditorWidget: (listener: () => void) => void }) => void;
  };
  return {
    default: function Editor({ value, onChange, onMount }: Props) {
      const blur = useRef<(() => void) | null>(null);
      const mount = useRef(onMount);
      useEffect(() => {
        mount.current?.({
          onDidBlurEditorWidget: (listener) => {
            blur.current = listener;
          },
        });
      }, []);
      return (
        <textarea
          aria-label="Code"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onBlur={() => blur.current?.()}
        />
      );
    },
  };
});

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

// The colour mode used to be picked in the Gallery tab, which went on
// 23 October 2026. It sits beside Copy prompt now, and the prompt follows it.
describe("CodePanel colour mode", () => {
  it("copies a v-field prompt until rgb is picked, then an rgb one", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    setClipboard({ writeText });
    render(<CodePanel />);

    const mode = screen.getByRole("combobox", { name: "Color mode" }) as HTMLSelectElement;
    expect(mode.value).toBe("vfield");
    fireEvent.click(screen.getByText("Copy prompt"));
    await act(async () => {});
    expect(writeText.mock.calls[0][0]).toContain("display.setValue(x, y, v)");

    fireEvent.change(mode, { target: { value: "rgb" } });
    expect(useLabStore.getState().gen).toEqual({ colorMode: "rgb" });
    fireEvent.click(screen.getByText("Copied"));
    await act(async () => {});
    expect(writeText.mock.calls[1][0]).toContain("display.setPixel(x, y, r, g, b)");
    expect(writeText.mock.calls[1][0]).not.toContain("Do NOT call display.setPixel");
  });
});

// The @matrix line, typed. Until 24 October 2026 each keystroke changed the
// frame, so typing 96 over 128 cropped every pixel layer to 12, then 9
// columns (lib/lab/store/layers.test.ts has the numbers).
describe("CodePanel @matrix line", () => {
  const BODY = "export function draw(display) {}\n";

  it("changes the frame when focus leaves the editor, not while typing", () => {
    render(<CodePanel />);
    const editor = screen.getByLabelText("Code");

    fireEvent.change(editor, { target: { value: `// @matrix 9x64\n${BODY}` } });
    fireEvent.change(editor, { target: { value: `// @matrix 96x64\n${BODY}` } });
    expect(useLabStore.getState().matrix).toEqual({ width: 128, height: 64 });
    expect(screen.getByRole("status").textContent).toBe("The frame becomes 96×64 when you leave the editor.");

    fireEvent.blur(editor);
    expect(useLabStore.getState().matrix).toEqual({ width: 96, height: 64 });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says the frame stays when the line is out of range", () => {
    render(<CodePanel />);
    const editor = screen.getByLabelText("Code");

    fireEvent.change(editor, { target: { value: `// @matrix 1x64\n${BODY}` } });
    fireEvent.blur(editor);
    expect(useLabStore.getState().matrix).toEqual({ width: 128, height: 64 });
    expect(screen.getByRole("status").textContent).toBe(
      "The @matrix line needs each side from 8 to 512. The frame stays 128×64.",
    );
  });

  it("takes up a held line when the panel closes", () => {
    const { unmount } = render(<CodePanel />);
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: `// @matrix 64x64\n${BODY}` } });
    expect(useLabStore.getState().matrix).toEqual({ width: 128, height: 64 });

    unmount();
    expect(useLabStore.getState().matrix).toEqual({ width: 64, height: 64 });
  });
});
