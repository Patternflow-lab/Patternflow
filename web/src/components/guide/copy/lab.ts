import type { SceneCopy } from "../copy";
import type { GuideLang } from "../store";

// Make · 02 Pattern Lab — every word of the chapter, in both languages. Layers,
// Graphic Export and Director are steps in here, not chapters. Step N here
// is shown while step N of scenes/lab.ts is on the desk, and the pointer
// plays step N of tutorials/lab.ts; the lists must be the same length. The
// chapter's name on the rail and in the opening's list is copy/make.ts's
// opening.chapters[1].
//
// Step 0's kicker, title and extra are fixed ("Open the Lab.", labWindow).
//
// A card says what to do and what to watch for. On a screen big enough for
// the desk (desk/query.ts — a matter of window size, not of computer or
// phone) the reader does it in their own, real Lab beside the card (with a
// practice AI that gives set answers standing in for theirs); below that the
// same card shows the Lab's screens instead (LabShots.tsx), so a card never
// says "the window on the left", and says "on a big enough screen", never
// "on a computer".
//
// Every claim is the code's: web/src/app/pattern-lab/** (PatternLabClient,
// HardwareModal, panels/*), web/src/lib/lab/**, and for Apply, publishing
// and the pattern page web/src/components/community/** (SendModuleModal,
// PublishModal) and app/community/p/[id]. UI words are quoted as the UI says
// them, in English in both languages. The "From the maker" notes only
// restate what the maker wrote in web/content/journal/how-to-use-part-two.mdx.
//
// Cards stay short: beside the desk the text is a column about 330–410 px
// wide, and at 1280×800 the whole card has to fit.

