"use client";

// The Audio guide's real screens and photos, a set a step (copy.ts
// AudioShotSet; a step's copy names one as extra: "audioShots:<set>"): the
// extension's popup, the two microphone photos, the console's Audio and MIDI
// pages, rtpMIDI and Live. Nothing is redrawn. Every image in /guide/audio/
// is a capture of the real thing or a photo that already existed:
//
//   popup-*      the extension's popup against a real board, cropped to its
//                top (the corner badge, the address, the line under it)
//   audio-in-*   the console's /audio-in from the mock (console_serve.py,
//                /mock?audio=fresh|music|nomic), with the pages an Audio
//                board has, at a phone's width, 2x
//   midi-*       the console's /midi from the mock, its fixture set for the
//                shot: the board at the guide's address (deviceSim SIM_IP),
//                the computer at the page's own example, factory sensitivity
//   rtpmidi-*    docs/images/midi/rtpmidi-1..4, whole
//   live-remote  docs/images/midi/ableton-5-remote.png, cropped to the ports
//   mic-*        docs/images/audio-guide/pdm-mic-wiring.jpg (framed on the
//                breakout; and from the breakout's row of pads down to the
//                pins the leads land on, at the photo's own pixels) and the
//                journal's photo of the wired module seated in a board
//
// The crops are tight on purpose: the cards these stand in are full, and a
// crop keeps the capture's own words at a size that can be read. If a page
// changes, re-shoot it rather than editing the image: the sizes and rings
// below (GEO) are what the capture script prints.
//
// A set with more than one frame is stepped the way FlasherShots is: on its
// own only while its step is on stage (useGuideStore: page "audio", the
// set's scene, step `step`) and the frame is on screen, never under the
// pointer or keyboard focus, and not at all for reduced motion. The bold
// words of a caption are the screen's own, as it writes them (English in
// both languages); the sentence is this file's, in both.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { AudioShotSet } from "./copy";
import { useGuideStore, type GuideLang } from "./store";
import styles from "./AudioShots.module.css";

/** Where a ring sits: [left, top, width, height] as fractions of the image. */
type Ring = [number, number, number, number];

/** An image in /guide/audio/: its size in CSS px as captured, and the control it is about. */
type Geo = { w: number; h: number; rings: Ring[] };

// The capture script's own numbers; re-run it, don't edit by hand.
const GEO = {
  "popup-idle": { w: 460, h: 180, rings: [[0.0239, 0.5167, 0.9522, 0.2556]] },
  "popup-live": { w: 460, h: 180, rings: [[0.7761, 0.0611, 0.2, 0.2056]] },
  "popup-audoff": { w: 460, h: 220, rings: [[0.0239, 0.7364, 0.187, 0.1909]] },
  "popup-nosound": { w: 460, h: 180, rings: [[0.0239, 0.7611, 0.3283, 0.1389]] },
  "rtpmidi-1": { w: 612, h: 405, rings: [] },
  "rtpmidi-2": { w: 611, h: 403, rings: [] },
  "rtpmidi-3": { w: 611, h: 405, rings: [] },
  "rtpmidi-4": { w: 610, h: 403, rings: [] },
  "live-remote": { w: 491, h: 180, rings: [] },
  "mic-part": { w: 640, h: 480, rings: [] },
  "mic-wiring": { w: 1000, h: 805, rings: [] },
  "mic-seated": { w: 900, h: 1200, rings: [] },
  "audio-in-off": { w: 440, h: 289, rings: [[0.0273, 0.673, 0.3115, 0.1384]] },
  "audio-in-listening": {
    w: 440,
    h: 264,
    rings: [
      [0.3433, 0.7557, 0.1909, 0.1136],
      [0.5071, 0.4242, 0.4656, 0.0833],
    ],
  },
  "audio-in-nomic": { w: 440, h: 202, rings: [[0.3433, 0.5569, 0.2349, 0.1485]] },
  "audio-in-mapping": { w: 520, h: 282, rings: [] },
  "midi-knobs": { w: 520, h: 324, rings: [] },
  "midi-session": { w: 520, h: 297, rings: [[0.1504, 0.7555, 0.4094, 0.1347]] },
} satisfies Record<string, Geo>;

