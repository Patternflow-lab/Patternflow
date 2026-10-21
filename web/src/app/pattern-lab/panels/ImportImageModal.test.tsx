// The import modal's wheel: over the preview it scales the image, and the
// card behind it stays where it is. jsdom loads no images, so a stand-in
// Image reports itself loaded as soon as it is given a source.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ImportImageModal from "./ImportImageModal";
import { rasterizeImage } from "@/lib/lab/pixelTools";
import { useLabStore } from "@/lib/lab/store";

// The placement the preview was last drawn with.
vi.mock("@/lib/lab/pixelTools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/lab/pixelTools")>();
  return { ...actual, rasterizeImage: vi.fn(actual.rasterizeImage) };
});
function lastPlacement() {
  const calls = vi.mocked(rasterizeImage).mock.calls;
  const transform = calls[calls.length - 1][5]!;
  return { scale: transform.scale!, x: transform.offsetX!, y: transform.offsetY! };
}

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

  it("a trackpad's small wheel events add up to one notch's 8%", async () => {
    const preview = mount();
    await loadImage();
    for (let i = 0; i < 10; i++) fireEvent(preview, createEvent.wheel(preview, { deltaY: -10 }));
    expect(screen.getByText(/108%/)).toBeTruthy();
  });

  it("the wheel keeps the point of the image under the cursor where it was", async () => {
    const preview = mount();
    await loadImage();
    // The setup lays the 128 × 64 preview out at the origin, one CSS pixel a
    // column. The image's centre is the preview's centre plus the offset.
    const cursor = { clientX: 96, clientY: 16 };
    const underCursor = () => {
      const { scale, x, y } = lastPlacement();
      return { x: (cursor.clientX - 64 - x) / scale, y: (cursor.clientY - 32 - y) / scale };
    };
    expect(underCursor()).toEqual({ x: 32, y: -16 });
    for (const deltaY of [-100, -250, 40]) {
      fireEvent(preview, createEvent.wheel(preview, { deltaY, ...cursor }));
      expect(underCursor().x).toBeCloseTo(32, 9);
      expect(underCursor().y).toBeCloseTo(-16, 9);
    }
    expect(lastPlacement().scale).toBeCloseTo(1.08 ** 3.1, 9);
  });
});
