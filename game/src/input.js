// Lumen Drift — keyboard, mouse and touch input. The game reads a single
// snapshot each frame: a movement vector, whether dash was pressed, and the
// pointer position. Edge-triggered actions (dash, start, pause) are consumed
// once by the world, so a held key never double-fires.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pointer = { x: 0, y: 0, active: false, inside: false };
    this.lastDevice = 'keyboard'; // 'keyboard' | 'pointer'
    this.dashQueued = false;
    this.confirmQueued = false; // Enter / Space on a menu screen
    this.pauseQueued = false;
    this.muteQueued = false;
    this.continueQueued = false; // C on the victory screen
    this._canvas = canvas;
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onPointerMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.pointer.x = e.clientX - r.left;
      this.pointer.y = e.clientY - r.top;
      this.pointer.active = true;
      this.pointer.inside = true;
      this.lastDevice = 'pointer';
    };
    this._onPointerDown = (e) => {
      this._onPointerMove(e);
      this.dashQueued = true;
    };
    this._onPointerLeave = () => { this.pointer.inside = false; };
    this._onBlur = () => { this.keys.clear(); };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('pointerdown', this._onPointerDown);
    canvas.addEventListener('pointerleave', this._onPointerLeave);
  }

  _key(e, down) {
    // Lowercase everything so multi-char names ('Enter', 'Escape', 'Shift',
    // 'ArrowUp') compare the same as single letters.
    const k = e.key.toLowerCase();
    const gameKeys = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (gameKeys.includes(e.key) || k === ' ') e.preventDefault();
    if (down) {
      if (e.repeat) return;
      this.keys.add(k);
      this.lastDevice = 'keyboard';
      if (k === ' ' || k === 'shift') this.dashQueued = true;
      if (k === 'enter' || k === ' ') this.confirmQueued = true;
      if (k === 'p' || k === 'escape') this.pauseQueued = true;
      if (k === 'm') this.muteQueued = true;
      if (k === 'c') this.continueQueued = true;
    } else {
      this.keys.delete(k);
    }
  }

  // Unit movement vector from WASD / arrow keys, or null when idle.
  moveVector() {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x === 0 && y === 0) return null;
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  // Consume the queued edge actions (called once per frame by the world).
  consume() {
    const out = {
      dash: this.dashQueued,
      confirm: this.confirmQueued,
      pause: this.pauseQueued,
      mute: this.muteQueued,
      continue: this.continueQueued,
    };
    this.dashQueued = false;
    this.confirmQueued = false;
    this.pauseQueued = false;
    this.muteQueued = false;
    this.continueQueued = false;
    return out;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._canvas.removeEventListener('pointermove', this._onPointerMove);
    this._canvas.removeEventListener('pointerdown', this._onPointerDown);
    this._canvas.removeEventListener('pointerleave', this._onPointerLeave);
  }
}
