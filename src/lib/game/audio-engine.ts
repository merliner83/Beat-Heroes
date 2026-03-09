
"use client";

/**
 * AudioEngine handles the loading, decoding, and playback of audio samples
 * using the Web Audio API. It is optimized for low-latency rhythm games.
 * Features lazy initialization to comply with browser autoplay policies.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private masterGain: GainNode | null = null;
  private startTime: number = 0;
  private isLoaded: boolean = false;

  constructor() {
    // Context is created lazily on first user interaction
    console.log('AudioEngine: Ready for lazy initialization.');
  }

  private initContext() {
    if (this.context) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.context = new AudioContextClass();
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
      this.masterGain.gain.value = 1.0;
      console.log('AudioEngine: AudioContext created.');
    } catch (e) {
      console.error('AudioEngine: Could not initialize AudioContext', e);
    }
  }

  /**
   * Resumes and unlocks the AudioContext. 
   * Must be called inside a click handler.
   */
  async resume(): Promise<boolean> {
    this.initContext();
    if (!this.context) return false;

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    // Play a silent buffer to unlock audio on mobile/Safari
    const buffer = this.context.createBuffer(1, 1, 22050);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    source.start(0);
    
    console.log('AudioEngine: Context running:', this.context.state);
    return this.context.state === 'running';
  }

  /**
   * Loads audio files and decodes them.
   */
  async preloadAudio(urls: string[]): Promise<void> {
    this.initContext();
    if (!this.context) return;

    const uniqueUrls = Array.from(new Set(urls.filter(u => !!u)));
    
    await Promise.all(uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      try {
        console.log(`AudioEngine: Fetching ${url}...`);
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        
        // Using the promise-based decodeAudioData
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
        console.log(`AudioEngine: Successfully decoded ${url}`);
      } catch (e) {
        console.warn(`AudioEngine: Error loading ${url}:`, e);
      }
    }));
    this.isLoaded = true;
  }

  /**
   * Triggers a single sound effect immediately.
   */
  async playOneShot(url: string): Promise<void> {
    if (!this.context || !this.masterGain) {
      await this.resume();
    }
    
    if (!this.context) return;

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn(`AudioEngine: Buffer not found for ${url}. Attempting dynamic load...`);
      // Fallback: try to load it on the fly (not ideal for rhythm but better than silence)
      await this.preloadAudio([url]);
      return this.playOneShot(url);
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

  async startBackingTrack(url: string): Promise<void> {
    if (!this.context || !this.masterGain) await this.resume();
    
    this.stop();
    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn(`AudioEngine: Backing track buffer not ready for ${url}`);
      return;
    }

    this.startTime = this.context!.currentTime;
    try {
      const source = this.context!.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.masterGain!);
      source.start(0);
      this.sources.set('backing', source);
    } catch (e) {
      console.error('AudioEngine: Backing track failed', e);
    }
  }

  stop(): void {
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
