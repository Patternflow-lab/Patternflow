/**
 * check:mqtt-vectors: docs/mqtt-vectors/ against a fresh virtual panel each
 * (docs/contract-vectors.md), and a broker of its own for each (_broker.ts).
 * HTTP, a hand and the clock are _vectors.ts's own.
 */
import { mqtt } from "./_broker";
import { done } from "./_lib";
import { replay } from "./_vectors";

replay("docs/mqtt-vectors", { mqtt }).then(done);
