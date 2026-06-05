"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, onValue, off, type DataSnapshot } from 'firebase/database';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
    Loader2,
    Calendar,
    CheckCircle,
    TrendingUp,
    User,
    ShieldAlert,
    AlertCircle,
    Bookmark,
    Award,
    LayoutDashboard,
    ArrowLeft,
    ArrowRight,
    MapPin,
    Phone,
    Users as UsersIcon,
    Edit
} from 'lucide-react';
import { format, getYear, getDay, startOfYear, addDays, parseISO, getMonth, getDaysInMonth, startOfMonth, endOfMonth, getQuarter, setYear, setMonth, addMonths, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ReceiptDesign } from '@/components/admin/ReceiptDesign';
import { ClipboardList } from 'lucide-react';

// --- Copied Components & Helpers from student-history ---

const getStudentDayColor = (dayData: any, viewType: 'attendance' | 'evaluation' | 'behavior' = 'attendance') => {
    if (!dayData) return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';
    if (dayData.isHoliday) return 'bg-blue-400 border-blue-500';
    if (dayData.isSheikhAbsentNoSub) return 'bg-rose-400 border-rose-500';
    if (dayData.isSheikhAbsentWithSub) return 'bg-purple-400 border-purple-500';

    const records = dayData.records || [];
    if (records.length === 0) return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';

    const hasMultiple = records.length > 1;

    if (viewType === 'attendance') {
        const statuses = records.map((r: any) => r.attendance);
        if (statuses.includes('حاضر')) return hasMultiple ? 'bg-emerald-700 border-emerald-800 shadow-inner' : 'bg-emerald-500 border-emerald-600';
        if (statuses.includes('متأخر')) return hasMultiple ? 'bg-amber-500 border-amber-600 shadow-inner' : 'bg-amber-400 border-amber-500';
        if (statuses.includes('غياب') || statuses.includes('غائب')) return hasMultiple ? 'bg-red-700 border-red-800 shadow-inner' : 'bg-red-500 border-red-600';
        return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';
    } else if (viewType === 'evaluation') {
        const evals = records.map((r: any) => r.memorization).filter(Boolean);
        if (evals.length === 0) return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';
        if (evals.some((e: string) => e.includes('ممتاز'))) return hasMultiple ? 'bg-emerald-900 border-emerald-950' : 'bg-emerald-700 border-emerald-800';
        if (evals.some((e: string) => e.includes('جيد جدا'))) return hasMultiple ? 'bg-emerald-700 border-emerald-800' : 'bg-emerald-500 border-emerald-600';
        if (evals.some((e: string) => e.includes('جيد'))) return hasMultiple ? 'bg-amber-600 border-amber-700' : 'bg-amber-400 border-amber-500';
        if (evals.some((e: string) => e.includes('مقبول'))) return hasMultiple ? 'bg-orange-600 border-orange-700' : 'bg-orange-400 border-orange-500';
        if (evals.some((e: string) => e.includes('ضعيف'))) return hasMultiple ? 'bg-red-700 border-red-800' : 'bg-red-500 border-red-600';
        return 'bg-emerald-400 border-emerald-500';
    } else {
        const behaviors = records.map((r: any) => r.behavior).filter(Boolean);
        if (behaviors.length === 0) return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';
        if (behaviors.includes('مشاغب')) return hasMultiple ? 'bg-red-700 border-red-800' : 'bg-red-500 border-red-600';
        if (behaviors.includes('مقبول') || behaviors.includes('عادي')) return hasMultiple ? 'bg-blue-600 border-blue-700' : 'bg-blue-400 border-blue-500';
        if (behaviors.includes('هادئ')) return hasMultiple ? 'bg-emerald-700 border-emerald-800' : 'bg-emerald-500 border-emerald-600';
        return 'bg-gray-300 border-gray-400';
    }
};

const StudentDayTooltip = ({ day, dayData }: { day: Date, dayData: any }) => {
    const formattedDate = format(day, 'd MMMM yyyy', { locale: ar });
    if (!dayData) return <p className="font-bold text-center">{formattedDate}<br />لا توجد بيانات</p>;

    return (
        <div className="space-y-2 text-right min-w-[180px] p-1">
            <p className="font-black border-b pb-1.5 mb-2 text-center text-primary">{formattedDate}</p>
            {dayData.isHoliday && <p className="text-blue-600 font-black flex items-center gap-2 justify-end">يوم عطلة <span className="w-2 h-2 rounded-full bg-blue-500"></span></p>}
            {dayData.isSheikhAbsentNoSub && <p className="text-rose-600 font-black flex items-center gap-2 justify-end">غياب الشيخ (بدون بديل) <span className="w-2 h-2 rounded-full bg-rose-500"></span></p>}
            {dayData.isSheikhAbsentWithSub && <p className="text-purple-600 font-black flex items-center gap-2 justify-end">غياب الشيخ (مع بديل) <span className="w-2 h-2 rounded-full bg-purple-500"></span></p>}

            {(dayData.records || []).map((record: any, idx: number) => (
                <div key={idx} className={cn("mt-2 p-2 rounded-lg bg-muted/30 border border-muted", (dayData.records.length > 1) && "border-r-4 border-r-primary")}>
                    {dayData.records.length > 1 && <p className="text-[10px] font-black text-primary mb-1 underline">حصة رقم {record.sessionNumber || idx + 1}</p>}
                    <p className="text-xs flex justify-between gap-4"><span className="opacity-60">الحضور:</span> <span className="font-black">{record.attendance || 'غير مسجل'}</span></p>
                    {record.memorization && <p className="text-xs flex justify-between gap-4"><span className="opacity-60">التقييم:</span> <span className="font-black">{record.memorization}</span></p>}
                    {record.behavior && <p className="text-xs flex justify-between gap-4"><span className="opacity-60">السلوك:</span> <span className="font-black">{record.behavior}</span></p>}
                    {record.notes && <p className="text-[10px] text-muted-foreground mt-1 border-t pt-1 italic select-none">"{record.notes}"</p>}
                </div>
            ))}

            {(!dayData.isHoliday && !dayData.isSheikhAbsentNoSub && (!dayData.records || dayData.records.length === 0)) && (
                <p className="text-xs text-muted-foreground italic text-center">لم يتم تسجيل بيانات لهذا اليوم</p>
            )}
        </div>
    );
};

