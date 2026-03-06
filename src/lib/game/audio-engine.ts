"use client";

import { Stem } from "./types";

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

  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) return;

    const loadTasks = urls.map(async (url) => {
      if (this.buffers.has(url)) return;
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
      this.buffers.set(url, audioBuffer);
    });

    await Promise.all(loadTasks);
    this.isLoaded = true;
  }

  start(backingUrl: string, stems: Stem[]): void {
    if (!this.context || !this.isLoaded) return;
    
    this.stop();
    this.startTime = this.context.currentTime + 0.1;

    // Start Backing Track
    this.playBuffer(backingUrl, true);

    // Prepare stems but they start silent or locked? 
    // Prompt says: "Successfully completed stem patterns lock, activating the next stem."
    // For this prototype, we'll play all stems and just control their volume?
    // Actually, let's just trigger them based on patterns.
  }

  private playBuffer(url: string, loop: boolean = false): void {
    if (!this.context || !this.buffers.has(url)) return;

    const source = this.context.createBufferSource();
    source.buffer = this.buffers.get(url)!;
    source.loop = loop;
    source.connect(this.context.destination);
    source.start(this.startTime);
    this.sources.set(url, source);
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

  getContextTime(): number {
    return this.context?.currentTime || 0;
  }
}

export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;