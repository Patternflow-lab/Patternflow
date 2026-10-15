/**
 * check:rest-vectors: docs/rest-api-vectors/ against a fresh virtual panel each
 * (docs/contract-vectors.md). REST needs no sender of its own: _vectors.ts
 * speaks HTTP, and a hand and the clock are HTTP too.
 */
import { done } from "./_lib";
import { replay } from "./_vectors";

replay("docs/rest-api-vectors").then(done);
