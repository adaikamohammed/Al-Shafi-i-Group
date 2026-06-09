import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addDays, parseISO, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Loader2, Save, Star, CheckCircle2, ThumbsUp, Smile, AlertCircle, XCircle, UserMinus, Minus, CalendarOff } from 'lucide-react';
import type { Student, DailySession, DailyRecord, WeeklyOutcome, PerformanceLevel } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { surahs } from '@/lib/surahs';
import { cn } from '@/lib/utils';

interface WeeklyOutcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    student: Student;
    weekStartDate: Date; // Saturday
    currentOutcome?: WeeklyOutcome;
}

const PERFORMANCE_MAPPING: Record<string, number> = {
    'ممتاز': 5,
    'جيد جداً': 4,
    'جيد جدا': 4,
    'جيد': 3,
    'حسن': 2,
    'مقبول': 2,
    'متوسط': 1,
    'ضعيف': 1,
    'لم يحفظ': 0,
};

const REVERSE_MAPPING: PerformanceLevel[] = [
    'لم يحفظ', // 0
    'متوسط',   // 1
    'حسن',     // 2
    'جيد',     // 3
    'جيد جداً', // 4
    'ممتاز',   // 5
];

const getDerivedWeeklyEvaluation = (memorizationLevels: (string | undefined)[]): PerformanceLevel => {
    const validLevels = memorizationLevels
        .filter((m): m is string => !!m && PERFORMANCE_MAPPING[m] !== undefined);

    if (validLevels.length === 0) return '' as PerformanceLevel;

    const sum = validLevels.reduce((s, m) => s + PERFORMANCE_MAPPING[m], 0);
    const avg = Math.round(sum / validLevels.length);

    return REVERSE_MAPPING[avg] || '' as PerformanceLevel;
};

const EVALUATION_OPTIONS: PerformanceLevel[] = ['ممتاز', 'جيد جداً', 'جيد', 'حسن', 'متوسط', 'لم يحفظ'];
const NO_SESSION_VALUE = 'لا يوجد حصيلة' as PerformanceLevel;

const normalizeLevel = (level: string | null | undefined): PerformanceLevel => {
    if (!level) return '' as PerformanceLevel;
    if (level === 'جيد جدا') return 'جيد جداً';
    return level as PerformanceLevel;
};

const getEvaluationIcon = (level: string | undefined) => {
    switch (level) {
        case 'ممتاز': return <Star className="h-4 w-4 text-green-600 fill-green-600" />;
        case 'جيد جداً': return <CheckCircle2 className="h-4 w-4 text-blue-600" />;
        case 'جيد': return <ThumbsUp className="h-4 w-4 text-cyan-600" />;
        case 'حسن': return <Smile className="h-4 w-4 text-yellow-600" />;
        case 'متوسط': return <AlertCircle className="h-4 w-4 text-amber-600" />;
        case 'لم يحفظ': return <XCircle className="h-4 w-4 text-red-600" />;
        case 'لا يوجد حصيلة': return <CalendarOff className="h-4 w-4 text-slate-400" />;
        case 'غائب':
        case 'غياب': return <UserMinus className="h-4 w-4 text-gray-400" />;
        default: return <Minus className="h-4 w-4 text-gray-300" />;
    }
};

const getEvaluationColor = (level: string | undefined) => {
    switch (level) {
        case 'ممتاز': return 'bg-green-50 text-green-700 border-green-200';
        case 'جيد جداً': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'جيد': return 'bg-cyan-50 text-cyan-700 border-cyan-200';
        case 'حسن': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        case 'متوسط': return 'bg-amber-50 text-amber-700 border-amber-200';
        case 'لم يحفظ': return 'bg-red-50 text-red-700 border-red-200';
        case 'لا يوجد حصيلة': return 'bg-slate-50 text-slate-400 border-slate-200';
        default: return 'bg-gray-50 text-gray-500 border-gray-200';
    }
};

