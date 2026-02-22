"use client";

import React, { useMemo, useState } from 'react';
import { format, addDays, startOfDay, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCcw, BarChart2 } from 'lucide-react';

interface WeeklyStatsRowProps {
    students: Student[];
    getSessionsForDay: (dateString: string) => any[];
    initialDate?: Date;
}

const getSaturday = (date: Date): Date => {
    const d = startOfDay(new Date(date));
    const day = d.getDay();
    const diff = day === 6 ? 0 : -(day + 1);
    d.setDate(d.getDate() + diff);
    return d;
};

type StatKey = 'attendance' | 'excellent' | 'goodPlus' | 'good' | 'acceptable' | 'weak' | 'notMemorized';

interface DayStat {
    day: { date: Date; dateStr: string; dayNameShort: string; dayNum: string; isWeekend: boolean };
    sessionType: string | null;
    attendance: number | null;
    excellent: number | null;
    goodPlus: number | null;
    good: number | null;
    acceptable: number | null;
    weak: number | null;
    notMemorized: number | null;
}

const ROWS: { key: StatKey; label: string; bgClass: string; textClass: string; dotClass: string }[] = [
    { key: 'attendance', label: 'الحضور %', bgClass: 'bg-slate-100', textClass: 'text-slate-800', dotClass: 'bg-slate-500' },
    { key: 'excellent', label: 'ممتاز %', bgClass: 'bg-emerald-100', textClass: 'text-emerald-800', dotClass: 'bg-emerald-600' },
    { key: 'goodPlus', label: 'جيد جداً %', bgClass: 'bg-green-100', textClass: 'text-green-800', dotClass: 'bg-green-500' },
    { key: 'good', label: 'جيد %', bgClass: 'bg-blue-100', textClass: 'text-blue-800', dotClass: 'bg-blue-500' },
    { key: 'acceptable', label: 'مقبول %', bgClass: 'bg-orange-100', textClass: 'text-orange-800', dotClass: 'bg-orange-500' },
    { key: 'weak', label: 'ضعيف %', bgClass: 'bg-rose-100', textClass: 'text-rose-800', dotClass: 'bg-rose-500' },
    { key: 'notMemorized', label: 'لم يحفظ %', bgClass: 'bg-gray-100', textClass: 'text-gray-600', dotClass: 'bg-gray-400' },
];

const getAttBg = (val: number | null) => {
    if (val === null) return '';
    if (val >= 90) return 'bg-emerald-100 text-emerald-800';
    if (val >= 70) return 'bg-amber-100 text-amber-800';
    return 'bg-red-100 text-red-700';
};

