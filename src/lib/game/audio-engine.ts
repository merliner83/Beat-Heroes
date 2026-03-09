
"use client";

/**
 * AudioEngine handles the loading, decoding, and playback of audio samples
 * using the Web Audio API. Optimized for low-latency rhythm games.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Set<AudioBufferSourceNode> = new Set();
  private masterGain: GainNode | null = null;
  private startTime: number = 0;

  constructor() {
    console.log('AudioEngine: Instance created. Waiting for user interaction to initialize context.');
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
        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        console.log('AudioEngine: Context initialized. SampleRate:', this.context.sampleRate);
      } catch (e) {
        console.error('AudioEngine: Failed to create AudioContext', e);
        return false;
      }
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
        console.log('AudioEngine: Context resumed successfully.');
      } catch (e) {
        console.error('AudioEngine: Context resume failed', e);
      }
    }

    // Play a silent/short beep to "unlock" audio on mobile/Safari
    this.playUnlockSound();

    return this.context.state === 'running';
  }

  private playUnlockSound() {
    if (!this.context || !this.masterGain) return;
    try {
      const osc = this.context.createOscillator();
      const g = this.context.createGain();
      osc.connect(g);
      g.connect(this.masterGain);
      g.gain.setValueAtTime(0.001, this.context.currentTime);
      osc.start();
      osc.stop(this.context.currentTime + 0.01);
    } catch (e) {
      // Ignore unlock sound errors
    }
  }

  getAudioStatus() {
    if (!this.context) return { state: 'uninitialized', sampleRate: '-' };
    return {
      state: this.context.state,
      sampleRate: `${(this.context.sampleRate / 1000).toFixed(1)}kHz`
    };
  }

  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) await this.resume();
    if (!this.context) return;

    const uniqueUrls = Array.from(new Set(urls.filter(u => !!u)));
    
    await Promise.all(uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      try {
        console.log(`AudioEngine: Fetching ${url}...`);
        // Using a controller to timeout long-hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { 
          signal: controller.signal,
          mode: 'cors', // Explicitly request CORS
          credentials: 'omit'
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} for ${url}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
        console.log(`AudioEngine: Loaded & Decoded ${url} (${audioBuffer.duration.toFixed(2)}s)`);
      } catch (e: any) {
        // Log individual failures but don't stop the whole preload
        console.warn(`AudioEngine: Individual sample failed to load: ${url}`, e.message || e);
      }
    }));
  }

  playOneShot(url: string) {
    if (!this.context || !this.masterGain) {
      // Try to resume on any pad press as a safety measure
      this.resume().then(() => {
        if (this.buffers.has(url)) this.playOneShot(url);
      });
      return;
    }

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn('AudioEngine: Buffer not ready for', url);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      source.start(0);
      
      // Cleanup
      source.onended = () => {
        this.sources.delete(source);
      };
      this.sources.add(source);
    } catch (e) {
      console.error('AudioEngine: One-shot playback failed', e);
    }
  }

  async startBackingTrack(url: string) {
    const isReady = await this.resume();
    if (!isReady) {
      console.error('AudioEngine: Cannot start backing track - Context not running');
      return;
    }

    this.stop();

    const buffer = this.buffers.get(url);
    if (!buffer || !this.context || !this.masterGain) {
      console.warn('AudioEngine: Backing track buffer not found or engine not ready');
      return;
    }

    this.startTime = this.context.currentTime;
    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.masterGain);
      source.start(0);
      this.sources.add(source);
    } catch (e) {
      console.error('AudioEngine: Backing track playback failed', e);
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
