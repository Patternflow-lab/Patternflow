// originBlocked() is the first thing 29 community routes call. It is what
// stops a cross-site write: a like toggle sent with no Content-Type goes out
// without a preflight, so by the time the browser hides the answer the like
// has been saved. The smoke scripts leave Origin off on purpose, so this file
// is where the answer to a real browser's Origin is checked.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { originBlocked, preflight, withCors } from "./cors";

const SITE = "https://patternflow.work";
const COMMUNITY = "https://community.patternflow.work";

/** A request as it reaches the community host, with the headers given. */
function request(headers: Record<string, string>, method = "POST"): Request {
  return new Request(`${COMMUNITY}/api/community/patterns/p1/like`, {
    method,
    headers: { host: "community.patternflow.work", ...headers },
  });
}

const saved = process.env.COMMUNITY_ALLOWED_ORIGINS;

beforeEach(() => {
  // The spacing is how a hand-edited env file tends to look.
  process.env.COMMUNITY_ALLOWED_ORIGINS = ` ${SITE} , http://localhost:3000`;
});

afterEach(() => {
  if (saved === undefined) delete process.env.COMMUNITY_ALLOWED_ORIGINS;
  else process.env.COMMUNITY_ALLOWED_ORIGINS = saved;
});

describe("originBlocked", () => {
  it("lets a request with no Origin through to the session check", () => {
    expect(originBlocked(request({}))).toBeNull();
  });

  it("lets the community host's own pages through", () => {
    expect(originBlocked(request({ origin: COMMUNITY }))).toBeNull();
  });

  it("lets an origin on the allow-list through", () => {
    expect(originBlocked(request({ origin: SITE }))).toBeNull();
    expect(originBlocked(request({ origin: "http://localhost:3000" }))).toBeNull();
  });

  it("refuses any other site with a 403", async () => {
    const blocked = originBlocked(request({ origin: "https://example.com" }));
    expect(blocked?.status).toBe(403);
    expect(await blocked?.json()).toEqual({ error: "Origin not allowed." });
  });

  it("matches whole origins, not the start of one", () => {
    for (const origin of [
      "https://patternflow.work.example.com",
      "https://community.patternflow.work.example.com",
      "https://patternflow.work:8443",
      `${SITE}/`,
    ]) {
      expect(originBlocked(request({ origin }))?.status, origin).toBe(403);
    }
  });

  it("refuses the plain-http twin of an allowed origin", () => {
    expect(originBlocked(request({ origin: "http://patternflow.work" }))?.status).toBe(403);
    expect(originBlocked(request({ origin: "http://community.patternflow.work" }))?.status).toBe(403);
  });

  it("refuses the opaque origin a sandboxed frame or a file sends", () => {
    expect(originBlocked(request({ origin: "null" }))?.status).toBe(403);
  });

  it("takes the scheme from the proxy in front of it", () => {
    // A tunnel that ends TLS hands the Pi plain http and says what it was.
    const tunnelled = { host: "pi.local:3000", "x-forwarded-proto": "http" };
    expect(originBlocked(request({ ...tunnelled, origin: "http://pi.local:3000" }))).toBeNull();
    expect(originBlocked(request({ ...tunnelled, origin: "https://pi.local:3000" }))?.status).toBe(403);
  });

  it("reads a local host as http", () => {
    expect(originBlocked(request({ host: "localhost:3100", origin: "http://localhost:3100" }))).toBeNull();
    expect(originBlocked(request({ host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" }))).toBeNull();
  });

  it("refuses everyone but its own host when the allow-list is unset", () => {
    delete process.env.COMMUNITY_ALLOWED_ORIGINS;
    expect(originBlocked(request({ origin: COMMUNITY }))).toBeNull();
    expect(originBlocked(request({ origin: SITE }))?.status).toBe(403);
  });
});

describe("withCors", () => {
  it("names an allowed origin back, with credentials", () => {
    const response = withCors(request({ origin: SITE }), Response.json({ liked: true }));
    expect(response.headers.get("access-control-allow-origin")).toBe(SITE);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("vary")).toBe("Origin");
  });

  it("adds nothing for a foreign origin or a request without one", () => {
    const cases: Record<string, string>[] = [{ origin: "https://example.com" }, {}];
    for (const headers of cases) {
      const response = withCors(request(headers), Response.json({ liked: true }));
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    }
  });
});

describe("preflight", () => {
  it("answers an allowed origin with the methods and the one header the routes take", () => {
    const response = preflight(request({ origin: SITE }, "OPTIONS"));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(SITE);
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, PATCH, DELETE, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toBe("Content-Type");
  });

  it("refuses any other origin with a bare 403", () => {
    const response = preflight(request({ origin: "https://example.com" }, "OPTIONS"));
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
});
