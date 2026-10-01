import type { GuideLang, GuidePageId } from "../store";

// The hub's words (/guide, GuideHub): where the reader picks a guide by
// where their Patternflow is. Each guide's name and chapter list come from
// the guide itself (pages.ts); what is here is the situation it is for and
// what it covers. The brand, the WIP chip and the language switch are
// copy.ts's.
//
// Build is for someone soldering a Patternflow from bare parts — starting
// with nothing: its first chapters are buying the parts, ordering the board
// and printing the case, so its situation must not assume they are already
// on the bench. There are no kits and no assembled boards: never offer one.

export type HubGuideCopy = {
  /** Who it is for, in the reader's words: the line they recognise themselves in. */
  situation: string;
  /** What is in it. */
  about: string;
  /** The way in. */
  go: string;
  /** Guides that will join this one, named but not linked. */
  later?: { label: string; items: string[] };
};

export type HubCopy = {
  meta: { title: string; description: string };
  kicker: string;
  title: string;
  lede: string;
  guides: Record<GuidePageId, HubGuideCopy>;
  /** The page's "Stuck?" issue: the link and where it says the reader was. */
  report: { label: string; where: string };
};

const en: HubCopy = {
  meta: {
    title: "The Patternflow guide",
    description:
      "Three guides, by where you are: build a Patternflow from bare parts, play the one you've built, then make your own patterns and the extras.",
  },
  kicker: "The guide",
  title: "Start where you are.",
  lede: "Three guides, one after the other. Pick the one for where your Patternflow is now.",
  guides: {
    build: {
      situation: "You're building one from scratch.",
      about: "Order the board, print the case, solder the parts, put it together and power it up.",
      go: "Build it",
    },
    play: {
      situation: "Your Patternflow is built.",
      about: "Its firmware and your Wi-Fi, the four knobs, more patterns, and the device's own console.",
      go: "Play it",
    },
    make: {
      situation: "It plays. Now make your own patterns — and the extras.",
      about: "Find patterns in the community, then make your own in Pattern Lab.",
      go: "Make your own",
      later: { label: "Joining it later", items: ["Sound", "MIDI & OSC", "MQTT", "Clock", "Performance", "Editions"] },
    },
  },
  report: { label: "Stuck? Tell us", where: "The guide, somewhere not listed" },
};

const ko: HubCopy = {
  meta: {
    title: "패턴플로우 가이드",
    description:
      "지금 있는 곳에 맞춰 고르는 가이드 세 개. 맨 부품에서 납땜해 만들고, 다 만든 걸 연주하고, 내 패턴과 그 밖의 것들을 만들어요.",
  },
  kicker: "가이드",
  title: "지금 있는 곳에서 시작해요.",
  lede: "가이드는 세 개, 차례로 이어져요. 내 패턴플로우가 지금 어디쯤인지에 맞춰 골라요.",
  guides: {
    build: {
      situation: "처음부터 직접 만들 거예요.",
      about: "기판을 주문하고, 케이스를 출력하고, 부품을 납땜해 조립하고, 전원을 넣어요.",
      go: "조립하러 가기",
    },
    play: {
      situation: "패턴플로우를 다 만들었어요.",
      about: "펌웨어와 와이파이, 노브 네 개, 패턴 더 넣기, 그리고 기기의 웹 콘솔.",
      go: "연주하러 가기",
    },
    make: {
      situation: "잘 돌아가요. 이제 내 패턴과 그 밖의 것들.",
      about: "커뮤니티에서 패턴을 찾고, 패턴 랩에서 내 걸 만들어요.",
      go: "만들러 가기",
      later: { label: "나중에 여기로 들어와요", items: ["소리", "MIDI · OSC", "MQTT", "시계", "퍼포먼스", "에디션"] },
    },
  },
  report: { label: "막혔나요? 알려 주세요", where: "가이드 어딘가 (단계 없음)" },
};

export const HUB_COPY: Record<GuideLang, HubCopy> = { en, ko };
