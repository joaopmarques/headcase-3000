// Feelings. Each emote runs for a while and nudges the jaw, brows, pose, tint, and gaze.
import * as THREE from 'three';

const rnd = (a, b) => a + Math.random() * (b - a);

export class Emotions {
  // app: { head(), props(), fx, sfx, st, rig, grunt, react, showBubble, talk }
  constructor(app) {
    this.app = app;
    this.active = null; // { kind, t, dur, ... }
    this.lastSweat = 0;
    // Per-frame outputs, read by main.
    this.out = { jaw: 0, brow: 0, rotX: 0, rotZ: 0, tint: new THREE.Color(0, 0, 0), look: null, lookDown: 0 };
  }

  play(kind) {
    const { app } = this;
    const head = app.head();
    if (!head) return;
    this.stop();
    const dur = { cry: 4, sneeze: 2.4, wink: 0.8, love: 4, sick: 4.5, scream: 1.8, hiccup: 8 }[kind];
    this.active = { kind, t: 0, dur, next: 0 };
    const A = this.active;
    switch (kind) {
      case 'cry':
        app.grunt('sob');
        app.react('cry', { force: true });
        break;
      case 'sneeze':
        app.grunt('ah');
        app.showBubble(app.line('sneezeBuild'), 1400);
        head.s.nose.t += 0.25;
        A.blown = false;
        break;
      case 'wink': {
        const side = Math.random() < 0.5 ? 'L' : 'R';
        head.winkEye(side);
        app.sfx.tongueClick();
        const p = app.props().anchorWorld(side === 'L' ? 'eyeL' : 'eyeR', new THREE.Vector3());
        app.fx.burst(p, ['✨'], 3, { speed: 1.5, size: 0.2, life: 0.6 });
        app.showBubble('😉', 1000);
        break;
      }
      case 'love':
        app.fx.dizzy(head.group, 1.65, dur, ['💕', '💖', '💘', '💗', '❤️']);
        app.grunt('aww');
        app.sfx.sparkle();
        app.react('love', { force: true });
        break;
      case 'sick':
        app.grunt('bleh');
        app.react('sick', { force: true });
        A.gags = 0;
        A.puked = false;
        A.fatBefore = head.s.fatTarget; // puking empties this out
        break;
      case 'scream':
        // The one and only Wilhelm scream (synth scream if the sample is not ready).
        if (!app.samples?.play('wilhelm', { vol: 1 })) { app.sfx.scream(); app.grunt('argh'); }
        app.react('scream', { force: true });
        break;
      case 'hiccup':
        A.next = 0.4;
        app.react('hiccup', { force: true });
        break;
    }
  }

  stop() {
    const A = this.active, head = this.app.head();
    // A sneeze cut short gives the nose back and opens the eyes.
    if (A?.kind === 'sneeze' && !A.blown && head) {
      head.s.nose.t -= 0.25;
      head.forceBlink = 0;
    }
    // Sick cut short: open the eyes. If it already puked, it stays emptied out.
    if (A?.kind === 'sick' && !A.dripped && head) {
      head.forceBlink = 0;
      head.s.fatTarget = A.puked ? 0 : (A.fatBefore ?? head.s.fatTarget);
    }
    this.active = null;
  }

  eyeWorld(side) {
    return this.app.props().anchorWorld(side, new THREE.Vector3());
  }

