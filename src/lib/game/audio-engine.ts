
"use client";

/**
 * AudioEngine handles loading, decoding, and playback.
 * Optimized for CD Quality (44.1kHz).
 * Uses a dedicated slot for backing tracks to prevent premature stopping.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Set<AudioBufferSourceNode> = new Set();
  private backingSource: AudioBufferSourceNode | null = null;
  private masterGain: GainNode | null = null;
  private startTime: number = 0;
  private loadingStatus: Map<string, 'loading' | 'ready' | 'failed'> = new Map();

  constructor() {
    console.log('AudioEngine: CD Quality (44.1kHz) Engine active.');
  }

  async resume(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!this.context) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        // Fix sample rate to 44.1 kHz as requested
        this.context = new AudioContextClass({ sampleRate: 44100 });
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
      } catch (e) {
        console.error('AudioEngine: Context creation failed', e);
        return false;
      }
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context.state === 'running';
  }

  getAudioStatus() {
    if (!this.context) return { state: 'init', sampleRate: '-' };
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
      if (this.buffers.has(url) || this.loadingStatus.get(url) === 'loading') return;
      
      this.loadingStatus.set(url, 'loading');
      try {
        const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`Proxy status ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        
        this.buffers.set(url, audioBuffer);
        this.loadingStatus.set(url, 'ready');
      } catch (e) {
        console.warn(`AudioEngine: Proxy load failed for ${url}.`, e);
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
      console.error('AudioEngine: One-shot playback failed', e);
    }
  }

  async startBackingTrack(url: string) {
    await this.resume();
    this.stopBackingTrack();

    const buffer = this.buffers.get(url);
    if (!buffer || !this.context || !this.masterGain) {
      console.error('AudioEngine: Backing track buffer not ready for URL:', url);
      return;
    }

    try {
      this.startTime = this.context.currentTime;
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.masterGain);
      source.start(0);
      this.backingSource = source;
    } catch (e) {
      console.error('AudioEngine: Backing track start failed', e);
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
