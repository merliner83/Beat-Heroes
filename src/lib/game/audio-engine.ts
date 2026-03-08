
"use client";

export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private startTime: number = 0;
  private isLoaded: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) return;

    const loadTasks = urls.map(async (url) => {
      if (!url || this.buffers.has(url)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Fetch failed for ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
      } catch (e) {
        console.warn(`AudioEngine: Failed to load ${url}`, e);
      }
    });

    await Promise.all(loadTasks);
    this.isLoaded = true;
  }

  playOneShot(url: string): void {
    if (!this.context || !this.buffers.has(url)) return;
    
    // Ensure context is running
    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(url)!;
    source.connect(this.context.destination);
    source.start(0);
  }

  startBackingTrack(url: string): void {
    if (!this.context || !this.buffers.has(url)) return;
    
    this.stop();
    this.startTime = this.context.currentTime;
    
    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(url)!;
    source.loop = true;
    source.connect(this.context.destination);
    source.start(0);
    this.sources.set('backing', source);
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
