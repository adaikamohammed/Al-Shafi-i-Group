

export type StudentStatus = "نشط" | "مطرود" | "غائب طويل" | "محذوف";
export type MemorizationAmount = "ثمن" | "ربع" | "نصف" | "صفحة" | "أكثر";

export interface Student {
  id: string;
  ownerId: string; // UID of the user who owns this student record
  fullName: string;
  guardianName: string;
  phone1: string;
  phone2?: string;
  birthDate: Date;
  registrationDate: Date;
  status: StudentStatus;
  actionReason?: string; // Reason for deletion or expulsion
  memorizedSurahsCount: number;
  dailyMemorizationAmount: MemorizationAmount;
  notes?: string;
  updatedAt: Date;
}

export type AttendanceStatus = "حاضر" | "غائب" | "متأخر" | "تعويض";
export type PerformanceLevel = "ممتاز" | "جيد" | "متوسط" | "ضعيف" | "لا يوجد";
export type BehaviorLevel = "هادئ" | "متوسط" | "غير منضبط";
export type SessionType = "حصة أساسية" | "حصة أنشطة" | "يوم عطلة" | "حصة تعويضية";

export interface DailyRecord {
  studentId: string;
  attendance: AttendanceStatus;
  memorization: PerformanceLevel | null;
  review: boolean | null;
  behavior: BehaviorLevel | null;
  notes?: string;
}

// This represents the entire session for a given day
export interface DailySession {
    date: string; // YYYY-MM-DD
    sessionType: SessionType;
    records: SessionRecord[];
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


export interface SessionRecord extends DailyRecord {
  // SessionRecord is now the same as DailyRecord
  // but we keep it for potential future differences
}

export type SurahStatus = 
  | "قيد الحفظ" 
  | "تم الحفظ" 
  | "تمت المراجعة"
  | "تمت التلقين" 
  | "إعادة حفظ" 
  | "مراجعة جماعية"
  | "مؤجلة مؤقتًا";

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
}

export interface StudentStat extends Partial<SessionRecord> {
  date: string;
  sessionType: string;
}
