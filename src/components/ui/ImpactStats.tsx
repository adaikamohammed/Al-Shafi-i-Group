"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { BookOpen, Users, Star, Clock, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function ImpactStats() {
    const { students, dailySessions } = useStudentContext();
    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const stats = useMemo(() => {
        // 1. Total Students
        const total = students.length;

        // 2. Total Sessions Conducted
        const totalSessions = Object.values(dailySessions).reduce((acc, day) => acc + Object.keys(day).length, 0);

        // 3. Estimated Pages Memorized (Simplified logic: sum of memorizedSurahsCount * average size? 
        // Better: sum of student.memorizedSurahsCount)
        const totalSurahs = students.reduce((acc, s) => acc + (s.memorizedSurahsCount || 0), 0);

        // 4. Excellence Score (Students with many memorized surahs or high attendance)
        const topPerformers = activeStudents.filter(s => s.memorizedSurahsCount > 5).length;

        return [
            { label: "طالباً تحت إشرافك", value: total, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "سورة تم حفظها", value: totalSurahs, icon: BookOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "حصة تم عقدها", value: totalSessions, icon: Clock, color: "text-purple-400", bg: "bg-purple-500/10" },
            { label: "نجوم متألقون", value: topPerformers, icon: Star, color: "text-amber-400", bg: "bg-amber-500/10" },
        ];
    }, [students, dailySessions, activeStudents]);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
            {stats.map((stat, idx) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative overflow-hidden p-6 rounded-3xl bg-white/5 border border-white/5 backdrop-blur-xl group hover:bg-white/10 transition-all duration-300"
                >
                    <div className="flex flex-col items-center text-center gap-2">
                        <div className={cn("p-3 rounded-2xl mb-2 group-hover:scale-110 transition-transform duration-300", stat.bg, stat.color)}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <span className="text-3xl font-headline font-black text-white">{stat.value}</span>
                        <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{stat.label}</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
