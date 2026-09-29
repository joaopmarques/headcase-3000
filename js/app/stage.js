// Renderer, scene, camera, lights, and the camera fit.
import * as THREE from 'three';
import { FX } from '../fx.js';
import { Vomit } from '../vomit.js';
import { Nuke } from '../nuke.js';
import * as samples from '../samples.js';
import * as sfx from '../audio.js';
import { $, app } from './ctx.js';

// ---------- scene ----------
const canvas = $('#c');
const stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.25, 6.4);
camera.lookAt(0, 0.3, 0);

scene.add(new THREE.HemisphereLight(0xfff4e8, 0x553366, 1.4));
const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(2.5, 3, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xff3ea5, 2.0);
rim.position.set(-4, 2, -3);
scene.add(rim);
const rim2 = new THREE.DirectionalLight(0x00e5ff, 1.6);
rim2.position.set(4, -1, -3);
scene.add(rim2);
const discoLights = [0xff0066, 0x00ffcc, 0xffee00].map((c) => {
  const l = new THREE.PointLight(c, 0, 12);
  scene.add(l);
  return l;
});

// Shadow blob, because floating heads still deserve grounding.
const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -2.0;
scene.add(shadow);

const rig = new THREE.Group();
scene.add(rig);
const fx = new FX(scene);
const vomit = new Vomit(scene);
const nuke = new Nuke(scene);
// Recorded samples load after the first tap (browsers need a gesture for audio anyway).
window.addEventListener('pointerdown', () => { sfx.unlock(); samples.loadSamples(); }, { once: true });
vomit.onSplat = () => sfx.puddleSplat();

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return; // hidden window: keep the last good size until it shows again
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Fit the head into the open space between the ticker and the tool bar.
  const uiTop = 40, uiBottom = w < 700 ? 140 : 170;
  const avail = Math.max(0.4, (h - uiTop - uiBottom) / h);
  const k = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.z = Math.max(2.8 / (k * avail * 0.8), 2.4 / (k * camera.aspect * 0.62));
  camera.userData.baseZ = camera.position.z;
  // Nudge the view so the head sits in the middle of that space.
  const lift = Math.round((uiBottom - uiTop) / 2);
  camera.setViewOffset(w, h, 0, lift, w, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

export { canvas, stage, renderer, scene, camera, key, rim, rim2, discoLights, shadowTex, shadow, rig, fx, vomit, nuke, resize };
