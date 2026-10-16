import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import Hero from './Hero';

// The hero's video is a YouTube embed that starts by itself and has no control
// to stop it. Someone whose system asks for reduced motion gets the poster
// under it and no embed at all, and the server, which cannot know, sends the
// poster alone.

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

const poster = (root: ParentNode) => root.querySelector('img[src="/product_v2.jpg"]');
const video = (root: ParentNode) => root.querySelector('iframe');

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
    expect(html).toContain('/product_v2.jpg');
    expect(html).not.toContain('<iframe');
  });
});
