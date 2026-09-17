"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentContext } from '@/context/StudentContext';
import { format, parseISO, getDate, getYear, getDay, startOfWeek, getQuarter } from 'date-fns';
import { ClipboardCheck, DollarSign, ArrowLeft, PartyPopper, AlertTriangle, BookOpenCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';

interface Task {
    id: string;
    text: string;
    link: string;
    buttonText: string;
    isUrgent: boolean;
    icon: React.ReactNode;
}

export function DailyChecklist() {
    const { user } = useAuth();
    const { dailySessions, students, payments } = useStudentContext();
    const activeStudents = useMemo(() => (students || []).filter(s => s && s.status === 'نشط'), [students]);

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const tasks = useMemo(() => {
        const incompleteTasks: Task[] = [];
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const currentHour = today.getHours();

        if (currentHour >= 8 && !dailySessions[todayStr]) {
            incompleteTasks.push({
                id: 'attendance',
                text: 'لم يتم رصد حضور وغياب الطلاب لليوم بعد.',
                link: '/sessions',
                buttonText: 'سجل الحضور',
                isUrgent: true,
                icon: <ClipboardCheck className="h-5 w-5" />
            });
        }

        const todaysSession = dailySessions[todayStr] ? Object.values(dailySessions[todayStr])[0] : undefined;
        if (todaysSession && todaysSession.sessionType === 'حصة أساسية') {
            const unevaluatedCount = (todaysSession.records ?? []).filter(r => r.attendance === 'حاضر' && !r.memorization).length;
            if (unevaluatedCount > 0) {
                incompleteTasks.push({
                    id: 'evaluation',
                    text: `لديك ${unevaluatedCount} طلاب يحتاجون لتقييم الحفظ لهذا اليوم.`,
                    link: '/sessions',
                    buttonText: 'تقييم الحفظ',
                    isUrgent: false,
                    icon: <BookOpenCheck className="h-5 w-5" />
                });
            }
        }

        const isBeginningOfMonth = getDate(today) <= 10;
        if (isBeginningOfMonth) {
            const currentQuarter = getQuarter(today);
            const currentYear = getYear(today);

            const studentsWithDues = activeStudents.filter(s => {
                const regYear = getYear(new Date(s.registrationDate));
                const regQuarter = getQuarter(new Date(s.registrationDate));
                return regYear < currentYear || (regYear === currentYear && regQuarter <= currentQuarter);
            });

            const studentPaymentsThisQuarter = new Set(
                (payments ?? [])
                    .filter(p => {
                        const paymentDate = parseISO(p.date);
                        return getYear(paymentDate) === currentYear && getQuarter(paymentDate) === currentQuarter;
                    })
                    .map(p => p.studentId)
            );
            const unpaidCount = studentsWithDues.filter(s => !studentPaymentsThisQuarter.has(s.id)).length;

            if (unpaidCount > 0) {
                incompleteTasks.push({
                    id: 'financial',
                    text: `هناك ${unpaidCount} طلاب بانتظار تسوية مستحقات الموسم.`,
                    link: '/dues',
                    buttonText: 'مراجعة المستحقات',
                    isUrgent: false,
                    icon: <DollarSign className="h-5 w-5" />
                });
            }
        }

        const dayOfWeek = getDay(today);
        if (dayOfWeek === 4 || dayOfWeek === 5) {
            const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 6 });
            const weeklySessions = Object.values(dailySessions ?? {}).flatMap(d => Object.values(d)).filter(s => s && s.date && parseISO(s.date) >= startOfCurrentWeek);
            let lowPerformingStudents = 0;
            const studentStats: { [key: string]: { absent: number, undisciplined: number } } = {};
            activeStudents.forEach(s => studentStats[s.id] = { absent: 0, undisciplined: 0 });

            weeklySessions.forEach(session => {
                (session.records ?? []).forEach(record => {
                    if (studentStats[record.studentId]) {
                        if (record.attendance === 'غائب') studentStats[record.studentId].absent++;
                        if ((record.behavior as string) === 'غير منضبط' || record.behavior === 'مشاغب') studentStats[record.studentId].undisciplined++;
                    }
                })
            });

            for (const studentId in studentStats) {
                if (studentStats[studentId].absent > 1 || studentStats[studentId].undisciplined > 1) {
                    lowPerformingStudents++;
                }
            }

            if (lowPerformingStudents > 0) {
                incompleteTasks.push({
                    id: 'review',
                    text: `يوجد ${lowPerformingStudents} طلاب حصلوا على تقييم منخفض هذا الأسبوع.`,
                    link: '/ranking',
                    buttonText: 'مراجعة الأداء',
                    isUrgent: false,
                    icon: <AlertTriangle className="h-5 w-5" />
                });
            }
        }

        return incompleteTasks;
    }, [dailySessions, activeStudents, payments]);

    if (tasks.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                    "relative overflow-hidden p-8 rounded-[2.5rem] border backdrop-blur-md flex items-center gap-6",
                    theme.isLight ? "bg-emerald-50 border-emerald-100 shadow-xl shadow-emerald-200/20" : "bg-emerald-500/10 border-emerald-500/20"
                )}
            >
                <div className="absolute -top-4 -left-4 opacity-5">
                    <PartyPopper className="h-24 w-24 text-emerald-400" />
                </div>
                <div className={cn(
                    "p-4 rounded-[1.5rem] shadow-lg shrink-0",
                    theme.isLight ? "bg-emerald-100 text-emerald-600" : "bg-emerald-500/20 text-emerald-400 shadow-emerald-500/10"
                )}>
                    <PartyPopper className="h-8 w-8" />
                </div>
                <div>
                    <h4 className={cn("font-headline font-black text-2xl", theme.isLight ? "text-emerald-800" : "text-emerald-100")}>أحسنت يا شيخ! 🌟</h4>
                    <p className={cn("font-medium", theme.isLight ? "text-emerald-600/70" : "text-emerald-100/60")}>لقد أتممت كافة المسؤوليات والمهام المطلوبة بنجاح باهر.</p>
                </div>
            </motion.div>
        );
    }

    return (
        <Card className={cn(
            "border-none backdrop-blur-md overflow-hidden relative",
            theme.isLight ? "bg-white shadow-2xl shadow-slate-200/50" : "bg-white/5"
        )}>
            <div className="absolute top-0 left-0 p-4 opacity-5 pointer-events-none">
                <Zap className="h-24 w-24 text-primary" />
            </div>
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "p-2 rounded-xl",
                        theme.isLight ? "bg-amber-100" : "bg-amber-400/10"
                    )}>
                        <Zap className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <CardTitle className={cn("text-xl font-headline font-bold", theme.isLight ? "text-slate-900" : "text-white")}>قائمة المهام الذكية</CardTitle>
                        <CardDescription className={theme.isLight ? "text-slate-400" : "text-white/40"}>إجراءات مقترحة بناءً على حالة البيانات الحالية.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
                {tasks.map((task, idx) => (
                    <motion.div
                        key={task.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className={cn(
                            "group p-4 rounded-2xl flex items-center justify-between gap-4 transition-all duration-300 relative overflow-hidden border-r-4",
                            task.isUrgent
                                ? theme.isLight ? 'bg-amber-50 border-amber-500' : 'bg-amber-500/10 border-amber-500'
                                : theme.isLight ? 'bg-blue-50 border-blue-500' : 'bg-blue-500/10 border-blue-500'
                        )}
                    >
                        <div className="flex items-center gap-4 relative z-10">
                            <div className={cn(
                                "p-2.5 rounded-xl bg-white/5 shadow-inner",
                                task.isUrgent ? 'text-amber-500' : 'text-blue-500'
                            )}>
                                {task.icon}
                            </div>
                            <p className={cn(
                                "font-bold text-sm leading-tight pr-1 tracking-tight",
                                theme.isLight ? "text-slate-700" : "text-white/90"
                            )}>{task.text}</p>
                        </div>
                        <Button asChild size="sm" variant="ghost" className={cn(
                            "h-10 px-4 rounded-xl relative z-10",
                            theme.isLight ? "text-slate-400 hover:text-slate-900 hover:bg-slate-100" : "text-white/60 hover:text-white hover:bg-white/5"
                        )}>
                            <Link href={task.link}>
                                <span className="font-bold">{task.buttonText}</span>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                            </Link>
                        </Button>
                    </motion.div>
                ))}
            </CardContent>
        </Card>
    );
}
