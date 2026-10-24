// The five community windows that heard no keys: sign-in, report, Edit
// details, Add firmware header and Publish a performance. In Chromium at
// 1440px each stayed open on Esc, and four left the focus on the button
// behind them. Each case opens its window from a real button, so the focus
// has somewhere to come back to.
//
// Share to Community, the window Pattern Lab's Share opens, came after them.
// It closed on a press outside alone, and its title field took the focus
// before anything could note the Share button.

import { useState, type ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AddHeaderModal from "./AddHeaderModal";
import AddPerformanceModal from "./AddPerformanceModal";
import AuthModal from "./AuthModal";
import EditDetailsModal from "./EditDetailsModal";
import PublishModal from "./PublishModal";
import ReportModal from "./ReportModal";

const auth = vi.hoisted(() => ({
  session: { user: { id: "u1", name: "Tester" } } as { user: { id: string; name: string } } | null,
  pending: false,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/community/auth-client", () => ({
  authClient: { useSession: () => ({ data: auth.session, isPending: auth.pending }) },
  dummyEmailFor: (name: string) => `${name}@example.invalid`,
}));
vi.mock("@/lib/posthogEvents", () => ({ captureEvent: vi.fn() }));

afterEach(() => {
  auth.session = { user: { id: "u1", name: "Tester" } };
  auth.pending = false;
});

function Page({
  dialog,
  onClose,
}: {
  dialog: (close: () => void) => ReactNode;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && dialog(close)}
    </>
  );
}

function open() {
  const opener = screen.getByText("Open");
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

function pressEsc() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
}

const WINDOWS: [string, (close: () => void) => ReactNode][] = [
  ["sign-in", (close) => <AuthModal onClose={close} />],
  [
    "report",
    (close) => (
      <ReportModal targetType="pattern" targetId="p1" targetLabel="Wave" onClose={close} />
    ),
  ],
  [
    "Edit details",
    (close) => (
      <EditDetailsModal
        patternId="p1"
        initialTitle="Wave"
        initialDescription={null}
        initialLicense="CC-BY-SA-4.0"
        initialMadeOn={null}
        initialMadeHow={null}
        initialVisibility="public"
        onClose={close}
      />
    ),
  ],
  ["Add firmware header", (close) => <AddHeaderModal patternId="p1" initialCpp={null} onClose={close} />],
  ["Publish a performance", (close) => <AddPerformanceModal patternId="p1" onClose={close} />],
  [
    "Share to Community",
    (close) => (
      <PublishModal
        code="export function draw(display) {}"
        parentId={null}
        parentTitle={null}
        initialTitle="Wave"
        onClose={close}
      />
    ),
  ],
];

describe.each(WINDOWS)("the %s window", (_name, dialog) => {
  it("takes the focus when it opens", () => {
    render(<Page dialog={dialog} />);
    const opener = open();
    expect(opener).not.toHaveFocus();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes on Esc and gives the focus back to the button that opened it", () => {
    render(<Page dialog={dialog} />);
    const opener = open();
    pressEsc();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});

describe("community windows", () => {
  it("Edit details still starts on the title field", () => {
    render(<Page dialog={WINDOWS[2][1]} />);
    open();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
  });

  it("Share to Community still starts on the title field", () => {
    render(<Page dialog={WINDOWS[5][1]} />);
    open();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();
  });

  // The lab's first Share can open before the session is known. The card
  // holds the focus until then, and the title takes it when the form shows.
  it("Share to Community moves to the title field once the session is known", () => {
    auth.pending = true;
    const onClose = vi.fn();
    const { rerender } = render(<Page dialog={WINDOWS[5][1]} onClose={onClose} />);
    const opener = open();
    expect(screen.getByText("Checking session…")).toBeTruthy();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);

    auth.pending = false;
    rerender(<Page dialog={WINDOWS[5][1]} onClose={onClose} />);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveFocus();

    pressEsc();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(opener).toHaveFocus();
  });

  it("a sign-in form inside Share to Community lets one Esc close it", () => {
    auth.session = null;
    const onClose = vi.fn();
    render(<Page dialog={WINDOWS[5][1]} onClose={onClose} />);
    const opener = open();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Password"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("a sign-in form inside the report window lets one Esc close the report", () => {
    auth.session = null;
    const onClose = vi.fn();
    render(<Page dialog={WINDOWS[1][1]} onClose={onClose} />);
    const opener = open();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Password"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
