/**
 * Kleiner Browser-Synthesizer für die MV-Übungen. Alle Klänge werden mit der
 * Web Audio API erzeugt (keine Dateien), Timing über AudioContext.currentTime.
 */

export type Instrument =
  | 'kick' | 'snare' | 'clap' | 'hat' | 'openhat' | 'ride' | 'rim'
  | 'clave' | 'cowbell' | 'shaker' | 'click' | 'bass' | 'chord' | 'piano';

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class MvSynth {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  /** Muss nach einer Nutzeraktion aufgerufen werden (Autoplay-Regeln). */
  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  private env(t: number, peak: number, decay: number) {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    g.connect(this.master!);
    return g;
  }

  private osc(type: OscillatorType, freq: number, t: number, dur: number, out: AudioNode) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private noiseBurst(t: number, dur: number, out: AudioNode, filter?: { type: BiquadFilterType; freq: number; q?: number }) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    let node: AudioNode = src;
    if (filter) {
      const f = this.ctx!.createBiquadFilter();
      f.type = filter.type;
      f.frequency.value = filter.freq;
      if (filter.q) f.Q.value = filter.q;
      src.connect(f);
      node = f;
    }
    node.connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  /** Spielt ein Instrument zum Zeitpunkt t (AudioContext-Zeit). */
  play(inst: Instrument, t: number, opts: { accent?: boolean; notes?: number[]; dur?: number } = {}) {
    if (!this.ctx || !this.master) return;
    const v = opts.accent ? 1 : 0.75;
    switch (inst) {
      case 'kick': {
        const g = this.env(t, 1.0 * v, 0.45);
        const o = this.osc('sine', 150, t, 0.45, g);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
        break;
      }
      case 'snare': {
        this.noiseBurst(t, 0.2, this.env(t, 0.5 * v, 0.2), { type: 'highpass', freq: 1500 });
        this.osc('triangle', 190, t, 0.12, this.env(t, 0.35 * v, 0.12));
        break;
      }
      case 'clap': {
        for (const d of [0, 0.011, 0.022]) this.noiseBurst(t + d, 0.03, this.env(t + d, 0.35 * v, 0.03), { type: 'bandpass', freq: 1200, q: 1.5 });
        this.noiseBurst(t + 0.03, 0.18, this.env(t + 0.03, 0.4 * v, 0.18), { type: 'bandpass', freq: 1200, q: 1.2 });
        break;
      }
      case 'hat':
        this.noiseBurst(t, 0.05, this.env(t, 0.22 * v, 0.05), { type: 'highpass', freq: 7500 });
        break;
      case 'openhat':
        this.noiseBurst(t, 0.3, this.env(t, 0.2 * v, 0.3), { type: 'highpass', freq: 7000 });
        break;
      case 'ride': {
        this.noiseBurst(t, 0.5, this.env(t, 0.12 * v, 0.5), { type: 'bandpass', freq: 6000, q: 0.8 });
        this.osc('square', 3150, t, 0.3, this.env(t, 0.03 * v, 0.3));
        break;
      }
      case 'rim':
        this.osc('square', 1700, t, 0.03, this.env(t, 0.25 * v, 0.03));
        break;
      case 'clave':
        this.osc('sine', 2500, t, 0.06, this.env(t, 0.6 * v, 0.06));
        break;
      case 'cowbell': {
        const g = this.env(t, 0.25 * v, 0.25);
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 800;
        f.connect(g);
        this.osc('square', 540, t, 0.25, f);
        this.osc('square', 800, t, 0.25, f);
        break;
      }
      case 'shaker':
        this.noiseBurst(t, 0.06, this.env(t, 0.12 * v, 0.06), { type: 'bandpass', freq: 5000, q: 1 });
        break;
      case 'click':
        this.osc('sine', opts.accent ? 1600 : 1000, t, 0.03, this.env(t, 0.4, 0.03));
        break;
      case 'bass':
        for (const n of opts.notes ?? [36]) this.osc('triangle', midiToFreq(n), t, opts.dur ?? 0.35, this.env(t, 0.6 * v, opts.dur ?? 0.35));
        break;
      case 'chord':
        for (const n of opts.notes ?? [60, 64, 67]) this.osc('triangle', midiToFreq(n), t, opts.dur ?? 0.2, this.env(t, 0.18 * v, opts.dur ?? 0.2));
        break;
      case 'piano':
        for (const n of opts.notes ?? [60]) {
          const d = opts.dur ?? 0.9;
          this.osc('triangle', midiToFreq(n), t, d, this.env(t, 0.35, d));
          this.osc('sine', midiToFreq(n) * 2, t, d * 0.6, this.env(t, 0.08, d * 0.6));
        }
        break;
    }
  }
}

/** Eine gemeinsame Instanz für alle Übungen. */
export const mvSynth = new MvSynth();
