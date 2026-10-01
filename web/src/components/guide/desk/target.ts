import type { Target } from "./types";

// Finding what a beat points at, in a window's content, and acting out a
// demo in a practice window. Nothing here throws: a target that isn't there
// (the UI changed, it hasn't rendered yet) is null, and the pointer hides.

/** What "a control" is when a target is given by its words. */
export const CONTROLS =
  'button, a[href], input, textarea, select, summary, label, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="link"], [contenteditable="true"]';

/** An element's words as a reader would read them off it. */
export function wordsOf(el: Element): string[] {
  const out: string[] = [];
  const add = (s: string | null | undefined) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  };
  add((el as HTMLElement).innerText ?? el.textContent);
  add(el.getAttribute("aria-label"));
  add(el.getAttribute("title"));
  add(el.getAttribute("placeholder"));
  // By tag, not instanceof: the Lab's elements are of its frame's realm.
  if (el.tagName === "INPUT" && ["button", "submit"].includes((el as HTMLInputElement).type)) add((el as HTMLInputElement).value);
  return out;
}

function matches(el: Element, text: string | RegExp): boolean {
  const words = wordsOf(el);
  if (typeof text === "string") {
    const want = text.replace(/\s+/g, " ").trim();
    return words.includes(want);
  }
  return words.some((w) => text.test(w));
}

/** It takes up room on the screen (not display:none, not zero-sized, not visibility:hidden). */
export function hasBox(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  const view = el.ownerDocument.defaultView;
  const style = view?.getComputedStyle(el);
  return !style || (style.visibility !== "hidden" && style.opacity !== "0");
}

/** The element a target names inside `root`, or null. */
export function resolveTarget(root: ParentNode | null, target: Target | undefined): Element | null {
  if (!root || !target) return null;
  try {
    if (typeof target === "function") return target(root);
    if (typeof target === "string") {
      const list = root.querySelectorAll(target);
      for (const el of list) if (hasBox(el)) return el;
      return null;
    }
    const nth = target.nth ?? 0;
    let seen = 0;
    for (const el of root.querySelectorAll(target.among ?? CONTROLS)) {
      if (!matches(el, target.text) || !hasBox(el)) continue;
      if (seen++ === nth) return el;
    }
    return null;
  } catch {
    // A selector the browser doesn't take, a function that threw: not there.
    return null;
  }
}

/**
 * Did something happen inside what `target` names? `node` is an event's
 * target. A selector is matched by closest(); words by the nearest control
 * whose words match; a function by containment in what it finds now — so a
 * control React re-rendered since the beat began still counts.
 */
export function targetHas(root: ParentNode | null, target: Target | undefined, node: EventTarget | null): boolean {
  // Not instanceof: a node from the Lab's frame is of that frame's realm.
  const n = node as Node | null;
  if (!root || !target || !n || typeof n.nodeType !== "number") return false;
  const start = n.nodeType === 1 ? (n as Element) : n.parentElement;
  if (!start) return false;
  try {
    if (typeof target === "string") {
      const hit = start.closest(target);
      return Boolean(hit && (root as Node).contains(hit));
    }
    if (typeof target === "function") {
      const el = target(root);
      return Boolean(el && (el === start || el.contains(start)));
    }
    for (let el: Element | null = start.closest(target.among ?? CONTROLS); el; el = el.parentElement?.closest(target.among ?? CONTROLS) ?? null) {
      if (matches(el, target.text)) return (root as Node).contains(el);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Set a field's value the way typing does, so a React-controlled field sees
 * it (the native setter, then an input event). Practice windows only.
 */
export function setFieldValue(el: Element, value: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else if ((el as HTMLElement).isContentEditable) {
    (el as HTMLElement).textContent = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/** The field inside (or at) a target that typing would reach. */
export function fieldOf(el: Element): Element | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el as HTMLElement).isContentEditable) return el;
  return el.querySelector('input:not([type="hidden"]), textarea, [contenteditable="true"]');
}
