// The atlas remembers its reading language in localStorage and reads it while
// rendering. With site data blocked that read throws a SecurityError, and it
// used to take the whole map down with it.

import { fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ENTRIES } from "@/lib/atlas/data";
import AtlasClient, { type AtlasPinData } from "./AtlasClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Both boot a sandbox iframe per pattern; these tests only need the map.
vi.mock("./PatternCanvas", () => ({ default: () => null }));
vi.mock("./SandboxPreview", () => ({ default: () => null }));

const atlas = (pins: AtlasPinData[] = []) => (
  <AtlasClient pins={pins} viewerId={null} isAdmin={false} myPatterns={[]} />
);

const tide: AtlasPinData = {
  patternId: "p-tide",
  x: 40,
  y: 60,
  entryId: null,
  kind: "pin",
  isPublic: true,
  title: "Slow tide",
  code: "function draw() {}",
  userId: "u1",
  username: "maker",
  displayUsername: null,
};

describe("atlas by keyboard", () => {
  it("reaches a pin tile with Tab and opens it with Enter", () => {
    render(atlas([tide]));
    const tile = screen.getByRole("button", { name: "Slow tide" });
    expect(tile.tabIndex).toBe(0);
    expect(fireEvent.keyDown(tile, { key: "Enter" })).toBe(false);
    expect(screen.getByRole("heading", { name: "Slow tide" })).toBeTruthy();
  });

  it("opens a point with Space and keeps the page where it was", () => {
    render(atlas());
    const entry = ENTRIES[0];
    const point = screen.getAllByRole("button", { name: entry.nmEn })[0];
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.keyDown(point, { key: " " })).toBe(false);
    expect(screen.getByRole("heading", { name: entry.nmEn })).toBeTruthy();
  });
});

describe("atlas reading language", () => {
  it("opens in the language this browser chose last time", () => {
    localStorage.setItem("pf-atlas-lang", "ko");
    const { unmount } = render(atlas());
    // The toggle names the language it switches to.
    expect(screen.getByRole("button", { name: "English" })).toBeTruthy();
    unmount();
    localStorage.clear();
  });

  // Last on purpose: the choice storage refused stays in the module for the
  // rest of the visit, which here is the rest of this file.
  it("opens with site data blocked, and the toggle still works for the visit", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    });
    render(atlas());
    fireEvent.click(screen.getByRole("button", { name: "한국어" }));
    expect(screen.getByRole("button", { name: "English" })).toBeTruthy();
  });
});
