
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Student, DailySession } from '@/lib/types';
import { Bot, Lightbulb } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subDays, parseISO } from 'date-fns';

export const SmartAlerts = ({ students, sessions }: { students: Student[], sessions: Record<string, Record<string, DailySession>> }) => {
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 6 }); // Saturday
    const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 6 }); // Friday

    const weeklyAttendance = useMemo(() => {
        const attendanceMap: Record<string, number> = {};
        (students ?? []).forEach(s => attendanceMap[s.id] = 0);

        Object.values(sessions ?? {}).flatMap(day => Object.values(day)).forEach(session => {
            const sessionDate = parseISO(session.date);
            if (sessionDate >= startOfCurrentWeek && sessionDate <= endOfCurrentWeek) {
                (session.records ?? []).forEach(record => {
                    if ((record.attendance === 'حاضر' || record.attendance === 'متأخر') && attendanceMap[record.studentId] !== undefined) {
                        attendanceMap[record.studentId]++;
                    }
                });
            }
        });
        
        return Object.entries(attendanceMap)
            .map(([studentId, count]) => ({ studentId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(item => {
                const student = students.find(s => s.id === item.studentId);
                return { ...item, name: student?.fullName || 'طالب غير معروف' };
            });

    }, [students, sessions, startOfCurrentWeek, endOfCurrentWeek]);

    const consecutiveAbsences = useMemo(() => {
        const absenceMap: Record<string, number> = {};
        const lastSessionDates: Record<string, Date | null> = {};

        const sortedSessionDates = Object.keys(sessions ?? {}).sort((a, b) => b.localeCompare(a));
        
        sortedSessionDates.slice(0, 5).forEach(dateStr => { // Check last 5 sessions
            const daySessions = sessions[dateStr];
            if(!daySessions) return;

            Object.values(daySessions).forEach(session => {
                (session.records ?? []).forEach(record => {
                     if (lastSessionDates[record.studentId] === undefined) lastSessionDates[record.studentId] = null;
                     
                     const currentDate = parseISO(dateStr);
                     const lastDate = lastSessionDates[record.studentId];

                     if(record.attendance === 'غائب') {
                        if (lastDate && subDays(lastDate, 1).getDate() === currentDate.getDate()) {
                           absenceMap[record.studentId] = (absenceMap[record.studentId] || 1) + 1;
                        } else {
                           absenceMap[record.studentId] = 1;
                        }
                     } else {
                        absenceMap[record.studentId] = 0;
                     }
                     lastSessionDates[record.studentId] = currentDate;
                });
            });
        });
        
        return Object.entries(absenceMap)
            .filter(([, count]) => count >= 3)
            .map(([studentId]) => students.find(s => s.id === studentId)?.fullName)
            .filter(Boolean);
    }, [students, sessions]);

    const isEndOfMonth = today.getDate() > 20;

    return (
      <Card className="col-span-1 lg:col-span-3">
        <CardHeader>
           <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                <CardTitle>التنبيهات والاقتراحات الذكية</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="space-y-3">
             {weeklyAttendance.length > 0 && weeklyAttendance[0].count > 0 && (
                <div className="p-3 bg-blue-50 text-blue-800 rounded-lg dark:bg-blue-900/50 dark:text-blue-200">
                    <p className="font-bold">🌟 نجوم الأسبوع (الأكثر حضورًا):</p>
                    <p className="text-sm">{weeklyAttendance.map(s => s.name).join('، ')}</p>
                </div>
            )}
             {consecutiveAbsences.length > 0 && (
                 <div className="p-3 bg-red-50 text-red-800 rounded-lg dark:bg-red-900/50 dark:text-red-200">
                    <p className="font-bold">⚠️ غياب متكرر:</p>
                    <p className="text-sm">الطلاب: {consecutiveAbsences.join('، ')} قد تغيبوا 3 مرات متتالية أو أكثر.</p>
                </div>
            )}
            {isEndOfMonth && (
                 <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg dark:bg-yellow-900/50 dark:text-yellow-200">
                    <p className="font-bold">💰 تذكير مالي:</p>
                    <p className="text-sm">اقتربت نهاية الشهر، لا تنس مراجعة صفحة "المستحقات المالية".</p>
                </div>
            )}
            {weeklyAttendance.length === 0 && consecutiveAbsences.length === 0 && !isEndOfMonth && (
                <p className="text-muted-foreground text-center p-4">لا توجد تنبيهات هامة حاليًا. أداء الفوج مستقر.</p>
            )}
        </CardContent>
      </Card>
    );
};
