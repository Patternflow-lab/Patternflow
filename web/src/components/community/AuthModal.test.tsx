// The sign-in fields were loose inputs with an Enter handler on the password
// alone, so Enter after a username did nothing. In a form, a browser submits
// on Enter from either field, and a password manager has a pair to fill.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthModal from "./AuthModal";

const signIn = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));
vi.mock("@/lib/community/auth-client", () => ({
  authClient: {
    signIn: { username: signIn },
    signUp: { email: vi.fn() },
  },
  dummyEmailFor: (name: string) => `${name}@example.invalid`,
}));

function fields() {
  const username = screen.getByLabelText("Username") as HTMLInputElement;
  const password = screen.getByLabelText("Password") as HTMLInputElement;
  return { username, password, form: username.form as HTMLFormElement };
}

describe("the sign-in form", () => {
  it("puts both fields in one form with a submit button", () => {
    render(<AuthModal onClose={() => {}} />);
    const { password, form } = fields();
    expect(form).not.toBeNull();
    expect(password.form).toBe(form);
    expect(form.querySelector('button[type="submit"]')?.textContent).toBe("Sign in");
  });

  it("reports a short password as an alert when submitted from the username", () => {
    render(<AuthModal onClose={() => {}} />);
    const { username, form } = fields();
    fireEvent.change(username, { target: { value: "ada" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert").textContent).toBe("Password must be at least 8 characters.");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("signs in and closes", async () => {
    signIn.mockResolvedValue({ data: {}, error: null });
    const onClose = vi.fn();
    const onAuthed = vi.fn();
    render(<AuthModal onClose={onClose} onAuthed={onAuthed} />);
    const { username, password, form } = fields();
    fireEvent.change(username, { target: { value: "ada" } });
    fireEvent.change(password, { target: { value: "correct horse" } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith({ username: "ada", password: "correct horse" });
    expect(onAuthed).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  // A card's heart opens this with no onAuthed. The header's handle follows
  // the session, but the server's CTA, Alerts link and Liked tab did not.
  it("refreshes the page itself when its caller has nothing to do after", async () => {
    signIn.mockResolvedValue({ data: {}, error: null });
    const onClose = vi.fn();
    render(<AuthModal onClose={onClose} />);
    const { username, password, form } = fields();
    fireEvent.change(username, { target: { value: "ada" } });
    fireEvent.change(password, { target: { value: "correct horse" } });
    fireEvent.submit(form);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("is a form embedded in another window too", () => {
    render(<AuthModal embedded onClose={() => {}} />);
    expect(fields().form).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
