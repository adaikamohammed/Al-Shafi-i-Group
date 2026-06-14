
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentContext } from '@/context/StudentContext';
import {
    Loader2, ArrowLeft, ArrowRight, Calendar, CheckCircle, TrendingUp, Users, CalendarX,
    BookOpen, PlusCircle, Activity, Coffee, UserX, UserCheck, Star, Zap, Target,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { format, getYear, getDay, startOfYear, addDays, parseISO, getMonth, getDaysInMonth, startOfMonth, endOfMonth, getQuarter, setYear, setMonth, addMonths, subMonths, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { DailySession } from '@/lib/types';


// Helper function to get color based on day's data
const getDayColor = (dayData: any) => {
    if (!dayData) return 'bg-gray-100 dark:bg-gray-800/40 border-transparent'; // Default for no data
    if (dayData.isHoliday) return 'bg-blue-400 border-blue-500';
    if (dayData.isSheikhAbsentNoSub) return 'bg-red-400 border-red-500';
    if (dayData.isSheikhAbsentWithSub) return 'bg-purple-400 border-purple-500';
    if (dayData.workSessionCount >= 2) return 'bg-emerald-600 border-emerald-700';
    if (dayData.workSessionCount === 1) return 'bg-emerald-400 border-emerald-500';
    return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';
};

const DayTooltipContent = ({ day, dayData }: { day: Date, dayData: any }) => {
    const formattedDate = format(day, 'd MMMM yyyy', { locale: ar });

    if (!dayData) {
        return <p className="font-bold">{formattedDate}<br />لا توجد بيانات</p>;
    }

    if (dayData.isHoliday) {
        return <p className="font-bold">{formattedDate}<br />ملخص: يوم عطلة</p>;
    }

    if (dayData.isSheikhAbsentNoSub) {
        return <p className="font-bold">{formattedDate}<br />ملخص: غياب الشيخ (بدون بديل)</p>;
    }

    if (dayData.isSheikhAbsentWithSub) {
        return <p className="font-bold">{formattedDate}<br />ملخص: غياب الشيخ (مع وجود بديل)</p>;
    }

    const sessionTypesString = dayData.sessionTypes?.join(' + ') || 'غير محدد';

    return (
        <div className="space-y-1 text-right">
            <p className="font-bold">{formattedDate}</p>
            <p className="text-xs">عدد الحصص: {dayData.workSessionCount} ({sessionTypesString})</p>
            <p className="text-xs">الملخص: تم إنجاز الورد بنسبة حضور {(dayData.attendanceRate * 100).toFixed(0)}%</p>
        </div>
    );
};


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
                            <div className={cn("w-4 h-4 rounded cursor-pointer transition-all hover:scale-125", colorClass)} onClick={() => onDayClick(day)} />
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
                const days = Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));

                return (
                    <div key={monthIndex}>
                        <h3 className="text-lg font-bold mb-2">{format(monthStart, 'MMMM yyyy', { locale: ar })}</h3>
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: startDayIndex }).map((_, i) => <div key={`empty-${monthIndex}-${i}`} />)}
                            {days.map(day => {
                                const dateString = format(day, 'yyyy-MM-dd');
                                const dayData = data[dateString];
                                const colorClass = getDayColor(dayData);
                                return (
                                    <Tooltip key={dateString}>
                                        <TooltipTrigger asChild>
                                            <div className={cn("w-8 h-8 rounded-md cursor-pointer transition-all hover:scale-110", colorClass)} onClick={() => onDayClick(day)} />
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
                    <div className={cn("w-full h-20 rounded-lg p-2 border-2 text-right flex flex-col justify-between cursor-pointer transition-all hover:border-primary/50", colorClass)} onClick={() => onDayClick(day)}>
                        <span className="font-bold text-lg">{i}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent><DayTooltipContent day={day} dayData={dayData} /></TooltipContent>
            </Tooltip>
        );
    }

    return (
        <div className="grid grid-cols-7 gap-2 text-right" dir="rtl">
            {weekdays.map(day => <div key={day} className="text-center font-semibold text-muted-foreground pb-2">{day}</div>)}
            {dayCells}
        </div>
    );
};


const StatWidget = ({ title, value, unit, icon, description, variant = "default" }: { title: string, value: string | number, unit: string, icon: React.ReactNode, description?: string, variant?: 'default' | 'emerald' | 'blue' | 'indigo' | 'orange' | 'red' | 'purple' }) => {
    const variants = {
        default: "bg-muted/50 border-muted-foreground/10",
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-900",
        blue: "bg-blue-50 border-blue-100 text-blue-900",
        indigo: "bg-indigo-50 border-indigo-100 text-indigo-900",
        orange: "bg-orange-50 border-orange-100 text-orange-900",
        red: "bg-red-50 border-red-100 text-red-900",
        purple: "bg-purple-50 border-purple-100 text-purple-900",
    };

    const iconColors = {
        default: "text-muted-foreground",
        emerald: "text-emerald-500",
        blue: "text-blue-500",
        indigo: "text-indigo-500",
        orange: "text-orange-500",
        red: "text-red-500",
        purple: "text-purple-500",
    };

    return (
        <div className={cn("flex flex-col p-4 rounded-xl border shadow-sm transition-all hover:shadow-md", variants[variant])}>
            <div className="flex items-center justify-between mb-2">
                <div className={cn("p-2 rounded-lg bg-background/50", iconColors[variant])}>{icon}</div>
                <div className="text-left font-bold text-2xl">
                    {value} <span className="text-[10px] uppercase font-normal text-muted-foreground">{unit}</span>
                </div>
            </div>
            <div className="text-right">
                <p className="text-xs font-bold opacity-80">{title}</p>
                {description && <p className="text-[10px] opacity-60 mt-0.5">{description}</p>}
            </div>
        </div>
    );
};

export default function YearlyPerformancePage() {
    const { user: authUser, isSuperAdmin, isManagement } = useAuth();
    const { students: allContextStudents, dailySessions: allContextSessions, allUsers, loading } = useStudentContext();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');
    const [selectedSheikhId, setSelectedSheikhId] = useState<string>('sheikhs');

    const isAdmin = isSuperAdmin || isManagement;

    // Filter students and sessions based on selected sheikh
    const students = useMemo(() => {
        if (!isAdmin || selectedSheikhId === 'all') return allContextStudents;
        
        let selectedIds: string[] = [];
        if (selectedSheikhId === 'sheikhs') {
            selectedIds = allUsers
                .filter(u => {
                    const num = parseInt(u.group?.replace(/\D/g, '') || '0');
                    return (num >= 1 && num <= 9) || num === 20;
                })
                .map(u => u.uid);
        } else if (selectedSheikhId === 'ustadhat') {
            selectedIds = allUsers
                .filter(u => {
                    const num = parseInt(u.group?.replace(/\D/g, '') || '0');
                    return (num >= 10 && num <= 18) || num === 19;
                })
                .map(u => u.uid);
        } else {
            selectedIds = selectedSheikhId.split(',');
        }
        
        return allContextStudents.filter(s => selectedIds.includes(s.ownerId));
    }, [allContextStudents, isAdmin, selectedSheikhId, allUsers]);

    const dailySessions = useMemo(() => {
        if (!isAdmin || selectedSheikhId === 'all') return allContextSessions;
        
        let selectedIds: string[] = [];
        if (selectedSheikhId === 'sheikhs') {
            selectedIds = allUsers
                .filter(u => {
                    const num = parseInt(u.group?.replace(/\D/g, '') || '0');
                    return (num >= 1 && num <= 9) || num === 20;
                })
                .map(u => u.uid);
        } else if (selectedSheikhId === 'ustadhat') {
            selectedIds = allUsers
                .filter(u => {
                    const num = parseInt(u.group?.replace(/\D/g, '') || '0');
                    return (num >= 10 && num <= 18) || num === 19;
                })
                .map(u => u.uid);
        } else {
            selectedIds = selectedSheikhId.split(',');
        }

        const filtered: Record<string, Record<string, DailySession>> = {};
        Object.entries(allContextSessions).forEach(([date, sessions]) => {
            const sessionsForSheikh = Object.entries(sessions)
                .filter(([_, session]) => session.ownerId && selectedIds.includes(session.ownerId))
                .reduce((acc, [id, s]) => ({ ...acc, [id]: s }), {});

            if (Object.keys(sessionsForSheikh).length > 0) {
                filtered[date] = sessionsForSheikh;
            }
        });
        return filtered;
    }, [allContextSessions, isAdmin, selectedSheikhId, allUsers]);

    const sheikhOptions: SearchableSelectOption[] = useMemo(() => {
        const options: SearchableSelectOption[] = [
            { value: 'sheikhs', label: 'أفواج المشايخ' },
            { value: 'ustadhat', label: 'أفواج الأستاذات' },
            { value: 'all', label: 'كل أفواج المدرسة (عرض شامل)' }
        ];
        if (!allUsers) return options;

        const sheikhs = allUsers.filter(u => u.role === 'sheikh' || u.role === 'management' || u.role === 'super_admin');
        
        const groupsMap = new Map<string, typeof sheikhs>();
        const others: typeof sheikhs = [];

        sheikhs.forEach(s => {
            const nameToTest = s.group || s.displayName || '';
            const match = nameToTest.match(/فوج\s*(\d+)/i);
            
            if (match) {
                const foujName = `فوج ${match[1]}`;
                if (!groupsMap.has(foujName)) groupsMap.set(foujName, []);
                groupsMap.get(foujName)!.push(s);
            } else {
                others.push(s);
            }
        });

        // Sort from Fouj 1 to Fouj X
        const sortedFoujs = Array.from(groupsMap.keys()).sort((a, b) => {
            const numA = parseInt(a.replace(/[^\d]/g, '')) || 0;
            const numB = parseInt(b.replace(/[^\d]/g, '')) || 0;
            return numA - numB;
        });

        sortedFoujs.forEach(fouj => {
            const grpSheikhs = groupsMap.get(fouj)!;
            const teacherNames = grpSheikhs
                .map(s => {
                    let name = s.displayName?.trim() || s.email || '';
                    return name.replace(/فوج\s*\d+/ig, '').replace(/[-_\|]/g, '').trim();
                })
                .filter(name => name.length > 0)
                .filter((v, i, a) => a.indexOf(v) === i)
                .join(' و ');

            const label = teacherNames ? `${fouj} - ${teacherNames}` : fouj;
            const combinedUids = grpSheikhs.map(s => s.uid).filter((v, i, a) => a.indexOf(v) === i).join(',');
            options.push({ value: combinedUids, label });
        });

        // Append remaining teachers who don't have "Fouj" in their name
        others.forEach(s => {
            if (s.displayName?.match(/Super Admin/i)) return; 
            options.push({ value: s.uid, label: s.displayName || s.email || s.uid });
        });

        return options;
    }, [allUsers]);

    const currentYear = getYear(currentDate);

    const { yearlyData } = useMemo(() => {
        const data: any = {};
        if (!dailySessions) return { yearlyData: data };

        const yearSessions = Object.keys(dailySessions)
            .filter(dateString => {
                try {
                    return getYear(parseISO(dateString)) === currentYear;
                } catch (e) { return false; }
            })
            .reduce((obj, key) => {
                obj[key] = dailySessions[key];
                return obj;
            }, {} as typeof dailySessions);

        Object.keys(yearSessions).forEach(dateString => {
            const sessionsOnDay = Object.values(yearSessions[dateString]);
            if (sessionsOnDay.length === 0) return;

            const isHoliday = sessionsOnDay.some(s => s.sessionType === 'يوم عطلة');
            const isSheikhAbsentNoSub = sessionsOnDay.some(s => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher);
            const isSheikhAbsentWithSub = sessionsOnDay.some(s => s.sessionType === 'غياب الشيخ' && s.substituteTeacher);
            const workSessions = sessionsOnDay.filter(s => s.sessionType !== 'يوم عطلة' && !(s.sessionType === 'غياب الشيخ' && !s.substituteTeacher));

            let attendanceRate = 0;
            if (!isHoliday && !isSheikhAbsentNoSub && workSessions.length > 0) {
                const activeStudentsCount = (students || []).filter(s => s.status === 'نشط').length;
                if (activeStudentsCount > 0) {
                    const allRecords = workSessions.flatMap(s => s.records || []);
                    const attendanceCount = allRecords.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
                    const totalPossibleAttendancesForDay = activeStudentsCount * workSessions.length;
                    attendanceRate = totalPossibleAttendancesForDay > 0 ? attendanceCount / totalPossibleAttendancesForDay : 0;
                }
            }

            data[dateString] = {
                isHoliday,
                isSheikhAbsentNoSub,
                isSheikhAbsentWithSub,
                workSessionCount: workSessions.length,
                attendanceRate,
                sessionTypes: workSessions.map(s => s.sessionType)
            };
        });

        return { yearlyData: data };
    }, [dailySessions, students, currentYear]);

    const { periodStats, statsTitle } = useMemo(() => {
        const emptyStats = {
            attendanceRate: "0",
            accomplishmentRate: "0",
            basicSessions: 0,
            extraSessions: 0,
            activitySessions: 0,
            holidays: 0,
            sheikhAbsenceNoSub: 0,
            sheikhAbsenceWithSub: 0,
            netWorkDays: 0,
            totalWorkSessions: 0
        };

        if (!dailySessions || !students) return { periodStats: emptyStats, statsTitle: '' };

        const activeStudentsCount = students.filter(s => s.status === 'نشط').length;
        if (activeStudentsCount === 0) return { periodStats: emptyStats, statsTitle: '' };

        let startDate: Date;
        let endDate: Date;
        let title: string;

        const currentYear = getYear(currentDate);
        const currentQuarter = getQuarter(currentDate);

        switch (viewMode) {
            case 'year':
                startDate = startOfYear(currentDate);
                endDate = endOfYear(currentDate);
                title = `الإحصائيات السنوية لسنة ${currentYear}`;
                break;
            case 'quarter':
                const startQuarterMonth = (currentQuarter - 1) * 3;
                startDate = startOfMonth(setMonth(new Date(currentYear, 0), startQuarterMonth));
                endDate = endOfMonth(setMonth(new Date(currentYear, 0), startQuarterMonth + 2));
                title = `إحصائيات الربع ${currentQuarter} - ${currentYear}`;
                break;
            case 'month':
            default:
                startDate = startOfMonth(currentDate);
                endDate = endOfMonth(currentDate);
                title = `إحصائيات شهر ${format(currentDate, 'MMMM yyyy', { locale: ar })}`;
                break;
        }

        const stats = {
            basicSessions: 0,
            extraSessions: 0,
            activitySessions: 0,
            holidays: 0,
            sheikhAbsenceNoSub: 0,
            sheikhAbsenceWithSub: 0,
            workDays: new Set<string>(),
            totalAttendance: 0,
            totalPossibleAttendance: 0,
            totalWorkSessions: 0,
        };

        Object.keys(dailySessions).forEach(dateString => {
            try {
                const sessionDate = parseISO(dateString);
                if (sessionDate >= startDate && sessionDate <= endDate) {
                    const sessionsOnDay = Object.values(dailySessions[dateString]);

                    // إحصائيات عامة لليوم
                    if (sessionsOnDay.some(s => s.sessionType === 'يوم عطلة')) stats.holidays++;
                    if (sessionsOnDay.some(s => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher)) stats.sheikhAbsenceNoSub++;
                    if (sessionsOnDay.some(s => s.sessionType === 'غياب الشيخ' && s.substituteTeacher)) stats.sheikhAbsenceWithSub++;

                    const workSessions = sessionsOnDay.filter(s =>
                        s.sessionType !== 'يوم عطلة' &&
                        !(s.sessionType === 'غياب الشيخ' && !s.substituteTeacher)
                    );

                    if (workSessions.length > 0) {
                        stats.workDays.add(dateString);
                        workSessions.forEach(session => {
                            stats.totalWorkSessions++;

                            // تصنيف الحصة
                            if (session.sessionType === 'حصة أساسية') stats.basicSessions++;
                            else if (session.sessionType === 'حصة إضافية' || session.sessionType === 'حصة تعويضية') stats.extraSessions++;
                            else if (session.sessionType === 'حصة أنشطة') stats.activitySessions++;

                            // حساب الحضور
                            const attendanceCount = (session.records || []).filter((r: any) => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
                            stats.totalAttendance += attendanceCount;
                            stats.totalPossibleAttendance += activeStudentsCount;
                        });
                    }
                }
            } catch (e) {
                // Ignore invalid date strings
            }
        });

        const attendanceRate = stats.totalPossibleAttendance > 0 ? (stats.totalAttendance / stats.totalPossibleAttendance) * 100 : 0;

        // حساب معدل الإنجاز (افتراض أن الأسبوع فيه 5 أيام عمل، أي 20 يوم في الشهر)
        const daysInPeriod = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24) + 1;
        const estimatedTargetSessions = Math.max(stats.workDays.size, Math.floor((daysInPeriod / 7) * 5));
        const accomplishmentRate = estimatedTargetSessions > 0 ? (stats.totalWorkSessions / estimatedTargetSessions) * 100 : 0;

        return {
            periodStats: {
                attendanceRate: attendanceRate.toFixed(0),
                accomplishmentRate: accomplishmentRate.toFixed(0),
                basicSessions: stats.basicSessions,
                extraSessions: stats.extraSessions,
                activitySessions: stats.activitySessions,
                holidays: stats.holidays,
                sheikhAbsenceNoSub: stats.sheikhAbsenceNoSub,
                sheikhAbsenceWithSub: stats.sheikhAbsenceWithSub,
                netWorkDays: stats.workDays.size,
                totalWorkSessions: stats.totalWorkSessions
            },
            statsTitle: title
        };

    }, [dailySessions, students, viewMode, currentDate]);

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
    if (viewMode === 'month') viewTitle = format(currentDate, 'MMMM yyyy', { locale: ar });
    if (viewMode === 'quarter') viewTitle = `الربع ${currentQuarter} - ${currentYear}`;

    return (
        <TooltipProvider>
            <div className="space-y-6 w-full">
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="px-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="text-right">
                                <CardTitle className="text-3xl font-headline font-bold text-primary">رادار الأداء السنوي</CardTitle>
                                <CardDescription className="text-base">نظرة شاملة على التزام وأداء الفوج وجدول الحصص.</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                {isAdmin && (
                                    <div className="min-w-[200px]">
                                        <SearchableSelect
                                            options={sheikhOptions}
                                            value={selectedSheikhId}
                                            onValueChange={setSelectedSheikhId}
                                            placeholder="اختر الشيخ/الفوج"
                                            searchPlaceholder="ابحث عن شيخ..."
                                        />
                                    </div>
                                )}
                                <div className="flex items-center gap-3 bg-muted/50 p-1.5 rounded-2xl border">
                                    <Button variant={viewMode === 'year' ? 'secondary' : 'ghost'} onClick={() => setViewMode('year')} className="h-9 px-5 rounded-xl font-bold">سنوي</Button>
                                    <Button variant={viewMode === 'quarter' ? 'secondary' : 'ghost'} onClick={() => setViewMode('quarter')} className="h-9 px-5 rounded-xl font-bold">فصلي</Button>
                                    <Button variant={viewMode === 'month' ? 'secondary' : 'ghost'} onClick={() => setViewMode('month')} className="h-9 px-5 rounded-xl font-bold">شهري</Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 overflow-hidden border-muted/60">
                        <CardContent className="pt-6">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                                <div className="flex items-center gap-4 order-2 md:order-1">
                                    <Button variant="outline" size="icon" className="rounded-full" onClick={() => handleDateNavigation('prev')}><ChevronRight className="h-5 w-5" /></Button>
                                    <span className="font-bold text-xl min-w-[140px] text-center text-primary">{viewTitle}</span>
                                    <Button variant="outline" size="icon" className="rounded-full" onClick={() => handleDateNavigation('next')}><ChevronLeft className="h-5 w-5" /></Button>
                                </div>

                                <div className="flex-1 flex justify-center order-1 md:order-2">
                                    {viewMode === 'quarter' && (
                                        <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1 border">
                                            {[1, 2, 3, 4].map(q => (
                                                <Button key={q} variant={currentQuarter === q ? 'secondary' : 'ghost'} onClick={() => handleSetQuarter(q)} className="h-8 px-4 text-xs font-bold rounded-lg transition-all">الربع {q}</Button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative">
                                {viewMode === 'year' && <YearView year={currentYear} data={yearlyData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} />}
                                {viewMode === 'quarter' && <QuarterView year={currentYear} quarter={currentQuarter} data={yearlyData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} />}
                                {viewMode === 'month' && <MonthView year={currentYear} month={currentMonth} data={yearlyData} onDayClick={(date) => console.log(date)} />}
                            </div>

                            <div className="mt-8 pt-6 border-t flex flex-wrap justify-center gap-x-6 gap-y-3 text-[11px] font-bold text-muted-foreground">
                                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-emerald-400 border border-emerald-500"></div> جهد معتدل</div>
                                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-700"></div> جهد مكثف</div>
                                <div className="flex items-center gap-4 px-2 opacity-30">|</div>
                                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-red-400 border border-red-500"></div> غياب الشيخ</div>
                                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-purple-400 border border-purple-500"></div> غياب (ببديل)</div>
                                <div className="flex items-center gap-2"><div className="w-3.5 h-3.5 rounded bg-blue-400 border border-blue-500"></div> عطلة رسمية</div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="border-primary/10 shadow-lg shadow-primary/5">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg font-bold">{statsTitle}</CardTitle>
                                    <Target className="h-5 w-5 text-primary opacity-50" />
                                </div>
                                <CardDescription>تحليل دقيق لأداء الفترة المختارة</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-4">
                                {/* Main KPIs */}
                                <div className="grid grid-cols-2 gap-3">
                                    <StatWidget
                                        title="معدل الحضور"
                                        value={periodStats.attendanceRate}
                                        unit="%"
                                        variant="emerald"
                                        description="حضور الطلبة"
                                        icon={<Users className="h-5 w-5" />}
                                    />
                                    <StatWidget
                                        title="مستوى الإنجاز"
                                        value={periodStats.accomplishmentRate}
                                        unit="%"
                                        variant="orange"
                                        description="جهد الشيخ"
                                        icon={<Star className="h-5 w-5" />}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">تفاصيل الحصص المنعقدة</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        <StatWidget
                                            title="الحصص الأساسية"
                                            value={periodStats.basicSessions}
                                            unit="حصة"
                                            variant="blue"
                                            icon={<BookOpen className="h-4 w-4" />}
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <StatWidget
                                                title="إضافية / تعويضية"
                                                value={periodStats.extraSessions}
                                                unit="حصة"
                                                variant="indigo"
                                                icon={<PlusCircle className="h-4 w-4" />}
                                            />
                                            <StatWidget
                                                title="حصص الأنشطة"
                                                value={periodStats.activitySessions}
                                                unit="حصة"
                                                variant="emerald"
                                                icon={<Activity className="h-4 w-4" />}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 pt-2">
                                    <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mr-1">الإجازات والغيابات</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <StatWidget title="عطل رسمية" value={periodStats.holidays} unit="يوم" variant="default" icon={<Coffee className="h-4 w-4" />} />
                                        <StatWidget title="صافي العمل" value={periodStats.netWorkDays} unit="يوم" variant="default" icon={<Calendar className="h-4 w-4" />} />
                                        <StatWidget title="غياب (لا بديل)" value={periodStats.sheikhAbsenceNoSub} unit="يوم" variant="red" icon={<UserX className="h-4 w-4" />} />
                                        <StatWidget title="غياب (ببديل)" value={periodStats.sheikhAbsenceWithSub} unit="يوم" variant="purple" icon={<UserCheck className="h-4 w-4" />} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
