// Until 25 October 2026 the Lab wrote its FNV-1a hash out three times
// (capture/probe.ts, capture/shaderStore.ts, hardwarePastes.ts). Two of the
// copies name what a browser keeps: the paste a tab files under its prompt,
// and the shader filed under its pattern's source. Moving the hash to one
// place must not move either key, or the next reload finds nothing there.

import { beforeEach, describe, expect, it } from "vitest";
import { loadShaderSource, saveShaderSource } from "./capture/shaderStore";
import { promptKey } from "./hardwarePastes";
import { fnv1a } from "./hash";
import { LAB_STORAGE } from "./persist";

const PROMPT = [
  "- Knob 1: min 0, max 1, current 0.5, calibrated encoder step 0.01 per detent",
  "- Knob 2: min 0, max 4, current 2, calibrated encoder step 0.083 per detent",
].join("\n");

describe("keys the Lab files under a hash", () => {
  beforeEach(() => window.localStorage.clear());

  it("is 32-bit FNV-1a", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
    expect(fnv1a("foobar")).toBe(0xbf9cf968);
  });

  it("files a To hardware paste under the key it had", () => {
    expect(promptKey(PROMPT)).toBe("128:1q359yv");
    // Turning a knob is no reason to ask again, so the position stays out.
    expect(promptKey(PROMPT.replace("current 0.5", "current 0.75"))).toBe("128:1q359yv");
  });

  it("files a shader under the source hash it had", () => {
    const code = "function render(ctx) { return 0; }";
    saveShaderSource("layer-a", code, "void main() {}");
    const saved = JSON.parse(window.localStorage.getItem(LAB_STORAGE.shader) ?? "{}");
    expect(Object.keys(saved).sort()).toEqual(["code:968204348", "id:layer-a"]);
    // A reload mints new layer ids, and the hash finds the shader again.
    expect(loadShaderSource("layer-b", code)).toBe("void main() {}");
  });
});
