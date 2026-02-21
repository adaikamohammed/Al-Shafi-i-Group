"use client";

import React, { useMemo, useState } from 'react';
import { format, addDays, startOfDay, isToday as isTodayFn, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
    initialDate?: Date; // Optional: sync with external calendar date
}

const getSaturday = (date: Date): Date => {
    const d = startOfDay(new Date(date));
    const day = d.getDay();
    const diff = day === 6 ? 0 : -(day + 1);
    d.setDate(d.getDate() + diff);
    return d;
};

interface StudentDayInfo {
    attendance: string | null;
    memorization: string | null;
    behavior: string | null;
    review: boolean | null;
    notes: string;
    sessionType: string | null;
}

export const WeeklyAttendanceTable = ({
    students,
    getSessionsForDay,
    onDayClick,
    isAdmin5 = false,
    initialDate,
}: WeeklyAttendanceTableProps) => {

    const [weekStart, setWeekStart] = useState(() => getSaturday(initialDate || new Date()));

    // Sync weekStart when initialDate changes from parent (calendar navigation)
    React.useEffect(() => {
        if (initialDate) {
            setWeekStart(getSaturday(initialDate));
        }
    }, [initialDate?.toISOString().slice(0, 10)]);

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const date = addDays(weekStart, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayOfWeek = getDay(date);
            // Thursday (4) and Friday (5) are always holidays
            const isWeekend = dayOfWeek === 4 || dayOfWeek === 5;

            return {
                date,
                dateStr,
                dayName: format(date, 'EEEE', { locale: ar }),
                dayNameShort: format(date, 'EEE', { locale: ar }),
                dayNum: format(date, 'd'),
                monthNum: format(date, 'MM'),
                isToday: isTodayFn(date),
                isWeekend,
            };
        });
    }, [weekStart]);

    const weekSessionData = useMemo(() => {
        const data: Record<string, any> = {};
        weekDays.forEach(day => {
            const sessions = getSessionsForDay(day.dateStr);
            const primary = sessions.find((s: any) => s.sessionNumber === 1);
            data[day.dateStr] = primary || sessions[0] || null;
        });
        return data;
    }, [weekDays, getSessionsForDay]);

    const getColumnStyle = (day: typeof weekDays[0], session: any) => {
        if (day.isWeekend) return "bg-sky-50/70 border-sky-100"; // Weekend always blue-ish

        if (!session) return "";

        const type = session.sessionType;
        if (type === 'يوم عطلة') return "bg-sky-50/70 border-sky-100";
        if (type === 'حصة أنشطة') return "bg-purple-50/70 border-purple-100";
        if (type === 'غياب الشيخ') {
            return session.substituteTeacher
                ? "bg-orange-50/70 border-orange-100" // With sub
                : "bg-rose-50/70 border-rose-100";    // No sub
        }
        return "";
    };

    const getHeaderStyle = (day: typeof weekDays[0], session: any) => {
        if (day.isWeekend) return "bg-sky-100/80 text-sky-900";

        const type = session?.sessionType;
        if (type === 'يوم عطلة') return "bg-sky-100/80 text-sky-900";
        if (type === 'حصة أنشطة') return "bg-purple-100/80 text-purple-900";
        if (type === 'غياب الشيخ') {
            return session?.substituteTeacher
                ? "bg-orange-100/80 text-orange-900"
                : "bg-rose-100/80 text-rose-900";
        }
        return "group-hover:bg-muted/30";
    };

    const getStudentDayInfo = (studentId: string, dateStr: string): StudentDayInfo => {
        const session = weekSessionData[dateStr];
        if (!session?.records) {
            return { attendance: null, memorization: null, behavior: null, review: null, notes: '', sessionType: session?.sessionType || null };
        }
        const record = session.records.find((r: any) => r.studentId === studentId);
        return {
            attendance: record?.attendance || null,
            memorization: record?.memorization || null,
            behavior: record?.behavior || null,
            review: record?.review || null,
            notes: record?.notes || '',
            sessionType: session?.sessionType || null,
        };
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

    const getMemorizationBadge = (level: string | null) => {
        if (!level) return null;
        switch (level) {
            case 'ممتاز': return <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-emerald-200">ممتاز</span>;
            case 'جيد جدا': return <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-green-200">جيد جدا</span>;
            case 'جيد': return <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-blue-200">جيد</span>;
            case 'مقبول': return <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-orange-200">مقبول</span>;
            case 'ضعيف': return <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-red-200">ضعيف</span>;
            case 'لم يحفظ': return <span className="bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[9px] border border-gray-200">لم يحفظ</span>;
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

    const handleCellClick = (dateStr: string) => {
        const sessions = getSessionsForDay(dateStr);
        const sessionNum = sessions.length > 0 ? sessions[0].sessionNumber : 1;
        onDayClick(dateStr, sessionNum);
    };

    const navigateWeek = (direction: -1 | 1) => {
        setWeekStart(prev => addDays(prev, direction * 7));
    };

    const goToCurrentWeek = () => {
        setWeekStart(getSaturday(new Date()));
    };

    const sortedStudents = useMemo(() =>
        [...students].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
        [students]
    );

    const getStudentWeeklyStats = (studentId: string) => {
        let present = 0;
        let absent = 0;
        let late = 0;
        let excellent = 0;
        let warnings = 0;

        weekDays.forEach(day => {
            // Skip stats for weekends
            if (day.isWeekend) return;

            const info = getStudentDayInfo(studentId, day.dateStr);
            const session = weekSessionData[day.dateStr];

            // Skip stats for holidays/cancelled sessions
            const sessionType = session?.sessionType;
            if (sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ') return;

            if (info.attendance === 'حاضر' || info.attendance === 'تعويض') present++;
            if (info.attendance === 'متأخر') {
                present++; // Counting late as present for "Presence" count? Or separate? 
                // Usually Late is a form of presence. But we also count it separately.
                late++;
            }
            if (info.attendance === 'غائب' || info.attendance === 'غياب') absent++;

            if (info.memorization === 'ممتاز') excellent++;
            if (info.behavior === 'مشاغب' || info.behavior === 'غير منضبط') warnings++;
        });

        return { present, absent, late, excellent, warnings };
    };

    const isCurrentWeek = useMemo(() => {
        const currentSat = getSaturday(new Date());
        return weekStart.getTime() === currentSat.getTime();
    }, [weekStart]);

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
                                        const session = weekSessionData[day.dateStr];
                                        const colClass = getColumnStyle(day, session);

                                        let wirdText = "—";
                                        const sessionType = session?.sessionType;
                                        const isHolidayOrAbsence = day.isWeekend || sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ' || sessionType === 'حصة أنشطة';

                                        if (!isHolidayOrAbsence) {
                                            // Admin5 uses talqinSurahId/talqinFromVerse/talqinToVerse
                                            const talqinSurahId = session?.talqinSurahId;
                                            if (talqinSurahId) {
                                                const surah = surahs.find(s => s.id === talqinSurahId);
                                                wirdText = surah ? `${surah.name}` : "";
                                                if (session.talqinFromVerse && session.talqinToVerse) {
                                                    wirdText += ` (${session.talqinFromVerse}-${session.talqinToVerse})`;
                                                }
                                            } else if (session?.surahId && !session?.tasmieSurahId) {
                                                // Fallback to generic surahId if no specific talqin fields
                                                const surah = surahs.find(s => s.id === session.surahId);
                                                wirdText = surah ? `${surah.name}` : "";
                                                if (session.fromVerse && session.toVerse) {
                                                    wirdText += ` (${session.fromVerse}-${session.toVerse})`;
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
                                        const session = weekSessionData[day.dateStr];
                                        const colClass = getColumnStyle(day, session);

                                        let wirdText = "—";
                                        const sessionType2 = session?.sessionType;
                                        const isHolidayOrAbsence2 = day.isWeekend || sessionType2 === 'يوم عطلة' || sessionType2 === 'غياب الشيخ' || sessionType2 === 'حصة أنشطة';

                                        if (!isHolidayOrAbsence2) {
                                            const tasmieSurahId = session?.tasmieSurahId;
                                            if (tasmieSurahId) {
                                                const surah = surahs.find(s => s.id === tasmieSurahId);
                                                wirdText = surah ? `${surah.name}` : "";
                                                if (session.tasmieFromVerse && session.tasmieToVerse) {
                                                    wirdText += ` (${session.tasmieFromVerse}-${session.tasmieToVerse})`;
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
                                    const session = weekSessionData[day.dateStr];
                                    const sessionType = session?.sessionType;
                                    const colClass = getHeaderStyle(day, session);

                                    // Override holiday check for visualization
                                    const isHoliday = day.isWeekend || sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ';

                                    return (
                                        <th key={day.dateStr}
                                            onClick={() => handleCellClick(day.dateStr)}
                                            className={cn(
                                                "border-b border-l p-2 min-w-[85px] transition-colors cursor-pointer group",
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
                                                {(sessionType || day.isWeekend) && (
                                                    <span className={cn(
                                                        "text-[9px] px-1 rounded-sm mt-0.5 whitespace-nowrap",
                                                        isHoliday ? "bg-white/50 text-foreground/80 font-bold" : "bg-emerald-100 text-emerald-700"
                                                    )}>
                                                        {day.isWeekend ? 'عطلة' :
                                                            isHoliday ? (sessionType === 'يوم عطلة' ? 'عطلة' : sessionType) :
                                                                `حصة ${session?.sessionNumber || 1}`}
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
                                            const info = getStudentDayInfo(student.id, day.dateStr);
                                            const session = weekSessionData[day.dateStr];
                                            const colClass = getColumnStyle(day, session);

                                            // Determine visual state
                                            const isHoliday = day.isWeekend || session?.sessionType === 'يوم عطلة' || session?.sessionType === 'غياب الشيخ';
                                            const hasData = !!info.attendance;

                                            return (
                                                <td key={day.dateStr} className={cn(
                                                    "border-b border-l p-1 text-center align-top h-[70px]",
                                                    colClass,
                                                    !colClass && day.isToday && "bg-primary/[0.02]"
                                                )}>
                                                    {isHoliday ? (
                                                        <div className="h-full flex items-center justify-center text-muted-foreground/30 text-xl select-none">
                                                            ×
                                                        </div>
                                                    ) : (
                                                        <div
                                                            onClick={() => handleCellClick(day.dateStr)}
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
                                                                    {/* 1. Attendance Icon */}
                                                                    <div className="h-[22px] flex items-center justify-center">
                                                                        {getAttendanceIcon(info.attendance)}
                                                                    </div>

                                                                    {/* 2. Evaluation Badge */}
                                                                    <div className="h-[18px] flex items-center justify-center w-full px-1">
                                                                        {getMemorizationBadge(info.memorization)}
                                                                    </div>

                                                                    {/* 3. Behavior & Review */}
                                                                    <div className="flex items-center justify-center gap-2 h-[10px]">
                                                                        {getBehaviorDot(info.behavior)}
                                                                        {info.review && (
                                                                            <span className="text-[8px] text-blue-500" title="تمت المراجعة">📖</span>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
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
                </div>
            </div>
        </TooltipProvider>
    );
};