  update(dt, t) {
    const { app } = this;
    const head = app.head();
    const o = this.out;
    o.jaw = 0; o.brow = 0; o.rotX = 0; o.rotZ = 0; o.look = null;
    o.tint.setRGB(0, 0, 0);
    if (!head) return o;

    // Sweat as the rage climbs.
    const rage = app.st.rage;
    const now = performance.now();
    if (rage > 45 && head.group.visible && now - this.lastSweat > 1500 - rage * 9) {
      this.lastSweat = now;
      const side = Math.random() < 0.5 ? 'browL' : 'browR';
      const p = this.eyeWorld(side).add(new THREE.Vector3(0, 0.15, 0.05));
      app.fx.burst(p, ['💦'], 1, { speed: 1, gravity: -6, size: 0.18, life: 0.9, dir: new THREE.Vector3(side === 'browL' ? -1 : 1, 0.3, 0.4) });
    }

    const A = this.active;
    if (!A) return o;
    A.t += dt;
    const q = app.rig.quaternion;
    switch (A.kind) {
      case 'cry': {
        o.jaw = 0.12 + 0.08 * Math.sin(t * 20);
        o.brow = -0.5;
        o.tint.setRGB(-0.02, -0.01, 0.07);
        o.look = new THREE.Vector2(0, -0.6);
        if (A.t > A.next) {
          A.next = A.t + 0.07;
          for (const [side, sx] of [['eyeL', -1], ['eyeR', 1]]) {
            const dir = new THREE.Vector3(sx, 0.7, 0.6).applyQuaternion(q);
            app.fx.burst(this.eyeWorld(side), ['💧'], 1, { speed: 3.2, gravity: -9, size: 0.17, life: 1, dir, spread: 0.3 });
          }
        }
        if (Math.floor(A.t / 1.1) !== Math.floor((A.t - dt) / 1.1)) app.grunt('sob');
        break;
      }
      case 'sneeze': {
        if (!A.blown) {
          const u = Math.min(1, A.t / 1.3);
          o.rotX = -0.35 * u;
          o.brow = 0.9 * u;
          o.jaw = 0.25 * u;
          head.forceBlink = u * 0.6;
          if (A.t >= 1.3) {
            A.blown = true;
            head.forceBlink = 0;
            app.sfx.sneezeBlast();
            app.grunt('choo');
            app.st.rot.x.kick(9);
            app.st.pos.y.kick(-3);
            head.s.scaleY.x = 0.85;
            head.s.nose.kick(8);
            head.s.nose.t -= 0.25;
            const dir = new THREE.Vector3(0, -0.15, 1).applyQuaternion(q);
            app.fx.burst(this.eyeWorld('nose'), ['💦', '💦', '✨'], 26, { speed: 7, gravity: -5, size: 0.2, life: 0.8, dir, spread: 1.4 });
            app.showBubble('ACHOO!', 900);
          }
        } else {
          o.jaw = Math.max(0, 0.5 - (A.t - 1.3) * 1.2);
          if (A.t > 2.2 && !A.said) { A.said = true; app.react('sneeze', { force: true }); }
        }
        break;
      }
      case 'wink':
        o.brow = 0.3;
        break;
      case 'love':
        o.brow = 0.5;
        o.tint.setRGB(0.12, 0.01, 0.06);
        o.look = new THREE.Vector2(0, 0.15);
        if (A.t > A.next) {
          A.next = A.t + 0.35;
          const p = app.rig.position.clone().add(new THREE.Vector3(rnd(-0.6, 0.6), 1.2, 0.5));
          app.fx.burst(p, ['❤️', '💕'], 1, { speed: 1.2, gravity: 1.5, size: 0.28, life: 1.4, dir: new THREE.Vector3(0, 1, 0) });
        }
        break;
      case 'sick': {
        // 0-2s: wobble and gag. 2-3.4s: the big one. After: sway it off.
        const PUKE_START = 2, PUKE_END = 3.4;
        const green = Math.min(1, A.t / PUKE_START);
        o.tint.setRGB(-0.05 * green, 0.1 * green, -0.03 * green);
        o.brow = -0.3;
        if (A.t < PUKE_START) {
          o.rotZ = Math.sin(t * 2.6) * 0.14;
          o.rotX = Math.sin(t * 1.7) * 0.06;
          o.jaw = 0.05;
          o.look = new THREE.Vector2(Math.cos(t * 2.2), Math.sin(t * 2.2)).multiplyScalar(0.8);
          // Two gags on the way up: cheeks puff, jaw twitches.
          for (const [k, at] of [[1, 0.8], [2, 1.5]]) {
            if (A.gags < k && A.t >= at) {
              A.gags = k;
              app.sfx.gag();
              head.s.jaw.kick(9);
              head.s.fatTarget = Math.min(1.15, A.fatBefore + 0.15 * k); // cheeks puff up
              head.s.scaleY.x = 0.94;
            }
          }
        } else if (A.t < PUKE_END) {
          if (!A.puked) {
            A.puked = true;
            app.ach?.().unlock('technicolor');
            app.ach?.().bump('puke');
            if (!app.samples?.play('barf', { vol: 1 })) app.sfx.vomitSound(PUKE_END - PUKE_START);
            app.st.rot.x.kick(4);
          }
          o.jaw = 0.85 + Math.sin(t * 40) * 0.04;
          o.rotX = 0.12;
          o.rotZ = Math.sin(t * 9) * 0.03;
          o.look = new THREE.Vector2(0, -0.8);
          head.forceBlink = 0.55;
          // Pour from the mouth, along the face normal and a bit down.
          const origin = this.eyeWorld('mouth');
          const n = head.vertexNormal(head.anchors.mouth, new THREE.Vector3())
            .applyQuaternion(head.mesh.getWorldQuaternion(new THREE.Quaternion()));
          origin.addScaledVector(n, 0.06);
          // Mostly outward, toward the viewer, so the arc is visible before it hits the floor.
          const dir = n.add(new THREE.Vector3(0, 0.15, 0.35));
          const u = (A.t - PUKE_START) / (PUKE_END - PUKE_START);
          // The weight drains out with the vomit.
          head.s.fatTarget = (A.fatBefore + 0.3) * Math.max(0, 1 - u * 1.2);
          app.vomit().stream(origin, dir, dt, 260 * Math.sin(Math.PI * Math.min(1, u * 1.15)) + 40);
        } else {
          if (!A.dripped) {
            A.dripped = true;
            head.forceBlink = 0;
            head.s.fatTarget = 0;
            const uv1 = new THREE.Vector2().fromBufferAttribute(head.geo.attributes.uv1, head.anchors.lowerLip);
            app.painter().splat(uv1, 'vomit', 0.45);
            app.grunt('bleh');
          }
          o.rotZ = Math.sin(t * 2.6) * 0.08;
          o.jaw = 0.08;
        }
        break;
      }
      case 'scream':
        o.jaw = 0.85;
        o.brow = 1;
        o.rotZ = rnd(-0.05, 0.05);
        o.look = new THREE.Vector2(rnd(-0.2, 0.2), 0.4);
        break;
      case 'hiccup':
        if (A.t > A.next) {
          A.next = A.t + rnd(0.8, 1.7);
          head.s.scaleY.x = 1.14;
          app.st.pos.y.kick(3.5);
          head.s.jaw.kick(6);
          head.s.brow.kick(8);
          app.sfx.hicPop();
          app.grunt('hic');
          app.showBubble('*hic*', 600);
        }
        break;
    }
    if (A.t >= A.dur) {
      if (A.kind === 'sick') app.showBubble('…I am fine.', 1400);
      if (A.kind === 'hiccup') app.showBubble('Phew. They are gone.', 1400);
      this.active = null;
    }
    return o;
  }
}
