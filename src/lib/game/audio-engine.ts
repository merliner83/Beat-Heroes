
"use client";

export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private startTime: number = 0;
  private isLoaded: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.context = new AudioContextClass();
        console.log('AudioEngine: Context initialized. State:', this.context?.state);
      } catch (e) {
        console.error('AudioEngine: Failed to create AudioContext', e);
      }
    }
  }

  async resume(): Promise<void> {
    if (!this.context) return;
    if (this.context.state === 'suspended') {
      await this.context.resume();
      console.log('AudioEngine: Context resumed. State:', this.context.state);
    }
  }

  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) return;

    const loadTasks = urls.map(async (url) => {
      if (!url || this.buffers.has(url)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        
        // Use the promise-based version of decodeAudioData
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
        console.log(`AudioEngine: Successfully loaded ${url}`);
      } catch (e) {
        console.error(`AudioEngine: Failed to load or decode ${url}`, e);
      }
    });

    await Promise.all(loadTasks);
    this.isLoaded = true;
  }

  playOneShot(url: string): void {
    if (!this.context || !this.buffers.has(url)) {
      console.warn(`AudioEngine: Buffer not found for ${url}`);
      return;
    }
    
    // Ensure context is running (can be suspended by browser)
    if (this.context.state !== 'running') {
      this.context.resume();
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = this.buffers.get(url)!;
      source.connect(this.context.destination);
      source.start(0);
    } catch (e) {
      console.error(`AudioEngine: Error playing one-shot ${url}`, e);
    }
  }

  startBackingTrack(url: string): void {
    if (!this.context || !this.buffers.has(url)) {
      console.warn(`AudioEngine: Backing track buffer not found for ${url}`);
      return;
    }
    
    this.stop();
    this.startTime = this.context.currentTime;
    
    try {
      const source = this.context.createBufferSource();
      source.buffer = this.buffers.get(url)!;
      source.loop = true;
      source.connect(this.context.destination);
      source.start(0);
      this.sources.set('backing', source);
      console.log('AudioEngine: Backing track started');
    } catch (e) {
      console.error('AudioEngine: Error starting backing track', e);
    }
  }

  stop(): void {
    this.sources.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    this.sources.clear();
  }

  getCurrentTime(): number {
    if (!this.context) return 0;
    return this.context.currentTime - this.startTime;
  }
}

export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;
