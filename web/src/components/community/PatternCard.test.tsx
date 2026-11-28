// A profile and a deck page render their cards from the server, which cannot
// know the screen, so they never said interactive={false}. On a phone those
// cards booted live sandboxes for a hover the phone does not have: nine on a
// profile of 26 patterns. The card now asks for itself.

import { render } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PatternCard, { type PatternCardItem } from "./PatternCard";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/community/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean; children: ReactNode }) => {
    delete (rest as { prefetch?: boolean }).prefetch;
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    );
  },
}));
vi.mock("@/lib/community/thumbs", () => ({ renderPatternThumb: () => new Promise(() => {}) }));
vi.mock("./SandboxPreview", () => ({ default: () => <iframe title="live preview" /> }));

const ITEM: PatternCardItem = {
  id: "p1",
  title: "Tide",
  code: "",
  parentId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  username: "dora",
  displayUsername: "dora",
  likeCount: 0,
  forkCount: 0,
  hasCpp: false,
  visibility: "public",
  deckCount: 0,
  viewerLiked: false,
};

let phone = false;
beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: phone,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  // Every card is on screen, so a card that may play warms its sandbox.
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private readonly callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe() {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  phone = false;
  vi.unstubAllGlobals();
});

describe("a pattern card rendered with no word from its page", () => {
  it("warms its live preview and draws the knobs on a desktop", () => {
    const { container } = render(<PatternCard item={ITEM} />);
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(container.querySelector(".knobOverlay")).not.toBeNull();
  });

  it("stays a still on a phone", () => {
    phone = true;
    const { container } = render(<PatternCard item={ITEM} />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector(".knobOverlay")).toBeNull();
  });
});
