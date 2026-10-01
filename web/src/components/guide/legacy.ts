// The guide's old addresses. Until October 2026 the Play guide was /guide
// itself, so /guide#flash, /guide#knobs-3, /guide/ko#console and the like
// are out there — in links, bookmarks, old release notes, and the "Stuck
// here?" issues already filed. /guide is the hub now (GuideHub); an old
// anchor on it means the same place under /guide/play.
//
// Two things send the reader on, both from here:
//   - LEGACY_GUIDE_REDIRECT, inline in the root layout's <head>, on a page
//     load: it runs before the hub is parsed, so the hub never shows.
//   - GuideHub, when the hub is reached without a load (a client-side link,
//     a hash typed into the address bar), before it paints.
// Pure and dependency-free: the root layout imports it.

/** Play's chapters and their steps' anchors, as they were on /guide: #flash, #flash-3, #next. */
const ANCHOR = "^(flash|knobs|patterns|console|next)(-[0-9]+)?$";

/** Where the hub was, and where its old anchors now live. */
const MOVED: Record<string, string> = { "/guide": "/guide/play", "/guide/ko": "/guide/play/ko" };

/**
 * Where an old address of the Play guide now is — `/guide/play#flash-3` for
 * `/guide` + `#flash-3` — or null when the address is not one of those.
 */
export function legacyGuideTarget(pathname: string, search: string, hash: string): string | null {
  const to = MOVED[pathname.replace(/\/+$/, "")];
  const anchor = hash.replace(/^#/, "");
  if (!to || !new RegExp(ANCHOR).test(anchor)) return null;
  return `${to}${search}#${anchor}`;
}

/**
 * The same rule as a script for the root layout's <head>. It hides the
 * document (on the guide's dark ground, not the site's cream) before
 * leaving, so nothing of the hub flashes while /guide/play loads.
 */
export const LEGACY_GUIDE_REDIRECT = `(function(){try{var l=location,m=${JSON.stringify(MOVED)},to=m[l.pathname.replace(/\\/+$/,"")],a=l.hash.slice(1);if(to&&new RegExp(${JSON.stringify(ANCHOR)}).test(a)){var d=document.documentElement;d.style.visibility="hidden";d.style.background="#0a0908";l.replace(to+l.search+"#"+a);}}catch(e){}})();`;
