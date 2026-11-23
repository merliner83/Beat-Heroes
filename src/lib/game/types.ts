
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
  /** Kurs und Kapitel (Kapitel-ID = frühere learnCategories-ID) */
  courseId?: string;
  chapterId?: string;
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

// --- Schulen, Klassen, Zuweisungen (docs/architecture.md) ---

export interface School {
  id: string;
  name: string;
  slug?: string;
}

export interface SchoolClass {
  id: string;
  schoolId: string;
  name: string;
  teacherIds: string[];
  joinCode: string;
  createdAt?: any;
}

export type AssignmentKind = 'task' | 'level' | 'learnApp' | 'article';

export interface Assignment {
  id: string;
  schoolId: string;
  classId: string;
  /** 'class' = ganze Klasse, 'students' = nur studentIds */
  audience: 'class' | 'students';
  studentIds: string[];
  createdBy: string;
  title: string;
  description?: string;
  kind: AssignmentKind;
  /** levelId, learnAppId oder articleId je nach kind */
  refId?: string | null;
  refLabel?: string | null;
  dueAt?: any;
  credits: number;
  createdAt?: any;
}

export type SubmissionStatus = 'submitted' | 'approved' | 'changes_requested';

export interface Submission {
  id: string;
  uid: string;
  displayName?: string;
  status: SubmissionStatus;
  text?: string;
  link?: string;
  feedback?: string;
  submittedAt?: any;
  reviewedAt?: any;
  credits?: number;
}

/** Link zum Inhalt einer Zuweisung (oder null bei freien Aufgaben). */
export function assignmentHref(a: Pick<Assignment, 'kind' | 'refId'>): string | null {
  if (!a.refId) return null;
  if (a.kind === 'article') return `/learn/article/${a.refId}`;
  if (a.kind === 'level' || a.kind === 'learnApp') return `/session/${a.refId}`;
  return null;
}

// --- Kurse und Lernpfade ---

export interface CourseChapter {
  id: string;
  title: string;
  description?: string;
  order: number;
  iconName?: string;
  colorClass?: string;
  /** Lern-Apps (learnApps-IDs), die zu diesem Kapitel gehören */
  appIds?: string[];
}

export interface Course {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  order: number;
  color: string;
  iconName?: string;
  chapters: CourseChapter[];
  minRole?: UserRole | LegacyRole;
}

/**
 * Vorlage aus Pflicht-Lektionen, z.B. für die Talentförderung. Abschluss
 * prüft und vermerkt der Server (achievements).
 */
export interface LearningPath {
  id: string;
  title: string;
  description?: string;
  requiredLessonIds: string[];
  /** Mindest-Quizscore pro Lektion (Lektionen ohne Quiz: gelesen genügt) */
  minScore: number;
  /** Offiziell anerkannt (z.B. Talentförderung) */
  official?: boolean;
  credits?: number;
  color?: string;
  order: number;
  published?: boolean;
}

export interface Achievement {
  id: string;
  uid: string;
  pathId: string;
  pathTitle: string;
  official?: boolean;
  displayName?: string;
  schoolId?: string | null;
  classIds?: string[];
  achievedAt?: any;
}

/** Gilt eine Lektion als bestanden? */
export function isLessonPassed(progress: ArticleProgress | undefined, minScore = 80): boolean {
  return !!progress?.completed && (progress.quizScore ?? 0) >= minScore;
}
