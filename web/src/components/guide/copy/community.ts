import type { SceneCopy } from "../copy";
import type { GuideLang } from "../store";

// 05 Community — every word of the chapter, in both languages. Step N here
// is shown while step N of scenes/community.ts is on stage; the two lists
// must be the same length. The chapter's name on the rail and in the
// opening's list is copy/make.ts's opening.chapters[0].
//
// Written for doing: each card says what to do and why. Where the desk is up
// the reader does it in the practice community beside the card (a replica of
// the real UI, desk/community/), with the pointer showing the way
// (tutorials/community.ts); elsewhere the card shows the real site's screens
// (CommunityShots.tsx). So the words hold for both: they are about the real
// community, which the practice copies.
//
// Checked against the community's code (web/src/components/community/**,
// web/src/app/community/**, web/src/lib/community/**) and the live site.
// Button names stay in English in both languages — they are the UI's words.
//
//   0 the wall          hover to play, the wheel turns a knob (K1–K4 across)
//   1 .h                what can go on a board: .h, Flashable now
//   2 one pattern       ↗ Send to my Patternflow → Send over Wi-Fi (no account)
//   3 your deck         the bar at the bottom: +, drop a card, order, ✕,
//                       Send to my board → Send over Wi-Fi (up to firmware
//                       v3.10.4 that drops the order; the next firmware keeps
//                       it; ↓ .zip always has)
//   4 other decks       the Decks page: Install to my board, Copy into my deck
//   5 open in the Lab   a copy, marked as a fork — which is 06

const en: SceneCopy = {
  num: "05",
  title: "The community",
  lede: "Patterns other people made, playing live. Take one at a time, or a whole deck.",
  steps: [
    {
      kicker: "The wall",
      title: "Every pattern, playing.",
      body: [
        "community.patternflow.work hangs everything people have shared. Put the mouse on a card and it plays; roll the wheel over its screen and a knob turns. The screen is split K1 to K4, left to right.",
        "Looking needs no account. On a phone the cards are stills: tap one to open its page, where it plays.",
      ],
      extra: "communityShots",
    },
    {
      kicker: ".h",
      title: "Only a .h goes on a board.",
      body: [
        "Every pattern here is JavaScript: that's what plays in your browser. The board runs C++, so a pattern goes on it only once it has a .h, its firmware header.",
        "Those carry a .h on the screen. Press Flashable now and only they stay.",
      ],
      note: "A pattern with only JS doesn't have to wait for its author. Anyone can make the .h — in Pattern Lab — and propose it on the pattern's own page. I don't think anyone has yet.",
      extra: "communityShots",
    },
    {
      kicker: "One pattern",
      title: "Send one to your board.",
      body: [
        "Open a pattern with a .h and press ↗ Send to my Patternflow, then Send over Wi-Fi. Your board's own Patterns page opens with the pattern linked, fetches it and installs it. No account, no cable.",
        "It's in the list straight away. Hold K4 to find it.",
      ],
      warn: "On Android, type the IP from K2 into Board address in the same window first.",
      extra: "communityShots",
    },
    {
      kicker: "Your deck",
      title: "Make a deck of your own.",
      body: [
        "A deck is a running order: up to 20, kept in this browser. Press + on a card with a .h, or drag the card down onto the bar at the bottom. Drag a slot to move it; drop it on ✕ to take it out.",
        "Send to my board builds the deck (you need an account), then Send over Wi-Fi puts it on your board. On a phone, the ▦ chip at the top holds your deck.",
      ],
      warn: "Up to firmware v3.10.4, Send over Wi-Fi drops this order; the next firmware keeps it. Until your board has it, drop the ↓ .zip on the board's Patterns page instead.",
      extra: "communityShots",
    },
    {
      kicker: "Other decks",
      title: "Or take someone else's.",
      body: [
        "The Decks page holds the sets people stand behind. Basics from 03 is there, under Ships with Patternflow. Open a community deck and press Install to my board: no account, and the order comes with it.",
        "Copy into my deck puts it in your bar instead, to change before you send it.",
      ],
      extra: "communityShots",
    },
    {
      kicker: "Make it yours",
      title: "Open it in the Lab.",
      body: [
        "Every pattern's page has Open in Pattern Lab, .h or not. A copy opens in the Lab; share it from there and it goes up as your fork, linked to the original.",
        "That Lab is the one at community.patternflow.work, with drafts of its own: whatever was open there waits under Recent ▾. Making one of your own is next.",
      ],
      note: "Open someone's pattern and change it, and it's a fork. I made the Lab mark that by itself, so now and then it marks one that isn't.",
      extra: "communityShots",
    },
  ],
};

