
export type StudentStatus = "نشط" | "مطرود" | "غائب طويل" | "محذوف";
export type MemorizationAmount = "ثمن" | "ربع" | "نصف" | "صفحة" | "أكثر";

export interface Student {
  id: string;
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
export type SessionType = "حصة أساسية" | "حصة أنشطة" | "يوم عطلة";

export interface DailyRecord {
  studentId: string;
  attendance: AttendanceStatus;
  memorization: PerformanceLevel | null;
  review: boolean | null;
  behavior: BehaviorLevel | null;
  notes?: string;
  surahId?: number | null;
  fromVerse?: number | null;
  toVerse?: number | null;
}

export interface SessionRecord extends DailyRecord {
    date: string; // YYYY-MM-DD
    sessionType: SessionType;
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

// This type is now defined here and shared with AuthContext
export interface AppUser {
    uid: string;
    name: string;
    email: string | null;
    photoURL?: string | null;
    createdAt: any;
    role: 'شيخ' | 'إدارة';
}
