
"use client";

/**
 * AudioEngine handles the loading, decoding, and playback of audio samples
 * using the Web Audio API. It is optimized for low-latency rhythm games.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private masterGain: GainNode | null = null;
  private startTime: number = 0;
  private isLoaded: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 1.0;
        console.log('AudioEngine: Initialized. Status:', this.context.state);
      } catch (e) {
        console.error('AudioEngine: Failed to create AudioContext', e);
      }
    }
  }

  /**
   * Resumes the AudioContext and "unlocks" it for mobile/Safari.
   * Must be called within a user interaction.
   */
  async resume(): Promise<boolean> {
    if (!this.context) return false;
    if (this.context.state === 'suspended' || this.context.state === 'interrupted') {
      try {
        await this.context.resume();
        // Play a silent buffer to fully unlock
        const buffer = this.context.createBuffer(1, 1, 22050);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.start(0);
        console.log('AudioEngine: Context resumed and unlocked.');
      } catch (e) {
        console.error('AudioEngine: Failed to resume context', e);
        return false;
      }
    }
    return this.context.state === 'running';
  }

  /**
   * Loads audio files and decodes them.
   */
  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) return;
    const uniqueUrls = Array.from(new Set(urls.filter(u => !!u)));
    
    await Promise.all(uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
        console.log(`AudioEngine: Loaded ${url}`);
      } catch (e) {
        console.warn(`AudioEngine: Could not load ${url}. Check CORS headers.`, e);
      }
    }));
    this.isLoaded = true;
  }

  /**
   * Triggers a single sound effect.
   */
  async playOneShot(url: string): Promise<void> {
    if (!this.context || !this.masterGain) return;
    await this.resume();

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn(`AudioEngine: No buffer for ${url}`);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      source.start(0);
    } catch (e) {
      console.error('AudioEngine: Play error', e);
    }
  }

  async startBackingTrack(url: string): Promise<void> {
    if (!this.context || !this.masterGain) return;
    await this.resume();
    
    this.stop();
    const buffer = this.buffers.get(url);
    if (!buffer) return;

    this.startTime = this.context.currentTime;
    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.masterGain);
      source.start(0);
      this.sources.set('backing', source);
    } catch (e) {
      console.error('AudioEngine: Backing track error', e);
    }
  }

  stop(): void {
    this.sources.forEach(s => { try { s.stop(); } catch(e) {} });
    this.sources.clear();
  }

  getCurrentTime(): number {
    return this.context ? this.context.currentTime - this.startTime : 0;
  }
}

export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;
