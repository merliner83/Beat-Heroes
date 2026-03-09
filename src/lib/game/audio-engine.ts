
"use client";

/**
 * AudioEngine handles the loading, decoding, and playback of audio samples
 * using the Web Audio API. Optimized for low-latency rhythm games.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private masterGain: GainNode | null = null;
  private startTime: number = 0;

  constructor() {
    console.log('AudioEngine: Initialized (Waiting for user interaction)');
  }

  /**
   * Initializes or resumes the AudioContext.
   * MUST be triggered by a user gesture.
   */
  async resume(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!this.context) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return false;
        
        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 1.0;
        console.log('AudioEngine: Context created. SampleRate:', this.context.sampleRate);
      } catch (e) {
        console.error('AudioEngine: Failed to create AudioContext', e);
        return false;
      }
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
      console.log('AudioEngine: Context resumed.');
    }

    // Unlock audio with a silent buffer (critical for iOS/Safari)
    const silentBuffer = this.context.createBuffer(1, 1, 22050);
    const silentSource = this.context.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(this.context.destination);
    silentSource.start(0);

    return this.context.state === 'running';
  }

  getAudioStatus() {
    if (!this.context) return { state: 'Init...', sampleRate: '-' };
    return {
      state: this.context.state,
      sampleRate: `${Math.round(this.context.sampleRate / 100) / 10} kHz`
    };
  }

  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) await this.resume();
    if (!this.context) return;

    const uniqueUrls = Array.from(new Set(urls.filter(u => !!u)));
    
    await Promise.all(uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      try {
        console.log(`AudioEngine: Loading ${url}...`);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
        console.log(`AudioEngine: Successfully loaded ${url}`);
      } catch (e) {
        console.warn(`AudioEngine: Could not load ${url}. Skipping.`, e);
      }
    }));
  }

  playOneShot(url: string) {
    if (!this.context || !this.masterGain) {
      this.resume();
      return;
    }
    
    // Safety check: Context might suspend if unused
    if (this.context.state !== 'running') {
      this.context.resume();
    }

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn('AudioEngine: No buffer found for', url);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      source.start(0);
    } catch (e) {
      console.error('AudioEngine: Playback failed', e);
    }
  }

  async startBackingTrack(url: string) {
    await this.resume();
    this.stop();

    const buffer = this.buffers.get(url);
    if (!buffer || !this.context || !this.masterGain) return;

    this.startTime = this.context.currentTime;
    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.masterGain);
      source.start(0);
      this.sources.set('backing', source);
    } catch (e) {
      console.error('AudioEngine: Backing track failed', e);
    }
  }

  stop() {
    this.sources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.sources.clear();
  }

  getCurrentTime(): number {
    return this.context ? this.context.currentTime - this.startTime : 0;
  }
}

export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;
