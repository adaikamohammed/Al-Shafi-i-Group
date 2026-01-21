"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { BookOpen, Users, Star, Clock, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PORTAL_THEMES } from '@/lib/themes';
import { useAuth } from '@/context/AuthContext';

export function ImpactStats() {
    const { user } = useAuth();
    const { students, dailySessions } = useStudentContext();
    const activeStudents = useMemo(() => (students || []).filter(s => s.status === 'نشط'), [students]);

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const stats = useMemo(() => {
        const total = students.length;
        const totalSessions = Object.values(dailySessions).reduce((acc, day) => acc + Object.keys(day).length, 0);
        const totalSurahs = students.reduce((acc, s) => acc + (s.memorizedSurahsCount || 0), 0);
        const topPerformers = activeStudents.filter(s => s.memorizedSurahsCount > 5).length;

        if (currentThemeId === 'ramadan') {
            return [
                { label: "طالباً تحت إشرافك", value: total, icon: Users, color: "text-emerald-600", bg: "bg-emerald-100" },
                { label: "سورة تم حفظها", value: totalSurahs, icon: BookOpen, color: "text-amber-600", bg: "bg-amber-100" },
                { label: "حصة تم عقدها", value: totalSessions, icon: Moon, color: "text-emerald-600", bg: "bg-emerald-100" },
                { label: "نجوم رمضانية", value: topPerformers, icon: Star, color: "text-amber-600", bg: "bg-amber-100" },
            ];
        }

        return [
            { label: "طالباً تحت إشرافك", value: total, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "سورة تم حفظها", value: totalSurahs, icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "حصة تم عقدها", value: totalSessions, icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
            { label: "نجوم متألقون", value: topPerformers, icon: Star, color: "text-amber-500", bg: "bg-amber-500/10" },
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
                    className={cn(
                        "relative overflow-hidden p-6 rounded-3xl border backdrop-blur-xl group hover:scale-[1.02] transition-all duration-300",
                        theme.isLight ? "bg-white border-slate-100 shadow-xl shadow-slate-200/50 hover:bg-slate-50" : "bg-white/5 border-white/5 hover:bg-white/10"
                    )}
                >
                    <div className="flex flex-col items-center text-center gap-2">
                        <div className={cn("p-3 rounded-2xl mb-2 group-hover:scale-110 transition-transform duration-300", stat.bg, stat.color)}>
                            <stat.icon className="h-6 w-6" />
                        </div>
                        <span className={cn("text-3xl font-headline font-black", theme.isLight ? "text-slate-900" : "text-white")}>{stat.value}</span>
                        <span className={cn("text-xs font-bold uppercase tracking-widest", theme.isLight ? "text-slate-400" : "text-white/40")}>{stat.label}</span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
