# Writing voice

The README and the build guide set the voice for English here. Read a page of
[README.md](../README.md) and of [BUILD_GUIDE.md](../BUILD_GUIDE.md) before
writing anything longer than a sentence. Where the two differ, write like the
README: it has no dash between clauses and no emoji callout, and the build
guide still has both. Korean has a standard of its own, at the end.

## Name the thing

Not "the power input" but "`J4`, the screw terminal". Not "a lot of LEDs"
but "8,192 points of light". A number carries its unit, and when it helps,
the thing it is measured against:

> it holds the panel to a 2.4 A budget, the high-power USB-A rating, so a
> white-out frame lands at roughly half brightness instead, while an ordinary
> bright pattern (~1.9 A) never notices.

A part is named as the BOM names it (`PEC11R-4220F-S0024`), and a knob gets
its place the first time: "K2, the top-left knob".

## Say what happens

The guides say what the reader will see, and what it means when it looks
wrong: "The dialog usually ends without asking for it, and nothing failed:
close it." A limit is stated as one, even after a fix: "1/120 and slow motion
still band". "Usually" appears where it is true and the reader can act on it,
not as a cushion under every sentence.

## Short, and finished

Sentences carry one point each. A long one is followed by a short one, and a
short one can open a section by itself: "Two licenses, in two separate
files." A step starts with what to do and then says why: "Buy the LED panel
the BOM links. It's verified, and the case is measured around its screw
holes." A paragraph covers one thing and stops when it is said.

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
wire. Brand spelling is hard rule 4 in [AGENTS.md](../AGENTS.md).

## Side by side

A sentence that reads as generated, then the one the README has instead:

> Make sure to select the correct USB port, as using the wrong one may cause
> problems during setup.
>
> Use its left port, labelled `USB` (antenna up, ports toward you): the right
> one flashes too, but the Wi-Fi step never appears there.

## Korean

Korean keeps the ending its file already uses (해요체 or 합니다체) and reads
as if it was written in Korean first. Everything above holds in Korean too.
Neither the journal nor the web guide is the model. The journal is a diary,
and the guide's Korean was carried over from its English sentence by
sentence. The marks of carried-over Korean, as two published Korean editing
skills list them (DaleSeo's
[humanizer](https://github.com/DaleSeo/korean-skills/tree/main/skills/humanizer)
and epoko77-ai's [Humanize KR](https://github.com/epoko77-ai/im-not-ai)):

- English prepositions turned into particles: `~에 대해`, `~를 통해`,
  `~에 있어서`, `~에 의해`. The plain particle or the verb says it.
- An English verb on a subject that is not a person. "드라이버 IC가
  결정해요" is "the driver IC decides".
- `가지고 있다` for have, and `~되어지다` for a passive that `~되다`
  already is.
- `~할 수 있다` where the sentence can simply say the thing.
- A noun doing a verb's work: `확인을 진행해요` for `확인해요`.
- Pronouns and plurals the sentence does not need: `그`, `그것`, `이러한`,
  `-들`.
- A comma wherever English would put one. Korean uses fewer
  ([KatFishNet](https://aclanthology.org/2025.acl-long.1030/), ACL 2025).

Two of the guide's lines in English and in Korean, then the same thing
written in Korean:

> Its driver IC decides, not “HUB75E” in the title.
>
> 제목의 ‘HUB75E’가 아니라 드라이버 IC가 결정해요.
>
> 패널이 켜질지는 제목의 ‘HUB75E’가 아니라 드라이버 IC에 달려 있어요.

> Take $100 as the floor, not the estimate
>
> 100달러는 예상치가 아니라 바닥이에요.
>
> 100달러는 아무 문제 없이 끝났을 때 드는 돈이에요. 보통은 더 들어요.

Words that never go in are in [voice-banned.txt](voice-banned.txt), one per
line. The maintainer adds to it, and `check:voice` reads it from there once
it lands ([rfc-cleanup.md §2.10](rfc-cleanup.md#210-writing-voice)). A
sentence that needs one of them to stand up is a sentence to cut.
