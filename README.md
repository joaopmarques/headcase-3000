# HEADCASE 3000™

Upload your face. Ruin your face. Repeat.

A browser toy that turns a photo into a 3D head that you can poke, pinch, slap, bonk, tickle, inflate, melt, pie, doodle on, feed, and make talk. It can also copy your voice and record clips.

## Run it

```bash
python3 serve.py
```

Open http://localhost:5173. There is no build step and no install. Three.js, MediaPipe, and d3-delaunay load from jsDelivr.

## How the head works

1. MediaPipe Face Landmarker finds 478 face points in the photo. It runs in the browser, so the photo never leaves the machine.
2. The app levels the eyes, crops around the face, and runs detection again for a sharper fit.
3. A Delaunay mesh of the points becomes a smooth depth map. The front of an ellipsoid takes that depth, so the nose, lips, and chin stick out for real.
4. The photo projects onto the front. The back and top get skin and hair colors sampled from the photo.
5. If no face is found, the app fakes a nose and carries on.

## Files

- `js/face.js`: detection and depth fitting (the only CDN-heavy module)
- `js/fitcore.js`: shared fit helpers and the no-face fallback
- `js/head.js`: deformable head mesh, shader (blink, mouth, teeth, tint), all deformations
- `js/props.js`: googly eyes with pupil physics, hat, stache, shades, clown nose, tongue
- `js/audio.js`: every sound, synthesized with Web Audio
- `js/voice.js`: text to speech
- `js/lines.js`: dialogue, lies, and the nonsense generator
- `js/paint.js`: food splats, drips, and sharpie strokes on a paint layer that wraps the head
- `js/mimic.js`: records the mic and plays it back in a silly voice with lip-sync
- `js/recorder.js`: records 6-second clips of the stage with sound
- `js/food.js`: the snack tray and drag-to-mouth feeding
- `js/main.js`: scene, tools, actions, rage-o-meter, UI
