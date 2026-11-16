// Lumen Drift — boot and the frame loop. Wires the canvas, the input, the
// world and the renderer together, and exposes a small read-only debug
// handle the automated play-test uses to read state.
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';

const canvas = document.getElementById('game');
const fallback = document.getElementById('fallback');
if (!canvas || !canvas.getContext) {
  if (fallback) fallback.style.display = 'block';
  throw new Error('canvas not available');
}

const sound = new SoundBank();
const world = new World(sound);
const renderer = new Renderer(canvas);
const input = new Input(canvas);

function fit() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.resize(w, h);
  world.resize(w, h);
}
window.addEventListener('resize', fit);
fit();

// Start audio on the first gesture anywhere (autoplay policy).
const unlock = () => sound.ensure();
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

// Click on a menu screen also starts the game.
canvas.addEventListener('pointerdown', () => {
  if (world.state === 'title' || world.state === 'gameover' || world.state === 'victory') {
    sound.ensure();
    if (world.state === 'title' || world.state === 'gameover') world.startRun();
  }
});

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const actions = input.consume();
  const move = input.moveVector();
  world.update(dt, actions, move, input.pointer);
  renderer.render(world);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Read-only handle for the automated play-test. It never changes how the
// game plays; the harness uses it to read state and to force a game-over
// screen for a screenshot.
window.__lumen = {
  state: () => world.debug(),
  damage: () => world.debugDamage(),
  nearWin: () => world.debugNearWin(),
  start: () => { sound.ensure(); world.startRun(); },
};
