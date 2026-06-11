"use client";

import React, { useState, useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { MonitoringRadar } from '@/components/management/MonitoringRadar';
import { AssistantReport } from '@/components/management/AssistantReport';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Calendar, Shield, ArrowLeft, Loader2, Info,
    CalendarDays, CalendarRange, CalendarCheck, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    startOfWeek, endOfWeek, subWeeks,
    startOfMonth, endOfMonth, subMonths,
    startOfQuarter, endOfQuarter, subQuarters,
    startOfYear, endOfYear, subYears,
    isWithinInterval, parseISO
} from 'date-fns';

export default function MonitoringPage() {
    const { dailySessions, allUsers, loading, students } = useStudentContext();
    const { isManagement } = useAuth();
    const [timeframe, setTimeframe] = useState('weekly');
    const [selectedGroup, setSelectedGroup] = useState('all');

    const aggregatedData = useMemo(() => {
        if (!dailySessions) return [];

        // 1. Determine date range
        let start: Date, end: Date;
        const now = new Date();

        switch (timeframe) {
            case 'monthly':
                start = startOfMonth(now); end = endOfMonth(now); break;
            case 'seasonal':
                start = startOfQuarter(now); end = endOfQuarter(now); break;
            case 'yearly':
                start = startOfYear(now); end = endOfYear(now); break;
            case 'weekly':
            default:
                start = startOfWeek(now, { weekStartsOn: 6 }); // Start on Saturday
                end = endOfWeek(now, { weekStartsOn: 6 }); break;
        }

        // 2. Identify all groups
        const uniqueGroups = Array.from(new Set(allUsers.filter(u => u.role === 'sheikh' && u.group).map(u => u.group))) as string[];

        // 3. Aggregate data per group
        return uniqueGroups.map(groupName => {
            let totalSessions = 0;
            let totalAttendance = 0;
            let totalRecords = 0;
            let totalReview = 0;
            let totalEvaluationPoints = 0;
            let totalBehaviorPoints = 0;

            Object.entries(dailySessions).forEach(([date, sessionsOnDay]) => {
                const sessionDate = parseISO(date);
                if (isWithinInterval(sessionDate, { start, end })) {
                    Object.values(sessionsOnDay).forEach(session => {
                        // Find if this session belongs to a sheikh of this group
                        const sheikh = allUsers.find(u => u.uid === session.ownerId);
                        if (sheikh?.group === groupName) {
                            totalSessions++;
                            (session.records || []).forEach(record => {
                                totalRecords++;
                                // Attendance
                                if (record.attendance === 'حاضر' || record.attendance === 'متأخر') totalAttendance++;
                                // Review
                                if (record.review) totalReview++;
                                // Evaluation
                                const student = students.find(s => s.id === record.studentId);
                                const isGroup8User = groupName === 'فوج 8' || groupName === 'فوج الشيخ عبد الحق نصيرة' || groupName.includes('عبد الحق');
                                const multiplier = (isGroup8User && student) ? (student.memorizationMultiplier ?? 1.0) : 1.0;
                                const isDelayedMemo = record.memorization && record.memorization !== 'لا يوجد' && (record.memorization as string) !== '' && !record.review && record.isDelayed;
                                const penalty = isDelayedMemo ? 0.8 : 1.0;

                                let memoLevel = record.memorization;
                                if (memoLevel === 'متوسط') memoLevel = 'مقبول';
                                if (memoLevel === 'جيد جدا') memoLevel = 'جيد جداً';

                                let behaviorLevel = record.behavior;
                                if (behaviorLevel === 'متوسط') behaviorLevel = 'مقبول';
                                if (behaviorLevel === 'غير منضبط') behaviorLevel = 'مشاغب';

                                const evalMap: Record<string, number> = { 'ممتاز': 100, 'جيد جداً': 80, 'جيد': 60, 'حسن': 45, 'مقبول': 30, 'ضعيف': 15 };
                                const basePoints = evalMap[memoLevel || ''] || 0;
                                totalEvaluationPoints += basePoints * multiplier * penalty;
                                // Behavior
                                const behavMap: Record<string, number> = { 'هادئ': 100, 'مقبول': 60, 'مشاغب': 20 };
                                totalBehaviorPoints += behavMap[behaviorLevel || ''] || 0;
                            });
                        }
                    });
                }
            });

            const countRecords = totalRecords || 1;
            return {
                groupName,
                attendanceRate: Math.round((totalAttendance / countRecords) * 100),
                reviewRate: Math.round((totalReview / countRecords) * 100),
                evaluationScore: Math.round(totalEvaluationPoints / countRecords),
                behaviorScore: Math.round(totalBehaviorPoints / countRecords)
            };
        }).sort((a, b) => {
            const groupA = parseInt((a.groupName || '').replace(/[^0-9]/g, '')) || 999;
            const groupB = parseInt((b.groupName || '').replace(/[^0-9]/g, '')) || 999;
            return groupA - groupB;
        });
    }, [dailySessions, allUsers, timeframe]);

    if (!isManagement) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-4">
                <Shield className="h-16 w-16 text-rose-500 animate-bounce" />
                <h1 className="text-2xl font-headline font-bold">عذراً، هذه الصفحة مخصصة للإدارة فقط</h1>
                <Button asChild variant="outline"><Link href="/home">العودة للرئيسية</Link></Button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent text-white p-4 lg:p-8 space-y-10 pb-32">
            {/* Header */}
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-xl">
                            <Shield className="h-6 w-6 text-emerald-400" />
                        </div>
                        <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight">نظام مراقبة المدرسة</h1>
                    </div>
                    <p className="text-white/60 font-body flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        متابعة حية وشاملة لأداء جميع الأفواج والمشايخ
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                        <SelectTrigger className="w-full md:w-48 bg-white/5 border-white/10 rounded-xl h-11 text-white">
                            <SelectValue placeholder="اختر الفوج" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                            <SelectItem value="all">جميع الأفواج</SelectItem>
                            {Array.from(new Set(allUsers.filter(u => u.role === 'sheikh' && u.group).map(u => u.group)))
                                .sort((a, b) => {
                                    const numA = parseInt(a?.replace(/[^0-9]/g, '') || '0');
                                    const numB = parseInt(b?.replace(/[^0-9]/g, '') || '0');
                                    return numA - numB;
                                })
                                .map(group => (
                                    <SelectItem key={group} value={group || ''}>{group}</SelectItem>
                                ))
                            }
                        </SelectContent>
                    </Select>

                    <Button asChild variant="ghost" className="rounded-xl hover:bg-white/10 text-white/70">
                        <Link href="/home" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            العودة للوحة التحكم
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Timeframe Selectors */}
            <div className="max-w-7xl mx-auto">
                <Tabs value={timeframe} onValueChange={setTimeframe} className="w-full">
                    <TabsList className="bg-white/5 border border-white/10 p-1 h-auto grid grid-cols-2 md:grid-cols-4 gap-2 rounded-2xl">
                        <TabsTrigger value="weekly" className="rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all">
                            <CalendarDays className="ml-2 h-4 w-4" /> الأسبوعي
                        </TabsTrigger>
                        <TabsTrigger value="monthly" className="rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all">
                            <CalendarRange className="ml-2 h-4 w-4" /> الشهري
                        </TabsTrigger>
                        <TabsTrigger value="seasonal" className="rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all">
                            <CalendarCheck className="ml-2 h-4 w-4" /> الفصلي
                        </TabsTrigger>
                        <TabsTrigger value="yearly" className="rounded-xl py-3 data-[state=active]:bg-emerald-500 data-[state=active]:text-white transition-all">
                            <History className="ml-2 h-4 w-4" /> السنوي
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Main Content Layout */}
            <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">

                {/* 1. Global School Radar */}
                <section className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-white/10" />
                        <h2 className="text-2xl font-headline font-black text-emerald-400">رادار متوسط أداء المدرسة</h2>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <MonitoringRadar data={aggregatedData} selectedGroup="all" />
                </section>

                {/* 2. Individual Group Radars Grid */}
                <section className="space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-white/10" />
                        <h2 className="text-xl font-headline font-bold text-white/80">رادار الأفواج التفصيلي</h2>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {aggregatedData.map((groupData) => (
                            <div key={groupData.groupName} className="transform transition-all hover:scale-[1.03]">
                                <MonitoringRadar
                                    data={[groupData]}
                                    selectedGroup={groupData.groupName || ''}
                                />
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Intelligent Report */}
                <section className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-white/10" />
                        <h2 className="text-xl font-headline font-bold text-white/80">التحليل الإداري الذكي</h2>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <AssistantReport data={aggregatedData} timeframe={timeframe} />
                </section>
            </div>

            {/* Footer */}
            <div className="text-center opacity-30 pt-16">
                <p className="text-xs font-bold tracking-[0.3em] uppercase">نظام المراقبة الذكي • مدرسة الإمام الشافعي • 2026</p>
            </div>
        </div>
    );
}
