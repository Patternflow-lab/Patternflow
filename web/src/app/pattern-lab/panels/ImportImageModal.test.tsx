// The import modal's wheel: over the preview it scales the image, and the
// card behind it stays where it is. jsdom loads no images, so a stand-in
// Image reports itself loaded as soon as it is given a source.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImportImageModal from "./ImportImageModal";
import { useLabStore } from "@/lib/lab/store";

class LoadedImage {
  width = 32;
  height = 16;
  onload: (() => void) | null = null;
  set src(_url: string) {
    queueMicrotask(() => this.onload?.());
  }
}

function mount() {
  useLabStore.getState().discardProject();
  useLabStore.getState().addPixelLayer();
  const layer = useLabStore.getState().layers.find((entry) => entry.type === "pixel")!;
  render(
    <ImportImageModal width={128} height={64} layerId={layer.id} onApply={() => {}} onClose={() => {}} />,
  );
  return screen.getByLabelText(/^Import preview/);
}

async function loadImage() {
  const file = new File(["x"], "pic.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Choose image"), { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText("Apply to layer")).toBeEnabled());
}

beforeEach(() => {
  vi.stubGlobal("Image", LoadedImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ImportImageModal", () => {
  it("leaves the wheel alone until there is an image to scale", () => {
    const preview = mount();
    const up = createEvent.wheel(preview, { deltaY: -100 });
    fireEvent(preview, up);
    expect(up.defaultPrevented).toBe(false);
    expect(screen.getByText(/100%/)).toBeTruthy();
  });

  it("the wheel scales the image from the moment Apply turns on", async () => {
    const preview = mount();
    const file = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Choose image"), { target: { files: [file] } });
    // waitFor looks again on every DOM change, so the first look that finds
    // Apply enabled is right after React wrote it, before anything later.
    let prevented: boolean | null = null;
    await waitFor(() => {
      expect(screen.getByText("Apply to layer")).toBeEnabled();
      if (prevented === null) {
        const up = createEvent.wheel(preview, { deltaY: -100 });
        preview.dispatchEvent(up);
        prevented = up.defaultPrevented;
      }
    });
    expect(prevented).toBe(true);
  });

  it("the wheel scales the image and does not scroll the card", async () => {
    const preview = mount();
    await loadImage();
    const up = createEvent.wheel(preview, { deltaY: -100 });
    fireEvent(preview, up);
    expect(up.defaultPrevented).toBe(true);
    expect(screen.getByText(/108%/)).toBeTruthy();
    const down = createEvent.wheel(preview, { deltaY: 100 });
    fireEvent(preview, down);
    expect(down.defaultPrevented).toBe(true);
    expect(screen.getByText(/100%/)).toBeTruthy();
    const sideways = createEvent.wheel(preview, { deltaX: 100, deltaY: 0 });
    fireEvent(preview, sideways);
    expect(sideways.defaultPrevented).toBe(false);
    expect(screen.getByText(/100%/)).toBeTruthy();
  });
});
