# Writing voice

The README and the build guide set the voice for everything else written
here. Read a page of [README.md](../README.md) and of
[BUILD_GUIDE.md](../BUILD_GUIDE.md) before writing anything longer than a
sentence. Where the two differ, write like the README. It was rewritten in
October 2026 and joins its clauses with colons and full stops; the build guide
still reaches for dashes and opens its callouts with an emoji.

## Name the thing

Not "the power input" but "`J4`, the screw terminal". Not "a lot of LEDs"
but "8,192 points of light". A wait is "about two minutes" and a deadline is
"15 October 2026". A number carries its unit, and when it helps, the thing it
is measured against:

> it holds the panel to a 2.4 A budget, the high-power USB-A rating, so a
> white-out frame lands at roughly half brightness instead, while an ordinary
> bright pattern (~1.9 A) never notices.

Part numbers and designators are written as the BOM writes them:
`PEC11R-4220F-S0024`, `C11`. A knob gets its place the first time: "K2, the
top-left knob".

## Say what happens

The guides say what the reader will see, and what it means when it looks
wrong: "The dialog usually ends without asking for it, and nothing failed:
close it." A limit is stated as one, even after a fix: "1/120 and slow motion
still band". A claim comes with what it rests on: "In testing, a
40,000 mAh bank dropped about 13% over 2 hours at full brightness, which is
roughly 15 hours on a full charge". "Usually" appears where it is true and
the reader can act on it, not as a cushion under every sentence.

## Short, and finished

Sentences carry one point each. A long one is followed by a short one, and a
short one can open a section by itself: "Two licenses, in two separate
files." A step starts with what to do and then says why: "Buy the LED panel
the BOM links. It's verified, and the case is measured around its screw
holes." The reader's situation becomes a question with the answer straight
after it: "No printer?" A paragraph covers one thing and stops when it is
said. Nothing at the end of a section repeats the section.

## Who is speaking

"You" is the reader. "We" is everyone who makes Patternflow: "Every
Patternflow plays every pattern we make." "I" is SeungHun Lee, only on a page
that already speaks as him, and only for something he does: "I'll add your
pin to the build map." New text never gives him a memory or a feeling he did
not write himself.

## Words with fixed meanings

[EDITIONS.md](EDITIONS.md#the-three-words) defines the words for firmware
builds, and prose uses them as defined there. A bundle is a composition's
folder and nothing more; "addon" and "variant" stay only where they name the
wire. The other nouns (core, preset, module, pack, deck, the console) mean
what the README uses them for, with no synonym swapped in. Brand spelling is
hard rule 4 in [AGENTS.md](../AGENTS.md).

## Korean

Korean text keeps the ending its file already uses: the web guide speaks
해요체 and [SERVICES.md](SERVICES.md) 합니다체. The habits above hold in both.

## Side by side

A sentence that reads as generated, then the one the docs have instead:

> Make sure to select the correct USB port, as using the wrong one may cause
> problems during setup.
>
> Use its left port, labelled `USB` (antenna up, ports toward you): the right
> one flashes too, but the Wi-Fi step never appears there.

> 부품을 준비하는 과정에서는 여러 가지 사항을 고려하는 것이 좋습니다.
>
> 전부 부품 목록에 있어요. 주문부터 해요. 배송이 제일 오래 걸려요.

Words that never go in are in [voice-banned.txt](voice-banned.txt), one per
line. The maintainer adds to it, and `check:voice` reads it from there once
it lands ([rfc-cleanup.md §2.10](rfc-cleanup.md#210-writing-voice)). A
sentence that needs one of them to stand up is a sentence to cut.
