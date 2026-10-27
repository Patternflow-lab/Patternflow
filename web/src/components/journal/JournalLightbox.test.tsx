import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import JournalLightbox from "./JournalLightbox";

// Clicking a picture in a post opens it large in a dialog. The focus stayed
// on the page under it, so one Tab went to a link behind the backdrop. On 27
// October, on the 50 posts with pictures at 390 and 1440, that Tab left the
// window in 100 of 100 runs and scrolled the post away from the picture in 72.
// In 2 it went into the video above the picture, and Esc no longer closed the
// window.

function renderPost() {
  return render(
    <>
      <JournalLightbox />
      <figure className="journal-md-figure">
        {/* eslint-disable-next-line @next/next/no-img-element -- stands in for the picture JournalImage draws */}
        <img src="/journal/desk.jpg" alt="The desk" />
        <figcaption>The desk in October.</figcaption>
      </figure>
      <a href="#older">Older post</a>
    </>,
  );
}

function open() {
  act(() => {
    fireEvent.click(screen.getByAltText("The desk"));
  });
  return screen.getByRole("dialog", { name: "The desk in October." });
}

describe("JournalLightbox", () => {
  it("moves the focus to the close button when a picture opens", () => {
    renderPost();
    open();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close image" }));
  });

  it("keeps Tab and Shift+Tab on the close button", () => {
    renderPost();
    open();
    const close = screen.getByRole("button", { name: "Close image" });

    expect(fireEvent.keyDown(close, { key: "Tab" })).toBe(false);
    expect(document.activeElement).toBe(close);
    expect(fireEvent.keyDown(close, { key: "Tab", shiftKey: true })).toBe(false);
    expect(document.activeElement).toBe(close);

    // Focus that got out some other way comes back on the next Tab.
    screen.getByRole("link", { name: "Older post" }).focus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab" });
    expect(document.activeElement).toBe(close);
  });

  it("gives the focus back to the picture on Esc, without a Tab stop", () => {
    renderPost();
    open();
    act(() => {
      fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    const picture = screen.getByAltText("The desk");
    expect(document.activeElement).toBe(picture);
    expect(picture.tabIndex).toBe(-1);
  });

  it("gives the focus back to the picture when the close button is pressed", () => {
    renderPost();
    open();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Close image" }));
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByAltText("The desk"));
  });
});
