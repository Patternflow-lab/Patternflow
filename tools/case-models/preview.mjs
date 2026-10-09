// Renders a case model from four sides into one PNG, to look at what a script
// made without starting the site.
//
//   node preview.mjs <model.glb> <out.png> [--explode]
//
// Needs the web app's dependencies installed (it borrows three.js and the
// Draco decoder from web/node_modules) and Playwright with a Chromium
// (`npm i -g playwright`, or NODE_PATH pointing at one). Views: front, back,
// three-quarter front, and the right side. With --explode every top-level
// node is pushed away from the model's centre along z by its order, so
// stacked parts can be told apart.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const args = process.argv.slice(2);
const explode = args.includes('--explode');
const [modelArg, outArg] = args.filter((a) => !a.startsWith('--'));
if (!modelArg || !outArg) {
  console.error('usage: node preview.mjs <model.glb> <out.png> [--explode]');
  process.exit(1);
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require('playwright');
  } catch {
    const globalRoot = execSync('npm root -g').toString().trim();
    return require(path.join(globalRoot, 'playwright'));
  }
}

const model = fs.readFileSync(path.resolve(modelArg));
const THREE_DIR = path.join(REPO, 'web/node_modules/three');

const page = /* html */ `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#f3f1ec}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
const W = 640, H = 640;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W * 2, H * 2);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#f3f1ec');
scene.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.6));
const key = new THREE.DirectionalLight('#ffffff', 2.2); key.position.set(3, 4, 6); scene.add(key);
const rim = new THREE.DirectionalLight('#dde8ff', 0.8); rim.position.set(-4, 2, -5); scene.add(rim);
const draco = new DRACOLoader(); draco.setDecoderPath('/three/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader(); loader.setDRACOLoader(draco);
loader.load('/model.glb', (gltf) => {
  const root = gltf.scene;
  // The LED panel lit, so it reads as a panel, not a black slab.
  const led = root.getObjectByName('l');
  if (led) led.material = new THREE.MeshBasicMaterial({ color: '#3f6fd8' });
  if (${explode}) {
    root.children.forEach((c, i) => { c.position.z += (i - root.children.length / 2) * 1.2; });
  }
  scene.add(root);
  const box = new THREE.Box3().setFromObject(root);
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const views = [
    [0, 0, 1], [0, 0, -1], [0.7, 0.35, 0.8], [1, 0, 0],
  ];
  views.forEach((d, i) => {
    const cam = new THREE.PerspectiveCamera(30, 1, r / 100, r * 100);
    const dir = new THREE.Vector3(...d).normalize();
    cam.position.copy(c).addScaledVector(dir, r / Math.tan(THREE.MathUtils.degToRad(15)) * 1.05);
    cam.up.set(0, 1, 0);
    cam.lookAt(c);
    const x = (i % 2) * W * 2 / 2, y = (1 - Math.floor(i / 2)) * H * 2 / 2;
    renderer.setViewport(x / renderer.getPixelRatio(), y / renderer.getPixelRatio(), W, H);
    renderer.setScissor(x / renderer.getPixelRatio(), y / renderer.getPixelRatio(), W, H);
    renderer.render(scene, cam);
  });
  document.title = 'ready';
}, undefined, (e) => { document.title = 'error: ' + e.message; });
</script></body></html>`;

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(page);
  }
  if (url === '/model.glb') {
    res.writeHead(200, { 'content-type': 'model/gltf-binary' });
    return res.end(model);
  }
  if (url.startsWith('/three/')) {
    const file = path.join(THREE_DIR, url.slice('/three/'.length));
    if (!file.startsWith(THREE_DIR) || !fs.existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type });
    return res.end(fs.readFileSync(file));
  }
  res.writeHead(404);
  res.end();
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const tab = await browser.newPage({ viewport: { width: 1280, height: 1280 }, deviceScaleFactor: 1 });
  tab.on('pageerror', (e) => console.error('page error:', e.message));
  await tab.goto(`http://127.0.0.1:${port}/`);
  await tab.waitForFunction(() => document.title !== '', null, { timeout: 120000 });
  const title = await tab.title();
  if (title !== 'ready') throw new Error(title);
  await tab.locator('canvas').screenshot({ path: path.resolve(outArg) });
  console.log(`wrote ${outArg}`);
} finally {
  await browser.close();
  server.close();
}
