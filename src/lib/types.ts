

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
  updatedAt: Date;
  covenants?: Covenant[];
}

export type AttendanceStatus = "حاضر" | "غائب" | "متأخر" | "تعويض";
export type PerformanceLevel = "ممتاز" | "جيد جداً" | "جيد" | "متوسط" | "ضعيف" | "لا يوجد";
export type BehaviorLevel = "هادئ" | "متوسط" | "غير منضبط";
export type SessionType = "حصة أساسية" | "حصة أنشطة" | "يوم عطلة" | "حصة تعويضية" | "غياب الشيخ";

export interface DailyRecord {
  sessionId: string; // To link record to a specific session on a given date
  studentId: string;
  attendance: AttendanceStatus;
  memorization: PerformanceLevel | null;
  review: boolean | null;
  behavior: BehaviorLevel | null;
  notes?: string;
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
}

export interface DailyReport {
  id: string; // Unique ID for the report (timestamp or uuid)
  date: string; // YYYY-MM-DD
  note: string;
  timestamp: string; // ISO string
  authorName: string;
  authorId: string;
  category: string;
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

export type SurahMastery = Record<number, 0 | 1 | 2>; // 0: not memorized, 1: memorized, 2: mastered

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
    group?: string;
    role?: 'sheikh' | 'super_admin';
    address?: string;
    maritalStatus?: 'متزوج' | 'أعزب';
    phone?: string;
    secondaryPhone?: string;
    certifications?: string;
    bio?: string;
    joinDate?: string;
    adminNotes?: string;
    adminAwards?: string;
}

export interface StudentStat extends Partial<SessionRecord> {
  date: string;
  sessionType: string;
}

export interface Payment {
    id: string;
    studentId: string;
    amount: number;
    date: string; // ISO String
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
        firstPayment: { 'فئة الأكابر': number; 'فئة الأصاغر': number; };
        renewal: { 'فئة الأكابر': number; 'فئة الأصاغر': number; };
    };
    points: PointsConfig;
    rewards: Reward[];
    badges: BadgeConfig[];
}

export type PreRegistrationStatus = "مؤجل" | "تم الإنضمام" | "مرفوض" | "إنضم لمدرسة أخرى" | "مرشح";

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
    
