// Del in the layer stack. There is no undo for it, so a layer with work in it
// asks first; a blank one goes straight away.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import LayersPanel from "./LayersPanel";
import { useLabStore } from "@/lib/lab/store";

const store = () => useLabStore.getState();
const names = () => store().layers.map((layer) => layer.name);
const del = () => screen.getByRole("button", { name: "Del" });

function drawOnePixel() {
  const layer = store().layers.find((entry) => entry.id === store().activeLayerId);
  if (!layer || layer.type !== "pixel") throw new Error("active layer is not pixel");
  const data = new Uint8ClampedArray(layer.data);
  data.set([255, 77, 0, 255], 0);
  store().replacePixelData(layer.id, data);
}

beforeEach(() => {
  store().discardProject();
});

describe("LayersPanel Del", () => {
  it("is disabled while the stack has one layer", () => {
    render(<LayersPanel />);
    expect(del()).toBeDisabled();
  });

  it("deletes a pixel layer nobody has drawn on without asking", () => {
    store().addPixelLayer();
    const confirm = vi.spyOn(window, "confirm");
    render(<LayersPanel />);
    fireEvent.click(del());
    expect(confirm).not.toHaveBeenCalled();
    expect(names()).toEqual(["Code 1"]);
  });

  it("deletes a code layer still holding the starter pattern without asking", () => {
    store().addCodeLayer();
    const confirm = vi.spyOn(window, "confirm");
    render(<LayersPanel />);
    fireEvent.click(del());
    expect(confirm).not.toHaveBeenCalled();
    expect(names()).toEqual(["Code 1"]);
  });

  it("asks before deleting a drawn pixel layer, and Cancel keeps it", () => {
    store().addPixelLayer();
    drawOnePixel();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<LayersPanel />);
    fireEvent.click(del());
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm.mock.calls[0][0]).toContain('"Pixel 1"');
    expect(names()).toEqual(["Pixel 1", "Code 1"]);
    const kept = store().layers[0];
    expect(kept.type === "pixel" ? kept.data[3] : -1).toBe(255);
  });

  it("deletes the drawn pixel layer once confirmed", () => {
    store().addPixelLayer();
    drawOnePixel();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<LayersPanel />);
    fireEvent.click(del());
    expect(names()).toEqual(["Code 1"]);
    expect(store().activeLayerId).toBe(store().layers[0].id);
  });

  it("asks before deleting a code layer whose code was changed", () => {
    store().addPixelLayer();
    store().selectLayer(store().layers[1].id);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<LayersPanel />);
    fireEvent.click(del());
    expect(confirm.mock.calls[0][0]).toContain('"Code 1"');
    expect(names()).toEqual(["Pixel 1", "Code 1"]);
  });
});

describe("LayersPanel + Text", () => {
  it("adds a text layer on top, marked TX", () => {
    render(<LayersPanel />);
    fireEvent.click(screen.getByRole("button", { name: "+ Text" }));
    expect(names()).toEqual(["Text 1", "Code 1"]);
    expect(screen.getByText("TX")).toBeInTheDocument();
  });

  it("deletes a text layer that says nothing without asking, and asks for one that says something", () => {
    store().addTextLayer();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<LayersPanel />);
    fireEvent.click(del());
    expect(confirm).toHaveBeenCalledOnce();
    expect(names()).toEqual(["Text 1", "Code 1"]);

    act(() => store().setTextSpec(store().layers[0].id, { text: "  " }));
    fireEvent.click(del());
    expect(confirm).toHaveBeenCalledOnce();
    expect(names()).toEqual(["Code 1"]);
  });
});

// A row was a div with role="button" and no tabindex, so Tab skipped it, and
// reordering was drag and drop only, which most phones do not start.
describe("LayersPanel without a mouse", () => {
  const row = (name: string) => screen.getByText(name).closest<HTMLElement>("[data-layer-id]")!;

  it("takes focus on a row, and Enter selects it", () => {
    store().addPixelLayer();
    render(<LayersPanel />);
    expect(row("Code 1").tabIndex).toBe(0);
    fireEvent.keyDown(row("Code 1"), { key: "Enter" });
    expect(store().activeLayerId).toBe(store().layers[1].id);
  });

  it("moves a row with Alt and an arrow", () => {
    store().addPixelLayer();
    render(<LayersPanel />);
    fireEvent.keyDown(row("Code 1"), { key: "ArrowUp", altKey: true });
    expect(names()).toEqual(["Code 1", "Pixel 1"]);
    fireEvent.keyDown(row("Code 1"), { key: "ArrowUp" });
    expect(names()).toEqual(["Code 1", "Pixel 1"]);
  });

  it("renames on F2", () => {
    render(<LayersPanel />);
    fireEvent.keyDown(row("Code 1"), { key: "F2" });
    const field = screen.getByDisplayValue("Code 1");
    fireEvent.change(field, { target: { value: "Bars" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(names()).toEqual(["Bars"]);
  });
});
