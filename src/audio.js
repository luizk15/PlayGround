/* ============================================================
   ZONA MORTA — synthesized audio engine (no external assets)
   ============================================================ */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = [];
    this.noiseBuffer = null;
    this.lastGroan = 0;
    this.fireLoop = null;
    this.sawLoop = null;
    this.started = false;
  }

  async init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : .72;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoise(2.2, 'white');
    this.startAmbient();
    this.started = true;
  }

  makeNoise(seconds, kind = 'white') {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') { last = (last + .02 * w) / 1.02; data[i] = last * 3.5; }
      else data[i] = w;
    }
    return buffer;
  }

  startAmbient() {
    const ctx = this.ctx;
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer; wind.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 340; filter.Q.value = .4;
    const gain = ctx.createGain(); gain.gain.value = .035;
    wind.connect(filter).connect(gain).connect(this.master);
    wind.start();
    this.ambientNodes.push(wind);

    const drone = ctx.createGain(); drone.gain.value = .022;
    drone.connect(this.master);
    for (const f of [41.2, 55.0, 82.4]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.value = .32;
      const lfo = ctx.createOscillator(); lfo.frequency.value = .05 + Math.random() * .08;
      const lg = ctx.createGain(); lg.gain.value = f * .006;
      lfo.connect(lg).connect(o.frequency); lfo.start();
      o.connect(g).connect(drone); o.start();
      this.ambientNodes.push(o, lfo);
    }
    this.ambientNodes.push(drone);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : .72, this.ctx.currentTime, .04);
  }

  noiseBurst({ duration = .12, freq = 900, q = 1, gain = .3, type = 'bandpass', decay = .05, pan = 0, playbackRate = 1 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = playbackRate;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + .005);
    g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    let node = src.connect(filter).connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    src.start(t, Math.random() * .8, duration + .02);
    src.stop(t + duration + .03);
  }

  tone({ freq = 120, end = 60, duration = .18, type = 'sine', gain = .22, attack = .004, pan = 0, sweep = true }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(10, end), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + duration);
    let node = o.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); p.connect(this.master);
    } else g.connect(this.master);
    o.start(t); o.stop(t + duration + .02);
  }

  gun(w, pan = 0) {
    if (!this.ctx) return;
    const s = w.sound || {};
    if (s.melee) { this.melee(w); return; }
    if (s.fire) { this.noiseBurst({ duration: .12, freq: 620, q: .5, gain: .1, type: 'lowpass', pan }); this.tone({ freq: 90, end: 50, duration: .14, gain: .07 }); return; }
    if (s.freeze) { this.tone({ freq: 820, end: 310, duration: .12, type: 'triangle', gain: .045, pan }); this.noiseBurst({ duration: .09, freq: 2200, q: .8, gain: .045, pan }); return; }
    if (s.zap) {
      this.tone({ freq: 1200, end: 110, duration: .22, type: 'sawtooth', gain: .09, pan });
      this.noiseBurst({ duration: .16, freq: 2600, q: 2.5, gain: .1, pan });
      this.tone({ freq: 70, end: 40, duration: .14, gain: .07 });
      return;
    }
    if (s.silent) {
      this.tone({ freq: 170, end: 80, duration: .09, type: 'triangle', gain: .08, pan });
      this.noiseBurst({ duration: .05, freq: 900, q: 2, gain: .05, pan });
      return;
    }
    if (s.nail) {
      this.noiseBurst({ duration: .055, freq: 2400, q: 2.4, gain: .12, pan });
      this.tone({ freq: 260, end: 110, duration: .05, gain: .09, pan });
      return;
    }
    if (s.rocket) {
      this.noiseBurst({ duration: .55, freq: 780, q: .5, gain: .3, type: 'lowpass', pan });
      this.tone({ freq: 85, end: 34, duration: .5, gain: .3, pan });
      this.tone({ freq: 380, end: 120, duration: .35, type: 'sawtooth', gain: .06, pan });
      return;
    }
    const crack = s.crack ?? .28;
    const body = s.body ?? 110;
    const gain = s.gain ?? .4;
    this.noiseBurst({ duration: .055 + crack * .1, freq: 1600 + crack * 1800, q: .7 + crack, gain: gain * .85, type: 'highpass', pan, playbackRate: .9 + Math.random() * .15 });
    this.noiseBurst({ duration: .07 + crack * .12, freq: 500, q: 1.1, gain: gain * .45, type: 'lowpass', pan });
    this.tone({ freq: body, end: body * .35, duration: .09 + crack * .12, type: 'sine', gain: gain * .45, pan });
    if (crack > .5) this.tone({ freq: 180, end: 50, duration: .25, type: 'triangle', gain: gain * .22, pan });
  }

  melee(w) {
    if (!this.ctx) return;
    const saw = w.sound?.saw;
    if (saw) {
      this.tone({ freq: 62, end: 54, duration: .1, type: 'sawtooth', gain: .08 });
      this.noiseBurst({ duration: .09, freq: 700, q: 1.8, gain: .07, type: 'bandpass' });
      return;
    }
    this.noiseBurst({ duration: .16, freq: 1400, q: .6, gain: .12, type: 'bandpass' });
    this.tone({ freq: 340, end: 140, duration: .15, type: 'triangle', gain: .05 });
  }

  hit(head = false, pan = 0) {
    if (head) {
      this.tone({ freq: 880, end: 620, duration: .1, type: 'sine', gain: .2, pan });
      this.tone({ freq: 1320, end: 980, duration: .07, type: 'sine', gain: .1, pan });
    } else {
      this.noiseBurst({ duration: .07, freq: 380, q: 1.4, gain: .15, type: 'lowpass', pan });
      this.tone({ freq: 160, end: 70, duration: .07, gain: .1, pan });
    }
  }

  bodyHit(pan = 0) {
    this.noiseBurst({ duration: .13, freq: 240, q: .9, gain: .2, type: 'lowpass', pan });
  }

  zombieGroan(pan = 0, variant = 0) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastGroan < .7) return;
    this.lastGroan = now;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(.0001, now);
    g.gain.linearRampToValueAtTime(.045, now + .08);
    g.gain.exponentialRampToValueAtTime(.0001, now + .8 + Math.random() * .5);
    const o = this.ctx.createOscillator();
    o.type = variant === 1 ? 'sawtooth' : 'triangle';
    const base = variant === 1 ? 54 : 68 + Math.random() * 26;
    o.frequency.setValueAtTime(base, now);
    o.frequency.linearRampToValueAtTime(base * .62, now + .9);
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 4 + Math.random() * 5;
    const lg = this.ctx.createGain(); lg.gain.value = 8;
    lfo.connect(lg).connect(o.frequency);
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 2.4;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-.8, Math.min(.8, pan)); g.connect(p); p.connect(this.master); } else g.connect(this.master);
    o.connect(filter).connect(g);
    o.start(now); lfo.start(now); o.stop(now + 1.4); lfo.stop(now + 1.4);
  }

  zombieDeath(pan = 0) {
    this.noiseBurst({ duration: .32, freq: 380, q: 1.2, gain: .11, type: 'lowpass', pan });
    this.tone({ freq: 84, end: 38, duration: .4, type: 'sawtooth', gain: .06, pan });
  }

  reload(weapon = null) {
    if (!this.ctx) return;
    const clicks = weapon?.melee ? 1 : 3;
    for (let i = 0; i < clicks; i++) {
      setTimeout(() => {
        this.noiseBurst({ duration: .035, freq: 2200 + Math.random() * 800, q: 2, gain: .09 });
        this.tone({ freq: 420 + Math.random() * 100, end: 260, duration: .035, gain: .03 });
      }, i * 140 + Math.random() * 60);
    }
  }

  empty() { this.noiseBurst({ duration: .03, freq: 3200, q: 4, gain: .12 }); this.tone({ freq: 500, end: 280, duration: .035, gain: .04 }); }
  explosion(pan = 0) {
    if (!this.ctx) return;
    this.noiseBurst({ duration: 1.2, freq: 140, q: .6, gain: .9, type: 'lowpass', pan, playbackRate: .6 });
    this.noiseBurst({ duration: .5, freq: 1800, q: .5, gain: .38, type: 'lowpass', pan });
    this.tone({ freq: 58, end: 21, duration: 1.3, type: 'sine', gain: .72, pan });
  }
  pickup(kind = 'ammo') {
    if (kind === 'health') { this.tone({ freq: 520, end: 760, duration: .18, type: 'sine', gain: .11 }); this.tone({ freq: 780, end: 980, duration: .15, type: 'sine', gain: .07 }); }
    else { this.tone({ freq: 380, end: 590, duration: .12, type: 'square', gain: .045 }); this.tone({ freq: 720, end: 880, duration: .1, type: 'sine', gain: .06 }); }
  }
  waveStart() {
    if (!this.ctx) return;
    this.tone({ freq: 74, end: 55, duration: 1.4, type: 'sawtooth', gain: .13, sweep: false });
    this.tone({ freq: 200, end: 200, duration: 1.6, type: 'sine', gain: .05, sweep: false });
    setTimeout(() => this.tone({ freq: 148, end: 110, duration: 1.2, type: 'triangle', gain: .08, sweep: false }), 220);
  }
  waveClear() {
    if (!this.ctx) return;
    [440, 554, 659].forEach((f, i) => setTimeout(() => this.tone({ freq: f, end: f, duration: .28, type: 'sine', gain: .08, sweep: false }), i * 100));
  }
  hurt() {
    this.noiseBurst({ duration: .18, freq: 200, q: .8, gain: .25, type: 'lowpass' });
    this.tone({ freq: 95, end: 50, duration: .18, type: 'triangle', gain: .14 });
  }
  death() {
    if (!this.ctx) return;
    this.tone({ freq: 92, end: 27, duration: 2.0, type: 'sawtooth', gain: .25 });
    this.noiseBurst({ duration: 1.5, freq: 200, q: .5, gain: .3, type: 'lowpass', playbackRate: .5 });
    this.tone({ freq: 41, end: 20, duration: 2.3, type: 'sine', gain: .3 });
  }
  step(sprint = false) {
    this.noiseBurst({ duration: .06, freq: 170 + Math.random() * 80, q: .8, gain: sprint ? .07 : .04, type: 'lowpass', playbackRate: .8 });
  }
  ui() { this.tone({ freq: 680, end: 520, duration: .055, type: 'square', gain: .025 }); }
  spawn() {
    this.noiseBurst({ duration: .4, freq: 240, q: 1.4, gain: .08, type: 'lowpass' });
    this.tone({ freq: 122, end: 48, duration: .4, type: 'triangle', gain: .06 });
  }
  alarm() {
    if (!this.ctx) return;
    this.tone({ freq: 520, end: 760, duration: .4, type: 'sawtooth', gain: .055, sweep: false });
    setTimeout(() => this.tone({ freq: 760, end: 520, duration: .45, type: 'sawtooth', gain: .05, sweep: false }), 480);
  }
}
