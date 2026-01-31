import { ActivityAction } from "./activityLogger";

export type StudentStatus = "نشط" | "مطرود" | "محذوف";
export type MemorizationAmount = "ثمن" | "ربع" | "نصف" | "صفحة" | "أكثر";
export type SubscriptionTier = "فئة الأكابر" | "فئة الأصاغر";

export type CovenantType = "تعهد غياب" | "ميثاق حفظ" | "التزام سلوكي";
export type CovenantStatus = "نشط" | "تم الوفاء بها" | "نُقِض";
export type CovenantCard = "بدون" | "بطاقة صفراء" | "بطاقة حمراء";

export interface Covenant {
  id: string;
  type: CovenantType;
  text: string;
  status: CovenantStatus;
  card: CovenantCard;
  date: string; // ISO String
}

export interface ExpulsionRecord {
  date: string; // ISO String
  reason: string;
}

export interface TransferRecord {
  date: string; // ISO String
  fromSheikhId: string;
  fromSheikhName?: string;
  fromGroupName: string;
  toSheikhId: string;
  toSheikhName?: string;
  toGroupName: string;
  reason: string;
}

export interface Student {
  id: string;
  ownerId: string; // UID of the user who owns this student record
  groupName?: string; // Name of the group/sheikh
  fullName: string;
  gender: "ذكر" | "أنثى";
  pageNumber?: string;
  educationalLevel?: string;
  guardianName: string;
  phone1: string;
  phone2?: string;
  photoURL?: string;
  birthDate: Date;
  registrationDate: Date;
  status: StudentStatus;
  subscriptionTier: SubscriptionTier;
  actionReason?: string; // Reason for deletion or expulsion
  memorizedSurahsCount: number;
  dailyMemorizationAmount: MemorizationAmount;
  notes?: string;
  sheikhNotes?: string;
  updatedAt: Date;
  covenants?: Covenant[];
  expulsionDate?: string | null;
  expulsionReason?: string | null;
  expulsionHistory?: ExpulsionRecord[];
  transferHistory?: TransferRecord[];
}

export type AttendanceStatus = "حاضر" | "غياب" | "غائب" | "متأخر" | "تعويض" | "";
export type PerformanceLevel = "ممتاز" | "جيد جدا" | "جيد جداً" | "جيد" | "متوسط" | "مقبول" | "ضعيف" | "لم يحفظ" | "لا يوجد" | "";
export type BehaviorLevel = "هادئ" | "متوسط" | "مقبول" | "غير منضبط" | "مشاغب" | "";
export type SessionType = "حصة أساسية" | "حصة أنشطة" | "يوم عطلة" | "حصة تعويضية" | "غياب الشيخ" | "حصة إضافية";

export interface DailyRecord {
  sessionId: string; // To link record to a specific session on a given date
  studentId: string;
  attendance: AttendanceStatus;
  memorization: PerformanceLevel | null;
  review: boolean | null;
  behavior: BehaviorLevel | null;
  notes?: string;
  surahId?: number;
  fromVerse?: number;
  toVerse?: number;
}

// A day can have multiple sessions
export interface DailySession {
  id: string; // Unique ID for the session, e.g., YYYY-MM-DD-1
  date: string; // YYYY-MM-DD
  sessionNumber: 1 | 2;
  sessionType: SessionType;
  records: DailyRecord[];
  teacherAbsenceReason?: string;
  substituteTeacher?: string;
  activityType?: string | null;
  activityDescription?: string | null;
  surahId?: number;
  fromVerse?: number;
  toVerse?: number;
  isReview?: boolean;
  ownerId?: string; // ID of the sheikh who created the session
  isTransferred?: boolean; // Flag for sessions moved between sheikhs
  transferredFrom?: string;
  transferReason?: string;
}

export interface DailyReport {
  id: string; // Unique ID for the report (timestamp or uuid)
  date: string; // YYYY-MM-DD
  note: string;
  timestamp: string; // ISO string
  authorName: string;
  authorId: string;
  category: string;
  status: 'pending' | 'reviewed' | 'in_progress';
  adminNotes: string | null;
  isPinned: boolean;
  priority?: 'normal' | 'urgent' | 'important';
  hasNewReply?: boolean;
}


