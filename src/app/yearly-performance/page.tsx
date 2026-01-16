"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, ArrowLeft, ArrowRight, Calendar, CheckCircle, TrendingUp, Users } from 'lucide-react';
import { format, getYear, getDay, startOfYear, addDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const YearView = ({ year, data, onDayClick }: { year: number, data: any, onDayClick: (date: Date) => void }) => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const daysInYear = getYear(yearStart) % 4 === 0 && (getYear(yearStart) % 100 !== 0 || getYear(yearStart) % 400 === 0) ? 366 : 365;
    const days = Array.from({ length: daysInYear }, (_, i) => addDays(yearStart, i));
    const firstDay = getDay(yearStart);
    const startDayIndex = (firstDay + 1) % 7;

    return (
        <div className="grid grid-cols-53 gap-1" style={{ direction: 'rtl' }}>
            {Array.from({ length: startDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
                const dateString = format(day, 'yyyy-MM-dd');
                const dayData = data[dateString];
                let colorClass = 'bg-gray-200 dark:bg-gray-800'; // Default for no data

                if (dayData) {
                    if (dayData.sessionType === 'يوم عطلة' || (dayData.sessionType === 'غياب الشيخ' && !dayData.hasSubstitute)) {
                        colorClass = 'bg-blue-300';
                    } else if (dayData.sessionType === 'حصة تعويضية') {
                        colorClass = 'bg-yellow-400';
                    } else if (dayData.attendanceRate >= 0.9) {
                        colorClass = 'bg-green-600';
                    } else if (dayData.attendanceRate >= 0.7) {
                        colorClass = 'bg-green-500';
                    } else if (dayData.attendanceRate > 0.5) {
                        colorClass = 'bg-green-400';
                    } else if (dayData.attendanceRate > 0) {
                        colorClass = 'bg-orange-400';
                    } else {
                        colorClass = 'bg-red-500';
                    }
                }

                return (
                    <Tooltip key={dateString}>
                        <TooltipTrigger asChild>
                            <div
                                className={cn("w-4 h-4 rounded-sm", colorClass)}
                                onClick={() => onDayClick(day)}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="font-bold">{format(day, 'd MMMM yyyy', { locale: ar })}</p>
                            {dayData ? (
                                <>
                                    <p>نوع الحصة: {dayData.sessionType}</p>
                                    <p>الحضور: {(dayData.attendanceRate * 100).toFixed(0)}%</p>
                                    <p>تقييم ممتاز: {dayData.excellentCount}</p>
                                    <p>سلوك غير منضبط: {dayData.undisciplinedCount}</p>
                                </>
                            ) : <p>لا توجد بيانات</p>}
                        </TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
};

const StatWidget = ({ title, value, unit, icon }: { title: string, value: string | number, unit: string, icon: React.ReactNode }) => (
    <div className="flex items-center p-4 bg-muted rounded-lg">
        <div className="mr-4">{icon}</div>
        <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value} <span className="text-sm font-normal">{unit}</span></p>
        </div>
    </div>
);

export default function YearlyPerformancePage() {
    const { students, dailySessions, loading } = useStudentContext();
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');

    const { yearlyData, annualStats } = useMemo(() => {
        const data: any = {};
        const stats = {
            totalSessions: 0,
            extraSessions: 0,
            workDays: new Set<string>(),
            totalAttendance: 0,
            totalPossibleAttendance: 0,
        };
        if (!dailySessions || !students) return { yearlyData: data, annualStats: { commitmentRate: 0, extraSessions: 0, netWorkDays: 0 } };

        const activeStudentsCount = students.filter(s => s.status === 'نشط').length;
        if(activeStudentsCount === 0) return { yearlyData: data, annualStats: { commitmentRate: 0, extraSessions: 0, netWorkDays: 0 } };

        const yearSessions = Object.keys(dailySessions)
            .filter(dateString => getYear(parseISO(dateString)) === currentYear)
            .reduce((obj, key) => {
                obj[key] = dailySessions[key];
                return obj;
            }, {} as typeof dailySessions);

        Object.keys(yearSessions).forEach(dateString => {
            const sessionsOnDay = Object.values(yearSessions[dateString]);
            if (sessionsOnDay.length === 0) return;

            const primarySession = sessionsOnDay[0];
            const sessionType = primarySession.sessionType;
            let attendanceRate = 0;
            let excellentCount = 0;
            let undisciplinedCount = 0;

            if (!(sessionType === 'يوم عطلة' || (sessionType === 'غياب الشيخ' && !primarySession.substituteTeacher))) {
                stats.workDays.add(dateString);
                
                sessionsOnDay.forEach(s => {
                    if (s.sessionType === 'حصة تعويضية') stats.extraSessions++;
                    if (s.sessionType !== 'يوم عطلة') stats.totalSessions++;
                });

                const allRecords = sessionsOnDay.flatMap(s => s.records || []);
                const attendanceCount = allRecords.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
                const totalPossibleAttendancesForDay = activeStudentsCount * sessionsOnDay.filter(s => s.sessionType !== 'يوم عطلة').length;

                attendanceRate = totalPossibleAttendancesForDay > 0 ? attendanceCount / totalPossibleAttendancesForDay : 0;
                stats.totalAttendance += attendanceCount;
                stats.totalPossibleAttendance += totalPossibleAttendancesForDay;
                excellentCount = allRecords.filter(r => r.memorization === 'ممتاز').length;
                undisciplinedCount = allRecords.filter(r => r.behavior === 'غير منضبط').length;
            }

            data[dateString] = {
                sessionType: sessionType,
                hasSubstitute: !!primarySession.substituteTeacher,
                attendanceRate,
                excellentCount,
                undisciplinedCount
            };
        });

        const commitmentRate = stats.totalPossibleAttendance > 0 ? (stats.totalAttendance / stats.totalPossibleAttendance) * 100 : 0;

        return { 
            yearlyData: data, 
            annualStats: {
                commitmentRate: commitmentRate.toFixed(0),
                extraSessions: stats.extraSessions,
                netWorkDays: stats.workDays.size,
            }
        };
    }, [dailySessions, students, currentYear]);

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <TooltipProvider>
            <div className="space-y-6 w-full">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl font-headline font-bold">رادار الأداء السنوي</CardTitle>
                        <CardDescription>نظرة شاملة على التزام وأداء الفوج على مدار العام. كل مربع يمثل يوماً.</CardDescription>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y - 1)}><ArrowRight className="h-4 w-4" /></Button>
                                    <span className="font-semibold text-lg">{currentYear}</span>
                                    <Button variant="outline" size="icon" onClick={() => setCurrentYear(y => y + 1)}><ArrowLeft className="h-4 w-4" /></Button>
                                </div>
                                <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                                   <Button variant={viewMode === 'year' ? 'secondary' : 'ghost'} onClick={() => setViewMode('year')} className="h-8 px-3">عرض سنوي</Button>
                                   <Button variant={viewMode === 'quarter' ? 'secondary' : 'ghost'} onClick={() => setViewMode('quarter')} className="h-8 px-3" disabled>عرض فصلي (قريباً)</Button>
                                   <Button variant={viewMode === 'month' ? 'secondary' : 'ghost'} onClick={() => setViewMode('month')} className="h-8 px-3" disabled>عرض شهري (قريباً)</Button>
                                </div>
                            </div>

                            {viewMode === 'year' && <YearView year={currentYear} data={yearlyData} onDayClick={(date) => console.log(date)} />}

                            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
                                <span className="flex items-center gap-2">أقل</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-orange-400"></div></span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-green-400"></div></span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-green-500"></div></span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-green-600"></div></span>
                                <span className="flex items-center gap-2">أكثر</span>
                                <span className="flex items-center gap-2 font-semibold ml-4">|</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-red-500"></div>غياب كلي</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-blue-300"></div>عطلة/غياب شيخ</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-yellow-400"></div>حصة إضافية</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded-sm bg-gray-200"></div>يوم فارغ</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>الإحصائيات السنوية</CardTitle>
                                <CardDescription>ملخص أداء الفوج لسنة {currentYear}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <StatWidget 
                                   title="معدل الالتزام السنوي"
                                   value={annualStats.commitmentRate}
                                   unit="%"
                                   icon={<CheckCircle className="h-8 w-8 text-green-500"/>}
                               />
                               <StatWidget 
                                   title="صافي أيام العمل"
                                   value={annualStats.netWorkDays}
                                   unit="يوم"
                                   icon={<Calendar className="h-8 w-8 text-blue-500"/>}
                               />
                               <StatWidget 
                                   title="حصص إضافية وتعويضية"
                                   value={annualStats.extraSessions}
                                   unit="حصة"
                                   icon={<TrendingUp className="h-8 w-8 text-indigo-500"/>}
                               />
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