const en: SceneCopy = {
  num: "02",
  title: "Your own pattern",
  lede: "Ask an AI for one, colour it, set its knobs and put it on your board. All in the browser.",
  steps: [
    {
      kicker: "Pattern Lab",
      title: "Open the Lab.",
      body: [
        "Pattern Lab is at patternflow.work/pattern-lab. It runs in the browser: nothing to install, and no account to start making. The preview is on the left, the code in the middle, the knobs and the Color Ramp on the right.",
        "On a big enough screen it's open right here, beside these cards. It's your real Lab, with what this browser has saved, and what you make in it stays. The pointer shows the way; the clicks are yours.",
      ],
      extra: "labWindow",
    },
    {
      kicker: "The name",
      title: "Name it first.",
      body: [
        "Type a name where it says name this pattern. It's the name your board lists it under; left blank, the board gets a layer's name, like Code 1.",
        "Your work saves as you go, in this browser only. Under the name it says Saved locally.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Ask an AI",
      title: "Get a pattern from an AI.",
      body: [
        "Press Copy prompt, paste it into an AI and send it. Copy the code it writes, then press Paste in the Lab: the preview changes to the new pattern.",
        "For real, that's your own AI, ChatGPT, Claude, Gemini or another, and it comes back with five variations to choose from. On a big enough screen, a practice AI with set answers stands in for it here.",
      ],
      warn: "Paste reads the clipboard, so the browser may ask first. Allow it, or paste into the box the Lab opens instead and press OK.",
      extra: "labShots",
    },
    {
      kicker: "Color Ramp",
      title: "Black and white is right.",
      body: [
        "The prompt asks for a v-field: the code gives each pixel a value from 0 to 1, and the layer's Color Ramp colours it. The ramp starts black to white.",
        "Press Random ramp and the preview takes its colours; press it again for others, or click the bar to add a stop. The ramp goes to the board with the pattern.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Knobs",
      title: "Give the knobs a range.",
      body: [
        "The four sliders are your board's knobs, K1 at the top, shared by every layer. Drag one and watch the preview.",
        "The boxes either side are its range: double-click one and type a number. Names and ranges start from a line in the code that begins // @knobs. Widen a range and the knob does more, on the board too.",
      ],
      extra: "labShots",
    },
    {
      kicker: "To hardware",
      title: "One more prompt, for the board.",
      body: [
        "The board runs C++, so the pattern goes to it as a .h header, and an AI writes that too. Press To hardware, then Copy the conversion prompt, and send it to the AI.",
        "Copy the .h it writes. It goes into the Lab next.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Apply",
      title: "Onto your board.",
      body: [
        "Paste the .h into the box under Copy the conversion prompt. Looks like a header ✓ means it starts with #pragma once; press Next →.",
        "↗ Apply to my Patternflow builds a module on the community's server, so you need to be signed in. Send over Wi-Fi then opens your board's Patterns page, which installs it. Hold K4: it's in the list, under its name.",
      ],
      warn: "Your computer has to be on the same Wi-Fi as the board. On Android, put the IP from the board's NETWORK screen (hold K2) into Device address first.",
      extra: "labShots",
    },
    {
      kicker: "Layers",
      title: "Stack them.",
      body: [
        "+ Code adds another pattern on top, with its own ramp; + Pixel, a layer for pixel art or an image. Tick masks layer below, and the new layer cuts out the one beneath it.",
        "A layer that paints has Opacity and Blend instead. For the board, each code layer gets its own prompt.",
      ],
      note: "I made layers for pixel art. Code is bad at drawing one particular picture, and I thought a picture with a few things moving on it would be fun enough. With masks, it's a bit like compositing.",
      extra: "labShots",
    },
    {
      kicker: "Graphic Export",
      title: "Pictures and video.",
      body: [
        "In the Graphic Export tab, pick a size and press Save PNG: your pattern as a picture, up to 4096 px a side. ● Record makes an MP4 or WebM. It all happens in your browser.",
      ],
      note: "The pictures on my business card came out of Graphic Export, and so did a high-res entry to a media-art competition. It didn't get in.",
      extra: "labShots",
    },
    {
      kicker: "Director",
      title: "A timeline for the knobs.",
      body: [
        "In the Director tab, double-click the lane in two places, a little apart: two keyframes and a curve between them. Press ▶ and the knob follows it.",
        ".pfs plays on a board with the Performance edition, .mid goes to Ableton, Render… makes a video.",
      ],
      note: "It sets knob moves up ahead of time. With Graphic Export you could bake them to a piece of sound and play the video out beside it, but that isn't live, so it isn't for me. Where it really pays off is the Performance edition.",
      extra: "labShots",
    },
    {
      kicker: "The community",
      title: "Give it back.",
      body: [
        "Upload to the community, after Next → in To hardware, publishes it with its .h, ready for anyone's board; Share, at the top, without one. You sign in when you publish.",
        "Opened someone's pattern? Yours goes up as its fork. And a JS-only pattern from 01 can get its .h the same way: make it here, then propose it on its page with Port this pattern (.h).",
      ],
      note: "A Director show can go on someone's pattern the same way, as a performance. I should make one and put it up too; I keep putting it off.",
      extra: "labShots",
    },
  ],
};

const ko: SceneCopy = {
  num: "02",
  title: "내 패턴",
  lede: "AI에게 패턴을 받아 색을 입히고, 노브를 정하고, 내 보드에 올려요. 전부 브라우저에서요.",
  steps: [
    {
      kicker: "Pattern Lab",
      title: "랩을 열어요.",
      body: [
        "패턴 랩은 patternflow.work/pattern-lab에 있어요. 브라우저에서 돌아가서 설치할 게 없고, 만들기 시작하는 데 계정도 필요 없어요. 왼쪽은 미리보기, 가운데는 코드, 오른쪽엔 노브와 Color Ramp가 있어요.",
        "화면이 넉넉하면 이 카드 옆에 바로 열려 있어요. 이 브라우저에 저장된 것까지 그대로인 진짜 내 랩이라, 여기서 만든 건 남아요. 포인터가 길을 알려 주고, 누르는 건 직접 해요.",
      ],
      extra: "labWindow",
    },
    {
      kicker: "이름",
      title: "이름부터 지어요.",
      body: [
        "name this pattern 자리에 이름을 적어요. 보드 목록에 뜨는 이름이 이거예요. 비워 두면 Code 1 같은 레이어 이름이 대신 보드로 가요.",
        "작업은 하는 대로 이 브라우저에만 저장돼요. 이름 아래에 Saved locally라고 떠요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "AI에게",
      title: "AI에게 패턴을 받아요.",
      body: [
        "Copy prompt를 누르고, AI에게 붙여넣어 보내요. AI가 써 준 코드를 복사한 다음 랩에서 Paste를 누르면, 미리보기가 새 패턴으로 바뀌어요.",
        "실제로는 ChatGPT, Claude, Gemini 같은 내 AI에게 보내고, 고를 수 있게 변형 다섯 개가 돌아와요. 화면이 넉넉하면 여기선 정해진 답만 하는 연습용 AI가 대신해요.",
      ],
      warn: "Paste는 클립보드를 읽어서, 브라우저가 먼저 허락을 물을 수 있어요. 허용하거나, 대신 랩이 여는 상자에 붙여넣고 확인을 눌러요.",
      extra: "labShots",
    },
    {
      kicker: "Color Ramp",
      title: "흑백이 맞아요.",
      body: [
        "프롬프트는 v-field를 달라고 해요. 코드는 픽셀마다 0에서 1 사이 값만 내고, 색은 그 레이어의 Color Ramp가 입혀요. 램프는 검정에서 흰색으로 시작해요.",
        "Random ramp를 누르면 미리보기에 그 색이 입혀져요. 또 누르면 다른 색이 나오고, 바를 클릭하면 지점이 생겨요. 램프는 패턴과 함께 보드로 가요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "노브",
      title: "노브의 범위를 정해요.",
      body: [
        "슬라이더 네 개가 보드의 노브예요. 맨 위가 K1이고, 모든 레이어가 같이 써요. 하나를 끌면서 미리보기를 봐요.",
        "양옆 칸이 범위예요. 두 번 클릭하고 숫자를 적어요. 이름과 범위는 코드에서 // @knobs로 시작하는 줄에서 와요. 범위를 넓히면 노브가 더 크게 움직여요. 보드에서도요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "To hardware",
      title: "보드용 프롬프트가 하나 더 있어요.",
      body: [
        "보드는 C++로 돌아가서, 패턴은 .h 헤더가 되어야 보드로 가요. 이것도 AI가 써요. To hardware를 누르고 Copy the conversion prompt로 복사해서 AI에게 보내요.",
        "AI가 써 준 .h를 복사해요. 다음 단계에서 랩에 넣어요.",
      ],
      extra: "labShots",
    },
    {
      kicker: "Apply",
      title: "내 보드에 올려요.",
      body: [
        ".h를 Copy the conversion prompt 아래 상자에 붙여넣어요. Looks like a header ✓가 뜨면 #pragma once로 잘 시작한다는 뜻이에요. Next →를 눌러요.",
        "↗ Apply to my Patternflow를 누르면 커뮤니티 서버가 모듈을 만들어요. 그래서 로그인이 필요해요. 이어서 Send over Wi-Fi를 누르면 보드의 Patterns 페이지가 열리고 알아서 설치해요. K4를 꾹 누르면 목록에 그 이름으로 있어요.",
      ],
      warn: "컴퓨터가 보드와 같은 와이파이에 있어야 해요. 안드로이드라면 보드의 NETWORK 화면(K2를 꾹)에 뜨는 IP를 Device address에 먼저 넣어요.",
      extra: "labShots",
    },
    {
      kicker: "레이어",
      title: "겹쳐요.",
      body: [
        "+ Code는 램프를 따로 가진 패턴을 위에 하나 더 얹고, + Pixel은 픽셀아트나 이미지를 올릴 레이어를 더해요. masks layer below에 체크하면 새 레이어가 바로 아래 레이어를 오려 내요.",
        "그리는 레이어라면 그 자리에 Opacity와 Blend가 있어요. 보드로 보낼 땐 코드 레이어마다 프롬프트가 하나씩이에요.",
      ],
      note: "레이어는 픽셀아트를 넣고 싶어서 만들었다. 코드만으로 구체적인 그림을 그리기는 어렵고, 그림 위로 몇 가지만 움직여도 꽤 재밌겠다 싶었다. 마스크까지 쓰면 컴포지팅하는 기분도 난다.",
      extra: "labShots",
    },
    {
      kicker: "Graphic Export",
      title: "그림과 영상.",
      body: [
        "Graphic Export 탭에서 크기를 고르고 Save PNG를 누르면 내 패턴이 그림이 돼요. 한 변 4096px까지 되고, ● Record는 MP4나 WebM으로 녹화해요. 전부 내 브라우저 안에서 해요.",
      ],
      note: "내 명함에 들어간 그림을 Graphic Export로 만들었다. 고해상도로 뽑아 미디어아트 공모전에도 냈는데, 결과는 탈락.",
      extra: "labShots",
    },
    {
      kicker: "Director",
      title: "노브의 타임라인.",
      body: [
        "Director 탭에서 줄의 조금 떨어진 두 곳을 두 번씩 클릭해요. 키프레임 두 개와 그 사이 곡선이 생겨요. ▶를 누르면 노브가 그 곡선을 따라 움직여요.",
        ".pfs는 퍼포먼스 에디션 보드에서, .mid는 에이블톤에서 쓰고, Render…는 영상으로 뽑아요.",
      ],
      note: "노브 움직임을 미리 짜 두는 기능이다. Graphic Export랑 엮으면 어떤 소리에 맞춰 구운 영상을 같이 틀 수도 있겠지만, 라이브가 아니라서 나랑은 안 맞는다. 제일 빛을 보는 건 퍼포먼스 에디션에서다.",
      extra: "labShots",
    },
    {
      kicker: "커뮤니티",
      title: "나눠요.",
      body: [
        "To hardware에서 Next →를 누르면 Upload to the community가 있어요. .h까지 함께 올려서, 누구든 바로 자기 보드에 넣을 수 있어요. 맨 위 Share는 .h 없이 올려요. 로그인은 올릴 때 해요.",
        "남의 패턴에서 열었다면 그 패턴의 포크로 올라가요. 01에서 본 JS만 있는 패턴도 같은 식이에요. 여기서 .h를 만들어 그 패턴 페이지의 Port this pattern (.h)로 제안해요.",
      ],
      note: "디렉터로 만든 쇼도 같은 식으로 남의 패턴에 퍼포먼스로 붙일 수 있다. 나도 하나 만들어 올려야 하는데, 계속 미루는 중이다.",
      extra: "labShots",
    },
  ],
};

export const LAB_COPY: Record<GuideLang, SceneCopy> = { en, ko };
