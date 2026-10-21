import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PostHog } from 'posthog-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Events captured before posthog-js has arrived wait in the module, so each
// test takes a fresh copy of it.
async function events() {
  vi.resetModules();
  return import('./posthogEvents');
}

function fakeClient() {
  const capture = vi.fn();
  return { capture, client: { capture } as unknown as PostHog };
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('events before posthog-js has loaded', () => {
  it('are sent once the client arrives, in order, with the time and page they happened on', async () => {
    const { attachPostHog, captureEvent, capturePageview } = await events();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'));
    window.history.replaceState(null, '', '/contact?utm_source=x');
    capturePageview();
    captureEvent('sponsor_click', { tier: 'gold' });

    vi.setSystemTime(new Date('2026-10-21T09:00:04Z'));
    window.history.replaceState(null, '', '/build');
    const { capture, client } = fakeClient();
    attachPostHog(client);

    const at = { timestamp: new Date('2026-10-21T09:00:00Z') };
    expect(capture.mock.calls).toEqual([
      ['$pageview', { $current_url: 'http://localhost:3000/contact?utm_source=x', utm_source: 'x' }, at],
      [
        'sponsor_click',
        expect.objectContaining({ path: '/contact', utm_source: 'x', tier: 'gold' }),
        at,
      ],
    ]);
  });

  it('go straight to the client after it has arrived', async () => {
    const { attachPostHog, captureEvent } = await events();
    const { capture, client } = fakeClient();
    attachPostHog(client);
    captureEvent('deck_open');
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]).toHaveLength(2);
    expect(capture.mock.calls[0][0]).toBe('deck_open');
  });

  it('keep the first 100 when the page never finishes loading', async () => {
    const { attachPostHog, captureEvent } = await events();
    for (let i = 0; i < 150; i++) captureEvent(`e${i}`);
    const { capture, client } = fakeClient();
    attachPostHog(client);
    expect(capture).toHaveBeenCalledTimes(100);
    expect(capture.mock.calls[0][0]).toBe('e0');
    expect(capture.mock.calls[99][0]).toBe('e99');
  });

  it('are sent once, to the first client', async () => {
    const { attachPostHog, captureEvent } = await events();
    captureEvent('a');
    const first = fakeClient();
    const second = fakeClient();
    attachPostHog(first.client);
    attachPostHog(second.client);
    captureEvent('b');
    expect(first.capture.mock.calls.map((call) => call[0])).toEqual(['a', 'b']);
    expect(second.capture).not.toHaveBeenCalled();
  });

  it('are not kept on a build without a key', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    const { attachPostHog, captureEvent, capturePageview } = await events();
    capturePageview();
    captureEvent('a');
    const { capture, client } = fakeClient();
    attachPostHog(client);
    expect(capture).not.toHaveBeenCalled();
  });
});

// A static import of posthog-js anywhere on the client puts its 318 KB back
// into the first scripts of every page. Types and import() are fine.
it('no source file imports posthog-js except as a type or with import()', () => {
  const src = path.resolve(__dirname, '..');
  const offending: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach((line, i) => {
            if (!/['"]posthog-js(\/[^'"]*)?['"]/.test(line)) return;
            if (/^\s*import type\b/.test(line) || /\bimport\(\s*['"]posthog-js/.test(line)) return;
            offending.push(`${path.relative(src, file)}:${i + 1}: ${line.trim()}`);
          });
      }
    }
  };
  walk(src);
  expect(offending).toEqual([]);
});
