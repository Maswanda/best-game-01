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
    this._mote(world);
    for (const p of world.particles) this._particle(p);
    for (const f of world.floats) this._floatText(f);
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

  _wisp(w) {
    const { ctx } = this;
    const pulse = 1 + Math.sin(w.phase) * 0.12;
    this._glow(w.x, w.y, w.r * 3.4 * pulse, 'rgba(255,93,143,0.5)');
    ctx.save();
    ctx.translate(w.x, w.y);
    // Spiky shadow blob.
    ctx.fillStyle = PALETTE.wisp;
    ctx.beginPath();
    const spikes = 8;
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const rr = (i % 2 === 0 ? w.r : w.r * 0.62) * pulse;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // Eyes.
    ctx.fillStyle = '#fff';
    const ex = w.r * 0.32;
    const ey = -w.r * 0.12;
    ctx.beginPath(); ctx.arc(-ex, ey, w.r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, w.r * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.wispCore;
    ctx.beginPath(); ctx.arc(-ex, ey, w.r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, w.r * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  _powerup(p) {
    const { ctx } = this;
    const color = p.type === 'shield' ? PALETTE.shield
      : p.type === 'magnet' ? PALETTE.magnet : PALETTE.slow;
    const blink = p.life - p.age < 3 ? (Math.sin(p.age * 10) > 0 ? 1 : 0.4) : 1;
    const bob = Math.sin(p.phase) * 3;
    const glowColor = p.type === 'shield' ? 'rgba(125,215,255,0.5)'
      : p.type === 'magnet' ? 'rgba(255,209,102,0.5)' : 'rgba(179,136,255,0.5)';
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
    ctx.fillText(p.type === 'shield' ? 'S' : p.type === 'magnet' ? 'M' : 'T', 0, 1);
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

    // Combo meter (below the score).
    if (world.combo > 1 && world.state === 'playing') {
      const frac = world.comboTimer / CONFIG.comboWindow;
      ctx.textAlign = 'left';
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
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
    ctx.fillText('DASH  ·  Space or Click  (brief shield while dashing)', w / 2, h * 0.52 + 28);
    ctx.fillText('COLLECT shards to build a combo — reach WAVE 10 to bring the DAWN', w / 2, h * 0.52 + 56);
    ctx.fillText('Grab S (shield), M (magnet) and T (slow time) power-ups', w / 2, h * 0.52 + 84);
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
