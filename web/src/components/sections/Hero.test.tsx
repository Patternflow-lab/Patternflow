import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Hero from './Hero';

// The hero's video is a YouTube embed that starts by itself and takes no
// clicks. A button over it stops it and plays it again. Someone whose system
// asks for reduced motion gets the poster under it and no embed at all, and the
// server, which cannot know, sends the poster alone.

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/posthogEvents', () => ({ captureEvent: () => {} }));

const REDUCE = '(prefers-reduced-motion: reduce)';

// One reduced-motion setting for the page, which a test can flip the way the
// system settings would, firing change on every query that listens.
let reduce = false;
const listeners = new Set<() => void>();
function setReduce(next: boolean) {
  reduce = next;
  act(() => listeners.forEach((fn) => fn()));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  reduce = false;
  listeners.clear();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return query === REDUCE ? reduce : false;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const poster = (root: ParentNode) => root.querySelector('img[alt="Patternflow physical device"]');
const video = (root: ParentNode) => root.querySelector('iframe');
const stopButton = () => screen.getByRole('button', { name: 'Stop the video' });
const playButton = () => screen.getByRole('button', { name: 'Play the video' });

describe('Hero', () => {
  it('plays the video over the poster, hidden while the player loads', () => {
    const { container } = render(<Hero />);
    expect(poster(container)).not.toBeNull();
    expect(video(container)?.getAttribute('src')).toContain('youtube.com/embed/');
    expect(video(container)?.style.opacity).toBe('0');

    act(() => vi.advanceTimersByTime(3000));
    expect(video(container)?.style.opacity).toBe('1');

    act(() => vi.advanceTimersByTime(89000));
    expect(video(container)?.style.opacity).toBe('0');
  });

  it('shows the poster alone when reduced motion is on', () => {
    reduce = true;
    const { container } = render(<Hero />);
    expect(poster(container)).not.toBeNull();
    expect(video(container)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();

    act(() => vi.advanceTimersByTime(10000));
    expect(video(container)).toBeNull();
  });

  it('drops the video when reduced motion turns on, and starts it hidden again when it turns off', () => {
    const { container } = render(<Hero />);
    act(() => vi.advanceTimersByTime(3000));
    expect(video(container)?.style.opacity).toBe('1');

    setReduce(true);
    expect(video(container)).toBeNull();
    expect(poster(container)).not.toBeNull();

    setReduce(false);
    expect(video(container)?.style.opacity).toBe('0');
    act(() => vi.advanceTimersByTime(3000));
    expect(video(container)?.style.opacity).toBe('1');
  });

  it('sends the poster without the embed from the server', () => {
    const html = renderToString(<Hero />);
    expect(html).toContain('Patternflow physical device');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('<button');
  });

  // The original is 4032 wide and 2.1 MB, and it was the first screen's
  // largest paint: 8.7 s on a phone at 9 Mbps. The poster asks the optimizer
  // for the column's width instead, and starts loading with the page.
  it('sends a poster sized to the column, never the original, loading at once', () => {
    const html = renderToString(<Hero />);
    const img = new DOMParser().parseFromString(html, 'text/html').querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Patternflow physical device');
    expect(img?.getAttribute('src')).toMatch(/^\/_next\/image\?url=%2Fproduct_v2\.jpg&/);
    expect(img?.getAttribute('srcset')).toContain('/_next/image?url=%2Fproduct_v2.jpg&w=1080&q=75 1080w');
    expect(img?.getAttribute('sizes')).toBe('(max-width: 900px) calc(100vw - 48px), 580px');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
    expect(html).not.toMatch(/(src|srcSet|imageSrcSet)="\/product_v2\.jpg"/);
  });

  it('stops the video from its button and plays it again from the top', () => {
    const { container } = render(<Hero />);
    act(() => vi.advanceTimersByTime(3000));
    expect(video(container)?.style.opacity).toBe('1');

    fireEvent.click(stopButton());
    expect(video(container)).toBeNull();
    expect(poster(container)).not.toBeNull();
    act(() => vi.advanceTimersByTime(100000));
    expect(video(container)).toBeNull();

    // The same button, so focus stays where the hand left it.
    const button = playButton();
    fireEvent.click(button);
    expect(stopButton()).toBe(button);
    expect(video(container)?.style.opacity).toBe('0');
    act(() => vi.advanceTimersByTime(3000));
    expect(video(container)?.style.opacity).toBe('1');
  });

  it('offers Play once the video has ended, and Play starts a fresh one', () => {
    const { container } = render(<Hero />);
    expect(stopButton()).not.toBeNull();
    act(() => vi.advanceTimersByTime(92000));
    const ended = video(container);
    expect(ended?.style.opacity).toBe('0');

    fireEvent.click(playButton());
    expect(video(container)).not.toBe(ended);
    expect(video(container)?.style.opacity).toBe('0');
    act(() => vi.advanceTimersByTime(3000));
    expect(video(container)?.style.opacity).toBe('1');
    expect(stopButton()).not.toBeNull();
  });

  it('takes the button away with the video when reduced motion turns on', () => {
    render(<Hero />);
    fireEvent.click(stopButton());
    setReduce(true);
    expect(screen.queryByRole('button')).toBeNull();

    // A fresh video, playing, as when reduced motion turned off before.
    setReduce(false);
    expect(stopButton()).not.toBeNull();
  });
});