type Shot = {
  /** The frame's short name: its dot's label, and AUDIO_SHOT_FRAMES. */
  name: string;
  /** web/public/guide/audio/<file>.webp */
  file: keyof typeof GEO;
  /** The screen's own words, quoted exactly (English in both languages). A photo has none. */
  title?: string;
  en: string;
  ko: string;
  /** What the picture shows, for a reader who cannot see it. */
  alt: Record<GuideLang, string>;
  /** How long this frame stays up before the next one (ms). */
  ms?: number;
};

/**
 * How a set is drawn. "crop" is a piece of a page: it fills the frame from
 * the top, and the frame takes the page's own ground, so a shorter crop reads
 * as more of the same page. "window" is a whole window at the card's width,
 * a rim of dark desktop round it. "photo" fills its frame.
 */
type Look = "crop" | "window" | "photo";

type ShotSet = {
  /** The chapter the set's step is in (scenes/audio.ts). */
  scene: "browser" | "mic" | "midi";
  look: Look;
  /** A crop's ground: the colour of the page it was cut from. */
  ground?: string;
  /** What stands beside the picture instead of under it: the caption. */
  beside?: "caption";
  /** What stands between the picture and its caption: the lead table. */
  under?: "leads";
  /**
   * A photo that takes the card's whole width and hangs from its foot. On a
   * screen with no room for all of it the frame keeps this many of the
   * capture's rows, counted from the foot, and what goes is the top: `short`
   * on a wide screen under 900 px tall (and fewer still where `rest` leaves
   * fewer), `narrow` on a phone.
   */
  foot?: { short: number; narrow: number };
  /** More of the screen's height than its look allows (LOOKS), for a set whose card has the room. */
  vh?: number;
  /**
   * For a set whose card holds under the header while its block passes
   * (scenes/audio.ts dwell; Guide.module.css stops it 72 px down): what the
   * rest of a short wide screen comes to, in px. The header, the card's
   * words in English at their short-screen size, the set's own caption (and
   * table) and a margin. The frame may take what that leaves of the screen
   * where it is more than its look's share (a `foot` photo takes just that),
   * so the card's foot stays on screen and the picture is as large as that
   * allows. Measured, not derived: if the step's copy grows by a paragraph,
   * measure again.
   */
  rest?: number;
  /** What the set is, for a screen reader. */
  label: Record<GuideLang, string>;
  shots: Shot[];
};

// The console's and the popup's page colour; Live's settings pane.
const CREAM = "#f4efe6";
const LIVE_GREY = "#4f4f4f";

