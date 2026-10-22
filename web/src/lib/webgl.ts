// Whether this browser will give a page a WebGL 2 context. three.js draws
// with nothing less (WebGL 1 went in r163), so a canvas made where this is
// false throws as it makes its renderer. It is false where WebGL is turned
// off or the GPU is blocked.
//
// Asked once and kept. The guide's stage (components/guide/world/GuideWorld)
// and the home page's 3D view (components/3d/ViewerPanel) ask before they
// make a canvas. Only in the browser: the server has no document to ask.
let answer: boolean | null = null;

export function hasWebGL(): boolean {
  if (answer !== null) return answer;
  try {
    // (A 1×1 canvas nobody holds: its context goes with it.)
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    answer = !!probe.getContext("webgl2");
  } catch {
    answer = false;
  }
  return answer;
}