export const WeeklyStatsRow = ({
    students,
    getSessionsForDay,
    initialDate,
}: WeeklyStatsRowProps) => {
    const [weekStart, setWeekStart] = useState(() => getSaturday(initialDate || new Date()));

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
            const isWeekend = dayOfWeek === 4 || dayOfWeek === 5;
            return {
                date,
                dateStr,
                dayName: format(date, 'EEEE', { locale: ar }),
                dayNameShort: format(date, 'EEE', { locale: ar }),
                dayNum: format(date, 'd'),
                isWeekend,
            };
        });
    }, [weekStart]);

    const dayStats = useMemo((): DayStat[] => {
        return weekDays.map(day => {
            const base: DayStat = { day, sessionType: null, attendance: null, excellent: null, goodPlus: null, good: null, acceptable: null, weak: null, notMemorized: null };

            const sessions = getSessionsForDay(day.dateStr);
            const session = sessions.find((s: any) => s.sessionNumber === 1) || sessions[0] || null;

            if (!session || day.isWeekend) return base;

            const sessionType = session.sessionType as string;
            if (sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ' || sessionType === 'حصة أنشطة') {
                return { ...base, sessionType };
            }

            const records: any[] = session.records || [];
            const totalStudents = students.length;
            if (totalStudents === 0) return base;

            let present = 0, excellent = 0, goodPlus = 0, good = 0, acceptable = 0, weak = 0, notMemorized = 0;

            students.forEach(student => {
                const rec = records.find(r => r.studentId === student.id);
                const att = rec?.attendance;
                const mem = rec?.memorization;

                if (att === 'حاضر' || att === 'متأخر' || att === 'تعويض') present++;

                if (mem === 'ممتاز') excellent++;
                else if (mem === 'جيد جداً' || mem === 'جيد جدا') goodPlus++;
                else if (mem === 'جيد') good++;
                else if (mem === 'مقبول' || mem === 'حسن') acceptable++;
                else if (mem === 'ضعيف' || mem === 'متوسط') weak++;
                else if (mem === 'لم يحفظ') notMemorized++;
            });

            const pct = (n: number) => Math.round((n / totalStudents) * 100);

            return {
                day,
                sessionType,
                attendance: pct(present),
                excellent: pct(excellent),
                goodPlus: pct(goodPlus),
                good: pct(good),
                acceptable: pct(acceptable),
                weak: pct(weak),
                notMemorized: pct(notMemorized),
            };
        });
    }, [weekDays, getSessionsForDay, students]);

    const weeklyAvg = useMemo(() => {
        const valid = dayStats.filter(d => d.attendance !== null);
        if (valid.length === 0) return { attendance: 0, excellent: 0, goodPlus: 0, good: 0, acceptable: 0, weak: 0, notMemorized: 0 };
        const avg = (key: StatKey) => Math.round(valid.reduce((s, d) => s + (d[key] ?? 0), 0) / valid.length);
        return {
            attendance: avg('attendance'),
            excellent: avg('excellent'),
            goodPlus: avg('goodPlus'),
            good: avg('good'),
            acceptable: avg('acceptable'),
            weak: avg('weak'),
            notMemorized: avg('notMemorized'),
        };
    }, [dayStats]);

    const isCurrentWeek = useMemo(() => {
        return weekStart.getTime() === getSaturday(new Date()).getTime();
    }, [weekStart]);

    const isHoliday = (s: DayStat) =>
        s.day.isWeekend || s.sessionType === 'يوم عطلة' || s.sessionType === 'غياب الشيخ' || s.sessionType === 'حصة أنشطة';

    return (
        <div className="bg-card rounded-2xl shadow-sm border overflow-hidden w-full" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between p-2 sm:p-3 border-b bg-gradient-to-l from-blue-50/70 to-white">
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(prev => addDays(prev, -7))} className="gap-1 px-2 h-8 text-xs font-bold">
                    <ChevronRight className="h-4 w-4" /> <span className="hidden sm:inline">السابق</span>
                </Button>
                <div className="flex flex-col items-center text-center">
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-blue-800">
                        <BarChart2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span>إحصائيات الأسبوع</span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground">
                        {format(weekStart, 'd MMM', { locale: ar })} — {format(addDays(weekStart, 6), 'd MMM', { locale: ar })}
                    </span>
                    {!isCurrentWeek && (
                        <Button variant="link" size="sm" onClick={() => setWeekStart(getSaturday(new Date()))} className="h-4 text-[10px] text-primary p-0 gap-1">
                            <RotateCcw className="h-3 w-3" /> الأسبوع الحالي
                        </Button>
                    )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setWeekStart(prev => addDays(prev, 7))} className="gap-1 px-2 h-8 text-xs font-bold">
                    <span className="hidden sm:inline">التالي</span> <ChevronLeft className="h-4 w-4" />
                </Button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[480px] text-xs sm:text-sm">
                    <thead>
                        <tr className="bg-muted/20">
                            <th className="sticky right-0 z-10 bg-muted/20 text-right p-1.5 sm:p-2 text-[10px] sm:text-xs font-bold text-muted-foreground border-b border-l min-w-[80px] sm:min-w-[100px]">
                                المؤشر
                            </th>
                            {weekDays.map(day => (
                                <th key={day.dateStr} className={cn(
                                    "border-b border-l p-1 sm:p-2 text-center text-[10px] sm:text-[11px] font-bold min-w-[45px]",
                                    day.isWeekend ? "text-sky-600 bg-sky-50/50" : "text-foreground"
                                )}>
                                    <div>{day.dayNameShort}</div>
                                    <div className="text-[9px] sm:text-[10px] font-normal text-muted-foreground">{day.dayNum}</div>
                                </th>
                            ))}
                            <th className="border-b border-l p-1 sm:p-2 text-center text-[10px] sm:text-[11px] font-bold text-purple-700 bg-purple-50/50 min-w-[55px]">
                                <span className="hidden sm:inline">متوسط الأسبوع</span>
                                <span className="sm:hidden">متوسط</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS.map(row => (
                            <tr key={row.key} className="hover:bg-muted/10 transition-colors">
                                <td className="sticky right-0 z-10 bg-white border-b border-l p-1.5 sm:p-2 font-bold text-right">
                                    <div className="flex items-center gap-1">
                                        <span className={cn("w-2 h-2 rounded-full inline-block shrink-0", row.dotClass)}></span>
                                        <span className="text-[10px] sm:text-[11px]">{row.label}</span>
                                    </div>
                                </td>
                                {dayStats.map(stat => (
                                    <td key={stat.day.dateStr} className={cn(
                                        "border-b border-l p-0.5 sm:p-1 text-center",
                                        isHoliday(stat) ? "bg-sky-50/30" : ""
                                    )}>
                                        {stat[row.key] !== null ? (
                                            <span className={cn(
                                                "inline-block px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold",
                                                row.key === 'attendance' ? getAttBg(stat.attendance) : `${row.bgClass} ${row.textClass}`
                                            )}>
                                                {stat[row.key]}%
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground opacity-30 text-[10px]">—</span>
                                        )}
                                    </td>
                                ))}
                                <td className="border-b border-l p-0.5 sm:p-1 text-center bg-purple-50/30">
                                    <span className={cn(
                                        "inline-block px-1 sm:px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-bold",
                                        row.key === 'attendance' ? getAttBg(weeklyAvg.attendance) : `${row.bgClass} ${row.textClass}`
                                    )}>
                                        {weeklyAvg[row.key]}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
