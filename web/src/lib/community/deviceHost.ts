"use client";

// Where "Send over Wi-Fi" points, shared by every place that offers it.
//
// patternflow.local works on most platforms; Android cannot resolve .local, so
// the address is editable and remembered across visits and across every
// surface that offers the handoff — telling us the board's IP once should be
// enough. DeviceHostCapture writes the same key when a panel's console links
// here with ?device=<ip>.
//
// The field keeps what was typed, and every link is built from
// deviceHostName() of it. An emptied field used to make http:///patterns,
// which a browser reads as a host called "patterns", and an address pasted
// from the console's own tab (http://192.168.0.44/) made a host called "http".
//
// The URLs handed to the device must be absolute even when the community API
// is same-origin, because it is the *device* that fetches them, from its own
// origin on the LAN.
//
// Read through useSyncExternalStore with a server snapshot, not a lazy
// useState: the edition shelf, /update and the deck panel all server-render,
// and a first client render that already knew the saved address disagreed
// with the HTML — a hydration mismatch on every visit to /editions. The
// server snapshot is the fallback name, so the first paint matches, and the
// saved address arrives on the very next render.

import { useSyncExternalStore } from "react";

import { communityApiUrl } from "./apiBase";

const KEY = "pf-device-host";
const FALLBACK = "patternflow.local";
const CHANGE_EVENT = "pf-device-host-change";

/** The host a link should go to: no scheme, no path, and the fallback name when empty. */
export function deviceHostName(value: string): string {
  const host = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .split(/[/?#]/)[0]
    .trim();
  return host || FALLBACK;
}

function readStored(): string {
  try {
    return window.localStorage.getItem(KEY) ?? FALLBACK;
  } catch {
    return FALLBACK; /* private mode */
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useDeviceHost() {
  const deviceHost = useSyncExternalStore(subscribe, readStored, () => FALLBACK);

  const changeDeviceHost = (value: string) => {
    try {
      window.localStorage.setItem(KEY, value);
    } catch {
      /* private mode */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const host = deviceHostName(deviceHost);

  const absolute = (apiPath: string) =>
    new URL(communityApiUrl(apiPath), window.location.origin).toString();

  /** Device's pattern manager, told to fetch and install a module build. */
  const patternsUrl = (modulesUrl: string) => {
    if (typeof window === "undefined") return "#";
    return `http://${host}/patterns?src=${encodeURIComponent(absolute(modulesUrl))}`;
  };

  return { deviceHost, host, changeDeviceHost, patternsUrl };
}