const SETS: Record<AudioShotSet, ShotSet> = {
  // browser · 2 — the extension's popup before and after Start
  popup: {
    scene: "browser",
    look: "crop",
    ground: CREAM,
    label: { en: "The extension's popup, before and after Start", ko: "확장 프로그램 팝업, Start 전과 후" },
    shots: [
      {
        name: "Idle",
        file: "popup-idle",
        title: "Idle",
        en: "Before Start. The address goes under Device.",
        ko: "Start 전이에요. 주소는 Device 아래에 넣어요.",
        alt: {
          en: "The top of the extension's popup: the corner badge reads Idle, and patternflow.local is in the Device field beside a Start button.",
          ko: "확장 프로그램 팝업의 윗부분. 구석 배지는 Idle, Device 칸엔 patternflow.local, 그 옆에 Start 버튼이 있다.",
        },
      },
      {
        name: "Live",
        file: "popup-live",
        title: "Live",
        en: "Start is now Stop; the line under it names the tab.",
        ko: "Start가 Stop이 되고, 그 아래 줄에 탭 이름이 나와요.",
        alt: {
          en: "The top of the extension's popup while capturing: the corner badge reads Live, the button reads Stop, and the line under the address begins with Capturing.",
          ko: "캡처 중인 확장 프로그램 팝업의 윗부분. 구석 배지는 Live, 버튼은 Stop, 주소 아래 줄은 Capturing으로 시작한다.",
        },
      },
    ],
  },
  // browser · 3 — why it is not Live
  popupStates: {
    scene: "browser",
    look: "crop",
    ground: CREAM,
    label: { en: "The extension's popup when the board is not moving", ko: "보드가 움직이지 않을 때의 확장 프로그램 팝업" },
    shots: [
      {
        name: "Aud off",
        file: "popup-audoff",
        title: "Aud off",
        en: "The board is ignoring the sound. Turn on brings it back.",
        ko: "보드가 소리를 무시하는 중이에요. Turn on으로 다시 켜요.",
        alt: {
          en: "The top of the extension's popup: the corner badge reads Aud off, the line under the address says Audio-React is off, and a Turn on button sits under it.",
          ko: "확장 프로그램 팝업의 윗부분. 구석 배지는 Aud off, 주소 아래 줄은 Audio-React가 꺼져 있다고 하고, 그 아래 Turn on 버튼이 있다.",
        },
      },
      {
        name: "No sound",
        file: "popup-nosound",
        title: "No sound from this tab yet.",
        en: "Still Live: the tab has been silent for two seconds.",
        ko: "여전히 Live예요. 탭이 2초 동안 조용했어요.",
        alt: {
          en: "The top of the extension's popup: the corner badge reads Live, and the line under the address reads No sound from this tab yet.",
          ko: "확장 프로그램 팝업의 윗부분. 구석 배지는 Live, 주소 아래 줄은 No sound from this tab yet.",
        },
      },
    ],
  },
  // mic · 1 — the breakout (the wiring photo, framed on the part)
  micPart: {
    scene: "mic",
    look: "photo",
    label: { en: "The microphone breakout", ko: "마이크 브레이크아웃" },
    shots: [
      {
        name: "The breakout",
        file: "mic-part",
        en: "The breakout's silkscreen: PDM Mic, and a pad each for 3V, GND, SEL, CLK and DAT.",
        ko: "브레이크아웃의 실크 인쇄예요. PDM Mic, 그리고 3V, GND, SEL, CLK, DAT 패드가 하나씩.",
        alt: {
          en: "A small blue breakout board marked PDM Mic, with five soldered pads labelled 3V, GND, SEL, CLK and DAT and a black lead on each.",
          ko: "PDM Mic이라고 적힌 작은 파란 브레이크아웃 보드. 3V, GND, SEL, CLK, DAT 패드 다섯 개에 검은 선이 하나씩 납땜돼 있다.",
        },
      },
    ],
  },
  // mic · 3 — the wiring photo at the card's width, the five-lead table under
  // it. This is the picture a reader solders by, so it is drawn as large as
  // the card allows and hangs from its foot, where the leads land: all of it
  // (the breakout's row of pads, the leads, the pins) where the screen has the
  // room; from under the breakout (the capture's last 655 rows) on a shorter
  // one; the pin rows alone (its last 400) on a phone.
  micWiring: {
    scene: "mic",
    look: "photo",
    under: "leads",
    foot: { short: 655, narrow: 360 },
    rest: 570,
    label: { en: "The five leads, from the microphone to the ESP32", ko: "마이크에서 ESP32로 가는 선 다섯 가닥" },
    shots: [
      {
        name: "Five leads, four places",
        file: "mic-wiring",
        en: "In the photo, 3V3 is the top pin on the left. GND, TX and RX are the top three on the right; GND holds two leads.",
        ko: "사진에서 3V3은 왼쪽 줄 맨 위 핀이에요. GND, TX, RX는 오른쪽 줄 위에서 셋이고, GND엔 선이 둘 붙어요.",
        alt: {
          en: "Five black leads run from the microphone breakout's pads down to the ESP32 module's header pins: one to 3V3 at the top of the left pin row, two to GND, and one each to TX and RX at the top of the right row.",
          ko: "마이크 브레이크아웃의 패드에서 ESP32 모듈의 헤더 핀으로 검은 선 다섯 가닥이 내려온다. 하나는 왼쪽 핀 줄 맨 위 3V3로, 둘은 GND로, TX와 RX로 하나씩 오른쪽 줄 위쪽에 닿는다.",
        },
      },
    ],
  },
  // mic · 4 — the wired module seated in a board
  micSeated: {
    scene: "mic",
    look: "photo",
    beside: "caption",
    label: { en: "The wired ESP32 back in the board", ko: "선을 단 ESP32를 보드에 다시 꽂은 모습" },
    shots: [
      {
        name: "Seated",
        file: "mic-seated",
        en: "The ESP32 back in its sockets, the microphone above it on its leads. The two USB-C ports at the bottom are the ESP32's own; UART is the right one.",
        ko: "ESP32를 소켓에 다시 꽂았어요. 마이크는 선에 달린 채 그 위에 있어요. 아래 USB-C 포트 둘은 ESP32의 것이고, 오른쪽이 UART예요.",
        alt: {
          en: "The back of a Patternflow board in its case: the ESP32 module seated in its sockets, the microphone breakout above it on five short leads, and the module's two USB-C ports at the bottom, both empty.",
          ko: "케이스 안 패턴플로우 보드의 뒷면. ESP32 모듈이 소켓에 꽂혀 있고, 그 위에 마이크 브레이크아웃이 짧은 선 다섯 가닥으로 달려 있다. 모듈 아래쪽 USB-C 포트 둘은 비어 있다.",
        },
      },
    ],
  },
  // mic · 5 — the console's Audio page: Microphone off, then listening
  audioIn: {
    scene: "mic",
    look: "crop",
    ground: CREAM,
    // The step's words are few and the crop is tall (the header's two rows of
    // pages are in it): on a short laptop screen it would be the smallest.
    vh: 36,
    label: { en: "The console's Audio page: the Microphone switch", ko: "콘솔 Audio 페이지의 Microphone 스위치" },
    shots: [
      {
        name: "Off",
        file: "audio-in-off",
        title: "Microphone",
        en: "Under Sources. Off, the chip beside it reads off.",
        ko: "Sources 아래에 있어요. 꺼져 있으면 옆의 칩이 off예요.",
        alt: {
          en: "The console's Audio page: under Sources the Microphone switch is off, the chip beside it reads off, and Input gain is at 8.0.",
          ko: "콘솔의 Audio 페이지. Sources 아래 Microphone 스위치가 꺼져 있고, 옆의 칩은 off, Input gain은 8.0이다.",
        },
      },
      {
        name: "Listening",
        file: "audio-in-listening",
        title: "listening",
        en: "On, and the top of the page says who has the knobs.",
        ko: "켜면, 페이지 위쪽 줄이 누가 노브를 쥐었는지 알려 줘요.",
        alt: {
          en: "The console's Audio page: the Microphone switch is on, the chip beside it reads listening, and the line at the top right reads the microphone has the knobs.",
          ko: "콘솔의 Audio 페이지. Microphone 스위치가 켜져 있고, 옆의 칩은 listening, 오른쪽 위 줄은 the microphone has the knobs.",
        },
      },
    ],
  },
  // mic · 6 — the Mapping half of the Audio page: its plot
  audioInMap: {
    scene: "mic",
    look: "crop",
    ground: CREAM,
    label: { en: "The console's Audio page: Mapping", ko: "콘솔 Audio 페이지의 Mapping" },
    shots: [
      {
        name: "Mapping",
        file: "audio-in-mapping",
        title: "Mapping",
        en: "K1 to K4, boxed on the spectrum the microphone hears.",
        ko: "마이크가 듣는 스펙트럼 위에 K1부터 K4까지 상자가 놓여 있어요.",
        alt: {
          en: "The Mapping plot on the console's Audio page: a spectrum from 31 Hz to 8 kHz, level in dB, with four boxes on it, K1 to K4 from left to right.",
          ko: "콘솔 Audio 페이지의 Mapping 그래프. 31 Hz부터 8 kHz까지, 세로는 dB인 스펙트럼 위에 왼쪽부터 K1–K4 상자 네 개가 있다.",
        },
      },
    ],
  },
  // mic · 7 — the chip reads "not detected"
  audioInNoMic: {
    scene: "mic",
    look: "crop",
    ground: CREAM,
    label: { en: "The console's Audio page with no microphone found", ko: "마이크를 찾지 못한 콘솔 Audio 페이지" },
    shots: [
      {
        name: "Not detected",
        file: "audio-in-nomic",
        title: "not detected",
        en: "Under the slider, the page's own reason: the data pin (RX) is idle, check the DAT lead.",
        ko: "슬라이더 아래에 페이지가 이유를 적어 줘요. 데이터 핀(RX)이 조용하니 DAT 선을 보라고요.",
        alt: {
          en: "The console's Audio page: the Microphone switch is on, the chip beside it reads not detected, and the line under the Input gain slider reads No microphone found: the data pin (RX) is idle. Check the DAT lead.",
          ko: "콘솔의 Audio 페이지. Microphone 스위치는 켜져 있지만 옆의 칩은 not detected이고, Input gain 슬라이더 아래 줄은 No microphone found: the data pin (RX) is idle. Check the DAT lead.",
        },
      },
    ],
  },
  // midi · 1 — rtpMIDI: new session, enable, connect, connected
  rtpmidi: {
    scene: "midi",
    look: "window",
    rest: 598,
    label: { en: "rtpMIDI, screen by screen", ko: "rtpMIDI 화면 순서" },
    shots: [
      {
        name: "New session",
        file: "rtpmidi-1",
        title: "My Sessions",
        en: "Press +. patternflow is already listed in Directory.",
        ko: "+를 누르세요. Directory엔 patternflow가 이미 있어요.",
        alt: {
          en: "The rtpMIDI window: My Sessions is empty with a + button under it, and Directory lists patternflow.",
          ko: "rtpMIDI 창. My Sessions는 비어 있고 아래에 + 버튼이 있다. Directory엔 patternflow가 있다.",
        },
      },
      {
        name: "Enabled",
        file: "rtpmidi-2",
        title: "Enabled",
        en: "Tick it on the new session; leave the port at 5004.",
        ko: "새 세션에서 체크하고, 포트는 5004 그대로 두세요.",
        alt: {
          en: "The rtpMIDI window: a session named after the computer is listed under My Sessions, the Enabled box is still empty, and the port reads 5004.",
          ko: "rtpMIDI 창. My Sessions에 컴퓨터 이름으로 된 세션이 있고, Enabled 칸은 아직 비어 있으며, 포트는 5004다.",
        },
      },
      {
        name: "Connect",
        file: "rtpmidi-3",
        title: "Connect",
        en: "Select patternflow in Directory and press Connect.",
        ko: "Directory에서 patternflow를 고르고 Connect.",
        alt: {
          en: "The rtpMIDI window: the session is enabled, patternflow is selected in Directory, and the Connect button under it is marked.",
          ko: "rtpMIDI 창. 세션이 Enabled 상태이고, Directory에서 patternflow가 선택돼 있으며, 그 아래 Connect 버튼에 표시가 있다.",
        },
      },
      {
        name: "Connected",
        file: "rtpmidi-4",
        title: "Participants",
        en: "Patternflow is listed. The window can be closed now.",
        ko: "Patternflow가 올라왔어요. 이제 창은 닫아도 돼요.",
        alt: {
          en: "The rtpMIDI window: Patternflow is listed under Participants with a latency of 0 ms.",
          ko: "rtpMIDI 창. Participants에 Patternflow가 지연 시간 0 ms로 올라와 있다.",
        },
        ms: 4200,
      },
    ],
  },
  // midi · 2 — Live's Link, Tempo & MIDI: Remote ticked on the session's input
  liveRemote: {
    scene: "midi",
    look: "crop",
    ground: LIVE_GREY,
    label: { en: "Ableton Live's MIDI ports", ko: "Ableton Live의 MIDI 포트" },
    shots: [
      {
        name: "Remote",
        file: "live-remote",
        title: "Input Ports · Remote",
        en: "Ticked on the row named after your computer, in Live's Link, Tempo & MIDI settings.",
        ko: "Live의 Link, Tempo & MIDI 설정에서, 내 컴퓨터 이름으로 된 줄에 체크돼 있어요.",
        alt: {
          en: "The MIDI ports in Live's Link, Tempo & MIDI settings: under Input Ports, the row named after the computer has its Remote box ticked; Track, Sync and MPE are empty.",
          ko: "Live의 Link, Tempo & MIDI 설정에 있는 MIDI 포트. Input Ports에서 컴퓨터 이름으로 된 줄의 Remote 칸이 체크돼 있고 Track, Sync, MPE는 비어 있다.",
        },
      },
    ],
  },
  // midi · 4 — the console's MIDI page: Knobs → MIDI (the value mode, Sensitivity)
  midiPage: {
    scene: "midi",
    look: "crop",
    ground: CREAM,
    label: { en: "The console's MIDI page: Knobs → MIDI", ko: "콘솔 MIDI 페이지의 Knobs → MIDI" },
    shots: [
      {
        name: "Knobs → MIDI",
        file: "midi-knobs",
        title: "Knobs → MIDI",
        en: "The value mode on top, Sensitivity under it.",
        ko: "위는 값을 보내는 방식, 아래는 Sensitivity예요.",
        alt: {
          en: "The Knobs → MIDI section of the console's MIDI page: Knob value is selected beside Relative steps, and under them Sensitivity has a slider each for K1 to K4, all at 1 : 1, with move all four together ticked.",
          ko: "콘솔 MIDI 페이지의 Knobs → MIDI 섹션. Relative steps 옆의 Knob value가 선택돼 있고, 아래 Sensitivity엔 K1–K4 슬라이더가 모두 1 : 1이며 move all four together가 체크돼 있다.",
        },
      },
    ],
  },
  // midi · 5 — the MIDI page's Session card: Use this computer
  midiSession: {
    scene: "midi",
    look: "crop",
    ground: CREAM,
    label: { en: "The console's MIDI page: Session", ko: "콘솔 MIDI 페이지의 Session" },
    shots: [
      {
        name: "Session",
        file: "midi-session",
        title: "Use this computer",
        en: "Pressed: this computer's address is in Computer to invite, and the page says saved — inviting.",
        ko: "누르면 이 컴퓨터의 주소가 Computer to invite에 들어가고 saved — inviting이 떠요.",
        alt: {
          en: "The Session section of the console's MIDI page: Connected to a computer, an address in the Computer to invite field, the buttons Save, Use this computer and Clear, and under them the words saved — inviting.",
          ko: "콘솔 MIDI 페이지의 Session 섹션. 컴퓨터에 연결돼 있고, Computer to invite 칸에 주소가 있으며, Save, Use this computer, Clear 버튼 아래에 saved — inviting이 떠 있다.",
        },
      },
    ],
  },
};

