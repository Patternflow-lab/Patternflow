import { preset as p0710 } from "@/lib/presets/pattern-0710";
import { preset as p0713 } from "@/lib/presets/pattern-0713";
import type { GuideLang } from "../../store";
import { HEADER_0710, HEADER_0713 } from "./headers";

// The practice AI's set answers (Make · 02 Pattern Lab, on the make page's desk).
// It knows two prompts, both the Lab's own, and tells them apart by lines
// their builders always write:
//
//   the variation prompt   Copy prompt, app/pattern-lab/panels/CodePanel.tsx
//                          → buildVariantCopyPrompt, lib/ai/gemini.ts
//   the conversion prompt  Copy the conversion prompt, app/pattern-lab/HardwareModal.tsx
//                          → buildCppPrompt, lib/lab/cppPrompt.ts
//
// and one it doesn't answer but names: a layer stack's per-layer prompt (To
// hardware's Copy prompt when the Lab has layers, lib/lab/hExport.ts
// buildLayerPrompt), which gets a set reply saying how to get the one-layer
// conversion prompt instead.
//
// To the first it answers with a real preset's JavaScript, to the second
// with the same preset's real firmware header — web/src/lib/presets and
// firmware/patternflow/presets are twins (firmware/toolchain/check_presets.py).
// Anything else gets one polite set reply. answers.test.ts builds both
// prompts with the Lab's own builders and checks the answers against the
// preset files.

export type PromptKind = "variation" | "conversion" | "layer" | "other";

/** Lines buildVariantCopyPrompt always writes (its intro and its output rules). */
export const VARIATION_MARKERS = [
  "I will give you one existing Patternflow pattern.",
  "Return exactly 5 separate JavaScript code blocks.",
] as const;

/** buildCppPrompt's first line, and the heading its JavaScript goes under. */
export const CONVERSION_MARKERS = [
  "Convert the JavaScript LED pattern below into a single complete Arduino-compatible C++ header for the Patternflow ESP32-S3 firmware.",
  "## JavaScript source",
] as const;

/** buildLayerPrompt's first line (one layer of a stack). */
export const LAYER_MARKER = "Translate ONE LAYER of a Patternflow layer-stack composition from JavaScript to C++ for the ESP32-S3 firmware.";

export function recognize(text: string): PromptKind {
  const t = text.replace(/\r\n?/g, "\n");
  // The conversion prompt first: it opens with its own line, and the JS it
  // carries could quote anything.
  if (t.trimStart().startsWith(CONVERSION_MARKERS[0]) && t.includes(CONVERSION_MARKERS[1])) return "conversion";
  if (t.trimStart().startsWith(LAYER_MARKER)) return "layer";
  if (VARIATION_MARKERS.every((m) => t.includes(m))) return "variation";
  return "other";
}

/** A preset the practice AI answers with: its JS and its firmware header. */
export type AiPreset = {
  id: string;
  /** web/src/lib/presets/pattern-<id>.ts, its `code`. */
  js: string;
  /** firmware/patternflow/presets/preset_<id>.h */
  h: string;
  /** Its header's title line: how a prompt carrying this pattern is recognised. */
  title: RegExp;
};

/**
 * The first one unless the reader's Lab already holds it: then the second, so
 * the preview always visibly changes. Neither is the Lab's opening pattern
 * (0707, the first lab-only preset).
 */
export const AI_PRESETS: readonly AiPreset[] = [
  { id: "0710", js: p0710.code, h: HEADER_0710, title: /^\/\/ Title:\s+260710\s*$/m },
  { id: "0713", js: p0713.code, h: HEADER_0713, title: /^\/\/ Title:\s+260713_Firefly\s*$/m },
];

export type SetAnswer =
  | { kind: "variation"; preset: AiPreset; code: string; lang: "javascript" }
  | { kind: "conversion"; preset: AiPreset; code: string; lang: "cpp" }
  | { kind: "layer" }
  | { kind: "other" };

/**
 * The set answer to a pasted text. `lastJs` is the preset whose JS this
 * practice AI last gave: a conversion prompt for a pattern it doesn't know
 * gets that one's header (the reader edited the code, or pasted another).
 */
