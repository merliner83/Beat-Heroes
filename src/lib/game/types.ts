
export type SoundType = 'kick' | 'clap' | 'percs' | 'misc';
export type GameType = 'rhythm-producer' | 'sample-hunter' | 'sample-catcher';
export type UserRole = 'student' | 'teacher' | 'schoolAdmin' | 'superAdmin';
/** Alte Abo-Rollen aus Firebase Studio, werden auf neue Rollen abgebildet. */
export type LegacyRole = 'free' | 'pro' | 'producer' | 'admin';
const LEGACY_ROLE_MAP: Record<LegacyRole, UserRole> = {
  free: 'student',
  pro: 'teacher',
  producer: 'teacher',
  admin: 'superAdmin',
};
export function normalizeRole(role: string | null | undefined): UserRole {
  if (!role) return 'student';
  if (role in LEGACY_ROLE_MAP) return LEGACY_ROLE_MAP[role as LegacyRole];
  return (['student', 'teacher', 'schoolAdmin', 'superAdmin'] as string[]).includes(role) ? (role as UserRole) : 'student';
}
export const isSuperAdmin = (role: string | null | undefined) => normalizeRole(role) === 'superAdmin';
export const isStaff = (role: string | null | undefined) => normalizeRole(role) !== 'student';

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
  minRole?: UserRole | LegacyRole;
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
  minRole?: UserRole | LegacyRole;
  maxPoints?: number;
}

export interface LearnApp {
  id: string;
  name: string;
  type: 'ear-training' | 'rhythm-trainer';
  minRole?: UserRole | LegacyRole;
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
  displayName?: string;
  photoURL?: string;
  /** Geschützt: nur Server/Super-Admin. */
  role?: UserRole;
  schoolId?: string | null;
  classIds?: string[];
  streetCred?: number;
}

export interface Standing {
  id: string;
  uid: string;
  displayName: string;
  schoolId: string | null;
  classIds?: string[];
  streetCred: number;
}

export interface LearnCategory {
  id: string;
  title: string;
  iconName: string;
  colorClass: string;
  order: number;
  minRole?: UserRole | LegacyRole;
}

export interface LearnSubCat {
  id: string;
  categoryId: string;
  title: string;
  iconUrl?: string;
  order: number;
  minRole?: UserRole | LegacyRole;
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
  minRole?: UserRole | LegacyRole;
  maxPoints?: number;
}

/**
 * Prüft, ob eine Rolle Inhalte mit `requiredRole` sehen darf.
 * Akzeptiert auch alte Rollenwerte (free/pro/producer/admin).
 */
export function hasAccess(userRole?: string | null, requiredRole?: string | null): boolean {
  const order: UserRole[] = ['student', 'teacher', 'schoolAdmin', 'superAdmin'];
  return order.indexOf(normalizeRole(userRole)) >= order.indexOf(normalizeRole(requiredRole));
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
