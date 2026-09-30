import type { GuideLang } from "./store";

// Every word the guide says, in both languages. Scenes and steps line up with
// SCENES in scenes.ts one-to-one: step N of a scene's copy is shown while
// step N of its script is on stage.

export type Extra =
  | "flashButton"
  | "bootSeq"
  | "wifiForm"
  | "deckFan"
  | "installFlow"
  | "laptop"
  | "phone"
  | "consolePages"
  | "pad";

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

export type GuideCopy = {
  meta: { title: string; description: string };
  brand: string;
  langSwitch: { label: string; href: string };
  opening: { kicker: string; title: string; lede: string; scroll: string; chapters: string[] };
  flash: SceneCopy;
  knobs: SceneCopy;
  patterns: SceneCopy;
  console: SceneCopy;
  next: {
    title: string;
    lede: string;
    soon: string[];
    links: { label: string; href: string }[];
  };
  ui: {
    noteBy: string;
    flashUnsupported: string;
    openDecks: string;
    pad: { title: string; hint: string; press: string; left: string; right: string };
    deviceAddress: string;
    bootSteps: [string, string, string];
    wifi: { title: string; ssid: string; password: string; connect: string };
    install: { formatting: string; format: string; installing: string; done: string };
    pages: { title: string; body: string; img: string }[];
  };
};

