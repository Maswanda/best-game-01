// Lumen Drift — the game state, the loop's rules and the score. The world
// owns the state machine (title -> playing -> paused / victory / game over),
// spawning, waves, collisions, combos and the win condition. Rendering lives
// in render.js; this file only decides what happens.
import { CONFIG } from './config.js';
import {
  makeMote, makeShard, makeWisp, makePowerUp,
  makeParticle, makeFloatText, randomEdgePoint, randomFieldPoint,
} from './entities.js';

export const BEST_KEY = 'lumen-drift-best';

export class World {
  constructor(sound) {
    this.sound = sound;
    this.w = 960;
    this.h = 600;
    this.scale = 1;
    this.state = 'title'; // title | playing | paused | victory | gameover
    this.time = 0;
    this.score = 0;
    this.best = 0;
    try { this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0; } catch { this.best = 0; }
    this.lives = CONFIG.startLives;
    this.wave = 1;
    this.shardsCollected = 0; // total this run
    this.waveShards = 0;      // shards collected in the current wave
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.mote = makeMote(this.w / 2, this.h / 2);
    this.shards = [];
    this.wisps = [];
    this.powerups = [];
    this.particles = [];
    this.floats = [];
    this.shardTimer = 0;
    this.wispTimer = 0;
    this.powerupTimer = CONFIG.powerupEvery * 0.6;
    this.shake = 0;
    this.waveBanner = 0;      // seconds the wave banner shows
    this.endless = false;     // true once the player wins and keeps going
    this.newBest = false;
    this.stars = [];
    this.dust = [];
    this._seedBackdrop();
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.scale = Math.min(w / CONFIG.refWidth, h / CONFIG.refHeight);
    this.mote.x = Math.min(Math.max(this.mote.x, 24), w - 24);
    this.mote.y = Math.min(Math.max(this.mote.y, 24), h - 24);
    this._seedBackdrop();
  }

