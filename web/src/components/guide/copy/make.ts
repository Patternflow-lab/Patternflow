import type { ClosingCopy, OpeningCopy } from "../copy";
import type { GuideLang } from "../store";

// The Make guide's own words (/guide/make): its title for search and
// sharing, the opening and the end. The chapters' words are beside this file
// (community.ts, lab.ts); the small print every guide shares — "From the
// maker", "Stuck here?" — is copy.ts's `ui`. Sound and MIDI are a guide of their own
// (copy/audio.ts); the ones still to come (MQTT, Clock, Performance,
// Editions) join this one as chapters.

export type MakeCopy = {
  meta: { title: string; description: string };
  /** The guide's name: in the hub, and where a "Stuck here?" issue says the reader was. */
  name: string;
  opening: OpeningCopy;
  next: ClosingCopy;
};

const en: MakeCopy = {
  meta: {
    title: "Make your own Patternflow patterns",
    description:
      "The Make guide of Patternflow: find patterns and decks in the community, then make your own in Pattern Lab (layers, Graphic Export and Director), hands-on in your own Lab beside the steps, with a practice community and a practice AI.",
  },
  name: "Make",
  opening: {
    kicker: "The guide · Make",
    title: "Make your own.",
    lede: "Every pattern on your board was made by someone. This is where they come from: the community, where people share them, and Pattern Lab, where you make your own.",
    scroll: "Scroll",
    chapters: ["Community", "Pattern Lab"],
    back: { label: "All guides", to: "hub" },
  },
  next: {
    title: "Still to come.",
    lede: "Now you can find patterns and make your own. This guide grows: the rest of what the board can do joins it here, a chapter at a time.",
    groups: [
      { label: "The Audio guide", items: ["A browser tab, the microphone, MIDI & your DAW"], to: "audio" },
      { label: "Joining this guide", items: ["Editions", "MQTT", "Clock", "Performance"], later: true },
    ],
    until: "Until they're here, the real things:",
    links: [
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
    report: { title: "stuck", where: "The Make guide, somewhere not listed" },
  },
};

const ko: MakeCopy = {
  meta: {
    title: "패턴플로우 내 패턴 만들기",
    description:
      "패턴플로우 만들기 가이드. 커뮤니티에서 패턴과 덱을 찾고, 패턴 랩에서 직접 만들어요. 레이어, 그래픽 익스포트, 디렉터까지 내 랩과 연습용 커뮤니티, 연습용 AI로 직접 해 봐요.",
  },
  name: "만들기",
  opening: {
    kicker: "가이드 · 만들기",
    title: "내 걸 만들어요.",
    lede: "보드 위의 패턴은 전부 누군가 만든 거예요. 여기선 그 패턴들이 어디서 오는지 봐요. 사람들이 나누는 커뮤니티, 그리고 내 패턴을 만드는 패턴 랩.",
    scroll: "스크롤",
    chapters: ["커뮤니티", "패턴 랩"],
    back: { label: "가이드 전체", to: "hub" },
  },
  next: {
    title: "아직 남은 이야기.",
    lede: "이제 패턴을 찾을 수도, 직접 만들 수도 있어요. 보드가 할 수 있는 나머지 이야기는 이 가이드에 한 챕터씩 이어서 들어와요.",
    groups: [
      { label: "오디오 가이드", items: ["브라우저 탭 소리, 마이크, MIDI와 DAW"], to: "audio" },
      { label: "이 가이드에 들어올 것들", items: ["에디션", "MQTT", "시계", "퍼포먼스"], later: true },
    ],
    until: "그동안은 바로 가서 해 봐도 돼요.",
    links: [
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
    report: { title: "stuck", where: "만들기 가이드 어딘가 (단계 없음)" },
  },
};

export const MAKE_COPY: Record<GuideLang, MakeCopy> = { en, ko };
