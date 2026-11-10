// The board address as people type it. An emptied field used to make
// http:///patterns?src=…, which a browser reads as a host called "patterns",
// and an address pasted from the console's own tab (http://192.168.0.44/)
// made a host called "http".

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { deviceHostName, useDeviceHost } from "./deviceHost";

afterEach(() => {
  window.localStorage.clear();
});

describe("deviceHostName", () => {
  it("falls back to patternflow.local when the field is empty", () => {
    expect(deviceHostName("")).toBe("patternflow.local");
    expect(deviceHostName("   ")).toBe("patternflow.local");
    expect(deviceHostName("http://")).toBe("patternflow.local");
  });

  it("drops the scheme and anything after the host", () => {
    expect(deviceHostName("http://192.168.0.44")).toBe("192.168.0.44");
    expect(deviceHostName(" HTTP://192.168.0.44/ ")).toBe("192.168.0.44");
    expect(deviceHostName("https://patternflow.local/patterns")).toBe("patternflow.local");
    expect(deviceHostName("192.168.0.44/")).toBe("192.168.0.44");
    expect(deviceHostName("192.168.0.44/?src=x#top")).toBe("192.168.0.44");
  });

  it("keeps a plain host and its port as typed", () => {
    expect(deviceHostName("patternflow.local")).toBe("patternflow.local");
    expect(deviceHostName("192.168.0.44:8080")).toBe("192.168.0.44:8080");
    expect(deviceHostName("patternflow")).toBe("patternflow");
  });
});

describe("useDeviceHost", () => {
  const patternsHost = (stored: string) => {
    window.localStorage.setItem("pf-device-host", stored);
    const { result } = renderHook(() => useDeviceHost());
    const url = new URL(result.current.patternsUrl("/api/community/patterns/p123/zip"));
    return { url, result };
  };

  it("sends an emptied field to patternflow.local, not to a host called patterns", () => {
    const { url, result } = patternsHost("");
    expect(url.host).toBe("patternflow.local");
    expect(url.pathname).toBe("/patterns");
    expect(result.current.host).toBe("patternflow.local");
    // The field itself still shows what was typed: nothing, over the placeholder.
    expect(result.current.deviceHost).toBe("");
  });

  it("sends a pasted http:// address to the board, not to a host called http", () => {
    const { url, result } = patternsHost("http://192.168.0.44/");
    expect(url.host).toBe("192.168.0.44");
    expect(url.pathname).toBe("/patterns");
    expect(url.searchParams.get("src")).toBe(
      `${window.location.origin}/api/community/patterns/p123/zip`,
    );
    expect(result.current.host).toBe("192.168.0.44");
    expect(result.current.deviceHost).toBe("http://192.168.0.44/");
  });

  it("follows the field when it changes", () => {
    const { result } = patternsHost("patternflow.local");
    act(() => result.current.changeDeviceHost("https://10.0.0.7/"));
    expect(result.current.host).toBe("10.0.0.7");
    expect(new URL(result.current.patternsUrl("/x")).host).toBe("10.0.0.7");
  });
});