export interface SessionRecord extends Omit<DailyRecord, 'sessionId'> {
  sessionType: string;
  sessionNumber: 1 | 2;
}

export type SurahStatus =
  | "قيد الحفظ"
  | "تم الحفظ"
  | "تمت المراجعة"
  | "تمت التلقين"
  | "إعادة حفظ"
  | "مراجعة جماعية"
  | "مؤجلة مؤقتًا";

export type SurahMasteryEntry = {
  status: 0 | 1 | 2; // 0: not memorized, 1: memorized, 2: mastered
  completedAt?: string; // ISO string for when it was first marked as status 1 or 2
};

export type SurahMastery = Record<number, SurahMasteryEntry>;


export interface SurahProgress {
  studentId: string;
  surahId: number;
  surahName: string;
  status: SurahStatus;
  fromVerse: number;
  toVerse: number;
  totalVerses: number;
  startDate?: Date;
  completionDate?: Date;
  retakeCount?: number;
  notes?: string;
}

export interface Surah {
  id: number;
  name: string;
  verses: number;
}


export interface AppUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  backgroundURL?: string | null;
  group?: string;
  role?: 'sheikh' | 'super_admin' | 'management';
  address?: string;
  maritalStatus?: 'متزوج' | 'أعزب';
  phone?: string;
  secondaryPhone?: string;
  certifications?: string;
  bio?: string;
  joinDate?: string;
  adminNotes?: string;
  adminAwards?: string;
  birthDate?: string;
  quranCompletedDate?: string;
  achievements?: string;
  futurePlans?: string;
  educationTimeline?: EducationEvent[];
  portalTheme?: string;
  fcmTokens?: string[];
  notificationEmail?: string;
  emailPreferences?: {
    weeklyReport?: boolean;
    absenceAlerts?: boolean;
    adminBroadcasts?: boolean;
    financialUpdates?: boolean;
    newStudents?: boolean;
  };
}

export interface EducationEvent {
  id: string;
  sheikhName: string;
  institution: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export interface InternalNotification {
  id: string;
  title: string;
  message: string;
  type: 'weekly_report' | 'monthly_report' | 'absence_alert' | 'achievement_newsletter' | 'payment_reminder' | 'admin_broadcast';
  senderId: string;
  timestamp: string;
  read: boolean;
  metadata?: any;
}

export interface StudentStat extends Partial<SessionRecord> {
  date: string;
  sessionType: string;
}

export type PaymentStatus = 'paid' | 'unpaid' | 'exempted';

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  date: string; // ISO String for the quarter start date
  status: PaymentStatus;
}

export interface PointsConfig {
  attendance: { 'حاضر': number; 'متأخر': number; 'تعويض': number; 'غائب': number };
  evaluation: { 'ممتاز': number; 'جيد جداً': number; 'جيد': number; 'متوسط': number; 'ضعيف': number };
  behavior: { 'هادئ': number; 'متوسط': number; 'غير منضبط': number };
  review: { 'completed': number };
  surah: { 'memorized': number; 'mastered': number };
  covenantCompleted: number; // Bonus for completing an empowerment task
}

export interface Reward {
  id: string;
  name: string;
  cost: number;
  icon: string; // Storing icon name as string
  description: string;
  requiredRank?: number; // Rank needed to unlock
}

export interface BadgeConfig {
  id: string;
  name: string;
  icon: string; // Icon name
  threshold: number; // Points needed
  metric: 'totalPoints' | 'masteryScore';
}

export interface AppSettings {
  seasonStartDate?: string; // ISO date string
  prices: {
    renewal: { 'فئة الأكابر': number; 'فئة الأصاغر': number; };
  };
  points: PointsConfig;
  rewards: Reward[];
  badges: BadgeConfig[];
  registrationFees: { [year: number]: { [quarter: number]: number } };
}