/** How many frames each set has, in the order shown. */
export const AUDIO_SHOT_FRAMES = Object.fromEntries(
  (Object.keys(SETS) as AudioShotSet[]).map((set) => [set, SETS[set].shots.map((s) => s.name)]),
) as Record<AudioShotSet, string[]>;

/**
 * mic · 3's table: each lead from the microphone's pad to its place on the
 * ESP32 module. Five leads, four places — GND and SEL share GND.
 */
export const MIC_LEADS: [string, string][] = [
  ["3V", "3V3"],
  ["GND", "GND"],
  ["SEL", "GND"],
  ["CLK", "TX"],
  ["DAT", "RX"],
];

const UI = {
  en: { step: "Screen", leads: "Each lead, from the microphone's pad to the pin on the ESP32", from: "Microphone", to: "ESP32" },
  ko: { step: "화면", leads: "마이크 패드에서 ESP32 핀까지, 선 하나씩", from: "마이크", to: "ESP32" },
} as const;

const BASE = "/guide/audio/";
const STEP_MS = 3600;
const LAST_HOLD_MS = 1200;

// Per look: the space around a shot inside the frame (the capture's CSS px),
// and how much of the screen's height the frame may take, wide and narrow —
// on a phone the card sits under the stage and has to leave it room. `short`
// is what a wide screen under 880 px tall leaves of `vh`.
//
// A window is a whole program's worth of small type, so it gets the card's
// width: 31vh is what lets rtpMIDI's 612 px reach it on a 900 px screen, and
// the thin rim (pad) is all the desktop it stands on. On a short screen its
// card is the page's fullest, and the frame stays as tall as it was at 27vh.
const LOOKS: Record<Look, { pad: number; vh: number; vhNarrow: number; short: number }> = {
  crop: { pad: 0, vh: 30, vhNarrow: 27, short: 0.86 },
  window: { pad: 3, vh: 31, vhNarrow: 27, short: 0.75 },
  photo: { pad: 0, vh: 32, vhNarrow: 30, short: 0.86 },
};

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const getReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// On the server nothing moves; the client decides after hydration.
const getReducedMotionServer = () => true;