export function answer(text: string, lastJs: string | null = null): SetAnswer {
  const kind = recognize(text);
  if (kind === "variation") {
    const preset = AI_PRESETS.find((p) => !p.title.test(text)) ?? AI_PRESETS[0];
    return { kind, preset, code: preset.js, lang: "javascript" };
  }
  if (kind === "conversion") {
    const preset =
      AI_PRESETS.find((p) => p.title.test(text)) ?? AI_PRESETS.find((p) => p.id === lastJs) ?? AI_PRESETS[0];
    return { kind, preset, code: preset.h, lang: "cpp" };
  }
  return { kind: kind === "layer" ? "layer" : "other" };
}

/** What the practice AI says, around its code. */
export type AiWords = {
  /** The first message, before anything is pasted. */
  hello: string;
  /** Before the JavaScript. */
  variation: string;
  /** Before the header. */
  conversion: string;
  /** To a layer stack's per-layer prompt. */
  layer: string;
  /** To anything else. */
  other: string;
  placeholder: string;
  send: string;
  copy: string;
  copied: string;
  /** When the clipboard refused: the code is selected instead, for the reader's own copy keys. */
  copyByHand: (keys: string) => string;
  /** The reader's pasted text, collapsed. */
  pasted: (lines: number) => string;
  thinking: string;
  /** The conversation, for assistive tech. */
  thread: string;
  input: string;
};

export const AI_WORDS: Record<GuideLang, AiWords> = {
  en: {
    hello: "I'm a practice AI, and I give set answers. Paste the prompt you copied in the Lab, then press Send.",
    variation: "A real AI would give you five. Here's one. Copy it, then press Paste in the Lab.",
    conversion:
      "Here's the .h. It's this pattern's own header from the firmware, so it keeps its own colours and knob ranges, not the ones you set. A real AI writes it from your prompt. Copy it and paste it into the box in the Lab.",
    layer:
      "That's a prompt for one layer of a stack. Hide the other layers, so To hardware offers Copy the conversion prompt, and paste that one.",
    other:
      "I only give set answers, and I know just two prompts: the one from Copy prompt in the Lab, and the one from Copy the conversion prompt in To hardware. Paste one of those.",
    placeholder: "Paste here, then Send",
    send: "Send",
    copy: "Copy",
    copied: "Copied ✓",
    copyByHand: (keys) => `Selected: press ${keys}`,
    pasted: (n) => `Pasted text · ${n} ${n === 1 ? "line" : "lines"}`,
    thinking: "Writing…",
    thread: "Conversation with the practice AI",
    input: "Message to the practice AI",
  },
  ko: {
    hello: "저는 정해진 답만 하는 연습용 AI예요. 랩에서 복사한 프롬프트를 붙여넣고 보내기를 눌러요.",
    variation: "진짜 AI라면 다섯 개를 줘요. 여기선 하나예요. 복사한 다음 랩에서 Paste를 눌러요.",
    conversion:
      ".h예요. 이 패턴이 펌웨어에 원래 가진 헤더라서, 내가 정한 색과 노브 범위가 아니라 원래 것 그대로예요. 진짜 AI는 내 프롬프트대로 써 줘요. 복사해서 랩의 상자에 붙여넣어요.",
    layer:
      "레이어가 여러 개일 때 레이어 하나에 쓰는 프롬프트예요. 다른 레이어를 숨기면 To hardware에 Copy the conversion prompt가 나와요. 그걸로 복사해서 붙여넣어 주세요.",
    other:
      "저는 정해진 답만 하고, 아는 프롬프트도 둘뿐이에요. 랩의 Copy prompt로 복사한 것과 To hardware의 Copy the conversion prompt로 복사한 것이요. 둘 중 하나를 붙여넣어 주세요.",
    placeholder: "여기에 붙여넣고 보내기",
    send: "보내기",
    copy: "복사",
    copied: "복사됨 ✓",
    copyByHand: (keys) => `선택했어요. ${keys}를 눌러요`,
    pasted: (n) => `붙여넣은 글 · ${n}줄`,
    thinking: "쓰는 중…",
    thread: "연습용 AI와의 대화",
    input: "연습용 AI에게 보낼 글",
  },
};