const ko: SceneCopy = {
  num: "05",
  title: "커뮤니티",
  lede: "남들이 만든 패턴이 살아서 돌아가요. 하나씩 가져와도, 덱째로 가져와도 돼요.",
  steps: [
    {
      kicker: "벽",
      title: "모든 패턴이 돌아가요.",
      body: [
        "community.patternflow.work엔 사람들이 나눈 패턴이 전부 걸려 있어요. 카드에 마우스를 올리면 재생되고, 화면 위에서 휠을 굴리면 노브가 돌아가요. 화면은 왼쪽부터 K1–K4로 나뉘어 있어요.",
        "구경하는 데는 계정이 필요 없어요. 폰에선 카드가 멈춘 그림이라, 눌러서 들어가야 움직여요.",
      ],
      extra: "communityShots",
    },
    {
      kicker: ".h",
      title: ".h가 있어야 보드에 올라가요.",
      body: [
        "여기 패턴은 전부 자바스크립트예요. 브라우저에서 돌아가는 게 그거예요. 보드는 C++로 돌아가서, 펌웨어 헤더인 .h가 있어야 올릴 수 있어요.",
        "그런 패턴은 화면 구석에 .h가 붙어 있어요. Flashable now를 누르면 그것만 남아요.",
      ],
      note: "JS만 있는 패턴이라고 주인이 .h를 붙여 줄 때까지 기다릴 필요는 없다. 누구든 패턴 랩에서 직접 만들어 그 패턴 페이지에 제안하면 된다. 아직 해 본 사람은 없는 것 같지만.",
      extra: "communityShots",
    },
    {
      kicker: "패턴 하나",
      title: "하나만 보드로 보내요.",
      body: [
        ".h가 있는 패턴을 열고 ↗ Send to my Patternflow, 이어서 Send over Wi-Fi를 눌러요. 보드의 Patterns 페이지가 열리면서 그 패턴을 알아서 받아 설치해요. 계정도 케이블도 필요 없어요.",
        "바로 목록에 들어가요. K4를 꾹 눌러 찾아보세요.",
      ],
      warn: "안드로이드라면 같은 창의 Board address에 K2로 본 IP 주소를 먼저 넣어요.",
      extra: "communityShots",
    },
    {
      kicker: "내 덱",
      title: "내 덱을 만들어요.",
      body: [
        "덱은 재생 순서예요. 20개까지, 이 브라우저에 담겨요. .h가 있는 카드의 +를 누르거나, 카드를 아래쪽 덱 바에 끌어다 놓아요. 칸을 끌면 자리가 바뀌고, ✕ 위에 놓으면 빠져요.",
        "Send to my board가 덱을 빌드하고(계정이 필요해요), 이어서 Send over Wi-Fi가 보드로 넘겨요. 폰에선 위쪽의 ▦ 칩에 덱이 있어요.",
      ],
      warn: "펌웨어 v3.10.4까지는 Send over Wi-Fi로 보내면 이 순서가 빠져요. 다음 펌웨어부터는 따라가요. 그전까진 ↓ .zip을 보드의 Patterns 페이지에 올리면 순서까지 들어가요.",
      extra: "communityShots",
    },
    {
      kicker: "남의 덱",
      title: "남의 덱을 통째로 가져와요.",
      body: [
        "Decks 페이지엔 사람들이 자신 있게 내건 덱이 있어요. 03에서 올린 Basics도 Ships with Patternflow 아래에 있어요. 커뮤니티 덱을 열어 Install to my board를 누르면 계정 없이, 순서까지 그대로 들어가요.",
        "Copy into my deck을 누르면 아래쪽 바의 내 덱으로 가져와요. 고친 다음 보내면 돼요.",
      ],
      extra: "communityShots",
    },
    {
      kicker: "내 것으로",
      title: "랩에서 열어요.",
      body: [
        "패턴 페이지마다 Open in Pattern Lab이 있어요. .h가 없어도요. 복사본이 랩에서 열리고, 거기서 공유하면 원본과 연결된 내 포크로 올라가요.",
        "이때 열리는 건 community.patternflow.work의 랩이에요. 초안도 따로라서, 거기서 하던 건 Recent ▾에 남아요. 내 패턴 만들기는 바로 다음이에요.",
      ],
      note: "남의 패턴을 열어 고치면 포크가 된다. 표시는 랩이 알아서 붙이게 해 두었는데, 그래서 가끔 포크가 아닌 데도 붙는다.",
      extra: "communityShots",
    },
  ],
};

export const COMMUNITY_COPY: Record<GuideLang, SceneCopy> = { en, ko };
