"use client";

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, ArrowLeft, ArrowRight, Calendar, CheckCircle, TrendingUp, User, ShieldAlert, Info, AlertCircle, Bookmark, Award, LayoutDashboard, Link } from 'lucide-react';
import { format, getYear, getDay, startOfYear, addDays, parseISO, getMonth, getDaysInMonth, startOfMonth, endOfMonth, getQuarter, setYear, setMonth, addMonths, subMonths, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Save, Edit } from 'lucide-react';

// Helper function to get color based on student's day data
const getStudentDayColor = (dayData: any, viewType: 'attendance' | 'evaluation' = 'attendance') => {
    if (!dayData) return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';
    if (dayData.isHoliday) return 'bg-blue-400 border-blue-500';
    if (dayData.isSheikhAbsentNoSub) return 'bg-red-400 border-red-500';
    if (dayData.isSheikhAbsentWithSub) return 'bg-purple-400 border-purple-500';

    if (viewType === 'attendance') {
        switch (dayData.attendance) {
            case 'حاضر': return 'bg-emerald-500 border-emerald-600';
            case 'متأخر': return 'bg-amber-400 border-amber-500';
            case 'غائب': return 'bg-red-500 border-red-600';
            default: return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';
        }
    } else {
        // Evaluation based colors
        const evalValue = dayData.memorization;
        if (!evalValue) return 'bg-gray-100 dark:bg-gray-800/40 border-transparent';

        if (evalValue.includes('ممتاز')) return 'bg-emerald-700 border-emerald-800';
        if (evalValue.includes('جيد جدا')) return 'bg-emerald-500 border-emerald-600';
        if (evalValue.includes('جيد')) return 'bg-amber-400 border-amber-500';
        if (evalValue.includes('مقبول')) return 'bg-orange-400 border-orange-500';
        if (evalValue.includes('ضعيف')) return 'bg-red-500 border-red-600';
        return 'bg-emerald-400 border-emerald-500'; // Default for other evaluations
    }
};

const StudentDayTooltip = ({ day, dayData }: { day: Date, dayData: any }) => {
    const formattedDate = format(day, 'd MMMM yyyy', { locale: ar });

    if (!dayData) {
        return <p className="font-bold">{formattedDate}<br />لا توجد بيانات</p>;
    }

    return (
        <div className="space-y-1 text-right min-w-[150px]">
            <p className="font-bold border-b pb-1 mb-1">{formattedDate}</p>
            {dayData.isHoliday ? (
                <p className="text-blue-600 font-bold">يوم عطلة</p>
            ) : dayData.isSheikhAbsentNoSub ? (
                <p className="text-red-600 font-bold">غياب الشيخ (بدون بديل)</p>
            ) : dayData.isSheikhAbsentWithSub ? (
                <p className="text-purple-600 font-bold">غياب الشيخ (مع بديل)</p>
            ) : (
                <>
                    <p className="text-xs"><span className="font-bold">الحضور:</span> {dayData.attendance || 'غير مسجل'}</p>
                    {dayData.memorization && <p className="text-xs"><span className="font-bold">التقييم:</span> {dayData.memorization}</p>}
                    {dayData.behavior && <p className="text-xs"><span className="font-bold">السلوك:</span> {dayData.behavior}</p>}
                    {dayData.notes && <p className="text-xs text-muted-foreground mt-1 border-t pt-1 italic">"{dayData.notes}"</p>}
                </>
            )}
        </div>
    );
};

