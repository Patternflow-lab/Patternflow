// Takes the LED panel out of the landing page's first model.
//
//   node extract_led.mjs <3dforweb.glb> [source/led_panel.glb]
//
// The old landing model (web/public/3dforweb.glb until the case models
// replaced it) was a v3.0 device; of all its parts only the LED panel, the
// node "l", is still used: its front face carries the UVs the pattern shaders
// draw on, and the guide places its own LED panel by it. This keeps that one
// node, unchanged (same name, same transform, same geometry), in a file of
// its own, so the case models and the guide can be rebuilt without the rest.
// It has been run once; source/led_panel.glb is its output.
import { prune } from '@gltf-transform/functions';
import { getIO, worldBounds, fmt } from './lib/io.mjs';

const [src, out = new URL('./source/led_panel.glb', import.meta.url).pathname] = process.argv.slice(2);
if (!src) {
  console.error('usage: node extract_led.mjs <3dforweb.glb> [out.glb]');
  process.exit(1);
}

const io = await getIO();
const doc = await io.read(src);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];
for (const node of scene.listChildren()) {
  if (node.getName() !== 'l') node.dispose();
}
const led = root.listNodes().find((n) => n.getName() === 'l');
if (!led) throw new Error(`no node "l" in ${src}`);
await doc.transform(prune());
doc.getRoot().getAsset().generator = 'patternflow tools/case-models/extract_led.mjs';
await io.write(out, doc);
const b = worldBounds(led);
console.log(`${out}: "l" world bounds ${fmt(b.min)} … ${fmt(b.max)}`);
