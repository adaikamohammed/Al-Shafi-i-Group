"use client";

import React, { useMemo, useState } from 'react';
import { format, addDays, startOfDay, isToday as isTodayFn } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCcw, ExternalLink, Activity } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface WeeklyAttendanceTableProps {
    students: Student[];
    getSessionsForDay: (dateString: string) => any[];
    onDayClick: (dateStr: string, sessionNumber: number) => void;
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
}: WeeklyAttendanceTableProps) => {

    const [weekStart, setWeekStart] = useState(() => getSaturday(new Date()));

    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const date = addDays(weekStart, i);
            const dateStr = format(date, 'yyyy-MM-dd');
            return {
                date,
                dateStr,
                dayName: format(date, 'EEEE', { locale: ar }),
                dayNameShort: format(date, 'EEE', { locale: ar }),
                dayNum: format(date, 'd'),
                monthNum: format(date, 'MM'),
                isToday: isTodayFn(date),
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
            case 'غائب': return <span className="text-red-500 font-bold text-lg">❌</span>;
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
        let excellent = 0;
        let warnings = 0;

        weekDays.forEach(day => {
            const info = getStudentDayInfo(studentId, day.dateStr);
            if (info.attendance === 'حاضر' || info.attendance === 'متأخر' || info.attendance === 'تعويض') present++;
            if (info.memorization === 'ممتاز') excellent++;
            if (info.behavior === 'مشاغب' || info.behavior === 'غير منضبط') warnings++;
        });

        return { present, excellent, warnings };
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
                    <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-muted/5">
                                {/* Sticky Student Name Column */}
                                <th className="sticky right-0 z-20 bg-white border-b border-l text-right p-3 w-[140px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                                        <Activity className="h-3 w-3" />
                                        الطالب ({sortedStudents.length})
                                    </span>
                                </th>

                                {/* Weekly Stats Header */}
                                <th className="border-b border-l p-2 w-[80px] bg-emerald-50/30">
                                    <span className="text-[10px] font-bold text-emerald-700 block text-center">الإحصاءات</span>
                                </th>

                                {/* Days Headers */}
                                {weekDays.map(day => {
                                    const session = weekSessionData[day.dateStr];
                                    const sessionType = session?.sessionType;
                                    const isHoliday = sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ';

                                    return (
                                        <th key={day.dateStr}
                                            onClick={() => handleCellClick(day.dateStr)}
                                            className={cn(
                                                "border-b border-l p-2 min-w-[90px] transition-colors cursor-pointer hover:bg-muted/30 group",
                                                day.isToday && "bg-primary/5 shadow-inner"
                                            )}>
                                            <div className="flex flex-col items-center gap-1">
                                                <span className={cn("text-xs font-bold", day.isToday && "text-primary")}>
                                                    {day.dayNameShort}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground font-mono bg-white/50 px-1.5 rounded border border-transparent group-hover:border-border transition-colors">
                                                    {day.dayNum}
                                                </span>
                                                {sessionType && (
                                                    <span className={cn(
                                                        "text-[9px] px-1 rounded-sm mt-0.5",
                                                        isHoliday ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"
                                                    )}>
                                                        {isHoliday ? 'عطلة' : `حصة ${session.sessionNumber}`}
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
                                            "sticky right-0 z-10 border-l text-right p-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]",
                                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/30 group-hover:bg-gray-50",
                                        )}>
                                            <span className="text-xs font-bold text-gray-800 line-clamp-1">
                                                {student.fullName}
                                            </span>
                                        </td>

                                        {/* Weekly Stats Cell */}
                                        <td className="border-b border-l p-1 sm:p-2 align-middle bg-emerald-50/10 active:bg-emerald-50/30">
                                            <div className="flex flex-col gap-1 items-center justify-center h-full text-[9px]">
                                                <div className="flex items-center gap-1 w-full justify-between px-1" title="أيام الحضور">
                                                    <span>✅</span>
                                                    <span className="font-bold">{stats.present}</span>
                                                </div>
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
                                            const isHoliday = info.sessionType === 'يوم عطلة' || info.sessionType === 'غياب الشيخ';
                                            const hasData = !!info.attendance;

                                            return (
                                                <td key={day.dateStr} className={cn(
                                                    "border-b border-l p-1 text-center align-top h-[70px]",
                                                    day.isToday && "bg-primary/[0.02]"
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
                                                                hasData ? "bg-white border-border" : "bg-muted/5 border-dashed border-gray-200 hover:bg-muted/10"
                                                            )}
                                                            title="اضغط للتعديل"
                                                        >
                                                            {!hasData ? (
                                                                <span className="text-[9px] text-muted-foreground mt-4">تسجيل</span>
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
                    <span className="flex items-center gap-1"><span className="bg-emerald-100 text-emerald-700 px-1 rounded text-[9px]">ممتاز</span> حفظ ممتاز</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 block"></span> سلوك هادئ</span>
                    <span className="flex items-center gap-1"><span className="text-blue-500">📖</span> تمت المراجعة</span>
                </div>
            </div>
        </TooltipProvider>
    );
};
