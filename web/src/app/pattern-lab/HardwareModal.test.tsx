// The To hardware modal opens Send and Publish inside its own backdrop. A
// press on their backdrop closes them, and before the fix the same click went
// on up to this backdrop and closed To hardware as well. The header the model
// translated lives only in this modal's state, so it went with it.
//
// Esc goes the same way. Send and Publish listen for no keys, so this modal
// hears the Esc meant for them, and it closes the one on top.
//
// The modal is mounted the way the lab mounts it, behind an open flag that
// onClose clears, so a stray close really unmounts it and the pasted header
// is really gone.

import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareModal from "./HardwareModal";
import { useLabStore } from "@/lib/lab/store";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/community/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u1", username: "ada" } }, isPending: false }),
  },
}));

const HEADER = "#pragma once\nnamespace Lab { void draw() {} }\n";
const CODE = "export function draw(display) { display.setPixel(0, 0, 255, 0, 0); }";

function Lab() {
  const [open, setOpen] = useState(true);
  return open ? (
    <HardwareModal onClose={() => setOpen(false)} exportCode={async () => CODE} />
  ) : (
    <p>closed</p>
  );
}

function hardware() {
  return screen.getByRole("dialog", { name: "Hardware" });
}

/** Paste a header, press Next, and land on the "On to hardware" stage. */
function pasteHeaderAndContinue() {
  fireEvent.change(screen.getByPlaceholderText(/Paste the \.h the model gives you/), {
    target: { value: HEADER },
  });
  fireEvent.click(screen.getByText("Next →"));
  expect(screen.getByText("On to hardware")).toBeTruthy();
}

/** The header is still in the modal: back on the first stage, in the box. */
function expectHeaderKept() {
  expect(hardware()).toBeTruthy();
  fireEvent.click(screen.getByText("← Back to the header"));
  expect(screen.getByPlaceholderText(/Paste the \.h the model gives you/)).toHaveValue(HEADER);
}

