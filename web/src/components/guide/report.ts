// "Stuck here?" — every step of the guide can open a GitHub issue that
// already says where the reader was (the guide_stuck.yml form in
// .github/ISSUE_TEMPLATE): the chapter and step, a link back to it, and the
// browser. The reader only has to say what happened. Nothing else about them
// goes into the address.

const NEW_ISSUE = "https://github.com/engmung/Patternflow/issues/new";

/** "Chrome 140 on Windows" — which browser a step failed in, from the user agent. */
export function describeBrowser(ua: string): string {
  const browser =
    match(ua, /Edg(?:e|A|iOS)?\/(\d+)/, "Edge") ??
    match(ua, /OPR\/(\d+)/, "Opera") ??
    match(ua, /SamsungBrowser\/(\d+)/, "Samsung Internet") ??
    match(ua, /Firefox\/(\d+)/, "Firefox") ??
    match(ua, /(?:Chrome|CriOS)\/(\d+)/, "Chrome") ??
    match(ua, /Version\/(\d+)[\d.]* .*Safari/, "Safari") ??
    "an unknown browser";
  const os = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /CrOS/.test(ua)
            ? "ChromeOS"
            : /Linux/.test(ua)
              ? "Linux"
              : "an unknown system";
  return `${browser} on ${os}`;
}

function match(ua: string, re: RegExp, name: string): string | null {
  const m = ua.match(re);
  return m ? `${name} ${m[1]}` : null;
}

/**
 * The new-issue address for a place in the guide. `where` is what the form's
 * "Where in the guide" field says. `here` — a link back to the step and the
 * browser — is only known in the browser, when the link is followed; the
 * address rendered with the page leaves it out, so server and client agree.
 */
export function reportUrl(title: string, where: string, here?: { back?: string; browser: string }): string {
  const q = new URLSearchParams({
    template: "guide_stuck.yml",
    title: `[guide] ${title}`,
    where: here?.back ? `${where} (${here.back})` : where,
  });
  if (here) q.set("browser", here.browser);
  // Spaces as %20, not "+": the form shows what it is given.
  return `${NEW_ISSUE}?${q.toString().replace(/\+/g, "%20")}`;
}

/** Where the reader is, for reportUrl: the page and the step's anchor, and their browser. */
export function hereFor(anchor?: string) {
  const loc = window.location;
  return {
    back: anchor ? `${loc.origin}${loc.pathname}#${anchor}` : undefined,
    browser: describeBrowser(window.navigator.userAgent),
  };
}
