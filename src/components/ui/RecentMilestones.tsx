"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { PartyPopper, ChevronLeft, Award, BookCheck, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export function RecentMilestones() {
    const { students } = useStudentContext();

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
                <h2 className="text-3xl font-headline font-black tracking-tight text-white">
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
                        className="flex items-center gap-5 p-6 rounded-[2rem] bg-white/5 border border-white/5 backdrop-blur-md group hover:bg-white/10 transition-all shadow-xl"
                    >
                        <Avatar className="h-16 w-16 border-2 border-amber-500/20 group-hover:border-amber-500/50 transition-colors">
                            <AvatarImage src={m.photo} className="object-cover" />
                            <AvatarFallback className="bg-slate-800 text-white font-bold text-xl">{m.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-start mb-1">
                                <p className="font-bold text-lg text-white truncate">{m.name}</p>
                                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{m.date}</span>
                            </div>
                            <p className="text-sm text-white/60 font-medium leading-relaxed">{m.achievement}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
