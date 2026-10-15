/**
 * check:audio-vectors: docs/audio-ws-vectors/ against a fresh virtual panel each
 * (docs/contract-vectors.md), built with the audio feature. The sender is
 * _ws.ts, one WebSocket a vector.
 */
import { done } from "./_lib";
import { replay } from "./_vectors";
import { ws } from "./_ws";

replay("docs/audio-ws-vectors", { ws }).then(done);
