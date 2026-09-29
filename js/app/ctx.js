// Shared context: DOM helpers, the live state, and the `app` object every module shares.
// Modules only import this file and stage.js, never each other, so there are no import cycles.
// A module that other modules need registers its functions on `app` (see the end of each file).
import * as THREE from 'three';
import { Spring } from '../shape.js';

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => [...document.querySelectorAll(s)];
export const rnd = (a, b) => a + Math.random() * (b - a);
export const now = () => performance.now();

// Things that change as you play: the current head, its props and paint layer, the pump timer.
export const app = { head: null, props: null, painter: null, pumpTimer: null };

export const st = {
  tool: 'poke',
  rage: 0,
  blush: 0,
  rot: { x: new Spring(0, 50, 6), y: new Spring(0, 40, 4), z: new Spring(0, 70, 5) },
  pos: { x: new Spring(0, 60, 7), y: new Spring(0, 90, 7) },
  scale: new Spring(1, 110, 8),
  mouse: new THREE.Vector2(),
  talkBack: true,
  lastInteraction: now(),
  lastReactSpeak: 0,
  lastBubbleReact: 0,
  lastPump: 0,
  popped: false,
  yeet: null,
  zoom: 0,
  disco: false,
  clones: [],
  fried: false,
  meltdown: false,
  userSpeaking: false,
  pointer: null,
  lastGiggle: 0,
  lastTickleLine: 0,
  slapCooldown: 0,
  ammo: 'pie',
  pen: 0,
  projectiles: [],
  lastMarker: 0,
  strokes: 0,
  lastSharpieLine: 0,
  mouthOpen: false,
  chew: 0,
  chewThen: null,
  lastChomp: 0,
  fire: 0,
  sour: 0,
  caffeine: 0, // seconds of caffeine overload left
  crash: 0,    // seconds of post-coffee nap left
  lastJitterLook: 0,
  lastSnore: 0,
  chaosRunning: false,
  ptr: null,
  sickAt: 0, // when a stuffed head throws up (ms), 0 = not scheduled
  saccade: new THREE.Vector2(),
  nextSaccade: 0,
};
