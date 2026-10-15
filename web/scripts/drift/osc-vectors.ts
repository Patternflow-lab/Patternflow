/**
 * check:osc-vectors: docs/osc-vectors/ against a fresh virtual panel each
 * (docs/contract-vectors.md), built with the osc feature. The sender is
 * _osc.ts, one UDP socket a vector.
 */
import { done } from "./_lib";
import { osc } from "./_osc";
import { replay } from "./_vectors";

replay("docs/osc-vectors", { osc }).then(done);
