import type { ClosingCopy, OpeningCopy, SceneCopy } from "../copy";
import type { GuideLang } from "../store";

// The Audio guide's words (/guide/audio), in both languages. One thing first
// — the Audio edition on the board — then three sections in no order: sound
// from a browser tab, the on-board microphone, MIDI and a DAW. The sections
// carry no number (SceneCopy.num is absent) and each opens cold: its `needs`
// is the one line that sends a reader who landed there to `#edition`, and no
// sentence in a section leans on another section having been read (the
// microphone's mapping says what a box is; it is never "the same" editor).
//
// Scenes and steps line up with AUDIO_SCENES (scenes/audio.ts) one-to-one;
// the keys, the step counts, the extras and `needs.href` are the build
// contract's (_temp/guide-audio/contract.md) and pages.test.ts holds them.
// The small print every guide shares is copy.ts's `ui`. The words of the
// captures are AudioShots.tsx's, the editor window's are EditorWindow.tsx's.
//
// Sources for every fact, and nothing else: AUDIO_GUIDE.md, docs/midi-ableton.md,
// docs/midi-spec.md, docs/audio-ws-spec.md, tools/patternflow-audio-extension
// (its README, popup and editor), the console pages
// (firmware/patternflow/console/_audio_in_bar.html, _audio_in_adapter.js,
// midi.html, update.html), web/src/app/editions and the firmware
// (patternflow.ino's NETWORK screen, features/midi). UI words are quoted as
// the UI says them, in English in both languages: the extension, the console,
// rtpMIDI, Live and GitHub have no Korean. The browser and macOS do, so the
// Korean copy names their controls as a Korean screen shows them, with the
// English beside the first of each. Chrome and Edge were read from the
// installed browsers run with --lang=ko (개발자 모드 in both; Load unpacked is
// 압축해제된 확장 프로그램 로드 in Chrome and 압축 풀린 파일 로드 in Edge;
// Reload is 새로고침 and 다시 로드). Audio MIDI Setup's are Apple's own, from
// its Korean user guide (오디오 MIDI 설정; 윈도우 > MIDI 스튜디오 보기).
//
// Not in any source, and so not here: how long the install takes, a "power
// off" before the ESP32 comes out, a cause for the microphone's
// `not answering`, and any figure for how many turns a Sensitivity setting
// takes. MIDI's channel is 1 and is fixed in the firmware (PF_MIDI_CHANNEL);
// it is said as the setting a reader enters in the DAW.
//
// The microphone is FIVE leads on FOUR places: 3V → 3V3, GND → GND,
// SEL → GND (the same GND), CLK → TX, DAT → RX. Both photos show exactly that.
//
// The device is "the board" or "your Patternflow"; "panel" is the LED face,
// and otherwise only inside a quoted label ("Install to my panel", "MIDI on
// this panel"). The ESP32's own carrier is "the circuit board it sits in",
// never "the board". The word beside the Microphone switch is "the chip", as
// the console and AudioShots.tsx's captions call it, and a card's body says
// "the chip beside the switch" the first time: on a card about soldering to
// an ESP32 a bare "chip" would be something else.
//
// A card with captures says what to do; what each screen shows is the
// capture's own caption (AudioShots.tsx), not said twice.
//
// Numbers a reader has to read (addresses, pins, CC and note numbers, the
// port) are in a body, never in a kicker.
//
// `note` is "From the maker" on the card, so it holds only what the maker
// wrote himself: the three here restate web/content/journal/
// how-to-use-part-two.mdx and maybe-this-will-work.mdx (as copy/lab.ts's
// notes do). Anything else a card has to say is body or `warn`.

export type AudioCopy = {
  meta: { title: string; description: string };
  /** The guide's name: in the hub, and where a "Stuck here?" issue says the reader was. */
  name: string;
  opening: OpeningCopy;
  /** The one thing first: getting the Audio edition onto the board. */
  edition: SceneCopy;
  /** Sound from a browser tab: the extension and its box editor. */
  browser: SceneCopy;
  /** The on-board PDM microphone. */
  mic: SceneCopy;
  /** MIDI and a DAW, over the network. */
  midi: SceneCopy;
  next: ClosingCopy;
  ui: {
    /** Edition step 2's card: the way to the edition shelf (Extras.tsx "editionsLink"). */
    editions: { label: string; href: string };
  };
};

const GH = "https://github.com/engmung/Patternflow/blob/main/";

