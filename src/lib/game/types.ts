
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
  difficulty?: number;
  trackId?: string;
  backingTrackUrl?: string;
  backgroundImageUrl?: string;
  minRole?: UserRole;
  maxPoints?: number;
}

export interface LearnApp {
  id: string;
  name: string;
  type: 'ear-training' | 'rhythm-trainer';
  minRole?: UserRole;
  maxPoints?: number;
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
  steps: number[];
}

export interface Sound {
  id: string;
  levelId: string;
  type: SoundType;
  sampleUrl: string;
  patternIds: string[];
  triggerSteps?: number[];
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

export interface ArticleProgress {
  id: string;
  articleId: string;
  completed: boolean;
  quizScore?: number;
  completedAt?: any;
}

export interface UserProfile {
  uid: string;
  email?: string;
  role: UserRole;
  streetCred: number;
  displayName?: string;
  isPublic?: boolean;
}

export interface LearnCategory {
  id: string;
  title: string;
  iconName: string;
  colorClass: string;
  order: number;
  minRole?: UserRole;
}

export interface LearnSubCat {
  id: string;
  categoryId: string;
  title: string;
  iconUrl?: string;
  order: number;
  minRole?: UserRole;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctOption: number;
}

export interface LearnQuiz {
  id: string;
  articleId: string;
  questions: QuizQuestion[];
}

export interface Article {
  id: string;
  categoryId: string;
  subCategoryId?: string;
  title: string;
  content: string;
  videoUrl?: string;
  order: number;
  imageUrls?: string[];
  youtubeUrls?: string[];
  minRole?: UserRole;
  maxPoints?: number;
}

/**
 * Checks if a user has the required access level.
 * Defaults to 'free' if no role is provided.
 */
export function hasAccess(userRole: UserRole | undefined | null = 'free', requiredRole: UserRole = 'free'): boolean {
  const roles: UserRole[] = ['free', 'pro', 'producer', 'admin'];
  const actualUserRole = userRole || 'free';
  const userIdx = roles.indexOf(actualUserRole as UserRole);
  const reqIdx = roles.indexOf(requiredRole);
  // Ensure we handle cases where roles might not be in the list correctly
  if (userIdx === -1) return false;
  return userIdx >= reqIdx;
}

export function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 85) return '#00E676';
  if (accuracy >= 65) return '#FFEA00';
  if (accuracy >= 35) return '#FF9100';
  return '#FF3D00';
}

export function getRankInfo(streetCred: number) {
  if (streetCred >= 25000) return { name: "GLOBAL HERO", color: "#FF3D00", icon: "👑" };
  if (streetCred >= 10000) return { name: "BEAT LEGEND", color: "#EB3D99", icon: "💎" };
  if (streetCred >= 5000) return { name: "STUDIO PRO", color: "#3838FA", icon: "🎧" };
  if (streetCred >= 1000) return { name: "RISING STAR", color: "#FFEA00", icon: "🔥" };
  return { name: "BEDROOM PRODUCER", color: "#00E676", icon: "🎹" };
}