const en: GuideCopy = {
  meta: {
    title: "How to play Patternflow",
    description:
      "From a bare ESP32 to patterns on your panel: flashing, the four knobs, installing patterns and the device's own console — shown on a Patternflow you can turn.",
  },
  brand: "Patternflow",
  langSwitch: { label: "한국어", href: "/guide/ko" },
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
          "Patternflow's brain is an ESP32-S3 module, seated in sockets on the board inside. Open the back and lift it out — gently, straight up.",
        ],
        note: "Built it yourself and haven't seated it yet? Even better. Skip ahead.",
      },
      {
        kicker: "Hold it like this",
        title: "Antenna up, ports toward you.",
        body: [
          "The square antenna at the top, the two USB-C ports at the bottom. Which way you hold it matters for the next step.",
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
          "In desktop Chrome or Edge, press the button, pick the port, and install. A new install wipes the board first — that's expected, and it takes about two minutes.",
        ],
        extra: "flashButton",
      },
      {
        kicker: "No port in the list?",
        title: "Hold BOOT, tap RST, let go.",
        body: [
          "Put it in download mode by hand, then look again. The port appears as USB JTAG/serial debug unit.",
        ],
        warn: "In download mode the flasher can't tell it's already Patternflow, so it treats it as new and erases it — installed patterns and saved Wi-Fi too.",
        extra: "bootSeq",
      },
      {
        kicker: "Wi-Fi",
        title: "Type your network.",
        body: [
          "When the install finishes, press Next. There's no list to pick from: type the name exactly — capitals count — and choose a 2.4 GHz network. The ESP32 can't see 5 GHz.",
          "Visit Device opens the board's own page. More on that in chapter four.",
        ],
        extra: "wifiForm",
      },
      {
        kicker: "No Wi-Fi step?",
        title: "Press RST once. Connect again.",
        body: [
          "Some boards don't restart on their own after flashing, and the flasher just stops. Press RST, press Flash Patternflow again, pick the port, and choose Connect to Wi-Fi.",
        ],
        note: "Your board remembers up to five networks. You can add more later, from its page.",
      },
      {
        kicker: "Power",
        title: "Back in. Power on.",
        body: [
          "Seat the ESP32 back in its sockets the way the silkscreen shows, close the back, and plug Patternflow's power cable into a power bank.",
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
        ],
      },
      {
        kicker: "Press",
        title: "So does a short press.",
        body: ["A click goes to the pattern too. On Origin it sends that knob back to where it started."],
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
      {
        kicker: "Your turn",
        title: "Play it.",
        body: ["Drag a knob to turn it. Click to press. Hold for a second to open its screen. Or use the pad."],
        extra: "pad",
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
        kicker: "Decks",
        title: "Patterns come in decks.",
        body: [
          "In the community, patterns are collected into decks, like a hand of cards. Basics is the one that ships with Patternflow: 33 patterns.",
          "Anyone can make a deck and share it.",
        ],
        extra: "deckFan",
      },
      {
        kicker: "Install",
        title: "Install to my board.",
        body: [
          "On the Basics card, press Install to my board. Your browser opens the board's own page and hands it the whole pack over your Wi-Fi — the board never goes on the internet itself.",
          "The first time, it asks to format its storage. Press Format storage, confirm, and the pack installs by itself. About ten seconds.",
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
      {
        kicker: "Your turn",
        title: "Browse them.",
        body: ["Hold K4, turn, and stop on one you like. Then hold K4 again."],
        extra: "pad",
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
          "On a computer on the same Wi-Fi, go to patternflow.local. What's playing, the four knobs, brightness, sleep — and a page for everything else.",
        ],
        extra: "laptop",
      },
      {
        kicker: "On a phone",
        title: "Use the address on K2.",
        body: [
          "Phones — Android especially — often can't find patternflow.local. Hold K2 and type the IP address it shows. On Windows, http://patternflow/ works too.",
        ],
        extra: "phone",
      },
      {
        kicker: "Inside",
        title: "What's in it.",
        body: [
          "Patterns to install, delete or download. Up to five Wi-Fi networks, tried newest first. Which way each knob counts. And new firmware, over Wi-Fi, with your patterns kept.",
        ],
        extra: "consolePages",
      },
    ],
  },
  next: {
    title: "Next: make your own.",
    lede: "The rest of the guide is on its way. Until then, these are where it goes.",
    soon: ["Pattern Lab", "Layers & Graphic Export", "Director", "Community", "Editions", "Sound", "MIDI & OSC", "MQTT", "Clock", "Performance"],
    links: [
      { label: "Pattern Lab", href: "/pattern-lab" },
      { label: "Community", href: "https://community.patternflow.work/community" },
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
  },
  ui: {
    noteBy: "From the maker",
    flashUnsupported: "Flashing works in desktop Chrome or Edge.",
    openDecks: "Open the decks",
    pad: {
      title: "The knobs",
      hint: "‹ › turn · ● press · hold ● for a second",
      press: "Press",
      left: "Turn left",
      right: "Turn right",
    },
    deviceAddress: "Device address",
    bootSteps: ["Hold BOOT", "Tap RST", "Release BOOT"],
    wifi: { title: "Connect to Wi-Fi", ssid: "Network name", password: "Password", connect: "Connect" },
    install: {
      formatting: "Storage needs formatting",
      format: "Format storage",
      installing: "Installing",
      done: "33 patterns installed",
    },
    pages: [
      { title: "Console", body: "What's playing, knobs, brightness, sleep.", img: "/guide/console/home-desktop.webp" },
      { title: "Patterns", body: "Install, delete, download.", img: "/guide/console/patterns.webp" },
      { title: "Wi-Fi", body: "Up to five networks.", img: "/guide/console/wifi.webp" },
      { title: "Knobs", body: "Direction and click size.", img: "/guide/console/knobs.webp" },
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
  langSwitch: { label: "English", href: "/guide" },
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
          "패턴플로우의 두뇌는 ESP32-S3 모듈이에요. 안쪽 기판의 소켓에 꽂혀 있어요. 뒷면을 열고 살살, 곧게 들어 올려 빼 주세요.",
        ],
        note: "직접 만들고 있는데 아직 안 꽂았다면? 오히려 좋다. 바로 다음으로.",
      },
      {
        kicker: "이렇게 들어요",
        title: "안테나는 위로, 포트는 내 쪽으로.",
        body: ["네모난 안테나가 위, USB-C 포트 두 개가 아래로 오게요. 다음 단계에서 방향이 중요해요."],
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
        title: "Flash Patternflow.",
        body: [
          "데스크톱 크롬이나 엣지에서 버튼을 누르고, 포트를 고르고, 설치해요. 새로 설치하면 보드를 먼저 싹 지우는데 정상이에요. 2분쯤 걸려요.",
        ],
        extra: "flashButton",
      },
      {
        kicker: "목록에 포트가 없다면",
        title: "BOOT 누른 채로, RST 한 번, BOOT 떼기.",
        body: ["직접 다운로드 모드로 넣고 다시 봐요. USB JTAG/serial debug unit이라는 이름으로 나타나요."],
        warn: "다운로드 모드에선 플래셔가 이미 패턴플로우인지 몰라서 새 보드로 보고 지워요. 설치한 패턴과 저장된 와이파이까지요.",
        extra: "bootSeq",
      },
      {
        kicker: "와이파이",
        title: "네트워크 이름을 입력해요.",
        body: [
          "설치가 끝나면 Next. 고를 목록은 없어서 이름을 정확히 쳐야 해요. 대소문자도 구분해요. 그리고 2.4 GHz 네트워크로요. ESP32는 5 GHz를 못 봐요.",
          "Visit Device를 누르면 보드의 웹페이지가 열려요. 4장에서 자세히.",
        ],
        extra: "wifiForm",
      },
      {
        kicker: "와이파이 단계가 안 나오면",
        title: "RST 한 번. 다시 연결.",
        body: [
          "어떤 보드는 굽고 나서 스스로 다시 켜지지 않아서 플래셔가 그냥 끝나요. RST를 한 번 누르고, Flash Patternflow를 다시 눌러 포트를 고른 다음 Connect to Wi-Fi를 골라요.",
        ],
        note: "와이파이는 다섯 개까지 기억한다. 나중에 보드 페이지에서 더 넣으면 된다.",
      },
      {
        kicker: "전원",
        title: "다시 꽂고, 전원.",
        body: [
          "ESP32를 실크 인쇄 방향대로 소켓에 다시 꽂고, 뒷면을 닫고, 패턴플로우 전원 케이블을 보조배터리에 연결해요.",
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
        ],
      },
      {
        kicker: "누르기",
        title: "짧게 누르는 것도요.",
        body: ["클릭도 패턴에게 가요. Origin에선 그 노브 값을 처음으로 돌려놔요."],
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
        body: ["K3는 노브마다 번호를 패널에 띄우고, 지금 돌리는 노브에 주황 링을 켜요."],
      },
      {
        kicker: "K4 꾹",
        title: "패턴.",
        body: [
          "K4는 패턴 목록을 열어요. K4를 돌려 이동하고(패턴 하나에 세 칸), 멈추면 그 패턴이 켜져요. K4를 다시 꾹 누르면 닫혀요.",
          "지금은 1 / 1이에요. 그게 다음 이야기예요.",
        ],
      },
      {
        kicker: "직접",
        title: "연주해 보세요.",
        body: ["노브를 드래그하면 돌아가요. 클릭은 누르기, 1초 누르면 그 노브의 화면이 열려요. 아래 패드로도 돼요."],
        extra: "pad",
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
        kicker: "덱",
        title: "패턴은 덱으로 와요.",
        body: [
          "커뮤니티에선 패턴을 카드 게임처럼 덱으로 묶어요. Basics는 패턴플로우와 함께 오는 덱이에요. 패턴 33개.",
          "누구나 자기 덱을 만들어 공유할 수 있어요.",
        ],
        extra: "deckFan",
      },
      {
        kicker: "설치",
        title: "Install to my board.",
        body: [
          "Basics 카드에서 Install to my board를 눌러요. 브라우저가 보드의 페이지를 열고 팩 전체를 와이파이로 넘겨줘요. 보드는 인터넷에 직접 나가지 않아요.",
          "처음엔 저장공간을 포맷하라고 해요. Format storage를 누르고 확인하면 팩이 알아서 설치돼요. 10초쯤.",
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
      {
        kicker: "직접",
        title: "넘겨 보세요.",
        body: ["K4를 꾹, 돌리다가 마음에 드는 데서 멈춰요. 그리고 K4를 다시 꾹."],
        extra: "pad",
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
        body: ["같은 와이파이의 컴퓨터에서 patternflow.local로 가요. 지금 재생 중인 패턴, 노브 네 개, 밝기, 잠자기, 그리고 나머지 모든 것의 페이지."],
        extra: "laptop",
      },
      {
        kicker: "폰에서",
        title: "K2의 주소를 써요.",
        body: ["폰, 특히 안드로이드는 patternflow.local을 못 찾을 때가 많아요. K2를 꾹 눌러 나온 IP 주소를 치면 돼요. 윈도우에선 http://patternflow/ 도 돼요."],
        extra: "phone",
      },
      {
        kicker: "안에는",
        title: "이런 게 있어요.",
        body: ["패턴 설치·삭제·다운로드. 와이파이는 다섯 개까지, 최근 것부터 시도. 노브마다 도는 방향. 그리고 와이파이로 받는 새 펌웨어. 패턴은 그대로 남아요."],
        extra: "consolePages",
      },
    ],
  },
  next: {
    title: "다음: 내 패턴 만들기.",
    lede: "나머지 장은 만드는 중이에요. 그동안은 여기서 시작하면 돼요.",
    soon: ["패턴 랩", "레이어 · 그래픽 익스포트", "디렉터", "커뮤니티", "에디션", "소리", "MIDI · OSC", "MQTT", "시계", "퍼포먼스"],
    links: [
      { label: "Pattern Lab", href: "/pattern-lab" },
      { label: "Community", href: "https://community.patternflow.work/community" },
      { label: "Editions", href: "/editions" },
      { label: "Features", href: "/features" },
    ],
  },
  ui: {
    noteBy: "만든 사람의 한마디",
    flashUnsupported: "굽기는 데스크톱 크롬이나 엣지에서 돼요.",
    openDecks: "덱 열기",
    pad: { title: "노브", hint: "‹ › 돌리기 · ● 누르기 · ● 1초 꾹", press: "누르기", left: "왼쪽으로", right: "오른쪽으로" },
    deviceAddress: "Device address",
    bootSteps: ["BOOT 누른 채로", "RST 한 번", "BOOT 떼기"],
    wifi: { title: "Connect to Wi-Fi", ssid: "Network name", password: "Password", connect: "Connect" },
    install: {
      formatting: "Storage needs formatting",
      format: "Format storage",
      installing: "Installing",
      done: "33 patterns installed",
    },
    pages: [
      { title: "Console", body: "재생 중, 노브, 밝기, 잠자기.", img: "/guide/console/home-desktop.webp" },
      { title: "Patterns", body: "설치, 삭제, 다운로드.", img: "/guide/console/patterns.webp" },
      { title: "Wi-Fi", body: "네트워크 다섯 개까지.", img: "/guide/console/wifi.webp" },
      { title: "Knobs", body: "방향과 클릭 크기.", img: "/guide/console/knobs.webp" },
    ],
  },
};

export const COPY: Record<GuideLang, GuideCopy> = { en, ko };
