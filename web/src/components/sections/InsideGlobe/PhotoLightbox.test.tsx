import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PhotoLightbox, { isLightboxOpen, watchLightbox } from './PhotoLightbox';

const images = [
  { src: '/builds/nath/front.jpg', alt: 'front' },
  { src: '/builds/nath/angle.jpg', alt: 'angle' },
  { src: '/builds/nath/back.jpg', alt: 'back' },
  { src: '/builds/nath/front-angle.jpg', alt: 'front angle' },
];

function mount(index = 0, list = images) {
  const onIndexChange = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <PhotoLightbox images={list} index={index} onIndexChange={onIndexChange} onClose={onClose} />,
  );
  return { ...view, onIndexChange, onClose, dialog: screen.getByRole('dialog') };
}

// The file a photo is fetched from, whatever width the optimizer was asked for.
const fileOf = (img: Element) => decodeURIComponent(img.getAttribute('src') ?? '').match(/\/builds\/[^&]+/)?.[0];

describe('the photo popup', () => {
  it('takes the focus when it opens and hands it back to the tile that opened it', () => {
    const tile = document.createElement('button');
    document.body.appendChild(tile);
    tile.focus();
    const { unmount } = mount();
    expect(screen.getByRole('button', { name: 'Close gallery' })).toHaveFocus();
    unmount();
    expect(tile).toHaveFocus();
    tile.remove();
  });

  it('keeps Tab among its own buttons', () => {
    const { dialog } = mount();
    const stops = Array.from(dialog.querySelectorAll('button'));
    const first = stops[0];
    const last = stops[stops.length - 1];

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    // Focus that has got out, by whatever means, comes back in on the next Tab.
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Tab' });
    expect(first).toHaveFocus();
    outside.remove();
  });

  it('closes on Esc and marks the key as used, so the map behind keeps its selection', () => {
    const { onClose } = mount();
    const behind = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    window.addEventListener('keydown', behind);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    window.removeEventListener('keydown', behind);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(behind).toHaveReturnedWith(true);
  });

  it('steps with the arrow keys and wraps at both ends', () => {
    const first = mount(0);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(first.onIndexChange).toHaveBeenLastCalledWith(images.length - 1);
    first.unmount();

    const last = mount(images.length - 1);
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(last.onIndexChange).toHaveBeenLastCalledWith(0);
  });

  it('steps on a sideways swipe of a finger, and not on a tap, a scroll or a mouse drag', () => {
    const { dialog, onIndexChange, onClose } = mount(1);
    const finger = { pointerId: 7, pointerType: 'touch' };

    fireEvent.pointerDown(dialog, { ...finger, clientX: 300, clientY: 400 });
    fireEvent.pointerUp(dialog, { ...finger, clientX: 180, clientY: 410 });
    expect(onIndexChange).toHaveBeenLastCalledWith(2);

    fireEvent.pointerDown(dialog, { ...finger, clientX: 100, clientY: 400 });
    fireEvent.pointerUp(dialog, { ...finger, clientX: 220, clientY: 395 });
    expect(onIndexChange).toHaveBeenLastCalledWith(0);
    expect(onIndexChange).toHaveBeenCalledTimes(2);

    // A tap.
    fireEvent.pointerDown(dialog, { ...finger, clientX: 200, clientY: 400 });
    fireEvent.pointerUp(dialog, { ...finger, clientX: 204, clientY: 402 });
    // More down than across.
    fireEvent.pointerDown(dialog, { ...finger, clientX: 200, clientY: 300 });
    fireEvent.pointerUp(dialog, { ...finger, clientX: 140, clientY: 420 });
    // A mouse.
    fireEvent.pointerDown(dialog, { pointerId: 1, pointerType: 'mouse', clientX: 300, clientY: 400 });
    fireEvent.pointerUp(dialog, { pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 400 });
    expect(onIndexChange).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('fetches the photos either side ahead, at the size the shown one is asked for', () => {
    const { dialog } = mount(0);
    const shown = dialog.querySelector('img[alt="front"]')!;
    const ahead = Array.from(dialog.querySelectorAll('[aria-hidden] img'));
    expect(ahead.map(fileOf)).toEqual(['/builds/nath/angle.jpg', '/builds/nath/front-angle.jpg']);
    for (const img of ahead) {
      expect(img.getAttribute('sizes')).toBe(shown.getAttribute('sizes'));
      expect(img.getAttribute('loading')).toBe('eager');
    }
  });

  it('has no arrows, and nothing to fetch ahead, for a single photo', () => {
    const { dialog } = mount(0, images.slice(0, 1));
    expect(screen.queryByRole('button', { name: 'Next photo' })).not.toBeInTheDocument();
    expect(dialog.querySelectorAll('[aria-hidden] img')).toHaveLength(0);
  });

  it('says it is open for as long as it is, to whatever is behind it', () => {
    const watcher = vi.fn();
    const unwatch = watchLightbox(watcher);
    expect(isLightboxOpen()).toBe(false);
    const { unmount } = mount();
    expect(isLightboxOpen()).toBe(true);
    expect(watcher).toHaveBeenCalledTimes(1);
    unmount();
    expect(isLightboxOpen()).toBe(false);
    expect(watcher).toHaveBeenCalledTimes(2);
    unwatch();
  });
});
