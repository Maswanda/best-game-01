// Lumen Drift — the things that live in the field. Each factory returns a
// plain object; the world owns the arrays and the update rules, this file
// owns what each thing is and how it moves on its own.
import { CONFIG } from './config.js';

export function makeMote(x, y) {
  return {
    kind: 'mote',
    x, y,
    vx: 0, vy: 0,
    r: CONFIG.moteRadius,
    angle: -Math.PI / 2, // facing up at rest
    trail: [],           // past positions for the light trail
    dashTime: 0,         // seconds of dash left
    dashCooldown: 0,     // seconds until the next dash
    invuln: 0,           // seconds of protection left
    shield: false,       // a shield power-up is active
    magnet: 0,           // seconds of magnet left
    slow: 0,             // seconds of slow-time left
  };
}

export function makeShard(x, y, w, h) {
  return {
    kind: 'shard',
    x, y,
    vx: (Math.random() - 0.5) * CONFIG.shardDrift * 2,
    vy: (Math.random() - 0.5) * CONFIG.shardDrift * 2,
    r: CONFIG.shardRadius,
    age: 0,
    life: CONFIG.shardLife,
    phase: Math.random() * Math.PI * 2, // pulse phase
    w, h,
  };
}

export function makeWisp(x, y, wave, scale, type = 'chaser') {
  const speed = Math.min(
    CONFIG.wispMaxSpeed,
    CONFIG.wispBaseSpeed + (wave - 1) * CONFIG.wispSpeedPerWave,
  );
  const w = {
    kind: 'wisp',
    type, // 'chaser' | 'dasher' | 'splitter' | 'tank' | 'mini'
    x, y,
    vx: 0, vy: 0,
    r: CONFIG.wispRadius * (0.9 + Math.random() * 0.35),
    speed: speed * scale,
    heading: Math.random() * Math.PI * 2,
    wobble: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    hp: 1,
    mode: 'drift', // dashers cycle drift -> windup -> charge -> recover
    modeT: 1.2 + Math.random() * 1.2,
    tx: 0, ty: 0, // charge target, set when the wind-up ends
  };
  if (type === 'mini') {
    w.r = CONFIG.miniRadius * scale;
    w.speed = speed * 0.9 * scale;
  } else if (type === 'tank') {
    w.r = CONFIG.tankRadius * scale;
    w.speed = speed * CONFIG.tankSpeedMul * scale;
    w.hp = CONFIG.tankHp;
  } else if (type === 'dasher') {
    w.r = CONFIG.wispRadius * 0.85 * scale;
    w.speed = speed * 1.1 * scale;
  } else if (type === 'splitter') {
    w.r = CONFIG.wispRadius * 1.15 * scale;
    w.speed = speed * 0.9 * scale;
  }
  return w;
}

// A boss: one big shadow with a health pool, attack cycle and readable
// tells. kind is 'warden' (wave 5) or 'sovereign' (wave 10).
export function makeBoss(x, y, kind, scale) {
  const isWarden = kind === 'warden';
  return {
    kind: 'boss',
    type: kind,
    x, y,
    vx: 0, vy: 0,
    r: (isWarden ? CONFIG.wardenRadius : CONFIG.sovereignRadius) * scale,
    speed: (isWarden ? CONFIG.wardenSpeed : CONFIG.sovereignSpeed) * scale,
    hp: isWarden ? CONFIG.wardenHp : CONFIG.sovereignHp,
    maxHp: isWarden ? CONFIG.wardenHp : CONFIG.sovereignHp,
    hurtT: 0,              // seconds it ignores further hits
    mode: 'chase',         // chase | telegraph | charging | recover
    modeT: 1.2,
    atkT: 2.2,             // seconds until the next special attack
    atkStep: 0,            // rotation through charge / orbs / summon
    wobble: Math.random() * Math.PI * 2,
    phase: Math.random() * Math.PI * 2,
    tx: 0, ty: 0,          // charge target
  };
}

// A shadow orb: a slow straight shot from the boss. Dodgeable, and a dash
// through it destroys it.
export function makeOrb(x, y, angle, scale) {
  const sp = CONFIG.orbSpeed * scale;
  return {
    kind: 'orb',
    x, y,
    vx: Math.cos(angle) * sp,
    vy: Math.sin(angle) * sp,
    r: CONFIG.orbRadius * scale,
    age: 0,
    life: CONFIG.orbLife,
    phase: Math.random() * Math.PI * 2,
  };
}

// An expanding shockwave ring, drawn once and gone.
export function makeRing(x, y, maxR, color) {
  return { kind: 'ring', x, y, r: 6, maxR, color, age: 0, life: CONFIG.ringLife };
}

export function makePowerUp(x, y, type) {
  return {
    kind: 'powerup',
    type, // 'shield' | 'magnet' | 'slow'
    x, y,
    vx: (Math.random() - 0.5) * 10,
    vy: (Math.random() - 0.5) * 10,
    r: CONFIG.powerupRadius,
    age: 0,
    life: 12,
    phase: Math.random() * Math.PI * 2,
  };
}

export function makeParticle(x, y, color, count, speed, life = 0.6) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    out.push({
      kind: 'particle',
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      r: 1.5 + Math.random() * 2.5,
      color,
      age: 0,
      life: life * (0.6 + Math.random() * 0.7),
    });
  }
  return out;
}

export function makeFloatText(x, y, text, color, size = 16) {
  return { kind: 'float', x, y, text, color, size, age: 0, life: 1.0 };
}

// Spawn helpers — the world asks for a position, the field answers one.
export function randomEdgePoint(w, h, margin = 24) {
  const side = Math.floor(Math.random() * 4);
  if (side === 0) return { x: margin + Math.random() * (w - margin * 2), y: margin };
  if (side === 1) return { x: margin + Math.random() * (w - margin * 2), y: h - margin };
  if (side === 2) return { x: margin, y: margin + Math.random() * (h - margin * 2) };
  return { x: w - margin, y: margin + Math.random() * (h - margin * 2) };
}

export function randomFieldPoint(w, h, margin = 60) {
  return {
    x: margin + Math.random() * (w - margin * 2),
    y: margin + Math.random() * (h - margin * 2),
  };
}
