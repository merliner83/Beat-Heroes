
export type SoundType = 'kick' | 'clap' | 'percs' | 'misc';
export type GameType = 'rhythm-producer' | 'sample-hunter' | 'sample-catcher';
export type UserRole = 'admin' | 'producer' | 'pro' | 'free';

export interface Studio {
  id: string;
  name: string;
  description: string;
  coverColor: string;
  imageUrl?: string;
  district?: string;
  tags?: string[];
  linkUrl?: string;
  linkLabel?: string;
  minRole?: UserRole;
}

export interface Track {
  id: string;
  studioId?: string;
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
  minRole?: UserRole;
}

export interface LearnApp {
  id: string;
  name: string;
  type: 'ear-training' | 'rhythm-trainer';
  minRole?: UserRole;
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
  sampleUrl?: string;
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

export interface PatternProgress {
  id: string;
  patternId: string;
  accuracy: number;
  completedAt?: any;
}

export interface UserProfile {
  uid: string;
  email?: string;
  role: UserRole;
  streetCred: number;
}

export interface Article {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  videoUrl?: string;
  imageUrls?: string[];
  minRole?: UserRole;
}

/** Helper to check if a user role has at least the required role. */
export function hasAccess(userRole: UserRole = 'free', requiredRole: UserRole = 'free'): boolean {
  const roles: UserRole[] = ['free', 'pro', 'producer', 'admin'];
  const userIdx = roles.indexOf(userRole);
  const reqIdx = roles.indexOf(requiredRole);
  return userIdx >= reqIdx;
}

/** Helper to get accuracy color based on percentage (Red -> Orange -> Yellow -> Green) */
export function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 85) return '#00E676'; // Green
  if (accuracy >= 65) return '#FFEA00'; // Yellow
  if (accuracy >= 35) return '#FF9100'; // Orange
  return '#FF3D00'; // Red
}
