
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentContext } from '@/context/StudentContext';
import { format, subDays, startOfMonth, parseISO, getDate, getMonth, getYear } from 'date-fns';
import { ClipboardCheck, DollarSign, ArrowRight, PartyPopper, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Task {
    id: string;
    text: string;
    link: string;
    buttonText: string;
    isUrgent: boolean;
}

export function DailyChecklist() {
    const { dailySessions, students, payments } = useStudentContext();

    const tasks = useMemo(() => {
        const incompleteTasks: Task[] = [];
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        // 1. Attendance Task
        if (!dailySessions[todayStr]) {
            incompleteTasks.push({
                id: 'attendance',
                text: 'لم يتم تسجيل حضور الطلاب اليوم.',
                link: '/sessions',
                buttonText: 'انتقل للتسجيل',
                isUrgent: true,
            });
        }

        // 2. Evaluation Task
        const twoDaysAgo = format(subDays(new Date(), 2), 'yyyy-MM-dd');
        const unevaluatedStudents = new Set<string>();
        Object.values(dailySessions)
            .filter(session => session.date >= twoDaysAgo && session.date < todayStr && session.sessionType === 'حصة أساسية')
            .forEach(session => {
                session.records.forEach(record => {
                    if (record.attendance === 'حاضر' && !record.memorization) {
                        unevaluatedStudents.add(record.studentId);
                    }
                });
            });
        
        if (unevaluatedStudents.size > 0) {
            incompleteTasks.push({
                id: 'evaluation',
                text: `لديك ${unevaluatedStudents.size} طلاب يحتاجون لتقييم الحفظ.`,
                link: '/surahs',
                buttonText: 'متابعة الحفظ',
                isUrgent: false,
            });
        }

        // 3. Financial Task
        const today = new Date();
        const isBeginningOfMonth = getDate(today) <= 7;
        const currentQuarter = Math.floor(getMonth(today) / 3) + 1;
        const currentYear = getYear(today);
        
        if (isBeginningOfMonth) {
            const activeStudents = (students ?? []).filter(s => s.status === 'نشط');
            const studentPaymentsThisQuarter = new Set(
                (payments ?? [])
                    .filter(p => {
                        const paymentDate = parseISO(p.date);
                        return getYear(paymentDate) === currentYear && Math.floor(getMonth(paymentDate) / 3) + 1 === currentQuarter;
                    })
                    .map(p => p.studentId)
            );
            
            const unpaidCount = activeStudents.filter(s => !studentPaymentsThisQuarter.has(s.id)).length;

            if (unpaidCount > 0) {
                 incompleteTasks.push({
                    id: 'financial',
                    text: `تذكير: ${unpaidCount} طلاب لم يسددوا رسوم هذا الموسم بعد.`,
                    link: '/dues',
                    buttonText: 'مراجعة المستحقات',
                    isUrgent: false,
                });
            }
        }
        
        return incompleteTasks;
    }, [dailySessions, students, payments]);

    if (tasks.length === 0) {
        return (
             <div className="p-6 rounded-lg bg-green-50 text-green-800 border border-green-200 flex items-center gap-4 transition-all duration-300">
                <PartyPopper className="h-8 w-8 text-green-600" />
                <div>
                    <h4 className="font-bold text-lg">أحسنت!</h4>
                    <p>لقد أتممت جميع مهام الفوج لهذا اليوم بنجاح.</p>
                </div>
            </div>
        );
    }
    
    return (
        <Card className="bg-white/30 backdrop-blur-sm border-gray-200/50 shadow-lg">
            <CardHeader>
                <CardTitle>قائمة المهام اليومية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {tasks.map(task => (
                     <div key={task.id} className={`p-3 rounded-lg flex items-center justify-between gap-4 transition-all duration-300 ${task.isUrgent ? 'bg-yellow-50 text-yellow-800 border-l-4 border-yellow-400' : 'bg-blue-50 text-blue-800 border-l-4 border-blue-400'}`}>
                        <div className="flex items-center gap-3">
                            {task.isUrgent ? <AlertTriangle className="h-5 w-5 text-yellow-600" /> : <ClipboardCheck className="h-5 w-5 text-blue-600" />}
                            <p className="font-medium text-sm">{task.text}</p>
                        </div>
                         <Button asChild size="sm" variant="ghost" className="h-8">
                            <Link href={task.link}>
                                {task.buttonText}
                                <ArrowRight className="mr-2 h-4 w-4" />
                            </Link>
                         </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

