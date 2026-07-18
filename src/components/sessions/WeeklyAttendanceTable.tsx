"use client";

import React, { useMemo, useState } from 'react';
import { format, addDays, startOfDay, isToday as isTodayFn, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn, arabicCompare } from '@/lib/utils';
import { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCcw, Activity } from 'lucide-react';
import { TooltipProvider } from "@/components/ui/tooltip";
import { surahs } from '@/lib/surahs';

interface WeeklyAttendanceTableProps {
    students: Student[];
    getSessionsForDay: (dateString: string) => any[];
    onDayClick: (dateStr: string, sessionNumber: number) => void;
    isAdmin5?: boolean;
    initialDate?: Date;
}

const getSaturday = (date: Date): Date => {
    const d = startOfDay(new Date(date));
    const day = d.getDay();
    const diff = day === 6 ? 0 : -(day + 1);
    d.setDate(d.getDate() + diff);
    return d;
};

// بيانات يوم لطالب واحد (حصة واحدة أو حصتان)
interface StudentDayData {
    session1Record: { attendance: string | null; memorization: string | null; behavior: string | null; review: boolean | null; notes: string } | null;
    session2Record: { attendance: string | null; memorization: string | null; behavior: string | null; review: boolean | null; notes: string } | null;
    hasTwoSessions: boolean;
    session1Type: string | null;
    session2Type: string | null;
}

