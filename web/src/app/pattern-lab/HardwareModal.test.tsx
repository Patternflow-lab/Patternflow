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
