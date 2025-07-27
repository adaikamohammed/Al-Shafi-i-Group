export type StudentStatus = "نشط" | "مطرود" | "غائب طويل";
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
}

export type AttendanceStatus = "حاضر" | "غائب" | "متأخر";
export type PerformanceLevel = "ممتاز" | "جيد" | "متوسط" | "ضعيف";
export type BehaviorLevel = "هادئ" | "متوسط" | "غير منضبط";

export interface DailyRecord {
  studentId: string;
  attendance: AttendanceStatus;
  memorization: PerformanceLevel;
  review: boolean;
  behavior: BehaviorLevel;
  notes?: string;
}

export type SurahStatus = "قيد الحفظ" | "تم الحفظ" | "تم التلقين" | "مراجعة";

export interface SurahProgress {
    studentId: string;
    surahId: number;
    surahName: string;
    status: SurahStatus;
    fromVerse: number;
    toVerse: number;
    totalVerses: number;
}