export const WeeklyAttendanceTable = ({
    students,
    getSessionsForDay,
    onDayClick,
    isAdmin5 = false,
    initialDate,
}: WeeklyAttendanceTableProps) => {

    const [weekStart, setWeekStart] = useState(() => getSaturday(initialDate || new Date()));

    React.useEffect(() => {
        if (initialDate) {
            setWeekStart(getSaturday(initialDate));
        }
    }, [initialDate?.toISOString().slice(0, 10)]);

    const weekDaysBase = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const date = addDays(weekStart, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayOfWeek = getDay(date);
            const isThurFri = dayOfWeek === 4 || dayOfWeek === 5;

            return {
                date,
                dateStr,
                dayName: format(date, 'EEEE', { locale: ar }),
                dayNameShort: format(date, 'EEE', { locale: ar }),
                dayNum: format(date, 'd'),
                monthNum: format(date, 'MM'),
                isToday: isTodayFn(date),
                isThurFri,
                isWeekend: false,
            };
        });
    }, [weekStart]);

    // كل يوم يحتوي الآن على session1 و session2 منفصلتين
    const weekSessionData = useMemo(() => {
        const data: Record<string, { session1: any | null; session2: any | null; hasTwoSessions: boolean }> = {};
        weekDaysBase.forEach(day => {
            const sessions = getSessionsForDay(day.dateStr);
            const getSessionNum = (s: any) => s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
            const session1 = sessions.find((s: any) => getSessionNum(s) === 1) || null;
            const session2 = sessions.find((s: any) => getSessionNum(s) === 2) || null;
            data[day.dateStr] = {
                session1,
                session2,
                hasTwoSessions: !!(session1 && session2),
            };
        });
        return data;
    }, [weekDaysBase, getSessionsForDay]);

    // تحديد عطلات نهاية الأسبوع
    const weekDays = useMemo(() => {
        return weekDaysBase.map(day => {
            if (!day.isThurFri) return { ...day, isWeekend: false };
            const { session1 } = weekSessionData[day.dateStr];
            const hasRealSession = session1 && session1.sessionType !== 'يوم عطلة';
            return { ...day, isWeekend: !hasRealSession };
        });
    }, [weekDaysBase, weekSessionData]);

    // بيانات الطالب في اليوم (تدعم حصتين)
    const getStudentDayData = (studentId: string, dateStr: string): StudentDayData => {
        const { session1, session2, hasTwoSessions } = weekSessionData[dateStr];

        const getRecord = (session: any | null) => {
            if (!session?.records) return null;
            const r = session.records.find((r: any) => r.studentId === studentId);
            if (!r) return null;
            return {
                attendance: r.attendance || null,
                memorization: r.memorization || null,
                behavior: r.behavior || null,
                review: r.review || null,
                notes: r.notes || '',
            };
        };

        return {
            session1Record: getRecord(session1),
            session2Record: getRecord(session2), // Always return session2 record if it exists
            hasTwoSessions,
            session1Type: session1?.sessionType || null,
            session2Type: session2?.sessionType || null,
        };
    };

    const getColumnStyle = (day: typeof weekDays[0]) => {
        const { session1 } = weekSessionData[day.dateStr];
        if (day.isWeekend) return "bg-sky-50/70 border-sky-100";
        if (!session1) return "";
        const type = session1.sessionType;
        if (type === 'يوم عطلة') return "bg-sky-50/70 border-sky-100";
        if (type === 'حصة أنشطة') return "bg-purple-50/70 border-purple-100";
        if (type === 'غياب الشيخ') {
            return session1.substituteTeacher
                ? "bg-orange-50/70 border-orange-100"
                : "bg-rose-50/70 border-rose-100";
        }
        return "";
    };

    const getHeaderStyle = (day: typeof weekDays[0]) => {
        const { session1 } = weekSessionData[day.dateStr];
        if (day.isWeekend) return "bg-sky-100/80 text-sky-900";
        const type = session1?.sessionType;
        if (type === 'يوم عطلة') return "bg-sky-100/80 text-sky-900";
        if (type === 'حصة أنشطة') return "bg-purple-100/80 text-purple-900";
        if (type === 'غياب الشيخ') {
            return session1?.substituteTeacher
                ? "bg-orange-100/80 text-orange-900"
                : "bg-rose-100/80 text-rose-900";
        }
        return "group-hover:bg-muted/30";
    };

    const getAttendanceIcon = (status: string | null) => {
        switch (status) {
            case 'حاضر': return <span className="text-emerald-600 font-bold text-lg">✅</span>;
            case 'متأخر': return <span className="text-amber-600 font-bold text-lg">⏰</span>;
            case 'غائب':
            case 'غياب': return <span className="text-red-500 font-bold text-lg">❌</span>;
            case 'تعويض': return <span className="text-blue-500 font-bold text-lg">🔄</span>;
            default: return null;
        }
    };

    // أيقونة مصغّرة للعرض في الخلية المقسومة
    const getAttendanceMiniIcon = (status: string | null) => {
        switch (status) {
            case 'حاضر': return <span className="text-emerald-600 font-bold text-base leading-none">✅</span>;
            case 'متأخر': return <span className="text-amber-600 font-bold text-base leading-none">⏰</span>;
            case 'غائب':
            case 'غياب': return <span className="text-red-500 font-bold text-base leading-none">❌</span>;
            case 'تعويض': return <span className="text-blue-500 font-bold text-base leading-none">🔄</span>;
            default: return <span className="text-gray-300 text-xs leading-none">—</span>;
        }
    };

    const getMemorizationBadge = (level: string | null) => {
        if (!level) return null;
        switch (level) {
            case 'ممتاز': return <span className="bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border border-emerald-200">ممتاز</span>;
            case 'جيد جدا': return (
                <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border border-green-200 block truncate max-w-full">
                    <span className="hidden sm:inline">جيد جداً</span>
                    <span className="sm:hidden">ج.جداً</span>
                </span>
            );
            case 'جيد': return <span className="bg-blue-100 text-blue-700 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border border-blue-200">جيد</span>;
            case 'مقبول': return <span className="bg-orange-100 text-orange-700 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border border-orange-200">مقبول</span>;
            case 'ضعيف': return <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border border-red-200">ضعيف</span>;
            case 'لم يحفظ': return (
                <span className="bg-gray-100 text-gray-500 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-bold border border-gray-200 block truncate max-w-full">
                    لم يحفظ
                </span>
            );
            default: return null;
        }
    };

    const getBehaviorDot = (behavior: string | null) => {
        if (!behavior) return null;
        switch (behavior) {
            case 'هادئ': return <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block shadow-sm" title="هادئ"></span>;
            case 'مقبول': return <span className="w-2.5 h-2.5 rounded-full bg-amber-400 block shadow-sm" title="مقبول"></span>;
            case 'مشاغب': return <span className="w-2.5 h-2.5 rounded-full bg-red-500 block shadow-sm" title="مشاغب"></span>;
            default: return null;
        }
    };

    const navigateWeek = (direction: -1 | 1) => {
        setWeekStart(prev => addDays(prev, direction * 7));
    };

    const goToCurrentWeek = () => {
        setWeekStart(getSaturday(new Date()));
    };

    const sortedStudents = useMemo(() =>
        [...students].sort((a, b) => arabicCompare(a.fullName, b.fullName)),
        [students]
    );

    // إحصاءات الطالب الأسبوعية — تأخذ كلتا الحصتين في الاعتبار
    const getStudentWeeklyStats = (studentId: string) => {
        let present = 0;
        let absent = 0;
        let late = 0;
        let excellent = 0;
        let warnings = 0;

        weekDays.forEach(day => {
            if (day.isWeekend) return;

            const { session1, session2, hasTwoSessions } = weekSessionData[day.dateStr];

            const sessionType1 = session1?.sessionType;
            if (sessionType1 === 'يوم عطلة' || sessionType1 === 'غياب الشيخ') return;

            // معالجة كل حصة بشكل مستقل
            const processRecord = (session: any | null) => {
                if (!session?.records) return;
                const r = session.records.find((rec: any) => rec.studentId === studentId);
                if (!r) return;

                const att = r.attendance;
                if (att === 'حاضر' || att === 'تعويض') present++;
                if (att === 'متأخر') { present++; late++; }
                if (att === 'غائب' || att === 'غياب') absent++;

                if (r.memorization === 'ممتاز') excellent++;
                const isAbsent = att === 'غائب' || att === 'غياب';
                if (!isAbsent && (r.behavior === 'مشاغب' || r.behavior === 'غير منضبط')) warnings++;
            };

            processRecord(session1);
            if (hasTwoSessions) processRecord(session2);
        });

        return { present, absent, late, excellent, warnings };
    };

    const isCurrentWeek = useMemo(() => {
        const currentSat = getSaturday(new Date());
        return weekStart.getTime() === currentSat.getTime();
    }, [weekStart]);

    // عرض خلية حصة واحدة
    const renderSingleSessionCell = (record: StudentDayData['session1Record'], sessionType: string | null, dateStr: string, sessionNum: 1 | 2) => {
        const hasData = !!record?.attendance;
        const isAbsent = record?.attendance === 'غائب' || record?.attendance === 'غياب';

        return (
            <div
                onClick={() => onDayClick(dateStr, sessionNum)}
                className={cn(
                    "h-full w-full rounded-md border flex flex-col items-center justify-between py-1 transition-all cursor-pointer hover:shadow-sm active:scale-[0.98]",
                    hasData ? "bg-white border-border shadow-sm" : "bg-white/50 border-dashed border-gray-300/50 hover:bg-white/80"
                )}
                title="اضغط للتعديل"
            >
                {!hasData ? (
                    <span className="text-[9px] text-muted-foreground mt-4 opacity-50">تسجيل</span>
                ) : (
                    <>
                        <div className="h-[22px] flex items-center justify-center">
                            {getAttendanceIcon(record?.attendance ?? null)}
                        </div>
                        <div className="h-[18px] flex items-center justify-center w-full px-1">
                            {getMemorizationBadge(record?.memorization ?? null)}
                        </div>
                        <div className="flex items-center justify-center gap-2 h-[10px]">
                            {!isAbsent && (
                                <>
                                    {getBehaviorDot(record?.behavior ?? null)}
                                    {record?.review && (
                                        <span className="text-[8px] text-blue-500" title="تمت المراجعة">📖</span>
                                    )}
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        );
    };

    // عرض خلية حصتين (مقسومة: صباح فوق / مساء تحت)
    const renderDualSessionCell = (data: StudentDayData, dateStr: string) => {
        const { session1Record, session2Record } = data;

        const renderHalf = (record: typeof session1Record, label: string, labelClass: string, bgClass: string, sessionNum: 1 | 2) => {
            const hasData = !!record?.attendance;
            const isAbsent = record?.attendance === 'غائب' || record?.attendance === 'غياب';
            return (
                <div
                    onClick={() => onDayClick(dateStr, sessionNum)}
                    className={cn(
                        "flex-1 flex items-center gap-1 px-1 rounded cursor-pointer transition-all hover:opacity-80 border",
                        hasData ? `${bgClass} border-opacity-30` : "bg-white/40 border-dashed border-gray-200"
                    )}
                    title={`حصة ${sessionNum === 1 ? 'أساسية' : 'إضافية'} — اضغط للتعديل`}
                >
                    <span className={cn("text-[8px] font-bold shrink-0 leading-none", labelClass)}>{label}</span>
                    <div className="flex items-center gap-0.5 flex-1 justify-center">
                        {hasData ? (
                            <>
                                {getAttendanceMiniIcon(record?.attendance ?? null)}
                                {!isAbsent && record?.memorization && (
                                    <span className="text-[7px] text-gray-500 hidden sm:block truncate max-w-[28px]">
                                        {record.memorization}
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="text-[8px] text-gray-300">—</span>
                        )}
                    </div>
                    {!isAbsent && hasData && (
                        <div className="flex items-center gap-0.5">
                            {getBehaviorDot(record?.behavior ?? null)}
                            {record?.review && <span className="text-[7px] text-blue-400">📖</span>}
                        </div>
                    )}
                </div>
            );
        };

        return (
            <div className="h-full w-full flex flex-col gap-0.5">
                {renderHalf(session1Record, 'ص', 'text-emerald-700', 'bg-emerald-50 border-emerald-200', 1)}
                {renderHalf(session2Record, 'م', 'text-indigo-600', 'bg-indigo-50 border-indigo-200', 2)}
            </div>
        );
    };

    return (
        <TooltipProvider>
            <div className="bg-card rounded-2xl shadow-sm border overflow-hidden w-full" dir="rtl">

                {/* Header Navigation */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b bg-gradient-to-l from-emerald-50/80 to-white">
                    <Button variant="ghost" size="sm" onClick={() => navigateWeek(-1)} className="gap-1 px-2 h-8 text-xs font-bold">
                        <ChevronRight className="h-4 w-4" /> الأسبوع السابق
                    </Button>

                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold text-primary">
                            {format(weekStart, 'd MMMM', { locale: ar })} — {format(addDays(weekStart, 6), 'd MMMM', { locale: ar })}
                        </span>
                        {!isCurrentWeek && (
                            <Button variant="link" size="sm" onClick={goToCurrentWeek} className="h-5 text-[10px] text-primary p-0 gap-1">
                                <RotateCcw className="h-3 w-3" /> الأسبوع الحالي
                            </Button>
                        )}
                    </div>

                    <Button variant="ghost" size="sm" onClick={() => navigateWeek(1)} className="gap-1 px-2 h-8 text-xs font-bold">
                        الأسبوع التالي <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>

                {/* Table container with horizontal scroll */}
                <div className="overflow-x-auto w-full">
                    <table className="w-full border-collapse min-w-[700px]">
                        <thead>
                            {/* Admin5 Talqin Wird Row */}
                            {isAdmin5 && (
                                <tr className="bg-emerald-50/80 border-b border-emerald-100">
                                    <th className="sticky right-0 z-20 bg-emerald-50 border-b border-l text-right p-2 text-[10px] font-bold text-emerald-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                                        📗 ورد التلقين
                                    </th>
                                    <th className="border-b border-l bg-emerald-50/50"></th>
                                    {weekDays.map(day => {
                                        const { session1 } = weekSessionData[day.dateStr];
                                        const colClass = getColumnStyle(day);

                                        let wirdText = "—";
                                        const sessionType = session1?.sessionType;
                                        const isHolidayOrAbsence = day.isWeekend || sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ' || sessionType === 'حصة أنشطة';

                                        if (!isHolidayOrAbsence) {
                                            const talqinSurahId = session1?.talqinSurahId;
                                            if (talqinSurahId) {
                                                const surah = surahs.find(s => s.id === talqinSurahId);
                                                wirdText = surah ? `${surah.name}` : "";
                                                if (session1.talqinFromVerse && session1.talqinToVerse) {
                                                    wirdText += ` (${session1.talqinFromVerse}-${session1.talqinToVerse})`;
                                                }
                                            } else if (session1?.surahId && !session1?.tasmieSurahId) {
                                                const surah = surahs.find(s => s.id === session1.surahId);
                                                wirdText = surah ? `${surah.name}` : "";
                                                if (session1.fromVerse && session1.toVerse) {
                                                    wirdText += ` (${session1.fromVerse}-${session1.toVerse})`;
                                                }
                                            }
                                        }
                                        return (
                                            <th key={`talqin-${day.dateStr}`} className={cn(
                                                "border-b border-l p-1 text-[10px] font-normal text-emerald-900 text-center h-8",
                                                colClass ? colClass : "bg-emerald-50/20"
                                            )}>
                                                {wirdText !== "—" ? (
                                                    <span className="inline-block bg-emerald-100 text-emerald-800 rounded px-1 leading-tight">
                                                        {wirdText}
                                                    </span>
                                                ) : <span className="opacity-30">—</span>}
                                            </th>
                                        );
                                    })}
                                </tr>
                            )}

                            {/* Admin5 Tasmie Wird Row */}
                            {isAdmin5 && (
                                <tr className="bg-purple-50/80 border-b border-purple-100">
                                    <th className="sticky right-0 z-20 bg-purple-50 border-b border-l text-right p-2 text-[10px] font-bold text-purple-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">
                                        📘 ورد التسميع
                                    </th>
                                    <th className="border-b border-l bg-purple-50/50"></th>
                                    {weekDays.map(day => {
                                        const { session1 } = weekSessionData[day.dateStr];
                                        const colClass = getColumnStyle(day);

                                        let wirdText = "—";
                                        const sessionType2 = session1?.sessionType;
                                        const isHolidayOrAbsence2 = day.isWeekend || sessionType2 === 'يوم عطلة' || sessionType2 === 'غياب الشيخ' || sessionType2 === 'حصة أنشطة';

                                        if (!isHolidayOrAbsence2) {
                                            const tasmieSurahId = session1?.tasmieSurahId;
                                            if (tasmieSurahId) {
                                                const surah = surahs.find(s => s.id === tasmieSurahId);
                                                wirdText = surah ? `${surah.name}` : "";
                                                if (session1.tasmieFromVerse && session1.tasmieToVerse) {
                                                    wirdText += ` (${session1.tasmieFromVerse}-${session1.tasmieToVerse})`;
                                                }
                                            }
                                        }
                                        return (
                                            <th key={`tasmie-${day.dateStr}`} className={cn(
                                                "border-b border-l p-1 text-[10px] font-normal text-purple-900 text-center h-8",
                                                colClass ? colClass : "bg-purple-50/20"
                                            )}>
                                                {wirdText !== "—" ? (
                                                    <span className="inline-block bg-purple-100 text-purple-800 rounded px-1 leading-tight">
                                                        {wirdText}
                                                    </span>
                                                ) : <span className="opacity-30">—</span>}
                                            </th>
                                        );
                                    })}
                                </tr>
                            )}

                            <tr className="bg-muted/5">
                                {/* Sticky Student Name Column */}
                                <th className="sticky right-0 z-20 bg-white border-b border-l text-right p-2 sm:p-3 w-[130px] sm:w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                        <Activity className="h-3 w-3" />
                                        الطالب ({sortedStudents.length})
                                    </span>
                                </th>

                                {/* Weekly Stats Header */}
                                <th className="border-b border-l p-2 w-[70px] sm:w-[80px] bg-emerald-50/30">
                                    <span className="text-[10px] font-bold text-emerald-700 block text-center">الإحصاءات</span>
                                </th>

                                {/* Days Headers */}
                                {weekDays.map(day => {
                                    const { session1, session2, hasTwoSessions } = weekSessionData[day.dateStr];
                                    const activeSession = session1 || session2;
                                    const sessionType = activeSession?.sessionType;
                                    const colClass = getHeaderStyle(day);
                                    const isHoliday = day.isWeekend || sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ';
                                    
                                    const getSessionNum = (s: any) => s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                                    const activeSessionNum = activeSession ? getSessionNum(activeSession) : 1;

                                    return (
                                        <th key={day.dateStr}
                                            className={cn(
                                                "border-b border-l p-2 min-w-[85px] transition-colors group",
                                                colClass,
                                                day.isToday && !colClass.includes('bg-') && "bg-primary/5 shadow-inner"
                                            )}>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={cn("text-xs font-bold", day.isToday && "text-primary")}>
                                                    {day.dayNameShort}
                                                </span>
                                                <span className="text-[10px] opacity-70 font-mono">
                                                    {day.dayNum}
                                                </span>
                                                {/* بادج نوع الحصة */}
                                                {(sessionType || day.isWeekend) && (
                                                    <span className={cn(
                                                        "text-[9px] px-1 rounded-sm mt-0.5 whitespace-nowrap",
                                                        isHoliday ? "bg-white/50 text-foreground/80 font-bold" : "bg-emerald-100 text-emerald-700"
                                                    )}>
                                                        {day.isWeekend ? 'عطلة' :
                                                            isHoliday ? (
                                                                sessionType === 'يوم عطلة' ? 'عطلة' :
                                                                sessionType === 'غياب الشيخ' ? 'غياب' :
                                                                sessionType === 'حصة أنشطة' ? 'أنشطة' :
                                                                sessionType
                                                            ) :
                                                                hasTwoSessions ? 'ص + م' : `حصة ${activeSessionNum}`}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>

                        <tbody>
                            {sortedStudents.map((student, idx) => {
                                const stats = getStudentWeeklyStats(student.id);
                                return (
                                    <tr key={student.id} className={cn("group transition-colors", idx % 2 === 0 ? "bg-white" : "bg-gray-50/30 hover:bg-muted/5")}>
                                        {/* Sticky Student Name Cell */}
                                        <td className={cn(
                                            "sticky right-0 z-10 border-l text-right p-2 sm:p-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/30 group-hover:bg-gray-50",
                                        )}>
                                            <span className="text-xs font-bold text-gray-800 line-clamp-1">
                                                {student.fullName}
                                            </span>
                                        </td>

                                        {/* Weekly Stats Cell */}
                                        <td className="border-b border-l p-1 sm:p-2 align-middle bg-emerald-50/10 active:bg-emerald-50/30">
                                            <div className="flex flex-col gap-1 items-center justify-center h-full text-[9px]">
                                                <div className="flex items-center gap-1 w-full justify-between px-1" title="أيام الحضور (شامل التأخر)">
                                                    <span>✅</span>
                                                    <span className="font-bold">{stats.present}</span>
                                                </div>
                                                {stats.absent > 0 && (
                                                    <div className="flex items-center gap-1 w-full justify-between px-1" title="أيام الغياب">
                                                        <span>❌</span>
                                                        <span className="font-bold text-red-600">{stats.absent}</span>
                                                    </div>
                                                )}
                                                {stats.late > 0 && (
                                                    <div className="flex items-center gap-1 w-full justify-between px-1" title="مرات التأخر">
                                                        <span>⏰</span>
                                                        <span className="font-bold text-amber-600">{stats.late}</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-1 w-full justify-between px-1" title="مرات التميز">
                                                    <span>🌟</span>
                                                    <span className="font-bold text-amber-600">{stats.excellent}</span>
                                                </div>
                                                {stats.warnings > 0 && (
                                                    <div className="flex items-center gap-1 w-full justify-between px-1" title="مخالفات">
                                                        <span>⚠️</span>
                                                        <span className="font-bold text-red-600">{stats.warnings}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </td>

                                        {/* Day Cells */}
                                        {weekDays.map(day => {
                                            const { session1, session2, hasTwoSessions } = weekSessionData[day.dateStr];
                                            const activeSession = session1 || session2;
                                            const getSessionNum = (s: any) => s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
                                            const activeSessionNum = activeSession ? getSessionNum(activeSession) : 1;
                                            const colClass = getColumnStyle(day);
                                            const isHoliday = day.isWeekend || activeSession?.sessionType === 'يوم عطلة' || activeSession?.sessionType === 'غياب الشيخ';

                                            const dayData = getStudentDayData(student.id, day.dateStr);

                                            return (
                                                <td key={day.dateStr} className={cn(
                                                    "border-b border-l p-1 text-center align-top",
                                                    // عندما يكون هناك حصتان نجعل الخلية أطول قليلاً
                                                    hasTwoSessions ? "h-[90px]" : "h-[70px]",
                                                    colClass,
                                                    !colClass && day.isToday && "bg-primary/[0.02]"
                                                )}>
                                                    {isHoliday ? (
                                                        <div className="h-full flex items-center justify-center text-muted-foreground/30 text-xl select-none">
                                                            ×
                                                        </div>
                                                    ) : hasTwoSessions ? (
                                                        // خلية مقسومة: صباح فوق + مساء تحت
                                                        renderDualSessionCell(dayData, day.dateStr)
                                                    ) : (
                                                        // خلية عادية: حصة واحدة
                                                        renderSingleSessionCell(dayData.session1Record, dayData.session1Type, day.dateStr, 1)
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Legend */}
                <div className="bg-muted/10 border-t p-2 text-[10px] sm:text-[11px] flex flex-wrap gap-x-4 gap-y-2 justify-center text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="text-emerald-600 font-bold">✅</span> حاضر</span>
                    <span className="flex items-center gap-1"><span className="text-red-500 font-bold">❌</span> غائب</span>
                    <span className="flex items-center gap-1"><span className="text-amber-600 font-bold">⏰</span> متأخر</span>
                    <span className="flex items-center gap-1"><span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[9px]">ممتاز</span> حفظ ممتاز</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 block"></span> سلوك هادئ</span>
                    <span className="flex items-center gap-1">
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1">ص</span>
                        <span className="text-muted-foreground/50">+</span>
                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1">م</span>
                        يوم بحصتين
                    </span>
                </div>
            </div>
        </TooltipProvider>
    );
};
