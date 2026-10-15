# Contract vectors

A vector is one sentence from a contract and the steps that show a panel doing what it says. Each is a JSON file in a folder beside its spec: `rest-api-vectors/` for [rest-api.md](rest-api.md), and `osc-vectors/`, `midi-vectors/`, `mqtt-vectors/` and `audio-ws-vectors/` for the other four. Each folder has a suite in `web/scripts/drift/`, run as `npm run check:rest-vectors` in `web/` and the same way for the other four. It gives every vector a fresh [virtual panel](../tools/virtual-panel/README.md) and prints what the vector expects beside what the panel did. [`pfst-v2-vectors/`](pfst-v2-vectors/) came first and works differently: three `.pfs` files and a table in its spec.

```json
{
  "contract": "docs/rest-api.md#post-apisleep",
  "says": "`sleep` is the state **before** the transition — the request is only queued here.",
  "features": [],
  "steps": [
    { "send": { "http": "POST /api/sleep?on=1" }, "expect": { "reply": { "status": 200, "body": { "ok": true, "sleep": false } } } },
    { "send": { "wait": 20 }, "expect": { "status": { "sleep": true } } }
  ]
}
```

`contract` is the spec and the heading the sentence sits under, written the way a link to it is. `says` is the sentence, copied out of the spec. Markdown and line breaks do not count, every word does. When the spec rewords it, the vector fails until someone brings it along. `features` are the features the panel is built with, by their directories in `firmware/patternflow/features/`, and `[]` is the default build. A REST vector for the Audio edition's routes names `audio` there.

## Steps

Each step sends one thing:

| send | |
| --- | --- |
| `http` | `"POST /api/sleep?on=1"`, or `{ "request": "POST /api/sleep", "form": "on=1", "headers": { "Host": "patternflow.local" } }` |
| `hand` | `{ "knob": 2, "turn": -3 }` turns knob 2 three detents back. `{ "knob": 4, "down": true }` presses its button, and `false` lets go |
| `wait` | `500` moves the panel's clock 500 ms |
| `osc`, `midi`, `mqtt`, `ws` | a message on that transport, written as in the examples below; the suite's sender puts it on the wire |

The clock stands still between steps. Only `wait` and `out` move it, so a 500 ms release costs no real time. Knobs count from 1, as every contract does.

A step can then expect four things, each read once the step is over. `reply` is what the send answered: `status`, `headers` with their names in lower case, and `body`, parsed when it is JSON. `status` is `GET /api/status`. `input` is the panel's `/vp/state`, the knob deltas and presses the running pattern has been given since start, its name card and the first error it threw. A delta that comes over OSC or MIDI never shows in `knobs`, which counts a hand's clicks, so `input` is where it shows. `out` is what the panel sent.

## Shapes

An expectation is a shape. A literal has to be equal. `"<number>"`, `"<integer>"`, `"<string>"`, `"<boolean>"`, `"<array>"`, `"<object>"` and `"<any>"` stand for any value of that type. An object names the keys it needs and lets the others pass, as rest-api.md asks of every client; `"<absent>"` as a key's value forbids the key. An array has to be as long as its shape, and each element is a shape of its own.

## What the panel sends

`out` is a list. Each entry names one transport and a message, and the messages are matched in order on each transport. `{ "osc": ["/patternflow/version", "<string>"], "after": 29, "within": 30 }` is that message, sent later than 29 ms and no later than 30 ms after the step's send. `within` is the step's own length when it is left out: the `wait`, or 0 for anything else. Before reading anything the clock runs on to the last `within`, and it stops at every `after` and `within` on the way, so a message is timed to the window it falls in. `"<absent>"` in place of a message is silence on that transport for the window.

OSC, a ping and the start of the announce it is answered with. A message is its address and then its arguments:

```json
{ "contract": "docs/osc-spec.md#host--device", "features": ["osc"],
  "says": "Learn/refresh sender as the remote host and reply with a full announce (hello, version, ip, pattern index/name, modes).",
  "steps": [{ "send": { "osc": ["/patternflow/ping"] }, "expect": { "out": [{ "osc": ["/patternflow/hello", "Patternflow"], "within": 50 }] } }] }
```

MIDI, a relative CC reaching the pattern. A message is its bytes, and 176 is a control change on channel 1:

```json
{ "contract": "docs/midi-spec.md#host--device", "features": ["midi"],
  "says": "`64` = no motion, `65` = +1 detent, `63` = −1",
  "steps": [{ "send": { "midi": [176, 24, 65] } }, { "send": { "wait": 20 }, "expect": { "input": { "given": { "deltas": [1, 0, 0, 0] } } } }] }
```

MQTT, sleep from home automation. A message is a topic and a payload:

```json
{ "contract": "docs/mqtt-spec.md#topics", "features": ["mqtt"],
  "says": "Publishing `1` to `<prefix>/sleep` puts the panel to sleep, `0` wakes it, and `sleep/state` mirrors the result",
  "steps": [{ "send": { "mqtt": { "topic": "patternflow/sleep", "payload": "1" } },
    "expect": { "out": [{ "mqtt": { "topic": "patternflow/sleep/state", "payload": "1" }, "within": 50 }], "status": { "sleep": true } } }] }
```

The audio WebSocket, two lanes let go half a second after the last message. A message is the frame's text:

```json
{ "contract": "docs/audio-ws-spec.md#holding-a-value--the-500-ms-release", "features": ["audio"],
  "says": "A lane is handed back to its encoder 500 ms after the last message that set it.",
  "steps": [{ "send": { "http": "POST /api/audio?on=1" } }, { "send": { "ws": "a=0.8,-,-,0.2" } },
    { "send": { "wait": 400 }, "expect": { "status": { "laneActive": [true, false, false, true] } } },
    { "send": { "wait": 200 }, "expect": { "status": { "laneActive": [false, false, false, false] } } }] }
```

## Spec, not firmware

A vector follows its spec. Where the firmware does something else, the vector keeps the spec, and the pull request that adds it lists the firmware line for an issue. Where the spec contradicts itself, the vector follows the section that defines the route or the message. Where the spec says nothing, how OSC rounds 2.5 for one, there is no vector.

A suite brings a `Sender` for each transport other than HTTP, in a file of its own whose name starts with `_`. For each vector it opens a channel that sends a step's message and keeps a list of what the panel sent back. `_vectors.ts` does the rest, and it does not change once its suites rely on it.
