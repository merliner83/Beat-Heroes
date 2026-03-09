
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

  constructor() {
    console.log('AudioEngine: Ready. Context will be initialized on user interaction.');
  }

  /**
   * Initializes or resumes the AudioContext.
   * MUST be triggered by a user gesture (e.g., button click).
   */
  async resume(): Promise<boolean> {
    if (!this.context) {
      try {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          console.error('AudioEngine: Web Audio API is not supported in this browser.');
          return false;
        }
        this.context = new AudioContextClass();
        this.masterGain = this.context.createGain();
        this.masterGain.connect(this.context.destination);
        this.masterGain.gain.value = 1.0;
        console.log('AudioEngine: AudioContext created.');
      } catch (e) {
        console.error('AudioEngine: Failed to create AudioContext', e);
        return false;
      }
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    // Play a tiny silent buffer to "unlock" audio on mobile devices/Safari
    const silentBuffer = this.context.createBuffer(1, 1, 22050);
    const silentSource = this.context.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(this.context.destination);
    silentSource.start(0);

    return this.context.state === 'running';
  }

  /**
   * Preloads multiple audio files and decodes them into buffers.
   */
  async preloadAudio(urls: string[]): Promise<void> {
    await this.resume(); // Ensure context exists
    if (!this.context) return;

    const uniqueUrls = Array.from(new Set(urls.filter(u => !!u)));
    
    await Promise.all(uniqueUrls.map(async (url) => {
      if (this.buffers.has(url)) return;
      try {
        console.log(`AudioEngine: Fetching ${url}...`);
        // Using 'cors' mode is critical for external storage links
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context!.decodeAudioData(arrayBuffer);
        this.buffers.set(url, audioBuffer);
        console.log(`AudioEngine: Decoded ${url}`);
      } catch (e) {
        console.warn(`AudioEngine: Error loading/decoding ${url}:`, e);
      }
    }));
  }

  /**
   * Plays a preloaded sound as a one-shot effect.
   */
  playOneShot(url: string) {
    if (!this.context || !this.masterGain) {
      console.warn('AudioEngine: Context not initialized. Call resume() on user interaction first.');
      return;
    }

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn(`AudioEngine: Buffer missing for ${url}. Did it load correctly?`);
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      source.start(0);
    } catch (e) {
      console.error('AudioEngine: One-shot playback failed', e);
    }
  }

  /**
   * Starts a looping backing track.
   */
  async startBackingTrack(url: string) {
    await this.resume();
    this.stop();

    const buffer = this.buffers.get(url);
    if (!buffer) {
      console.warn(`AudioEngine: Backing track buffer not found for ${url}`);
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
      console.error('AudioEngine: Failed to start backing track', e);
    }
  }

  /**
   * Stops all active sounds.
   */
  stop() {
    this.sources.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    this.sources.clear();
  }

  /**
   * Gets the current playback time in seconds.
   */
  getCurrentTime(): number {
    return this.context ? this.context.currentTime - this.startTime : 0;
  }
}

export const audioEngine = typeof window !== "undefined" ? new AudioEngine() : null;
