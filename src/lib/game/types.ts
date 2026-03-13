
export type SoundType = 'kick' | 'clap' | 'percs' | 'misc';

export interface Studio {
  id: string;
  name: string;
  description: string;
  coverColor: string;
  district?: string;
  linkUrl?: string;
  linkLabel?: string;
}

export interface Project {
  id: string;
  studioId: string;
  name: string;
  bpm: number;
  backingTrackUrl: string;
}

export interface Level {
  id: string;
  projectId: string;
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
