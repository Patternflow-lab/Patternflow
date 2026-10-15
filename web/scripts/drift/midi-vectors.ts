/**
 * check:midi-vectors: docs/midi-vectors/ against a fresh virtual panel each
 * (docs/contract-vectors.md), built with the midi feature. The sender is
 * _rtpmidi.ts, one RTP-MIDI session a vector.
 */
import { done } from "./_lib";
import { midi } from "./_rtpmidi";
import { replay } from "./_vectors";

replay("docs/midi-vectors", { midi }).then(done);