beforeEach(() => {
  useLabStore.getState().discardProject();
  vi.stubEnv("NEXT_PUBLIC_BUILD_ENABLED", "1");
  vi.stubEnv("NEXT_PUBLIC_COMMUNITY_URL", "https://patternflow.work");
  // Nothing here should reach the network; a request that does stays unanswered.
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("HardwareModal", () => {
  it("a press on the Send modal's backdrop closes Send and keeps the header", () => {
    render(<Lab />);
    pasteHeaderAndContinue();
    fireEvent.click(screen.getByText("↗ Apply to my Patternflow"));
    const send = screen.getByText("Send to my Patternflow").closest('[role="dialog"]')!;

    fireEvent.click(send);

    expect(screen.queryByText("Send to my Patternflow")).toBeNull();
    expectHeaderKept();
  });

  it("a press on the Publish modal's backdrop closes Publish and keeps the header", async () => {
    render(<Lab />);
    pasteHeaderAndContinue();
    fireEvent.click(screen.getByText("Upload to the community"));
    const title = await screen.findByText("Share to Community");
    const publish = title.closest('[role="dialog"]')!;

    fireEvent.click(publish);

    await waitFor(() => expect(screen.queryByText("Share to Community")).toBeNull());
    expectHeaderKept();
  });

  it("a press inside the card leaves the modal open", () => {
    render(<Lab />);
    fireEvent.click(screen.getByText("Convert to a firmware header"));
    expect(hardware()).toBeTruthy();
  });

  it("a press on its own backdrop still closes it", () => {
    render(<Lab />);
    fireEvent.click(hardware());
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("opens with the focus inside it", () => {
    render(<Lab />);
    expect(hardware().contains(document.activeElement)).toBe(true);
  });

  it("Esc closes it", () => {
    render(<Lab />);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("closed")).toBeTruthy();
  });

  it("Esc over the Send modal closes Send alone and keeps the header", () => {
    render(<Lab />);
    pasteHeaderAndContinue();
    fireEvent.click(screen.getByText("↗ Apply to my Patternflow"));
    expect(screen.getByText("Send to my Patternflow")).toBeTruthy();

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(screen.queryByText("Send to my Patternflow")).toBeNull();
    expect(hardware().contains(document.activeElement)).toBe(true);
    expectHeaderKept();
  });

  // The prompt goes to a model by paste. When the browser refuses the write,
  // the label used to stay as it was, and the paste carried whatever the
  // clipboard held before.
  it("says Copy failed on the button whose copy the browser refused", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")),
    );
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<Lab />);
      fireEvent.click(screen.getByText("Copy the conversion prompt"));
      expect(await screen.findByText("Copy failed")).toBeTruthy();
      expect(screen.getByText("Copy .h")).toBeTruthy();

      writeText.mockImplementation(() => Promise.resolve());
      fireEvent.click(screen.getByText("Copy failed"));
      expect(await screen.findByText("Copied ✓")).toBeTruthy();
      expect(writeText).toHaveBeenCalledTimes(2);
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  // A chat answer copied whole carries the model's words and the ``` fence
  // around the code. The box used to pass it as a header, because the check
  // found #pragma once on any line, and the words went into the .h whole.
  it("keeps only the header when a whole chat answer is pasted", async () => {
    const header = [
      "// SPDX-License-Identifier: CC-BY-SA-4.0",
      "// Pattern: Wave",
      "#pragma once",
      "namespace LabWave {",
      '  const char* NAME = "Wave";',
      "  void draw() {}",
      "} // namespace LabWave",
    ].join("\n");
    const reply = `Here is the converted header:\n\n\`\`\`cpp\n${header}\n\`\`\`\n\nLet me know if you want the colours warmer.`;
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<Lab />);
      fireEvent.change(screen.getByPlaceholderText(/Paste the \.h the model gives you/), {
        target: { value: reply },
      });
      expect(screen.getByText(/Looks like a header ✓/)).toHaveTextContent("The words around it stay out of the .h.");

      fireEvent.click(screen.getByText("Copy .h"));
      expect(await screen.findByText("Copied ✓")).toBeTruthy();
      const name = useLabStore.getState().layers[0].name;
      expect(writeText).toHaveBeenCalledWith(header.replace('"Wave"', `"${name}"`));
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("finds no header in an answer whose #pragma once is in a sentence", () => {
    render(<Lab />);
    fireEvent.change(screen.getByPlaceholderText(/Paste the \.h the model gives you/), {
      target: { value: "Sure. The header starts with #pragma once and ends with the namespace." },
    });
    expect(screen.getByText("A Patternflow header starts with #pragma once")).toBeTruthy();
    expect(screen.getByText("Copy .h")).toBeDisabled();
    expect(screen.getByText("Next →")).toBeDisabled();
  });

  // Copy .h used to be the one button open on an empty box. It put nothing
  // on the clipboard and said Copied ✓.
  it("keeps Copy .h shut until a header is pasted", () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<Lab />);
      expect(screen.getByText("Copy .h")).toBeDisabled();
      fireEvent.click(screen.getByText("Copy .h"));
      expect(writeText).not.toHaveBeenCalled();
      expect(screen.queryByText("Copied ✓")).toBeNull();

      fireEvent.change(screen.getByPlaceholderText(/Paste the \.h the model gives you/), {
        target: { value: HEADER },
      });
      expect(screen.getByText("Looks like a header ✓")).toBeTruthy();
      expect(screen.getByText("Copy .h")).toBeEnabled();
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  // Text and pixel layers are in the scaffold as pixels, so with no code
  // layer the header is whole. The window used to count "0 layers to
  // translate — 0 done" and send the person to a model anyway.
  it("a stack of text alone is a finished header, with no model to ask", async () => {
    const lab = useLabStore.getState();
    const starter = lab.layers[0].id;
    lab.addTextLayer();
    useLabStore.getState().removeLayer(starter);
    expect(useLabStore.getState().layers.map((layer) => layer.type)).toEqual(["text"]);
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<Lab />);
      expect(screen.getByText(/Nothing here needs a model/)).toHaveTextContent("The board needs no font for the letters.");
      expect(screen.queryByText(/to translate/)).toBeNull();
      expect(screen.queryByText(/Translating it is a model/)).toBeNull();
      expect(screen.queryByText("Copy prompt")).toBeNull();

      fireEvent.click(screen.getByText("Copy .h"));
      expect(await screen.findByText("Copied ✓")).toBeTruthy();
      const header = String(writeText.mock.calls[0][0]);
      expect(header).toMatch(/^#pragma once$/m);
      expect(header).toContain('"Text 1": text as drawn, RLE');
      expect(header).not.toContain("TRANSLATION BEGIN");

      fireEvent.click(screen.getByText("Next →"));
      expect(screen.getByText("On to hardware")).toBeTruthy();
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("says a scrolling text scrolls on the board too, and the header carries the steps", async () => {
    const lab = useLabStore.getState();
    const starter = lab.layers[0].id;
    lab.addTextLayer();
    useLabStore.getState().removeLayer(starter);
    const [layer] = useLabStore.getState().layers;
    if (layer.type !== "text") throw new Error("not text");
    const height = layer.height;
    const source = { x: 4, width: 10, data: new Uint8ClampedArray(10 * height * 4).fill(255) };
    useLabStore.setState({ layers: [{ ...layer, spec: { ...layer.spec, effect: "scroll" }, source }] });
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<Lab />);
      expect(screen.getByText(/Nothing here needs a model/)).toHaveTextContent("Text that moves moves there too, on the same knob.");
      fireEvent.click(screen.getByText("Copy .h"));
      expect(await screen.findByText("Copied ✓")).toBeTruthy();
      const header = String(writeText.mock.calls[0][0]);
      expect(header).toContain('"Text 1": text, scroll on knob 2');
      expect(header).toContain("advanceText(&L0_phase, dt, knobNorm[1], 128.0f, (float)L0_PERIOD);");
      expect(header).toContain("textScroll(layerBuf[0], L0_src");
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  // Two code layers make a stack, and the stack's scaffold has #pragma once
  // before anything is pasted. Next used to open on "0 done" and say "Header
  // ready", and on the board both stubs drew nothing: a black screen.
  it("a stack of two code layers waits for one translation, then names the stub left", () => {
    useLabStore.getState().addCodeLayer();
    const bottom = useLabStore.getState().layers[1];
    const unit = (index: number) =>
      `namespace L${index} {\n  void setup() {}\n  void update(float dt, const InputFrame& input) {}\n  void draw() {}\n}`;
    render(<Lab />);

    expect(screen.getByText(/2 layers to translate — 0 done/)).toHaveTextContent(
      "Next opens when one of them is translated.",
    );
    expect(screen.getByText("Next →")).toBeDisabled();
    fireEvent.click(screen.getByText("Next →"));
    expect(screen.queryByText("On to hardware")).toBeNull();

    fireEvent.change(screen.getByPlaceholderText(/Paste the namespace L1 \{/), { target: { value: unit(1) } });
    expect(screen.getByText(/1 done/)).not.toHaveTextContent("Next opens");
    fireEvent.click(screen.getByText("Next →"));
    expect(screen.getByText("On to hardware")).toBeTruthy();
    expect(screen.getByText(/Header built \([\d.]+ KB\) with 1 of 2 layers translated\./)).toBeTruthy();
    expect(screen.queryByText(/Header ready/)).toBeNull();
    expect(screen.getByText(/^Not translated:/)).toHaveTextContent(
      `Not translated: L0 · ${bottom.name}. On the board it draws nothing until you go back and paste its translation.`,
    );

    fireEvent.click(screen.getByText("← Back to the header"));
    fireEvent.change(screen.getByPlaceholderText(/Paste the namespace L0 \{/), { target: { value: unit(0) } });
    fireEvent.click(screen.getByText("Next →"));
    expect(screen.getByText(/Header ready \([\d.]+ KB\)\./)).toBeTruthy();
    expect(screen.queryByText(/Not translated/)).toBeNull();
  });

  // With one layer showing, the community gets that layer. The prompt used to
  // take the layer picked in Layers even when it was hidden or at 0%, so the
  // board got a pattern nobody could see in the preview.
  it.each([
    ["hidden", (id: string) => useLabStore.getState().setLayerVisible(id, false)],
    ["at 0%", (id: string) => useLabStore.getState().setLayerOpacity(id, 0)],
  ])("translates the layer that shows when the picked one is %s", async (_, hide) => {
    const lab = useLabStore.getState();
    const starter = lab.layers[0].id;
    lab.addCodeLayerFromCode("export function draw(display) { display.setPixel(1, 1, 0, 255, 0); } // shown", "Shown");
    useLabStore.getState().addCodeLayerFromCode("export function draw(display) { display.setPixel(2, 2, 0, 0, 255); } // hidden", "Hidden");
    useLabStore.getState().removeLayer(starter);
    const picked = useLabStore.getState().activeLayerId;
    expect(useLabStore.getState().layers.find((layer) => layer.id === picked)?.name).toBe("Hidden");
    hide(picked);
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    try {
      render(<Lab />);
      fireEvent.click(screen.getByText("Copy the conversion prompt"));
      expect(await screen.findByText("Copied ✓")).toBeTruthy();
      const prompt = String(writeText.mock.calls[0][0]);
      expect(prompt).toContain("// shown");
      expect(prompt).not.toContain("// hidden");

      // The build carries the shown layer's name too.
      pasteHeaderAndContinue();
      fireEvent.click(screen.getByText("↗ Apply to my Patternflow"));
      const request = vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith("/api/community/builds"));
      expect(JSON.parse(String(request?.[1]?.body)).patterns[0].label).toBe("Shown");
    } finally {
      delete (navigator as { clipboard?: unknown }).clipboard;
    }
  });

  it("a code layer under a text layer is the one to translate before Next", () => {
    useLabStore.getState().addTextLayer();
    render(<Lab />);
    expect(screen.getByText(/1 layer to translate — 0 done/)).toHaveTextContent("Next opens when it is translated.");
    expect(screen.getByText("Next →")).toBeDisabled();
    expect(screen.getByText("Next →")).toHaveAttribute("title", "Paste the translation of one layer first");
  });

  it("Esc over the Publish modal closes Publish alone and keeps the header", async () => {
    render(<Lab />);
    pasteHeaderAndContinue();
    fireEvent.click(screen.getByText("Upload to the community"));
    await screen.findByText("Share to Community");

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    await waitFor(() => expect(screen.queryByText("Share to Community")).toBeNull());
    expectHeaderKept();
  });
});
