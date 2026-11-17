// Lumen Drift — all sound is synthesized with WebAudio. No audio files are
// shipped, so the game loads nothing over the network and plays offline.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.tempo = 420;      // ms per music beat; quickens as waves rise
    this.mode = 'calm';    // 'calm' | 'boss'
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

  dashKill() {
    this.blip(700, 1500, 0.09, 'triangle', 0.16);
    this.noise(0.08, 3200, 0.08, 0, 'bandpass');
  }

  chip() {
    this.blip(500, 240, 0.1, 'square', 0.12);
    this.noise(0.06, 2000, 0.1, 0, 'bandpass');
  }

  split() {
    this.blip(600, 900, 0.07, 'triangle', 0.12);
    this.blip(600, 900, 0.07, 'triangle', 0.12, 0.06);
  }

  charge() {
    this.noise(0.3, 900, 0.12, 0, 'bandpass');
    this.blip(180, 520, 0.28, 'sawtooth', 0.06);
  }

  bossSpawn() {
    this.blip(110, 55, 0.7, 'sawtooth', 0.2);
    this.noise(0.5, 240, 0.25, 0, 'lowpass');
  }

  bossHit() {
    this.blip(140, 60, 0.2, 'sawtooth', 0.2);
    this.noise(0.16, 500, 0.22, 0, 'lowpass');
  }

  bossDie() {
    [523, 392, 330, 262, 196].forEach((f, i) => this.blip(f, f * 0.94, 0.25, 'triangle', 0.15, i * 0.09));
    this.noise(0.5, 300, 0.3, 0.1, 'lowpass');
  }

  nova() {
    this.blip(400, 1600, 0.4, 'sine', 0.14);
    this.noise(0.4, 1200, 0.2, 0.05, 'bandpass');
    this.noise(0.3, 300, 0.25, 0.15, 'lowpass');
  }

  lifeUp() {
    [523, 659, 784, 1047].forEach((f, i) => this.blip(f, f, 0.14, 'triangle', 0.14, i * 0.07));
  }

  orbBurst() {
    this.noise(0.18, 1400, 0.1, 0, 'bandpass');
    this.blip(300, 180, 0.12, 'sine', 0.08);
  }

  summon() {
    this.blip(220, 110, 0.3, 'sawtooth', 0.1);
    this.noise(0.2, 800, 0.1, 0, 'bandpass');
  }

  // The music quickens as the waves rise. Restarts the loop when the
  // tempo actually changes so the new beat applies at once.
  setIntensity(wave) {
    const tempo = Math.max(300, 420 - (wave - 1) * 12);
    if (tempo === this.tempo) return;
    this.tempo = tempo;
    this._restartMusic();
  }

  // Boss fights switch the pad to a lower, tenser minor loop with a
  // heartbeat thud; clearing the boss returns to the calm loop.
  setBossMode(on) {
    const mode = on ? 'boss' : 'calm';
    if (mode === this.mode) return;
    this.mode = mode;
    this._restartMusic();
  }

  _restartMusic() {
    if (!this.musicTimer) return;
    this.stopMusic();
    this.startMusic();
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
  // cycling a calm minor arpeggio; boss mode drops it to a lower, tenser
  // loop with a heartbeat thud. Start/stop with the game state.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const scale = this.mode === 'boss'
      ? [196, 233.1, 261.6, 311.1, 349.2, 392]
      : [220, 261.6, 329.6, 392, 440, 523.3];
    const tempo = this.tempo;
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx) return;
      const f = scale[this.musicStep % scale.length];
      this.blip(f, f, 0.9, 'sine', this.mode === 'boss' ? 0.045 : 0.035);
      if (this.musicStep % 4 === 2) this.blip(f / 2, f / 2, 1.4, 'sine', 0.025);
      if (this.mode === 'boss' && this.musicStep % 2 === 0) {
        this.blip(98, 98, 0.5, 'triangle', 0.05);
      }
      this.musicStep++;
    }, tempo);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
