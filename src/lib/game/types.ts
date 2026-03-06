export type StemType = 'kick' | 'snare' | 'perc' | 'hihat' | 'vocal';

export interface Stem {
  id: string;
  type: StemType;
  audioUrl: string;
  difficulty: 'easy' | 'medium' | 'advanced';
  pattern: number[]; // musical steps (e.g., 0, 4, 8, 12)
}

export interface Song {
  id: string;
  title: string;
  bpm: number;
  timeSignature: string;
  resolution: number; // 16 or 32
  durationSeconds: number;
  backingTrackUrl: string;
  stems: Stem[];
}

export interface Level {
  id: string;
  songId: string;
  difficulty: string;
  order: number;
}

export interface GameScore {
  hits: number;
  misses: number;
  accuracy: number;
}

export interface Studio {
  id: string;
  name: string;
  ownerUserId: string;
  description: string;
  coverColor: string;
}