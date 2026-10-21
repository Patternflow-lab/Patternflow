// The atlas remembers its reading language in localStorage and reads it while
// rendering. With site data blocked that read throws a SecurityError, and it
// used to take the whole map down with it.

import { fireEvent, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import AtlasClient from "./AtlasClient";

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

const atlas = () => <AtlasClient pins={[]} viewerId={null} isAdmin={false} myPatterns={[]} />;

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
