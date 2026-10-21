// The atlas remembers its reading language in localStorage and reads it while
// rendering. With site data blocked that read throws a SecurityError, and it
// used to take the whole map down with it.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTRIES } from "@/lib/atlas/data";
import AtlasClient, { type AtlasPinData } from "./AtlasClient";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
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

// Every write to the map used to ignore the answer: a 401 after the login ran
// out left a dragged tile at its new spot as if it had saved, and a dropped
// connection ended in an unhandled rejection.
describe("atlas writes the server refuses", () => {
  // The author's own view of the map, so the pin can be moved and removed.
  const owned = (
    pins: AtlasPinData[],
    myPatterns: Array<{ id: string; title: string; code: string; isPublic: boolean }> = [],
  ) => <AtlasClient pins={pins} viewerId="u1" isAdmin={false} myPatterns={myPatterns} />;

  const answer = (status: number, body: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(body, { status })),
    );

  const openPin = () => {
    fireEvent.click(screen.getByRole("button", { name: "Slow tide" }));
    expect(screen.getByRole("heading", { name: "Slow tide" })).toBeTruthy();
  };

  const scrollIntoView = vi.fn();

  beforeEach(() => {
    refresh.mockClear();
    scrollIntoView.mockClear();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    // jsdom lays nothing out and has neither of these. With the identity as
    // the map's screen matrix, a client point is a viewBox point.
    Object.defineProperty(SVGSVGElement.prototype, "getScreenCTM", {
      configurable: true,
      value: () => ({ inverse: () => ({}) }),
    });
    vi.stubGlobal(
      "DOMPoint",
      class {
        x: number;
        y: number;
        constructor(x = 0, y = 0) {
          this.x = x;
          this.y = y;
        }
        matrixTransform() {
          return { x: this.x, y: this.y };
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puts a dragged tile back and says why when the move is refused", async () => {
    answer(401, { error: "Sign in to place work on the atlas." });
    render(owned([tide]));
    openPin();
    fireEvent.click(screen.getByRole("button", { name: "Edit layout" }));

    const map = screen.getByLabelText("A map of pattern space");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Slow tide" }));
    // viewBox (500, 320) is the middle of the plot: data (50, 50).
    fireEvent.pointerMove(map, { clientX: 500, clientY: 320 });
    expect(screen.getByText("x 50 · y 50")).toBeTruthy();
    fireEvent.pointerUp(map);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Sign in to place work on the atlas.",
    );
    expect(screen.getByText("x 40 · y 60")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps a pin it could not remove, and the reason leaves with the selection", async () => {
    answer(403, { error: "Only the pattern's author can place it." });
    render(owned([tide]));
    openPin();
    fireEvent.click(screen.getByRole("button", { name: "Remove from the map" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Only the pattern's author can place it.",
    );
    expect(screen.getByRole("heading", { name: "Slow tide" })).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    // Remove is at the foot of the panel and the reason at its head.
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole("button", { name: ENTRIES[0].nmEn })[0]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("closes the panel and reloads the map when the removal saves", async () => {
    answer(200, { ok: true });
    render(owned([tide]));
    openPin();
    fireEvent.click(screen.getByRole("button", { name: "Remove from the map" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Slow tide" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says nothing was saved when the link change gets no answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(owned([tide]));
    openPin();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: ENTRIES[0].id } });

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Not saved. The server did not answer.",
    );
    expect(select.value).toBe("");
  });

  it("reads a proxy's error page as no answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>Bad gateway</html>", { status: 502 })),
    );
    render(owned([tide]));
    openPin();
    fireEvent.click(screen.getByRole("button", { name: "Remove from the map" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Not saved. The server did not answer.",
    );
  });

  it("stays in placing mode and says why when the drop is refused", async () => {
    answer(429, { error: "Too many moves — let the pin settle a moment." });
    render(owned([], [{ id: "p-ember", title: "Ember", code: "function draw() {}", isPublic: true }]));
    fireEvent.click(screen.getByRole("button", { name: "Add my pattern" }));
    fireEvent.click(screen.getByTitle("Ember"));

    const catcher = screen.getByLabelText("A map of pattern space").querySelector("rect")!;
    fireEvent.pointerUp(catcher, { clientX: 900, clientY: 100 });

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Too many moves — let the pin settle a moment.",
    );
    expect(screen.getByText(/Placing “Ember”/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).toBeNull();
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
