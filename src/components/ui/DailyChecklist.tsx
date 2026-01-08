
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentContext } from '@/context/StudentContext';
import { format, subDays, startOfMonth, parseISO, getDate, getMonth, getYear, getDay, startOfWeek } from 'date-fns';
import { ClipboardCheck, DollarSign, ArrowRight, PartyPopper, AlertTriangle, BookOpenCheck } from 'lucide-react';
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
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const currentHour = today.getHours();
        
        // Task 1: Attendance
        if (currentHour >= 8 && !dailySessions[todayStr]) {
            incompleteTasks.push({
                id: 'attendance',
                text: 'لم يتم رصد حضور وغياب الطلاب لليوم بعد.',
                link: '/sessions',
                buttonText: 'سجل الحضور',
                isUrgent: true,
            });
        }
        
        // Task 2: Memorization Evaluation
        const todaysSession = dailySessions[todayStr];
        if(todaysSession && todaysSession.sessionType === 'حصة أساسية') {
            const unevaluatedCount = todaysSession.records.filter(r => r.attendance === 'حاضر' && !r.memorization).length;
            if (unevaluatedCount > 0) {
                 incompleteTasks.push({
                    id: 'evaluation',
                    text: `لديك ${unevaluatedCount} طلاب يحتاجون لتقييم الحفظ لهذا اليوم.`,
                    link: '/sessions',
                    buttonText: 'تقييم الحفظ',
                    isUrgent: false,
                });
            }
        }

        // Task 3: Financial Dues
        const isBeginningOfMonth = getDate(today) <= 5;
        if (isBeginningOfMonth) {
            const currentQuarter = Math.floor(getMonth(today) / 3) + 1;
            const currentYear = getYear(today);
            
            const activeStudents = (students ?? []).filter(s => s.status === 'نشط' && getYear(s.registrationDate) <= currentYear);
            const studentPaymentsThisQuarter = new Set(
                (payments ?? [])
                    .filter(p => {
                        const paymentDate = parseISO(p.date);
                        return getYear(paymentDate) === currentYear && Math.floor(getMonth(paymentDate) / 3) + 1 === currentQuarter;
                    })
                    .map(p => p.studentId)
            );
            const unpaidCount = activeStudents.filter(s => {
                const regQuarter = getQuarter(s.registrationDate);
                const regYear = getYear(s.registrationDate);
                const isDue = regYear < currentYear || (regYear === currentYear && regQuarter <= currentQuarter);
                return isDue && !studentPaymentsThisQuarter.has(s.id);
            }).length;

            if (unpaidCount > 0) {
                 incompleteTasks.push({
                    id: 'financial',
                    text: `هناك ${unpaidCount} طلاب بانتظار تسوية مستحقات الموسم.`,
                    link: '/dues',
                    buttonText: 'مراجعة المستحقات',
                    isUrgent: false,
                });
            }
        }
        
        // Task 4: Weekly Report Review
        const isThursday = getDay(today) === 4;
        if (isThursday) {
            const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 6 });
            const weeklySessions = Object.values(dailySessions).filter(s => parseISO(s.date) >= startOfCurrentWeek);
            let lowPerformingStudents = 0;
            const studentStats: {[key: string]: {absent: number, undisciplined: number}} = {};
            (students ?? []).forEach(s => studentStats[s.id] = {absent: 0, undisciplined: 0});

            weeklySessions.forEach(session => {
                (session.records ?? []).forEach(record => {
                    if (studentStats[record.studentId]) {
                        if (record.attendance === 'غائب') studentStats[record.studentId].absent++;
                        if (record.behavior === 'غير منضبط') studentStats[record.studentId].undisciplined++;
                    }
                })
            });

            for(const studentId in studentStats) {
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
                    <h4 className="font-bold text-lg">أحسنت يا شيخ!</h4>
                    <p>لقد أتممت جميع المهام المطلوبة للفوج بنجاح لليوم.</p>
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
