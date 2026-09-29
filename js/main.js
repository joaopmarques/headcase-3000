// HEADCASE 4000: boots the app. Each module sets itself up when it loads, in this order.
import './app/stage.js';
import './app/ticker.js';
import './app/talk.js';
import './app/trophies.js';
import './app/feelings.js';
import './app/faces.js';
import './app/tools.js';
import './app/wheel.js';
import './app/phone.js';
import './app/tips.js';
import './app/media.js';
import './app/actions.js';
import './app/snacks.js';
import './app/voicebox.js';
import './app/mood.js';
import './app/quality.js';
import './app/options.js';
import './app/loop.js';
import { app, st } from './app/ctx.js';
import { camera, stage, fx } from './app/stage.js';
import { makeDemoFace } from './demoFace.js';

// Link options: ?demo loads Default Dave right away, ?cat=voice opens a tool bar category,
// ?fanfare previews the completionist celebration.
const params = new URLSearchParams(location.search);
if (params.has('demo')) app.loadFace(makeDemoFace(), { demo: true });
if (app.CAT_TITLES[params.get('cat')]) app.setCategory(params.get('cat'));
if (params.has('fanfare')) setTimeout(() => app.celebrate(), 800);

// Debug handle for the curious (and for automated tests).
window.headcase = {
  loadFace: (...a) => app.loadFace(...a),
  get head() { return app.head; },
  get props() { return app.props; },
  st, camera, stage, fx,
  ACTIONS: app.ACTIONS, mimic: app.mimic, recorder: app.recorder, bees: app.bees, emotions: app.emotions,
};
