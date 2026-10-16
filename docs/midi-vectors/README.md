# MIDI vectors

Each file here is one sentence of [midi-spec.md](../midi-spec.md) and the messages that show a panel doing it, written as [contract-vectors.md](../contract-vectors.md) sets out. `npm run check:midi-vectors` in `web/` replays every one against a fresh [virtual panel](../../tools/virtual-panel/README.md) built with the `midi` feature, and prints what the vector expects beside what the panel did. CI runs it on every pull request with the other drift checks. When the spec rewords a sentence a vector quotes, that vector fails until someone brings it along.

A file's name says which table of the spec it reads. `in-` is a row of *Host → device*, or the channel rule under it, and shows what the panel does with that message. `out-` is a row of *Device → host*, something the panel sends when a hand moves it. `/api/midi` is REST, so its vectors are in [rest-api-vectors](../rest-api-vectors/README.md) and start with `midi-`.

A message is its bytes, the status and then its data. `[176, 24, 65]` is CC 24 at 65 on channel 1, `[144, 60, 127]` is note 60 on and `[192, 3]` is Program Change 3. Each one the vector sends goes in an RTP-MIDI packet of its own. What the panel sends is read back into the same form, one message to an entry, with running status filled in.

The suite brings the session. `web/scripts/drift/_rtpmidi.ts` is an initiator shaped like [`rtpmidi_probe.py`](../../tools/rtpmidi-probe/rtpmidi_probe.py). Before the first step it invites the panel on its control port and then on the data port after it, and syncs clocks once. After the last step it says `BY`.

The panel applies what has arrived at the end of a frame, and the pattern is given it on the next. So a vector gives a message 20 ms, a frame at 60 fps and a little more, before it looks. A hand does not take back a channel a CC wrote less than 250 ms before (`ABSOLUTE_RELEASE_GRACE_MS` in `core_bus.h`). That rule is the firmware's, not the spec's, and the REST vectors wait it out the same way: `in-cc-hold.json` holds the channel a second before the turn.

One vector keeps the spec where the firmware does something else. `in-ignored.json` sends CC 120, 121 and 123 while a note is held, and the firmware lets the note go on any of them (`core_midi.h`).

Some of the spec has no vectors. MIDI over USB needs the S3's OTG controller, and a Node process has no USB device side. The receive map both transports share is checked natively in CI by `midi_test.cpp`. A vector opens one session, so the limit of two participants is not replayed, and the virtual panel does not advertise itself over Bonjour. It does not reboot or run shows, so a Program Change remembered across a reboot and one a show ignores are not replayed either. Channel `0` is a build setting. CC 24 to 27 are sent only at 63, 64 and 65, where the spec's two readings of a relative value agree.