export interface HallOfFameData {
  commitmentKing: { id?: string; name?: string; streak: number; photoURL?: string; };
  academicKing: { id?: string; name?: string; streak: number; photoURL?: string; };
  behaviorKing: { id?: string; name?: string; streak: number; photoURL?: string; };
  suraGuardian: { id?: string; name?: string; count: number; photoURL?: string; };
  persistentTeacher: { streak: number; };
  givingRecord: { count: number; };
}


export type PreRegistrationStatus = "مؤجل" | "تم الإنضمام" | "مرفوض" | "إنضم لمدرسة أخرى" | "مرشح" | "تم الإتصال" | "مكرر";

export interface PreRegistration {
  id: string;
  ownerId?: string; // This will store the UID of the Sheikh who approved the student
  requestedAt: Date | string;
  fullName: string;
  gender: "ذكر" | "أنثى";
  birthDate: Date | string;
  educationalLevel?: string;
  guardianName?: string;
  phone1: string;
  phone2?: string;
  address?: string;
  status: PreRegistrationStatus;
  pageNumber?: string;
  notes?: string;
  photoURL?: string;
}

export interface LeagueStat {
  studentId: string;
  studentName: string;
  photoURL?: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: AttendanceStatus[];
  assists: number;
  rank: number;
  previousRank: number | null;
  movement: number;
}

export interface AdminLog {
  id: string;
  studentId: string;
  studentName: string;
  type: 'summon' | 'exit' | 'absence' | 'payment' | 'entry';
  date: string; // ISO string for the relevant action date
  sheikhName: string;
  groupName: string;
  details: any; // Flexible depending on type
  timestamp: string; // ISO string for record creation
}

export interface MeetingTopic {
  topic: string;
  speaker: string;
  solutions: string;
  isFeatured?: boolean;
}

export interface MeetingSuggestion {
  id: string;
  authorName: string;
  authorId: string;
  text: string;
  timestamp: string;
}

export interface Meeting {
  id: string;
  title: string;
  date: string; // Detailed string: e.g. "الأربعاء 28 جانفي 2026 من العشاء إلى 21:30"
  timestamp: string; // ISO string for sorting
  attendance: Record<string, { name: string; status: 'present' | 'absent' | 'excused' }>;
  foodProvided: boolean;
  foodDetails?: string;
  topics: MeetingTopic[];
  suggestions: MeetingSuggestion[];
  status: 'upcoming' | 'completed';
  createdBy: string;
}

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  actorId: string;
  actorName: string;
  targetId?: string;
  targetName?: string;
  details?: string;
  timestamp: any;
  groupName?: string;
}
export type SiteUpdateType = "ميزة جديدة" | "تحسين" | "إصلاح خطأ" | "تنبيه غداري" | "أخرى";

export interface SiteUpdate {
  id: string;
  title: string;
  description: string;
  date: string; // ISO string
  type: SiteUpdateType;
  status: 'published' | 'upcoming';
  dueDate?: string; // For upcoming updates
  authorId: string;
  authorName: string;
  version?: string;
}

// ===== Email Notification System =====
export type EmailNotificationStatus = 'pending' | 'reviewed' | 'scheduled' | 'sent' | 'failed';

export type EmailNotificationType =
  | 'weekly_report'
  | 'monthly_report'
  | 'absence_alert'
  | 'achievement_newsletter'
  | 'payment_reminder';

export interface EmailNotification {
  id: string;
  type: EmailNotificationType;
  recipientId: string; // Sheikh UID
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string; // HTML content
  status: EmailNotificationStatus;
  scheduledFor?: string; // ISO date string
  sentAt?: string;
  createdAt: string;
  createdBy: string; // Admin UID
  lastModifiedAt?: string;
  lastModifiedBy?: string;
  errorMessage?: string;
}

export interface EmailPreferences {
  weeklyReport: boolean;
  monthlyReport: boolean;
  absenceAlerts: boolean;
  achievementNews: boolean;
  paymentReminders: boolean;
}
