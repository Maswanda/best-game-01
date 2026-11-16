// Lumen Drift — all sound is synthesized with WebAudio. No audio files are
// shipped, so the game loads nothing over the network and plays offline.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }

  // Must be called from a user gesture (Enter, click, keypress).
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // A short oscillator blip with a pitch glide.
  blip(freqFrom, freqTo, dur, type = 'sine', vol = 0.22, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // Filtered noise burst (whoosh / thud).
  noise(dur, filterFreq, vol = 0.25, delay = 0, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  // Pickup: pitch climbs with the combo so a hot streak sounds hot.
  pickup(combo) {
    const step = Math.min(combo, 24);
    const base = 520 * Math.pow(1.059463, step);
    this.blip(base, base * 1.5, 0.12, 'sine', 0.2);
    this.blip(base * 2, base * 2.4, 0.08, 'triangle', 0.07, 0.02);
  }

  dash() {
    this.noise(0.22, 2600, 0.16, 0, 'bandpass');
    this.blip(300, 900, 0.14, 'sine', 0.08);
  }

  hit() {
    this.noise(0.3, 320, 0.35, 0, 'lowpass');
    this.blip(160, 55, 0.28, 'sawtooth', 0.22);
  }

  shieldBreak() {
    this.blip(880, 220, 0.25, 'square', 0.12);
    this.noise(0.18, 1800, 0.14, 0, 'highpass');
  }

  powerup() {
    [523, 659, 784].forEach((f, i) => this.blip(f, f, 0.12, 'triangle', 0.14, i * 0.07));
  }

  waveUp(wave) {
    const root = 392 * Math.pow(1.059463, Math.min(wave, 12));
    [0, 4, 7, 12].forEach((s, i) =>
      this.blip(root * Math.pow(1.059463, s), root * Math.pow(1.059463, s), 0.16, 'triangle', 0.13, i * 0.08));
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.blip(f, f * 0.94, 0.3, 'sine', 0.16, i * 0.16));
  }

  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.blip(f, f, 0.22, 'triangle', 0.15, i * 0.1));
    this.blip(262, 262, 0.5, 'sine', 0.1, 0.5);
  }

  // A slow, quiet pad that drifts under the game. One soft note per beat,
  // cycling a calm minor arpeggio. Start/stop with the game state.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = [220, 261.6, 329.6, 392, 440, 523.3];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = scale[this.musicStep % scale.length];
      this.blip(f, f, 0.9, 'sine', 0.035);
      if (this.musicStep % 4 === 2) this.blip(f / 2, f / 2, 1.4, 'sine', 0.025);
      this.musicStep++;
    }, 420);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