  _seedBackdrop() {
    this.stars = Array.from({ length: CONFIG.stars }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: 0.5 + Math.random() * 1.6,
      tw: Math.random() * Math.PI * 2,
      depth: 0.2 + Math.random() * 0.8,
    }));
    this.dust = Array.from({ length: CONFIG.dust }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      r: 1 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      a: 0.05 + Math.random() * 0.12,
    }));
  }

  startRun() {
    this.score = 0;
    this.lives = CONFIG.startLives;
    this.wave = 1;
    this.shardsCollected = 0;
    this.waveShards = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    this.mote = makeMote(this.w / 2, this.h / 2);
    this.shards = [];
    this.wisps = [];
    this.powerups = [];
    this.particles = [];
    this.floats = [];
    this.shardTimer = 0.4;
    this.wispTimer = 1.6;
    this.powerupTimer = CONFIG.powerupEvery * 0.6;
    this.shake = 0;
    this.waveBanner = 2.2;
    this.endless = false;
    this.newBest = false;
    this.state = 'playing';
    for (let i = 0; i < 5; i++) {
      const p = randomFieldPoint(this.w, this.h, 90);
      this.shards.push(makeShard(p.x, p.y, this.w, this.h));
    }
    this.sound.startMusic();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.sound.stopMusic();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.sound.startMusic();
    }
  }

  // One frame. `input` is the consumed edge actions, `move` the vector,
  // `pointer` the mouse position. dt is clamped by the caller.
  update(dt, input, move, pointer) {
    this.time += dt;
    this._updateBackdrop(dt);
    this._updateParticles(dt);
    this._updateFloats(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - CONFIG.shakeDecay * dt);
    if (this.waveBanner > 0) this.waveBanner -= dt;

    if (input.mute) this.sound.toggleMute();

    if (this.state === 'title') {
      if (input.confirm) { this.sound.ensure(); this.startRun(); }
      return;
    }
    if (this.state === 'paused') {
      if (input.pause || input.confirm) this.togglePause();
      return;
    }
    if (this.state === 'gameover') {
      if (input.confirm) { this.sound.ensure(); this.startRun(); }
      return;
    }
    if (this.state === 'victory') {
      if (input.continue) {
        this.endless = true;
        this.state = 'playing';
        this.sound.startMusic();
      } else if (input.confirm) {
        this.sound.ensure();
        this.startRun();
      }
      return;
    }

    // --- playing ---
    if (input.pause) { this.togglePause(); return; }
    this._updateMote(dt, input, move, pointer);
    this._updateSpawning(dt);
    this._updateShards(dt);
    this._updateWisps(dt);
    this._updatePowerups(dt);
    this._updateCombo(dt);
  }

  _updateBackdrop(dt) {
    for (const s of this.stars) s.tw += dt * 1.5;
    for (const d of this.dust) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < -8) d.x = this.w + 8;
      if (d.x > this.w + 8) d.x = -8;
      if (d.y < -8) d.y = this.h + 8;
      if (d.y > this.h + 8) d.y = -8;
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.age >= p.life) this.particles.splice(i, 1);
    }
  }

  _updateFloats(dt) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.age += dt;
      f.y -= 34 * dt;
      if (f.age >= f.life) this.floats.splice(i, 1);
    }
  }

  _updateMote(dt, input, move, pointer) {
    const m = this.mote;
    const s = this.scale;
    if (m.invuln > 0) m.invuln -= dt;
    if (m.dashCooldown > 0) m.dashCooldown -= dt;
    if (m.magnet > 0) m.magnet -= dt;
    if (m.slow > 0) m.slow -= dt;

    // Desired velocity: keys win over the pointer; the pointer steers the
    // mote toward it when no key is held.
    let dx = 0, dy = 0;
    if (move) {
      dx = move.x;
      dy = move.y;
    } else if (pointer.active && pointer.inside) {
      const px = pointer.x - m.x;
      const py = pointer.y - m.y;
      const dist = Math.hypot(px, py);
      if (dist > 8) { dx = px / dist; dy = py / dist; }
    }

    if (input.dash && m.dashCooldown <= 0 && m.dashTime <= 0) {
      m.dashTime = CONFIG.dashTime;
      m.dashCooldown = CONFIG.dashCooldown;
      m.invuln = Math.max(m.invuln, CONFIG.dashInvuln);
      this.shake = Math.max(this.shake, CONFIG.shakeOnDash);
      this.sound.dash();
      const a = (dx || dy) ? Math.atan2(dy, dx) : m.angle;
      m.vx = Math.cos(a) * CONFIG.dashSpeed * s;
      m.vy = Math.sin(a) * CONFIG.dashSpeed * s;
    }

    if (m.dashTime > 0) {
      m.dashTime -= dt;
    } else {
      const speed = CONFIG.moteSpeed * s;
      const tx = dx * speed;
      const ty = dy * speed;
      m.vx += (tx - m.vx) * Math.min(1, CONFIG.moteAccel * dt / speed + 0.12);
      m.vy += (ty - m.vy) * Math.min(1, CONFIG.moteAccel * dt / speed + 0.12);
      if (!dx && !dy) {
        m.vx *= Math.max(0, 1 - CONFIG.moteFriction * dt);
        m.vy *= Math.max(0, 1 - CONFIG.moteFriction * dt);
      }
    }

    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.x = Math.min(Math.max(m.x, m.r), this.w - m.r);
    m.y = Math.min(Math.max(m.y, m.r), this.h - m.r);
    if (Math.hypot(m.vx, m.vy) > 20) m.angle = Math.atan2(m.vy, m.vx);

    m.trail.unshift({ x: m.x, y: m.y });
    if (m.trail.length > CONFIG.trailLength) m.trail.pop();
  }

  _updateSpawning(dt) {
    this.shardTimer -= dt;
    if (this.shardTimer <= 0 && this.shards.length < CONFIG.shardMax) {
      const p = randomFieldPoint(this.w, this.h, 70);
      this.shards.push(makeShard(p.x, p.y, this.w, this.h));
      this.shardTimer = CONFIG.shardSpawnEvery;
    }
    this.wispTimer -= dt;
    const interval = Math.max(
      CONFIG.wispSpawnFloor,
      CONFIG.wispSpawnEvery - (this.wave - 1) * CONFIG.wispSpawnStep,
    );
    if (this.wispTimer <= 0 && this.wisps.length < CONFIG.wispMax) {
      const p = randomEdgePoint(this.w, this.h);
      this.wisps.push(makeWisp(p.x, p.y, this.wave, this.scale));
      this.wispTimer = interval;
    }
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0) {
      const p = randomFieldPoint(this.w, this.h, 90);
      const types = ['shield', 'magnet', 'slow'];
      this.powerups.push(makePowerUp(p.x, p.y, types[Math.floor(Math.random() * types.length)]));
      this.powerupTimer = CONFIG.powerupEvery;
    }
  }

  _updateShards(dt) {
    const m = this.mote;
    const magnetR = CONFIG.magnetRadius * this.scale;
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.age += dt;
      sh.phase += dt * 3;
      if (m.magnet > 0) {
        const dx = m.x - sh.x;
        const dy = m.y - sh.y;
        const d = Math.hypot(dx, dy);
        if (d < magnetR && d > 1) {
          const pull = 420 * this.scale * (1 - d / magnetR) + 120;
          sh.vx += (dx / d) * pull * dt * 4;
          sh.vy += (dy / d) * pull * dt * 4;
        }
      }
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.vx *= 0.995;
      sh.vy *= 0.995;
      if (sh.x < sh.r || sh.x > this.w - sh.r) sh.vx *= -1;
      if (sh.y < sh.r || sh.y > this.h - sh.r) sh.vy *= -1;
      sh.x = Math.min(Math.max(sh.x, sh.r), this.w - sh.r);
      sh.y = Math.min(Math.max(sh.y, sh.r), this.h - sh.r);

      if (sh.age >= sh.life) { this.shards.splice(i, 1); continue; }
      const d = Math.hypot(m.x - sh.x, m.y - sh.y);
      if (d < m.r + sh.r + 4) {
        this.shards.splice(i, 1);
        this._collectShard(sh);
      }
    }
  }

  _collectShard(sh) {
    this.combo += 1;
    this.comboTimer = CONFIG.comboWindow;
    this.multiplier = Math.min(CONFIG.comboMax, 1 + Math.floor(this.combo / CONFIG.comboStep));
    const value = CONFIG.shardValue * this.multiplier;
    this.score += value;
    this.shardsCollected += 1;
    this.waveShards += 1;
    this.particles.push(...makeParticle(sh.x, sh.y, '#ffd166', CONFIG.particleBurst, 190 * this.scale));
    this.floats.push(makeFloatText(sh.x, sh.y - 14, `+${value}`, '#ffd166', 15 + Math.min(8, this.multiplier)));
    if (this.combo > 1 && this.combo % CONFIG.comboStep === 0) {
      this.floats.push(makeFloatText(sh.x, sh.y - 38, `COMBO x${this.multiplier}!`, '#6ef3ff', 20));
    }
    this.sound.pickup(this.combo);
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      try { localStorage.setItem(BEST_KEY, String(this.best)); } catch { /* private mode */ }
    }
    if (this.waveShards >= CONFIG.shardsPerWave && (this.endless || this.wave < CONFIG.winWave)) {
      this._nextWave();
    }
  }

  _nextWave() {
    this.wave += 1;
    this.waveShards = 0;
    this.waveBanner = 2.2;
    this.sound.waveUp(this.wave);
    this.floats.push(makeFloatText(this.w / 2, this.h * 0.3, `WAVE ${this.wave}`, '#6ef3ff', 30));
    if (!this.endless && this.wave >= CONFIG.winWave) {
      this._win();
    }
  }

  _win() {
    this.state = 'victory';
    this.sound.win();
    this.sound.stopMusic();
    this.particles.push(...makeParticle(this.mote.x, this.mote.y, '#ffd166', 60, 320 * this.scale, 1.2));
    this.particles.push(...makeParticle(this.mote.x, this.mote.y, '#6ef3ff', 40, 260 * this.scale, 1.2));
  }

  _updateWisps(dt) {
    const m = this.mote;
    const slowMul = m.slow > 0 ? CONFIG.slowFactor : 1;
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      w.wobble += dt * 2;
      w.phase += dt * 4;
      // Steer toward the mote with a wandering wobble, so they feel alive
      // and dodgeable rather than homing missiles.
      const dx = m.x - w.x;
      const dy = m.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      const chaseX = (dx / d) * CONFIG.wispChase;
      const chaseY = (dy / d) * CONFIG.wispChase;
      const wobX = Math.cos(w.wobble) * CONFIG.wispWander;
      const wobY = Math.sin(w.wobble * 0.8) * CONFIG.wispWander;
      let sx = chaseX + wobX;
      let sy = chaseY + wobY;
      const sl = Math.hypot(sx, sy) || 1;
      sx /= sl;
      sy /= sl;
      const sp = w.speed * slowMul;
      w.vx += (sx * sp - w.vx) * Math.min(1, 2.2 * dt);
      w.vy += (sy * sp - w.vy) * Math.min(1, 2.2 * dt);
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.x = Math.min(Math.max(w.x, w.r), this.w - w.r);
      w.y = Math.min(Math.max(w.y, w.r), this.h - w.r);

      const dist = Math.hypot(m.x - w.x, m.y - w.y);
      if (dist < m.r + w.r - 2) {
        this.wisps.splice(i, 1);
        this._hitByWisp(w);
      }
    }
  }

  _hitByWisp(w) {
    const m = this.mote;
    if (m.invuln > 0) return;
    if (m.shield) {
      m.shield = false;
      m.invuln = CONFIG.hitInvuln;
      this.particles.push(...makeParticle(m.x, m.y, '#7dd7ff', CONFIG.hitBurst, 240 * this.scale));
      this.floats.push(makeFloatText(m.x, m.y - 26, 'SHIELD!', '#7dd7ff', 18));
      this.sound.shieldBreak();
      this.shake = Math.max(this.shake, 6);
      return;
    }
    this.lives -= 1;
    this.combo = 0;
    this.comboTimer = 0;
    this.multiplier = 1;
    m.invuln = CONFIG.hitInvuln;
    this.shake = Math.max(this.shake, CONFIG.shakeOnHit);
    this.particles.push(...makeParticle(m.x, m.y, '#ff5d8f', CONFIG.hitBurst, 260 * this.scale));
    this.particles.push(...makeParticle(w.x, w.y, '#b388ff', 12, 180 * this.scale));
    this.floats.push(makeFloatText(m.x, m.y - 26, 'HIT!', '#ff5d8f', 20));
    this.sound.hit();
    if (this.lives <= 0) this._gameOver();
  }

  _updatePowerups(dt) {
    const m = this.mote;
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const p = this.powerups[i];
      p.age += dt;
      p.phase += dt * 3;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age >= p.life) { this.powerups.splice(i, 1); continue; }
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < m.r + p.r + 4) {
        this.powerups.splice(i, 1);
        this._applyPowerup(p);
      }
    }
  }

  _applyPowerup(p) {
    const m = this.mote;
    this.particles.push(...makeParticle(p.x, p.y, '#7dd7ff', 18, 200 * this.scale));
    this.sound.powerup();
    if (p.type === 'shield') {
      m.shield = true;
      this.floats.push(makeFloatText(p.x, p.y - 20, 'SHIELD UP', '#7dd7ff', 18));
    } else if (p.type === 'magnet') {
      m.magnet = CONFIG.magnetTime;
      this.floats.push(makeFloatText(p.x, p.y - 20, 'MAGNET!', '#ffd166', 18));
    } else {
      m.slow = CONFIG.slowTime;
      this.floats.push(makeFloatText(p.x, p.y - 20, 'SLOW TIME', '#b388ff', 18));
    }
  }

  _updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.multiplier = 1;
      }
    }
  }

  _gameOver() {
    this.state = 'gameover';
    this.sound.gameOver();
    this.sound.stopMusic();
    this.particles.push(...makeParticle(this.mote.x, this.mote.y, '#6ef3ff', 50, 300 * this.scale, 1.1));
    this.particles.push(...makeParticle(this.mote.x, this.mote.y, '#ff5d8f', 30, 220 * this.scale, 1.1));
  }

  // Small read-only handle for automated play-testing. It never changes how
  // the game plays; the test harness uses it to read state and to force a
  // game-over screen for a screenshot.
  debug() {
    return {
      state: this.state,
      score: this.score,
      lives: this.lives,
      wave: this.wave,
      combo: this.combo,
      shards: this.shards.length,
      wisps: this.wisps.length,
      mote: { x: Math.round(this.mote.x), y: Math.round(this.mote.y) },
      nearestShard: this.shards[0]
        ? { x: Math.round(this.shards[0].x), y: Math.round(this.shards[0].y) }
        : null,
    };
  }

  debugDamage() {
    if (this.state !== 'playing') return;
    this.mote.invuln = 0;
    this.mote.shield = false;
    this._hitByWisp({ x: this.mote.x, y: this.mote.y });
  }

  // Test hook: put the run one shard away from the winning wave, so the
  // automated play-test can reach the victory screen.
  debugNearWin() {
    if (this.state !== 'playing') return;
    this.wave = CONFIG.winWave - 1;
    this.waveShards = CONFIG.shardsPerWave - 1;
  }
}
