"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { PartyPopper, ChevronLeft, Award, BookCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export function RecentMilestones() {
    const { user } = require('@/context/AuthContext').useAuth();
    const { PORTAL_THEMES } = require('@/lib/themes');
    const { students } = useStudentContext();

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const milestones = useMemo(() => {
        return students
            .filter(s => s.memorizedSurahsCount > 0)
            .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0))
            .slice(0, 3)
            .map(s => ({
                id: s.id,
                name: s.fullName,
                photo: s.photoURL,
                achievement: `أتمّ حفظ ${s.memorizedSurahsCount} سور بامتياز`,
                date: 'اليوم'
            }));
    }, [students]);

    if (milestones.length === 0) return null;

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4 px-6 border-r-4 border-amber-500">
                <Zap className="h-7 w-7 text-amber-500" />
                <h2 className={cn(
                    "text-3xl font-headline font-black tracking-tight",
                    theme.isLight ? "text-slate-800" : "text-white"
                )}>
                    أحدث الإنجازات
                </h2>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {milestones.map((m, idx) => (
                    <motion.div
                        key={m.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                            "flex items-center gap-5 p-6 rounded-[2rem] border backdrop-blur-md group transition-all shadow-xl hover:-translate-y-1",
                            theme.isLight
                                ? "bg-white border-slate-100 shadow-slate-200/50 hover:bg-slate-50"
                                : "bg-white/5 border-white/5 hover:bg-white/10 shadow-black/80"
                        )}
                    >
                        <Avatar className={cn(
                            "h-16 w-16 border-2 transition-colors",
                            theme.isLight ? "border-amber-100 ring-4 ring-amber-50" : "border-amber-500/20 group-hover:border-amber-500/50"
                        )}>
                            <AvatarImage src={m.photo} className="object-cover" />
                            <AvatarFallback className={cn(
                                "font-bold text-xl",
                                theme.isLight ? "bg-slate-100 text-slate-400" : "bg-slate-800 text-white"
                            )}>{m.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-start mb-1">
                                <p className={cn(
                                    "font-bold text-lg truncate",
                                    theme.isLight ? "text-slate-800" : "text-white"
                                )}>{m.name}</p>
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{m.date}</span>
                            </div>
                            <p className={cn(
                                "text-sm font-medium leading-relaxed",
                                theme.isLight ? "text-slate-500" : "text-white/60"
                            )}>{m.achievement}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
