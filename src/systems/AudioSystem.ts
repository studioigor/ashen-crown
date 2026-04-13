import Phaser from 'phaser';

type SoundName =
  | 'select'
  | 'move'
  | 'attack'
  | 'build'
  | 'train'
  | 'gather'
  | 'deposit'
  | 'error'
  | 'impact'
  | 'death'
  | 'alert'
  | 'victory'
  | 'defeat';

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private reverbSend: GainNode | null = null;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private muted = false;
  private lastPlayed: Record<string, number> = {};

  constructor(private scene: Phaser.Scene) {}

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.2;
    return this.muted;
  }

  isMuted(): boolean { return this.muted; }

  /** Optional world-space playback — enables stereo panning based on unit position. */
  playAt(name: SoundName, worldX: number | null = null, volume = 1): void {
    this.play(name, volume, worldX);
  }

  play(name: SoundName, volume = 1, worldX: number | null = null): void {
    if (this.muted) return;
    const now = this.scene.time.now;
    const debounce = name === 'impact' || name === 'attack' ? 35 : 45;
    if ((this.lastPlayed[name] ?? 0) + debounce > now) return;
    this.lastPlayed[name] = now;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();

    // Compute pan based on world-x offset from camera center
    const cam = this.scene.cameras.main;
    let pan = 0;
    let attenuation = 1;
    if (worldX !== null) {
      const camCx = cam.worldView.centerX;
      const halfW = cam.worldView.width / 2 || 1;
      const dx = worldX - camCx;
      pan = Phaser.Math.Clamp(dx / halfW, -1, 1);
      const offscreen = Math.max(0, Math.abs(dx) - halfW) / halfW;
      attenuation = Math.max(0.25, 1 - offscreen * 0.7);
    }

    switch (name) {
      case 'select': this.tone(640 + rand(-40, 40), 0.04, 0.04 * volume * attenuation, 'square', pan); break;
      case 'move': this.tone(380 + rand(-30, 30), 0.06, 0.05 * volume * attenuation, 'triangle', pan); break;
      case 'attack': this.attackSfx(volume * attenuation, pan); break;
      case 'build': this.buildSfx(volume * attenuation, pan); break;
      case 'train': this.chord([460, 620, 880], 0.08, 0.045 * volume, pan); break;
      case 'gather': this.gatherSfx(volume * attenuation, pan); break;
      case 'deposit': this.chord([820 + rand(-20, 20), 1020 + rand(-20, 20)], 0.07, 0.04 * volume, pan); break;
      case 'error': this.chord([150, 110], 0.16, 0.07 * volume, pan); break;
      case 'impact': this.impactSfx(volume * attenuation, pan); break;
      case 'death': this.deathSfx(volume * attenuation, pan); break;
      case 'alert': this.chord([300, 380, 300, 450], 0.18, 0.065 * volume, pan); break;
      case 'victory': this.victoryStinger(volume); break;
      case 'defeat': this.defeatStinger(volume); break;
    }
  }

  startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    if (this.ambientOsc) return;
    // Gentle wind: low-passed brown noise
    const bufSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.035;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    this.ambientOsc = src as unknown as OscillatorNode;
    this.ambientGain = gain;

    // Sparse birds
    const bird = (): void => {
      if (this.muted || !ctx || !this.master) return;
      const osc = ctx.createOscillator();
      const bg = ctx.createGain();
      osc.type = 'triangle';
      const base = 1800 + Math.random() * 1500;
      osc.frequency.setValueAtTime(base, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(base * 1.4, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(base * 0.7, ctx.currentTime + 0.2);
      bg.gain.setValueAtTime(0.0001, ctx.currentTime);
      bg.gain.exponentialRampToValueAtTime(0.02, ctx.currentTime + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.26);
      osc.connect(bg);
      bg.connect(this.master);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    };
    const scheduleBird = (): void => {
      const d = 6000 + Math.random() * 14000;
      this.scene.time.delayedCall(d, () => {
        if (Math.random() < 0.8) bird();
        scheduleBird();
      });
    };
    scheduleBird();
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtor) return null;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.2;
    this.master.connect(this.ctx.destination);

    // Build reverb impulse response (short exponential decay)
    try {
      const ctx = this.ctx;
      const len = Math.floor(ctx.sampleRate * 1.5);
      const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = impulse.getChannelData(c);
        for (let i = 0; i < len; i++) {
          ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
        }
      }
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = impulse;
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.25;
      this.reverb.connect(this.reverbSend);
      this.reverbSend.connect(this.master);
    } catch {
      this.reverb = null;
    }
    return this.ctx;
  }

  private makeChain(pan: number): { pannerOut: AudioNode; wet: AudioNode | null } {
    if (!this.ctx || !this.master) return { pannerOut: this.master!, wet: null };
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(this.master);
    return { pannerOut: panner, wet: this.reverb };
  }

  private tone(freq: number, duration: number, volume: number, type: OscillatorType, pan = 0): void {
    if (!this.ctx || !this.master) return;
    const chain = this.makeChain(pan);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), this.ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(chain.pannerOut);
    if (chain.wet) {
      const send = this.ctx.createGain();
      send.gain.value = 0.15;
      gain.connect(send);
      send.connect(chain.wet);
    }
    osc.start();
    osc.stop(this.ctx.currentTime + duration + 0.02);
  }

  private chord(freqs: number[], duration: number, volume: number, pan = 0): void {
    freqs.forEach((f, i) => this.scene.time.delayedCall(i * 28, () => this.tone(f, duration, volume, 'triangle', pan)));
  }

  private noise(duration: number, volume: number, pan = 0, lowpass = 0): void {
    if (!this.ctx || !this.master) return;
    const chain = this.makeChain(pan);
    const size = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, size, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    if (lowpass > 0) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      src.connect(filter);
      filter.connect(gain);
    } else {
      src.connect(gain);
    }
    gain.connect(chain.pannerOut);
    if (chain.wet) {
      const send = this.ctx.createGain();
      send.gain.value = 0.2;
      gain.connect(send);
      send.connect(chain.wet);
    }
    src.start();
  }

  private attackSfx(vol: number, pan: number): void {
    // Layered: low boom + mid clang + high whoosh
    this.tone(140 + rand(-20, 20), 0.08, 0.05 * vol, 'sawtooth', pan);
    this.tone(420 + rand(-40, 40), 0.05, 0.035 * vol, 'square', pan);
    this.noise(0.045, 0.036 * vol, pan, 4200);
    if (Math.random() < 0.35) this.tone(760 + rand(-80, 80), 0.035, 0.022 * vol, 'triangle', pan);
  }

  private impactSfx(vol: number, pan: number): void {
    // Short thud layered with noise crack
    this.tone(90 + rand(-15, 15), 0.09, 0.06 * vol, 'sawtooth', pan);
    this.noise(0.08, 0.05 * vol, pan, 2000);
    this.scene.time.delayedCall(10, () => this.tone(260, 0.04, 0.03 * vol, 'square', pan));
  }

  private buildSfx(vol: number, pan: number): void {
    this.noise(0.07, 0.035 * vol, pan, 900);
    this.chord([220 + rand(-12, 12), 330, 440], 0.12, 0.05 * vol, pan);
  }

  private gatherSfx(vol: number, pan: number): void {
    this.noise(0.035, 0.025 * vol, pan, 3000);
    this.tone(520 + rand(-80, 80), 0.045, 0.026 * vol, 'triangle', pan);
  }

  private deathSfx(vol: number, pan: number): void {
    this.noise(0.2, 0.07 * vol, pan, 1800);
    this.tone(120, 0.15, 0.04 * vol, 'sawtooth', pan);
    this.tone(80, 0.25, 0.03 * vol, 'sine', pan);
  }

  private victoryStinger(vol: number): void {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      this.scene.time.delayedCall(i * 110, () => {
        this.tone(f, 0.35, 0.045 * vol, 'triangle', 0);
        this.tone(f / 2, 0.5, 0.035 * vol, 'sine', 0);
      });
    });
  }

  private defeatStinger(vol: number): void {
    const notes = [392, 349, 311, 262, 220];
    notes.forEach((f, i) => {
      this.scene.time.delayedCall(i * 180, () => {
        this.tone(f, 0.4, 0.055 * vol, 'sawtooth', 0);
        this.tone(f / 2, 0.6, 0.035 * vol, 'triangle', 0);
      });
    });
  }
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
