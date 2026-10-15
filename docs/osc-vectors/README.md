# OSC vectors

Each file here is one sentence of [osc-spec.md](../osc-spec.md) and the messages that show a panel doing it, written as [contract-vectors.md](../contract-vectors.md) sets out. `npm run check:osc-vectors` in `web/` replays every one against a fresh [virtual panel](../../tools/virtual-panel/README.md) built with the `osc` feature, and prints what the vector expects beside what the panel did. CI runs it on every pull request with the other drift checks. When the spec rewords a sentence a vector quotes, that vector fails until someone brings it along.

A file's name says which table of the spec it reads. `in-` is a row of *Host → device*, or the transport rules every message obeys, and shows what the panel does with that message. `out-` is a row of *Device → host*, something the panel sends without being asked.

A message is its address and then its arguments. A whole number goes on the wire as an `int32`, any other number as a `float32` and text as a string, so `["/patternflow/knob/1/delta", 2.6]` sends a float. `["#bundle", ["/patternflow/ping"]]` is a bundle with a ping in it, its time tag set to "immediately". What the panel sends is read back into the same form. The suite sends from one UDP socket. A device answers on port 9000, and the virtual panel, started with `oscReply` at 0, answers to the port the message came from.

The panel reads what has arrived at the end of a frame and answers in that frame. A knob delta reaches the pattern a frame after it is read. So a vector gives each message 50 ms, three frames at 60 fps, before it looks.

Some of the spec has no vectors. The virtual panel has no radio, so the announce on Wi-Fi connect and `patternflow.local` are not replayed. A vector talks from one address, so neither is a host that changes. A knob a lane is moving is not reported, and a panel built with `osc` alone has no lane to move one.
