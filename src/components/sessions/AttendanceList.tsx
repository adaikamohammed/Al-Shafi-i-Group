import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Check, X, Clock, Star, MessageSquare, BookOpen, Plus, Trash2, Rewind, CheckCircle2, XCircle, RefreshCw, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Student, AttendanceStatus, PerformanceLevel, BehaviorLevel, MakeupSession } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/context/AuthContext';
import { surahs } from '@/lib/surahs';
import { CatchUpEntry } from '@/lib/types';
import { SmartSurahPicker, parseDailyAmount } from './SmartSurahPicker';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const MEMORIZATION_OPTIONS = [
  { value: "ممتاز", emoji: "🌟", label: "ممتاز", color: "bg-emerald-600 dark:bg-emerald-700 text-white border-transparent" },
  { value: "جيد جدا", emoji: "✅", label: "جيد جداً", color: "bg-teal-600 dark:bg-teal-750 text-white border-transparent" },
  { value: "جيد", emoji: "👍", label: "جيد", color: "bg-blue-600 dark:bg-blue-700 text-white border-transparent" },
  { value: "حسن", emoji: "😊", label: "حسن", color: "bg-sky-500 dark:bg-sky-600 text-white border-transparent" },
  { value: "مقبول", emoji: "⚠️", label: "مقبول", color: "bg-amber-500 dark:bg-amber-600 text-white border-transparent" },
  { value: "ضعيف", emoji: "❌", label: "ضعيف", color: "bg-orange-500 dark:bg-orange-600 text-white border-transparent" },
  { value: "لم يحفظ", emoji: "🚫", label: "لم يحفظ", color: "bg-red-600 dark:bg-red-800 text-white border-transparent" },
  { value: "لا يوجد", emoji: "➖", label: "لا يوجد", color: "bg-slate-500 dark:bg-slate-600 text-white border-transparent" },
];

export interface AttendanceRecord {
    studentId: string;
    attendance: AttendanceStatus;
    memorization: PerformanceLevel;
    behavior: BehaviorLevel;
    notes: string;
    review: boolean;
    bonus?: string;
    negativeBonus?: string;
    isDelayed?: boolean;
    surahId?: number;
    fromVerse?: number;
    toVerse?: number;
    catchUpRecords?: CatchUpEntry[];
    makeupSessions?: MakeupSession[];
}

interface AttendanceListProps {
    students: Student[];
    records: Record<string, AttendanceRecord>;
    onUpdateRecord: (studentId: string, field: keyof AttendanceRecord, value: any) => void;
    viewMode?: 'full' | 'attendance' | 'evaluation';
    sessionType?: string;
    pastWirds?: { date: string, dayName: string, sessionNumber: number, surahId: number, surahName: string, fromVerse: number, toVerse: number, presentStudentIds: string[] }[];
    studentAbsenceHistory?: Record<string, Array<{ date: string; label: string }>>;
    groupMode?: 'unified' | 'individual' | 'hybrid' | 'not_set';
    studentLastProgress?: Map<string, { surahId: number; toVerse: number }> | Record<string, { surahId: number; toVerse: number }>;
    onUpdateStudentReviewMode?: (studentId: string, isReviewing: boolean) => Promise<void>;
}

