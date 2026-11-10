import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BUILD_CASES } from '../build-cases-data';
import PinLink from './PinLink';
import { builds } from './builds';

beforeEach(() => {
  window.history.replaceState(null, '', '/inside/simonepda-lasercut-uae');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PinLink', () => {
  it('moves this tab to a path in the site and lets the tabs follow', () => {
    const popped = vi.fn();
    window.addEventListener('popstate', popped);
    render(<PinLink href="/build?case=simonepda-lasercut" label="Build this case" />);
    const link = screen.getByRole('link', { name: 'Build this case →' });
    expect(link).not.toHaveAttribute('target');
    fireEvent.click(link);
    window.removeEventListener('popstate', popped);
    expect(window.location.pathname + window.location.search).toBe('/build?case=simonepda-lasercut');
    expect(popped).toHaveBeenCalledTimes(1);
  });

  it('leaves a modified click to the browser', () => {
    // Seen after the link's own handler, then stopped: jsdom cannot navigate.
    let leftToBrowser = false;
    const after = (event: MouseEvent) => {
      leftToBrowser = !event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', after);
    render(<PinLink href="/build?case=simonepda-lasercut" label="Build this case" />);
    fireEvent.click(screen.getByRole('link'), { metaKey: true });
    window.removeEventListener('click', after);
    expect(leftToBrowser).toBe(true);
    expect(window.location.pathname).toBe('/inside/simonepda-lasercut-uae');
  });

  it('opens a full address in a new tab', () => {
    render(<PinLink href="https://www.instagram.com/simonepda" label="instagram.com/simonepda" />);
    const link = screen.getByRole('link', { name: 'instagram.com/simonepda ↗' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('gives every /build?case= link on a pin a case the build page has', () => {
    const cases = new Set<string>(BUILD_CASES.map((item) => item.id));
    const named = builds
      .flatMap((build) => build.links ?? [])
      .map((link) => link.href.match(/^\/build\?case=(.+)$/)?.[1])
      .filter((id): id is string => id !== undefined);
    expect(named.length).toBeGreaterThan(0);
    for (const id of named) expect(cases.has(id), id).toBe(true);
  });
});
