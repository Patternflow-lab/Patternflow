import { useGLTF } from '@react-three/drei';
import type { CaseId } from '@/components/sections/build-cases-data';
import { CASE_MODELS, DRACO_DECODER } from './caseModels';

/**
 * Starts loading a case's model before it is picked — on a hover or a focus
 * of its tab — so the switch has it in drei's cache by the time the preview
 * asks. Only the official model loads with the page; a remix's loads on the
 * way to being chosen.
 */
export function preloadCaseModel(id: CaseId) {
  useGLTF.preload(CASE_MODELS[id].url, DRACO_DECODER);
}