const en: AudioCopy = {
  meta: {
    title: "Sound and MIDI on Patternflow",
    description:
      "The Audio guide of Patternflow: put the Audio edition on your board, then let a browser tab or the on-board microphone turn the knobs, or use the board as a MIDI device with your DAW.",
  },
  name: "Audio",
  opening: {
    kicker: "The guide · Audio",
    title: "Give it sound and MIDI.",
    lede: "The Audio edition is the same Patternflow with more ways in and out: sound from a browser tab, a microphone on the board, and MIDI between the board and your DAW. Put the edition on once, then take whichever you came for.",
    scroll: "Scroll",
    chapters: ["The Audio edition", "A browser tab", "The microphone", "MIDI & your DAW"],
    groups: { first: "First", rest: "Then, any of these" },
    back: { label: "All guides", to: "hub" },
  },
  edition: {
    title: "The Audio edition",
    lede: "Once. The same board, with firmware that takes sound in and speaks MIDI.",
    steps: [
      {
        kicker: "An edition",
        title: "The same board, more firmware.",
        body: [
          "An edition is Patternflow's firmware with features added. Audio adds sound from a browser tab, a microphone on the board, MIDI and OSC. The microphone is optional: it stays off until you fit one and switch it on.",
          "Your patterns, Wi-Fi networks and settings stay: an update rewrites the program only. Going back to the default firmware is the same click.",
        ],
      },
      {
        kicker: "Install",
        title: "Install to my panel.",
        body: [
          "At patternflow.work/editions (the button below opens it), find Patternflow Audio and press Install to my panel. Your browser opens the board's own Update page with the build already linked.",
          "Press Fetch & flash there. Keep the board powered: it restarts by itself on the new build.",
          "The board has to be running, on the same Wi-Fi as this computer. A new ESP32 gets that far in the Play guide's 01 Flash, over USB.",
        ],
        warn: "Android can't open patternflow.local. Hold K2, read the IP address, and type it under Details → your panel on the card first.",
        extra: "editionsLink",
      },
      {
        kicker: "Check",
        title: "Hold K2. Two new rows.",
        body: [
          "The NETWORK screen now has two rows under its title, above the Wi-Fi line and the address: OSC and AUD.",
          "AUD is the switch for sound from the browser extension. Turn K3 right for on, left for off; K2 does the same for OSC. Both start on.",
          "In the console, the header has two new pages, Audio and MIDI. MIDI has no row on this screen: its switch is on the MIDI page.",
        ],
      },
    ],
  },
  browser: {
    title: "A browser tab",
    lede: "Whatever a tab is playing turns the four knobs.",
    needs: { label: "Needs the Audio edition on the board", href: "#edition" },
    steps: [
      {
        kicker: "The extension",
        title: "Load it from the repository.",
        body: [
          "The extension isn't on the Chrome Web Store. On github.com/engmung/Patternflow, press Code → Download ZIP and unzip it.",
          "In Chrome open chrome://extensions, in Edge edge://extensions. Switch on Developer mode, press Load unpacked and pick the folder tools/patternflow-audio-extension.",
          "Got a newer copy later? Put it in the same folder, then press Reload on the extension's card on that page. Your mapping is kept.",
        ],
      },
      {
        kicker: "Start",
        title: "Open the tab, press Start.",
        body: [
          "Go to the tab that's playing and click the Patternflow Audio button in the toolbar there. Under Device, type your board's address (patternflow.local, or the IP address from hold K2) and press Start.",
          "The corner of the popup says Live and the pattern starts moving. The knobs themselves stay still: sound moves their values, not the knobs. Stop, on the same button, gives the knobs back.",
        ],
        note: "Play YouTube or Spotify in Chrome, set it up a little, and you've got a pretty fun sound-synced picture. Much simpler than setting up tracks and MIDI in Ableton.",
        extra: "audioShots:popup",
      },
      {
        kicker: "Not Live?",
        title: "The popup tells you why.",
        body: [
          "Aud off: the board is connected but ignoring what arrives. Press Turn on. It's the same switch as the AUD row on hold K2.",
          "Live, but nothing moves: two seconds without sound, and the line under the address reads No sound from this tab yet. Check that it's the tab that's playing.",
          "Error: the line under the address says what's wrong. Nothing at that address, or a board without the Audio edition.",
        ],
        extra: "audioShots:popupStates",
      },
      {
        kicker: "The editor",
        title: "Each knob is a box on the spectrum.",
        body: [
          "Press Mapping editor in the popup. K1 to K4 are four boxes on the live spectrum: a box's width is the frequencies that knob listens to, its height the quiet-to-loud window. The mapping is saved in your browser, not on the board.",
          "Below is the real editor, driving the board on this page. Open it and drag K1's box sideways: K1 now follows another part of the spectrum. Mute, at the foot of K1's card, gives that knob back while it's on.",
          "Now take a knob on the board here, by the orange dot on its ring. It's yours while you hold it, and for about five seconds after you let go. Your board does the same.",
        ],
        extra: "editorLive",
      },
    ],
  },
  mic: {
    title: "The microphone",
    lede: "A small part and five leads, and the board hears the room with nothing else running.",
    needs: { label: "Needs the Audio edition on the board", href: "#edition" },
    steps: [
      {
        kicker: "The part",
        title: "A PDM microphone, and only PDM.",
        body: [
          "Adafruit's PDM MEMS Microphone Breakout (product 3492), or a clone whose pin row reads 3V, GND, SEL, CLK, DAT. Plus five thin leads of about 10 cm; shorter is better.",
        ],
        warn: "Not an INMP441 or any other I²S microphone, and not an analog electret module. The board has two free pins, and only PDM fits in two.",
        extra: "audioShots:micPart",
      },
      {
        kicker: "The ESP32",
        title: "Lift it out.",
        body: [
          "Slide the back cover off and lift the ESP32 straight up out of its sockets. Every joint goes on the ESP32 itself; the circuit board it sits in is never touched.",
          "It's fully reversible: to undo it, take the leads off.",
        ],
      },
      {
        kicker: "Five leads, four places",
        title: "Solder on the top side.",
        body: [
          "Solder where the header pins come through the top of the ESP32. 3V goes to 3V3. GND and SEL both go to GND. CLK goes to TX. DAT goes to RX.",
          "The silkscreen says TX and RX: they're the only two free pins on the board. 3V3 and GND appear more than once on the headers; use whichever is closest.",
        ],
        warn: "Don't skip SEL to GND. Without it the microphone reads silence and looks perfectly healthy.",
        extra: "audioShots:micWiring",
      },
      {
        kicker: "Back in",
        title: "Seat it. Leave the right port empty.",
        body: [
          "Route the leads out the top and seat the ESP32 the way the silkscreen shows. Put the microphone wherever sound reaches it, and power the board from its power cable, as always.",
        ],
        warn: "While the microphone is wired, plug nothing into the right USB port, the one labelled UART. It shares TX and RX.",
        extra: "audioShots:micSeated",
      },
      {
        kicker: "Switch it on",
        title: "Console, Audio, Microphone.",
        body: [
          "Open the console (patternflow.local in a browser on the same Wi-Fi, or the IP address from hold K2) and go to Audio. Under Sources, switch Microphone on.",
          "The chip beside the switch turns to listening. Room quiet? Raise Input gain. It starts at 8.",
        ],
        extra: "audioShots:audioIn",
      },
      {
        kicker: "The mapping",
        title: "Four boxes, saved on the board.",
        body: [
          "On the console's Audio page, under Mapping, each knob from K1 to K4 is a box on the live spectrum. A box's width is the frequencies that knob listens to; its height is the quiet-to-loud window. Drag K1's box over the bass and K1 follows the bass.",
          "Changes save to the board as you make them, and survive restarts and firmware updates.",
        ],
        note: "It's less precise than analysing the audio itself: the sound comes in a bit lumped together. But it works, and reacting to nothing more than loudness is already fun.",
        extra: "audioShots:audioInMap",
      },
      {
        kicker: "Quiet?",
        title: "What the chip says.",
        body: [
          "not detected, on the chip beside the Microphone switch: nothing on the data pin. Check the DAT lead to RX.",
          "not answering: the microphone was there and has stopped sending. The knobs are left alone.",
          "listening, but the knobs stay still however loud it gets: SEL isn't on GND. The board can't tell that from a quiet room.",
          "Only the highest box barely moves, at normal volume: not a fault. At room volume the highest octaves carry almost no energy.",
        ],
        extra: "audioShots:audioInNoMic",
      },
    ],
  },
  midi: {
    title: "MIDI & your DAW",
    lede: "The board is a MIDI device on your Wi-Fi. Its four knobs and four buttons play your DAW, and your DAW can play the board.",
    needs: { label: "Needs the Audio edition on the board", href: "#edition" },
    steps: [
      {
        kicker: "Connect",
        title: "Make a network MIDI session.",
        body: [
          "The computer has to be on the same Wi-Fi as the board. Windows has no network MIDI of its own, so install rtpMIDI (free, by Tobias Erichsen) and open it.",
          "Press + under My Sessions and tick Enabled. Select patternflow in Directory and press Connect: it moves to Participants.",
          "On a Mac there's nothing to install. The same steps are in Audio MIDI Setup → Window → Show MIDI Studio → Network.",
        ],
        warn: "Not in Directory? Give it a few seconds, then add it with the Directory's +: the board's IP address (hold K2) and port 5004.",
        extra: "audioShots:rtpmidi",
      },
      {
        kicker: "Ableton Live",
        title: "Tick Remote, then map.",
        body: [
          "In Live, open Settings → Link, Tempo & MIDI. Under Input Ports, tick Remote on the row named after your computer: that's the session.",
          "Press Ctrl-M (Cmd-M on a Mac), click any knob or slider in Live, turn a knob on the board, press Ctrl-M again. That knob now moves it, both ways, and stops at the ends.",
          "Takeover Mode, on the same Settings page, decides how a control picks up after a knob has hit an end. Value Scaling is the smooth one.",
        ],
        warn: "Connected in rtpMIDI, but nothing moves in Live? Remote isn't ticked.",
        extra: "audioShots:liveRemote",
      },
      {
        kicker: "The map",
        title: "Channel 1, and the numbers each way.",
        body: [
          "Everything is on channel 1. It's fixed in the firmware, so that's the channel to set in your DAW.",
          "Out of the board: K1 to K4 send CC 24 to 27 as a hand turns them. Their buttons send notes 60 to 63. A change of pattern sends a Program Change.",
          "Into the board: CC 20 to 23 set knobs 1 to 4, each until a hand turns that knob. Notes 60 to 63 press the buttons. A Program Change picks a pattern.",
          "In Live: to get the buttons' notes on a track, tick Track on the session's row under Input Ports. To send to the board, tick Track on its row under Output Ports and set a MIDI track's MIDI To to the session.",
        ],
        note: "I was sure OSC was enough, and added MIDI late and a little reluctantly. It turned out far easier to use: it's all built in, with no patch to make. I don't use OSC myself any more.",
      },
      {
        kicker: "Settings",
        title: "The console's MIDI page.",
        body: [
          "Open the console (patternflow.local, or the IP address from hold K2) and go to MIDI. Sensitivity sets how far a turn goes, from ×8 to 1/16. The four sliders move together; untick “move all four together” to set one knob alone.",
          "Knob value sends a position from 0 to 127 and is the one to use with Live. Relative steps is for software that maps endless encoders itself, like Max or TouchDesigner.",
          "Under Switch, MIDI on this panel turns MIDI off without reflashing.",
        ],
        extra: "audioShots:midiPage",
      },
      {
        kicker: "Stay connected",
        title: "Use this computer.",
        body: [
          "On the console's MIDI page, under Session, press Use this computer. The board remembers this computer's address and opens the session itself, on every start and whenever it drops. rtpMIDI never needs opening again.",
          "It waits 20 seconds before it calls, so a fresh start takes a moment. In rtpMIDI, leave Who may connect to me at Anyone: that's what lets the board call your computer.",
        ],
        extra: "audioShots:midiSession",
      },
    ],
  },
  next: {
    title: "That's the edition.",
    lede: "With more than one source live, a hand on a knob beats everything. MIDI from your DAW holds a knob until a hand turns it. The extension beats the microphone, and the microphone takes whatever is left.",
    groups: [],
    until: "More in this edition, and the full references:",
    links: [
      { label: "OSC", href: `${GH}docs/osc-spec.md` },
      { label: "The phone app", href: `${GH}tools/patternflow-audio-android/README.md` },
      { label: "A Director show as .mid", href: `${GH}docs/director-midi.md` },
      { label: "The MIDI map", href: `${GH}docs/midi-spec.md` },
      { label: "AUDIO_GUIDE.md", href: `${GH}AUDIO_GUIDE.md` },
      { label: "Editions", href: "/editions" },
      { label: "All guides", href: "/guide" },
    ],
    report: { title: "stuck", where: "The Audio guide, somewhere not listed" },
  },
  ui: {
    editions: { label: "Open patternflow.work/editions", href: "/editions" },
  },
};