export function WeeklyOutcomeModal({ isOpen, onClose, student, weekStartDate, currentOutcome }: WeeklyOutcomeModalProps) {
    const { dailySessions, saveWeeklyOutcome, addDailySession } = useStudentContext();
    const { user } = useAuth();
    
    // Generate days from Saturday to Wednesday (5 days)
    const weekDays = useMemo(() => {
        return Array.from({ length: 5 }).map((_, i) => addDays(weekStartDate, i));
    }, [weekStartDate]);

    // Fetch existing status for these days
    const dayStatuses = useMemo(() => {
        return weekDays.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            // Find session for this student on this day
            const sessionsOnDate = dailySessions[dateStr] ? Object.values(dailySessions[dateStr]) : [];
            const studentSession = sessionsOnDate.find(s => s.records?.some(r => r.studentId === student.id));
            const record = studentSession?.records?.find(r => r.studentId === student.id);

            return {
                date,
                dateStr,
                isRegistered: !!record,
                memorization: record?.memorization,
                session: studentSession,
                record: record,
                isCounterStopped: studentSession?.isCounterStopped || false,
                talqinSurahId: record?.talqinSurahId || studentSession?.talqinSurahId,
                talqinFromVerse: record?.talqinFromVerse || studentSession?.talqinFromVerse,
                talqinToVerse: record?.talqinToVerse || studentSession?.talqinToVerse,
                tasmieSurahId: record?.tasmieSurahId || studentSession?.tasmieSurahId,
                tasmieFromVerse: record?.tasmieFromVerse || studentSession?.tasmieFromVerse,
                tasmieToVerse: record?.tasmieToVerse || studentSession?.tasmieToVerse,
            };
        });
    }, [weekDays, dailySessions, student.id]);

    const [evaluation, setEvaluation] = useState<PerformanceLevel | 'clear'>(currentOutcome?.evaluation || '' as PerformanceLevel);
    const [isSaving, setIsSaving] = useState(false);
    const [dailyEvaluations, setDailyEvaluations] = useState<Record<string, PerformanceLevel | 'clear'>>({});
    const [savingDay, setSavingDay] = useState<string | null>(null);
    const scrollRef = React.useRef<HTMLDivElement>(null);

    const handleSave = async () => {
        if (!evaluation) return;
        setIsSaving(true);
        try {
            // 1. Save Weekly Outcome
            const outcomeId = `${student.id}_${format(weekStartDate, 'yyyy-MM-dd')}`;
            const finalEvaluation = evaluation === 'clear' ? '' : evaluation;
            const outcome: WeeklyOutcome = {
                id: outcomeId,
                studentId: student.id,
                weekStartDate: format(weekStartDate, 'yyyy-MM-dd'),
                evaluation: finalEvaluation as PerformanceLevel,
                timestamp: new Date().toISOString()
            };
            await saveWeeklyOutcome(outcome);

            // 2. Process Retroactive Updates
            // Use Promise.all for parallel updates
            const updatePromises = Object.entries(dailyEvaluations).map(async ([dateStr, newMemo]) => {
                if (!newMemo) return; // Skip if no change selected

                const dayStatus = dayStatuses.find(d => d.dateStr === dateStr);

                // If session exists, update it. If not, create it? 
                // Requirement: "Evaluate 3 wirds not memorized previously". 
                // Implies record exists but memorization might be 'لم يحفظ' or similar.
                // Or maybe record doesn't exist? "Attendance: Not registered".
                // User said: "attendance: separate box not containing attendance". 
                // But for retro-active, we need to update the daily record.
                // If record exists, update memorization.
                // If record does NOT exist, we probably shouldn't create a full attendance record unless we mark attendance as present?
                // Let's assume we update existing records or create new ones with "Attendance: Present" if missing?
                // "Evaluate the 3 awrad... goes to the specific day".

                let sessionToUpdate = dayStatus?.session;
                let recordToUpdate = dayStatus?.record;

                // Create session if missing (Wait, creating an entire session is complex. We'll only update if session exists).
                if (!sessionToUpdate) {
                    return;
                }

                if (sessionToUpdate && recordToUpdate) {
                    // Update existing record
                    const updatedRecords = sessionToUpdate.records.map((r: any) => {
                        if (r.studentId === student.id) {
                            return { ...r, memorization: newMemo };
                        }
                        return r;
                    });
                    await addDailySession({ ...sessionToUpdate, records: updatedRecords });
                } else if (sessionToUpdate && !recordToUpdate) {
                    // Session exists but student not in it (or wasn't registered). Add student as present.
                    const newRecord: DailyRecord = {
                        sessionId: sessionToUpdate.id,
                        studentId: student.id,
                        attendance: 'غائب',
                        review: false,
                        behavior: 'هادئ',
                        memorization: newMemo as PerformanceLevel,
                        talqinSurahId: sessionToUpdate.talqinSurahId,
                        talqinFromVerse: sessionToUpdate.talqinFromVerse,
                        talqinToVerse: sessionToUpdate.talqinToVerse,
                        tasmieSurahId: sessionToUpdate.tasmieSurahId,
                        tasmieFromVerse: sessionToUpdate.tasmieFromVerse,
                        tasmieToVerse: sessionToUpdate.tasmieToVerse,
                    };
                    const updatedRecords = [...(sessionToUpdate.records || []), newRecord];
                    await addDailySession({ ...sessionToUpdate, records: updatedRecords });
                }
            });

            await Promise.all(updatePromises);

            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveDay = async (dayStatus: any) => {
        let newMemo: PerformanceLevel | 'clear' | undefined = dailyEvaluations[dayStatus.dateStr];
        if (!newMemo) return;
        
        let finalMemo: PerformanceLevel | undefined;
        if (newMemo === 'clear') {
            finalMemo = undefined;
        } else {
            finalMemo = newMemo;
        }

        if (finalMemo === dayStatus.memorization) return;
        setSavingDay(dayStatus.dateStr);
        try {
            let sessionToUpdate = dayStatus.session;
            let recordToUpdate = dayStatus.record;

            if (!sessionToUpdate) return;

            if (sessionToUpdate && recordToUpdate) {
                const updatedRecords = sessionToUpdate.records.map((r: any) => {
                    if (r.studentId === student.id) {
                        return { ...r, memorization: finalMemo };
                    }
                    return r;
                });
                await addDailySession({ ...sessionToUpdate, records: updatedRecords });
            } else if (sessionToUpdate && !recordToUpdate) {
                const newRecord: DailyRecord = {
                    sessionId: sessionToUpdate.id,
                    studentId: student.id,
                    attendance: 'غائب',
                    review: false,
                    behavior: 'هادئ',
                    memorization: finalMemo || '' as PerformanceLevel,
                    talqinSurahId: sessionToUpdate.talqinSurahId,
                    talqinFromVerse: sessionToUpdate.talqinFromVerse,
                    talqinToVerse: sessionToUpdate.talqinToVerse,
                    tasmieSurahId: sessionToUpdate.tasmieSurahId,
                    tasmieFromVerse: sessionToUpdate.tasmieFromVerse,
                    tasmieToVerse: sessionToUpdate.tasmieToVerse,
                };
                const updatedRecords = [...(sessionToUpdate.records || []), newRecord];
                await addDailySession({ ...sessionToUpdate, records: updatedRecords });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSavingDay(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-[550px] p-0 max-h-[90vh] overflow-y-auto rounded-2xl">
                <DialogHeader className="p-4 sm:p-6 pb-2 sticky top-0 bg-background z-20 border-b">
                    <DialogTitle className="text-lg sm:text-xl flex items-center justify-between">
                        <span>الحصيلة الأسبوعية: {student.fullName}</span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">{student.groupName}</span>
                    </DialogTitle>
                    <DialogDescription className="text-right text-xs sm:text-sm mt-1 sm:mt-0">
                        تتبع الأوراد اليومية وتقييم الأداء للأسبوع الحالي ({format(weekDays[0], 'd/MM')} - {format(weekDays[4], 'd/MM')})
                    </DialogDescription>
                </DialogHeader>

                <div className="px-4 sm:px-6">
                    <div className="space-y-6 py-4">
                        {/* Retroactive Daily Evaluation */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-muted-foreground">تفقد الأوراد اليومية (تعديل بأثر رجعي)</Label>
                            <div className="grid gap-2">
                                {dayStatuses.map((day) => {
                                    const talqinSurah = surahs.find(s => s.id === day.talqinSurahId);
                                    const tasmieSurah = surahs.find(s => s.id === day.tasmieSurahId);

                                    return (
                                        <div key={day.dateStr} className="flex flex-col gap-3 p-3 sm:p-4 rounded-xl border bg-card shadow-sm transition-all hover:border-purple-200">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
                                                    <div className={cn(
                                                        "p-2 rounded-lg border flex items-center justify-center shrink-0",
                                                        getEvaluationColor(day.memorization || undefined)
                                                    )}>
                                                        {getEvaluationIcon(day.memorization || undefined)}
                                                    </div>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className="font-bold text-sm tracking-tight">{format(day.date, 'EEEE', { locale: ar })}</span>
                                                        <span className="text-[10px] text-muted-foreground truncate">
                                                            {day.memorization || 'غير مسجل'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {day.session ? (
                                                    <div className="flex flex-col gap-2 min-w-[140px]">
                                                        <Select dir="rtl" value={dailyEvaluations[day.dateStr] || normalizeLevel(day.memorization)} onValueChange={(val) => setDailyEvaluations(prev => ({ ...prev, [day.dateStr]: val as PerformanceLevel | 'clear' }))}>
                                                            <SelectTrigger className="h-9 text-xs font-bold border-2 border-purple-100 bg-purple-50/10 focus-ring-purple">
                                                                <SelectValue placeholder="اختر تقييم جديد..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="clear" className="text-xs font-bold text-red-600">إلغاء التقييم</SelectItem>
                                                                {EVALUATION_OPTIONS.map((opt) => (
                                                                    <SelectItem key={opt} value={opt} className="text-xs font-bold">
                                                                        <div className="flex items-center gap-2">
                                                                            {getEvaluationIcon(opt)}
                                                                            {opt}
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        {dailyEvaluations[day.dateStr] && dailyEvaluations[day.dateStr] !== day.memorization && (
                                                            <Button
                                                                size="sm"
                                                                className="h-7 text-[10px] w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                onClick={() => handleSaveDay(day)}
                                                                disabled={savingDay === day.dateStr}
                                                            >
                                                                {savingDay === day.dateStr ? <Loader2 className="h-3 w-3 animate-spin mx-auto" /> : "حفظ التعديل"}
                                                            </Button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground italic px-2">لا توجد حصة مسجلة</span>
                                                )}
                                            </div>

                                            {day.isCounterStopped ? (
                                                <div className="flex items-center gap-2 text-[10px] text-amber-700 font-bold bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 animate-pulse">
                                                    <AlertCircle className="h-3 w-3" />
                                                    العداد موقوف لهذا اليوم
                                                </div>
                                            ) : (talqinSurah || tasmieSurah) ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {talqinSurah && (
                                                        <div className="flex flex-col gap-1 bg-emerald-50/50 p-2 sm:px-3 rounded-lg border border-emerald-100">
                                                            <span className="text-[9px] text-emerald-700 font-extrabold flex items-center gap-1">
                                                                <div className="w-1 h-1 rounded-full bg-emerald-500" />
                                                                التلقين
                                                            </span>
                                                            <span className="text-[10.5px] truncate leading-tight font-medium text-emerald-900">
                                                                سورة {talqinSurah.name} ({day.talqinFromVerse}-{day.talqinToVerse})
                                                            </span>
                                                        </div>
                                                    )}
                                                    {tasmieSurah && (
                                                        <div className="flex flex-col gap-1 bg-blue-50/50 p-2 sm:px-3 rounded-lg border border-blue-100">
                                                            <span className="text-[9px] text-blue-700 font-extrabold flex items-center gap-1">
                                                                <div className="w-1 h-1 rounded-full bg-blue-500" />
                                                                التسميع
                                                            </span>
                                                            <span className="text-[10.5px] truncate leading-tight font-medium text-blue-900">
                                                                سورة {tasmieSurah.name} ({day.tasmieFromVerse}-{day.tasmieToVerse})
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-muted-foreground italic bg-muted/20 px-3 py-2 rounded-lg border border-dashed">
                                                    لم يتم تحديد ورد لهذا اليوم
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                            <Label className="flex items-center gap-2">
                                <Star className="h-4 w-4 text-purple-600" />
                                التقييم الأسبوعي العام (5 أوراد)
                            </Label>
                            <Select dir="rtl" value={evaluation} onValueChange={(val) => setEvaluation(val as PerformanceLevel)}>
                                <SelectTrigger className="w-full text-lg font-bold h-12">
                                    <SelectValue placeholder="لا يوجد تقييم" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="clear" className="font-bold text-red-600">إلغاء التقييم</SelectItem>
                                    {/* Special: no session this week */}
                                    <SelectItem value={NO_SESSION_VALUE} className="font-bold text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <CalendarOff className="h-4 w-4 text-slate-400" />
                                            لا يوجد حصيلة (أسبوع بدون حصص)
                                        </div>
                                    </SelectItem>
                                    {EVALUATION_OPTIONS.map(opt => (
                                        <SelectItem key={opt} value={opt} className="font-bold">{opt}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                    </div>
                </div>

                <DialogFooter className="p-4 sm:p-6 sm:pt-4 border-t bg-muted/5 flex flex-col sm:flex-row gap-2 sticky bottom-0 z-20">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>إلغاء</Button>
                    <Button onClick={handleSave} disabled={(!evaluation && (evaluation as string) !== 'clear') || isSaving} className="w-full sm:w-auto gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-lg">
                        {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                        <Save className="h-4 w-4" />
                        حفظ الحصيلة
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
