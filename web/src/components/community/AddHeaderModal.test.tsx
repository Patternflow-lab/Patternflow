// Add firmware header sent people to "Copy C++ prompt in Pattern Lab", a
// button the Lab no longer has. The header comes out of the Lab's To hardware
// window now. Both ways in name the button beside the Pattern Lab link, and
// this fails when the Lab renames it again.

import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AddHeaderModal from "./AddHeaderModal";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/community/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "u1", name: "Tester" } }, isPending: false }) },
}));
vi.mock("@/lib/posthogEvents", () => ({ captureEvent: vi.fn() }));

const LAB_HEADER = readFileSync(
  path.resolve(__dirname, "../../app/pattern-lab/PatternLabClient.tsx"),
  "utf8",
);

/** The button the note sends people to: the bold words just before the Pattern Lab link. */
function namedButton(): string {
  const link = screen.getByRole("link", { name: "Pattern Lab" });
  const strong = link.previousElementSibling;
  expect(strong?.tagName).toBe("STRONG");
  return strong?.textContent ?? "";
}

describe("Add firmware header", () => {
  for (const mode of ["owner", "port"] as const) {
    it(`names a button the Lab has (${mode})`, () => {
      render(<AddHeaderModal patternId="p1" initialCpp={null} mode={mode} onClose={() => undefined} />);
      const name = namedButton();
      expect(name).toBe("To hardware");
      expect(LAB_HEADER).toMatch(new RegExp(`>\\s*${name}\\s*</button>`));
      expect(document.body.textContent).not.toContain("Copy C++ prompt");
    });
  }
});
