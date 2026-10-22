import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '@/store/useAppStore';
import { builds, CARD_TILES, STRIP_TILES } from './builds';
import GlobeViewer from './GlobeViewer';

// The globe warms each pin's opening photos so a pin opens with them. Below
// 901px the 3D view is hidden on the hero, yet the globe there still sent for
// every one of them, in the large variant a 3× phone picks: 65 photos and
// 8.3 MB on 22 October, for a map nobody saw.

vi.mock('./Globe', () => ({ default: () => <div data-testid="globe" /> }));

const media = vi.hoisted(() => ({ wide: false }));
const TILES = builds.flatMap((build) => (build.images ?? []).slice(0, Math.max(STRIP_TILES, CARD_TILES)));

beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    matches: query === '(min-width: 901px)' && media.wide,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  useAppStore.setState({ homeTab: 'hero', selectedBuildId: null, insideFilter: 'all' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const warmed = (container: HTMLElement) => container.querySelectorAll('.preload img').length;

describe('GlobeViewer', () => {
  it('warms no photo for the hidden globe of a phone’s hero', () => {
    media.wide = false;
    const { container, getByTestId } = render(<GlobeViewer />);
    expect(getByTestId('globe')).toBeInTheDocument();
    expect(warmed(container)).toBe(0);
  });

  it('warms every pin’s opening photos once a phone opens Inside', () => {
    media.wide = false;
    const { container } = render(<GlobeViewer />);
    act(() => useAppStore.getState().setHomeTab('inside'));
    expect(TILES.length).toBeGreaterThan(0);
    expect(warmed(container)).toBe(TILES.length);
  });

  it('warms them on the hero from 901px up, where the globe stands beside the page', () => {
    media.wide = true;
    const { container } = render(<GlobeViewer />);
    expect(warmed(container)).toBe(TILES.length);
  });
});
