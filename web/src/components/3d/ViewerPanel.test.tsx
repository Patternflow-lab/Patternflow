import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore, type HomeTabType } from '@/store/useAppStore';
import ViewerPanel from './ViewerPanel';

// The home page's 3D view is the build globe (hero, Inside) or the product
// preview (Build, Pattern). A browser that gives no WebGL 2 context used to
// throw as either scene made its renderer, and the error went up to the
// site's error screen with the tabs beside it. Now the view asks first, and
// a scene that throws anyway is taken off; both leave a line in its place.

const webgl = vi.hoisted(() => ({ answer: true, asked: 0 }));
vi.mock('@/lib/webgl', () => ({
  hasWebGL: () => {
    webgl.asked++;
    return webgl.answer;
  },
}));

// The scenes stand in for themselves; one can be told to throw as it is
// made, as R3F's Canvas does when the context is refused.
const scenes = vi.hoisted(() => ({ throws: new Set<string>(), made: [] as string[] }));
function Scene({ name }: { name: string }) {
  scenes.made.push(name);
  if (scenes.throws.has(name)) throw new Error('Error creating WebGL context.');
  return <div data-testid="scene">{name}</div>;
}
vi.mock('./HeroScene', () => ({ default: () => <Scene name="product" /> }));
vi.mock('next/dynamic', () => ({ default: () => () => <Scene name="globe" /> }));

const LINE = 'This browser can’t draw the 3D view.';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  webgl.answer = true;
  webgl.asked = 0;
  scenes.throws.clear();
  scenes.made = [];
  useAppStore.setState({ homeTab: 'hero' });
});

afterEach(() => {
  vi.useRealTimers();
});

// The tabs beside the view, which must outlive it. The page passes the tab
// it was made for, as HomeView does.
function Page({ tab = 'hero' }: { tab?: HomeTabType }) {
  return (
    <>
      <ViewerPanel initialTab={tab} />
      <button type="button">Build</button>
    </>
  );
}

describe('ViewerPanel', () => {
  it('shows the globe on the hero and the product on Build where WebGL is there', () => {
    render(<Page />);
    expect(screen.getByTestId('scene')).toHaveTextContent('globe');
    act(() => useAppStore.setState({ homeTab: 'build' }));
    // (The fade-through swaps the scene 200 ms later.)
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId('scene')).toHaveTextContent('product');
    expect(screen.queryByText(LINE)).not.toBeInTheDocument();
  });

  it.each(['hero', 'build', 'pattern', 'inside'] as const)(
    'makes no scene on %s where there is no WebGL, and says so',
    (tab) => {
      webgl.answer = false;
      useAppStore.setState({ homeTab: tab });
      render(<Page tab={tab} />);
      expect(scenes.made).toEqual([]);
      expect(screen.getByText(LINE)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Build' })).toBeInTheDocument();
    },
  );

  it('takes off a scene that throws as it is made, and keeps the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    scenes.throws.add('product');
    useAppStore.setState({ homeTab: 'pattern' });
    render(<Page tab="pattern" />);
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
    expect(screen.getByText(LINE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build' })).toBeInTheDocument();
  });

  it('tries the other scene again when the tab changes to it', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    scenes.throws.add('product');
    useAppStore.setState({ homeTab: 'build' });
    render(<Page tab="build" />);
    expect(screen.getByText(LINE)).toBeInTheDocument();
    act(() => useAppStore.setState({ homeTab: 'inside' }));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId('scene')).toHaveTextContent('globe');
    expect(screen.queryByText(LINE)).not.toBeInTheDocument();
  });

  // The store says hero until RightPanel's effect tells it otherwise. Read
  // from it, /build opened on the globe and kept it through the fade: long
  // enough to mount it and send for every pin's photos.
  it.each(['build', 'pattern'] as const)('opens /%s on the product and never makes the globe', (tab) => {
    render(<Page tab={tab} />);
    expect(screen.getByTestId('scene')).toHaveTextContent('product');
    // RightPanel's effect, telling the store the tab the page opened on.
    act(() => useAppStore.getState().setHomeTab(tab));
    act(() => vi.advanceTimersByTime(200));
    expect(scenes.made).not.toContain('globe');
    expect(screen.getByTestId('scene')).toHaveTextContent('product');
  });

  it('opens /pattern on the product when the store still holds Inside from an earlier visit', () => {
    useAppStore.setState({ homeTab: 'inside' });
    render(<Page tab="pattern" />);
    act(() => useAppStore.getState().setHomeTab('pattern'));
    act(() => vi.advanceTimersByTime(200));
    expect(scenes.made).not.toContain('globe');
  });

  it('follows the store once it changes, from whichever tab the page opened on', () => {
    render(<Page tab="build" />);
    act(() => useAppStore.getState().setHomeTab('build'));
    act(() => useAppStore.getState().setHomeTab('inside'));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByTestId('scene')).toHaveTextContent('globe');
    act(() => useAppStore.getState().setHomeTab('hero'));
    expect(screen.getByTestId('scene')).toHaveTextContent('globe');
  });

  it('drops down on a phone from the first render of /build, as the panel beside it does', () => {
    const html = renderToString(<Page tab="build" />);
    expect(html).toContain('viewer-panel is-open');
    expect(renderToString(<Page />)).not.toContain('is-open');
  });

  it.each(['hero', 'build'] as const)('sends %s as it was from the server, and the browser without WebGL takes it up without a mismatch', async (tab) => {
    webgl.answer = false;
    const html = renderToString(<Page tab={tab} />);
    // The server cannot ask: it answers yes and never calls the probe.
    expect(webgl.asked).toBe(0);
    expect(html).not.toContain('draw the 3D view');

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverable = vi.fn();
    const root = await act(async () => hydrateRoot(container, <Page tab={tab} />, { onRecoverableError: recoverable }));
    expect(recoverable).not.toHaveBeenCalled();
    expect(container).toHaveTextContent(LINE);
    expect(container.querySelector('[data-testid="scene"]')).toBeNull();
    act(() => root.unmount());
    container.remove();
  });
});
