import type { LabMirror } from "@/lib/guide/labMirror";

// The stage's copy of the reader's Pattern Lab draft (lib/guide/labMirror.ts):
// read from the browser only when a step wants it and the lab has saved since
// — a `storage` event marks it stale — so nothing reads localStorage per frame.
//
// labMirror brings the lab's flattening and project reader with it, which
// only the make page needs, so it is loaded on demand: preloadLabDraft() on
// that page, while the browser is idle; until it has arrived, labDraft()
// answers null and the board keeps its own pattern.

type Mod = typeof import("@/lib/guide/labMirror");

const feed = {
  mod: null as Mod | null,
  loading: null as Promise<Mod | null> | null,
  dirty: true,
  mirror: null as LabMirror | null,
  subscribers: 0,
  off: null as (() => void) | null,
};

function load(): Promise<Mod | null> {
  if (!feed.loading) {
    feed.loading = import("@/lib/guide/labMirror").then(
      (mod) => {
        feed.mod = mod;
        if (feed.subscribers > 0 && !feed.off) feed.off = listen(mod);
        return mod;
      },
      () => {
        feed.loading = null; // try again next time
        return null;
      },
    );
  }
  return feed.loading;
}

function listen(mod: Mod) {
  return mod.subscribeLabMirror(() => {
    feed.dirty = true;
  });
}

/** Load the reader and read the draft once, ahead of the step that plays it. */
export function preloadLabDraft() {
  void load().then(() => labDraft());
}

/** The draft as it is now, read again only if the lab has saved since; null until the reader has loaded. */
export function labDraft(): LabMirror | null {
  if (!feed.mod) {
    void load();
    return null;
  }
  if (feed.dirty || !feed.mirror) {
    feed.dirty = false;
    feed.mirror = feed.mod.readLabMirror();
  }
  return feed.mirror;
}

/** The last draft read, without reading again (null before the first read). */
export function lastLabDraft(): LabMirror | null {
  return feed.mirror;
}

/** Start following the lab's saves; the returned function stops. */
export function followLabDraft(): () => void {
  if (feed.subscribers++ === 0 && feed.mod) feed.off = listen(feed.mod);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--feed.subscribers === 0) {
      feed.off?.();
      feed.off = null;
      // Whatever was saved while nobody listened, read it fresh next time.
      feed.dirty = true;
    }
  };
}
