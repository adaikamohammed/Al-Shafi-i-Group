"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, AlertTriangle, ArrowLeft, ArrowRight, Zap } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
    format,
    startOfWeek,
    endOfWeek,
    subWeeks,
    addDays,
    eachMonthOfInterval,
    startOfMonth,
    endOfMonth,
    getYear,
    subYears,
    startOfYear,
    endOfYear,
    eachQuarterOfInterval,
    endOfQuarter,
    addYears,
    parseISO
} from 'date-fns';
import { ar } from 'date-fns/locale';
import type { DailySession, Student } from '@/lib/types';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const calculatePeriodStats = (
    startDate: Date,
    endDate: Date,
    activeStudents: Student[],
    sessions: Record<string, Record<string, DailySession>>
) => {
    if (activeStudents.length === 0) {
        return { attendance: 0, behavior: 0, review: 0, memorization: 0, commitment: 0 };
    }

    const periodSessions = Object.values(sessions)
        .flatMap(day => Object.values(day))
        .filter(s => {
            if (!s.date) return false;
            try {
                const d = parseISO(s.date);
                return d >= startDate && d <= endDate;
            } catch { return false; }
        });

    const workSessions = periodSessions.filter(s => s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة تعويضية' || s.sessionType === 'حصة إضافية');

    let totalAttendance = 0;
    let totalPossibleAttendance = 0;

    let behaviorSum = 0;
    let behaviorCount = 0;

    let reviewSum = 0;
    let reviewCount = 0;

    let memorizationSum = 0;
    let memorizationCount = 0;

    const memorizationScoreMap: { [key: string]: number } = { 'ممتاز': 10, 'جيد جداً': 7, 'جيد جدا': 7, 'جيد': 5, 'حسن': 3, 'مقبول': 2, 'متوسط': 2, 'ضعيف': 1, 'لم يحفظ': 0, 'لا يوجد': 0 };
    // النظام الجديد: هادئ=10، مقبول=5، مشاغب=0 | القيم القديمة مُضمَّنة للتوافق مع البيانات السابقة
    const behaviorScoreMap: { [key: string]: number } = { 'هادئ': 10, 'مقبول': 5, 'متوسط': 5, 'مشاغب': 0, 'غير منضبط': 0 };

    workSessions.forEach(session => {
        const sessionDate = parseISO(session.date);
        activeStudents.forEach(student => {
            const regDate = student.registrationDate
                ? (student.registrationDate instanceof Date
                    ? student.registrationDate
                    : new Date(student.registrationDate as any))
                : null;

            if (regDate) {
                const regDateNoon = new Date(regDate);
                regDateNoon.setHours(0, 0, 0, 0);
                const sessionDateNoon = new Date(sessionDate);
                sessionDateNoon.setHours(0, 0, 0, 0);

                if (sessionDateNoon >= regDateNoon) {
                    totalPossibleAttendance++;
                    const record = session.records?.find(r => r.studentId === student.id);
                    if (record) {
                        if (record.attendance === 'حاضر' || record.attendance === 'متأخر') {
                            totalAttendance++;
                        }

                        if (record.behavior && record.behavior in behaviorScoreMap) {
                            behaviorSum += behaviorScoreMap[record.behavior];
                            behaviorCount++;
                        }

                        if (session.sessionType === 'حصة أساسية' || session.sessionType === 'حصة إضافية') {
                            reviewCount++;
                            if (record.review) {
                                reviewSum++;
                            }
                        }

                        if (record.memorization && record.memorization in memorizationScoreMap) {
                            memorizationSum += memorizationScoreMap[record.memorization];
                            memorizationCount++;
                        }
                    }
                }
            }
        });
    });

    const attendanceScore = totalPossibleAttendance > 0 ? (totalAttendance / totalPossibleAttendance) * 100 : 0;
    const behaviorScore = behaviorCount > 0 ? (behaviorSum / behaviorCount) * 10 : 0;
    const reviewScore = reviewCount > 0 ? (reviewSum / reviewCount) * 100 : 0;
    const memorizationScore = memorizationCount > 0 ? (memorizationSum / memorizationCount) * 10 : 0;

    const commitmentScore = (attendanceScore + behaviorScore + reviewScore + memorizationScore) / 4;

    return {
        attendance: attendanceScore,
        behavior: behaviorScore,
        review: reviewScore,
        memorization: memorizationScore,
        commitment: commitmentScore
    };
};

export function GroupEvaluationCard({ students, sessions, groupName }: { students: Student[]; sessions: Record<string, Record<string, DailySession>>; groupName?: string | null; }) {
    const { user } = require('@/context/AuthContext').useAuth();
    const { PORTAL_THEMES } = require('@/lib/themes');
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    type ViewType = 'commitment' | 'attendance' | 'behavior' | 'review' | 'memorization';
    type RangeType = 'daily' | 'weekly' | 'monthly' | 'seasonal' | 'yearly';

    const [view, setView] = useState<ViewType>('commitment');
    const [range, setRange] = useState<RangeType>('monthly');
    const [displayYear, setDisplayYear] = useState(new Date());

    const activeStudents = useMemo(() => (students || []).filter(s => s && s.status === 'نشط'), [students]);

    const chartData = useMemo(() => {
        if (range === 'daily') {
            // Get start of the current week (Saturday)
            const currentObj = new Date();
            const weekStart = startOfWeek(currentObj, { weekStartsOn: 6 }); // 6 = Saturday

            return Array.from({ length: 7 }).map((_, i) => {
                const dayDate = addDays(weekStart, i);
                // For daily stats, start and end is the same day
                const stats = calculatePeriodStats(dayDate, dayDate, activeStudents, sessions);
                return { name: format(dayDate, 'EEEE', { locale: ar }), ...stats };
            });
        }
        if (range === 'weekly') {
            return Array.from({ length: 6 }).map((_, i) => {
                const weekEndDate = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 6 });
                const weekStartDate = startOfWeek(weekEndDate, { weekStartsOn: 6 });
                const stats = calculatePeriodStats(weekStartDate, weekEndDate, activeStudents, sessions);
                return { name: format(weekStartDate, 'dd/MM', { locale: ar }), ...stats };
            }).reverse();
        }
        if (range === 'monthly') {
            const months = eachMonthOfInterval({ start: startOfYear(displayYear), end: endOfYear(displayYear) });
            return months.map(monthStart => {
                const monthEnd = endOfMonth(monthStart);
                const stats = calculatePeriodStats(monthStart, monthEnd, activeStudents, sessions);
                return { name: format(monthStart, 'MMM', { locale: ar }), ...stats };
            });
        }
        if (range === 'seasonal') {
            const quarters = eachQuarterOfInterval({ start: startOfYear(displayYear), end: endOfYear(displayYear) });
            return quarters.map((quarterStart, i) => {
                const quarterEnd = endOfQuarter(quarterStart);
                const stats = calculatePeriodStats(quarterStart, quarterEnd, activeStudents, sessions);
                return { name: `الربع ${i + 1}`, ...stats };
            });
        }
        if (range === 'yearly') {
            return Array.from({ length: 5 }).map((_, i) => {
                const yearDate = subYears(new Date(), i);
                const yearStart = startOfYear(yearDate);
                const yearEnd = endOfYear(yearDate);
                const stats = calculatePeriodStats(yearStart, yearEnd, activeStudents, sessions);
                return { name: format(yearStart, 'yyyy', { locale: ar }), ...stats };
            }).reverse();
        }
        return [];
    }, [range, activeStudents, sessions, displayYear]);

    const processedChartData = useMemo(() => {
        if (!chartData) return [];
        return chartData.map(item => ({
            name: item.name,
            score: parseFloat(item[view]?.toFixed(1) || "0"),
        }));
    }, [view, chartData]);

    const viewTitles: Record<ViewType, string> = {
        commitment: "التقييم العام",
        attendance: "نسبة الحضور",
        behavior: "السلوك",
        review: "المراجعة",
        memorization: "جودة الحفظ"
    };

    const viewDescriptions: Record<ViewType, string> = {
        commitment: "متوسط شامل يجمع بين الحضور، السلوك، الحفظ والمراجعة.",
        attendance: "نسبة التزام الطلاب بالحضور في الحلقات المجدولة.",
        behavior: "تقييم انضباط الطلاب وسلوكهم العام أثناء الحلقة.",
        review: "مدى إنجاز الطلاب لمحفوظاتهم السابقة (السابقي والماضي).",
        memorization: "جودة حفظ الدروس الجديدة ودقة التسميع."
    };

    if (activeStudents.length === 0 || Object.keys(sessions).length === 0) {
        return (
            <Card className={cn(
                "border-none",
                theme.isLight ? "bg-white shadow-xl shadow-slate-200/50" : "bg-white/5 backdrop-blur-md"
            )}>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Bot className="h-6 w-6 text-primary" />
                        <CardTitle className={theme.isLight ? "text-slate-800" : "text-white"}>الرادار التحليلي</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center p-12">
                    <AlertTriangle className="h-12 w-12 text-rose-500/50 mb-3" />
                    <p className={cn("font-bold", theme.isLight ? "text-slate-700" : "text-white")}>بيانات غير مكتملة</p>
                    <p className={theme.isLight ? "text-slate-400" : "text-white/40"}>يرجى تسجيل الطلاب وإدارة الجلسات لتفعيل الرادار.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={cn(
            "border-none overflow-hidden relative",
            theme.isLight ? "bg-white shadow-xl shadow-slate-200/50" : "bg-white/5 backdrop-blur-md"
        )}>
            <div className="absolute top-0 left-0 p-4 opacity-5 pointer-events-none">
                <Zap className="h-24 w-24 text-primary" />
            </div>

            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Bot className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className={cn(
                                "text-xl font-headline font-bold",
                                theme.isLight ? "text-slate-800" : "text-white"
                            )}>الرادار التحليلي للفوج</CardTitle>
                            <CardDescription className={cn(
                                "font-body",
                                theme.isLight ? "text-slate-400" : "text-white/40"
                            )}>نمو أداء {groupName || 'الفوج'} خلال الفترات المحددة.</CardDescription>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
                <div className="flex flex-col gap-6">
                    {/* View Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className={cn(
                            "p-1 rounded-2xl flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full",
                            theme.isLight ? "bg-slate-50" : "bg-white/5"
                        )}>
                            {Object.entries(viewTitles).map(([key, title]) => (
                                <button
                                    key={key}
                                    onClick={() => setView(key as ViewType)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-bold font-headline transition-all whitespace-nowrap",
                                        view === key
                                            ? "bg-primary text-slate-950 shadow-lg shadow-primary/20"
                                            : theme.isLight ? "text-slate-400 hover:text-slate-600" : "text-white/60 hover:text-white"
                                    )}
                                >
                                    {title.split(' ')[1] || title}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex p-1 rounded-xl",
                                theme.isLight ? "bg-slate-50" : "bg-white/5"
                            )}>
                                {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setRange(r)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                            range === r
                                                ? theme.isLight ? "bg-white text-slate-950 shadow-sm" : "bg-white/10 text-white"
                                                : theme.isLight ? "text-slate-400 hover:text-slate-600" : "text-white/40 hover:text-white"
                                        )}
                                    >
                                        {r === 'daily' ? 'يومي' : r === 'weekly' ? 'أسبوعي' : r === 'monthly' ? 'شهري' : 'سنوي'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Description Text */}
                    <div className={cn(
                        "text-xs px-1",
                        theme.isLight ? "text-slate-500" : "text-white/50"
                    )}>
                        {viewDescriptions[view]}
                    </div>

                    {/* Navigation for specific months */}
                    {(range === 'monthly' || range === 'seasonal') && (
                        <div className="flex items-center justify-center gap-8 py-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white" onClick={() => setDisplayYear(y => addYears(y, -1))}><ArrowRight className="h-4 w-4" /></Button>
                            <span className="font-headline font-bold text-xl text-amber-400">{format(displayYear, 'yyyy')}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white" onClick={() => setDisplayYear(y => addYears(y, 1))}><ArrowLeft className="h-4 w-4" /></Button>
                        </div>
                    )}
                </div>

                <div className="relative pt-4">
                    <div className="h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={processedChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="chartGradientPortal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                    stroke={theme.isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)"}
                                />
                                <XAxis
                                    dataKey="name"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{
                                        fill: theme.isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)',
                                        fontWeight: 600
                                    }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fill: theme.isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}
                                    unit="%"
                                />
                                <Tooltip
                                    cursor={{ stroke: theme.isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                                    contentStyle={{
                                        backgroundColor: theme.isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.9)',
                                        borderRadius: '16px',
                                        border: theme.isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.1)',
                                        backdropFilter: 'blur(10px)',
                                        direction: 'rtl',
                                        fontSize: '12px',
                                        padding: '12px',
                                        boxShadow: theme.isLight ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none'
                                    }}
                                    labelStyle={{ color: theme.isLight ? '#64748b' : '#94a3b8', marginBottom: '4px', fontWeight: 'bold' }}
                                    itemStyle={{ color: 'hsl(var(--primary))' }}
                                    formatter={(value: number) => [`${value}%`, 'النتيجة']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="score"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#chartGradientPortal)"
                                    animationDuration={1500}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}