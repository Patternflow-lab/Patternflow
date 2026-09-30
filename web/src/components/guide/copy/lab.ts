import type { SceneCopy } from "../copy";
import type { GuideLang } from "../store";

// 06 Pattern Lab — every word of the chapter, in both languages. Layers,
// Graphic Export and Director are steps in here, not chapters. Step N here
// is shown while step N of scenes/lab.ts is on stage; the two lists must be
// the same length. The chapter's name on the rail and in the opening's list
// is copy/make.ts's opening.chapters[1].
//
// Step 0's kicker, title and extra are fixed ("Open the Lab.", labWindow).
//
// Every claim is the code's: web/src/app/pattern-lab/** (PatternLabClient,
// HardwareModal, panels/*), web/src/lib/lab/**, and for Apply, publishing
// and the pattern page web/src/components/community/** (SendModuleModal,
// PublishModal, AddHeaderModal) and app/community/p/[id]. UI words are quoted
// as the UI says them, in English in both languages. The screens, and the
// detail that belongs beside a screen, are LabShots.tsx: a card here says the
// step, its screens show where. The "From the maker" notes only restate what
// the maker wrote in web/content/journal/how-to-use-part-two.mdx.
//
// Cards with screens stay short: at 1440×900 the whole card has to fit.

const en: SceneCopy = {
  num: "06",
  title: "Your own pattern",
  lede: "Ask an AI for one, colour it, set its knobs and put it on your board. All in the browser.",
  steps: [
    {
      kicker: "Pattern Lab",
      title: "Open the Lab.",
      body: [
        "Pattern Lab is at patternflow.work/pattern-lab. It runs in the browser: nothing to install, and no account to start making. The preview is on the left, the code in the middle, the knobs and the Color Ramp on the right.",
        "The board on this page now plays your own draft from this browser's Lab, and changes each time the Lab saves. It only reads it; nothing is written back. With nothing saved, it plays the pattern the Lab opens with, Code 1. Drafts in the community site's Lab don't show here.",
      ],
      extra: "labWindow",
    },
    {
      kicker: "The name",
      title: "Name it first.",
      body: [
        "Type a name where it says name this pattern. It's the name your board will list it under; left blank, the board gets a layer's name, like Code 1.",
        "Your work saves as you go, in this browser only.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Ask an AI",
      title: "Get a pattern from an AI.",
      body: [
        "Press Copy prompt and paste it into ChatGPT, Claude or Gemini. It comes back with five variations: copy the one you like, press Paste.",
        "Or let the Gallery ask Gemini for you, with your own free key from Google AI Studio.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Color Ramp",
      title: "Black and white is right.",
      body: [
        "The prompt asks for a v-field: the code gives each pixel a value from 0 to 1, and the layer's Color Ramp colours it. The ramp starts black to white.",
        "Press Random ramp, or click the bar and pick colours. The ramp goes to the board with the pattern.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Knobs",
      title: "Give the knobs a range.",
      body: [
        "The four sliders are your board's knobs, K1 first, shared by every layer. Their names and ranges come from a line in the code: // @knobs Glitch=0..1, Speed=0.05..5, …",
        "Widen a range and the knob does more — on the board too.",
      ],
      extra: "labShots",
    },
    {
      kicker: "To hardware",
      title: "One more prompt, for the board.",
      body: [
        "The board runs C++, so the pattern goes to it as a .h header. Press To hardware, then Copy the conversion prompt; paste it into your AI, and its answer back into the Lab.",
        "When it starts with #pragma once, press Next →.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Apply",
      title: "Onto your board.",
      body: [
        "↗ Apply to my Patternflow builds a module on the community's server; you need to be signed in. Send over Wi-Fi then opens your board's Patterns page, which installs it.",
        "Hold K4: it's in the list, under its name.",
      ],
      warn: "Your computer has to be on the same Wi-Fi as the board. On Android, put the IP from K2 into Device address first.",
      extra: "labShots",
    },
    {
      kicker: "Layers",
      title: "Stack them.",
      body: [
        "+ Code adds another pattern with its own ramp, + Pixel a layer for pixel art or an image. A layer set to masks layer below cuts out the one beneath it.",
        "For the board, each code layer gets its own prompt.",
      ],
      note: "I made layers for pixel art. Code is bad at drawing one particular picture, and I thought a picture with a few things moving on it would be fun enough. With masks, it's a bit like compositing.",
      extra: "labShots",
    },
    {
      kicker: "Graphic Export",
      title: "Pictures and video.",
      body: [
        "Graphic Export saves your pattern as a PNG, or records it as MP4 or WebM, up to 4096 px a side. It all happens in your browser.",
      ],
      note: "The pictures on my business card came out of Graphic Export, and so did a high-res entry to a media-art competition. It didn't get in.",
      extra: "labShots",
    },
    {
      kicker: "Director",
      title: "A timeline for the knobs.",
      body: [
        "The Director keyframes the knobs over time. .pfs plays on a board with the Performance edition, .mid goes to Ableton, Render… makes a video.",
      ],
      note: "It sets knob moves up ahead of time. With Graphic Export you could bake them to a piece of sound and play the video out beside it, but that isn't live, so it isn't for me. Where it really pays off is the Performance edition.",
      extra: "labShots",
    },
    {
      kicker: "The community",
      title: "Give it back.",
      body: [
        "Upload to the community publishes it with its .h, ready for anyone's board; Share, at the top, without one. You sign in when you publish.",
        "Opened someone's pattern? Yours goes up as its fork. And a JS-only pattern from 05 can get its .h the same way: make it here, propose it on its page.",
      ],
      note: "A Director show can go on someone's pattern the same way, as a performance. I should make one and put it up too; I keep putting it off.",
      extra: "labShots",
    },
  ],
};

const ko: SceneCopy = {
  num: "06",
  title: "내 패턴",
  lede: "AI에게 패턴을 받아 색을 입히고, 노브를 정하고, 내 보드에 올려요. 전부 브라우저에서요.",
  steps: [
    {
      kicker: "Pattern Lab",
      title: "랩을 열어요.",
      body: [
        "패턴 랩은 patternflow.work/pattern-lab에 있어요. 브라우저에서 돌아가서 설치할 게 없고, 만들기 시작하는 데 계정도 필요 없어요. 왼쪽은 미리보기, 가운데는 코드, 오른쪽엔 노브와 Color Ramp가 있어요.",
        "이제 이 페이지의 보드는 이 브라우저 랩에 있는 내 초안을 틀어요. 랩이 저장할 때마다 따라 바뀌고, 읽기만 할 뿐 아무것도 저장하지 않아요. 저장한 게 없으면 랩이 처음 여는 패턴, Code 1이 나와요. 커뮤니티 사이트 쪽 랩의 초안은 여기 안 보여요.",
      ],
      extra: "labWindow",
    },
    {
      kicker: "이름",
      title: "이름부터 지어요.",
      body: [
        "name this pattern 자리에 이름을 적어요. 보드 목록에 뜨는 이름이 이거예요. 비워 두면 Code 1 같은 레이어 이름이 대신 보드로 가요.",
        "작업은 하는 대로 저장되고, 이 브라우저에만 남아요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "AI에게",
      title: "AI에게 패턴을 받아요.",
      body: [
        "Copy prompt를 눌러 ChatGPT, Claude, Gemini 중 하나에 붙여넣으면 변형 다섯 개가 와요. 마음에 드는 걸 복사해서 Paste를 눌러요.",
        "Gallery가 대신 Gemini에게 물어보게 할 수도 있어요. 구글 AI 스튜디오에서 무료로 받는 내 키가 필요해요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Color Ramp",
      title: "흑백이 맞아요.",
      body: [
        "프롬프트는 v-field를 달라고 해요. 코드는 픽셀마다 0에서 1 사이 값만 내고, 색은 그 레이어의 Color Ramp가 입혀요. 램프는 검정에서 흰색으로 시작해요.",
        "Random ramp를 누르거나, 바를 클릭해 색을 골라요. 램프는 패턴과 함께 보드로 가요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "노브",
      title: "노브의 범위를 정해요.",
      body: [
        "슬라이더 네 개가 보드의 노브예요. 첫 번째가 K1이고, 모든 레이어가 같이 써요. 이름과 범위는 코드의 한 줄에서 와요. // @knobs Glitch=0..1, Speed=0.05..5, …",
        "범위를 넓히면 노브가 더 크게 움직여요. 보드에서도요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "To hardware",
      title: "보드용 프롬프트가 하나 더 있어요.",
      body: [
        "보드는 C++로 돌아가서, 패턴은 .h 헤더가 되어야 보드로 가요. To hardware를 누르고 Copy the conversion prompt로 복사해 AI에게 붙여넣은 다음, AI의 답을 랩에 다시 붙여넣어요.",
        "#pragma once로 시작하면 Next →를 눌러요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Apply",
      title: "내 보드에 올려요.",
      body: [
        "↗ Apply to my Patternflow를 누르면 커뮤니티 서버가 모듈을 만들어요. 로그인이 필요해요. 이어서 Send over Wi-Fi를 누르면 보드의 Patterns 페이지가 열리고 알아서 설치해요.",
        "K4를 꾹 누르면 목록에 그 이름으로 있어요.",
      ],
      warn: "컴퓨터가 보드와 같은 와이파이에 있어야 해요. 안드로이드라면 K2의 IP를 Device address에 먼저 넣어요.",
      extra: "labShots",
    },
    {
      kicker: "레이어",
      title: "겹쳐요.",
      body: [
        "+ Code는 램프를 따로 가진 패턴을 하나 더, + Pixel은 픽셀아트나 이미지를 올릴 레이어를 더해요. masks layer below를 켠 레이어는 바로 아래 레이어를 오려 내요.",
        "보드로 보낼 땐 코드 레이어마다 프롬프트가 하나씩이에요.",
      ],
      note: "레이어는 픽셀아트를 넣고 싶어서 만들었다. 코드만으로 구체적인 그림을 그리기는 어렵고, 그림 위로 몇 가지만 움직여도 꽤 재밌겠다 싶었다. 마스크까지 쓰면 컴포지팅하는 기분도 난다.",
      extra: "labShots",
    },
    {
      kicker: "Graphic Export",
      title: "그림과 영상.",
      body: [
        "Graphic Export는 내 패턴을 PNG로 저장하거나 MP4·WebM으로 녹화해요. 한 변 4096px까지 되고, 전부 내 브라우저 안에서 해요.",
      ],
      note: "내 명함에 들어간 그림을 Graphic Export로 만들었다. 고해상도로 뽑아 미디어아트 공모전에도 냈는데, 결과는 탈락.",
      extra: "labShots",
    },
    {
      kicker: "Director",
      title: "노브의 타임라인.",
      body: [
        "Director는 노브에 시간에 따른 키프레임을 찍어요. .pfs는 퍼포먼스 에디션 보드에서, .mid는 에이블톤에서 쓰고, Render…는 영상으로 뽑아요.",
      ],
      note: "노브 움직임을 미리 짜 두는 기능이다. Graphic Export랑 엮으면 어떤 소리에 맞춰 구운 영상을 같이 틀 수도 있겠지만, 라이브가 아니라서 나랑은 안 맞는다. 제일 빛을 보는 건 퍼포먼스 에디션에서다.",
      extra: "labShots",
    },
    {
      kicker: "커뮤니티",
      title: "나눠요.",
      body: [
        "Upload to the community는 .h까지 함께 올려서, 누구든 바로 자기 보드에 넣을 수 있어요. 맨 위 Share는 .h 없이 올려요. 로그인은 올릴 때 해요.",
        "남의 패턴에서 열었다면 그 패턴의 포크로 올라가요. 05에서 본 JS만 있는 패턴도 같은 식이에요. 여기서 .h를 만들어 그 패턴 페이지에 제안해요.",
      ],
      note: "디렉터로 만든 쇼도 같은 식으로 남의 패턴에 퍼포먼스로 붙일 수 있다. 나도 하나 만들어 올려야 하는데, 계속 미루는 중이다.",
      extra: "labShots",
    },
  ],
};

export const LAB_COPY: Record<GuideLang, SceneCopy> = { en, ko };
