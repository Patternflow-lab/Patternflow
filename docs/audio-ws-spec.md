# Patternflow audio WebSocket — wire protocol

The low-latency path for driving the four knobs from a stream of levels:
browser-tab audio through the Chrome extension today, anything that can open
a WebSocket tomorrow. This document is the contract, the way
[`osc-spec.md`](osc-spec.md) is for OSC and [`rest-api.md`](rest-api.md) is
for HTTP — clients build against this file, not against the firmware source.

Carried by the **audio feature** (Audio edition), so probe before assuming:
`GET /api/status` lists `"audio"` in `caps` when this server exists. The
default build does not have it, and connecting anyway just fails.

## Transport

| | |
|---|---|
| URL | `ws://<host>:81/` — plain WebSocket, no TLS, no subprotocol, no auth beyond being on the LAN (the same trust model as the rest of the device). |
| Port | `81` (`PF_AUDIO_WS_PORT`). The HTTP API stays on 80. |
| Frames | Text, one message per frame, ASCII. |
| Direction | Client → device only. The device sends nothing; read device state over HTTP. |
| Clients | Multiple connections are accepted; last write wins per knob. In practice: one. |

## Messages

| Message | Meaning |
|---|---|
| `a=F,F,F,F` | Set all four lanes at once, each `0..1`. A literal `-` in a slot leaves that lane untouched: `a=0.8,-,-,0.2`. **The message to use for continuous streams.** |
| `k=N,v=F` | Set lane `N` (0..3) to `F` (clamped to `0..1`). |
| `d=N,v=F` | Add a normalized delta `F` (−1..1) to knob `N` — encoder-style motion rather than a level. |
| `off=N` | Release knob `N` back to encoder control. |
| `off` | Release all four. |

Anything else is **silently ignored** — that is the compatibility rule. A new
message type is a new prefix, old firmware drops it, and nothing breaks.

## Semantics — what a "lane" is

`a=` and `k=` drive the **lane**: an absolute, continuous reading the pattern
receives lerped into each parameter's own declared range. It is the same
mechanism the weather feature and the on-board microphone use. Priority per
knob, highest first (see `abi/pf_params.h`):

1. the absolute bus (`POST /api/params`, OSC/MQTT absolute, shows) — exact
   0..1000 set-points;
2. **the lane** — what this protocol writes;
3. encoder deltas.

**Hands always win.** A physical turn of an encoder takes that knob back and
holds it for five seconds; keep streaming and the lane resumes when the hold
expires. `off` is the polite way to leave — send it on disconnect so the
knobs are not parked at your last values (the firmware also releases lanes
when the socket closes).

## Why `a=` exists — pacing a one-connection server

The device is small; treat the socket as having room for exactly one
in-flight message. Check `bufferedAmount === 0` before each send and drop
the frame otherwise — never queue. Four `k=` messages per frame is how this
was learned: after the first send the buffer is never empty, lanes 1..3
dropped in index order, and knob 4 never moved. One `a=` per frame carries
everything, in order, at a quarter of the traffic.

Send at your analysis rate. The extension analyses on a 33 ms timer, so thirty
messages a second is its ceiling and not its rate: a frame equal to the last
one is not sent again at once, and one is dropped while another is in flight.
Measured against a loopback socket, it sends 23–26 a second on music and 5 a
second while nothing changes (the resend described next).

## Holding a value — the 500 ms release

**A lane is handed back to its encoder 500 ms after the last message that
set it.** That is what frees the knobs when a tab is closed or a phone walks
out of range without saying `off`, and it has been in the firmware since the
first version of this protocol. Version 1 of this document said there was no
keep-alive requirement, and that was wrong: a client that skips a frame
because its values did not change loses its lanes half a second into any
steady passage — silence, a paused track, a gate curve resting at one level —
and the next thing it sends starts the pattern's motion from wherever the
encoder had left the knob.

So a client that means to keep driving **resends its last message at least
every 250 ms**, changed or not. The same goes for `k=`. To let go, stop
sending, or say `off`.

### What the senders in this tree do

**The extension holds.** A frame that has not changed goes out again once
180 ms have passed since the last one, which on its 33 ms timer comes to about
210 ms (measured: five messages a second, no gap longer than 223 ms). While
its tab is silent or paused the knobs therefore rest where each band rests,
and stay there until Stop; the sliders of the popup's *Test without audio* are
held the same way. Two things follow from holding. A knob turned by hand
during a pause goes back to its resting value when the five-second hold ends.
And on a panel whose microphone is also switched on, the microphone does not
get those lanes during the pause: it only drives a lane nobody else has.

A band muted in the extension's editor is a `-` in its slot, and the lane it
had been driving is handed back at once with `off=N` instead of being left to
the timeout; with all four muted it sends four `off=N` and then nothing. Stop
sends `off` and closes the socket. A socket that reopens is told everything
again in its first frame. Everything the extension sets, it sets with `a=`,
the test sliders included (`a=0.800,-,-,-`, a `-` for each knob nobody has
moved). Nothing in this tree sends `k=` or `d=` any more; both stay in the
table above and the firmware takes both, for earlier builds of the extension
and for clients outside this tree.

**The Android capture app does not hold yet.**
`tools/patternflow-audio-android` still has the change-only skip the
extension had (`sendLanes()` in `DeviceLink.kt`: `if (body == lastBody)
return`). Its lanes are released 500 ms into a pause or a steady passage, and
the next frame it sends starts from wherever the encoders, or the microphone,
left the knobs. For whoever maintains the app: keep the time of the last send
beside `lastBody` and send the same body again when 250 ms have passed. It
already forgets `lastBody` when the socket opens. This was outside the change
that corrected this document, and it is the thing to fix before filming a
track with a quiet passage in it.

## The switch on the panel

The device accepts the connection, and every message, whether or not
Audio-React is switched on (the `AUD` row of the panel's NETWORK screen;
`audioRuntime` in `GET /api/audio` and `/api/status`). Switched off, the
messages are parsed and nothing is driven — an open socket is not evidence
that the panel is listening. A client that wants to know reads
`audioRuntime` over HTTP, on port 80 of the same host whatever port its
socket uses ([`rest-api.md`](rest-api.md#audio-react-audio-edition)).

The extension asks once each time its socket opens (`GET /api/audio`, four
seconds to answer), and once more each time its popup is opened while the
socket is open. `false` is shown as *Aud off* with a **Turn on** button, which is
`POST /api/audio` with `on=1`; no answer, or a `404` from firmware without the
route, is "not known" and nothing is claimed either way. It does not poll:
the panel serves one HTTP connection at a time.

## Version history

- **1.1** (unreleased) — no change on the wire, and nothing for the firmware
  to do: old and new firmware behave the same. Written down: a lane is
  released 500 ms after its last message, so a steady value has to be resent
  (version 1 said no keep-alive was needed); the extension's timer is 33 ms,
  not the animation frame, and thirty a second is its ceiling; the socket
  accepts messages while Audio-React is switched off and ignores them. The
  extension (0.2.0) now keeps to it: it resends an unchanged frame, hands a
  muted band's lane back with `off=N`, sends its test sliders as `a=`, and
  asks the panel over HTTP whether it is listening. The Android app does not
  resend yet.
- **1** — first written contract: `a=` / `k=` / `d=` / `off=N` / `off`,
  lane semantics, the unknown-prefix rule, the one-in-flight pacing rule.
  Matches firmware 3.8.0 (Audio edition v0.3.1 onward) and the extension as shipped in
  `tools/patternflow-audio-extension/`.
