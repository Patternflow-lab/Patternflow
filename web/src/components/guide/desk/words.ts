import type { GuideLang } from "../store";

// The desk's own few words: its window chrome, the card's cue line under a
// step with a tutorial (DeskCue), and the Lab window's notices. What the
// pointer says at each beat is the tutorial's (tutorials/*.ts `say`).

export type DeskWords = {
  /** The cue line's button: the current beat's gesture again (or, when done, the whole step's). */
  again: string;
  /** The cue line while the pointer shows the way. */
  watch: string;
  /** The cue line while the pointer waits for the reader and the beat has no hint of its own. */
  yourTurn: string;
  /** The cue line when the step's tutorial is done. */
  done: string;
  /** A keyboard-only button in the cue line: focus into the window the pointer is working in (on the control it points at, when it can take focus). */
  toWindow: string;
  /** A dimmed window's cover: brings it forward. */
  bringForward: (title: string) => string;
  /** The Lab window's tab, until the Lab says its own title. */
  labTitle: string;
  /** The Lab window's small tag: what's in it is theirs. */
  labBadge: string;
  /** The Lab in another tab saved the same draft. */
  otherTab: string;
  /** The desk as a whole, for assistive tech. */
  deskLabel: string;
};

export const DESK_WORDS: Record<GuideLang, DeskWords> = {
  en: {
    again: "Show me again",
    watch: "Follow the pointer",
    yourTurn: "Your turn",
    done: "Done",
    toWindow: "Go to the window",
    bringForward: (title) => `Bring ${title} to the front`,
    labTitle: "Pattern Lab / Patternflow",
    labBadge: "Your Lab",
    otherTab: "Pattern Lab just saved from another tab. Edit in one place: two open Labs overwrite each other's saves.",
    deskLabel: "Practice desk",
  },
  ko: {
    again: "다시 보기",
    watch: "포인터를 따라가 봐요",
    yourTurn: "이제 직접 해 봐요",
    done: "다 했어요",
    toWindow: "창으로 가기",
    bringForward: (title) => `${title} 창을 앞으로`,
    labTitle: "Pattern Lab / Patternflow",
    labBadge: "내 랩",
    otherTab: "다른 탭의 패턴 랩이 방금 저장했어요. 한 곳에서만 고쳐 주세요. 둘 다 열려 있으면 서로의 저장을 덮어써요.",
    deskLabel: "연습 창",
  },
};