const StudentYearView = ({ year, data, onDayClick, viewType }: { year: number, data: any, onDayClick: (date: Date) => void, viewType: 'attendance' | 'evaluation' | 'behavior' }) => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const daysInYear = getYear(yearStart) % 4 === 0 && (getYear(yearStart) % 100 !== 0 || getYear(yearStart) % 400 === 0) ? 366 : 365;
    const days = Array.from({ length: daysInYear }, (_, i) => addDays(yearStart, i));
    const firstDayOfWeek = getDay(yearStart);
    const startDayIndex = (firstDayOfWeek + 1) % 7;

    return (
        <div className="grid grid-cols-53 gap-1.5" dir="rtl">
            {Array.from({ length: startDayIndex }).map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
                const dateString = format(day, 'yyyy-MM-dd');
                const dayData = data[dateString];
                const colorClass = getStudentDayColor(dayData, viewType);
                return (
                    <Tooltip key={dateString}>
                        <TooltipTrigger asChild>
                            <div className={cn("w-4 h-4 rounded cursor-pointer transition-transform hover:scale-125", colorClass)} onClick={() => onDayClick(day)} />
                        </TooltipTrigger>
                        <TooltipContent><StudentDayTooltip day={day} dayData={dayData} /></TooltipContent>
                    </Tooltip>
                );
            })}
        </div>
    );
};

