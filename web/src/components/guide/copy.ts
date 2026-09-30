import type { GuideLang, GuidePageId } from "./store";
import type { ConsolePage } from "./ConsoleWindow";

// Every word the guide's first page says, in both languages. Scenes and steps
// line up with SCENES in scenes.ts one-to-one: step N of a scene's copy is
// shown while step N of its script is on stage. The second page's words are
// in copy/ (make.ts for the page, community.ts and lab.ts for its chapters);
// the types and `ui` here are shared by both.

export type Extra =
  | "flashButton"
  | "bootSeq"
  | "wifiShots"
  | "deckFan"
  | "installFlow"
  | "consoleDesktop"
  | "consolePhone"
  | "consoleTour"
  // The make page (copy/community.ts, copy/lab.ts): CommunityShots.tsx,
  // LabShots.tsx, LabWindow.tsx.
  | "communityShots"
  | "labShots"
  | "labWindow";

export type StepCopy = {
  kicker: string;
  title: string;
  body: string[];
  /** The maker, aside. */
  note?: string;
  /** A caution worth its own line. */
  warn?: string;
  extra?: Extra;
};

export type SceneCopy = {
  num: string;
  title: string;
  lede: string;
  steps: StepCopy[];
};

/** A page's first screen (pages.ts). */
export type OpeningCopy = {
  kicker: string;
  title: string;
  lede: string;
  scroll: string;
  /** The chapters' names, in order: the opening's list and the rail. */
  chapters: string[];
  /** A quiet link to another page of the guide, under the chapter list. */
  back?: { label: string; to: GuidePageId };
};

/** A page's last screen: what comes next. */
export type ClosingCopy = {
  title: string;
  lede: string;
  /**
   * The guides still to come. A group with `to` is a guide that exists: the
   * whole group links to that page. `later` sets a group as a list of names,
   * three across.
   */
  groups: { label: string; items: string[]; to?: GuidePageId; later?: boolean }[];
  until: string;
  links: { label: string; href: string }[];
  /** The end's "Stuck somewhere else?" issue: its title and where (default: ui.report's). */
  report?: { title: string; where: string };
};

export type GuideCopy = {
  meta: { title: string; description: string };
  brand: string;
  /** The other language's name; where it goes is the page's (pages.ts). */
  langSwitch: { label: string };
  opening: OpeningCopy;
  flash: SceneCopy;
  knobs: SceneCopy;
  patterns: SceneCopy;
  console: SceneCopy;
  next: ClosingCopy;
  ui: {
    noteBy: string;
    /** The "Stuck here?" links (report.ts). */
    report: { step: string; hint: string; general: string; generalTitle: string; generalWhere: string };
    flashUnsupported: string;
    openDecks: string;
    deviceAddress: string;
    bootSteps: [string, string, string];
    /** The line under "Format pattern storage?" in the Patterns page's confirm. */
    install: { confirm: string };
    tourLabel: string;
    /** The tour's tabs: a console page each. */
    pages: { id: ConsolePage; title: string; body: string }[];
  };
};

