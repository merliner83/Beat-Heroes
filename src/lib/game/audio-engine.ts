
"use client";

/**
 * AudioEngine handles loading, decoding, and playback.
 * Optimized for CD Quality (44.1kHz).
 * Robust error handling to prevent blocking game state.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Set<AudioBufferSourceNode> = new Set();
  private backingSource: AudioBufferSourceNode | null = null;
  private masterGain: GainNode | null = null;
  private startTime: number = 0;
  private loadingStatus: Map<string, 'loading' | 'ready' | 'failed'> = new Map();
  
  public static readonly METRONOME_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

  constructor() {
    // Initialized only when window is available
  }

  async resume(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!this.context) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAutoContext;
        this.context = new AudioContextClass({ sampleRate: 44100 });
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
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
   * Preloads audio files. Failures are logged as warnings to prevent game crashes.
   */
  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) await this.resume();
    if (!this.context) return;

    const allUrls = [...urls, AudioEngine.METRONOME_URL];
    const uniqueUrls = Array.from(new Set(allUrls.filter(u => !!u)));
    
    await Promise.all(uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      if (this.loadingStatus.get(url) === 'loading') {
        while (this.loadingStatus.get(url) === 'loading') {
          await new Promise(r => setTimeout(r, 100));
        }
        return;
      }
      
      this.loadingStatus.set(url, 'loading');
      try {
        const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        
        this.buffers.set(url, audioBuffer);
        this.loadingStatus.set(url, 'ready');
      } catch (e) {
        // Robust handling: Log as warning, don't throw to prevent blocking the game loop
        console.warn(`AudioEngine: Non-critical load failure for ${url}`, e);
        this.loadingStatus.set(url, 'failed');
      }
    }));
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
      // Fallback: silent count-in
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
    if (!buffer || !this.context || !this.masterGain) {
      // Warning instead of error to prevent session block
      console.warn('AudioEngine: Backing track buffer not ready for URL:', url);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.masterGain);
      source.start(when);
      this.backingSource = source;
    } catch (e) {
      console.warn('AudioEngine: Backing track start failed', e);
    }
  }

  stopBackingTrack() {
    if (this.backingSource) {
      try { this.backingSource.stop(); } catch(e) {}
      this.backingSource = null;
    }
  }

  stop() {
    this.stopBackingTrack();
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
  }

  getCurrentTime(): number {
    return this.context ? this.context.currentTime - this.startTime : 0;
  }
}

export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;
