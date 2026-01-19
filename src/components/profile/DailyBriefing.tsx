"use client";

import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, AlertTriangle, UserPlus, Clock } from 'lucide-react';
import { Student, DailySession } from '@/lib/types';
import { differenceInDays, parseISO, startOfMonth } from 'date-fns';
import { motion } from 'framer-motion';

interface DailyBriefingProps {
    students: Student[];
    dailySessions: Record<string, Record<string, DailySession>>;
    sheikhName: string;
}

export function DailyBriefing({ students, dailySessions, sheikhName }: DailyBriefingProps) {

    const insights = useMemo(() => {
        const alerts: { type: 'warning' | 'info' | 'success', message: string, icon: any }[] = [];

        // 1. Retention Risk (Absent > 3 times this month)
        const currentMonthStart = startOfMonth(new Date());
        const activeStudents = students.filter(s => s.status === 'نشط');

        let retentionRiskCount = 0;

        // Flatten sessions
        const allSessions = Object.values(dailySessions).flatMap(year => Object.values(year)).flatMap(month => Object.values(month));

        activeStudents.forEach(student => {
            const absenceCount = allSessions.filter(session => {
                if (!session.date) return false;
                const date = parseISO(session.date);
                if (date < currentMonthStart) return false;

                const record = session.records.find(r => r.studentId === student.id);
                return record && record.attendance === 'غائب';
            }).length;

            if (absenceCount >= 3) retentionRiskCount++;
        });

        if (retentionRiskCount > 0) {
            alerts.push({
                type: 'warning',
                message: `لديك ${retentionRiskCount} طلاب تغيبوا أكثر من 3 مرات هذا الشهر. قد يحتاجون لمتابعة خاصة.`,
                icon: AlertTriangle
            });
        }

        // 2. New Joiners (Last 7 days)
        const newJoiners = activeStudents.filter(s => {
            const joinDate = new Date(s.registrationDate);
            return differenceInDays(new Date(), joinDate) < 7;
        }).length;

        if (newJoiners > 0) {
            alerts.push({
                type: 'success',
                message: `انضم إليك ${newJoiners} طلاب جدد هذا الأسبوع. مرحباً بهم!`,
                icon: UserPlus
            });
        }

        // 3. Stagnant Students (No mastery in 30 days) - (Simplified logic placeholder)
        // ...

        if (alerts.length === 0) {
            alerts.push({
                type: 'info',
                message: 'الأمور تسير على ما يرام. يوم موفق!',
                icon: Sparkles
            });
        }

        return alerts;
    }, [students, dailySessions]);

    // Get time of day greeting
    const hour = new Date().getHours();
    let greeting = 'السلام عليكم';
    if (hour < 12) greeting = 'صباح الخير';
    else if (hour < 17) greeting = 'مساء الخير';

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
        >
            <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-none shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>

                <CardContent className="p-8 relative z-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-2 text-center md:text-right">
                            <h2 className="text-3xl font-headline font-bold flex items-center justify-center md:justify-start gap-3">
                                <Sparkles className="h-6 w-6 text-yellow-400 animate-pulse" /> {greeting}، شيخ {sheikhName}
                            </h2>
                            <p className="text-slate-300 font-body text-lg">إليك موجز سريع عن حالة الفوج اليوم:</p>
                        </div>

                        <div className="flex-1 w-full md:w-auto grid gap-3">
                            {insights.map((alert, idx) => (
                                <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl backdrop-blur-md border ${alert.type === 'warning' ? 'bg-red-500/10 border-red-500/30 text-red-100' :
                                        alert.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100' :
                                            'bg-blue-500/10 border-blue-500/30 text-blue-100'
                                    }`}>
                                    <div className={`p-2 rounded-full ${alert.type === 'warning' ? 'bg-red-500/20' :
                                            alert.type === 'success' ? 'bg-emerald-500/20' :
                                                'bg-blue-500/20'
                                        }`}>
                                        <alert.icon className="h-4 w-4" />
                                    </div>
                                    <span className="font-body text-sm font-semibold">{alert.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
