# MQTT vectors

Each file here is one sentence of [mqtt-spec.md](../mqtt-spec.md) and the steps that show a panel doing it, written as [contract-vectors.md](../contract-vectors.md) sets out. `npm run check:mqtt-vectors` in `web/` replays every one against a fresh [virtual panel](../../tools/virtual-panel/README.md) built with the `mqtt` feature, and prints what the vector expects beside what the panel did. CI runs it on every pull request with the other drift checks. When the spec rewords a sentence a vector quotes, that vector fails until someone brings it along.

A Patternflow is a broker's client, so the suite brings the broker. `web/scripts/drift/_broker.ts` starts one for each vector on a free port. It speaks MQTT 3.1.1 at QoS 0 and keeps retained messages, and a topic matches only itself. Before the first step the suite points the panel at it with `POST /api/mqtt`, host and port only, which leaves the role off. A vector picks the role in its first step, `POST /api/mqtt?role=subscriber` for one, and the panel dials on its next frame, so a `wait` comes next. A message the vector sends is `{ "topic": "patternflow/sleep", "payload": "1" }`, with `"retain": true` to keep it on the broker. It reaches the panel only on a topic the panel subscribed to, as on any broker. `out` is each message the panel published, with its `retain` flag beside the topic and payload.

A file's name starts with the part of the spec it reads. `topics-` is the topic table and the two roles, and `channels-` is the channels and the snapshot. `/api/mqtt` is REST, so its vectors are in [rest-api-vectors](../rest-api-vectors/README.md) and start with `mqtt-`.

The banner a `message` puts up is read with `GET /vp/mqtt`. That route is the virtual panel's own. The firmware has none, and `/frame.png` does not draw the banner.

Two vectors keep the spec where the firmware does something else. `topics-param.json` empties `param/3` 20 ms after writing it, and the firmware keeps a channel written in the last 250 ms (`ABSOLUTE_RELEASE_GRACE_MS` in `core_bus.h`). `topics-knob.json` sends a count 27 past the one before, and the firmware cuts that to 16 (`KNOB_PENDING_FLUSH` in `core_mqtt.h`).

Some of the spec has no vectors. The Director's topics (`query`, `select`, `select/ack`) are for one tool, and every other client ignores them. How soon a panel dials again after losing its broker is the firmware's to decide, not the spec's. The broker takes any user and password, so a refused login is not replayed.
