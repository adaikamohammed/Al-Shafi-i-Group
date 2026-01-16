"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, ArrowLeft, ArrowRight, Calendar, CheckCircle, TrendingUp, Users } from 'lucide-react';
import { format, getYear, getDay, startOfYear, addDays, parseISO, getMonth, getDaysInMonth, startOfMonth, endOfMonth, getQuarter, setYear, setMonth, addMonths, subMonths, setQuarter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


// Helper function to get color based on day's data
const getDayColor = (dayData: any) => {
    if (!dayData) return 'bg-gray-200 dark:bg-gray-800'; // Default for no data
    if (dayData.isHoliday) return 'bg-blue-500';
    if (dayData.isSheikhAbsentNoSub) return 'bg-red-500';
    if (dayData.workSessionCount >= 2) return 'bg-green-700';
    if (dayData.workSessionCount === 1) return 'bg-green-300';
    return 'bg-gray-200 dark:bg-gray-800';
};

const DayTooltipContent = ({ day, dayData }: { day: Date, dayData: any }) => (
    <>
        <p className="font-bold">{format(day, 'd MMMM yyyy', { locale: ar })}</p>
        {dayData ? (
            <>
                {dayData.isHoliday ? (<p>يوم عطلة</p>)
                 : dayData.isSheikhAbsentNoSub ? (<p>غياب الشيخ</p>)
                 : (<>
                        <p>حصص العمل: {dayData.workSessionCount}</p>
                        <p>الحضور: {(dayData.attendanceRate * 100).toFixed(0)}%</p>
                    </>)}
            </>
        ) : <p>لا توجد بيانات</p>}
    </>
);


// YearView Component
const YearView = ({ year, data, onDayClick }: { year: number, data: any, onDayClick: (date: Date) => void }) => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const daysInYear = getYear(yearStart) % 4 === 0 && (getYear(yearStart) % 100 !== 0 || getYear(yearStart) % 400 === 0) ? 366 : 365;
    const days = Array.from({ length: daysInYear }, (_, i) => addDays(yearStart, i));
    const firstDayOfWeek = getDay(yearStart); // Sunday is 0
    const startDayIndex = (firstDayOfWeek + 1) % 7; // Adjust for Saturday start

    return (
        <div className="grid grid-cols-53 gap-1.5" style={{ direction: 'rtl' }}>
            {Array.from({ length: startDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
                const dateString = format(day, 'yyyy-MM-dd');
                const dayData = data[dateString];
                const colorClass = getDayColor(dayData);

                return (
                    <Tooltip key={dateString}>
                        <TooltipTrigger asChild>
                            <div className={cn("w-4 h-4 rounded", colorClass)} onClick={() => onDayClick(day)} />
                        </TooltipTrigger>
                        <TooltipContent><DayTooltipContent day={day} dayData={dayData} /></TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
};

// QuarterView Component
const QuarterView = ({ year, quarter, data, onDayClick }: { year: number, quarter: number, data: any, onDayClick: (date: Date) => void }) => {
    const startMonth = (quarter - 1) * 3;
    const months = [startMonth, startMonth + 1, startMonth + 2];
    
    return (
        <div className="space-y-4">
            {months.map(monthIndex => {
                const monthStart = startOfMonth(new Date(year, monthIndex));
                const daysInMonth = getDaysInMonth(monthStart);
                const firstDay = getDay(monthStart);
                const startDayIndex = (firstDay + 1) % 7; // Saturday start
                const days = Array.from({length: daysInMonth}, (_, i) => addDays(monthStart, i));

                return (
                    <div key={monthIndex}>
                        <h3 className="text-lg font-bold mb-2">{format(monthStart, 'MMMM yyyy', {locale: ar})}</h3>
                        <div className="grid grid-cols-7 gap-2">
                             {Array.from({ length: startDayIndex }).map((_, i) => <div key={`empty-${monthIndex}-${i}`} />)}
                             {days.map(day => {
                                 const dateString = format(day, 'yyyy-MM-dd');
                                 const dayData = data[dateString];
                                 const colorClass = getDayColor(dayData);
                                 return (
                                     <Tooltip key={dateString}>
                                         <TooltipTrigger asChild>
                                             <div className={cn("w-8 h-8 rounded-md", colorClass)} onClick={() => onDayClick(day)} />
                                         </TooltipTrigger>
                                         <TooltipContent><DayTooltipContent day={day} dayData={dayData} /></TooltipContent>
                                     </Tooltip>
                                 );
                             })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// MonthView Component
const MonthView = ({ year, month, data, onDayClick }: { year: number, month: number, data: any, onDayClick: (date: Date) => void }) => {
    const monthStart = startOfMonth(new Date(year, month));
    const daysInMonth = getDaysInMonth(monthStart);
    const firstDay = getDay(monthStart);
    const startDayIndex = (firstDay + 1) % 7; // Saturday start
    const dayCells = [];
    
    const weekdays = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    
    for (let i = 0; i < startDayIndex; i++) {
        dayCells.push(<div key={`empty-${i}`} className="border rounded-lg bg-muted/20" />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const dateString = format(day, 'yyyy-MM-dd');
        const dayData = data[dateString];
        const colorClass = getDayColor(dayData);
        dayCells.push(
            <Tooltip key={dateString}>
                <TooltipTrigger asChild>
                    <div className={cn("w-full h-20 rounded-lg p-2 border-2 text-right flex flex-col justify-between cursor-pointer", colorClass)} onClick={() => onDayClick(day)}>
                        <span className="font-bold text-lg">{i}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent><DayTooltipContent day={day} dayData={dayData} /></TooltipContent>
            </Tooltip>
        );
    }
    
    return (
        <div className="grid grid-cols-7 gap-2">
            {weekdays.map(day => <div key={day} className="text-center font-semibold text-muted-foreground pb-2">{day}</div>)}
            {dayCells}
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
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');
    
    const currentYear = getYear(currentDate);

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

            const isHoliday = sessionsOnDay.some(s => s.sessionType === 'يوم عطلة');
            const isSheikhAbsentNoSub = sessionsOnDay.some(s => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher);
            const workSessions = sessionsOnDay.filter(s => s.sessionType !== 'يوم عطلة' && !(s.sessionType === 'غياب الشيخ' && !s.substituteTeacher));
            
            let attendanceRate = 0;
            if (!isHoliday && !isSheikhAbsentNoSub && workSessions.length > 0) {
                stats.workDays.add(dateString);
                
                workSessions.forEach(s => {
                    if (s.sessionType === 'حصة تعويضية') stats.extraSessions++;
                    stats.totalSessions++;
                });

                const allRecords = workSessions.flatMap(s => s.records || []);
                const attendanceCount = allRecords.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
                const totalPossibleAttendancesForDay = activeStudentsCount * workSessions.length;

                attendanceRate = totalPossibleAttendancesForDay > 0 ? attendanceCount / totalPossibleAttendancesForDay : 0;
                stats.totalAttendance += attendanceCount;
                stats.totalPossibleAttendance += totalPossibleAttendancesForDay;
            }

            data[dateString] = {
                isHoliday,
                isSheikhAbsentNoSub,
                workSessionCount: workSessions.length,
                attendanceRate,
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
    
    const handleDateNavigation = (direction: 'prev' | 'next') => {
        const amount = direction === 'next' ? 1 : -1;
        if (viewMode === 'year') {
            setCurrentDate(d => setYear(d, getYear(d) + amount));
        } else if (viewMode === 'month') {
            setCurrentDate(d => addMonths(d, amount));
        } else if (viewMode === 'quarter') {
             setCurrentDate(d => addMonths(d, amount * 3));
        }
    };
    
    const handleSetQuarter = (q: number) => {
        const newMonth = (q - 1) * 3;
        setCurrentDate(current => setMonth(current, newMonth));
    }


    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    const currentMonth = getMonth(currentDate);
    const currentQuarter = getQuarter(currentDate);

    let viewTitle = `${currentYear}`;
    if (viewMode === 'month') viewTitle = format(currentDate, 'MMMM yyyy', {locale: ar});
    if (viewMode === 'quarter') viewTitle = `الربع ${currentQuarter} - ${currentYear}`;

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
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={() => handleDateNavigation('prev')}><ArrowRight className="h-4 w-4" /></Button>
                                    <span className="font-semibold text-lg w-32 text-center">{viewTitle}</span>
                                    <Button variant="outline" size="icon" onClick={() => handleDateNavigation('next')}><ArrowLeft className="h-4 w-4" /></Button>
                                </div>
                                
                                <div className="flex-1 flex justify-center">
                                    {viewMode === 'quarter' && (
                                        <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                                            <Button variant={currentQuarter === 1 ? 'secondary' : 'ghost'} onClick={() => handleSetQuarter(1)} className="h-8 px-2 text-xs">الربع 1</Button>
                                            <Button variant={currentQuarter === 2 ? 'secondary' : 'ghost'} onClick={() => handleSetQuarter(2)} className="h-8 px-2 text-xs">الربع 2</Button>
                                            <Button variant={currentQuarter === 3 ? 'secondary' : 'ghost'} onClick={() => handleSetQuarter(3)} className="h-8 px-2 text-xs">الربع 3</Button>
                                            <Button variant={currentQuarter === 4 ? 'secondary' : 'ghost'} onClick={() => handleSetQuarter(4)} className="h-8 px-2 text-xs">الربع 4</Button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                                   <Button variant={viewMode === 'year' ? 'secondary' : 'ghost'} onClick={() => setViewMode('year')} className="h-8 px-3">سنوي</Button>
                                   <Button variant={viewMode === 'quarter' ? 'secondary' : 'ghost'} onClick={() => setViewMode('quarter')} className="h-8 px-3">فصلي</Button>
                                   <Button variant={viewMode === 'month' ? 'secondary' : 'ghost'} onClick={() => setViewMode('month')} className="h-8 px-3">شهري</Button>
                                </div>
                            </div>

                            {viewMode === 'year' && <YearView year={currentYear} data={yearlyData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} />}
                            {viewMode === 'quarter' && <QuarterView year={currentYear} quarter={currentQuarter} data={yearlyData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} />}
                            {viewMode === 'month' && <MonthView year={currentYear} month={currentMonth} data={yearlyData} onDayClick={(date) => console.log(date)} />}

                            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
                                <span className="flex items-center gap-2">جهد أقل</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-300"></div></span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-green-700"></div></span>
                                <span className="flex items-center gap-2">جهد أعلى</span>
                                <span className="flex items-center gap-2 font-semibold ml-4">|</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-red-500"></div>غياب الشيخ</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-blue-500"></div>عطلة</span>
                                <span className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-gray-200"></div>يوم فارغ</span>
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
