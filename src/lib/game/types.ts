export type SoundType = 'kick' | 'clap' | 'percs' | 'misc';
export type GameType = 'rhythm-producer' | 'sample-hunter' | 'disk-dash';

export interface Studio {
  id: string;
  name: string;
  description: string;
  coverColor: string;
  imageUrl?: string;
  district?: string;
  tags?: string[];
  featured?: boolean;
  linkUrl?: string;
  linkLabel?: string;
}

export interface Track {
  id: string;
  name: string;
  url: string;
  author?: string;
  duration?: number;
}

export interface Game {
  id: string;
  studioId: string;
  name: string;
  type: GameType;
  bpm?: number;
  difficulty?: number; // 1-4
  trackId?: string;
  backingTrackUrl?: string;
  backgroundImageUrl?: string;
}

export interface Level {
  id: string;
  gameId: string;
  difficulty: number;
  name: string;
}

export interface TriggerPattern {
  id: string;
  name: string;
  steps: number[]; // 0-127 for 8 bars
}

export interface Sound {
  id: string;
  levelId: string;
  type: SoundType;
  sampleUrl: string;
  patternIds: string[]; // Sequence of 8-bar patterns
  triggerSteps?: number[]; // Internal UI cache (not stored in DB)
}

export interface GameScore {
  hits: number;
  misses: number;
  accuracy: number;
}

export interface LevelProgress {
  id: string;
  levelId: string;
  accuracy: number;
  completedAt?: any;
}