/**
 * The lead table, lying under the photo: the microphone's pads across the
 * top, in the order they stand on the breakout, and under each the pin it
 * goes to. A place two leads share is one cell under both.
 */
function Leads({ lang }: { lang: GuideLang }) {
  const ui = UI[lang];
  return (
    <table className={styles.leads}>
      <caption className={styles.srOnly}>{ui.leads}</caption>
      <thead>
        <tr>
          <th scope="row">{ui.from}</th>
          {MIC_LEADS.map(([pad]) => (
            <th key={pad} scope="col">
              {pad}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">{ui.to}</th>
          {MIC_LEADS.map(([pad, pin], i) => {
            if (i > 0 && MIC_LEADS[i - 1][1] === pin) return null;
            let span = 1;
            while (MIC_LEADS[i + span]?.[1] === pin) span += 1;
            return (
              <td key={pad} colSpan={span > 1 ? span : undefined} data-shared={span > 1 ? "" : undefined}>
                {pin}
              </td>
            );
          })}
        </tr>
      </tbody>
    </table>
  );
}

export default function AudioShots({ set, lang, step }: { set: AudioShotSet; lang: GuideLang; step: number }) {
  const def = SETS[set];
  const { shots, scene } = def;
  const n = shots.length;
  const ui = UI[lang];
  const look = LOOKS[def.look];

  const rootRef = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reduced = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, getReducedMotionServer);

  // This step on stage. Leaving it puts the set back to its first frame, so
  // a reader who comes back sees it from the start.
  const onStage = useGuideStore((s) => s.page === "audio" && s.scene === scene && s.step === step);
  const [wasOnStage, setWasOnStage] = useState(onStage);
  if (wasOnStage !== onStage) {
    setWasOnStage(onStage);
    if (!onStage) setIndex(0);
  }

  const active = index % n;
  const running = n > 1 && onStage && visible && !hovered && !focused && !reduced;

  useEffect(() => {
    const el = rootRef.current;
    if (!el || n < 2) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.35), {
      threshold: [0, 0.35],
    });
    io.observe(el);
    return () => io.disconnect();
  }, [n]);

  // One timeout per frame, so a click restarts the clock on the new one.
  useEffect(() => {
    if (!running) return;
    const ms = (shots[active].ms ?? STEP_MS) + (active === n - 1 ? LAST_HOLD_MS : 0);
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % n), ms);
    return () => window.clearTimeout(t);
  }, [running, active, n, shots]);

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  }, []);

  // The frame is sized for the largest frame of the set, and every frame is
  // drawn at the same scale: a short crop stays short, as it is on the page.
  const unitW = Math.max(...shots.map((s) => GEO[s.file].w)) + look.pad * 2;
  const unitH = Math.max(...shots.map((s) => GEO[s.file].h)) + look.pad * 2;
  // A short wide screen: the look's share of its height, or what the rest of
  // a held card leaves of it (`rest`), whichever is more.
  const shortShare = `${((unitW / unitH) * (def.vh ?? look.vh) * look.short).toFixed(2)}vh`;
  const capShort = def.rest ? `max(${shortShare}, calc((100vh - ${def.rest}px) * ${(unitW / unitH).toFixed(4)}))` : shortShare;

  return (
    <figure
      ref={rootRef}
      className={styles.shots}
      aria-label={def.label[lang]}
      data-audio-shots={set}
      data-look={def.look}
      data-beside={def.beside}
      data-foot={def.foot ? "" : undefined}
      data-reduced={reduced ? "1" : "0"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <div
        className={styles.frame}
        // Its shape, and never taller than a share of the screen: the sheet
        // picks between these (AudioShots.module.css).
        style={
          {
            "--ar": `${unitW} / ${unitH}`,
            "--ar-short": def.foot && `${unitW} / ${def.foot.short}`,
            "--ar-narrow": def.foot && `${unitW} / ${def.foot.narrow}`,
            "--cap": `${((unitW / unitH) * (def.vh ?? look.vh)).toFixed(2)}vh`,
            "--cap-short": capShort,
            "--rest": def.rest && `${def.rest}px`,
            "--cap-narrow": `${((unitW / unitH) * look.vhNarrow).toFixed(2)}vh`,
            "--ground": def.ground,
          } as React.CSSProperties
        }
      >
        {shots.map((s, i) => {
          const geo: Geo = GEO[s.file];
          const on = i === active;
          return (
            <div
              key={s.file}
              className={styles.shot}
              data-on={on ? "1" : "0"}
              style={{ width: `${(geo.w / unitW) * 100}%`, aspectRatio: `${geo.w} / ${geo.h}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${BASE}${s.file}.webp`}
                width={geo.w}
                height={geo.h}
                alt={on ? s.alt[lang] : ""}
                aria-hidden={on ? undefined : true}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {/* The control this frame is about. Remounted per frame: it
                  arrives just after the frame does. */}
              {on &&
                geo.rings.map(([x, y, w, h], r) => (
                  <span
                    key={`${s.file}:${r}`}
                    className={styles.ring}
                    aria-hidden="true"
                    style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}
                  />
                ))}
            </div>
          );
        })}
      </div>

      {def.under === "leads" && <Leads lang={lang} />}

      <figcaption className={styles.caption}>
        {/* More than one frame: the dots, and beside them the words of the
            frame that is up. */}
        {n > 1 && (
          <div className={styles.bar}>
            <div className={styles.dots} role="group" aria-label={def.label[lang]}>
              {shots.map((s, i) => (
                <button
                  key={s.file}
                  type="button"
                  className={styles.dot}
                  data-on={i === active ? "1" : "0"}
                  data-done={i < active ? "1" : "0"}
                  aria-label={`${ui.step} ${i + 1}: ${s.name}`}
                  aria-current={i === active ? "step" : undefined}
                  onClick={() => setIndex(i)}
                >
                  <span>{i + 1}</span>
                </button>
              ))}
            </div>
            <div className={styles.heads}>
              {shots.map((s, i) => (
                <b key={s.file} className={styles.head} data-on={i === active ? "1" : "0"} aria-hidden={i === active ? undefined : true}>
                  {s.title}
                </b>
              ))}
            </div>
          </div>
        )}
        {/* Every caption in one grid cell: the block is as tall as the longest. */}
        <div className={styles.texts} aria-live={running ? "off" : "polite"}>
          {shots.map((s, i) => (
            <p key={s.file} className={styles.text} data-on={i === active ? "1" : "0"} aria-hidden={i === active ? undefined : true}>
              {n === 1 && s.title && <b>{s.title}</b>}
              <span>{s[lang]}</span>
            </p>
          ))}
        </div>
      </figcaption>
    </figure>
  );
}