export const AttendanceList = ({
    students,
    records,
    onUpdateRecord,
    viewMode = 'full',
    sessionType,
    pastWirds = [],
    studentAbsenceHistory = {},
    groupMode = 'individual',
    studentLastProgress = new Map(),
    onUpdateStudentReviewMode
}: AttendanceListProps) => {
    const { user } = useAuth();
    const isAdmin5 = user?.email === 'admin5@gmail.com';
    const isActivitySession = sessionType === 'حصة أنشطة';

    // ── Makeup Dialog State ──────────────────────────────────────
    const [makeupDialogStudentId, setMakeupDialogStudentId] = useState<string | null>(null);
    const [makeupForDate, setMakeupForDate] = useState('');
    const [makeupMemo, setMakeupMemo] = useState<string>('');
    const [makeupBehavior, setMakeupBehavior] = useState<string>('');
    const [makeupReview, setMakeupReview] = useState(false);

    // State to track expanded students for detailed configurations (Wird, Notes, Behavior, Bonus, Deductions)
    const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

    const openMakeupDialog = (studentId: string) => {
        setMakeupDialogStudentId(studentId);
        setMakeupForDate('');
        setMakeupMemo('');
        setMakeupBehavior('');
        setMakeupReview(false);
    };

    const closeMakeupDialog = () => {
        setMakeupDialogStudentId(null);
        setMakeupForDate('');
        setMakeupMemo('');
        setMakeupBehavior('');
        setMakeupReview(false);
    };

    const handleSaveMakeup = () => {
        if (!makeupDialogStudentId || !makeupForDate) return;
        const existingRecord = records[makeupDialogStudentId];
        const existingMakeups: MakeupSession[] = existingRecord?.makeupSessions || [];
        // منع التعويض المكرر لنفس اليوم
        if (existingMakeups.some(m => m.makeupForDate === makeupForDate)) return;

        const newMakeup: MakeupSession = {
            id: `mu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            makeupForDate,
            memorization: makeupMemo as PerformanceLevel,
            behavior: makeupBehavior as BehaviorLevel,
            review: makeupReview,
            savedAt: new Date().toISOString(),
        };
        onUpdateRecord(makeupDialogStudentId, 'makeupSessions', [...existingMakeups, newMakeup]);
        closeMakeupDialog();
    };

    const handleDeleteMakeup = (studentId: string, makeupId: string) => {
        const existingRecord = records[studentId];
        const updated = (existingRecord?.makeupSessions || []).filter(m => m.id !== makeupId);
        onUpdateRecord(studentId, 'makeupSessions', updated);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'حاضر': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'غياب': return 'bg-red-100 text-red-700 border-red-200';
            case 'متأخر': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-gray-100 text-gray-500 border-gray-200';
        }
    };

    // الطالب المختار للتعويض
    const makeupStudent = makeupDialogStudentId ? students.find(s => s.id === makeupDialogStudentId) : null;
    const makeupStudentRecord = makeupDialogStudentId ? records[makeupDialogStudentId] : null;
    const absenceOptions = makeupDialogStudentId ? (studentAbsenceHistory[makeupDialogStudentId] || []) : [];
    // الأيام التي عُوِّضت بالفعل اليوم
    const alreadyCompensated = new Set((makeupStudentRecord?.makeupSessions || []).map(m => m.makeupForDate));
    const availableAbsences = absenceOptions.filter(a => !alreadyCompensated.has(a.date));

    return (
        <>
            <div className="space-y-4" dir="rtl">
                {students.map((student) => {
                    const record = records[student.id] || { attendance: '', memorization: '', behavior: '', notes: '', review: false };
                    const selectedSurah = surahs.find(s => s.id === record.surahId);
                    const studentMakeups = record.makeupSessions || [];
                    const studentAbsences = studentAbsenceHistory[student.id] || [];
                    const hasAbsenceHistory = studentAbsences.length > 0;

                    const lastProgress = (studentLastProgress instanceof Map)
                        ? studentLastProgress.get(student.id)
                        : (studentLastProgress as any)?.[student.id];
                    const lastSurahId = lastProgress?.surahId;
                    const lastToVerse = lastProgress?.toVerse;
                    const dailyAmount = parseDailyAmount(student.dailyMemorizationAmount);

                    return (
                        <Card key={student.id} className={cn(
                            "transition-all duration-300 overflow-hidden border shadow-sm hover:shadow-md",
                            record.attendance === 'غياب' ? 'opacity-80 bg-red-50/30' : 'bg-card'
                        )}>
                            <CardContent className="p-2 md:p-4">
                                <div className="flex flex-col gap-2 md:gap-4">
                                    {/* Header: Avatar & Name */}
                                    <div className="flex items-center gap-2 md:gap-3">
                                        <Avatar className="h-8 w-8 md:h-12 md:w-12 border-2 border-background shadow-sm shrink-0">
                                            <AvatarImage src={student.photoURL} className="object-cover" />
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{student.fullName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-xs md:text-base truncate leading-tight">{student.fullName}</h3>
                                            <div className="flex gap-2 text-[10px] md:text-xs text-muted-foreground items-center">
                                                {!isActivitySession && <span className="truncate">{student.dailyMemorizationAmount}</span>}
                                                {record.attendance && (
                                                    <Badge variant="outline" className={cn("text-[9px] md:text-[10px] px-1 py-0", getStatusColor(record.attendance))}>
                                                        {record.attendance}
                                                    </Badge>
                                                )}
                                                {/* عرض عدد التعويضات المسجلة اليوم */}
                                                {studentMakeups.length > 0 && (
                                                    <Badge variant="outline" className="text-[9px] md:text-[10px] px-1 py-0 bg-teal-50 text-teal-700 border-teal-200">
                                                        🔄 {studentMakeups.length} تعويض
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* زر طي/فرد تفاصيل الطالب */}
                                        {(record.attendance === 'حاضر' || record.attendance === 'متأخر') && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setExpandedStudents(prev => ({ ...prev, [student.id]: !prev[student.id] }))}
                                                className="h-8 px-2.5 rounded-xl text-xs font-bold mr-auto shrink-0 flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 transition-all"
                                            >
                                                <span>
                                                    {expandedStudents[student.id] ? "إخفاء التفاصيل" : "الورد والخيارات ⚙️"}
                                                </span>
                                                {expandedStudents[student.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                            </Button>
                                        )}
                                    </div>

                                    {/* Actions Row - Reorganized into Full-Width Stacked Layout */}
                                    <div className="space-y-4">
                                        {/* 1. الحضور (Attendance) */}
                                                                        {(viewMode === 'full' || viewMode === 'attendance') && (
                                            <div className="flex gap-1 md:gap-2 h-9 md:h-10 w-full sm:max-w-md">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={record.attendance === 'حاضر' ? 'default' : 'outline'}
                                                    className={cn("flex-1 text-[11px] sm:text-xs font-black rounded-xl px-1 sm:px-3", record.attendance === 'حاضر' && "bg-emerald-600 hover:bg-emerald-700")}
                                                    onClick={() => onUpdateRecord(student.id, 'attendance', record.attendance === 'حاضر' ? '' : 'حاضر')}
                                                >
                                                    <Check className="h-3.5 w-3.5 ml-1 sm:ml-1.5 shrink-0" /> حاضر
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={record.attendance === 'متأخر' ? 'default' : 'outline'}
                                                    className={cn("flex-1 text-[11px] sm:text-xs font-black rounded-xl px-1 sm:px-3", record.attendance === 'متأخر' && "bg-amber-500 hover:bg-amber-600")}
                                                    onClick={() => onUpdateRecord(student.id, 'attendance', record.attendance === 'متأخر' ? '' : 'متأخر')}
                                                >
                                                    <Clock className="h-3.5 w-3.5 ml-1 sm:ml-1.5 shrink-0" /> متأخر
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant={record.attendance === 'غياب' ? 'destructive' : 'outline'}
                                                    className={cn("flex-1 text-[11px] sm:text-xs font-black rounded-xl px-1 sm:px-3", record.attendance === 'غياب' && "bg-red-600 hover:bg-red-700")}
                                                    onClick={() => onUpdateRecord(student.id, 'attendance', record.attendance === 'غياب' ? '' : 'غياب')}
                                                >
                                                    <X className="h-3.5 w-3.5 ml-1 sm:ml-1.5 shrink-0" /> غائب
                                                </Button>
                                            </div>
                                        )}

                                        {/* 2. التقييم اليومي (Memorization Ratings - Only if Present/Late) */}
                                        {(record.attendance === 'حاضر' || record.attendance === 'متأخر') && (viewMode === 'full' || viewMode === 'evaluation') && (
                                            <div className="space-y-2 border-t pt-3">
                                                <p className="text-[10px] md:text-xs font-black text-muted-foreground/70 tracking-wider">تقييم الحفظ والتسميع</p>
                                                {!isActivitySession && (
                                                    student.isReviewing ? (
                                                        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-right w-full">
                                                            <div className="flex-1">
                                                                <p className="text-xs font-black text-purple-800 dark:text-purple-300">
                                                                    🔄 الطالب في أيام مراجعة شاملة لسورة {surahs.find(s => s.id === (record.surahId || student.currentSurahId))?.name || ""}
                                                                </p>
                                                                <p className="text-[10px] font-semibold text-purple-650 dark:text-purple-400 mt-0.5 leading-normal">
                                                                    يراجع الطالب السورة حالياً بدون رصد حفظ جديد. يُرجى رصد حالة "المراجعة" بالأسفل. (ملاحظة: أيام المراجعة الشاملة تمنح الطالب نقاطاً يومية تعادل تقييم "جيد" تلقائياً حمايةً لنقاطه التراكمية).
                                                                </p>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    try {
                                                                        if (onUpdateStudentReviewMode) {
                                                                            await onUpdateStudentReviewMode(student.id, false);
                                                                        }
                                                                    } catch (e) {
                                                                        console.error(e);
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black transition-all shadow-sm shrink-0 whitespace-nowrap"
                                                            >
                                                                إنهاء المراجعة والانتقال لسورة جديدة
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5 w-full">
                                                            {MEMORIZATION_OPTIONS.map((opt) => {
                                                                const isSelected = record.memorization === opt.value;
                                                                return (
                                                                    <button
                                                                        key={opt.value}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const patch: any = { memorization: isSelected ? '' : opt.value };
                                                                            if (!isSelected && opt.value && !record.attendance) {
                                                                                patch.attendance = 'حاضر';
                                                                            }
                                                                            Object.entries(patch).forEach(([field, val]) => {
                                                                                onUpdateRecord(student.id, field as any, val);
                                                                            });
                                                                        }}
                                                                        className={cn(
                                                                            "px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border shrink-0 hover:scale-[1.02]",
                                                                            isSelected
                                                                                ? `${opt.color} shadow-md scale-105`
                                                                                : "bg-background border-border text-muted-foreground hover:bg-muted/15 hover:text-foreground"
                                                                        )}
                                                                    >
                                                                        <span>{opt.emoji}</span>
                                                                        <span>{opt.label}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}
                                     </div>

                                        {/* Collapsible Section for Wird and Extra Options */}
                                        {(record.attendance === 'حاضر' || record.attendance === 'متأخر') && (viewMode === 'full' || viewMode === 'evaluation') && expandedStudents[student.id] && (
                                            <div className="space-y-4 border-t pt-3 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {/* 3. الخيارات الفرعية (المساعدات، السلوك، البونص، الخصم السلوكي) */}
                                                <div className="flex flex-wrap gap-3 items-center">
                                                    {/* المراجعة والاستدراك */}
                                                    {!isActivitySession && !student.isReviewing && (
                                                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                            {/* Per-student Review Toggle */}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    onUpdateRecord(student.id, 'review', !record.review);
                                                                }}
                                                                className={cn(
                                                                    "flex items-center justify-center gap-1.5 h-8 md:h-9 px-3.5 rounded-xl border-2 font-bold text-xs transition-all shrink-0",
                                                                    record.review
                                                                        ? "bg-blue-100 border-blue-400 text-blue-800 shadow-sm"
                                                                        : "bg-muted/30 border-muted-foreground/20 text-muted-foreground hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                                                                )}
                                                            >
                                                                <BookOpen className="h-3.5 w-3.5" />
                                                                مراجعة
                                                            </button>

                                                            {/* Late/delayed checkbox */}
                                                            {record.memorization && record.memorization !== 'لم يحفظ' && record.memorization !== 'لا يوجد' && record.memorization !== 'لا يوجد حصيلة' && (
                                                                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl shrink-0 select-none transition-all hover:bg-amber-100">
                                                                    <Checkbox
                                                                        checked={!!record.isDelayed}
                                                                        onCheckedChange={(checked) => onUpdateRecord(student.id, 'isDelayed', !!checked)}
                                                                        className="h-3.5 w-3.5 border-amber-400 data-[state=checked]:bg-amber-600 data-[state=checked]:text-white"
                                                                    />
                                                                    <span>استدراك ⏳</span>
                                                                </label>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* السلوك، البونص، الخصم السلوكي - جنبًا إلى جنب في شبكة ثلاثية على الجوال */}
                                                    <div className="w-full sm:w-auto grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-3">
                                                        {/* السلوك (Behavior) */}
                                                        <div className="w-full sm:w-[120px] md:w-[140px] shrink-0">
                                                            <Select value={record.behavior} onValueChange={(val) => onUpdateRecord(student.id, 'behavior', val)} dir="rtl">
                                                                <SelectTrigger className="h-8 md:h-9 text-[10px] sm:text-xs font-bold w-full rounded-xl">
                                                                    <SelectValue placeholder="السلوك" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="هادئ">هادئ</SelectItem>
                                                                    <SelectItem value="مقبول">مقبول</SelectItem>
                                                                    <SelectItem value="مشاغب">مشاغب</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* البونص (Bonus) */}
                                                        <div className="w-full sm:w-[120px] md:w-[140px] shrink-0">
                                                            <Select value={record.bonus || ""} onValueChange={(val) => onUpdateRecord(student.id, 'bonus', val)} dir="rtl">
                                                                <SelectTrigger className="h-8 md:h-9 text-[10px] sm:text-xs font-bold w-full border-purple-200 focus:border-purple-400 bg-purple-50/20 text-purple-700 rounded-xl">
                                                                    <SelectValue placeholder="بونص" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="لا يوجد">❌ لا يوجد</SelectItem>
                                                                    <SelectItem value="مشاركة مميزة">⭐ مشاركة (+1)</SelectItem>
                                                                    <SelectItem value="تفاعل إيجابي">✨ تفاعل (+1.5)</SelectItem>
                                                                    <SelectItem value="انضباط متميز">🏆 انضباط (+2)</SelectItem>
                                                                    <SelectItem value="حفظ زائد">📚 حفظ زائد (+3)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* الخصم السلوكي (Deduction) */}
                                                        <div className="w-full sm:w-[120px] md:w-[140px] shrink-0">
                                                            <Select value={record.negativeBonus || ""} onValueChange={(val) => onUpdateRecord(student.id, 'negativeBonus', val)} dir="rtl">
                                                                <SelectTrigger className="h-8 md:h-9 text-[10px] sm:text-xs font-bold w-full border-red-200 focus:border-red-400 bg-red-50/20 text-red-700 rounded-xl">
                                                                    <SelectValue placeholder="خصم سلوكي ⚠️" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="لا يوجد">❌ لا يوجد</SelectItem>
                                                                    <SelectItem value="لباس غير لائق">👕 لباس غير لائق (-1.5)</SelectItem>
                                                                    <SelectItem value="بدون مصحف">📖 بدون مصحف (-1)</SelectItem>
                                                                    <SelectItem value="إهمال المراجعة المنزلية">🏠 إهمال المراجعة (-2)</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 4. ملاحظات (Notes) */}
                                                <div className="w-full pt-1">
                                                    <Input
                                                        className="h-8 md:h-9 text-xs bg-muted/20 w-full rounded-xl"
                                                        placeholder="ملاحظات الحصة للتلميذ..."
                                                        value={record.notes}
                                                        onChange={(e) => onUpdateRecord(student.id, 'notes', e.target.value)}
                                                    />
                                                </div>

                                                {/* 5. الورد (السورة والآيات) - SmartSurahPicker */}
                                                {sessionType !== 'حصة أنشطة' && (
                                                    <div className="border-t pt-3 mt-1">
                                                        <p className="text-[10px] md:text-xs font-black text-gray-400 uppercase tracking-wider mb-2">الورد (السورة والآيات)</p>
                                                        {groupMode === "unified" ? (
                                                            <div className="px-3 py-2 bg-indigo-50/50 rounded-xl border border-indigo-100 text-xs text-indigo-700 font-bold flex items-center gap-1.5 w-fit">
                                                                <BookOpen className="w-4 h-4 text-indigo-500" />
                                                                <span>يتبع الورد الموحد للفوج</span>
                                                            </div>
                                                        ) : student.isReviewing || (record.memorization && record.memorization !== "لم يحفظ" && record.memorization !== "لا يوجد" && record.memorization !== "لا يوجد حصيلة") ? (
                                                            <SmartSurahPicker
                                                                lastSurahId={lastSurahId}
                                                                lastToVerse={lastToVerse}
                                                                dailyAmount={dailyAmount}
                                                                currentSurahId={record.surahId}
                                                                currentFromVerse={record.fromVerse}
                                                                currentToVerse={record.toVerse}
                                                                onChange={(patch) => {
                                                                    Object.entries(patch).forEach(([field, value]) => {
                                                                        onUpdateRecord(student.id, field as any, value);
                                                                    });
                                                                }}
                                                                studentId={student.id}
                                                                isReviewing={student.isReviewing}
                                                                onToggleReviewMode={(val) => onUpdateStudentReviewMode?.(student.id, val)}
                                                            />
                                                        ) : record.memorization === "لم يحفظ" ? (
                                                            <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-2xl text-xs text-gray-500 font-bold">
                                                                🚫 لا يوجد ورد تسميع اليوم لأن تقييم الطالب هو "لم يحفظ".
                                                            </div>
                                                        ) : (
                                                            <div className="px-3.5 py-3 bg-amber-50/50 border border-amber-250/50 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800 font-semibold max-w-md">
                                                                <span className="text-base leading-none">💡</span>
                                                                <span>لا يمكن رصد وتحديد ورد التسميع والآيات إلا بعد اختيار تقييم الحفظ للطالب أولاً.</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* ── قسم التعويض ── */}
                                                {viewMode === 'full' && (
                                                    <div className="border-t pt-2 mt-1 space-y-2">
                                                        {/* عرض التعويضات المسجلة اليوم */}
                                                        {studentMakeups.length > 0 && (
                                                            <div className="space-y-1">
                                                                {studentMakeups.map(mu => (
                                                                    <div key={mu.id} className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1 text-[10px] md:text-xs">
                                                                        <RefreshCw className="h-3 w-3 text-teal-600 shrink-0" />
                                                                        <span className="text-teal-800 font-bold flex-1">
                                                                            تعويض {mu.makeupForDate}
                                                                            {mu.memorization && ` · ${mu.memorization}`}
                                                                            {mu.behavior && ` · ${mu.behavior}`}
                                                                            {mu.review && ' · مراجعة'}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteMakeup(student.id, mu.id)}
                                                                            className="text-red-400 hover:text-red-600 transition-colors shrink-0"
                                                                            title="حذف التعويض"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* زر إضافة تعويض */}
                                                        <button
                                                            type="button"
                                                            onClick={() => openMakeupDialog(student.id)}
                                                            className={cn(
                                                                "flex items-center gap-1.5 text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                                                                hasAbsenceHistory
                                                                    ? "bg-teal-50 border-teal-300 text-teal-700 hover:bg-teal-100"
                                                                    : "bg-muted/20 border-muted text-muted-foreground/60 cursor-not-allowed"
                                                            )}
                                                            disabled={!hasAbsenceHistory}
                                                            title={hasAbsenceHistory ? "تسجيل تعويض حصة غياب سابقة" : "لا توجد غيابات سابقة لهذا الطالب"}
                                                        >
                                                            <RefreshCw className="h-3 w-3" />
                                                            {studentMakeups.length > 0 ? "إضافة تعويض آخر" : "تعويض حصة سابقة"}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* ── نافذة تسجيل التعويض ─────────────────────────────── */}
            <Dialog open={!!makeupDialogStudentId} onOpenChange={(open) => { if (!open) closeMakeupDialog(); }}>
                <DialogContent className="max-w-md" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-teal-700">
                            <RefreshCw className="h-5 w-5" />
                            تسجيل تعويض حصة
                        </DialogTitle>
                        <DialogDescription>
                            {makeupStudent?.fullName && (
                                <span className="font-bold text-foreground">{makeupStudent.fullName}</span>
                            )}
                            {" — اختر يوم الغياب الذي يعوضه الطالب اليوم"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        {/* اختيار يوم الغياب */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 text-teal-600" />
                                يوم الغياب المُعوَّض
                            </Label>
                            {availableAbsences.length === 0 ? (
                                <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 text-center">
                                    {absenceOptions.length === 0
                                        ? "لا توجد غيابات مسجلة لهذا الطالب"
                                        : "جميع الغيابات المسجلة تم تعويضها بالفعل اليوم"}
                                </p>
                            ) : (
                                <Select value={makeupForDate} onValueChange={setMakeupForDate} dir="rtl">
                                    <SelectTrigger className="h-10 rounded-xl">
                                        <SelectValue placeholder="اختر يوم الغياب..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableAbsences.map(a => (
                                            <SelectItem key={a.date} value={a.date}>
                                                {a.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* تقييم الحفظ */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">تقييم الحفظ في التعويض</Label>
                            <Select value={makeupMemo} onValueChange={setMakeupMemo} dir="rtl">
                                <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue placeholder="اختر التقييم..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ممتاز">🌟 ممتاز</SelectItem>
                                    <SelectItem value="جيد جدا">✅ جيد جداً</SelectItem>
                                    <SelectItem value="جيد">👍 جيد</SelectItem>
                                    <SelectItem value="حسن">😊 حسن</SelectItem>
                                    <SelectItem value="مقبول">⚠️ مقبول</SelectItem>
                                    <SelectItem value="ضعيف">❌ ضعيف</SelectItem>
                                    <SelectItem value="لم يحفظ">🚫 لم يحفظ</SelectItem>
                                    <SelectItem value="لا يوجد">لا يوجد حفظ</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* السلوك */}
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">السلوك في التعويض</Label>
                            <Select value={makeupBehavior} onValueChange={setMakeupBehavior} dir="rtl">
                                <SelectTrigger className="h-10 rounded-xl">
                                    <SelectValue placeholder="اختر السلوك..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="هادئ">هادئ</SelectItem>
                                    <SelectItem value="مقبول">مقبول</SelectItem>
                                    <SelectItem value="مشاغب">مشاغب</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* مراجعة */}
                        <label className="flex items-center gap-3 cursor-pointer bg-blue-50 border border-blue-200 rounded-xl p-3">
                            <Checkbox
                                checked={makeupReview}
                                onCheckedChange={(c) => setMakeupReview(!!c)}
                                className="border-blue-400 data-[state=checked]:bg-blue-600"
                            />
                            <div>
                                <p className="text-sm font-bold text-blue-800">حصة مراجعة</p>
                                <p className="text-[11px] text-blue-600">الطالب راجع في هذه الحصة التعويضية</p>
                            </div>
                        </label>

                        {/* ملاحظة النقاط */}
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-800 flex items-start gap-2">
                            <span className="text-base">💡</span>
                            <span>نقاط التعويض أقل من الحضور الأصلي — يُحتسب التعويض بشكل فردي ولا يؤثر على نسبة حضور المجموعة.</span>
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={closeMakeupDialog} className="rounded-xl">
                            إلغاء
                        </Button>
                        <Button
                            onClick={handleSaveMakeup}
                            disabled={!makeupForDate || availableAbsences.length === 0}
                            className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            حفظ التعويض
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
