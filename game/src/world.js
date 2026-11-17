// Lumen Drift — the game state, the loop's rules and the score. The world
// owns the state machine (title -> playing -> paused / victory / game over),
// spawning, waves, collisions, combos and the win condition. Rendering lives
// in render.js; this file only decides what happens.
import { CONFIG } from './config.js';
import {
  makeMote, makeShard, makeWisp, makePowerUp, makeBoss, makeOrb, makeRing,
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
    this.rings = [];       // shockwave rings (kill flashes, novas)
    this.boss = null;      // the active boss, if any
    this.orbs = [];        // shadow orbs fired by the boss
    this.wardenSpawned = false;
    this.finalBossSpawned = false;
    this.comboPulse = 0;   // combo text pop when the multiplier rises
    this.flash = 0;        // full-screen white flash (nova), decays to 0
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
    if (this.boss) {
      this.boss.x = Math.min(Math.max(this.boss.x, this.boss.r), w - this.boss.r);
      this.boss.y = Math.min(Math.max(this.boss.y, this.boss.r), h - this.boss.r);
    }
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
    this.rings = [];
    this.boss = null;
    this.orbs = [];
    this.wardenSpawned = false;
    this.finalBossSpawned = false;
    this.comboPulse = 0;
    this.flash = 0;
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
    this.sound.setBossMode(false);
    this.sound.setIntensity(1);
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
    this._updateRings(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - CONFIG.shakeDecay * dt);
    if (this.waveBanner > 0) this.waveBanner -= dt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.8);
    if (this.comboPulse > 0) this.comboPulse = Math.max(0, this.comboPulse - dt * 2.5);

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
    this._updateBoss(dt);
    this._updateOrbs(dt);
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

  _updateRings(dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      r.r += (r.maxR - r.r) * Math.min(1, 9 * dt);
      if (r.age >= r.life) this.rings.splice(i, 1);
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
    // While a boss is up the field stays thinner, so the fight stays fair.
    const wispCap = this.boss ? 8 : CONFIG.wispMax;
    if (this.wispTimer <= 0 && this.wisps.length < wispCap) {
      const p = randomEdgePoint(this.w, this.h);
      this.wisps.push(makeWisp(p.x, p.y, this.wave, this.scale, this._pickWispType()));
      this.wispTimer = this.boss ? interval * 2 : interval;
    }
    this.powerupTimer -= dt;
    if (this.powerupTimer <= 0) {
      const p = randomFieldPoint(this.w, this.h, 90);
      this.powerups.push(makePowerUp(p.x, p.y, this._pickPowerupType()));
      this.powerupTimer = CONFIG.powerupEvery;
    }
  }

  // Which wisp shows up depends on the wave: chasers only at first, then
  // dashers (wave 3), splitters (wave 4) and tanks (wave 5) join the mix.
  _pickWispType() {
    const roll = Math.random();
    if (this.wave >= 5) {
      if (roll < 0.12) return 'tank';
      if (roll < 0.27) return 'splitter';
      if (roll < 0.45) return 'dasher';
    } else if (this.wave === 4) {
      if (roll < 0.15) return 'splitter';
      if (roll < 0.35) return 'dasher';
    } else if (this.wave === 3) {
      if (roll < 0.2) return 'dasher';
    }
    return 'chaser';
  }

  // Weighted power-up roll. Life only appears while a life is missing.
  _pickPowerupType() {
    const weights = { ...CONFIG.powerupWeights };
    if (this.lives >= CONFIG.startLives) delete weights.life;
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = Math.random() * total;
    for (const k in weights) {
      roll -= weights[k];
      if (roll <= 0) return k;
    }
    return 'shield';
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
    const prevMult = this.multiplier;
    this.multiplier = Math.min(CONFIG.comboMax, 1 + Math.floor(this.combo / CONFIG.comboStep));
    if (this.multiplier > prevMult) this.comboPulse = 1;
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
    this.sound.setIntensity(this.wave);
    this.floats.push(makeFloatText(this.w / 2, this.h * 0.3, `WAVE ${this.wave}`, '#6ef3ff', 30));
    if (this.wave === 5 && !this.wardenSpawned) {
      this.wardenSpawned = true;
      this._spawnBoss('warden');
      return;
    }
    if (!this.endless && this.wave >= CONFIG.winWave) {
      if (this.boss) {
        // The Warden flees before the Sovereign arrives.
        this.particles.push(...makeParticle(this.boss.x, this.boss.y, '#b388ff', 30, 240 * this.scale));
        this.rings.push(makeRing(this.boss.x, this.boss.y, this.boss.r * 3, 'rgba(179,136,255,0.8)'));
        this.boss = null;
        this.sound.setBossMode(false);
      }
      if (!this.finalBossSpawned) {
        this.finalBossSpawned = true;
        this._spawnBoss('sovereign');
        return;
      }
      this._win();
    }
  }

  _spawnBoss(kind) {
    const b = makeBoss(this.w / 2, 130, kind, this.scale);
    this.boss = b;
    this.waveBanner = 2.6;
    // Announced below the wave banner so the two never overlap.
    this.floats.push(makeFloatText(
      this.w / 2, this.h * 0.42,
      kind === 'warden' ? '⚠ GLOOM WARDEN ⚠' : '⚠ UMBRAL SOVEREIGN ⚠',
      '#ff5d8f', 30,
    ));
    this.sound.bossSpawn();
    this.sound.setBossMode(true);
  }

  _win() {
    this.state = 'victory';
    this.sound.win();
    this.sound.stopMusic();
    this.sound.setBossMode(false);
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
      if (w.type === 'dasher') this._updateDasher(w, dt, slowMul);
      else this._steerWisp(w, dt, slowMul);
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.x = Math.min(Math.max(w.x, w.r), this.w - w.r);
      w.y = Math.min(Math.max(w.y, w.r), this.h - w.r);

      const dist = Math.hypot(m.x - w.x, m.y - w.y);
      if (dist < m.r + w.r - 2) {
        if (this._wispContact(w)) this.wisps.splice(i, 1);
      }
    }
  }

  // Shared chase steering: toward the mote with a wandering wobble, so
  // wisps feel alive and dodgeable rather than homing missiles.
  _steerWisp(w, dt, slowMul, speedMul = 1) {
    const m = this.mote;
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
    const sp = w.speed * slowMul * speedMul;
    w.vx += (sx * sp - w.vx) * Math.min(1, 2.2 * dt);
    w.vy += (sy * sp - w.vy) * Math.min(1, 2.2 * dt);
  }

  // Dasher cycle: stalk slowly, hold still and aim (telegraphed), burst in
  // a straight line at the mote's position, then recover slowly.
  _updateDasher(w, dt, slowMul) {
    const m = this.mote;
    w.modeT -= dt;
    if (w.mode === 'drift') {
      this._steerWisp(w, dt, slowMul, 0.55);
      if (w.modeT <= 0) {
        w.mode = 'windup';
        w.modeT = CONFIG.dasherWindup;
        w.vx = 0;
        w.vy = 0;
      }
    } else if (w.mode === 'windup') {
      w.vx *= 0.9;
      w.vy *= 0.9;
      if (w.modeT <= 0) {
        w.tx = m.x;
        w.ty = m.y;
        w.mode = 'charge';
        w.modeT = CONFIG.dasherChargeTime;
        const dx = w.tx - w.x;
        const dy = w.ty - w.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = w.speed * CONFIG.dasherChargeMul * slowMul;
        w.vx = (dx / d) * sp;
        w.vy = (dy / d) * sp;
        this.sound.charge();
      }
    } else if (w.mode === 'charge') {
      if (w.modeT <= 0 || Math.hypot(w.tx - w.x, w.ty - w.y) < 24) {
        w.mode = 'recover';
        w.modeT = CONFIG.dasherRecover;
      }
    } else { // recover
      w.vx *= 0.94;
      w.vy *= 0.94;
      if (w.modeT <= 0) {
        w.mode = 'drift';
        w.modeT = 1.2 + Math.random() * 1.4;
      }
    }
  }

  // A wisp touches the mote. Returns true when the wisp should be removed.
  // Dashing through a wisp (or blocking it with a shield) destroys it
  // cleanly and scores; an unprotected touch costs a life.
  _wispContact(w) {
    const m = this.mote;
    if (m.invuln > 0) return this._dashKillWisp(w);
    if (m.shield) {
      m.shield = false;
      m.invuln = CONFIG.hitInvuln;
      this.particles.push(...makeParticle(m.x, m.y, '#7dd7ff', CONFIG.hitBurst, 240 * this.scale));
      this.floats.push(makeFloatText(m.x, m.y - 26, 'SHIELD!', '#7dd7ff', 18));
      this.sound.shieldBreak();
      this.shake = Math.max(this.shake, 6);
      return this._dashKillWisp(w);
    }
    this._damageMote(w);
    return true;
  }

  // Destroy a wisp with a dash or a shield block. Tanks crack once and
  // survive; splitters break into minis. Returns true if it is gone.
  _dashKillWisp(w) {
    if (w.type === 'tank' && w.hp > 1) {
      w.hp -= 1;
      const dx = w.x - this.mote.x;
      const dy = w.y - this.mote.y;
      const d = Math.hypot(dx, dy) || 1;
      w.vx = (dx / d) * 320 * this.scale;
      w.vy = (dy / d) * 320 * this.scale;
      this.score += CONFIG.tankChipScore;
      this.particles.push(...makeParticle(w.x, w.y, '#ffd166', 14, 200 * this.scale));
      this.floats.push(makeFloatText(w.x, w.y - 20, 'CRACK!', '#ffd166', 16));
      this.sound.chip();
      return false;
    }
    const value = w.type === 'mini' ? CONFIG.miniKillScore : CONFIG.dashKillScore;
    this.score += value;
    this.particles.push(...makeParticle(w.x, w.y, '#b388ff', 18, 220 * this.scale));
    this.rings.push(makeRing(w.x, w.y, w.r * 4, 'rgba(179,136,255,0.8)'));
    this.floats.push(makeFloatText(w.x, w.y - 16, `+${value}`, '#b388ff', 15));
    this.shake = Math.max(this.shake, 2.5);
    this.sound.dashKill();
    if (w.type === 'splitter') this._splitWisp(w);
    return true;
  }

  _splitWisp(w) {
    for (let i = 0; i < CONFIG.splitterMinis; i++) {
      if (this.wisps.length >= CONFIG.wispMax) break;
      const mini = makeWisp(
        w.x + (Math.random() - 0.5) * 30,
        w.y + (Math.random() - 0.5) * 30,
        this.wave, this.scale, 'mini',
      );
      mini.vx = (Math.random() - 0.5) * 120 * this.scale;
      mini.vy = (Math.random() - 0.5) * 120 * this.scale;
      this.wisps.push(mini);
    }
    this.sound.split();
  }

  // The mote takes a hit: lose a life, lose the combo, brief protection.
  _damageMote(w) {
    const m = this.mote;
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

  // --- Boss ---

  _updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    b.phase += dt * 4;
    b.wobble += dt * 2;
    if (b.hurtT > 0) b.hurtT -= dt;
    const m = this.mote;
    const slowMul = m.slow > 0 ? CONFIG.slowFactor : 1;
    if (b.mode === 'chase') {
      this._steerBoss(b, dt, slowMul);
      b.atkT -= dt;
      if (b.atkT <= 0) this._bossAttack(b);
    } else if (b.mode === 'telegraph') {
      b.vx *= 0.9;
      b.vy *= 0.9;
      b.modeT -= dt;
      if (b.modeT <= 0) {
        b.tx = m.x;
        b.ty = m.y;
        b.mode = 'charging';
        b.modeT = CONFIG.bossChargeTime;
        const dx = b.tx - b.x;
        const dy = b.ty - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = b.speed * CONFIG.bossChargeMul * slowMul;
        b.vx = (dx / d) * sp;
        b.vy = (dy / d) * sp;
        this.sound.charge();
      }
    } else if (b.mode === 'charging') {
      b.modeT -= dt;
      if (b.modeT <= 0 || Math.hypot(b.tx - b.x, b.ty - b.y) < 30) {
        b.mode = 'recover';
        b.modeT = CONFIG.bossRecover;
      }
    } else { // recover
      b.vx *= 0.94;
      b.vy *= 0.94;
      b.modeT -= dt;
      if (b.modeT <= 0) b.mode = 'chase';
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.x = Math.min(Math.max(b.x, b.r), this.w - b.r);
    b.y = Math.min(Math.max(b.y, b.r), this.h - b.r);

    const dist = Math.hypot(m.x - b.x, m.y - b.y);
    if (dist < m.r + b.r - 4) this._bossContact(b);
  }

  _steerBoss(b, dt, slowMul) {
    const m = this.mote;
    const dx = m.x - b.x;
    const dy = m.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const chaseX = (dx / d) * CONFIG.wispChase;
    const chaseY = (dy / d) * CONFIG.wispChase;
    const wobX = Math.cos(b.wobble) * CONFIG.wispWander * 0.5;
    const wobY = Math.sin(b.wobble * 0.8) * CONFIG.wispWander * 0.5;
    let sx = chaseX + wobX;
    let sy = chaseY + wobY;
    const sl = Math.hypot(sx, sy) || 1;
    sx /= sl;
    sy /= sl;
    const sp = b.speed * slowMul;
    b.vx += (sx * sp - b.vx) * Math.min(1, 1.6 * dt);
    b.vy += (sy * sp - b.vy) * Math.min(1, 1.6 * dt);
  }

  // The boss cycles charge -> orbs -> summon (the Sovereign fires orbs
  // twice per cycle). Every attack is telegraphed and dodgeable.
  _bossAttack(b) {
    const seq = b.type === 'warden'
      ? ['charge', 'orbs', 'summon']
      : ['charge', 'orbs', 'summon', 'orbs'];
    const atk = seq[b.atkStep % seq.length];
    b.atkStep += 1;
    b.atkT = CONFIG.bossAttackEvery;
    if (atk === 'charge') {
      b.mode = 'telegraph';
      b.modeT = CONFIG.bossTelegraph;
      b.vx = 0;
      b.vy = 0;
    } else if (atk === 'orbs') {
      const n = b.type === 'warden' ? 5 : 8;
      const off = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * Math.PI * 2;
        this.orbs.push(makeOrb(
          b.x + Math.cos(a) * (b.r + 10),
          b.y + Math.sin(a) * (b.r + 10),
          a, this.scale,
        ));
      }
      this.sound.orbBurst();
    } else {
      for (let i = 0; i < CONFIG.bossSummonCount; i++) {
        if (this.wisps.length >= CONFIG.wispMax) break;
        const mini = makeWisp(
          b.x + (Math.random() - 0.5) * 60,
          b.y + (Math.random() - 0.5) * 60,
          this.wave, this.scale, 'mini',
        );
        this.wisps.push(mini);
      }
      this.particles.push(...makeParticle(b.x, b.y, '#b388ff', 20, 200 * this.scale));
      this.sound.summon();
    }
  }

  // The mote touches the boss. A dash through it is a clean hit (one HP);
  // anything else costs the mote a life, like a wisp touch.
  _bossContact(b) {
    const m = this.mote;
    if (b.hurtT > 0) return;
    const dx = b.x - m.x;
    const dy = b.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    if (m.invuln > 0) {
      b.hp -= 1;
      b.hurtT = CONFIG.bossHurtTime;
      b.vx = (dx / d) * 260 * this.scale;
      b.vy = (dy / d) * 260 * this.scale;
      this.score += CONFIG.bossHitScore;
      this.particles.push(...makeParticle(b.x, b.y, '#ff5d8f', 30, 260 * this.scale));
      this.rings.push(makeRing(b.x, b.y, b.r * 3, 'rgba(255,93,143,0.9)'));
      this.floats.push(makeFloatText(b.x, b.y - b.r - 8, `+${CONFIG.bossHitScore}`, '#ff5d8f', 20));
      this.shake = Math.max(this.shake, 6);
      this.sound.bossHit();
      if (b.hp <= 0) this._bossDefeated(b);
      return;
    }
    b.hurtT = CONFIG.bossHurtTime;
    b.vx = (dx / d) * 140 * this.scale;
    b.vy = (dy / d) * 140 * this.scale;
    if (m.shield) {
      m.shield = false;
      m.invuln = CONFIG.hitInvuln;
      this.particles.push(...makeParticle(m.x, m.y, '#7dd7ff', CONFIG.hitBurst, 240 * this.scale));
      this.floats.push(makeFloatText(m.x, m.y - 26, 'SHIELD!', '#7dd7ff', 18));
      this.sound.shieldBreak();
      this.shake = Math.max(this.shake, 6);
      return;
    }
    this._damageMote(b);
  }

  _bossDefeated(b) {
    const isWarden = b.type === 'warden';
    const bonus = isWarden ? CONFIG.wardenKillScore : CONFIG.sovereignKillScore;
    this.score += bonus;
    this.particles.push(...makeParticle(b.x, b.y, '#ff5d8f', 50, 320 * this.scale, 1.2));
    this.particles.push(...makeParticle(b.x, b.y, '#ffd166', 40, 260 * this.scale, 1.2));
    this.rings.push(makeRing(b.x, b.y, b.r * 5, 'rgba(255,209,102,0.9)'));
    this.floats.push(makeFloatText(
      b.x, b.y - b.r - 12,
      isWarden ? `WARDEN DOWN! +${bonus}` : `SOVEREIGN DOWN! +${bonus}`,
      '#ffd166', 24,
    ));
    this.shake = Math.max(this.shake, 12);
    this.sound.bossDie();
    this.boss = null;
    this.orbs = [];
    this.sound.setBossMode(false);
    if (!isWarden) this._win();
  }

  _updateOrbs(dt) {
    const m = this.mote;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.age += dt;
      o.phase += dt * 4;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.age >= o.life || o.x < -20 || o.x > this.w + 20 || o.y < -20 || o.y > this.h + 20) {
        this.orbs.splice(i, 1);
        continue;
      }
      const d = Math.hypot(m.x - o.x, m.y - o.y);
      if (d < m.r + o.r) {
        this.orbs.splice(i, 1);
        if (m.invuln > 0) {
          this.score += CONFIG.orbKillScore;
          this.particles.push(...makeParticle(o.x, o.y, '#b388ff', 10, 160 * this.scale));
          this.sound.dashKill();
        } else if (m.shield) {
          m.shield = false;
          m.invuln = CONFIG.hitInvuln;
          this.particles.push(...makeParticle(m.x, m.y, '#7dd7ff', CONFIG.hitBurst, 240 * this.scale));
          this.floats.push(makeFloatText(m.x, m.y - 26, 'SHIELD!', '#7dd7ff', 18));
          this.sound.shieldBreak();
        } else {
          this._damageMote(o);
        }
      }
    }
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
    } else if (p.type === 'slow') {
      m.slow = CONFIG.slowTime;
      this.floats.push(makeFloatText(p.x, p.y - 20, 'SLOW TIME', '#b388ff', 18));
    } else if (p.type === 'life') {
      this.lives = Math.min(CONFIG.startLives, this.lives + 1);
      this.floats.push(makeFloatText(p.x, p.y - 20, '+1 LIFE!', '#7dff9e', 18));
      this.sound.lifeUp();
    } else if (p.type === 'nova') {
      this._fireNova(p);
    }
  }

  // Nova: purge every wisp and orb on the field, wound the boss, and
  // flash the whole screen. Splitters purged by a nova do not split.
  _fireNova(p) {
    this.flash = 0.5;
    this.shake = Math.max(this.shake, 10);
    this.rings.push(makeRing(p.x, p.y, Math.max(this.w, this.h), 'rgba(255,255,255,0.9)'));
    this.sound.nova();
    let purged = 0;
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      this.particles.push(...makeParticle(w.x, w.y, '#ffd166', 10, 200 * this.scale));
      this.wisps.splice(i, 1);
      purged++;
    }
    this.orbs = [];
    if (purged > 0) {
      this.score += purged * CONFIG.novaScore;
      this.floats.push(makeFloatText(p.x, p.y - 20, `NOVA! +${purged * CONFIG.novaScore}`, '#ffd166', 20));
    } else {
      this.floats.push(makeFloatText(p.x, p.y - 20, 'NOVA!', '#ffd166', 20));
    }
    if (this.boss) {
      this.boss.hp -= 1;
      this.boss.hurtT = Math.max(this.boss.hurtT, CONFIG.bossHurtTime);
      this.particles.push(...makeParticle(this.boss.x, this.boss.y, '#ffd166', 30, 260 * this.scale));
      if (this.boss.hp <= 0) this._bossDefeated(this.boss);
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
    this.sound.setBossMode(false);
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
      wispTypes: this.wisps.map((w) => w.type),
      boss: this.boss ? { type: this.boss.type, hp: this.boss.hp, maxHp: this.boss.maxHp, atk: this.boss.atkStep, mode: this.boss.mode } : null,
      orbs: this.orbs.length,
      powerups: this.powerups.map((p) => p.type),
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
    this._damageMote({ x: this.mote.x, y: this.mote.y });
  }

  // Test hook: land one dash-hit on the active boss, as if the mote had
  // dashed straight through it.
  debugBossHit() {
    const b = this.boss;
    if (!b || this.state !== 'playing') return;
    b.hurtT = 0;
    this.mote.invuln = Math.max(this.mote.invuln, 0.5);
    this._bossContact(b);
  }

  // Test hook: jump to a wave, one shard short of advancing, so the
  // automated play-test can reach a boss wave quickly.
  debugSetWave(w) {
    if (this.state !== 'playing') return;
    this.wave = w;
    this.waveShards = CONFIG.shardsPerWave - 1;
  }

  // Test hook: drop a power-up of the given type beside the mote.
  debugGivePowerup(type) {
    if (this.state !== 'playing') return;
    this.powerups.push(makePowerUp(
      Math.min(this.w - 40, this.mote.x + 40),
      Math.min(this.h - 40, this.mote.y + 40),
      type,
    ));
  }

  // Test hook: put the run one shard away from the winning wave, so the
  // automated play-test can reach the victory screen.
  debugNearWin() {
    if (this.state !== 'playing') return;
    this.wave = CONFIG.winWave - 1;
    this.waveShards = CONFIG.shardsPerWave - 1;
  }
}
