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
  memorizedSurahsCount: number;
  dailyMemorizationAmount: MemorizationAmount;
  notes?: string;
  actionReason?: string; // Reason for deletion or expulsion
  updatedAt: Date;
}

export type AttendanceStatus = "حاضر" | "غائب" | "متأخر" | "غير مطالب";
export type PerformanceLevel = "ممتاز" | "جيد" | "متوسط" | "ضعيف" | "لا يوجد";
export type BehaviorLevel = "هادئ" | "متوسط" | "غير منضبط";
export type SessionType = "حصة أساسية" | "حصة إضافية 1" | "حصة إضافية 2" | "حصة أنشطة";

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
