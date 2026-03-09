
"use client";

/**
 * AudioEngine handles the loading, decoding, and playback of audio samples
 * using the Web Audio API. Optimized for low-latency rhythm games.
 * Configured to use a fixed sample rate of 44.1 kHz.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Set<AudioBufferSourceNode> = new Set();
  private masterGain: GainNode | null = null;
  private startTime: number = 0;
  private loadingStatus: Map<string, 'loading' | 'ready' | 'failed'> = new Map();

  constructor() {
    console.log('AudioEngine: Instance created.');
  }

  async resume(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!this.context) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        // Fix sample rate to 44.1 kHz for consistent playback across devices
        this.context = new AudioContextClass({ sampleRate: 44100 });
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        console.log('AudioEngine: Context initialized at 44.1kHz. Status:', this.context.state);
      } catch (e) {
        console.error('AudioEngine: Failed to create AudioContext', e);
        return false;
      }
    }

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (e) {
        console.error('AudioEngine: Failed to resume context', e);
      }
    }

    // Play a silent click to unlock audio on mobile/Safari
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
    } catch (e) {}
  }

  getAudioStatus() {
    if (!this.context) return { state: 'uninitialized', sampleRate: '-' };
    return {
      state: this.context.state,
      sampleRate: `${(this.context.sampleRate / 1000).toFixed(1)}kHz`
    };
  }

  getLoadStatus(url: string) {
    return this.loadingStatus.get(url) || 'idle';
  }

  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) await this.resume();
    if (!this.context) return;

    const uniqueUrls = Array.from(new Set(urls.filter(u => !!u)));
    
    await Promise.all(uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      if (this.loadingStatus.get(url) === 'loading') return;
      
      this.loadingStatus.set(url, 'loading');
      try {
        // Fetch audio file. Note: External URLs require valid CORS headers.
        const response = await fetch(url);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        
        this.buffers.set(url, audioBuffer);
        this.loadingStatus.set(url, 'ready');
        console.log(`AudioEngine: Successfully loaded ${url}`);
      } catch (e) {
        console.warn(`AudioEngine: FAILED to load ${url}. This is often a CORS issue or invalid file format.`, e);
        this.loadingStatus.set(url, 'failed');
      }
    }));
  }

  playOneShot(url: string) {
    if (!this.context) {
      this.resume();
      return;
    }

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn('AudioEngine: No buffer available for', url);
      // Trigger background load if not already attempted
      if (this.loadingStatus.get(url) !== 'loading' && this.loadingStatus.get(url) !== 'ready') {
        this.preloadAudio([url]);
      }
      return;
    }

    try {
      if (this.context.state === 'suspended') this.context.resume();
      
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain!);
      source.start(0);
      
      source.onended = () => {
        this.sources.delete(source);
      };
      this.sources.add(source);
    } catch (e) {
      console.error('AudioEngine: Playback failed', e);
    }
  }

  async startBackingTrack(url: string) {
    await this.resume();
    this.stop();

    const buffer = this.buffers.get(url);
    if (!buffer || !this.context || !this.masterGain) {
      console.error('AudioEngine: Backing track buffer not ready for URL:', url);
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
      console.log('AudioEngine: Backing track started');
    } catch (e) {
      console.error('AudioEngine: Backing track failed to start', e);
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