const StudentQuarterView = ({ year, quarter, data, onDayClick, viewType }: { year: number, quarter: number, data: any, onDayClick: (date: Date) => void, viewType: 'attendance' | 'evaluation' | 'behavior' }) => {
    const startMonthIndex = (quarter - 1) * 3;
    const months = [startMonthIndex, startMonthIndex + 1, startMonthIndex + 2];

    return (
        <div className="space-y-6">
            {months.map(monthIndex => {
                const monthStart = startOfMonth(new Date(year, monthIndex));
                const daysInMonth = getDaysInMonth(monthStart);
                const firstDay = getDay(monthStart);
                const startDayIndex = (firstDay + 1) % 7;
                const days = Array.from({ length: daysInMonth }, (_, i) => addDays(monthStart, i));

                return (
                    <div key={monthIndex} className="bg-muted/10 p-4 rounded-xl border">
                        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            {format(monthStart, 'MMMM yyyy', { locale: ar })}
                        </h3>
                        <div className="grid grid-cols-7 gap-2">
                            {Array.from({ length: startDayIndex }).map((_, i) => <div key={`empty-${monthIndex}-${i}`} />)}
                            {days.map(day => {
                                const dateString = format(day, 'yyyy-MM-dd');
                                const dayData = data[dateString];
                                const colorClass = getStudentDayColor(dayData, viewType);
                                return (
                                    <Tooltip key={dateString}>
                                        <TooltipTrigger asChild>
                                            <div className={cn("aspect-square rounded-md cursor-pointer transition-all hover:ring-2 hover:ring-primary/50", colorClass)} onClick={() => onDayClick(day)} />
                                        </TooltipTrigger>
                                        <TooltipContent><StudentDayTooltip day={day} dayData={dayData} /></TooltipContent>
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

const StudentMonthView = ({ year, month, data, onDayClick, viewType }: { year: number, month: number, data: any, onDayClick: (date: Date) => void, viewType: 'attendance' | 'evaluation' | 'behavior' }) => {
    const monthStart = startOfMonth(new Date(year, month));
    const daysInMonth = getDaysInMonth(monthStart);
    const firstDay = getDay(monthStart);
    const startDayIndex = (firstDay + 1) % 7;
    const dayCells = [];
    const weekdays = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

    for (let i = 0; i < startDayIndex; i++) {
        dayCells.push(<div key={`empty-${i}`} className="aspect-square border rounded-lg bg-muted/20" />);
    }

    for (let i = 1; i <= daysInMonth; i++) {
        const day = new Date(year, month, i);
        const dateString = format(day, 'yyyy-MM-dd');
        const dayData = data[dateString];
        const colorClass = getStudentDayColor(dayData, viewType);
        dayCells.push(
            <Tooltip key={dateString}>
                <TooltipTrigger asChild>
                    <div className={cn("aspect-square rounded-lg p-2 border-2 text-right flex flex-col justify-between cursor-pointer transition-all hover:scale-105", colorClass)} onClick={() => onDayClick(day)}>
                        <span className="font-bold text-lg">{i}</span>
                    </div>
                </TooltipTrigger>
                <TooltipContent><StudentDayTooltip day={day} dayData={dayData} /></TooltipContent>
            </Tooltip>
        );
    }

    return (
        <div className="grid grid-cols-7 gap-2">
            {weekdays.map(day => <div key={day} className="text-center font-semibold text-muted-foreground pb-2 text-sm">{day}</div>)}
            {dayCells}
        </div>
    );
};

const StatWidget = ({ title, value, unit, icon, colorClass }: { title: string, value: string | number, unit: string, icon: React.ReactNode, colorClass?: string }) => (
    <div className="flex items-center p-4 bg-card rounded-xl border shadow-sm transition-all hover:shadow-md">
        <div className={cn("p-3 rounded-xl ml-4", colorClass || "bg-muted")}>{icon}</div>
        <div>
            <p className="text-sm text-muted-foreground font-body">{title}</p>
            <p className="text-2xl font-bold font-headline">{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
        </div>
    </div>
);

// --- Main Page Component ---

export default function PublicStudentRecordPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    // Support both dynamic route /record/ID and query param /record?id=ID
    // This is necessary for static exports where dynamic paths might not be pre-generated
    const studentId = useMemo(() => {
        const pId = params?.studentId as string;
        const qId = searchParams.get('id');
        if (pId && pId !== '1') return pId;
        return qId;
    }, [params, searchParams]);

    const [loading, setLoading] = useState(true);
    const [snapshot, setSnapshot] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');
    const [viewType, setViewType] = useState<'attendance' | 'evaluation' | 'behavior'>('attendance');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [adminFilterDate, setAdminFilterDate] = useState<string>(''); // For filtering admin logs

    useEffect(() => {
        if (!studentId) return;

        const reportRef = ref(db, `public_student_reports/${studentId}`);
        const listener = onValue(reportRef, (snap: any) => {
            if (snap.exists()) {
                setSnapshot(snap.val());
            } else {
                setSnapshot(null);
            }
            setLoading(false);
        });

        return () => off(reportRef, 'value', listener);
    }, [studentId]);

    const student = snapshot?.student;
    const studentData = snapshot?.studentData || {};
    const stats = snapshot?.stats || { attendanceRate: 0, totalPresent: 0, totalAbsent: 0, totalLate: 0, avgEval: '---' };

    const currentYear = getYear(currentDate);
    const currentMonth = getMonth(currentDate);
    const currentQuarter = Math.floor(currentMonth / 3) + 1;

    const statsTitle = useMemo(() => {
        switch (viewMode) {
            case 'year': return `إحصائيات سنة ${currentYear}`;
            case 'quarter': return `إحصائيات الربع ${currentQuarter} - ${currentYear}`;
            default: return `إحصائيات شهر ${format(currentDate, 'MMMM yyyy', { locale: ar })}`;
        }
    }, [viewMode, currentDate, currentYear, currentQuarter]);

    const handleDateNavigation = (direction: 'prev' | 'next') => {
        const amount = direction === 'next' ? 1 : -1;
        if (viewMode === 'year') setCurrentDate(d => setYear(d, getYear(d) + amount));
        else if (viewMode === 'month') setCurrentDate(d => addMonths(d, amount));
        else if (viewMode === 'quarter') setCurrentDate(d => addMonths(d, amount * 3));
    };

    const { stats: periodStats } = useMemo(() => {
        if (!studentData) return {
            stats: {
                attendanceRate: '0',
                totalPresent: 0,
                totalAbsent: 0,
                totalLate: 0,
                avgEval: '---',
                sheikhAbsenceNoSub: 0,
                sheikhAbsenceWithSub: 0,
                hasSession2: false,
                presentCount1: 0,
                presentCount2: 0,
                lateCount1: 0,
                lateCount2: 0,
                absentCount1: 0,
                absentCount2: 0,
                rate1: '0',
                rate2: '0'
            },
            displayStats: snapshot?.stats
        };

        let startDate: Date;
        let endDate: Date;

        switch (viewMode) {
            case 'year':
                startDate = startOfYear(currentDate);
                endDate = endOfYear(currentDate);
                break;
            case 'quarter':
                const startQuarterMonth = (currentQuarter - 1) * 3;
                startDate = startOfMonth(setMonth(new Date(currentYear, 0), startQuarterMonth));
                endDate = endOfMonth(setMonth(new Date(currentYear, 0), startQuarterMonth + 2));
                break;
            case 'month':
            default:
                startDate = startOfMonth(currentDate);
                endDate = endOfMonth(currentDate);
                break;
        }

        const filteredDays = Object.keys(studentData)
            .filter(dateStr => {
                const date = parseISO(dateStr);
                return date >= startDate && date <= endDate;
            })
            .map(dateStr => studentData[dateStr]);

        const allRecords = filteredDays.flatMap(d => d.records || []);

        const presentCount = allRecords.filter((r: any) => r.attendance === 'حاضر').length;
        const lateCount = allRecords.filter((r: any) => r.attendance === 'متأخر').length;
        const absentCount = allRecords.filter((r: any) => r.attendance === 'غياب' || r.attendance === 'غائب').length;

        const sheikhAbsenceNoSub = filteredDays.filter(d => d.isSheikhAbsentNoSub).length;
        const sheikhAbsenceWithSub = filteredDays.filter(d => d.isSheikhAbsentWithSub).length;

        const totalWorkSessions = presentCount + lateCount + absentCount;
        const rate = totalWorkSessions > 0 ? ((presentCount + lateCount) / totalWorkSessions) * 100 : 0;

        // Split calculations for session 1 and 2
        const records1 = allRecords.filter((r: any) => r.sessionNumber === 1);
        const records2 = allRecords.filter((r: any) => r.sessionNumber === 2);

        const presentCount1 = records1.filter((r: any) => r.attendance === 'حاضر').length;
        const presentCount2 = records2.filter((r: any) => r.attendance === 'حاضر').length;

        const lateCount1 = records1.filter((r: any) => r.attendance === 'متأخر').length;
        const lateCount2 = records2.filter((r: any) => r.attendance === 'متأخر').length;

        const absentCount1 = records1.filter((r: any) => r.attendance === 'غياب' || r.attendance === 'غائب').length;
        const absentCount2 = records2.filter((r: any) => r.attendance === 'غياب' || r.attendance === 'غائب').length;

        const total1 = presentCount1 + lateCount1 + absentCount1;
        const rate1 = total1 > 0 ? ((presentCount1 + lateCount1) / total1) * 100 : 0;

        const total2 = presentCount2 + lateCount2 + absentCount2;
        const rate2 = total2 > 0 ? ((presentCount2 + lateCount2) / total2) * 100 : 0;

        const hasSession2 = records2.length > 0;

        // Eval stats
        const evals = allRecords.filter((r: any) => r.memorization).map((r: any) => r.memorization);
        let dominantEval = '---';
        if (evals.length > 0) {
            const counts: any = {};
            evals.forEach(e => counts[e] = (counts[e] || 0) + 1);
            dominantEval = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        }

        const calculatedStats = {
            attendanceRate: rate.toFixed(0),
            totalPresent: presentCount,
            totalAbsent: absentCount,
            totalLate: lateCount,
            avgEval: dominantEval,
            sheikhAbsenceNoSub,
            sheikhAbsenceWithSub,
            hasSession2,
            presentCount1,
            presentCount2,
            lateCount1,
            lateCount2,
            absentCount1,
            absentCount2,
            rate1: rate1.toFixed(0),
            rate2: rate2.toFixed(0)
        };

        return {
            stats: calculatedStats
        };
    }, [studentData, viewMode, currentDate, currentYear, currentQuarter]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-muted/10">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-bold">جاري تحميل السجل...</p>
            </div>
        );
    }

    if (!snapshot) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-muted/10 p-6 text-center">
                <div className="bg-white p-12 rounded-[3rem] shadow-xl max-w-md border-4 border-dashed border-primary/20">
                    <User className="h-20 w-20 text-muted-foreground/30 mx-auto mb-6" />
                    <h1 className="text-3xl font-black font-headline text-primary mb-4">عذراً، السجل غير متاح</h1>
                    <p className="text-muted-foreground font-medium mb-8">لم يتم تفعيل رابط المشاركة لهذا الطالب بعد، أو قد يكون الرابط منتهياً.</p>
                    <p className="text-xs text-muted-foreground opacity-60">مجموعة الإمام الشافعي ببوخضرة - عنابة</p>
                </div>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-muted/10 pb-20 overflow-x-hidden" dir="rtl">
                {/* Header Banner */}
                <div className="bg-primary text-primary-foreground py-12 px-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                    <div className="container mx-auto max-w-6xl relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="text-center md:text-right space-y-4">
                            <Badge className="bg-white/20 hover:bg-white/30 text-white border-none py-1 px-4 text-sm rounded-full backdrop-blur-md">
                                بوابة ولي الأمر الرقمية
                            </Badge>
                            <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tight">رادار سجل الطالب</h1>
                            <p className="text-primary-foreground/80 font-medium max-w-xl text-lg">أهلاً بك في البوابة الرسمية لمتابعة أداء الطالب في مجموعة الإمام الشافعي.</p>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-24 h-24 rounded-full bg-white/10 p-4 backdrop-blur-xl border border-white/20 shadow-inner animate-pulse">
                                <Award className="h-full w-full text-white" />
                            </div>
                            <p className="text-[10px] uppercase font-black tracking-widest opacity-60">حصن المسلم الصغير</p>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto max-w-6xl -mt-10 px-6 space-y-8">
                    {/* Student Info Card */}
                    <Card className="shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-xl">
                        <CardContent className="p-8 md:p-12 flex flex-col md:flex-row items-center gap-10">
                            <div className="relative group">
                                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl group-hover:scale-125 transition-transform" />
                                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-tr from-primary/10 to-primary/5 mx-auto flex items-center justify-center border-4 border-white shadow-2xl relative z-10 overflow-hidden ring-4 ring-primary/5">
                                    {student?.photoURL ? (
                                        <img src={student.photoURL} alt={student.fullName} className="w-full h-full object-cover" />
                                    ) : (
                                        <User className="h-16 w-16 md:h-20 md:w-20 text-primary/40" />
                                    )}
                                </div>
                                <Badge className="absolute bottom-2 right-2 bg-emerald-500 border-4 border-white z-20 px-4 py-1 text-xs">نشط</Badge>
                            </div>

                            <div className="flex-1 text-center md:text-right space-y-4">
                                <div>
                                    <h2 className="text-4xl font-black font-headline text-primary mb-1">{student?.fullName}</h2>
                                    <div className="flex flex-col md:flex-row items-center md:items-end gap-2 md:gap-4 justify-center md:justify-start">
                                        <p className="text-xl text-muted-foreground font-bold flex items-center gap-2">
                                            <UsersIcon className="h-4 w-4 text-primary/60" />
                                            {student?.groupName || 'المجموعة الأساسية'}
                                        </p>
                                        <span className="hidden md:block text-muted-foreground/30">•</span>
                                        <p className="text-lg text-primary/70 font-black flex items-center gap-2">
                                            <User className="h-4 w-4 text-primary/40" />
                                            {student?.sheikhName || 'غير محدد'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap justify-center md:justify-start gap-3">
                                    {student?.dailyMemorizationAmount && (
                                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 py-2 px-5 rounded-2xl font-black text-sm">
                                            وِرد الحفظ: {student.dailyMemorizationAmount}
                                        </Badge>
                                    )}
                                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200 py-2 px-5 rounded-2xl font-black text-sm">
                                        المستوى: {student?.educationalLevel || 'تحضيري'}
                                    </Badge>
                                </div>

                                <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-8 border-t border-dashed">
                                    <div className="text-center md:text-right">
                                        <p className="text-[10px] font-black text-muted-foreground opacity-50 uppercase mb-1">تاريخ الالتحاق</p>
                                        <p className="font-bold text-sm">{student?.registrationDate ? format(parseISO(student.registrationDate), 'MMMM yyyy', { locale: ar }) : '---'}</p>
                                    </div>
                                    <div className="text-center md:text-right">
                                        <p className="text-[10px] font-black text-muted-foreground opacity-50 uppercase mb-1">الرقم التعريفي</p>
                                        <p className="font-bold text-sm tracking-tighter opacity-80">#{studentId?.substring(0, 8) || ''}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Sheikh's Special Notes */}
                    {student?.sheikhNotes && (
                        <Card className="shadow-xl border-none rounded-[2.5rem] bg-gradient-to-br from-primary/5 via-white to-primary/5 border-r-8 border-r-primary overflow-hidden">
                            <CardContent className="p-8">
                                <div className="flex flex-col md:flex-row items-start gap-6">
                                    <div className="bg-primary/10 p-4 rounded-2xl">
                                        <Edit className="h-8 w-8 text-primary" />
                                    </div>
                                    <div className="space-y-2 flex-1 text-right">
                                        <h3 className="text-xl font-black font-headline text-primary">توجيهات الشيخ لولي الأمر</h3>
                                        <p className="text-lg font-bold text-foreground/80 leading-relaxed whitespace-pre-wrap">
                                            {student.sheikhNotes}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}



                    {/* Radar Content */}
                    <Card className="shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-xl">
                        <CardHeader className="bg-muted/30 border-b p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
                            <div className="text-center lg:text-right">
                                <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                                    <LayoutDashboard className="h-6 w-6 text-primary" />
                                    <CardTitle className="font-headline font-black text-2xl">رادار الأداء المتكامل</CardTitle>
                                </div>
                                <CardDescription className="font-bold text-md opacity-70">استعراض خرائط التواجد والتقييم الدوري.</CardDescription>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-4">
                                <div className="flex items-center bg-white p-1.5 rounded-[1.5rem] shadow-sm border">
                                    <Button variant={viewMode === 'year' ? 'default' : 'ghost'} onClick={() => setViewMode('year')} className={cn("h-9 px-6 rounded-2xl font-black text-xs", viewMode === 'year' ? "bg-primary text-white" : "")}>سنوي</Button>
                                    <Button variant={viewMode === 'quarter' ? 'default' : 'ghost'} onClick={() => setViewMode('quarter')} className={cn("h-9 px-6 rounded-2xl font-black text-xs", viewMode === 'quarter' ? "bg-primary text-white" : "")}>فصلي</Button>
                                    <Button variant={viewMode === 'month' ? 'default' : 'ghost'} onClick={() => setViewMode('month')} className={cn("h-9 px-6 rounded-2xl font-black text-xs", viewMode === 'month' ? "bg-primary text-white" : "")}>شهري</Button>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 bg-muted/50 p-1.5 rounded-[1.5rem] border border-dotted border-primary/30">
                                    <Button variant={viewType === 'attendance' ? 'secondary' : 'ghost'} onClick={() => setViewType('attendance')} className={cn("h-8 px-4 rounded-xl flex items-center gap-2 font-black text-[10px]", viewType === 'attendance' ? "bg-emerald-500 text-white" : "")}>
                                        <Calendar className="h-3 w-3" /> الحضور
                                    </Button>
                                    <Button variant={viewType === 'evaluation' ? 'secondary' : 'ghost'} onClick={() => setViewType('evaluation')} className={cn("h-8 px-4 rounded-xl flex items-center gap-2 font-black text-[10px]", viewType === 'evaluation' ? "bg-blue-600 text-white" : "")}>
                                        <Award className="h-3 w-3" /> التقييم
                                    </Button>
                                    <Button variant={viewType === 'behavior' ? 'secondary' : 'ghost'} onClick={() => setViewType('behavior')} className={cn("h-8 px-4 rounded-xl flex items-center gap-2 font-black text-[10px]", viewType === 'behavior' ? "bg-amber-500 text-white" : "")}>
                                        <TrendingUp className="h-3 w-3" /> السلوك
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="p-8 md:p-12">
                            <div className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6 bg-muted/20 p-6 rounded-[2rem] border border-dashed">
                                <div className="text-center md:text-right">
                                    <h4 className="font-black text-xl mb-1">{statsTitle}</h4>
                                    <p className="text-xs text-muted-foreground font-bold">ملخص الإنجاز في الفترة المحددة</p>
                                </div>
                                <div className="flex items-center justify-center gap-x-8 gap-y-4 flex-wrap">
                                    <div className="text-center">
                                        <span className="block text-2xl font-black text-emerald-600">{periodStats.totalPresent}</span>
                                        <span className="text-[10px] font-black opacity-50 uppercase block">حضور</span>
                                        {periodStats.hasSession2 && (
                                            <span className="text-[9px] font-bold text-muted-foreground block mt-0.5">ص: {periodStats.presentCount1} | م: {periodStats.presentCount2}</span>
                                        )}
                                    </div>
                                    <div className="w-px h-8 bg-muted border-dotted border-l hidden sm:block" />
                                    <div className="text-center">
                                        <span className="block text-2xl font-black text-amber-600">{periodStats.avgEval}</span>
                                        <span className="text-[10px] font-black opacity-50 uppercase block">التقييم</span>
                                    </div>
                                    <div className="w-px h-8 bg-muted border-dotted border-l hidden sm:block" />
                                    <div className="text-center">
                                        <span className="block text-2xl font-black text-blue-600">{periodStats.totalLate}</span>
                                        <span className="text-[10px] font-black opacity-50 uppercase block">تأخر</span>
                                        {periodStats.hasSession2 && (
                                            <span className="text-[9px] font-bold text-muted-foreground block mt-0.5">ص: {periodStats.lateCount1} | م: {periodStats.lateCount2}</span>
                                        )}
                                    </div>
                                    <div className="w-px h-8 bg-muted border-dotted border-l hidden sm:block" />
                                    <div className="text-center">
                                        <span className="block text-2xl font-black text-red-600">{periodStats.totalAbsent}</span>
                                        <span className="text-[10px] font-black opacity-50 uppercase block">غياب</span>
                                        {periodStats.hasSession2 && (
                                            <span className="text-[9px] font-bold text-muted-foreground block mt-0.5">ص: {periodStats.absentCount1} | م: {periodStats.absentCount2}</span>
                                        )}
                                    </div>
                                    <div className="w-px h-8 bg-muted border-dotted border-l hidden sm:block" />
                                    <div className="text-center">
                                        <span className="block text-2xl font-black text-rose-600">{Number(periodStats.sheikhAbsenceNoSub) + Number(periodStats.sheikhAbsenceWithSub)}</span>
                                        <span className="text-[10px] font-black opacity-50 uppercase block">غياب الشيخ</span>
                                    </div>
                                    <div className="w-px h-8 bg-muted border-dotted border-l hidden sm:block" />
                                    <div className="text-center">
                                        <span className="block text-2xl font-black text-primary">{periodStats.attendanceRate}%</span>
                                        <span className="text-[10px] font-black opacity-50 uppercase block">نسبة الحضور</span>
                                        {periodStats.hasSession2 && (
                                            <span className="text-[9px] font-bold text-muted-foreground block mt-0.5">ص: {periodStats.rate1}% | م: {periodStats.rate2}%</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border">
                                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDateNavigation('prev')}><ArrowRight className="h-4 w-4" /></Button>
                                    <span className="font-black px-4 min-w-[120px] text-center text-sm">{format(currentDate, viewMode === 'year' ? 'yyyy' : 'MMMM yyyy', { locale: ar })}</span>
                                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleDateNavigation('next')}><ArrowLeft className="h-4 w-4" /></Button>
                                </div>
                            </div>

                            <div className="py-4 overflow-x-auto min-h-[250px] scrollbar-hide">
                                {viewMode === 'year' && <StudentYearView year={currentYear} data={studentData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} viewType={viewType} />}
                                {viewMode === 'quarter' && <StudentQuarterView year={currentYear} quarter={currentQuarter} data={studentData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} viewType={viewType} />}
                                {viewMode === 'month' && <StudentMonthView year={currentYear} month={currentMonth} data={studentData} onDayClick={() => { }} viewType={viewType} />}
                            </div>

                            <div className="mt-12 border-t pt-8 flex flex-wrap justify-center gap-x-8 gap-y-4">
                                {viewType === 'attendance' ? (
                                    <>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-emerald-500 shadow-sm"></div> حاضر</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-emerald-700 shadow-sm shadow-inner"></div> حصتان (حضور)</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-amber-400 shadow-sm"></div> متأخر</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-red-500 shadow-sm"></div> غائب</span>
                                    </>
                                ) : viewType === 'evaluation' ? (
                                    <>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-emerald-700 shadow-sm"></div> ممتاز</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-emerald-500 shadow-sm"></div> جيد جداً</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-amber-400 shadow-sm"></div> جيد</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-orange-400 shadow-sm"></div> مقبول</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-red-500 shadow-sm"></div> ضعيف</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-emerald-500 shadow-sm"></div> هادئ</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-blue-400 shadow-sm"></div> مقبول</span>
                                        <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-red-500 shadow-sm"></div> مشاغب</span>
                                    </>
                                )}
                                <div className="h-4 w-px bg-muted mx-2 border-l" />
                                <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-blue-400 shadow-sm"></div> عطلة</span>
                                <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-purple-400 shadow-sm"></div> غياب الشيخ (بديل)</span>
                                <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-rose-400 shadow-sm"></div> غياب الشيخ (بدون)</span>
                                <span className="flex items-center gap-2 font-black text-[10px]"><div className="w-3 h-3 rounded bg-gray-100 shadow-sm"></div> لم يسجل</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Footer Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Detailed Log */}
                        <Card className="shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-xl">
                            <CardHeader className="bg-primary/5 border-b p-8">
                                <CardTitle className="flex items-center gap-3 font-black text-2xl">
                                    <Bookmark className="h-6 w-6 text-primary" />
                                    سجل الحصص التفصيلي
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="h-[500px] p-8">
                                    <div className="space-y-6">
                                        {Object.keys(studentData)
                                            .sort((a, b) => b.localeCompare(a))
                                            .slice(0, 30) // Show last 30 entries for public view
                                            .map(date => {
                                                const d = studentData[date];
                                                return (
                                                    <div key={date} className="p-6 rounded-[2rem] border bg-white hover:bg-muted/10 transition-all shadow-sm group">
                                                        <div className="flex justify-between items-start mb-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-primary text-lg">{format(parseISO(date), 'EEEE, d MMMM', { locale: ar })}</span>
                                                                <span className="text-[10px] text-muted-foreground font-black opacity-50">{format(parseISO(date), 'yyyy')}</span>
                                                            </div>
                                                            {d.isHoliday ? (
                                                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-black px-5 py-2 rounded-full border-none">عطلة رسمية</Badge>
                                                            ) : (
                                                                <Badge className={cn(
                                                                    "font-black px-5 py-2 rounded-full border-none shadow-sm",
                                                                    d.attendance === 'حاضر' ? "bg-emerald-100 text-emerald-700" :
                                                                        d.attendance === 'متأخر' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                                                )}>
                                                                    {d.attendance}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        {!d.isHoliday && (
                                                            <div className="space-y-4 mt-2">
                                                                {(d.records || [d]).map((record: any, idx: number) => (
                                                                    <div key={idx} className={cn("grid grid-cols-2 gap-4 p-4 rounded-2xl border border-dotted border-primary/20 bg-muted/10", (d.records?.length > 1) && "border-r-4 border-r-primary")}>
                                                                        {d.records?.length > 1 && <div className="col-span-2 text-[10px] font-black text-primary underline mb-1">الحصة رقم {record.sessionNumber || idx + 1}</div>}
                                                                        <div>
                                                                            <span className="text-[10px] text-muted-foreground font-black block mb-1 uppercase opacity-60">التقييم القرآني</span>
                                                                            <span className="font-black text-sm text-primary">{record.memorization || '---'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-muted-foreground font-black block mb-1 uppercase opacity-60">سلوك الحصة</span>
                                                                            <span className="font-black text-sm">{record.behavior || '---'}</span>
                                                                        </div>
                                                                        {record.notes && (
                                                                            <div className="col-span-2 bg-primary/5 p-3 rounded-xl italic text-xs text-foreground/80 leading-relaxed border-r-2 border-primary/20">
                                                                                "{record.notes}"
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Covenant Records */}
                        <Card className="shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-xl">
                            <CardHeader className="bg-red-50/50 border-b p-8">
                                <CardTitle className="flex items-center gap-3 font-black text-2xl">
                                    <ShieldAlert className="h-6 w-6 text-red-500" />
                                    التعهدات والبطاقات الرسمية
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                <div className="space-y-6">
                                    {(student?.covenants || []).length > 0 ? (
                                        (student?.covenants || []).map((cov: any, idx: number) => (
                                            <div key={idx} className={cn(
                                                "p-6 rounded-[2rem] border-l-8 shadow-sm transition-all hover:-translate-x-1",
                                                cov.card === 'بطاقة حمراء' ? "bg-red-50/80 border-red-500" :
                                                    cov.card === 'بطاقة صفراء' ? "bg-amber-50/80 border-amber-500" : "bg-gray-50 border-gray-400"
                                            )}>
                                                <div className="flex justify-between items-center mb-4">
                                                    <span className="font-black text-xl">{cov.card}</span>
                                                    <Badge variant={cov.status === 'نشط' ? 'destructive' : 'secondary'} className="rounded-full px-5 py-1.5 font-black text-[10px] shadow-sm">
                                                        {cov.status === 'نشط' ? 'نشطة حالياً' : 'مؤرشفة'}
                                                    </Badge>
                                                </div>
                                                <p className="font-bold text-gray-800 leading-relaxed text-lg mb-4">{cov.text}</p>
                                                <div className="flex justify-end pt-4 border-t border-dotted">
                                                    <span className="text-[10px] font-black text-muted-foreground bg-white px-4 py-1.5 rounded-full border shadow-sm">{cov.date ? format(parseISO(cov.date), 'd MMMM yyyy', { locale: ar }) : '---'}</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/20 rounded-[3rem] border-4 border-dashed">
                                            <CheckCircle className="h-20 w-20 text-emerald-200 mb-6" />
                                            <p className="font-black text-xl mb-2">السجل نظيف تماماً</p>
                                            <p className="text-sm font-medium opacity-60">لا توجد أي تعهدات أو بطاقات مسجلة بحمد الله.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Administrative Documents Section */}
                    <Card className="shadow-2xl border-none rounded-[3rem] overflow-hidden bg-white/80 backdrop-blur-xl">
                        <CardHeader className="bg-primary/5 border-b p-8">
                            <CardTitle className="flex items-center gap-3 font-black text-2xl">
                                <ClipboardList className="h-6 w-6 text-primary" />
                                والأوصال والمستندات الإدارية
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-4 mt-4 md:mt-0">
                                <div className="flex items-center gap-2 bg-white/40 border border-primary/10 rounded-full px-4 py-2">
                                    <Calendar className="h-4 w-4 text-primary" />
                                    <input
                                        type="date"
                                        value={adminFilterDate}
                                        onChange={(e) => setAdminFilterDate(e.target.value)}
                                        className="bg-transparent border-none text-sm font-black text-primary focus:ring-0 outline-none"
                                        dir="rtl"
                                        aria-label="Filter by date"
                                        title="تصفية حسب التاريخ"
                                    />
                                    {adminFilterDate && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 rounded-full hover:bg-primary/10"
                                            onClick={() => setAdminFilterDate('')}
                                        >
                                            ×
                                        </Button>
                                    )}
                                </div>
                                <CardDescription className="font-bold text-md opacity-70">سجل الوثائق الرسمية الصادرة من الإدارة.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
                                {snapshot?.adminLogs && Object.values(snapshot.adminLogs).length > 0 ? (
                                    Object.values(snapshot.adminLogs as any)
                                        .filter((log: any) => {
                                            if (!adminFilterDate) return true;
                                            return log.date === adminFilterDate;
                                        })
                                        .sort((a: any, b: any) => b.timestamp.localeCompare(a.timestamp))
                                        .map((log: any) => (
                                            <div key={log.id} className="relative group">
                                                <div className="transform scale-[0.98] origin-top border shadow-lg rounded-xl overflow-hidden bg-white transition-all group-hover:scale-100 group-hover:shadow-2xl">
                                                    <ReceiptDesign
                                                        log={log}
                                                        isHistory={true}
                                                        qrCodeUrl={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`${typeof window !== 'undefined' ? window.location.origin : ''}/record?id=${log.studentId}`)}`}
                                                    />
                                                </div>
                                                <div className="absolute inset-x-0 bottom-4 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Badge className="bg-primary text-white px-4 py-1.5 rounded-full font-black text-[10px] shadow-lg">
                                                        {format(parseISO(log.date), 'd MMMM yyyy', { locale: ar })}
                                                    </Badge>
                                                </div>
                                            </div>
                                        ))
                                ) : (
                                    <div className="col-span-full flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/20 rounded-[3rem] border-4 border-dashed">
                                        <ClipboardList className="h-20 w-20 text-primary/20 mb-6" />
                                        <p className="font-black text-xl mb-2">لا توجد مستندات إدارية</p>
                                        <p className="text-sm font-medium opacity-60">لم يتم إصدار أي أوصال إدارية لهذا الطالب حتى الآن.</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="pt-12 pb-6 text-center space-y-4">
                        <div className="h-px w-24 bg-primary/20 mx-auto" />
                        <h3 className="text-xl font-black font-headline text-primary opacity-60">المدرسة القرآنية للإمام الشافعي</h3>
                        <div className="flex items-center justify-center gap-6 text-muted-foreground font-black text-[10px] uppercase tracking-widest">
                            <span>حي تكسبت الغربية / الوادي</span>
                        </div>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
