// Lumen Drift — everything the player sees. One canvas, one render pass per
// frame: the backdrop, the field, the HUD, then the screen overlay for the
// current state. Text is kept big and high-contrast so the screenshots read
// at a glance even when shrunk.
import { CONFIG } from './config.js';

const PALETTE = {
  bgTop: '#0b1026',
  bgBottom: '#070a1a',
  mote: '#6ef3ff',
  moteCore: '#eafcff',
  shard: '#ffd166',
  wisp: '#ff5d8f',
  wispCore: '#c9184a',
  dasher: '#ff9f1c',
  dasherCore: '#cc5800',
  splitter: '#c77dff',
  splitterCore: '#7b2cbf',
  tank: '#8d99ae',
  tankCore: '#5a189a',
  mini: '#ff8fab',
  boss: '#e5383b',
  bossCore: '#6a040f',
  bossGold: '#ffd166',
  orb: '#b388ff',
  life: '#7dff9e',
  nova: '#ffffff',
  shield: '#7dd7ff',
  magnet: '#ffd166',
  slow: '#b388ff',
  text: '#eaf2ff',
  dim: '#9db4d8',
  danger: '#ff5d8f',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  resize(w, h) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(world) {
    const { ctx } = this;
    const w = world.w;
    const h = world.h;
    ctx.save();
    if (world.shake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * world.shake,
        (Math.random() - 0.5) * world.shake,
      );
    }
    this._backdrop(world);
    if (world.state !== 'title') this._field(world);
    this._hud(world);
    if (world.state === 'title') this._titleScreen(world);
    if (world.state === 'paused') this._pauseScreen(world);
    if (world.state === 'victory') this._victoryScreen(world);
    if (world.state === 'gameover') this._gameOverScreen(world);
    ctx.restore();
  }

  _backdrop(world) {
    const { ctx } = this;
    const w = world.w;
    const h = world.h;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, PALETTE.bgTop);
    g.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    // Twinkling stars, drifting dust, and a soft vignette.
    for (const s of world.stars) {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(s.tw));
      ctx.globalAlpha = a * s.depth;
      ctx.fillStyle = '#cfe6ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const d of world.dust) {
      ctx.globalAlpha = d.a;
      ctx.fillStyle = '#6ef3ff';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const vg = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(w, h) * 0.35,
      w / 2, h / 2, Math.max(w, h) * 0.75,
    );
    vg.addColorStop(0, 'rgba(4,6,16,0)');
    vg.addColorStop(1, 'rgba(4,6,16,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  _field(world) {
    const { ctx } = this;
    for (const p of world.powerups) this._powerup(p, world);
    for (const sh of world.shards) this._shard(sh, world);
    for (const w of world.wisps) this._wisp(w, world);
    for (const o of world.orbs) this._orb(o);
    if (world.boss) this._boss(world.boss, world);
    this._mote(world);
    for (const p of world.particles) this._particle(p);
    for (const r of world.rings) this._ring(r);
    for (const f of world.floats) this._floatText(f);
    if (world.flash > 0) {
      ctx.globalAlpha = Math.min(0.55, world.flash * 0.9);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, world.w, world.h);
      ctx.globalAlpha = 1;
    }
  }

  _glow(x, y, r, color, alpha = 0.8) {
    const { ctx } = this;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _shard(sh) {
    const { ctx } = this;
    const pulse = 1 + Math.sin(sh.phase) * 0.15;
    const blink = sh.life - sh.age < 3 ? (Math.sin(sh.age * 10) > 0 ? 1 : 0.35) : 1;
    ctx.globalAlpha = blink;
    this._glow(sh.x, sh.y, sh.r * 3.2 * pulse, 'rgba(255,209,102,0.55)');
    ctx.globalAlpha = blink;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(sh.phase * 0.4);
    ctx.fillStyle = PALETTE.shard;
    ctx.beginPath();
    ctx.moveTo(0, -sh.r * pulse);
    ctx.lineTo(sh.r * 0.7 * pulse, 0);
    ctx.lineTo(0, sh.r * pulse);
    ctx.lineTo(-sh.r * 0.7 * pulse, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff7dd';
    ctx.beginPath();
    ctx.arc(0, 0, sh.r * 0.28 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _wisp(w, world) {
    const { ctx } = this;
    const pulse = 1 + Math.sin(w.phase) * 0.12;
    // Each type reads differently at a glance: orange for the dasher,
    // violet for the splitter, steel armour for the tank.
    const body = w.type === 'dasher' ? PALETTE.dasher
      : w.type === 'splitter' ? PALETTE.splitter
      : w.type === 'tank' ? PALETTE.tank
      : w.type === 'mini' ? PALETTE.mini : PALETTE.wisp;
    const core = w.type === 'dasher' ? PALETTE.dasherCore
      : w.type === 'splitter' ? PALETTE.splitterCore
      : w.type === 'tank' ? PALETTE.tankCore : PALETTE.wispCore;
    const glow = w.type === 'dasher' ? 'rgba(255,159,28,0.5)'
      : w.type === 'splitter' ? 'rgba(199,125,255,0.5)'
      : w.type === 'tank' ? 'rgba(141,153,174,0.5)'
      : 'rgba(255,93,143,0.5)';

    // A dasher about to charge flashes and shows its aim line, so the
    // burst is always dodgeable.
    if (w.type === 'dasher' && w.mode === 'windup') {
      const m = world.mote;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,159,28,0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(w.x, w.y);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.restore();
      if (Math.floor(world.time * 16) % 2 === 0) {
        this._glow(w.x, w.y, w.r * 5, 'rgba(255,255,255,0.7)');
      }
    }
    this._glow(w.x, w.y, w.r * 3.4 * pulse, glow);
    ctx.save();
    ctx.translate(w.x, w.y);
    // Spiky shadow blob.
    ctx.fillStyle = body;
    ctx.beginPath();
    const spikes = w.type === 'tank' ? 6 : 8;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rr = (i % 2 === 0 ? w.r : w.r * 0.62) * pulse;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Tanks wear a cracked armour ring; each dash hit cracks it more.
    if (w.type === 'tank') {
      ctx.strokeStyle = w.hp > 1 ? 'rgba(234,252,255,0.9)' : 'rgba(234,252,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, w.r * 0.82, 0, Math.PI * 2);
      ctx.stroke();
    }
    // A splitter carries two little cores inside, hinting it breaks apart.
    if (w.type === 'splitter') {
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(-w.r * 0.32, w.r * 0.3, w.r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(w.r * 0.32, w.r * 0.3, w.r * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    // Eyes.
    ctx.fillStyle = '#fff';
    const ex = w.r * 0.32;
    const ey = -w.r * 0.12;
    ctx.beginPath(); ctx.arc(-ex, ey, w.r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, w.r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(-ex, ey, w.r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, w.r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // A shadow orb: a small dark shot with a violet rim.
  _orb(o) {
    const { ctx } = this;
    const pulse = 1 + Math.sin(o.phase) * 0.15;
    this._glow(o.x, o.y, o.r * 3 * pulse, 'rgba(179,136,255,0.55)');
    ctx.fillStyle = '#2d1b4e';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.orb;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e0aaff';
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r * 0.35 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  // A boss: a huge spiky shadow with horns, a crown for the Sovereign,
  // and a flash whenever it takes a hit or telegraphs a charge.
  _boss(b, world) {
    const { ctx } = this;
    const pulse = 1 + Math.sin(b.phase) * 0.08;
    const isSovereign = b.type === 'sovereign';
    const telegraphing = b.mode === 'telegraph';
    if (telegraphing) {
      const m = world.mote;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,93,143,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.restore();
      if (Math.floor(world.time * 16) % 2 === 0) {
        this._glow(b.x, b.y, b.r * 4, 'rgba(255,255,255,0.55)');
      }
    }
    this._glow(b.x, b.y, b.r * 3.2 * pulse, telegraphing ? 'rgba(255,93,143,0.75)' : 'rgba(229,56,59,0.5)');
    ctx.save();
    ctx.translate(b.x, b.y);
    // Horns.
    ctx.fillStyle = PALETTE.bossCore;
    ctx.beginPath();
    ctx.moveTo(-b.r * 0.7, -b.r * 0.55);
    ctx.lineTo(-b.r * 1.05, -b.r * 1.25);
    ctx.lineTo(-b.r * 0.3, -b.r * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.r * 0.7, -b.r * 0.55);
    ctx.lineTo(b.r * 1.05, -b.r * 1.25);
    ctx.lineTo(b.r * 0.3, -b.r * 0.8);
    ctx.closePath();
    ctx.fill();
    // The Sovereign wears a gold crown.
    if (isSovereign) {
      ctx.fillStyle = PALETTE.bossGold;
      ctx.beginPath();
      ctx.moveTo(-b.r * 0.45, -b.r * 0.85);
      ctx.lineTo(-b.r * 0.3, -b.r * 1.25);
      ctx.lineTo(-b.r * 0.12, -b.r * 0.9);
      ctx.lineTo(0, -b.r * 1.3);
      ctx.lineTo(b.r * 0.12, -b.r * 0.9);
      ctx.lineTo(b.r * 0.3, -b.r * 1.25);
      ctx.lineTo(b.r * 0.45, -b.r * 0.85);
      ctx.closePath();
      ctx.fill();
    }
    // Spiky body.
    ctx.fillStyle = PALETTE.boss;
    ctx.beginPath();
    const spikes = 10;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rr = (i % 2 === 0 ? b.r : b.r * 0.66) * pulse;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Hurt flash: the body goes pale right after a hit lands.
    if (b.hurtT > 0.35) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, b.r * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Angry eyes.
    const ex = b.r * 0.34;
    const ey = -b.r * 0.1;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-ex, ey, b.r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, b.r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(-ex, ey, b.r * 0.11, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, b.r * 0.11, 0, Math.PI * 2); ctx.fill();
    // Grinning mouth.
    ctx.strokeStyle = PALETTE.bossCore;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, b.r * 0.28, b.r * 0.3, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
    ctx.restore();
  }

  // An expanding shockwave ring.
  _ring(r) {
    const { ctx } = this;
    const a = Math.max(0, 1 - r.age / r.life);
    ctx.globalAlpha = a;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3 + 3 * a;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  _powerup(p) {
    const { ctx } = this;
    const color = p.type === 'shield' ? PALETTE.shield
      : p.type === 'magnet' ? PALETTE.magnet
      : p.type === 'slow' ? PALETTE.slow
      : p.type === 'life' ? PALETTE.life : PALETTE.nova;
    const letter = p.type === 'shield' ? 'S'
      : p.type === 'magnet' ? 'M'
      : p.type === 'slow' ? 'T'
      : p.type === 'life' ? '♥' : '✦';
    const blink = p.life - p.age < 3 ? (Math.sin(p.age * 10) > 0 ? 1 : 0.4) : 1;
    const bob = Math.sin(p.phase) * 3;
    const glowColor = p.type === 'shield' ? 'rgba(125,215,255,0.5)'
      : p.type === 'magnet' ? 'rgba(255,209,102,0.5)'
      : p.type === 'slow' ? 'rgba(179,136,255,0.5)'
      : p.type === 'life' ? 'rgba(125,255,158,0.5)' : 'rgba(255,255,255,0.55)';
    ctx.globalAlpha = blink;
    this._glow(p.x, p.y + bob, p.r * 3, glowColor, 0.5);
    ctx.globalAlpha = blink;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 0, 1);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  _mote(world) {
    const { ctx } = this;
    const m = world.mote;
    const s = world.scale;

    // Light trail.
    for (let i = m.trail.length - 1; i >= 1; i--) {
      const t = m.trail[i];
      const a = (1 - i / m.trail.length) * 0.35;
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.mote;
      ctx.beginPath();
      ctx.arc(t.x, t.y, m.r * (0.9 - (i / m.trail.length) * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const flicker = m.invuln > 0 && Math.floor(world.time * 14) % 2 === 0;
    if (flicker) ctx.globalAlpha = 0.35;

    this._glow(m.x, m.y, m.r * 4.2, 'rgba(110,243,255,0.5)');
    if (m.shield) {
      ctx.strokeStyle = 'rgba(125,215,255,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r + 9 + Math.sin(world.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Lantern body: a glowing orb with a flame tip in the facing direction.
    ctx.fillStyle = PALETTE.mote;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.moteCore;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    ctx.fillStyle = '#fff7dd';
    ctx.beginPath();
    ctx.moveTo(m.r + 9, 0);
    ctx.lineTo(m.r - 2, -5);
    ctx.lineTo(m.r - 2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;

    // Dash cooldown ring.
    if (m.dashCooldown > 0) {
      const frac = 1 - m.dashCooldown / CONFIG.dashCooldown;
      ctx.strokeStyle = 'rgba(234,252,255,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r + 15, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      ctx.stroke();
    }
  }

  _particle(p) {
    const { ctx } = this;
    ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  _floatText(f) {
    const { ctx } = this;
    const a = Math.max(0, 1 - f.age / f.life);
    ctx.globalAlpha = a;
    ctx.font = `bold ${f.size}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(7,10,26,0.85)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  _hud(world) {
    const { ctx } = this;
    const w = world.w;
    if (world.state === 'title') return;
    ctx.textBaseline = 'alphabetic';

    // Score (top-left, big).
    ctx.textAlign = 'left';
    ctx.font = 'bold 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(String(world.score).padStart(6, '0'), 18, 42);
    ctx.font = '13px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`BEST ${world.best}`, 18, 62);

    // Wave (top-centre).
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(world.endless ? `WAVE ${world.wave} · ENDLESS` : `WAVE ${world.wave} / ${CONFIG.winWave}`, w / 2, 34);
    if (world.waveBanner > 0 && world.state === 'playing') {
      const a = Math.min(1, world.waveBanner);
      ctx.globalAlpha = a;
      ctx.font = 'bold 44px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = PALETTE.mote;
      ctx.fillText(`WAVE ${world.wave}`, w / 2, world.h * 0.3);
      ctx.globalAlpha = 1;
    }

    // Lives (top-right, lantern dots).
    ctx.textAlign = 'right';
    for (let i = 0; i < CONFIG.startLives; i++) {
      const x = w - 24 - i * 30;
      const y = 30;
      const alive = i < world.lives;
      ctx.globalAlpha = alive ? 1 : 0.22;
      this._glow(x, y, 16, 'rgba(110,243,255,0.6)', alive ? 0.8 : 0.2);
      ctx.globalAlpha = alive ? 1 : 0.22;
      ctx.fillStyle = PALETTE.mote;
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.moteCore;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Boss health bar (top-centre, under the wave text).
    if (world.boss && world.state === 'playing') {
      const b = world.boss;
      const bw = 240;
      const bx = w / 2 - bw / 2;
      const by = 48;
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = PALETTE.danger;
      ctx.fillText(b.type === 'warden' ? 'GLOOM WARDEN' : 'UMBRAL SOVEREIGN', w / 2, by - 6);
      ctx.fillStyle = 'rgba(255,93,143,0.25)';
      ctx.fillRect(bx, by, bw, 9);
      ctx.fillStyle = PALETTE.danger;
      ctx.fillRect(bx, by, bw * (b.hp / b.maxHp), 9);
      ctx.strokeStyle = 'rgba(234,242,255,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, 9);
    }

    // Combo meter (below the score). It pops a little bigger each time
    // the multiplier rises.
    if (world.combo > 1 && world.state === 'playing') {
      const frac = world.comboTimer / CONFIG.comboWindow;
      const pop = 1 + world.comboPulse * 0.25;
      ctx.textAlign = 'left';
      ctx.font = `bold ${Math.round(20 * pop)}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillStyle = PALETTE.shard;
      ctx.fillText(`COMBO x${world.multiplier}  (${world.combo})`, 18, 92);
      ctx.fillStyle = 'rgba(255,209,102,0.25)';
      ctx.fillRect(18, 100, 130, 6);
      ctx.fillStyle = PALETTE.shard;
      ctx.fillRect(18, 100, 130 * frac, 6);
    }

    // Active power-ups (below the lives).
    const act = [];
    if (world.mote.shield) act.push('SHIELD');
    if (world.mote.magnet > 0) act.push(`MAGNET ${Math.ceil(world.mote.magnet)}s`);
    if (world.mote.slow > 0) act.push(`SLOW ${Math.ceil(world.mote.slow)}s`);
    if (act.length) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = PALETTE.shield;
      ctx.fillText(act.join('   '), w - 18, 66);
    }

    // Dash hint (bottom-left, small).
    if (world.state === 'playing') {
      ctx.textAlign = 'left';
      ctx.font = '13px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = PALETTE.dim;
      const ready = world.mote.dashCooldown <= 0;
      ctx.fillText(
        ready ? 'SPACE / CLICK — DASH (ready)' : 'SPACE / CLICK — DASH',
        18, world.h - 16,
      );
      ctx.textAlign = 'right';
      ctx.fillText('P pause · M mute', w - 18, world.h - 16);
    }
  }

  _panel(w, h, title, titleColor) {
    const { ctx } = this;
    const pw = Math.min(w * 0.62, 560);
    const ph = Math.min(h * 0.62, 380);
    const x = (w - pw) / 2;
    const y = (h - ph) / 2;
    ctx.fillStyle = 'rgba(7,10,26,0.78)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(16,24,54,0.92)';
    ctx.strokeStyle = 'rgba(110,243,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, 18);
    ctx.fill();
    ctx.stroke();
    return { x, y, pw, ph, title, titleColor };
  }

  _titleScreen(world) {
    const { ctx } = this;
    const w = world.w;
    const h = world.h;
    // A few drifting shards behind the title for life.
    for (let i = 0; i < 7; i++) {
      const sx = (world.time * 12 + i * 137) % (w + 80) - 40;
      const sy = h * 0.2 + ((i * 97) % Math.floor(h * 0.55));
      this._glow(sx, sy, 26, 'rgba(255,209,102,0.35)');
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.mote;
    ctx.font = 'bold 64px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = 'rgba(110,243,255,0.8)';
    ctx.shadowBlur = 28;
    ctx.fillText('LUMEN DRIFT', w / 2, h * 0.3);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.shard;
    ctx.font = '20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Guide the last lantern through the dark. Gather the light. Dodge the shadows.', w / 2, h * 0.3 + 38);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('MOVE  ·  WASD / Arrows / Mouse', w / 2, h * 0.52);
    ctx.fillText('DASH  ·  Space or Click  (brief shield while dashing — dash THROUGH wisps to destroy them)', w / 2, h * 0.52 + 28);
    ctx.fillText('COLLECT shards to build a combo — reach WAVE 10 to bring the DAWN', w / 2, h * 0.52 + 56);
    ctx.fillText('Grab S (shield), M (magnet), T (slow time), ♥ (life) and ✦ (nova) power-ups', w / 2, h * 0.52 + 84);
    ctx.fillText('Beware the GLOOM WARDEN at Wave 5 — and the UMBRAL SOVEREIGN at Wave 10', w / 2, h * 0.52 + 112);
    const pulse = 0.65 + Math.sin(world.time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('▶  PRESS ENTER OR CLICK TO START', w / 2, h * 0.78);
    ctx.globalAlpha = 1;
    if (world.best > 0) {
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`BEST SCORE  ${world.best}`, w / 2, h * 0.78 + 34);
    }
  }

  _pauseScreen(world) {
    const p = this._panel(world.w, world.h, 'PAUSED', PALETTE.mote);
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.mote;
    ctx.font = 'bold 40px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('PAUSED', world.w / 2, p.y + 90);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`Score ${world.score}  ·  Wave ${world.wave}  ·  Lives ${world.lives}`, world.w / 2, p.y + 140);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Press P or ENTER to keep playing', world.w / 2, p.y + 190);
  }

  _victoryScreen(world) {
    const p = this._panel(world.w, world.h, 'DAWN', PALETTE.shard);
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.shard;
    ctx.font = 'bold 44px "Segoe UI", system-ui, sans-serif';
    ctx.shadowColor = 'rgba(255,209,102,0.8)';
    ctx.shadowBlur = 24;
    ctx.fillText('☀  DAWN REACHED!  ☀', world.w / 2, p.y + 92);
    ctx.shadowBlur = 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('You carried the light through all 10 waves. You win!', world.w / 2, p.y + 132);
    ctx.font = 'bold 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`SCORE  ${world.score}`, world.w / 2, p.y + 182);
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`Best ${world.best}${world.newBest ? '  ·  NEW BEST!' : ''}`, world.w / 2, p.y + 214);
    const pulse = 0.65 + Math.sin(world.time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('C — KEEP GOING (ENDLESS)      ENTER — PLAY AGAIN', world.w / 2, p.y + 262);
    ctx.globalAlpha = 1;
  }

  _gameOverScreen(world) {
    const p = this._panel(world.w, world.h, 'GAME OVER', PALETTE.danger);
    const { ctx } = this;
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 44px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('THE LIGHT FADES', world.w / 2, p.y + 88);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`SCORE  ${world.score}`, world.w / 2, p.y + 140);
    ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(`Wave reached ${world.wave}  ·  Shards gathered ${world.shardsCollected}`, world.w / 2, p.y + 176);
    ctx.fillText(`Best ${world.best}${world.newBest ? '  ·  NEW BEST!' : ''}`, world.w / 2, p.y + 204);
    const pulse = 0.65 + Math.sin(world.time * 4) * 0.35;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('▶  PRESS ENTER TO PLAY AGAIN', world.w / 2, p.y + 256);
    ctx.globalAlpha = 1;
  }
}
