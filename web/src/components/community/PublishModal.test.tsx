// One press of Publish is one post (#455). The bug was a race, so the test
// reproduces it rather than describing it: two clicks inside one act() both
// run before React re-renders the button as disabled — exactly what a
// double-click or a bouncing mouse switch does — and with `busy` state as the
// only guard both became requests and the wall got the pattern twice.

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStoredPatternCode, communityPatternUrl } from "@/lib/community/license";
import { CODE_MAX } from "@/lib/community/validate";
import PublishModal from "./PublishModal";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/lib/community/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "u1", username: "ada" } }, isPending: false }),
  },
}));

const CODE = "export function draw(display) { display.setPixel(0, 0, 255, 0, 0); }";

/** A fetch that stays in flight until the test lets it answer. */
function heldFetch() {
  const answers: ((response: Response) => void)[] = [];
  const mock = vi.fn(
    () => new Promise<Response>((resolve) => answers.push(resolve)),
  );
  const answer = (status: number, body: unknown) =>
    act(async () => {
      answers.shift()?.(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  return { mock, answer };
}

let server: ReturnType<typeof heldFetch>;

beforeEach(() => {
  push.mockReset();
  server = heldFetch();
  vi.stubGlobal("fetch", server.mock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function openModal() {
  render(
    <PublishModal
      code={CODE}
      parentId={null}
      parentTitle={null}
      initialTitle="Pentagrid Tower"
      onClose={() => {}}
    />,
  );
  return screen.getByRole("button", { name: "Publish to the wall" });
}

describe("PublishModal", () => {
  it("sends one publish for a double-click", async () => {
    const button = openModal();

    act(() => {
      button.click();
      button.click();
    });

    expect(server.mock).toHaveBeenCalledTimes(1);
    await server.answer(201, { id: "p1" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/community/p/p1"));
    expect(server.mock).toHaveBeenCalledTimes(1);
  });

  it("stays shut after publishing, while the page changes", async () => {
    const button = openModal();

    act(() => button.click());
    await server.answer(201, { id: "p1" });
    await waitFor(() => expect(push).toHaveBeenCalled());

    // It used to come back as "Publish to the wall", enabled, for as long as
    // the navigation took.
    expect(button).toBeDisabled();
    act(() => button.click());
    expect(server.mock).toHaveBeenCalledTimes(1);
  });

  it("lets a failed publish be tried again", async () => {
    const button = openModal();

    act(() => button.click());
    await server.answer(500, { error: "Database is busy." });
    await waitFor(() => expect(screen.getByText("Database is busy.")).toBeInTheDocument());

    expect(button).toBeEnabled();
    act(() => button.click());
    expect(server.mock).toHaveBeenCalledTimes(2);
  });
});

// The community stores a pattern inside its licence header and footer, and
// "Open in Pattern Lab" hands that stored text to the lab unchanged. The API
// takes the wrapping off before it measures; the modal measured the wrapped
// text, so a fork it would have accepted was refused before it was sent.
describe("PublishModal code size", () => {
  /** A pattern body of exactly `length` characters. */
  function bodyOf(length: number) {
    const pad = "\n// ";
    return `${CODE}${pad}${"x".repeat(length - CODE.length - pad.length)}`;
  }

  /** How a fork of `@ada`'s pattern comes back out of the community. */
  function storedFork(body: string) {
    return buildStoredPatternCode(body, {
      title: "Pentagrid Tower (remix)",
      license: "CC-BY-SA-4.0",
      handle: "grace",
      date: "2026-10-01",
      basedOn: { title: "Pentagrid Tower", handle: "ada", url: communityPatternUrl("p0") },
    });
  }

  function openFork(code: string) {
    render(
      <PublishModal
        code={code}
        parentId="p1"
        parentTitle="Pentagrid Tower (remix)"
        parentLicense="CC-BY-SA-4.0"
        initialTitle="Pentagrid Tower (remix 2)"
        onClose={() => {}}
      />,
    );
    return screen.getByRole("button", { name: "Publish to the wall" });
  }

  it("publishes an untouched fork whose body fits under the cap", async () => {
    const code = storedFork(bodyOf(99_700));
    expect(code.length).toBeGreaterThan(CODE_MAX);

    const button = openFork(code);
    act(() => button.click());

    expect(screen.queryByText(/KB of code/)).toBeNull();
    expect(server.mock).toHaveBeenCalledTimes(1);
    await server.answer(201, { id: "p2" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/community/p/p2"));
  });

  it("saves the author's own post reopened in the lab, unedited", () => {
    const code = storedFork(bodyOf(99_700));
    render(
      <PublishModal
        code={code}
        parentId={null}
        parentTitle={null}
        editOf={{
          id: "p1",
          title: "Pentagrid Tower (remix)",
          description: null,
          visibility: "public",
          hasCpp: false,
          portCount: 0,
        }}
        onClose={() => {}}
      />,
    );

    act(() => screen.getByRole("button", { name: "Update this pattern" }).click());

    expect(screen.queryByText(/KB of code/)).toBeNull();
    expect(server.mock).toHaveBeenCalledTimes(1);
    expect(server.mock.mock.calls[0]).toEqual([
      "/api/community/patterns/p1",
      expect.objectContaining({ method: "PATCH" }),
    ]);
  });

  it("still stops a body over the cap before it is sent", () => {
    const button = openFork(storedFork(bodyOf(CODE_MAX + 600)));
    act(() => button.click());

    expect(screen.getByText(/This pattern is 101 KB of code/)).toBeInTheDocument();
    expect(server.mock).not.toHaveBeenCalled();
  });
});
