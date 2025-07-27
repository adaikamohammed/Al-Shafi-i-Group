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

export type AttendanceStatus = "حاضر" | "غائب" | "متأخر" | "غير مطالب";
export type PerformanceLevel = "ممتاز" | "جيد" | "متوسط" | "ضعيف";
export type BehaviorLevel = "هادئ" | "متوسط" | "غير منضبط";
export type SessionType = "حصة أساسية" | "حصة إضافية 1" | "حصة إضافية 2" | "حصة أنشطة";

export interface DailyRecord {
  studentId: string;
  attendance: AttendanceStatus;
  memorization: PerformanceLevel | null; // Can be null for activity sessions or "not required"
  review: boolean | null; // Can be null
  behavior: BehaviorLevel | null; // Can be null
  notes?: string;
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