const en: GuideCopy = {
  meta: {
    title: "How to play Patternflow",
    description:
      "From a bare ESP32 to patterns on your panel: flashing, the four knobs, installing patterns and the device's own console — shown on a Patternflow you can turn.",
  },
  brand: "Patternflow",
  langSwitch: { label: "한국어" },
  opening: {
    kicker: "The guide",
    title: "How to play it.",
    lede: "Four knobs, one panel of light. From the moment it's in your hands to your own patterns running on it — and the device on this page turns, presses and holds exactly like yours.",
    scroll: "Scroll",
    chapters: ["Flash", "Knobs", "Patterns", "Console"],
  },
  flash: {
    num: "01",
    title: "Give it a brain",
    lede: "Once, the first time: the ESP32 gets its firmware and your Wi-Fi.",
    steps: [
      {
        kicker: "The ESP32",
        title: "Everything runs on one small board.",
        body: [
          "Patternflow's brain is an ESP32-S3 module, seated in sockets on the board inside. Slide the back cover off sideways, then lift the module out — gently, straight up.",
        ],
        note: "Built it yourself and haven't seated it yet? Even better. Skip ahead.",
      },
      {
        kicker: "Hold it like this",
        title: "Antenna up, ports toward you.",
        body: [
          "The module at the top, its antenna end up; the two USB-C ports at the bottom. Which way you hold it matters for the next step.",
        ],
      },
      {
        kicker: "The left port",
        title: "Plug into the LEFT one.",
        body: [
          "Use the left port, labelled USB, with a USB-C cable that carries data, and plug the other end into your computer.",
          "The right one (UART) is for Arduino IDE. The browser can flash through it, but it can't set up Wi-Fi there.",
        ],
        warn: "Nothing shows up at all? It's almost always a charge-only cable. Try another one first.",
      },
      {
        kicker: "Flash",
        title: "Flash Patternflow.",
        body: [
          "In desktop Chrome or Edge, press Flash Patternflow below and pick the port. The dialog walks you through the rest; its screens are under the button. The whole thing takes about two minutes.",
        ],
        extra: "flashButton",
      },
      {
        kicker: "No port in the list?",
        title: "Hold BOOT, tap RST, let go.",
        body: [
          "Put it in download mode by hand, then press Flash Patternflow again. The port appears as USB JTAG/serial debug unit.",
        ],
        warn: "In download mode the flasher can't tell it's already Patternflow, so it treats it as new and erases it — installed patterns and saved Wi-Fi too.",
        extra: "bootSeq",
      },
      {
        kicker: "Wi-Fi",
        title: "Type your network.",
        body: [
          "Press Next, then type your network's name exactly — capitals count — and its password. 2.4 GHz only: the ESP32 can't see 5 GHz.",
        ],
        extra: "wifiShots",
      },
      {
        kicker: "Power",
        title: "Back in. Power on.",
        body: [
          "Seat the ESP32 back in its sockets the way the silkscreen shows, slide the back cover on, and plug Patternflow's power cable into a power bank.",
          "Power always goes in through that cable — never through the ESP32's USB ports.",
        ],
        note: "A red, squarish pattern comes on. That's Origin: the first pattern I ever made.",
      },
    ],
  },
  knobs: {
    num: "02",
    title: "Four knobs",
    lede: "Turn, press, hold. That's the whole instrument.",
    steps: [
      {
        kicker: "The numbers",
        title: "They start at the top right.",
        body: ["K1 top right, K2 top left, K3 bottom right, K4 bottom left. Not the order you'd guess."],
        note: "Why the top right? Think about how it was built. I didn't plan it — and never got round to changing it.",
      },
      {
        kicker: "Turn",
        title: "Turning belongs to the pattern.",
        body: [
          "Each knob moves whatever the running pattern gives it. On Origin: K1 colour, K2 speed, K3 the tiling, K4 the wave's frequency.",
          "Every pattern decides its own four. That's the point.",
          "The one here plays like yours: take the orange dot on a knob's ring and drive it round — beside the knob you'll see what that knob is and where it is. Click to press, hold a second for its screen.",
        ],
      },
      {
        kicker: "Press",
        title: "So does a short press.",
        body: [
          "A click goes to the pattern too. On Origin it zeroes that knob: K1 back to red, K2 stops the motion, K3 back to the first tiling, K4 to its lowest frequency.",
        ],
      },
      {
        kicker: "Hold K1",
        title: "Brightness.",
        body: [
          "Hold any knob for a second and the device takes over from the pattern. K1 is brightness: turn K1 to set it, then press K1 — or just wait five seconds.",
        ],
      },
      {
        kicker: "Hold K2",
        title: "The network.",
        body: [
          "K2 shows the Wi-Fi state and the board's IP address, split over two lines. Remember where it is: it's how your phone finds the board.",
          "Turning K1 here puts the panel to sleep. Any knob wakes it.",
        ],
      },
      {
        kicker: "Hold K3",
        title: "Which knob is which.",
        body: ["K3 puts every knob's number on the panel, and the one you're turning lights up in orange."],
      },
      {
        kicker: "Hold K4",
        title: "Patterns.",
        body: [
          "K4 opens the pattern list. Turn K4 to move — three clicks per pattern — and it loads when you stop. Hold K4 again to close it.",
          "Right now it says 1 / 1. That's next.",
        ],
      },
    ],
  },
  patterns: {
    num: "03",
    title: "More patterns",
    lede: "Patterns are small files. They arrive over Wi-Fi — no cable, no reflashing.",
    steps: [
      {
        kicker: "1 / 1",
        title: "A new board has one pattern.",
        body: [
          "Origin is built into the firmware, so a board can always boot into something. Everything else lives on the board's storage and installs in seconds.",
        ],
      },
      {
        kicker: "Basics",
        title: "Let's put the Basics deck on.",
        body: [
          "The community has patterns one by one, and decks — a set of them, like a hand of cards. Basics is the deck made for a new board: 33 patterns, no account needed.",
          "A single pattern goes on the same way, from its own page (Send to my Patternflow). And you can make a deck of your own and share it.",
        ],
        extra: "deckFan",
      },
      {
        kicker: "Install",
        title: "Install to my board.",
        body: [
          "On the Basics card, press Install to my board. Your browser opens the board's own page and hands it the whole pack over your Wi-Fi — the board never goes on the internet itself.",
          "The first time, it asks to format its storage. Press Format storage, confirm, and the pack installs by itself, file by file. It takes under a minute.",
        ],
        warn: "Android can't open patternflow.local. Hold K2 and type the IP address into Device address on the card first.",
        extra: "installFlow",
      },
      {
        kicker: "1 / 34",
        title: "Hold K4 again.",
        body: ["Origin and the 33 Basics. Turn K4 to browse, stop to play, hold to close."],
        note: "Some of these are the very first ones — a little old-fashioned. I like them anyway.",
      },
    ],
  },
  console: {
    num: "04",
    title: "The console",
    lede: "The board serves its own web page. Every setting it has lives there.",
    steps: [
      {
        kicker: "patternflow.local",
        title: "Open it in a browser.",
        body: [
          "On a computer on the same Wi-Fi, go to patternflow.local. What's playing, brightness, sleep, the four knobs as sliders — and a page for everything else.",
          "The one below is live. Open it, step through patterns with the arrows by Now playing or slide a knob, and watch the panel follow.",
        ],
        extra: "consoleDesktop",
      },
      {
        kicker: "On a phone",
        title: "Use the address on K2.",
        body: [
          "Phones — Android especially — often can't find patternflow.local. Hold K2 and type the IP address it shows. On Windows, http://patternflow/ works too.",
          "Same console, phone-sized. Try it here too.",
        ],
        extra: "consolePhone",
      },
      {
        kicker: "Inside",
        title: "What's in it.",
        body: [
          "Patterns to install, delete or download. Up to five Wi-Fi networks, the latest first unless you pick one. Which way each knob counts. And new firmware, over Wi-Fi, with your patterns kept.",
        ],
        extra: "consoleTour",
      },
    ],
  },
  next: {
    title: "Next: make your own.",
    lede: "That was the first hour. The next guide is about making: finding what other people made, and making your own.",
    groups: [
      { label: "The next guide", items: ["Community — patterns and decks", "Pattern Lab — layers, Graphic Export, Director"], to: "make" },
      { label: "After that", items: ["Editions", "Sound", "MIDI & OSC", "MQTT", "Clock", "Performance"], later: true },
    ],
    until: "Until they're here, the real things:",
    links: [
      { label: "Pattern Lab", href: "/pattern-lab" },
      { label: "Community", href: "https://community.patternflow.work/community" },
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
  },
  ui: {
    noteBy: "From the maker",
    report: {
      step: "Stuck here? Tell us",
      hint: "Opens a GitHub issue with this step already filled in",
      general: "Stuck somewhere else? Tell us",
      generalTitle: "stuck",
      generalWhere: "The guide, somewhere not listed",
    },
    flashUnsupported: "Flashing works in desktop Chrome or Edge.",
    openDecks: "Open the decks",
    deviceAddress: "Device address",
    bootSteps: ["Hold BOOT", "Tap RST", "Release BOOT"],
    install: { confirm: "This writes a fresh filesystem to the pattern partition. … On a new board there is nothing there to lose." },
    tourLabel: "Console pages",
    pages: [
      { id: "patterns", title: "Patterns", body: "Click a name to play it. Install, delete, download as a ZIP, and set the order." },
      { id: "wifi", title: "Wi-Fi", body: "Up to five networks, and which one to try first." },
      { id: "knobs", title: "Knobs", body: "Each knob's direction, and how far one click goes." },
      { id: "update", title: "Update", body: "New firmware over Wi-Fi. Your patterns stay." },
    ],
  },
};

const ko: GuideCopy = {
  meta: {
    title: "패턴플로우 사용법",
    description:
      "빈 ESP32에서 내 패널 위의 패턴까지. 펌웨어 굽기, 네 개의 노브, 패턴 설치, 기기의 웹 콘솔을 직접 돌려볼 수 있는 패턴플로우로 보여줍니다.",
  },
  brand: "Patternflow",
  langSwitch: { label: "English" },
  opening: {
    kicker: "사용법",
    title: "이렇게 연주해요.",
    lede: "노브 네 개, 빛의 패널 하나. 손에 들어온 순간부터 내 패턴이 돌아가기까지. 이 페이지의 패턴플로우는 진짜와 똑같이 돌고, 눌리고, 꾹 눌려요.",
    scroll: "스크롤",
    chapters: ["굽기", "노브", "패턴", "콘솔"],
  },
  flash: {
    num: "01",
    title: "두뇌 깨우기",
    lede: "처음 한 번만. ESP32에 펌웨어와 와이파이를 넣어요.",
    steps: [
      {
        kicker: "ESP32",
        title: "모든 건 작은 보드 하나에서 돌아가요.",
        body: [
          "패턴플로우의 두뇌는 ESP32-S3 모듈이에요. 안쪽 기판의 소켓에 꽂혀 있어요. 뒷면 덮개를 옆으로 밀어 빼고, 모듈을 살살 곧게 들어 올려요.",
        ],
        note: "직접 만들고 있는데 아직 안 꽂았다면? 오히려 좋다. 바로 다음으로.",
      },
      {
        kicker: "이렇게 들어요",
        title: "안테나는 위로, 포트는 내 쪽으로.",
        body: ["모듈의 안테나 끝이 위로, USB-C 포트 두 개가 아래로 오게 잡아요. 다음 단계에서 방향이 중요해요."],
      },
      {
        kicker: "왼쪽 포트",
        title: "왼쪽에 꽂아요.",
        body: [
          "USB라고 적힌 왼쪽 포트에 데이터가 되는 USB-C 케이블을 꽂고, 반대쪽은 컴퓨터에 연결해요.",
          "오른쪽(UART)은 아두이노 IDE용이에요. 굽기는 되지만 와이파이 설정이 안 떠요.",
        ],
        warn: "아무것도 안 잡히면 거의 항상 충전 전용 케이블이에요. 케이블부터 바꿔 보세요.",
      },
      {
        kicker: "굽기",
        title: "‘Flash Patternflow’로 구워요.",
        body: [
          "데스크톱 크롬이나 엣지에서 아래 Flash Patternflow를 누르고 포트를 골라요. 나머지는 창이 차례로 안내해요. 그 화면들은 버튼 아래에 순서대로 있어요. 다 해서 2분쯤 걸려요.",
        ],
        extra: "flashButton",
      },
      {
        kicker: "목록에 포트가 없다면",
        title: "BOOT 누른 채로, RST 한 번, BOOT 떼기.",
        body: ["직접 다운로드 모드로 넣고 Flash Patternflow를 다시 눌러요. USB JTAG/serial debug unit이라는 이름으로 나타나요."],
        warn: "다운로드 모드에선 플래셔가 이미 패턴플로우인지 몰라서 새 보드로 보고 지워요. 설치한 패턴과 저장된 와이파이까지요.",
        extra: "bootSeq",
      },
      {
        kicker: "와이파이",
        title: "네트워크 이름을 입력해요.",
        body: [
          "Next를 누르고, 네트워크 이름을 대소문자까지 정확히 치고 비밀번호를 넣어요. 2.4 GHz만 돼요. ESP32는 5 GHz를 못 봐요.",
        ],
        extra: "wifiShots",
      },
      {
        kicker: "전원",
        title: "다시 꽂고, 전원.",
        body: [
          "ESP32를 실크 인쇄 방향대로 소켓에 다시 꽂고, 뒷면 덮개를 밀어 닫고, 패턴플로우 전원 케이블을 보조배터리에 연결해요.",
          "전원은 언제나 그 케이블로만 들어가요. ESP32의 USB 포트로 넣지 않아요.",
        ],
        note: "빨간 네모네모한 패턴이 켜진다. Origin, 내가 처음 만든 패턴이다.",
      },
    ],
  },
  knobs: {
    num: "02",
    title: "노브 네 개",
    lede: "돌리고, 누르고, 꾹. 악기는 그게 전부예요.",
    steps: [
      {
        kicker: "번호",
        title: "오른쪽 위부터 시작해요.",
        body: ["K1 오른쪽 위, K2 왼쪽 위, K3 오른쪽 아래, K4 왼쪽 아래. 예상과 다르죠."],
        note: "왜 오른쪽 위부터냐고? 만들 때를 떠올려 보면 알 수 있다. 의도한 건 아니다. 고치기 귀찮아서 그냥 두었다. 추리해 보도록!",
      },
      {
        kicker: "돌리기",
        title: "돌리는 건 패턴 몫이에요.",
        body: [
          "노브는 지금 돌아가는 패턴이 맡긴 걸 움직여요. Origin에선 K1 색, K2 속도, K3 타일 배치, K4 물결의 촘촘함.",
          "패턴마다 네 개를 다르게 써요. 그게 핵심이에요.",
          "여기 있는 것도 진짜처럼 돌아가요. 노브 둘레의 주황 점을 잡고 빙 돌려 보세요. 옆에 그 노브가 무엇을 얼마나 움직이는지 떠요. 클릭은 누르기, 1초 꾹 누르면 그 노브의 화면이 열려요.",
        ],
      },
      {
        kicker: "누르기",
        title: "짧게 누르는 것도요.",
        body: ["클릭도 패턴에게 가요. Origin에선 그 노브를 0으로 돌려요. K1은 빨강으로, K2는 멈추고, K3는 첫 타일 배치로, K4는 가장 낮은 주파수로."],
      },
      {
        kicker: "K1 꾹",
        title: "밝기.",
        body: ["아무 노브나 1초 꾹 누르면 기기가 패턴한테서 넘겨받아요. K1은 밝기. K1을 돌려 맞추고 K1을 누르거나, 5초 기다리면 돌아와요."],
      },
      {
        kicker: "K2 꾹",
        title: "네트워크.",
        body: [
          "K2는 와이파이 상태와 보드의 IP 주소를 두 줄에 나눠 보여줘요. 기억해 두세요. 폰이 보드를 찾는 방법이에요.",
          "여기서 K1을 돌리면 패널이 잠들어요. 아무 노브나 돌리면 깨요.",
        ],
      },
      {
        kicker: "K3 꾹",
        title: "어느 노브가 몇 번인지.",
        body: ["K3는 노브마다 번호를 패널에 띄워요. 지금 돌리는 노브의 번호가 패널에서 주황색으로 켜져요."],
      },
      {
        kicker: "K4 꾹",
        title: "패턴.",
        body: [
          "K4는 패턴 목록을 열어요. K4를 돌려 이동하고(패턴 하나에 세 칸), 멈추면 그 패턴이 켜져요. K4를 다시 꾹 누르면 닫혀요.",
          "지금은 1 / 1이에요. 그게 다음 이야기예요.",
        ],
      },
    ],
  },
  patterns: {
    num: "03",
    title: "패턴 더 넣기",
    lede: "패턴은 작은 파일이에요. 와이파이로 들어와요. 케이블도, 다시 굽기도 없이.",
    steps: [
      {
        kicker: "1 / 1",
        title: "새 보드엔 패턴이 하나예요.",
        body: ["Origin은 펌웨어에 들어 있어서, 보드가 언제나 뭔가로는 켜질 수 있어요. 나머지는 보드 저장공간에 살고 몇 초면 설치돼요."],
      },
      {
        kicker: "Basics",
        title: "Basics 덱을 올려 봐요.",
        body: [
          "커뮤니티엔 패턴 하나하나와, 여러 개를 카드 패처럼 묶은 덱이 있어요. Basics는 새 보드를 위한 덱이에요. 패턴 33개, 계정도 필요 없어요.",
          "패턴 하나만 올리는 것도 같아요. 그 패턴 페이지에서 Send to my Patternflow를 누르면 돼요. 내 덱을 만들어 공유할 수도 있어요.",
        ],
        extra: "deckFan",
      },
      {
        kicker: "설치",
        title: "‘Install to my board’를 눌러요.",
        body: [
          "Basics 카드에서 Install to my board를 눌러요. 브라우저가 보드의 페이지를 열고 팩 전체를 와이파이로 넘겨줘요. 보드는 인터넷에 직접 나가지 않아요.",
          "처음엔 저장공간을 포맷하라고 해요. Format storage를 누르고 확인하면 팩이 파일 하나씩 알아서 설치돼요. 1분이 안 걸려요.",
        ],
        warn: "안드로이드는 patternflow.local을 못 열어요. K2를 꾹 눌러 나온 IP 주소를 카드의 Device address에 먼저 넣어요.",
        extra: "installFlow",
      },
      {
        kicker: "1 / 34",
        title: "K4를 다시 꾹.",
        body: ["Origin에 Basics 33개. K4를 돌려 넘기고, 멈추면 재생, 꾹 누르면 닫혀요."],
        note: "아주 초기 패턴들이라 좀 촌스러운 것도 있다. 그래도 나는 좋다.",
      },
    ],
  },
  console: {
    num: "04",
    title: "웹 콘솔",
    lede: "보드가 자기 웹페이지를 띄워요. 기기의 모든 설정이 거기 있어요.",
    steps: [
      {
        kicker: "patternflow.local",
        title: "브라우저로 열어요.",
        body: [
          "같은 와이파이의 컴퓨터에서 patternflow.local로 가요. 지금 재생 중인 패턴, 밝기, 잠자기, 슬라이더로 된 노브 네 개. 나머지는 페이지마다 따로 있어요.",
          "아래 창은 진짜로 움직여요. 열어서 Now playing 옆 화살표로 패턴을 넘기거나 노브 슬라이더를 밀어 보세요. 패널이 따라 바뀌어요.",
        ],
        extra: "consoleDesktop",
      },
      {
        kicker: "폰에서",
        title: "K2의 주소를 써요.",
        body: [
          "폰, 특히 안드로이드는 patternflow.local을 못 찾을 때가 많아요. K2를 꾹 눌러 나온 IP 주소를 치면 돼요. 윈도우에선 http://patternflow/ 도 돼요.",
          "같은 콘솔, 폰 크기예요. 여기서도 눌러 보세요.",
        ],
        extra: "consolePhone",
      },
      {
        kicker: "안에는",
        title: "이런 게 있어요.",
        body: ["패턴 설치·삭제·다운로드. 와이파이는 다섯 개까지, 따로 고르지 않으면 최근 것부터 시도해요. 노브마다 도는 방향. 그리고 와이파이로 받는 새 펌웨어. 패턴은 그대로 남아요."],
        extra: "consoleTour",
      },
    ],
  },
  next: {
    title: "다음: 내 패턴 만들기.",
    lede: "여기까지가 처음 한 시간이에요. 다음 가이드는 만드는 이야기예요. 남들이 만든 걸 찾고, 내 걸 만들어요.",
    groups: [
      { label: "다음 가이드", items: ["커뮤니티 — 패턴과 덱", "패턴 랩 — 레이어, 그래픽 익스포트, 디렉터"], to: "make" },
      { label: "그다음", items: ["에디션", "소리", "MIDI · OSC", "MQTT", "시계", "퍼포먼스"], later: true },
    ],
    until: "그동안은 바로 가서 해 봐도 돼요.",
    links: [
      { label: "Pattern Lab", href: "/pattern-lab" },
      { label: "Community", href: "https://community.patternflow.work/community" },
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
  },
  ui: {
    noteBy: "만든 사람의 한마디",
    report: {
      step: "여기서 막혔나요? 알려 주세요",
      hint: "이 단계가 채워진 GitHub 이슈가 열려요",
      general: "다른 데서 막혔나요? 알려 주세요",
      generalTitle: "stuck",
      generalWhere: "가이드 어딘가 (단계 없음)",
    },
    flashUnsupported: "굽기는 데스크톱 크롬이나 엣지에서 돼요.",
    openDecks: "덱 열기",
    deviceAddress: "Device address",
    bootSteps: ["BOOT 누른 채로", "RST 한 번", "BOOT 떼기"],
    install: { confirm: "This writes a fresh filesystem to the pattern partition. … On a new board there is nothing there to lose." },
    tourLabel: "콘솔 페이지",
    pages: [
      { id: "patterns", title: "Patterns", body: "이름을 누르면 재생돼요. 설치, 삭제, ZIP으로 받기, 순서 바꾸기까지." },
      { id: "wifi", title: "Wi-Fi", body: "네트워크 다섯 개까지, 그리고 어느 걸 먼저 시도할지." },
      { id: "knobs", title: "Knobs", body: "노브마다 도는 방향과 한 칸의 크기." },
      { id: "update", title: "Update", body: "와이파이로 받는 새 펌웨어. 패턴은 그대로예요." },
    ],
  },
};

export const COPY: Record<GuideLang, GuideCopy> = { en, ko };
