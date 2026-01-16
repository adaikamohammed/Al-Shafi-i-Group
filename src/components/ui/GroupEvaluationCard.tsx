
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useStudentContext } from '@/context/StudentContext';
import { Bot, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { 
    format, 
    startOfWeek, 
    endOfWeek, 
    subWeeks, 
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

    const workSessions = periodSessions.filter(s => s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة تعويضية');
    
    let totalAttendance = 0;
    let totalPossibleAttendance = 0;

    let behaviorSum = 0;
    let behaviorCount = 0;

    let reviewSum = 0;
    let reviewCount = 0;
    
    let memorizationSum = 0;
    let memorizationCount = 0;

    const memorizationScoreMap: { [key: string]: number } = { 'ممتاز': 10, 'جيد جداً': 8, 'جيد': 6, 'متوسط': 4, 'ضعيف': 2, 'لا يوجد': 0 };
    const behaviorScoreMap: { [key: string]: number } = { 'هادئ': 10, 'متوسط': 5, 'غير منضبط': 0 };
    
    workSessions.forEach(session => {
        const sessionDate = parseISO(session.date);
        activeStudents.forEach(student => {
            if (sessionDate >= student.registrationDate) {
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
                    
                    if (session.sessionType === 'حصة أساسية') {
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
    type ViewType = 'commitment' | 'attendance' | 'behavior' | 'review' | 'memorization';
    type RangeType = 'weekly'| 'monthly' | 'seasonal' | 'yearly';
    
    const [view, setView] = useState<ViewType>('commitment');
    const [range, setRange] = useState<RangeType>('monthly');
    const [displayYear, setDisplayYear] = useState(new Date());

    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const chartData = useMemo(() => {
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
            score: item[view]?.toFixed(1),
        }));
    }, [view, chartData]);

    const viewTitles: Record<ViewType, string> = {
        commitment: "منحنى الالتزام المدمج",
        attendance: "منحنى نسبة الحضور",
        behavior: "منحنى متوسط السلوك",
        review: "منحنى نسبة المراجعة",
        memorization: "منحنى متوسط أداء الحفظ"
    };

    if (activeStudents.length === 0 || Object.keys(sessions).length === 0) {
        return (
            <Card className="md:col-span-2 lg:col-span-4">
                 <CardHeader>
                    <div className="flex items-center gap-2">
                        <Bot className="h-6 w-6 text-primary" />
                        <CardTitle>الرادار التحليلي للفوج</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center p-8">
                     <AlertTriangle className="h-12 w-12 text-yellow-500 mb-2"/>
                    <p className="font-bold">لا توجد بيانات كافية</p>
                    <p className="text-sm text-muted-foreground">لا يمكن حساب التقييم بدون طلاب نشطين أو سجلات حضور.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="md:col-span-2 lg:col-span-4 bg-white/30 backdrop-blur-sm border-gray-200/50 shadow-lg">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-primary" />
                    <CardTitle>الرادار التحليلي للفوج</CardTitle>
                </div>
                <CardDescription>
                    تحليل بياني لأداء {groupName || 'الفوج'} عبر مؤشرات مختلفة.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <Tabs defaultValue="commitment" onValueChange={(v) => setView(v as ViewType)} dir="rtl">
                        <TabsList>
                            <TabsTrigger value="commitment">الالتزام</TabsTrigger>
                            <TabsTrigger value="attendance">الحضور</TabsTrigger>
                            <TabsTrigger value="behavior">السلوك</TabsTrigger>
                            <TabsTrigger value="review">المراجعة</TabsTrigger>
                            <TabsTrigger value="memorization">الحفظ</TabsTrigger>
                        </TabsList>
                    </Tabs>
                    <div className="flex items-center gap-2 justify-end">
                        {(range === 'monthly' || range === 'seasonal') && (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setDisplayYear(y => addYears(y, -1))}><ArrowRight/></Button>
                                <span className="font-bold text-lg">{format(displayYear, 'yyyy')}</span>
                                <Button variant="outline" size="icon" onClick={() => setDisplayYear(y => addYears(y, 1))}><ArrowLeft/></Button>
                            </div>
                        )}
                        <Tabs defaultValue="monthly" onValueChange={(v) => setRange(v as RangeType)} dir="rtl">
                            <TabsList>
                                <TabsTrigger value="weekly">أسبوعي</TabsTrigger>
                                <TabsTrigger value="monthly">شهري</TabsTrigger>
                                <TabsTrigger value="seasonal">موسمي</TabsTrigger>
                                <TabsTrigger value="yearly">سنوي</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-center mb-2">{viewTitles[view]}</h4>
                    <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={processedChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis domain={[0, 100]} fontSize={12} tickLine={false} axisLine={false} unit="%" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '0.5rem', direction: 'rtl', fontSize: '12px', padding: '4px 8px' }}
                                    formatter={(value: number) => [`${value}%`, 'النتيجة']}
                                />
                                <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#chartGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
