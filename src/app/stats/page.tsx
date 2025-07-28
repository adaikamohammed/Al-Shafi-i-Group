
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
import type { DailySession, Student } from '@/lib/types';


type StudentStat = {
    date: string;
    attendance: string;
    behavior: string | null;
    memorization: string | null;
    notes?: string;
    sessionType: string;
};

type ProcessedStats = {
    [studentId: string]: StudentStat[];
};

const attendanceColors: { [key: string]: string } = {
    'حاضر': 'bg-green-500',
    'غائب': 'bg-red-500',
    'متأخر': 'bg-orange-400',
    'تعويض': 'bg-blue-500',
};

const behaviorColors: { [key: string]: string } = {
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

    const processedStats = useMemo(() => {
        const stats: ProcessedStats = {};
        students.forEach(student => {
            stats[student.id] = [];
        });

        Object.values(dailySessions).forEach(session => {
            if(session.sessionType === 'يوم عطلة') return;

            session.records.forEach(record => {
                if (stats[record.studentId]) {
                    stats[record.studentId].push({
                        date: session.date,
                        attendance: record.attendance,
                        behavior: record.behavior,
                        memorization: record.memorization,
                        notes: record.notes,
                        sessionType: session.sessionType
                    });
                }
            });
        });
        return stats;
    }, [dailySessions, students]);


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


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }
    
     if (students.length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة أو استيراد بيانات الطلبة أولاً من صفحة "البيانات".
                </p>
            </div>
        );
    }
    
    const studentToDisplay = selectedStudentId ? [students.find(s => s.id === selectedStudentId)] : activeStudents;

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
                                <SelectItem value="all">كل الطلبة</SelectItem>
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
                            <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset - 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                             <Button variant="outline" onClick={() => setWeekOffset(0)}>الأسبوع الحالي</Button>
                            <Button variant="outline" size="icon" onClick={() => setWeekOffset(weekOffset + 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <div className="grid grid-cols-8 gap-2 min-w-[800px]">
                             <div className="font-bold text-muted-foreground flex items-end pb-1">الطالب</div>
                             {weekDays.map(day => (
                                 <div key={day.toString()} className="text-center font-bold text-muted-foreground">
                                     <div>{format(day, 'EEEE', { locale: ar })}</div>
                                     <div>{format(day, 'd/M', { locale: ar })}</div>
                                 </div>
                             ))}

                            {studentToDisplay.map(student => {
                                if (!student) return null;
                                return (
                                <React.Fragment key={student.id}>
                                    <div className="font-medium flex items-center">{student.fullName}</div>
                                     {weekDays.map(day => {
                                         const dayStr = format(day, 'yyyy-MM-dd');
                                         const stat = processedStats[student.id]?.find(s => s.date === dayStr);
                                         
                                         if (!stat) {
                                            const holiday = Object.values(dailySessions).find(s => s.date === dayStr && s.sessionType === 'يوم عطلة');
                                            if (holiday) {
                                                return <DayCell key={dayStr} stat={{ date: dayStr, attendance: 'يوم عطلة', behavior: null, memorization: null, sessionType: 'يوم عطلة' }} />;
                                            }
                                            return <div key={dayStr} className="h-12 rounded-md bg-muted/20"></div>
                                         }
                                         
                                         return <DayCell key={dayStr} stat={stat} />;
                                     })}
                                </React.Fragment>
                            )})}
                        </div>
                    </CardContent>
                </Card>
                
                 <Card>
                    <CardHeader>
                        <CardTitle>مفتاح الدلالات</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-x-6 gap-y-4">
                        <div className="space-y-2">
                            <h4 className="font-semibold">الحضور</h4>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-500"></div><span>حاضر</span></div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-500"></div><span>غائب</span></div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-400"></div><span>متأخر</span></div>
                            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500"></div><span>تعويض</span></div>
                             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-gray-300"></div><span>يوم عطلة</span></div>
                        </div>
                        <div className="space-y-2">
                             <h4 className="font-semibold">السلوك (إطار الخلية)</h4>
                             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-blue-500"></div><span>هادئ</span></div>
                             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-yellow-500"></div><span>متوسط</span></div>
                             <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-md border-2 border-red-500"></div><span>غير منضبط</span></div>
                        </div>
                         <div className="space-y-2">
                             <h4 className="font-semibold">نوع الحصة (شارة)</h4>
                             <div className="flex items-center gap-2"><span className={cn("px-2 py-0.5 rounded-full text-xs", sessionTypeBadge['حصة أساسية'])}>حصة أساسية</span></div>
                             <div className="flex items-center gap-2"><span className={cn("px-2 py-0.5 rounded-full text-xs", sessionTypeBadge['حصة أنشطة'])}>حصة أنشطة</span></div>
                             <div className="flex items-center gap-2"><span className={cn("px-2 py-0.5 rounded-full text-xs", sessionTypeBadge['حصة تعويضية'])}>حصة تعويضية</span></div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}


function DayCell({ stat }: { stat: StudentStat }) {
    if (stat.attendance === 'يوم عطلة') {
        return (
             <Tooltip>
                <TooltipTrigger asChild>
                    <div className="h-12 rounded-md bg-gray-300 flex items-center justify-center text-white font-bold text-xs">
                        عطلة
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>يوم عطلة</p>
                </TooltipContent>
            </Tooltip>
        )
    }

    const attendanceColor = attendanceColors[stat.attendance] || 'bg-gray-200';
    const behaviorBorder = stat.behavior ? behaviorColors[stat.behavior] : 'border-transparent';

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn("h-12 rounded-md flex items-center justify-center p-1 text-white text-xs font-bold border-2", attendanceColor, behaviorBorder)}>
                   {stat.attendance}
                </div>
            </TooltipTrigger>
            <TooltipContent className="text-right" dir="rtl">
                <p><span className="font-bold">التاريخ:</span> {format(parseISO(stat.date), 'd MMMM yyyy', { locale: ar })}</p>
                <p><span className="font-bold">الحضور:</span> {stat.attendance}</p>
                {stat.memorization && <p><span className="font-bold">التقييم:</span> {stat.memorization}</p>}
                {stat.behavior && <p><span className="font-bold">السلوك:</span> {stat.behavior}</p>}
                {stat.notes && <p><span className="font-bold">ملاحظات:</span> {stat.notes}</p>}
                <p>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs", sessionTypeBadge[stat.sessionType])}>
                        {stat.sessionType}
                    </span>
                </p>
            </TooltipContent>
        </Tooltip>
    );
}