// Components adapted for student view
const StudentYearView = ({ year, data, onDayClick, viewType }: { year: number, data: any, onDayClick: (date: Date) => void, viewType: 'attendance' | 'evaluation' }) => {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const daysInYear = getYear(yearStart) % 4 === 0 && (getYear(yearStart) % 100 !== 0 || getYear(yearStart) % 400 === 0) ? 366 : 365;
    const days = Array.from({ length: daysInYear }, (_, i) => addDays(yearStart, i));
    const firstDayOfWeek = getDay(yearStart);
    const startDayIndex = (firstDayOfWeek + 1) % 7;

    return (
        <div className="grid grid-cols-53 gap-1.5" style={{ direction: 'rtl' }}>
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

const StudentQuarterView = ({ year, quarter, data, onDayClick, viewType }: { year: number, quarter: number, data: any, onDayClick: (date: Date) => void, viewType: 'attendance' | 'evaluation' }) => {
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

const StudentMonthView = ({ year, month, data, onDayClick, viewType }: { year: number, month: number, data: any, onDayClick: (date: Date) => void, viewType: 'attendance' | 'evaluation' }) => {
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

const StudentStatWidget = ({ title, value, unit, icon, colorClass }: { title: string, value: string | number, unit: string, icon: React.ReactNode, colorClass?: string }) => (
    <div className="flex items-center p-4 bg-card rounded-xl border shadow-sm transition-all hover:shadow-md">
        <div className={cn("p-3 rounded-xl ml-4", colorClass || "bg-muted")}>{icon}</div>
        <div>
            <p className="text-sm text-muted-foreground font-body">{title}</p>
            <p className="text-2xl font-bold font-headline">{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
        </div>
    </div>
);

function StudentHistoryContent() {
    const { students, allUsers, dailySessions, loading, shareStudentRecord, updateStudent } = useStudentContext();
    const { toast } = useToast();
    const searchParams = useSearchParams();
    const studentIdParam = searchParams.get('studentId');

    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'year' | 'quarter' | 'month'>('year');
    const [viewType, setViewType] = useState<'attendance' | 'evaluation'>('attendance');
    const [sheikhNotes, setSheikhNotes] = useState<string>('');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    useEffect(() => {
        if (studentIdParam) {
            setSelectedStudentId(studentIdParam);
        }
    }, [studentIdParam]);

    const selectedStudent = useMemo(() =>
        (students || []).find(s => s.id === selectedStudentId)
        , [students, selectedStudentId]);

    useEffect(() => {
        if (selectedStudent) {
            setSheikhNotes(selectedStudent.sheikhNotes || '');
        } else {
            setSheikhNotes('');
        }
    }, [selectedStudent]);

    const sheikhName = useMemo(() => {
        if (!selectedStudent || !allUsers) return null;
        const sheikh = (allUsers || []).find(u => u.role === 'sheikh' && u.group === selectedStudent.groupName);
        return sheikh?.displayName || null;
    }, [selectedStudent, allUsers]);

    const currentYear = getYear(currentDate);
    const currentMonth = getMonth(currentDate);
    const currentQuarter = getQuarter(currentDate);

    // Filter and aggregate data for the specific student
    const studentData = useMemo(() => {
        const data: any = {};
        if (!dailySessions || !selectedStudentId) return data;

        Object.keys(dailySessions).forEach(dateString => {
            const sessionsOnDay = Object.values(dailySessions[dateString]);
            if (sessionsOnDay.length === 0) return;

            const isHoliday = sessionsOnDay.some(s => s.sessionType === 'يوم عطلة');
            const isSheikhAbsentNoSub = sessionsOnDay.some(s => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher);
            const isSheikhAbsentWithSub = sessionsOnDay.some(s => s.sessionType === 'غياب الشيخ' && s.substituteTeacher);

            const studentRecord = sessionsOnDay
                .flatMap(s => (s.records || []).map(r => ({ ...r, sessionType: s.sessionType, sessionNumber: s.sessionNumber })))
                .find(r => r.studentId === selectedStudentId);

            data[dateString] = {
                id: dateString,
                isHoliday,
                isSheikhAbsentNoSub,
                isSheikhAbsentWithSub,
                attendance: studentRecord?.attendance || null,
                memorization: studentRecord?.memorization || null,
                behavior: studentRecord?.behavior || null,
                notes: studentRecord?.notes || null,
                sessionType: studentRecord?.sessionType || null,
                sessionNumber: studentRecord?.sessionNumber || null
            };
        });

        return data;
    }, [dailySessions, selectedStudentId]);

    const { stats, statsTitle } = useMemo(() => {
        if (!selectedStudentId || !studentData) return { stats: { attendanceRate: 0, totalPresent: 0, totalAbsent: 0, totalLate: 0, avgEval: '---' }, statsTitle: '' };

        let startDate: Date;
        let endDate: Date;
        let title: string;

        switch (viewMode) {
            case 'year':
                startDate = startOfYear(currentDate);
                endDate = endOfYear(currentDate);
                title = `إحصائيات سنة ${currentYear}`;
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

        const filteredDays = Object.keys(studentData)
            .filter(dateStr => {
                const date = parseISO(dateStr);
                return date >= startDate && date <= endDate;
            })
            .map(dateStr => studentData[dateStr]);

        const relevantDays = filteredDays.filter((d: any) => !d.isHoliday && !d.isSheikhAbsentNoSub && (d.attendance));
        const presentDays = relevantDays.filter((d: any) => d.attendance === 'حاضر').length;
        const lateDays = relevantDays.filter((d: any) => d.attendance === 'متأخر').length;
        const absentDays = relevantDays.filter((d: any) => d.attendance === 'غائب').length;

        const totalWorkDays = presentDays + lateDays + absentDays;
        const rate = totalWorkDays > 0 ? ((presentDays + lateDays) / totalWorkDays) * 100 : 0;

        // Eval stats
        const evals = relevantDays.filter(d => d.memorization).map(d => d.memorization);
        let dominantEval = '---';
        if (evals.length > 0) {
            const counts: any = {};
            evals.forEach(e => counts[e] = (counts[e] || 0) + 1);
            dominantEval = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        }

        return {
            stats: {
                attendanceRate: rate.toFixed(0),
                totalPresent: presentDays,
                totalAbsent: absentDays,
                totalLate: lateDays,
                avgEval: dominantEval
            },
            statsTitle: title
        };
    }, [studentData, selectedStudentId, viewMode, currentDate, currentYear, currentQuarter]);

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
        setCurrentDate(current => setMonth(current, (q - 1) * 3));
    }


    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <TooltipProvider>
            <div className="space-y-6 w-full animate-in fade-in duration-700">
                {/* Header & Selection */}
                <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-r from-primary/10 via-background to-background relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                    <CardHeader className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                        <div>
                            <CardTitle className="text-4xl font-headline font-black tracking-tight flex items-center gap-3">
                                <TrendingUp className="h-8 w-8 text-primary" />
                                رادار سجل الطالب
                            </CardTitle>
                            <CardDescription className="text-lg font-medium opacity-80 max-w-2xl">
                                استعراض السجل التاريخي الشامل لمستوى الحضور والأداء القرآني بدقة عالية.
                            </CardDescription>
                        </div>
                        <div className="w-full lg:w-96 flex flex-col gap-2">
                            <label className="text-xs font-bold text-muted-foreground mr-1">ابحث باسم الطالب</label>
                            <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                <SelectTrigger className="bg-background/90 backdrop-blur-md border-primary/20 hover:border-primary transition-all shadow-sm h-12 text-lg font-bold rounded-2xl">
                                    <SelectValue placeholder="اختر طالباً للعرض..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-2xl shadow-xl border-primary/10">
                                    {(students || []).filter(s => s.status === 'نشط').map(s => (
                                        <SelectItem key={s.id} value={s.id} className="text-lg font-medium focus:bg-primary/10 rounded-xl">{s.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardHeader>
                </Card>

                {selectedStudentId ? (
                    <>
                        {/* Student Profile Overview */}
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            <Card className="lg:col-span-1 shadow-md border-primary/10 rounded-2xl">
                                <CardContent className="pt-8 text-center space-y-4">
                                    <div className="relative inline-block">
                                        <div className="w-28 h-28 rounded-full bg-primary/10 mx-auto flex items-center justify-center border-4 border-background shadow-lg overflow-hidden ring-4 ring-primary/5">
                                            <User className="h-14 w-14 text-primary" />
                                        </div>
                                        <Badge className="absolute bottom-0 right-0 bg-emerald-500 border-2 border-background">نشط</Badge>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black font-headline text-primary">{selectedStudent?.fullName}</h3>
                                        <p className="text-muted-foreground font-bold">{selectedStudent?.groupName || 'غير محدد'}</p>
                                    </div>
                                    <div className="flex flex-wrap justify-center items-center gap-2">
                                        {selectedStudent?.dailyMemorizationAmount && (
                                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 py-1 px-3 rounded-lg font-bold">
                                                وِرد {selectedStudent.dailyMemorizationAmount}
                                            </Badge>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-lg gap-2 text-xs font-bold border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm"
                                            onClick={async () => {
                                                try {
                                                    const historySnapshot = {
                                                        student: {
                                                            ...selectedStudent,
                                                            sheikhName: sheikhName || 'غير محدد',
                                                            sheikhNotes: sheikhNotes
                                                        },
                                                        studentData: studentData,
                                                        stats: stats,
                                                        generatedAt: new Date().toISOString()
                                                    };
                                                    await shareStudentRecord(selectedStudentId, historySnapshot);

                                                    const url = `${window.location.origin}/record/${selectedStudentId}`;
                                                    navigator.clipboard.writeText(url);
                                                    toast({
                                                        title: "✅ تم نسخ الرابط",
                                                        description: "يمكن الآن لولي الأمر مشاهدة السجل عبر هذا الرابط.",
                                                    });
                                                } catch (error) {
                                                    toast({
                                                        title: "❌ خطأ",
                                                        description: "فشل في توليد رابط المشاركة.",
                                                        variant: "destructive"
                                                    });
                                                }
                                            }}
                                        >
                                            <Link className="h-3 w-3" />
                                            نسخ رابط الولي
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="lg:col-span-3 space-y-6">
                                <Card className="shadow-lg border-primary/10 rounded-2xl p-6">
                                    <div className="space-y-4 text-right">
                                        <div className="flex items-center justify-between">
                                            <Badge variant="outline" className="text-[10px] font-black border-primary/20">ملاحظات موجهة لولي الأمر</Badge>
                                            <label className="text-sm font-black font-headline text-primary flex items-center gap-2">
                                                <Edit className="h-4 w-4" />
                                                ملاحظة الشيخ
                                            </label>
                                        </div>
                                        <Textarea
                                            value={sheikhNotes}
                                            onChange={(e) => setSheikhNotes(e.target.value)}
                                            placeholder="اكتب هنا توجيهاتك لولي الأمر (ستظهر له في الرابط)..."
                                            className="min-h-[120px] bg-muted/20 border-primary/5 focus:border-primary/20 rounded-2xl font-bold text-md resize-none"
                                        />
                                        <Button
                                            variant="default"
                                            size="lg"
                                            className="w-full h-12 rounded-2xl gap-2 font-black shadow-lg bg-primary text-white hover:bg-primary/90 transition-all font-sans"
                                            disabled={isSavingNotes}
                                            onClick={async () => {
                                                if (!selectedStudent) return;
                                                setIsSavingNotes(true);
                                                try {
                                                    await updateStudent(selectedStudent.id, {
                                                        sheikhNotes: sheikhNotes
                                                    } as any, selectedStudent.ownerId);
                                                    toast({
                                                        title: "✅ تم الحفظ",
                                                        description: "تم تحديث ملاحظة الشيخ للطالب بنجاح.",
                                                    });
                                                } catch (error) {
                                                    console.error("Error saving notes:", error);
                                                    toast({
                                                        title: "❌ خطأ",
                                                        description: "فشل في حفظ الملاحظة.",
                                                        variant: "destructive"
                                                    });
                                                } finally {
                                                    setIsSavingNotes(false);
                                                }
                                            }}
                                        >
                                            <Save className="h-5 w-5" />
                                            {isSavingNotes ? 'جاري الحفظ...' : 'حفظ ونشر الملاحظة'}
                                        </Button>
                                    </div>
                                </Card>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <StudentStatWidget
                                        title="معدل الانضباط"
                                        value={stats.attendanceRate}
                                        unit="%"
                                        icon={<CheckCircle className="h-7 w-7 text-emerald-600" />}
                                        colorClass="bg-emerald-50"
                                    />
                                    <StudentStatWidget
                                        title="التقييم السائد"
                                        value={stats.avgEval}
                                        unit=""
                                        icon={<Award className="h-7 w-7 text-amber-600" />}
                                        colorClass="bg-amber-50"
                                    />
                                    <StudentStatWidget
                                        title="أيام غياب"
                                        value={stats.totalAbsent}
                                        unit="يوم"
                                        icon={<AlertCircle className="h-7 w-7 text-red-600" />}
                                        colorClass="bg-red-50"
                                    />
                                </div>

                                <Card className="shadow-lg border-primary/10 rounded-2xl overflow-hidden">
                                    <CardHeader className="bg-muted/30 pb-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                        <div className="flex flex-col items-center md:items-start">
                                            <CardTitle className="font-headline text-xl font-black">{statsTitle}</CardTitle>
                                            <CardDescription className="italic">ملخص إنجاز الطالب للفترة المختارة</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2 bg-background p-1.5 rounded-2xl shadow-inner border border-primary/10">
                                            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => handleDateNavigation('prev')}><ArrowRight className="h-4 w-4" /></Button>
                                            <span className="font-black px-4 min-w-[120px] text-center">{format(currentDate, viewMode === 'year' ? 'yyyy' : viewMode === 'month' ? 'MMMM yyyy' : 'yyyy', { locale: ar })}</span>
                                            <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" onClick={() => handleDateNavigation('next')}><ArrowLeft className="h-4 w-4" /></Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
                                        <div className="text-center p-3 rounded-2xl bg-emerald-50/30 border border-emerald-100 flex flex-col justify-center">
                                            <span className="text-xs text-muted-foreground font-bold mb-1">حضور</span>
                                            <span className="text-2xl font-black text-emerald-700">{stats.totalPresent}</span>
                                        </div>
                                        <div className="text-center p-3 rounded-2xl bg-amber-50/30 border border-amber-100 flex flex-col justify-center">
                                            <span className="text-xs text-muted-foreground font-bold mb-1">تأخر</span>
                                            <span className="text-2xl font-black text-amber-700">{stats.totalLate}</span>
                                        </div>
                                        <div className="text-center p-3 rounded-2xl bg-red-50/30 border border-red-100 flex flex-col justify-center">
                                            <span className="text-xs text-muted-foreground font-bold mb-1">غياب</span>
                                            <span className="text-2xl font-black text-red-700">{stats.totalAbsent}</span>
                                        </div>
                                        <div className="text-center p-3 rounded-2xl bg-blue-50/30 border border-blue-100 flex flex-col justify-center">
                                            <span className="text-xs text-muted-foreground font-bold mb-1">المعدل</span>
                                            <span className="text-2xl font-black text-blue-700">{stats.attendanceRate}%</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        {/* Performance Radar Container */}
                        <Card className="shadow-xl border-primary/20 rounded-2xl overflow-hidden">
                            <CardHeader className="border-b bg-muted/20 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <LayoutDashboard className="h-5 w-5 text-primary" />
                                        <CardTitle className="font-headline font-black text-2xl">رادار الأداء المتكامل</CardTitle>
                                    </div>
                                    <CardDescription className="text-md font-medium">عرض شامل للحضور والتقييم معاً.</CardDescription>
                                </div>

                                <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                                    {/* View Mode Selectors */}
                                    <div className="flex items-center bg-background p-1.5 rounded-2xl shadow-sm border border-primary/10">
                                        <Button
                                            variant={viewMode === 'year' ? 'default' : 'ghost'}
                                            onClick={() => setViewMode('year')}
                                            className={cn("h-10 px-6 rounded-xl font-bold transition-all", viewMode === 'year' ? "bg-primary text-primary-foreground shadow-md" : "")}
                                        >
                                            سنوي
                                        </Button>
                                        <Button
                                            variant={viewMode === 'quarter' ? 'default' : 'ghost'}
                                            onClick={() => setViewMode('quarter')}
                                            className={cn("h-10 px-6 rounded-xl font-bold transition-all", viewMode === 'quarter' ? "bg-primary text-primary-foreground shadow-md" : "")}
                                        >
                                            فصلي
                                        </Button>
                                        <Button
                                            variant={viewMode === 'month' ? 'default' : 'ghost'}
                                            onClick={() => setViewMode('month')}
                                            className={cn("h-10 px-6 rounded-xl font-bold transition-all", viewMode === 'month' ? "bg-primary text-primary-foreground shadow-md" : "")}
                                        >
                                            شهري
                                        </Button>
                                    </div>

                                    {/* View Type Toggle (Attendance vs Eval) */}
                                    <div className="flex items-center bg-muted/50 p-1.5 rounded-2xl border border-dotted border-primary/30">
                                        <Button
                                            variant={viewType === 'attendance' ? 'secondary' : 'ghost'}
                                            onClick={() => setViewType('attendance')}
                                            className={cn("h-9 px-4 rounded-xl flex items-center gap-2 font-bold", viewType === 'attendance' ? "bg-emerald-500 text-white shadow-sm" : "")}
                                        >
                                            <Calendar className="h-4 w-4" />
                                            الحضور
                                        </Button>
                                        <Button
                                            variant={viewType === 'evaluation' ? 'secondary' : 'ghost'}
                                            onClick={() => setViewType('evaluation')}
                                            className={cn("h-9 px-4 rounded-xl flex items-center gap-2 font-bold", viewType === 'evaluation' ? "bg-blue-600 text-white shadow-sm" : "")}
                                        >
                                            <Award className="h-4 w-4" />
                                            التقييم
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-8">
                                {viewMode === 'quarter' && (
                                    <div className="flex justify-center mb-6">
                                        <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-2xl border">
                                            {[1, 2, 3, 4].map(q => (
                                                <Button
                                                    key={q}
                                                    variant={currentQuarter === q ? 'secondary' : 'ghost'}
                                                    onClick={() => handleSetQuarter(q)}
                                                    className={cn("h-9 px-5 rounded-xl font-black text-xs", currentQuarter === q ? "bg-background shadow-sm border" : "")}
                                                >
                                                    الربع {q}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="py-4 overflow-x-auto min-h-[250px] scrollbar-hide">
                                    {viewMode === 'year' && <StudentYearView year={currentYear} data={studentData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} viewType={viewType} />}
                                    {viewMode === 'quarter' && <StudentQuarterView year={currentYear} quarter={currentQuarter} data={studentData} onDayClick={(date) => { setCurrentDate(date); setViewMode('month'); }} viewType={viewType} />}
                                    {viewMode === 'month' && <StudentMonthView year={currentYear} month={currentMonth} data={studentData} onDayClick={(date) => console.log(date)} viewType={viewType} />}
                                </div>

                                <div className="mt-10 border-t pt-8">
                                    <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
                                        {viewType === 'attendance' ? (
                                            <>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-emerald-500 border border-emerald-600"></div> حاضر</span>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-amber-400 border border-amber-500"></div> متأخر</span>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-red-500 border border-red-600"></div> غائب</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-emerald-700 border border-emerald-800"></div> ممتاز</span>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-emerald-500 border border-emerald-600"></div> جيد جداً</span>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-amber-400 border border-amber-500"></div> جيد</span>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-orange-400 border border-orange-500"></div> مقبول</span>
                                                <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-red-500 border border-red-600"></div> ضعيف</span>
                                            </>
                                        )}
                                        <div className="h-4 w-px bg-muted mx-2" />
                                        <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-blue-400 border border-blue-500"></div> عطلة</span>
                                        <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-purple-400 border border-purple-500"></div> غياب الشيخ</span>
                                        <span className="flex items-center gap-2 font-bold text-xs"><div className="w-4 h-4 rounded-md bg-gray-100 dark:bg-gray-800"></div> لم يسجل</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Detailed Tabs/Sections */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-20">
                            {/* Record List */}
                            <Card className="shadow-lg border-primary/10 rounded-2xl overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="flex items-center gap-2 font-black text-xl">
                                        <Bookmark className="h-6 w-6 text-primary" />
                                        سجل الحصص التفصيلي
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[500px]">
                                        <div className="p-4 space-y-4">
                                            {Object.keys(studentData)
                                                .sort((a, b) => b.localeCompare(a))
                                                .filter(dateStr => {
                                                    const date = parseISO(dateStr);
                                                    // Filter log by current view period
                                                    let startDate: Date; let endDate: Date;
                                                    if (viewMode === 'year') { startDate = startOfYear(currentDate); endDate = endOfYear(currentDate); }
                                                    else if (viewMode === 'quarter') { startDate = startOfMonth(setMonth(new Date(currentYear, 0), (currentQuarter - 1) * 3)); endDate = endOfMonth(setMonth(new Date(currentYear, 0), (currentQuarter - 1) * 3 + 2)); }
                                                    else { startDate = startOfMonth(currentDate); endDate = endOfMonth(currentDate); }
                                                    return date >= startDate && date <= endDate && (studentData[dateStr].attendance || studentData[dateStr].isHoliday);
                                                })
                                                .map(date => {
                                                    const d = studentData[date];
                                                    return (
                                                        <div key={date} className="p-4 rounded-2xl border bg-card hover:bg-muted/30 transition-all shadow-sm group">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="flex flex-col">
                                                                    <span className="font-black text-primary text-md">{format(parseISO(date), 'EEEE, d MMMM', { locale: ar })}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-bold">{format(parseISO(date), 'yyyy')}</span>
                                                                </div>
                                                                {d.isHoliday ? (
                                                                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-bold px-4 py-1">عطلة رسمية</Badge>
                                                                ) : (
                                                                    <Badge className={cn(
                                                                        "font-bold px-4 py-1 rounded-full",
                                                                        d.attendance === 'حاضر' ? "bg-emerald-100 text-emerald-700" :
                                                                            d.attendance === 'متأخر' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                                                    )}>
                                                                        {d.attendance}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {!d.isHoliday && (
                                                                <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 mt-2">
                                                                    <div className="bg-muted/40 p-2 rounded-xl border border-dotted">
                                                                        <span className="text-[10px] text-muted-foreground font-black block mb-1">التقييم القرآني</span>
                                                                        <span className="font-bold text-sm text-primary">{d.memorization || '---'}</span>
                                                                    </div>
                                                                    <div className="bg-muted/40 p-2 rounded-xl border border-dotted">
                                                                        <span className="text-[10px] text-muted-foreground font-black block mb-1">السلوك والانضباط</span>
                                                                        <span className="font-bold text-sm">{d.behavior || '---'}</span>
                                                                    </div>
                                                                    {d.notes && (
                                                                        <div className="col-span-2 bg-primary/5 p-3 rounded-xl border-r-4 border-primary/20 italic text-sm text-foreground/80 leading-relaxed group-hover:bg-primary/10 transition-all">
                                                                            "{d.notes}"
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>

                            {/* Covenant History */}
                            <Card className="shadow-lg border-primary/10 rounded-2xl overflow-hidden">
                                <CardHeader className="bg-red-50/50 border-b">
                                    <CardTitle className="flex items-center gap-2 font-black text-xl">
                                        <ShieldAlert className="h-6 w-6 text-red-500" />
                                        سجل التعهدات والبطاقات
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="space-y-4">
                                        {(selectedStudent?.covenants || []).length > 0 ? (
                                            (selectedStudent?.covenants || []).map((cov, idx) => (
                                                <div key={idx} className={cn(
                                                    "p-5 rounded-2xl border-l-4 shadow-sm transition-all hover:-translate-x-1",
                                                    cov.card === 'بطاقة حمراء' ? "bg-red-50/80 border-red-500" :
                                                        cov.card === 'بطاقة صفراء' ? "bg-amber-50/80 border-amber-500" : "bg-gray-50 border-gray-400"
                                                )}>
                                                    <div className="flex justify-between items-center mb-3">
                                                        <span className="font-black text-lg">{cov.card}</span>
                                                        <Badge variant={cov.status === 'نشط' ? 'destructive' : 'secondary'} className="rounded-full px-4 font-bold shadow-sm">
                                                            {cov.status === 'نشط' ? 'نشط حالياً' : 'مؤرشف'}
                                                        </Badge>
                                                    </div>
                                                    <p className="font-semibold text-gray-800 leading-relaxed text-md">{cov.text}</p>
                                                    <div className="flex justify-end mt-4">
                                                        <span className="text-xs font-bold text-muted-foreground bg-background px-3 py-1 rounded-full border">{cov.date}</span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed">
                                                <CheckCircle className="h-16 w-16 text-emerald-200 mb-4" />
                                                <p className="font-bold text-lg">لا يوجد سجل تعهدات لهذا الطالب بحمد الله.</p>
                                                <p className="text-sm opacity-60 mt-1">سجل نظيف ومثال يحتذى به في التربية.</p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center py-32 bg-card rounded-[3rem] border-4 border-dashed border-primary/10 shadow-inner group">
                        <div className="relative mb-6">
                            <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                            <UsersIcon className="h-24 w-24 text-primary/30 relative z-10 animate-pulse" />
                        </div>
                        <h3 className="text-3xl font-black font-headline text-muted-foreground/60 tracking-tight">الرجاء اختيار طالب لعرض سجله التفصيلي</h3>
                        <p className="mt-4 text-muted-foreground/40 font-bold">بوابة رصد الأداء المتكاملة - مجموعة الإمام الشافعي</p>
                    </div>
                )
                }
            </div>
        </TooltipProvider>
    );
}

export default function StudentHistoryPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <StudentHistoryContent />
        </Suspense>
    );
}

function UsersIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
