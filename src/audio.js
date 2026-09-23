// Procedural sound: everything synthesized with Web Audio. Low levels, soft highs.
export class Audio {
  constructor() { this.ctx = null; this.muted = localStorageGet('skytether.mute') === '1'; this.stepT = 0; }
  start() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    // master chain: gentle lowpass + compressor keeps everything soft
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.55;
    const tone = c.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 7000;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 4;
    this.master.connect(tone); tone.connect(comp); comp.connect(c.destination);
    this.noise = this.makeNoise(2);
    // wind: looping noise through band-pass, driven by speed
    this.wind = this.loopNoise(); this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.Q.value = 0.7; this.windF.frequency.value = 300;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    this.wind.connect(this.windF); this.windF.connect(this.windG); this.windG.connect(this.master);
    // city bed: brown-ish rumble + distant traffic, volume by altitude
    this.city = this.loopNoise(); const cf = c.createBiquadFilter(); cf.type = 'lowpass'; cf.frequency.value = 220;
    this.cityG = c.createGain(); this.cityG.gain.value = 0.0;
    this.city.connect(cf); cf.connect(this.cityG); this.cityG.connect(this.master);
    // occasional soft horn timer
    this.hornT = 6 + Math.random() * 8;
  }
  makeNoise(sec) {
    const c = this.ctx, b = c.createBuffer(1, c.sampleRate * sec, c.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = last * 0.96 + w * 0.04; d[i] = w * 0.5 + last * 3; }
    return b;
  }
  loopNoise() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(); return s; }
  setMuted(m) { this.muted = m; localStorageSet('skytether.mute', m ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.05); }
  env(node, peak, a, d, t0) { const g = this.ctx.createGain(), t = t0 ?? this.ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); node.connect(g); g.connect(this.master); return g; }
  burst(type, f0, f1, dur, peak, q = 1) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 1;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; const t = c.currentTime;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    s.connect(f); this.env(f, peak, 0.008, dur, t); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }
  tone(freq, dur, peak, type = 'sine', t0) {
    const c = this.ctx, o = c.createOscillator(), t = t0 ?? c.currentTime; o.type = type; o.frequency.value = freq;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; o.connect(f);
    this.env(f, peak, 0.01, dur, t); o.start(t); o.stop(t + dur + 0.05);
  }
  play(ev) {
    if (!this.ctx || this.muted) return;
    switch (ev) {
      case 'shoot': this.burst('bandpass', 2400, 700, 0.16, 0.22, 2.5); this.tone(520, 0.08, 0.05, 'triangle'); break; // soft zip
      case 'release': this.burst('lowpass', 900, 250, 0.22, 0.18); break;
      case 'jump': this.burst('lowpass', 600, 200, 0.12, 0.16); break;
      case 'land': this.burst('lowpass', 380, 60, 0.28, 0.4); this.tone(70, 0.18, 0.2); break;
      case 'wall': this.burst('bandpass', 800, 400, 0.08, 0.14, 1.5); break;
      case 'vault': this.burst('lowpass', 700, 200, 0.15, 0.16); break;
      case 'step': this.burst('lowpass', 500, 150, 0.05, 0.07); break;
      case 'grip': this.burst('bandpass', 1200, 900, 0.04, 0.05, 3); break;
      case 'event': { const t = this.ctx.currentTime; this.tone(659, 0.35, 0.07, 'triangle', t); this.tone(880, 0.5, 0.06, 'triangle', t + 0.14); break; }
      case 'win': { const t = this.ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 0.06, 'triangle', t + i * 0.09)); break; }
      case 'fail': { const t = this.ctx.currentTime; this.tone(392, 0.4, 0.06, 'triangle', t); this.tone(311, 0.6, 0.05, 'triangle', t + 0.18); break; }
      case 'district': { const t = this.ctx.currentTime; [392, 587, 784].forEach((f, i) => this.tone(f, 1.2, 0.04, 'sine', t + i * 0.12)); break; }
      case 'ui': this.tone(740, 0.06, 0.04, 'triangle'); break;
    }
  }
  update(dt, player) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, sp = player.speed();
    const w = Math.min(1, Math.max(0, (sp - 8) / 45));
    this.windG.gain.setTargetAtTime(w * w * 0.28, t, 0.15);
    this.windF.frequency.setTargetAtTime(250 + w * 1100, t, 0.2);
    const alt = Math.min(1, player.p.y / 120);
    this.cityG.gain.setTargetAtTime(0.10 * (1 - alt * 0.75), t, 0.4);
    // footsteps
    if (player.state === 'ground' && sp > 1.5) { this.stepT -= dt * sp / 2.6; if (this.stepT <= 0) { this.stepT = 1; this.play('step'); } }
    else if (player.state === 'wall' && Math.abs(player.v.y) > 2) { this.stepT -= dt * 5; if (this.stepT <= 0) { this.stepT = 1; this.play('grip'); } }
    // distant horn, very soft, only near street level
    if ((this.hornT -= dt) <= 0) {
      this.hornT = 8 + Math.random() * 14;
      if (!this.muted && player.p.y < 50) { const f = 330 + Math.random() * 80; this.tone(f, 0.25, 0.018 * (1 - alt), 'sawtooth'); this.tone(f * 1.25, 0.25, 0.012 * (1 - alt), 'sawtooth'); }
    }
  }
}
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { } }
