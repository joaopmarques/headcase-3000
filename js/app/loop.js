// The animation loop: runs every frame.
import * as THREE from 'three';
import * as samples from '../samples.js';
import * as sfx from '../audio.js';
import { voiceState, isTalking } from '../voice.js';
import { line } from '../lines.js';
import { $, rnd, now, app, st } from './ctx.js';
import { tickQuality } from './quality.js';
import { stage, renderer, scene, camera, discoLights, shadow, rig, fx, vomit, steam, nuke } from './stage.js';

// ---------- loop ----------
const tmpV = new THREE.Vector3();

// ---------- steam from the ears ----------
const FURY_AT = 64; // rage % where the sticker says "Seeing red"
const earPos = new THREE.Vector3(), headPos = new THREE.Vector3(), earDir = new THREE.Vector3();
let nextHiss = 0;
function fume(k, dt, tNow) {
  app.head.group.getWorldPosition(headPos);
  for (const ear of ['earL', 'earR']) {
    app.props.anchorWorld(ear, earPos);
    earDir.subVectors(earPos, headPos).setY(0).normalize();
    earPos.addScaledVector(earDir, 0.05); // just outside the skin
    steam.stream(earPos, earDir, dt, 14 + k * 46);
  }
  // Kettle hisses, closer together the angrier it gets.
  if (tNow > nextHiss) {
    sfx.steamHiss(0.08 + k * 0.08);
    nextHiss = tNow + 900 - Math.min(1, k) * 550 + rnd(0, 200);
  }
}
let last = now();
function frame() {
  const tNow = now();
  tickQuality(tNow);
  const dt = Math.min(0.05, (tNow - last) / 1000);
  last = tNow;
  const t = tNow / 1000;

  if (app.head) {
    // Time spent ruining faces, for the stats. Saved once per whole second.
    if (!document.hidden) {
      st.playAcc = (st.playAcc ?? 0) + dt;
      if (st.playAcc >= 1) { const sec = Math.floor(st.playAcc); st.playAcc -= sec; app.ach.bump('playSec', sec); }
    }
    // Look at the mouse when not busy being abused.
    if (!st.pinch && !st.yeet) {
      st.rot.y.t = st.mouse.x * 0.45;
      st.rot.x.t = -st.mouse.y * 0.25;
    }
    const emo = app.emotions.update(dt, t);
    st.rot.x.t += emo.rotX;
    // Tilt like a curious dog while listening to the mic.
    st.rot.z.t = (app.mimic.state === 'recording' ? 0.14 : 0) + emo.rotZ;
    // Espresso: vibrate first, nap after.
    if (st.caffeine > 0) {
      st.caffeine -= dt;
      st.rot.z.x += rnd(-0.04, 0.04);
      st.rot.y.x += rnd(-0.03, 0.03);
      st.pos.x.x += rnd(-0.025, 0.025);
      if (st.caffeine <= 0) { st.crash = 5; st.lastSnore = 0; }
    } else if (st.crash > 0) {
      st.crash -= dt;
      st.rot.x.t += 0.22;
      st.rot.z.t += 0.14;
      if (tNow - st.lastSnore > 1700) {
        st.lastSnore = tNow;
        sfx.snore();
        const top = app.props.anchorWorld('top', new THREE.Vector3());
        fx.burst(top, ['💤'], 1, { speed: 1, gravity: 0.8, size: 0.4, life: 1.8, dir: new THREE.Vector3(0.4, 1, 0.2) });
      }
      if (st.crash <= 0) {
        app.head.forceBlink = 0;
        const text = line('crash');
        app.showBubble(text, 2200);
        if (st.talkBack) app.talk(text);
      }
    }
    for (const s of [st.rot.x, st.rot.y, st.rot.z, st.pos.x, st.pos.y, st.scale]) s.step(dt);

    // Mouth: speech flaps, tongue keeps it ajar, tickles make it laugh.
    let jawT = app.props.on.tongue ? 0.12 : 0;
    if (isTalking()) {
      jawT = 0.1 + 0.38 * Math.abs(Math.sin(t * 15)) * (0.55 + 0.45 * Math.sin(t * 3.7));
      if (tNow - voiceState.lastBoundary < 90) jawT += 0.2;
    }
    if (app.head.s.tickle > 0.2) jawT = Math.max(jawT, 0.2 + 0.2 * Math.abs(Math.sin(t * 22)));
    if (st.meltdown) jawT = 0.6 + 0.1 * Math.sin(t * 30);
    // Mimic: the mouth follows the real audio level.
    const lvl = app.mimic.update();
    if (app.mimic.state === 'playing') jawT = Math.min(0.75, lvl * 0.9);
    if (app.mimic.state === 'recording') { st.pos.y.t = lvl * 0.15; app.head.s.brow.kick(lvl * 2); } else st.pos.y.t = 0;
    // Snacks: gape at incoming food, chew, breathe fire.
    if (st.mouthOpen) jawT = Math.max(jawT, 0.55 + 0.05 * Math.sin(t * 12));
    if (st.chew > 0) {
      st.chew -= dt;
      jawT = 0.05 + 0.22 * Math.abs(Math.sin(t * 13));
      if (tNow - st.lastChomp > 200) { st.lastChomp = tNow; sfx.chomp(); }
      if (st.chew <= 0) { const f = st.chewThen; st.chewThen = null; f?.(); }
    }
    if (st.fire > 0) {
      st.fire -= dt;
      jawT = 0.6;
      const dir = new THREE.Vector3(0, -0.1, 1).applyQuaternion(rig.quaternion);
      fx.burst(app.mouthWorld(), ['🔥', '🔥', '💨'], 2, { speed: 5, gravity: 2, life: 0.5, size: 0.4, dir });
    }
    if (st.sour > 0) {
      st.sour -= dt;
      app.head.forceBlink = st.sour > 0 ? 0.85 : 0;
      jawT = 0;
    }
    jawT = Math.max(jawT, emo.jaw);
    app.head.s.jaw.t = jawT;
    app.head.s.brow.t = st.meltdown ? -1 : app.head.s.inflate.t * 0.6 + (isTalking() ? 0.15 * Math.sin(t * 5) : 0) + emo.brow;
    if (st.caffeine > 0) {
      app.head.s.brow.t += 0.9;
      app.head.s.jaw.t = Math.max(app.head.s.jaw.t, 0.08 + 0.12 * Math.abs(Math.sin(t * 38)));
    } else if (st.crash > 0) {
      app.head.forceBlink = 0.62; // droopy eyelids
      app.head.s.jaw.t = Math.max(app.head.s.jaw.t, 0.12);
      app.head.s.brow.t -= 0.3;
    }

    // Eyes: follow the pointer, wander when it is still, or do what the feeling says.
    let lookT = emo.look;
    if (!lookT && st.ptr && tNow - st.ptr.t < 2500) {
      const eye = app.props.anchorWorld('eyeL', new THREE.Vector3()).add(app.props.anchorWorld('eyeR', tmpV)).multiplyScalar(0.5).project(camera);
      const sr = stage.getBoundingClientRect();
      const ex = sr.left + (eye.x * 0.5 + 0.5) * sr.width, ey = sr.top + (-eye.y * 0.5 + 0.5) * sr.height;
      lookT = new THREE.Vector2((st.ptr.x - ex) / (sr.width * 0.3), (ey - st.ptr.y) / (sr.height * 0.3));
      if (lookT.length() > 1) lookT.normalize();
    } else if (!lookT) {
      if (tNow > st.nextSaccade) {
        st.nextSaccade = tNow + rnd(900, 2400);
        if (Math.random() < 0.35) st.saccade.set(0, 0);
        else st.saccade.set(rnd(-1, 1), rnd(-0.6, 0.6)).clampLength(0, 0.75);
      }
      lookT = st.saccade;
    }
    if (st.caffeine > 0) {
      if (tNow - st.lastJitterLook > 90) { st.lastJitterLook = tNow; st.saccade.set(rnd(-1, 1), rnd(-0.6, 0.6)); }
      lookT = st.saccade;
    } else if (st.crash > 0) lookT = st.saccade.set(0, -0.7);
    app.head.look.lerp(lookT, Math.min(1, dt * 18));

    // Deflate after the pumping stops. Loudly.
    const inf = app.head.s.inflate;
    if (!st.popped && inf.t > 0.05 && !app.pumpTimer && tNow - st.lastPump > 2600) {
      if (!samples.play('fart', { rate: 1.15 - inf.t * 0.4, vol: 0.9 })) sfx.fart(0.4 + inf.t * 1.4);
      app.grunt('ooh');
      st.zoom = 0.4 + inf.t * 1.4;
      inf.t = 0;
      app.react('deflate', { force: true });
    }
    if (st.zoom > 0) {
      // Balloon letting go: zip around like an idiot.
      st.zoom -= dt;
      st.pos.x.kick(rnd(-30, 30) * dt * 10);
      st.pos.y.kick(rnd(-20, 30) * dt * 10);
      st.rot.z.kick(rnd(-30, 30) * dt * 10);
    }

    // Rage + blush tint
    st.rage = Math.max(0, st.rage - dt * (st.meltdown ? 0 : 2.5));
    st.blush = Math.max(0, st.blush - dt * 0.8);
    const r = st.rage / 100;
    const hot = Math.max(0, st.fire) * 0.12;
    // Furious ("Seeing red" and up): the face floods red with a throbbing pulse, and steam jets
    // out of both ears. It all builds until the meltdown's KABOOM.
    const fury = st.meltdown ? 1 : Math.max(0, (st.rage - FURY_AT) / (100 - FURY_AT));
    const throb = fury * (0.6 + 0.4 * Math.sin(t * (8 + fury * 10)));
    app.head.s.tint.setRGB(
      r * 0.22 + fury * 0.28 + throb * 0.1 + st.blush * 0.18 + hot,
      st.blush * 0.02 - fury * 0.12,
      st.blush * 0.04 - fury * 0.14,
    ).add(emo.tint);
    if (fury > 0 && !st.popped && !st.yeet) fume(fury * (st.meltdown ? 2.5 : 1), dt, tNow);
    // It shakes with fury, harder the closer it gets to blowing up.
    if (fury > 0) {
      const k = st.meltdown ? 0.06 : 0.004 + fury * 0.016;
      st.rot.z.x += rnd(-k, k);
      st.pos.x.x += rnd(-k, k);
    }
    app.updateRageUI();

    // Idle chatter
    if (st.talkBack && tNow - st.lastInteraction > 30000) {
      samples.play('crickets', { vol: 0.8 }); // awkward silence, but louder
      app.react('idle', { force: true });
    }

    if (st.sickAt) {
      if (tNow >= st.sickAt - 1200 && !st.sickWarned) {
        st.sickWarned = true;
        app.grunt('uhoh');
        app.showBubble('Uh oh… I ate too much.', 1400);
      }
      // Wait out a yeet or a pop, then let it all out.
      if (tNow >= st.sickAt && !st.yeet && !st.popped) {
        st.sickAt = 0;
        st.sickWarned = false;
        if (app.emotions.active?.kind !== 'sick') app.emotions.play('sick');
      }
    }
    app.painter.update(dt);
    app.updateProjectiles(dt);
    app.bees.update(dt, t);
    vomit.update(dt);
    steam.update(dt);
    app.head.update(dt);
    app.props.update(dt, t);

    let ox = 0, oy = 0, spin = 0;
    if (st.yeet) {
      const y = st.yeet;
      y.t += dt;
      if (y.t < 0.8) { const u = y.t / 0.8; ox = y.dir * u * u * 13; oy = u * 3; spin = u * 12; }
      else if (y.t < 1.4) { ox = 40; }
      else if (y.t < 2.2) { const u = (y.t - 1.4) / 0.8, e = 1 - (1 - u) ** 3; ox = -y.dir * (1 - e) * 13; oy = (1 - e) * 4; spin = -(1 - e) * 10; }
      else {
        st.yeet = null;
        sfx.boing(1);
        st.rot.z.kick(y.dir * 10);
        if (y.self) {
          st.meltdown = false;
          st.rage = 0;
          app.showBubble('…fine. I am back. But I am not happy about it.', 3000);
          app.talk('Fine. I am back. But I am not happy about it.');
        } else app.react('pop', { force: true });
      }
    }
    rig.position.set(st.pos.x.x + ox, st.pos.y.x + oy + Math.sin(t * 1.6) * 0.06, 0);
    rig.rotation.set(st.rot.x.x, st.rot.y.x, st.rot.z.x + spin);
    rig.scale.setScalar(Math.max(0.001, st.scale.x));
    shadow.scale.setScalar(Math.max(0.2, 1 - Math.abs(oy) * 0.2) * Math.max(0.01, st.scale.x) * (1 + app.head.s.inflate.x * 0.8));
    shadow.visible = app.head.group.visible;

    if (st.disco && st.discoSong) {
      // Bob on the song's real beats, read off the audio clock so it never drifts.
      const beat = Math.floor((sfx.audioCtx().currentTime - st.discoSong.t0) / (60 / app.DISCO_BPM));
      if (beat > st.discoBeatN) { st.discoBeatN = beat; if (beat >= 0) app.discoBeat(); }
    }
    if (st.disco) {
      discoLights.forEach((l, i) => {
        const a = t * 2 + (i * Math.PI * 2) / 3;
        l.position.set(Math.cos(a) * 3.5, Math.sin(t * 3 + i) * 2, Math.sin(a) * 3.5 + 1.5);
        l.intensity = 9 + 6 * Math.sin(t * 8 + i);
      });
      app.head.uniforms.uHue.value = Math.sin(t * 1.5) * 0.8;
    }

    st.clones.forEach((m, i) => {
      const a = m.userData.a + t * 0.6;
      m.position.set(Math.cos(a) * 3.6, Math.sin(t * 2 + m.userData.ph) * 0.6 + 0.2, Math.sin(a) * 2 - 2.2);
      m.rotation.set(Math.sin(t + i) * 0.3, -a + Math.PI / 2 + Math.sin(t * 3 + i), Math.sin(t * 2 + i) * 0.4);
    });

    // Speech bubble follows the head.
    tmpV.set(0.75, 1.35, 0).applyMatrix4(rig.matrixWorld).project(camera);
    const w = stage.clientWidth, h = stage.clientHeight;
    const bw = app.bubble.offsetWidth, bh = app.bubble.offsetHeight;
    // Bubble box starts 30px left and 70px up from this point (see CSS margins).
    const bx = Math.min(w - bw + 20, Math.max(40, (tmpV.x * 0.5 + 0.5) * w));
    const by = Math.min(h - bh + 40, Math.max(80, (-tmpV.y * 0.5 + 0.5) * h));
    app.bubble.style.transform = `translate(${bx}px, ${by}px)`;
  }
  app.updateMood(dt, t);
  fx.update(dt);
  nuke.update(dt);
  // Nuke camera: pull back to fit the cloud, and shake.
  const baseZ = camera.userData.baseZ ?? camera.position.z;
  camera.userData.baseZ = baseZ;
  const zoom = nuke.zoom, shake = nuke.shake * 0.35;
  camera.position.set(rnd(-shake, shake), 0.25 + zoom * 1.4 + rnd(-shake, shake), baseZ * (1 + zoom * 0.75));
  camera.lookAt(0, 0.3 + zoom * 1.1, 0);
  renderer.render(scene, camera);
  if (app.recorder.active) app.recorder.draw();
  if (st.snapRequest) {
    // Must run right after render, while the WebGL buffer still holds the frame.
    st.snapRequest = false;
    app.ach.unlock('saycheese');
    app.recorder.snapshot().then((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `headcase-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
    const f = document.createElement('div');
    f.className = 'flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 450);
    sfx.whipCrack();
    app.showBubble('Say cheese! 📸', 1200);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
