import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The root layout wraps every page in this provider. posthog-js waits for the
// page's load event; the pageview captured on mount waits for posthog-js.

const posthog = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock('posthog-js', () => ({ default: posthog }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/contact',
  useSearchParams: () => new URLSearchParams(),
}));

// postHogEnabled is read when the module is evaluated, as the build inlines it.
async function provider() {
  vi.resetModules();
  return (await import('./PostHogProvider')).PostHogProvider;
}

function stillLoading() {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => 'loading' });
}

beforeEach(() => {
  posthog.init.mockClear();
  posthog.capture.mockClear();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(document, 'readyState');
});

describe('PostHogProvider', () => {
  it('starts posthog-js only after the load event, then sends the pageview it held', async () => {
    const PostHogProvider = await provider();
    stillLoading();
    render(
      <PostHogProvider>
        <p>page</p>
      </PostHogProvider>,
    );
    expect(screen.getByText('page')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();

    Reflect.deleteProperty(document, 'readyState');
    window.dispatchEvent(new Event('load'));
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    expect(posthog.init.mock.calls[0][0]).toBe('phc_test');
    expect(posthog.capture).toHaveBeenCalledWith(
      '$pageview',
      { $current_url: 'http://localhost:3000/' },
      { timestamp: expect.any(Date) },
    );
  });

  it('starts it once however often the provider mounts', async () => {
    const PostHogProvider = await provider();
    const first = render(<PostHogProvider>a</PostHogProvider>);
    await vi.waitFor(() => expect(posthog.init).toHaveBeenCalled());
    first.unmount();
    render(<PostHogProvider>b</PostHogProvider>);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it('never fetches posthog-js on a build without a key', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    const PostHogProvider = await provider();
    render(<PostHogProvider>page</PostHogProvider>);
    window.dispatchEvent(new Event('load'));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(posthog.init).not.toHaveBeenCalled();
  });
});
