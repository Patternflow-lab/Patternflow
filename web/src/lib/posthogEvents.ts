import type { PostHog } from 'posthog-js';
import { CAMPAIGN_ROUTES } from './campaignRoutes';

type EventProperties = Record<string, string | number | boolean | null | undefined>;

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const CAMPAIGN_STORAGE_KEY = 'patternflow_campaign';

// posthog-js arrives after the page has loaded (providers/PostHogProvider.tsx),
// so it stays out of every page's first scripts: on /contact it was the largest
// of them, 318 KB against react-dom's 207 KB. An event captured before then
// waits here with its own time and URL, and goes when the client is handed in.
// The cap is a page that never finishes loading; the first 100 are kept.
const PENDING_MAX = 100;
let client: PostHog | null = null;
const pending: { event: string; properties: EventProperties; timestamp: Date }[] = [];

function send(event: string, properties: EventProperties) {
  if (client) {
    client.capture(event, properties);
  } else if (pending.length < PENDING_MAX) {
    pending.push({ event, properties, timestamp: new Date() });
  }
}

/** The initialised client, once: what waited is sent, in order, with the time it happened. */
export function attachPostHog(posthog: PostHog) {
  if (client) return;
  client = posthog;
  for (const { event, properties, timestamp } of pending.splice(0)) {
    posthog.capture(event, properties, { timestamp });
  }
}

function getPropertiesFromSearch(params: URLSearchParams) {
  const properties: Record<string, string> = {};

  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) properties[key] = value;
  });

  return properties;
}

function getPropertiesFromPath(pathname: string) {
  return CAMPAIGN_ROUTES.find((route) => route.path === pathname)?.properties ?? {};
}

function readStoredCampaign() {
  try {
    const value = window.sessionStorage.getItem(CAMPAIGN_STORAGE_KEY);
    return value ? JSON.parse(value) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function storeCampaign(properties: Record<string, string>) {
  try {
    window.sessionStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(properties));
  } catch {
    // Ignore private browsing / storage-disabled sessions.
  }
}

export function getCampaignProperties() {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const directProperties = {
    ...getPropertiesFromPath(window.location.pathname),
    ...getPropertiesFromSearch(params),
  };

  if (Object.keys(directProperties).length > 0) {
    storeCampaign(directProperties);
    return directProperties;
  }

  return readStoredCampaign();
}

export function capturePageview() {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  send('$pageview', {
    $current_url: window.location.href,
    ...getCampaignProperties(),
  });
}

export function captureEvent(eventName: string, properties: EventProperties = {}) {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  send(eventName, {
    ...getCampaignProperties(),
    path: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer || undefined,
    ...properties,
  });
}
