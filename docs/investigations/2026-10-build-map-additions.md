# What the build map could add

*Scouted on 18 October 2026 at `c830467` on `dev`, from the journal, the live
site, the community Workshop and the remix folders. Nothing here is
implemented. [`builds.ts`](../../web/src/components/sections/InsideGlobe/builds.ts)
stays as it is until the photos and dates in the last column arrive.*

## What a pin is now

The map at [patternflow.work/inside](https://patternflow.work/inside) has 18
pins in 12 countries. Each is one entry in `builds.ts`, with its photos in
`web/public/builds/<slug>/`. An entry has a `kind` and a `category`, and they
answer different questions.

The kind is what the pin claims. `build` is a Patternflow someone put
together, `collaboration` is a separate work made with Patternflow, and `sold`
is a unit sold as a work. The category is the filter it sits under: Builds,
Projects or In use. Fifteen pins are builds. Two are projects, day's Raspberry
Pi port and Azmano's MOTIFLOW. One is in use, the first sale in San Francisco.

A pin's place is as precise as the maker made it: a city label gets the
city's coordinates, a country label the country's centre. Pins on one spot
draw as a single pin with a count
([`groups.ts`](../../web/src/components/sections/InsideGlobe/groups.ts)), so a
second pin in Seoul is no problem. The slug is maker then region, and a second
pin for the same maker in the same region needs a slug of its own
(`simonepda-uae` is taken). The date is a month.

Only `build` pins join the web of lines between pins, the web that shows how
far Patternflow has spread (`webArcs` in
[`Globe.tsx`](../../web/src/components/sections/InsideGlobe/Globe.tsx)). A
collaboration or a sale gets one line back to the pin it came from.

## A pin for a showing

None of the three kinds fits an exhibition of a unit from Seoul. Filed as
`build`, the *Anbu* exhibition (A1) joins the spread web and counts as
Patternflow reaching somewhere new, when it is the maintainer's own unit a few
kilometres from the first pin. `collaboration` fits *Anbu* itself, because its
patterns were made from the artists' works. It does not fit the Hongdae night
(A2) or the course exhibition (A3).

The smallest change is a fourth kind for a unit shown somewhere, drawn the way
`sold` is: its own pin shape, a line back to its origin, filtered under In use.
That touches `BuildKind` in `builds.ts` and `PinBody` in `Globe.tsx`, and it is
the maintainer's call. Without it, A1 to A3 can go in as `in-use` with kind
`build`, and the web gets three strands it should not have.

## The maintainer's shows and use

| | What | Seen at | On the map | Send |
| :--- | :--- | :--- | :--- | :--- |
| A1 | *Anbu* (「안부」), an exhibition by visually impaired artists at Modu Art Space near Seoul Station. Patternflow was not the exhibit. It was a corner where visitors played the artists' paintings, illustrations and sculptures as patterns: one knob picks the work, three play it, and the sound follows the knobs, through the maintainer's build of Simone's flowlocal and a laptop running Ableton. Opened 3 October 2026, with an opening event on Sunday the 4th. Taken down by 13 October. | Journal: [the-messy-desk](https://patternflow.work/journal/the-messy-desk) (the plan), [a-strange-feeling](https://patternflow.work/journal/a-strange-feeling), [all-jumbled-up](https://patternflow.work/journal/all-jumbled-up), [fine](https://patternflow.work/journal/fine) (on the site, not yet in this tree; it calls it 서울역 전시). [README](../../README.md) timeline, October 2026. | New pin, `in-use`, Seoul, 2026-10. Kind: see [A pin for a showing](#a-pin-for-a-showing). | Photos of it on show, with people playing if any were taken (the *fine* post has one, "서울역 전시, 철거 전"). The closing date. Whether to name the space, the exhibition and the artists, and their OK. How the pin credits it: Seunghun LEE, or the artists with him. The exhibition's own page, if it has one. |
| A2 | A DJ night in an LP bar in Hongdae, the day after the *Anbu* opening. A Patternflow with the microphone fitted stood by the turntables and played to the sound, the first time the audio feature was used outside home. | Journal: [all-jumbled-up](https://patternflow.work/journal/all-jumbled-up), announced in [how-to-use-part-two](https://patternflow.work/journal/how-to-use-part-two) as a café. The post's photo is in the tree: [`turntable.jpg`](../../web/public/journal/all-jumbled-up/turntable.jpg). | New pin, `in-use`, Seoul, 2026-10. | The date. The bar's name, or an OK to leave it as "Hongdae, Seoul". The DJ's OK and how to name them. The photos and video from that night, with the credit line the photographer wants. Which edition it ran (Audio, presumably). |
| A3 | The exhibition of the Hongik course 작가적 디자인 스튜디오(1), June 2026. The written process was pinned up behind the unit. The unit died on day one, and that is how the SMD parts came off the board. | Journal: [refocus](https://patternflow.work/journal/refocus), with [`exhibition-process.jpg`](../../web/public/journal/refocus/exhibition-process.jpg). Roadmap node `biz-exhibition` (2026-06-15) in [`roadmap-data.ts`](../../web/src/app/roadmap/roadmap-data.ts). | New pin, `in-use`, Seoul, 2026-06. | Where it was shown (building or gallery). The dates (the post has it running on 19 June and coming down on Monday the 22nd). One or two photos of the wall. An OK to tell the day-one failure on the pin. |
| A4 | *USER EXPERIENCE*, the pop-up gallery in San Francisco the first sale went to. The unit is shown hands-on, and the show runs through SF Tech Week. | Pin `sf-swartz`. Journal: [good-but](https://patternflow.work/journal/good-but), [a-strange-dream](https://patternflow.work/journal/a-strange-dream), [fine](https://patternflow.work/journal/fine). | The existing pin, not a new one. Its text says the show "opens in October 2026" and needs the past tense once photos go on. | Photos of the unit in the gallery. The show's dates. The gallery's OK to use them. |
| A5 | A workshop at the Seoul Design Startup Center, planned. Parts for seven or eight units are on order for it. | Journal: [all-jumbled-up](https://patternflow.work/journal/all-jumbled-up), [fine](https://patternflow.work/journal/fine). | After it happens: a new pin, `in-use`, Seoul. Each unit someone takes home finished can be its own `build` pin. | The date, the number of people, photos, and each participant's OK. Nothing until it has happened. |
| A6 | The unit that lives at the Seoul Design Startup Center office ("사무실에 1개, 집에 2개"). | Journal: [all-over-the-place](https://patternflow.work/journal/all-over-the-place). | New pin, `in-use`, Seoul, if a unit in daily use is worth one. | A photo of it in the office, and a yes or no on the pin. |

## Units that went out

| | What | Seen at | On the map | Send |
| :--- | :--- | :--- | :--- | :--- |
| B1 | A unit sent to a studio near Philadelphia. Its owner is helping as a kind of ambassador and is to demo it at the Grammy Creator Summit. | Journal: [all-jumbled-up](https://patternflow.work/journal/all-jumbled-up). | New pin, USA. Kind `build` if it was a gift (the Paris pin set that precedent), `sold` if it was paid for. | The studio's or person's name and their OK. The city. The month it was sent. Gift or sale. After the summit: its date and photos of the demo. |
| B2 | A unit sent to an influencer in Spain, in the hope of an Instagram post before the campaign closed. | Journal: [fine](https://patternflow.work/journal/fine) only. | New pin, Spain, kind `build` (a gift), once the post is up. | The name or handle and their OK. The city. The month it was sent. A link to the post. |
| B3 | The three units built in September with the money from the first sale. | Journal: [how-to-use-patternflow](https://patternflow.work/journal/how-to-use-patternflow). | One pin for each that left Seoul. Some may already be A1, B1 or B2. | Where each of the three is now. |

## Builds by others

| | What | Seen at | On the map | Send |
| :--- | :--- | :--- | :--- | :--- |
| C1 | SimonePDA's laser-cut case, cut three times in clear acrylic and in MDF. The pin `uae-simonepda` (July 2026) shows his earlier build in a dark printed case. | [`simonepda-lasercut/README.md`](../../hardware/case/remixes/simonepda-lasercut/README.md) (verified 2026-10-05), its tab on [/build](https://patternflow.work/build?case=simonepda-lasercut), the [README](../../README.md). Four photos in [`photos/`](../../hardware/case/remixes/simonepda-lasercut/photos/), CC BY-SA and already resized for the site in `web/public/cases/simonepda-lasercut/`. | New pin, `build`, `builds`, 2026-10, linking the remix folder and the /build tab. A second pin rather than more photos on the first: it is another build, months later, and a case anyone can cut. | Ajman or Dubai: the pin says Ajman, the journal ([how-to-use-part-two](https://patternflow.work/journal/how-to-use-part-two)) says Dubai. An OK to reuse the four remix photos, and a photo of it lit if he has one. The month of the first cut. A line from Simone, if he wants one. |
| C2 | Besoiobiy's printed case, the second enclosure remix: a frame and a box glued side by side, PATTERNFLOW lettered down the box. No pin. | [`besoiobiy-printed/README.md`](../../hardware/case/remixes/besoiobiy-printed/README.md) (verified 2026-10-08), its tab on [/build](https://patternflow.work/build?case=besoiobiy-printed). One photo of the built case, [`photo_built.jpg`](../../hardware/case/remixes/besoiobiy-printed/images/photo_built.jpg). | New pin, `build`, `builds`, 2026-10, linking the remix folder and the /build tab. | Where it is, as a city or a country: the README does not say, and an order on aliexpress.ru is not a location. How Besoiobiy wants to be named. Two or three more photos, lit. A line from them, and their OK. |
| C3 | @zhu0ran's bridge that streams a TouchDesigner TOP to the panel at 64 × 32 and sends the knobs back over OSC. | Community Workshop, Connect channel: [Touch Designer to Patternflow](https://community.patternflow.work/community/workshop/c0/t/f9562f0b4bdf4c3b), 9 August 2026. | New pin, `projects`, like day's port. If @zhu0ran is Zhuoran, the first collaborator who has the Paris unit, it goes in Paris and can hang off `paris-v1`. | Whether @zhu0ran is Zhuoran. A photo or clip of a TouchDesigner frame on the panel. The place. Their OK. |
| C4 | Simone's MQTT link, tested between his unit in Dubai and the maintainer's in Seoul: a knob turned in Dubai changed the panel in Seoul. With it, his flowlocal, a box that gives a Patternflow its own hotspot. *Anbu* ran on the maintainer's build of one. | Journal: [how-to-use-part-two](https://patternflow.work/journal/how-to-use-part-two), [the-messy-desk](https://patternflow.work/journal/the-messy-desk), with a photo of the maintainer's own flowlocal, [`flowlocal.jpg`](../../web/public/journal/the-messy-desk/flowlocal.jpg). | New pin, `collaboration`, `projects`, in Dubai, with its line back to Seoul. Better after flowlocal is published. | Whether flowlocal is public yet. Simone's OK. A photo of his box. The month. |
| C5 | The breadboard build: the same electronics on jumper wires, no board order. The guide's eight photos are its record. | [/build/breadboard](https://patternflow.work/build/breadboard), photos in [`web/public/builds/breadboard/`](../../web/public/builds/breadboard/) (the page is dated 28 June 2026). | New pin, `build`, `builds`, Seoul, 2026-06, linking the guide. | A yes or no: it is the guide's build, not a unit that went anywhere. Which photo leads (`step8.jpg`, "It's alive!", is the lit one). |
| C6 | Builds shared on Discord that have no pin. The journal counts about 50 builders from 64 panel orders, and about 10 who shared a build ([its-a-failure](https://patternflow.work/journal/its-a-failure), 1 September), and more have been posted since ([all-jumbled-up](https://patternflow.work/journal/all-jumbled-up)). Leads: cartoonmonkeystudio (CE), who debugged the Wi-Fi on their own unit in August ([the investigation](2026-08-the-panel-clock-and-the-wifi-radio.md)); a black Patternflow on an Instagram story on 11 July ([worn-out](https://patternflow.work/journal/worn-out), perhaps Enerjoy's); a two-layer tracing-paper diffuser on 29 May ([today-is-my-birthday](https://patternflow.work/journal/today-is-my-birthday), perhaps shooter's). | Discord, which this scout cannot read. | One `build` pin each. | For each build on Discord that has no pin: the name the maker wants, the place, the month, two or three photos and their OK. |

## Pins that already exist and can take more

| | What | Seen at | On the map | Send |
| :--- | :--- | :--- | :--- | :--- |
| D1 | MOTIFLOW has been shown in a gallery and played at several events since the pin went up. | [README](../../README.md) ("shown in a gallery and played at events since"), journal [how-to-use-part-two](https://patternflow.work/journal/how-to-use-part-two). | The pin `iran-azmano`: a sentence and a photo. | The gallery and the events, with dates, and a photo from Azmano. |
| D2 | mbchars' pin links nowhere, while his case is the third remix in this repo and a tab on /build. | Pin `ukraine-mbchars`, [`mbchars-horizontal-desktop-printed/`](../../hardware/case/remixes/mbchars-horizontal-desktop-printed/README.md). | Two links on the pin: the remix folder and [/build?case=mbchars-horizontal-desktop-printed](https://patternflow.work/build?case=mbchars-horizontal-desktop-printed). | Nothing. It can go in with any of the rows above. |

## Looked at and left out

- Press: the 14 pieces in the roadmap's media lane, Hackster.io in May to Midifan in September. They are about Patternflow, not places it is.
- The Nam June Paik Art Center (28 January) and the Gwangju Biennale. He went to look.
- Paris Fashion Week, planned for the Paris unit. It was never installed ([all-jumbled-up](https://patternflow.work/journal/all-jumbled-up)).
- Pitches and open calls: the Seoul Design Startup Center, SFAC, KAMS, the Lumen Prize, Art Korea Lab. None of them put a Patternflow in front of visitors.
- The museums that asked to buy in July, and the new museum in Istanbul. No names, and nothing closed.
- The interview and shoot for the project film at the Seoul Design Startup Center ([fine](https://patternflow.work/journal/fine)).
- Crowd Supply units. They ship after the campaign, and each becomes a pin when its owner shares it, the usual way.
- The XR club exhibition and the 2023 prototyping-class exhibition. Neither showed a Patternflow.
