
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, User, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, getMonth, getYear, isSameMonth, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { DailySession, Student, SessionRecord } from '@/lib/types';


type StudentStat = {
    date: string;
    attendance: string;
    behavior: string | null;
    memorization: string | null;
    notes?: string;
    sessionType: string;
};

const attendanceColors: { [key: string]: string } = {
    'حاضر': 'bg-green-400',
    'غائب': 'bg-red-500',
    'متأخر': 'bg-orange-400',
    'تعويض': 'bg-blue-400',
    'يوم عطلة': 'bg-gray-300',
     '—': 'bg-muted/30'
};

const behaviorBorders: { [key: string]: string } = {
    'هادئ': 'border-blue-500',
    'متوسط': 'border-yellow-500',
    'غير منضبط': 'border-red-500',
};

const sessionTypeBadge: { [key: string]: string } = {
  'حصة أساسية': 'bg-blue-100 text-blue-800',
  'حصة أنشطة': 'bg-purple-100 text-purple-800',
  'حصة تعويضية': 'bg-indigo-100 text-indigo-800',
  'يوم عطلة': 'bg-gray-100 text-gray-800',
}


export default function StatisticsPage() {
    const { students, dailySessions, loading } = useStudentContext();
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [weekOffset, setWeekOffset] = useState(0);
    
    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const currentWeek = useMemo(() => {
        const today = addWeeks(new Date(), weekOffset);
        return {
            start: startOfWeek(today, { locale: ar }),
            end: endOfWeek(today, { locale: ar }),
        };
    }, [weekOffset]);

    const weekDays = useMemo(() => {
        return eachDayOfInterval(currentWeek);
    }, [currentWeek]);

    const weeklyStudentStats = useMemo(() => {
        const weekMatrix: Record<string, StudentStat[]> = {};
        
        // Ensure all selected students have a row
        const studentsToDisplay = selectedStudentId 
            ? activeStudents.filter(s => s.id === selectedStudentId)
            : activeStudents;
            
        studentsToDisplay.forEach(student => {
             weekMatrix[student.id] = [];
        });

        weekDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const session = dailySessions[dateStr];
            
            if (session) {
                 if (session.sessionType === 'يوم عطلة') {
                    // Add holiday entry for all students
                    studentsToDisplay.forEach(student => {
                        weekMatrix[student.id].push({
                            date: dateStr, attendance: 'يوم عطلة', behavior: null, memorization: null,
                            sessionType: 'يوم عطلة'
                        });
                    });
                } else {
                     // Add records for students present in the session
                    studentsToDisplay.forEach(student => {
                        const record = session.records.find(r => r.studentId === student.id);
                        if (record) {
                             weekMatrix[student.id].push({
                                date: dateStr,
                                attendance: record.attendance,
                                behavior: record.behavior,
                                memorization: record.memorization,
                                notes: record.notes,
                                sessionType: session.sessionType
                            });
                        }
                    });
                }
            }
        });
        
         // Fill in the gaps for days with no records for any student
        studentsToDisplay.forEach(student => {
            const studentDays = new Set(weekMatrix[student.id].map(s => s.date));
            weekDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                if (!studentDays.has(dateStr)) {
                     weekMatrix[student.id].push({
                        date: dateStr, attendance: '—', behavior: null, memorization: null,
                        sessionType: 'لا يوجد'
                    });
                }
            });
             // Sort records by date for each student
            weekMatrix[student.id].sort((a, b) => a.date.localeCompare(b.date));
        });

        return weekMatrix;
    }, [dailySessions, weekDays, activeStudents, selectedStudentId]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }
    
     if (activeStudents.length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }
    
    const studentsToDisplay = selectedStudentId 
        ? activeStudents.filter(s => s.id === selectedStudentId)
        : activeStudents;

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-headline font-bold">لوحة المتابعة التحليلية</h1>
                     <div className="flex gap-2 w-full md:w-auto">
                        <Select dir="rtl" value={selectedStudentId || 'all'} onValueChange={(val) => setSelectedStudentId(val === 'all' ? null : val)}>
                            <SelectTrigger className="w-full md:w-[200px]">
                                <SelectValue placeholder="اختر طالبًا" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الطلبة النشطين</SelectItem>
                                {activeStudents.map(student => (
                                    <SelectItem key={student.id} value={student.id}>
                                        {student.fullName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                 <Card>
                    <CardHeader className="flex flex-col md:flex-row justify-between items-center">
                        <div>
                            <CardTitle>متابعة أسبوعية</CardTitle>
                            <CardDescription>{`الأسبوع من ${format(currentWeek.start, 'd MMM', { locale: ar })} إلى ${format(currentWeek.end, 'd MMM yyyy', { locale: ar })}`}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 mt-4 md:mt-0">
                            <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                             <Button variant="outline" onClick={() => setWeekOffset(0)}>الأسبوع الحالي</Button>
                            <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b">
                                    <th className="p-2 text-right font-semibold text-muted-foreground min-w-[150px]">الطالب</th>
                                    {weekDays.map(day => (
                                        <th key={day.toString()} className="p-2 text-center font-semibold text-muted-foreground min-w-[80px]">
                                            <div>{format(day, 'EEEE', { locale: ar })}</div>
                                            <div className="text-xs font-normal">{format(day, 'M/d', { locale: ar })}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {studentsToDisplay.map(student => {
                                    const studentStats = weeklyStudentStats[student.id];
                                    return (
                                         <tr key={student.id} className="border-b">
                                            <td className="p-2 font-medium">{student.fullName}</td>
                                            {studentStats && studentStats.length > 0 ? studentStats.map(stat => (
                                                <td key={stat.date} className="p-1">
                                                     <DayCell stat={stat} />
                                                </td>
                                            )) : (
                                                // Fallback if stats are not ready
                                                Array(7).fill(0).map((_, i) => <td key={i} className="p-1 h-12"></td>)
                                            )}
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>مفتاح الدلالات</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-x-6 gap-y-4 text-sm">
                         <div className="space-y-2">
                            <h4 className="font-semibold mb-1">الحضور</h4>
                             {Object.entries(attendanceColors).map(([status, colorClass]) => (
                                 <div key={status} className="flex items-center gap-2">
                                     <div className={cn("w-4 h-4 rounded-full", colorClass)}></div>
                                     <span>{status === '—' ? 'لا يوجد تسجيل' : status}</span>
                                 </div>
                             ))}
                        </div>
                        <div className="space-y-2">
                             <h4 className="font-semibold mb-1">السلوك (إطار الخلية)</h4>
                             {Object.entries(behaviorBorders).map(([status, borderClass]) => (
                                <div key={status} className="flex items-center gap-2">
                                    <div className={cn("w-4 h-4 rounded-md border-2", borderClass)}></div>
                                    <span>{status}</span>
                                </div>
                             ))}
                        </div>
                         <div className="space-y-2">
                             <h4 className="font-semibold mb-1">نوع الحصة (شارة)</h4>
                            {Object.entries(sessionTypeBadge).map(([type, className]) => (
                                 <div key={type} className="flex items-center gap-2">
                                    <span className={cn("px-2 py-0.5 rounded-full text-xs", className)}>{type}</span>
                                 </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}


function DayCell({ stat }: { stat: StudentStat }) {
    if (!stat || stat.attendance === '—') {
        return <div className="h-12 w-full rounded-md bg-muted/30"></div>;
    }

    if (stat.attendance === 'يوم عطلة') {
        return (
             <Tooltip>
                <TooltipTrigger asChild>
                    <div className="h-12 w-full rounded-md bg-gray-300 flex items-center justify-center text-white font-bold text-xs p-1">
                        عطلة
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{format(parseISO(stat.date), 'EEEE, d MMMM', { locale: ar })}</p>
                    <p>يوم عطلة رسمي</p>
                </TooltipContent>
            </Tooltip>
        )
    }

    const attendanceColor = attendanceColors[stat.attendance] || 'bg-gray-200';
    const behaviorBorder = stat.behavior ? behaviorBorders[stat.behavior] : 'border-transparent';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("h-12 w-full rounded-md flex items-center justify-center p-1 text-white text-xs font-bold border-2", attendanceColor, behaviorBorder)}>
                   {stat.attendance}
                </div>
            </TooltipTrigger>
            <TooltipContent className="text-right" dir="rtl">
                <p><span className="font-bold">التاريخ:</span> {format(parseISO(stat.date), 'd MMMM yyyy', { locale: ar })}</p>
                <p><span className="font-bold">الحضور:</span> {stat.attendance}</p>
                {stat.memorization && <p><span className="font-bold">التقييم:</span> {stat.memorization}</p>}
                {stat.behavior && <p><span className="font-bold">السلوك:</span> {stat.behavior}</p>}
                {stat.notes && <p><span className="font-bold">ملاحظات:</span> {stat.notes}</p>}
                {stat.sessionType !== 'لا يوجد' && <p className="mt-1">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs", sessionTypeBadge[stat.sessionType])}>
                        {stat.sessionType}
                    </span>
                </p>}
            </TooltipContent>
        </Tooltip>
    );
}


    