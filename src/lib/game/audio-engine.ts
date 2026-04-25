
"use client";

/**
 * AudioEngine handles loading, decoding, and playback.
 * Extended with Noise Generation and Real-time Filtering for Ear Training.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Set<AudioBufferSourceNode> = new Set();
  private backingSource: AudioBufferSourceNode | null = null;
  private masterGain: GainNode | null = null;
  private backingGain: GainNode | null = null;
  private startTime: number = 0;
  private loadingPromises: Map<string, Promise<void>> = new Map();
  
  // Ear Training specific nodes
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;

  public static readonly METRONOME_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

  constructor() {}

  async resume(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!this.context) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAutoContext;
        this.context = new AudioContextClass({ sampleRate: 44100 });
        
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);

        this.backingGain = this.context.createGain();
        this.backingGain.connect(this.masterGain);
      } catch (e) {
        console.warn('AudioEngine: Context creation failed', e);
        return false;
      }
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context.state === 'running';
  }

  getContextTime(): number {
    return this.context ? this.context.currentTime : 0;
  }

  setStartTime(t: number) {
    this.startTime = t;
  }

  /**
   * Preloads a list of URLs into the buffer map.
   * Uses promises to avoid redundant fetches.
   */
  async preloadAudio(urls: string[]): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.context) await this.resume();
    if (!this.context) return;

    const allUrls = [...urls, AudioEngine.METRONOME_URL];
    const uniqueUrls = Array.from(new Set(allUrls.filter(u => !!u)));
    
    const promises = uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      
      // If already loading, wait for that promise
      if (this.loadingPromises.has(url)) {
        return this.loadingPromises.get(url);
      }

      const loadPromise = (async () => {
        try {
          const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          
          if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
          
          const arrayBuffer = await response.arrayBuffer();
          // decodeAudioData is faster when called on already fetched data
          const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
          
          this.buffers.set(url, audioBuffer);
        } catch (e) {
          console.warn(`AudioEngine: Non-critical load failure for ${url}`, e);
        } finally {
          this.loadingPromises.delete(url);
        }
      })();

      this.loadingPromises.set(url, loadPromise);
      return loadPromise;
    });

    await Promise.all(promises);
  }

  /**
   * Checks if all requested URLs are ready.
   */
  isReady(urls: string[]): boolean {
    const allUrls = [...urls, AudioEngine.METRONOME_URL];
    return allUrls.every(url => !url || this.buffers.has(url));
  }

  /**
   * Generates a 2-second Pink Noise buffer.
   */
  private createPinkNoiseBuffer(): AudioBuffer {
    const bufferSize = 2 * this.context!.sampleRate;
    const buffer = this.context!.createBuffer(1, bufferSize, this.context!.sampleRate);
    const output = buffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  async startNoise(frequency: number = 1000, q: number = 1, type: BiquadFilterType = 'peaking') {
    await this.resume();
    this.stopNoise();

    if (!this.context) return;

    this.noiseGain = this.context.createGain();
    this.noiseGain.gain.setValueAtTime(0, this.context.currentTime);
    this.noiseGain.gain.linearRampToValueAtTime(0.5, this.context.currentTime + 0.1);

    this.noiseFilter = this.context.createBiquadFilter();
    this.noiseFilter.type = type;
    this.noiseFilter.frequency.setValueAtTime(frequency, this.context.currentTime);
    this.noiseFilter.Q.setValueAtTime(q, this.context.currentTime);
    this.noiseFilter.gain.setValueAtTime(15, this.context.currentTime);

    this.noiseSource = this.context.createBufferSource();
    this.noiseSource.buffer = this.createPinkNoiseBuffer();
    this.noiseSource.loop = true;

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.masterGain!);

    this.noiseSource.start();
  }

  updateFilter(frequency: number, q: number = 1) {
    if (this.noiseFilter && this.context) {
      this.noiseFilter.frequency.setTargetAtTime(frequency, this.context.currentTime, 0.05);
      this.noiseFilter.Q.setTargetAtTime(q, this.context.currentTime, 0.05);
    }
  }

  stopNoise() {
    if (this.noiseGain && this.context) {
      this.noiseGain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.1);
      const source = this.noiseSource;
      setTimeout(() => {
        try { source?.stop(); } catch(e) {}
      }, 150);
    }
    this.noiseSource = null;
    this.noiseFilter = null;
    this.noiseGain = null;
  }

  async playOneShot(url: string) {
    await this.resume();
    const buffer = this.buffers.get(url);
    if (!buffer) return;

    try {
      const source = this.context!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain!);
      source.start(0);
      source.onended = () => this.sources.delete(source);
      this.sources.add(source);
    } catch (e) {
      console.warn('AudioEngine: One-shot playback failed', e);
    }
  }

  async playCountIn(bpm: number, onTick: (beat: number) => void): Promise<void> {
    await this.resume();
    const buffer = this.buffers.get(AudioEngine.METRONOME_URL);
    if (!buffer || !this.context) {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => onTick(i + 1), i * (60 / bpm) * 1000);
      }
      return new Promise(r => setTimeout(r, 4 * (60 / bpm) * 1000));
    }

    const secondsPerBeat = 60 / bpm;
    const now = this.context.currentTime;

    for (let i = 0; i < 4; i++) {
      const scheduleTime = now + (i * secondsPerBeat);
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain!);
      source.start(scheduleTime);
      setTimeout(() => onTick(i + 1), i * secondsPerBeat * 1000);
    }

    return new Promise(resolve => setTimeout(resolve, 4 * secondsPerBeat * 1000));
  }

  async startBackingTrack(url: string, when: number = 0) {
    await this.resume();
    this.stopBackingTrack();

    const buffer = this.buffers.get(url);
    if (!buffer || !this.context || !this.backingGain) {
      console.warn('AudioEngine: Backing track buffer not ready for URL:', url);
      return;
    }

    try {
      this.backingGain.gain.cancelScheduledValues(this.context.currentTime);
      this.backingGain.gain.setValueAtTime(1, this.context.currentTime);

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.backingGain);
      source.start(when);
      this.backingSource = source;
    } catch (e) {
      console.warn('AudioEngine: Backing track start failed', e);
    }
  }

  async fadeBackingTrack(duration: number = 2) {
    if (!this.context || !this.backingGain) return;
    const now = this.context.currentTime;
    this.backingGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
  }

  stopBackingTrack() {
    if (this.backingSource) {
      try { this.backingSource.stop(); } catch(e) {}
      this.backingSource = null;
    }
  }

  stop() {
    this.stopBackingTrack();
    this.stopNoise();
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
  }

  getCurrentTime(): number {
    return this.context ? this.context.currentTime - this.startTime : 0;
  }
}

export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;