const ko: AudioCopy = {
  meta: {
    title: "패턴플로우에 소리와 MIDI 잇기",
    description:
      "패턴플로우 오디오 가이드. 보드에 오디오 에디션을 올리고, 브라우저 탭이나 보드에 단 마이크의 소리로 노브를 움직이거나, 보드를 MIDI 장치로 DAW에 이어요.",
  },
  name: "오디오",
  opening: {
    kicker: "가이드 · 오디오",
    title: "소리와 MIDI를 이어요.",
    lede: "오디오 에디션은 같은 패턴플로우에 드나드는 길이 늘어난 거예요. 브라우저 탭의 소리, 보드에 다는 마이크, 그리고 보드와 DAW가 주고받는 MIDI. 에디션은 한 번만 올리면 되고, 그다음은 필요한 것부터 봐요.",
    scroll: "스크롤",
    chapters: ["오디오 에디션", "브라우저 탭", "마이크", "MIDI와 DAW"],
    groups: { first: "먼저", rest: "그다음엔 아무거나" },
    back: { label: "가이드 전체", to: "hub" },
  },
  edition: {
    title: "오디오 에디션",
    lede: "처음 한 번만. 같은 보드에, 소리를 받고 MIDI로 말하는 펌웨어를 올려요.",
    steps: [
      {
        kicker: "에디션",
        title: "보드는 그대로, 펌웨어만 더.",
        body: [
          "에디션은 패턴플로우 펌웨어에 기능을 더한 거예요. 오디오 에디션엔 브라우저 탭의 소리, 보드에 다는 마이크, MIDI, OSC가 들어 있어요. 마이크는 없어도 돼요. 달아서 켜기 전까진 꺼져 있어요.",
          "패턴, 와이파이, 설정은 그대로 남아요. 업데이트는 프로그램만 바꾸거든요. 기본 펌웨어로 돌아가는 것도 똑같이 클릭 한 번이에요.",
        ],
      },
      {
        kicker: "설치",
        title: "‘Install to my panel’을 눌러요.",
        body: [
          "patternflow.work/editions에서(아래 버튼으로 열려요) Patternflow Audio를 찾아 Install to my panel을 눌러요. 브라우저가 보드의 Update 페이지를 여는데, 빌드가 이미 연결돼 있어요.",
          "거기서 Fetch & flash를 눌러요. 전원은 그대로 둬요. 보드가 새 빌드로 알아서 다시 켜져요.",
          "보드가 켜진 채로 이 컴퓨터와 같은 와이파이에 있어야 해요. 새 ESP32라면 연주 가이드의 01 굽기가 먼저예요. 그건 USB로 해요.",
        ],
        warn: "안드로이드는 patternflow.local을 못 열어요. K2를 꾹 눌러 나온 IP 주소를 카드의 Details → your panel에 먼저 넣어요.",
        extra: "editionsLink",
      },
      {
        kicker: "확인",
        title: "K2를 꾹. 줄이 두 개 늘었어요.",
        body: [
          "NETWORK 화면에 줄이 두 개 생겼어요. 제목 바로 아래, 와이파이 줄과 주소 위에 OSC와 AUD.",
          "AUD는 브라우저 확장 프로그램이 보내는 소리를 받는 스위치예요. K3를 오른쪽으로 돌리면 켜지고, 왼쪽으로 돌리면 꺼져요. OSC는 K2로 똑같이 해요. 둘 다 켜진 채로 시작해요.",
          "콘솔 위쪽 메뉴엔 Audio와 MIDI 두 페이지가 생겨요. MIDI는 이 화면에 줄이 없어요. 스위치가 MIDI 페이지에 있어요.",
        ],
      },
    ],
  },
  browser: {
    title: "브라우저 탭",
    lede: "탭에서 나는 소리가 노브 네 개를 돌려요.",
    needs: { label: "보드에 오디오 에디션이 있어야 해요", href: "#edition" },
    steps: [
      {
        kicker: "확장 프로그램",
        title: "저장소에서 받아 올려요.",
        body: [
          "확장 프로그램은 크롬 웹 스토어에 없어요. github.com/engmung/Patternflow에서 Code → Download ZIP으로 받아 압축을 풀어요.",
          "크롬은 chrome://extensions, 엣지는 edge://extensions를 열어요. 개발자 모드(Developer mode)를 켜고, 압축해제된 확장 프로그램 로드(Load unpacked)를 눌러 tools/patternflow-audio-extension 폴더를 골라요. 엣지에선 이 버튼이 ‘압축 풀린 파일 로드’예요.",
          "나중에 새 버전을 받았다면 같은 폴더에 덮어쓴 다음, 그 페이지에서 확장 프로그램 카드의 새로고침(Reload)을 눌러요. 엣지에선 ‘다시 로드’예요. 매핑은 그대로 남아요.",
        ],
      },
      {
        kicker: "시작",
        title: "탭을 열고 Start.",
        body: [
          "소리가 나는 탭으로 가서, 툴바의 Patternflow Audio 버튼을 눌러요. Device에 보드 주소(patternflow.local, 또는 K2를 꾹 눌러 나온 IP 주소)를 넣고 Start를 눌러요.",
          "팝업 구석에 Live가 뜨고 패턴이 움직이기 시작해요. 노브 자체는 가만히 있어요. 소리가 움직이는 건 노브의 값이지 손잡이가 아니에요. 같은 버튼이 Stop이 되고, 누르면 노브가 다시 내 손으로 돌아와요.",
        ],
        note: "유튜브나 스포티파이를 크롬에서 틀어 두고 세팅만 조금 하면 꽤 재밌는 오디오 싱크 비주얼이 된다. 에이블톤에서 트랙이랑 미디 신호를 세팅하는 것보다 훨씬 간편하다.",
        extra: "audioShots:popup",
      },
      {
        kicker: "Live가 아니라면",
        title: "팝업에 이유가 적혀 있어요.",
        body: [
          "Aud off: 연결은 됐는데 보드가 받는 소리를 무시하고 있어요. Turn on을 눌러요. K2를 꾹 눌러 보는 AUD 줄과 같은 스위치예요.",
          "Live인데 안 움직인다면: 소리가 2초 동안 없으면 주소 아래 줄에 No sound from this tab yet이 떠요. 소리 나는 탭이 맞는지 봐요.",
          "Error: 주소 아래 줄에 이유가 적혀 있어요. 그 주소에 아무것도 없거나, 오디오 에디션이 아닌 보드예요.",
        ],
        extra: "audioShots:popupStates",
      },
      {
        kicker: "에디터",
        title: "노브 하나가 스펙트럼 위의 상자 하나.",
        body: [
          "팝업에서 Mapping editor를 눌러요. K1부터 K4까지가 실시간 스펙트럼 위의 상자 네 개예요. 상자의 너비는 그 노브가 듣는 주파수, 높이는 작은 소리부터 큰 소리까지의 범위예요. 매핑은 보드가 아니라 브라우저에 저장돼요.",
          "아래는 진짜 에디터예요. 이 페이지의 보드를 움직이고 있어요. 열어서 K1 상자를 옆으로 끌어 보세요. K1이 스펙트럼의 다른 자리를 따라가요. K1 카드 맨 아래의 Mute를 켜 두면 그 노브는 다시 내 손으로 돌아와요.",
          "이제 여기 보드의 노브를 잡아 보세요. 노브 둘레의 주황 점을 끌면 돼요. 잡고 있는 동안은 내 것이고, 놓고 5초쯤 지나면 소리가 다시 가져가요. 내 보드도 똑같아요.",
        ],
        extra: "editorLive",
      },
    ],
  },
  mic: {
    title: "마이크",
    lede: "작은 부품 하나와 선 다섯 가닥이면, 다른 건 아무것도 안 켜도 보드가 방 안의 소리를 들어요.",
    needs: { label: "보드에 오디오 에디션이 있어야 해요", href: "#edition" },
    steps: [
      {
        kicker: "부품",
        title: "PDM 마이크. PDM만 돼요.",
        body: [
          "Adafruit PDM MEMS Microphone Breakout(제품 번호 3492), 또는 핀 줄에 3V, GND, SEL, CLK, DAT라고 적힌 호환품. 그리고 10 cm쯤 되는 가는 선 다섯 가닥. 짧을수록 좋아요.",
        ],
        warn: "INMP441 같은 I²S 마이크는 안 돼요. 아날로그 일렉트릿 모듈도 안 돼요. 보드에 남는 핀이 둘뿐인데, 두 핀으로 되는 건 PDM뿐이에요.",
        extra: "audioShots:micPart",
      },
      {
        kicker: "ESP32",
        title: "들어 올려 빼요.",
        body: [
          "뒷면 덮개를 밀어 빼고, ESP32를 소켓에서 곧게 들어 올려요. 납땜은 전부 ESP32에만 해요. ESP32가 꽂혀 있던 기판은 건드리지 않아요.",
          "언제든 되돌릴 수 있어요. 선만 떼면 돼요.",
        ],
      },
      {
        kicker: "선 다섯, 자리 넷",
        title: "윗면에 납땜해요.",
        body: [
          "ESP32 윗면으로 헤더 핀이 올라온 자리에 납땜해요. 3V는 3V3에. GND와 SEL은 둘 다 GND에. CLK는 TX에. DAT는 RX에.",
          "실크 인쇄엔 TX, RX라고 적혀 있어요. 보드에 남은 핀은 이 둘뿐이에요. 3V3과 GND는 헤더에 여러 개 있으니 가까운 걸 써요.",
        ],
        warn: "SEL을 GND에 잇는 걸 빼먹지 마세요. 안 이으면 마이크는 멀쩡해 보이는데 무음만 읽어요.",
        extra: "audioShots:micWiring",
      },
      {
        kicker: "제자리로",
        title: "다시 꽂아요. 오른쪽 포트는 비워 둬요.",
        body: [
          "선을 위쪽으로 빼고, ESP32를 실크 인쇄 방향대로 소켓에 다시 꽂아요. 마이크는 소리가 닿는 곳에 두고, 전원은 언제나처럼 전원 케이블로 넣어요.",
        ],
        warn: "마이크가 달려 있는 동안엔 UART라고 적힌 오른쪽 USB 포트에 아무것도 꽂지 않아요. TX, RX를 같이 쓰는 포트예요.",
        extra: "audioShots:micSeated",
      },
      {
        kicker: "켜기",
        title: "콘솔, Audio, Microphone.",
        body: [
          "콘솔을 열고(같은 와이파이의 브라우저에서 patternflow.local, 또는 K2를 꾹 눌러 나온 IP 주소) Audio로 가요. Sources에서 Microphone을 켜요.",
          "스위치 옆의 칩이 listening으로 바뀌어요. 방이 조용하다면 Input gain을 올려요. 8에서 시작해요.",
        ],
        extra: "audioShots:audioIn",
      },
      {
        kicker: "매핑",
        title: "상자 네 개, 보드에 저장돼요.",
        body: [
          "콘솔 Audio 페이지의 Mapping에선 K1부터 K4까지, 노브마다 실시간 스펙트럼 위에 상자가 하나씩 있어요. 상자의 너비는 그 노브가 듣는 주파수, 높이는 작은 소리부터 큰 소리까지의 범위예요. K1 상자를 저음 쪽으로 끌면 K1이 저음을 따라가요.",
          "바꾸는 대로 보드에 저장되고, 껐다 켜거나 펌웨어를 업데이트해도 남아요.",
        ],
        note: "오디오 데이터를 직접 분석하는 것보다는 정밀도가 아쉽다. 아무래도 소리가 뭉쳐서 들어온다. 그래도 된다는 거에 의의를 두자. 시끄러운 정도에 반응하게만 해도 재밌다.",
        extra: "audioShots:audioInMap",
      },
      {
        kicker: "조용하다면",
        title: "칩이 하는 말.",
        body: [
          "Microphone 스위치 옆의 칩이 not detected라면: 데이터 핀에 아무것도 없어요. DAT에서 RX로 가는 선을 확인해요.",
          "not answering: 마이크가 있었는데 더는 값을 보내지 않아요. 이 상태에선 마이크가 노브를 움직이지 않아요.",
          "listening인데 아무리 시끄러워도 노브가 가만히 있다면: SEL이 GND에 안 이어진 거예요. 보드는 이걸 조용한 방과 구별하지 못해요.",
          "보통 음량에서 제일 높은 쪽 상자만 거의 안 움직인다면: 고장이 아니에요. 방 안 소리엔 가장 높은 음역의 에너지가 거의 없어요.",
        ],
        extra: "audioShots:audioInNoMic",
      },
    ],
  },
  midi: {
    title: "MIDI와 DAW",
    lede: "보드는 와이파이 위의 MIDI 장치예요. 노브 넷과 버튼 넷으로 DAW를 움직이고, DAW가 보드를 연주하기도 해요.",
    needs: { label: "보드에 오디오 에디션이 있어야 해요", href: "#edition" },
    steps: [
      {
        kicker: "연결",
        title: "네트워크 MIDI 세션을 만들어요.",
        body: [
          "보드와 컴퓨터가 같은 와이파이에 있어야 해요. 윈도우엔 네트워크 MIDI가 없어서, rtpMIDI(무료, Tobias Erichsen 제작)를 설치해 열어요.",
          "My Sessions 아래의 +를 누르고 Enabled에 체크해요. Directory에서 patternflow를 골라 Connect를 누르면 Participants로 옮겨 가요.",
          "맥은 설치할 게 없어요. 오디오 MIDI 설정(Audio MIDI Setup)의 윈도우 → MIDI 스튜디오 보기 → 네트워크에서 똑같이 해요.",
        ],
        warn: "Directory에 안 보이면 몇 초 기다려 봐요. 그래도 없으면 Directory의 +로 직접 넣어요. 보드의 IP 주소(K2를 꾹)와 포트 5004.",
        extra: "audioShots:rtpmidi",
      },
      {
        kicker: "Ableton Live",
        title: "Remote에 체크하고, 매핑해요.",
        body: [
          "Live에서 Settings → Link, Tempo & MIDI를 열어요. Input Ports에서 내 컴퓨터 이름으로 된 줄이 그 세션이에요. 그 줄의 Remote에 체크해요.",
          "Ctrl-M(맥은 Cmd-M)을 누르고, Live의 노브나 슬라이더를 하나 클릭하고, 보드의 노브를 돌린 다음, Ctrl-M을 다시 눌러요. 이제 그 노브가 그걸 움직여요. 양쪽으로 다 되고, 끝에선 멈춰요.",
          "노브가 끝에 닿았다가 돌아올 때 Live 쪽이 어떻게 이어받을지는 같은 Settings 페이지의 Takeover Mode가 정해요. Value Scaling이 부드러워요.",
        ],
        warn: "rtpMIDI에선 연결됐는데 Live에서 아무것도 안 움직인다면, Remote에 체크가 안 된 거예요.",
        extra: "audioShots:liveRemote",
      },
      {
        kicker: "맵",
        title: "채널 1, 그리고 오가는 숫자들.",
        body: [
          "전부 채널 1이에요. 펌웨어에 고정돼 있으니, DAW에서 채널을 정할 땐 1로 맞춰요.",
          "보드에서 나가는 것: 손으로 돌린 K1부터 K4는 CC 24부터 27을 보내요. 버튼은 노트 60부터 63을 보내요. 패턴이 바뀌면 Program Change가 나가요.",
          "보드로 들어가는 것: CC 20부터 23은 노브 1부터 4의 값을 정하고, 손이 그 노브를 돌릴 때까지 유지돼요. 노트 60부터 63은 버튼을 눌러요. Program Change는 패턴을 골라요.",
          "Live에선: 버튼의 노트를 트랙으로 받으려면 Input Ports에서 세션 줄의 Track에 체크해요. 보드로 보내려면 Output Ports에서 그 줄의 Track에 체크하고, MIDI 트랙의 MIDI To를 그 세션으로 맞춰요.",
        ],
        note: "OSC가 있어서 괜찮을 줄 알았다. 그래서 MIDI는 떨떠름한 기분으로 뒤늦게 추가했는데, 웬걸, 사용하기 훨씬 편하다. 전부 내장되어 있어서 따로 패치를 만들지 않아도 된다. 이제는 나조차 OSC를 쓰지 않는다.",
      },
      {
        kicker: "설정",
        title: "콘솔의 MIDI 페이지.",
        body: [
          "콘솔을 열고(patternflow.local, 또는 K2를 꾹 눌러 나온 IP 주소) MIDI로 가요. Sensitivity는 한 번 돌릴 때 값이 얼마나 가는지예요. ×8부터 1/16까지. 슬라이더 넷이 같이 움직이는데, ‘move all four together’의 체크를 풀면 노브 하나만 따로 맞출 수 있어요.",
          "Knob value는 0부터 127까지의 위치를 보내요. Live엔 이걸 써요. Relative steps는 Max나 TouchDesigner처럼 끝없이 도는 인코더를 직접 매핑하는 소프트웨어용이에요.",
          "Switch 아래의 MIDI on this panel로, 펌웨어를 다시 굽지 않고 MIDI를 끌 수 있어요.",
        ],
        extra: "audioShots:midiPage",
      },
      {
        kicker: "계속 연결",
        title: "‘Use this computer’를 눌러요.",
        body: [
          "콘솔 MIDI 페이지의 Session에서 Use this computer를 눌러요. 보드가 이 컴퓨터의 주소를 기억해 뒀다가, 켜질 때마다, 그리고 세션이 끊길 때마다 직접 세션을 열어요. rtpMIDI를 다시 열 일이 없어요.",
          "먼저 20초를 기다렸다가 연결하니까, 막 켠 직후엔 조금 걸려요. rtpMIDI의 Who may connect to me는 Anyone으로 둬요. 그래야 보드가 컴퓨터에 먼저 연결할 수 있어요.",
        ],
        extra: "audioShots:midiSession",
      },
    ],
  },
  next: {
    title: "여기까지가 오디오 에디션.",
    lede: "여러 입력이 한꺼번에 살아 있으면, 노브를 잡은 손이 전부를 이겨요. DAW에서 온 MIDI는 손이 돌리기 전까지 노브를 붙잡고 있어요. 확장 프로그램은 마이크를 이기고, 마이크는 남은 걸 가져가요.",
    groups: [],
    until: "이 에디션에 더 있는 것, 그리고 전체 문서.",
    links: [
      { label: "OSC", href: `${GH}docs/osc-spec.md` },
      { label: "폰 앱", href: `${GH}tools/patternflow-audio-android/README.md` },
      { label: "디렉터 쇼를 .mid로", href: `${GH}docs/director-midi.md` },
      { label: "MIDI 맵", href: `${GH}docs/midi-spec.md` },
      { label: "AUDIO_GUIDE.md", href: `${GH}AUDIO_GUIDE.md` },
      { label: "Editions", href: "/editions" },
      { label: "가이드 전체", href: "/guide/ko" },
    ],
    report: { title: "stuck", where: "오디오 가이드 어딘가 (단계 없음)" },
  },
  ui: {
    editions: { label: "patternflow.work/editions 열기", href: "/editions" },
  },
};

export const AUDIO_COPY: Record<GuideLang, AudioCopy> = { en, ko };
