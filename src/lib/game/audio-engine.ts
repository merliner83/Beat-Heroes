
"use client";

/**
 * AudioEngine handles the loading, decoding, and playback of audio samples
 * using the Web Audio API. It manages a cache of AudioBuffers and provides
 * methods for single-shot triggering and looping backing tracks.
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
        
        // Create a master gain node for volume control and final routing
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 1.0;
        
        console.log('AudioEngine: Context initialized. State:', this.context.state);
      } catch (e) {
        console.error('AudioEngine: Failed to create AudioContext', e);
      }
    }
  }

  /**
   * Resumes the AudioContext if it was suspended by the browser.
   * This must be called inside a user interaction (like a click).
   */
  async resume(): Promise<void> {
    if (this.context && (this.context.state === 'suspended' || this.context.state === 'interrupted')) {
      try {
        await this.context.resume();
        console.log('AudioEngine: Context resumed. State:', this.context.state);
      } catch (e) {
        console.error('AudioEngine: Failed to resume context', e);
      }
    }
  }

  /**
   * Preloads a list of audio URLs. Decodes them into AudioBuffers for instant playback.
   */
  async preloadAudio(urls: string[]): Promise<void> {
    if (!this.context) return;

    const uniqueUrls = Array.from(new Set(urls.filter(u => !!u)));
    
    const loadTasks = uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      try {
        console.log(`AudioEngine: Loading ${url}...`);
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`AudioEngine: HTTP ${response.status} for ${url}. Skipping.`);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        
        try {
          const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
          this.buffers.set(url, audioBuffer);
          console.log(`AudioEngine: Successfully loaded ${url}`);
        } catch (decodeError) {
          console.warn(`AudioEngine: Failed to decode ${url}.`, decodeError);
        }
      } catch (e) {
        console.warn(`AudioEngine: Failed to fetch ${url}. This is likely a CORS issue with Storage.`, e);
      }
    });

    await Promise.all(loadTasks);
    this.isLoaded = true;
  }

  /**
   * Plays a sample once (One-Shot).
   */
  async playOneShot(url: string): Promise<void> {
    if (!this.context || !this.masterGain) return;
    
    // Always try to resume context on user trigger to bypass browser blocks
    await this.resume();

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn(`AudioEngine: No buffer found for ${url}. Make sure it was preloaded.`);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      source.start(0);
    } catch (e) {
      console.error(`AudioEngine: Error playing sample ${url}`, e);
    }
  }

  /**
   * Starts the backing track as a loop.
   */
  async startBackingTrack(url: string): Promise<void> {
    if (!this.context || !this.masterGain) return;
    
    await this.resume();
    
    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn(`AudioEngine: Backing track buffer not found for ${url}`);
      return;
    }
    
    this.stop();
    this.startTime = this.context.currentTime;
    
    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.masterGain);
      source.start(0);
      this.sources.set('backing', source);
      console.log('AudioEngine: Backing track started');
    } catch (e) {
      console.error('AudioEngine: Error starting backing track', e);
    }
  }

  /**
   * Stops all currently playing sources managed by the engine.
   */
  stop(): void {
    this.sources.forEach((source) => {
      try { source.stop(); } catch (e) {}
    });
    this.sources.clear();
  }

  /**
   * Returns the elapsed time since the backing track started.
   */
  getCurrentTime(): number {
    if (!this.context) return 0;
    return this.context.currentTime - this.startTime;
  }

  getIsLoaded(): boolean {
    return this.isLoaded;
  }
}

// Export a singleton instance
export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;
