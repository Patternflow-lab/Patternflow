// One press of Publish is one post (#455). The bug was a race, so the test
// reproduces it rather than describing it: two clicks inside one act() both
// run before React re-renders the button as disabled — exactly what a
// double-click or a bouncing mouse switch does — and with `busy` state as the
// only guard both became requests and the wall got the pattern twice.

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
