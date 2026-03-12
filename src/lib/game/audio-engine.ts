
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
        // Fix sample rate to 44.1 kHz as requested
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

    return this.context.state === 'running';
  }

  /**
   * Generates a synthesized fallback sound if a sample fails to load.
   */
  private playSynthFallback(url: string) {
    if (!this.context || !this.masterGain) return;
    
    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const env = this.context.createGain();
    
    osc.connect(env);
    env.connect(this.masterGain);

    const type = url.toLowerCase();

    if (type.includes('kick')) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      env.gain.setValueAtTime(1, now);
      env.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type.includes('clap') || type.includes('jump')) {
      osc.type = 'square';
      osc.frequency.setValueAtTime(800, now);
      env.gain.setValueAtTime(0.4, now);
      env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type.includes('perc') || type.includes('collision')) {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      env.gain.setValueAtTime(0.5, now);
      env.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      env.gain.setValueAtTime(0.3, now);
      env.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
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
        // Wir nutzen den lokalen Proxy, um CORS-Sperren der externen Server zu umgehen
        const proxyUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`Proxy failed: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        
        this.buffers.set(url, audioBuffer);
        this.loadingStatus.set(url, 'ready');
      } catch (e) {
        console.warn(`AudioEngine: FAILED to load ${url}. Proxy might be blocked or URL invalid.`, e);
        this.loadingStatus.set(url, 'failed');
      }
    }));
  }

  async playOneShot(url: string) {
    await this.resume();

    const buffer = this.buffers.get(url);
    if (!buffer) {
      // Falls das echte Sample nicht geladen werden konnte, nutzen wir den Synthesizer
      this.playSynthFallback(url);
      return;
    }

    try {
      const source = this.context!.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain!);
      source.start(0);
      
      source.onended = () => {
        this.sources.delete(source);
      };
      this.sources.add(source);
    } catch (e) {
      console.error('AudioEngine: Playback failed', e);
      this.playSynthFallback(url);
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
