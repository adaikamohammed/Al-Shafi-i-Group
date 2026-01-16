
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, ArrowLeft, ArrowRight, Calendar, BarChart, CheckCircle, XCircle, Users } from 'lucide-react';
import { format, getYear, getMonth, getDay, startOfYear, addDays, eachDayOfInterval, getWeek, getISOWeek, startOfISOWeek, endOfISOWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';


const YearView = ({ year, data, onDayClick }: { year: number, data: any, onDayClick: (date: Date) => void }) => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const days = Array.from({ length: 366 }, (_, i) => addDays(yearStart, i)).filter(d => getYear(d) === year);
    const firstDay = getDay(yearStart);

    return (
        <div className="grid grid-cols-53 gap-1" style={{direction: 'rtl'}}>
            {Array.from({length: firstDay}).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
                const dateString = format(day, 'yyyy-MM-dd');
                const dayData = data[dateString];
                let colorClass = 'bg-gray-200 dark:bg-gray-800';
                if(dayData) {
                    if (dayData.attendanceRate > 0.9) colorClass = 'bg-green-600';
                    else if (dayData.attendanceRate > 0.7) colorClass = 'bg-green-400';
                    else if (dayData.attendanceRate > 0.5) colorClass = 'bg-yellow-400';
                    else if (dayData.attendanceRate > 0) colorClass = 'bg-orange-400';
                    else if (dayData.sessionType === 'يوم عطلة' || dayData.sessionType === 'غياب الشيخ') colorClass = 'bg-blue-300';
                    else colorClass = 'bg-red-500';
                }

                return (
                    <TooltipProvider key={dateString}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div 
                                    className={cn("w-4 h-4 rounded-sm", colorClass)}
                                    onClick={() => onDayClick(day)}
                                />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-bold">{format(day, 'd MMMM yyyy', {locale: ar})}</p>
                                {dayData ? (
                                    <>
                                        <p>الحضور: {(dayData.attendanceRate * 100).toFixed(0)}%</p>
                                        <p>تقييم ممتاز: {dayData.excellentCount}</p>
                                        <p>سلوك غير منضبط: {dayData.undisciplinedCount}</p>
                                    </>
                                ) : <p>لا توجد بيانات</p>}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )
            })}
        </div>
    )
}

export default function YearlyPerformancePage() {
    const { students, dailySessions, loading } = useStudentContext();
    const { isSuperAdmin } = useAuth();
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');
    
    const yearlyData = useMemo(() => {
        const data: any = {};
        if (!dailySessions) return data;

        Object.keys(dailySessions).forEach(dateString => {
            const sessions = Object.values(dailySessions[dateString]);
            if(sessions.length === 0) return;

            const totalRecords = sessions.flatMap(s => s.records || []);
            const activeStudentsToday = students.filter(s => s.status === 'نشط').length;
            
            if(activeStudentsToday === 0) return;

            const sessionType = sessions[0].sessionType;
            if(sessionType === 'يوم عطلة' || sessionType === 'غياب الشيخ') {
                 data[dateString] = {
                    sessionType: sessionType,
                    attendanceRate: 0, excellentCount: 0, undisciplinedCount: 0
                };
                return;
            }

            const attendanceCount = totalRecords.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
            const excellentCount = totalRecords.filter(r => r.memorization === 'ممتاز').length;
            const undisciplinedCount = totalRecords.filter(r => r.behavior === 'غير منضبط').length;

            data[dateString] = {
                sessionType: sessionType,
                attendanceRate: attendanceCount / (activeStudentsToday * sessions.length),
                excellentCount,
                undisciplinedCount
            };
        });
        return data;

    }, [dailySessions, students]);


    if(loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6 w-full">
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold">رادار الأداء السنوي</CardTitle>
                    <CardDescription>نظرة شاملة على التزام وأداء الفوج على مدار العام. كل مربع يمثل يوماً.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                        <div className="flex items-center gap-2">
                             <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y - 1)}><ArrowRight className="h-4 w-4" /></Button>
                             <span className="font-semibold text-lg">{currentYear}</span>
                             <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y + 1)}><ArrowLeft className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                           <Button variant={viewMode === 'year' ? 'secondary' : 'ghost'} onClick={() => setViewMode('year')} className="h-8 px-3">عرض سنوي</Button>
                           <Button variant={viewMode === 'quarter' ? 'secondary' : 'ghost'} onClick={() => setViewMode('quarter')} className="h-8 px-3">عرض فصلي</Button>
                           <Button variant={viewMode === 'month' ? 'secondary' : 'ghost'} onClick={() => setViewMode('month')} className="h-8 px-3">عرض شهري</Button>
                        </div>
                    </div>

                    {viewMode === 'year' && <YearView year={currentYear} data={yearlyData} onDayClick={(date) => console.log(date)} />}

                    <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
                        <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-gray-200 border"></div>أقل</span>
                        <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-orange-400"></div></span>
                        <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-yellow-400"></div></span>
                        <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-green-400"></div></span>
                        <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-green-600"></div>أكثر</span>
                        <span className="flex items-center gap-2 font-semibold ml-4">|</span>
                        <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-red-500"></div>غياب كلي</span>
                        <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-blue-300"></div>عطلة/غياب شيخ</span>
                    </div>

                 </CardContent>
            </Card>
        </div>
    )
}
