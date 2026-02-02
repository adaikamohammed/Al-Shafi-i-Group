"use client";

import React, { useState, useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import {
    Calendar, Shield, ArrowLeft, Loader2, Info, CheckCircle2, XCircle,
    CalendarDays, CalendarRange, CalendarCheck, History, User, Users,
    Clock, BookOpen, AlertCircle, ChevronLeft, ChevronRight, Activity,
    Calendar as CalendarIcon, Filter, Search, Download, Flame, Star, Megaphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    isWithinInterval, parseISO, isSameDay, eachDayOfInterval,
    subDays, startOfDay, endOfDay
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PORTAL_THEMES } from '@/lib/themes';
import { motion, AnimatePresence } from 'framer-motion';

export default function SheikhMonitoringPage() {
    const { dailySessions, allUsers, loading } = useStudentContext();
    const { isManagement, user } = useAuth();
    const [view, setView] = useState<'day' | 'week' | 'month'>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Theme Logic
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const sheikhs = useMemo(() =>
        allUsers.filter(u => u.role === 'sheikh' && u.group).sort((a, b) => {
            const numA = parseInt(a.group?.replace(/[^0-9]/g, '') || '0');
            const numB = parseInt(b.group?.replace(/[^0-9]/g, '') || '0');
            return numA - numB;
        })
        , [allUsers]);

    const monitoringData = useMemo(() => {
        if (!dailySessions) return [];

        return sheikhs.map(sheikh => {
            const sessionsBySheikh = [];
            Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
                Object.values(daySessions).forEach(session => {
                    if (session.ownerId === sheikh.uid) {
                        sessionsBySheikh.push({
                            ...session,
                            dateStr
                        });
                    }
                });
            });

            return {
                sheikh,
                sessions: sessionsBySheikh
            };
        });
    }, [sheikhs, dailySessions]);

    const dayStatus = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        return monitoringData.map(data => {
            const sessionToday = data.sessions.find(s => s.dateStr === dateStr);
            return {
                ...data,
                status: sessionToday ? 'recorded' : 'missing',
                session: sessionToday
            };
        });
    }, [monitoringData, selectedDate]);

    const navigateDate = (direction: 'prev' | 'next') => {
        const amount = direction === 'next' ? 1 : -1;
        if (view === 'day') setSelectedDate(d => subDays(d, -amount));
        else if (view === 'week') setSelectedDate(d => subDays(d, -amount * 7));
        else if (view === 'month') {
            const newDate = new Date(selectedDate);
            newDate.setMonth(newDate.getMonth() + amount);
            setSelectedDate(newDate);
        }
    };

    if (!isManagement) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center space-y-4">
                <Shield className="h-20 w-20 text-rose-500 animate-bounce" />
                <h1 className="text-3xl font-headline font-black">عذراً، هذه الصفحة مخصصة للإدارة فقط</h1>
                <Button asChild size="lg" className="rounded-2xl px-8"><Link href="/home">العودة للرئيسية</Link></Button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950/20">
                <div className="flex flex-col items-center gap-6">
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                    <p className="text-primary font-bold animate-pulse tracking-[0.2em]">جاري تجهيز خارطة الانضباط...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn(
            "min-h-screen p-2 md:p-6 lg:p-10 space-y-12 pb-40 transition-colors duration-700 font-body",
            theme.isLight ? "text-slate-900" : "text-white"
        )}>
            {/* Premium Header Section */}
            <div className="relative max-w-7xl mx-auto rounded-[3rem] overflow-hidden p-8 md:p-12 mb-10 shadow-2xl border border-white/10 group">
                <div className={cn(
                    "absolute inset-0 bg-gradient-to-br transition-all duration-1000",
                    theme.isLight
                        ? "from-slate-100 via-white to-slate-50 opacity-100"
                        : "from-blue-600/30 via-indigo-600/10 to-transparent opacity-80"
                )} />
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-[0.03] pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
                    <div className="space-y-4 text-center lg:text-right">
                        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20 text-primary mb-2">
                            <Activity className="h-4 w-4 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">مركز المتابعة الحية</span>
                        </div>
                        <h1 className={cn(
                            "text-4xl md:text-6xl font-headline font-black tracking-tight",
                            theme.isLight ? "text-slate-900" : "text-transparent bg-clip-text bg-gradient-to-l from-white to-white/60"
                        )}>
                            مراقبة تسجيل الحصص
                        </h1>
                        <p className={cn(
                            "text-lg font-medium max-w-xl mx-auto lg:mx-0 opacity-70",
                            theme.isLight ? "text-slate-600" : "text-blue-100/70"
                        )}>
                            نظام متقدم لمتابعة انضباط المشايخ في توثيق المسار التعليمي وضمان استمرارية التقارير اليومية للأفواج.
                        </p>
                    </div>

                    {/* Navigation Dashboard */}
                    <div className={cn(
                        "flex flex-col items-center gap-4 p-6 rounded-[2.5rem] border border-white/20 backdrop-blur-3xl shadow-2xl transition-all duration-700",
                        theme.isLight ? "bg-white/70" : "bg-white/5"
                    )}>
                        <div className="flex items-center gap-4">
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-2xl h-12 w-12 border-primary/20 hover:bg-primary/10 transition-all active:scale-95"
                                onClick={() => navigateDate('prev')}
                            >
                                <ChevronRight className="h-6 w-6 text-primary" />
                            </Button>

                            <div className="text-center min-w-[180px]">
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-1">
                                    {view === 'day' ? 'معاينة يوم' : view === 'week' ? 'معاينة أسبوع' : 'معاينة شهر'}
                                </p>
                                <h3 className="text-xl font-black whitespace-nowrap">
                                    {view === 'day'
                                        ? format(selectedDate, 'EEEE, d MMMM', { locale: ar })
                                        : view === 'week'
                                            ? `${format(startOfWeek(selectedDate, { weekStartsOn: 6 }), 'd MMM')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 6 }), 'd MMM yyyy')}`
                                            : format(selectedDate, 'MMMM yyyy', { locale: ar })
                                    }
                                </h3>
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-2xl h-12 w-12 border-primary/20 hover:bg-primary/10 transition-all active:scale-95"
                                onClick={() => navigateDate('next')}
                            >
                                <ChevronLeft className="h-6 w-6 text-primary" />
                            </Button>
                        </div>
                        <Button
                            variant="link"
                            className="text-[10px] font-bold opacity-40 hover:opacity-100"
                            onClick={() => setSelectedDate(new Date())}
                        >
                            العودة لليوم الحالي
                        </Button>
                    </div>
                </div>
            </div>

            {/* View Switching Logic */}
            <div className="max-w-7xl mx-auto space-y-10">
                <Tabs value={view} onValueChange={(v: any) => setView(v)} className="w-full">
                    <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-8">
                        <TabsList className={cn(
                            "p-2 h-auto grid grid-cols-3 gap-3 rounded-[2rem] border transition-all duration-700 w-full md:w-[450px]",
                            theme.isLight ? "bg-slate-100/50 border-slate-200" : "bg-white/5 border-white/10"
                        )}>
                            <TabsTrigger value="day" className="rounded-2xl py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl transition-all font-black text-xs">
                                المتابعة اليومية
                            </TabsTrigger>
                            <TabsTrigger value="week" className="rounded-2xl py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl transition-all font-black text-xs">
                                سجل الأسبوع
                            </TabsTrigger>
                            <TabsTrigger value="month" className="rounded-2xl py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl transition-all font-black text-xs">
                                تقرير الشهر
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex gap-4">
                            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="text-xs font-black">تم التسجيل</span>
                            </div>
                            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-xs font-black">قيد الانتظار</span>
                            </div>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div
                            key={view}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.5 }}
                        >
                            <TabsContent value="day" className="mt-0 focus-visible:ring-0">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                    {dayStatus.map((data, idx) => (
                                        <SheikhCard key={data.sheikh.uid} data={data} theme={theme} index={idx} />
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="week" className="mt-0 focus-visible:ring-0">
                                <MatrixView
                                    sheikhs={monitoringData}
                                    theme={theme}
                                    interval={eachDayOfInterval({
                                        start: startOfWeek(selectedDate, { weekStartsOn: 6 }),
                                        end: endOfWeek(selectedDate, { weekStartsOn: 6 })
                                    })}
                                />
                            </TabsContent>

                            <TabsContent value="month" className="mt-0 focus-visible:ring-0">
                                <MatrixView
                                    sheikhs={monitoringData}
                                    theme={theme}
                                    interval={eachDayOfInterval({
                                        start: startOfMonth(selectedDate),
                                        end: endOfMonth(selectedDate)
                                    })}
                                />
                            </TabsContent>
                        </motion.div>
                    </AnimatePresence>
                </Tabs>
            </div>

            {/* Premium Stats Grid */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pt-10 border-t border-white/5">
                <HighlightCard
                    title="القدرة التشغيلية"
                    value={`${sheikhs.length} فوج`}
                    label="إجمالي الأفواج النشطة"
                    icon={<Users className="h-6 w-6 text-blue-400" />}
                    color="blue"
                    theme={theme}
                />
                <HighlightCard
                    title="معدل الإنجاز"
                    value={`${dayStatus.filter(d => d.status === 'recorded').length}`}
                    label="شيخاً سجلوا حصتهم اليوم"
                    icon={<CheckCircle2 className="h-6 w-6 text-emerald-400" />}
                    color="emerald"
                    theme={theme}
                />
                <HighlightCard
                    title="المتابعة المطلوبة"
                    value={`${dayStatus.filter(d => d.status === 'missing').length}`}
                    label="في انتظار توثيق الحصة"
                    icon={<Clock className="h-6 w-6 text-amber-400" />}
                    color="amber"
                    theme={theme}
                />
                <HighlightCard
                    title="نسبة الانضباط"
                    value={`${Math.round((dayStatus.filter(d => d.status === 'recorded').length / (sheikhs.length || 1)) * 100)}%`}
                    label="إجمالي دقة البيانات اليوم"
                    icon={<Flame className="h-6 w-6 text-rose-400" />}
                    color="rose"
                    theme={theme}
                />
            </div>
        </div>
    );
}

function SheikhCard({ data, theme, index }: { data: any, theme: any, index: number }) {
    const isRecorded = data.status === 'recorded';

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
        >
            <Card className={cn(
                "relative h-full overflow-hidden transition-all duration-700 border-2 rounded-[2.5rem] group hover:shadow-2xl hover:-translate-y-2",
                theme.isLight
                    ? (isRecorded ? "bg-white border-emerald-100 " : "bg-white border-rose-100")
                    : (isRecorded ? "bg-slate-900/50 border-emerald-500/20" : "bg-slate-900/50 border-rose-500/20")
            )}>
                {/* Background Glow */}
                <div className={cn(
                    "absolute -top-24 -right-24 w-48 h-48 blur-[80px] transition-all duration-1000 group-hover:blur-[60px]",
                    isRecorded ? "bg-emerald-500/20" : "bg-rose-500/20"
                )} />

                <CardContent className="p-8 space-y-8 relative z-10 h-full flex flex-col justify-between">
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div className={cn(
                                "h-16 w-16 rounded-[1.5rem] flex items-center justify-center border-2 transition-all duration-700 group-hover:rotate-12",
                                isRecorded
                                    ? "bg-emerald-500/10 border-emerald-500/30"
                                    : "bg-rose-500/10 border-rose-500/30"
                            )}>
                                <User className={cn(
                                    "h-8 w-8",
                                    isRecorded ? "text-emerald-500" : "text-rose-500"
                                )} />
                            </div>
                            <div className={cn(
                                "p-2 rounded-xl border border-white/10 backdrop-blur-md",
                                isRecorded ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                            )}>
                                {isRecorded ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="text-xl font-black truncate tracking-tight">{data.sheikh.displayName}</h3>
                            <div className="flex items-center gap-2">
                                <Users className="h-3 w-3 opacity-40" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">{data.sheikh.group}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className={cn(
                            "p-4 rounded-3xl border transition-all duration-500",
                            isRecorded
                                ? (theme.isLight ? "bg-emerald-50 border-emerald-200" : "bg-emerald-500/5 border-emerald-500/10")
                                : (theme.isLight ? "bg-rose-50 border-rose-200" : "bg-rose-500/5 border-rose-500/10")
                        )}>
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">مستوى الالتزام</span>
                                <span className={cn("text-[10px] font-black", isRecorded ? "text-emerald-500" : "text-rose-500")}>
                                    {isRecorded ? 'نظامي' : 'متأخر'}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: isRecorded ? '100%' : '15%' }}
                                    className={cn("h-full rounded-full", isRecorded ? "bg-emerald-500" : "bg-rose-500")}
                                />
                            </div>
                        </div>

                        {data.session ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-black">{data.session.sessionType}</span>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    <Clock className="h-3 w-3" />
                                    <span className="text-[10px] font-black">18:30</span>
                                </div>
                            </div>
                        ) : (
                            <Button variant="ghost" className="w-full rounded-2xl border-2 border-dashed border-rose-500/20 text-rose-500 h-10 group-hover:bg-rose-500/5">
                                <Megaphone className="h-4 w-4 ml-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest">إرسال تنبيه</span>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

function MatrixView({ sheikhs, interval, theme }: { sheikhs: any[], interval: Date[], theme: any }) {
    return (
        <Card className={cn(
            "rounded-[3rem] border-2 shadow-2xl overflow-hidden backdrop-blur-xl",
            theme.isLight ? "bg-white border-slate-100" : "bg-slate-900 border-white/5"
        )}>
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr>
                            <th className={cn(
                                "p-8 text-sm font-black whitespace-nowrap sticky right-0 z-20 w-64 border-l border-b",
                                theme.isLight ? "bg-slate-50 border-slate-100" : "bg-slate-900/90 border-white/5"
                            )}>
                                الفوج / الشيخ
                            </th>
                            {interval.map((day) => (
                                <th key={day.toISOString()} className={cn(
                                    "p-8 min-w-[120px] text-center border-b",
                                    theme.isLight ? "border-slate-100" : "border-white/5"
                                )}>
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] font-black opacity-40 uppercase tracking-[0.2em]">
                                            {format(day, 'EEEE', { locale: ar })}
                                        </span>
                                        <span className="text-sm font-black tracking-tight">{format(day, 'd MMM')}</span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {sheikhs.map((data) => (
                            <tr key={data.sheikh.uid} className="group hover:bg-primary/[0.02] transition-colors">
                                <td className={cn(
                                    "p-6 sticky right-0 z-10 border-l transition-colors duration-700",
                                    theme.isLight ? "bg-white border-slate-100 group-hover:bg-slate-50" : "bg-slate-900/95 border-white/5 group-hover:bg-slate-950/50"
                                )}>
                                    <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                            <User className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-black truncate mb-1">{data.sheikh.displayName}</p>
                                            <Badge variant="outline" className="text-[10px] font-black border-primary/20 text-primary">
                                                {data.sheikh.group}
                                            </Badge>
                                        </div>
                                    </div>
                                </td>
                                {interval.map((day) => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const sessionOnDay = data.sessions.find(s => s.dateStr === dateStr);
                                    return (
                                        <td key={day.toISOString()} className="p-4 text-center">
                                            <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <motion.div
                                                            whileHover={{ scale: 1.2, rotate: 5 }}
                                                            className={cn(
                                                                "h-10 w-10 rounded-2xl mx-auto flex items-center justify-center transition-all duration-500 cursor-pointer shadow-lg",
                                                                sessionOnDay
                                                                    ? "bg-emerald-500 shadow-emerald-500/20 text-white"
                                                                    : "bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-white/10"
                                                            )}
                                                        >
                                                            {sessionOnDay ? (
                                                                <CheckCircle2 className="h-5 w-5" />
                                                            ) : (
                                                                <XCircle className="h-5 w-5 opacity-40" />
                                                            )}
                                                        </motion.div>
                                                    </TooltipTrigger>
                                                    {sessionOnDay && (
                                                        <TooltipContent className="bg-slate-900 border border-emerald-500/30 text-white p-5 rounded-[2rem] shadow-2xl min-w-[200px] backdrop-blur-3xl">
                                                            <div className="space-y-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-emerald-500/20 rounded-xl">
                                                                        <BookOpen className="h-4 w-4 text-emerald-400" />
                                                                    </div>
                                                                    <p className="text-sm font-black">{sessionOnDay.sessionType}</p>
                                                                </div>
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div className="p-3 bg-white/5 rounded-2xl text-center">
                                                                        <p className="text-[10px] opacity-40 font-bold mb-1">الطلاب</p>
                                                                        <p className="text-xs font-black">{sessionOnDay.records?.length || 0}</p>
                                                                    </div>
                                                                    <div className="p-3 bg-white/5 rounded-2xl text-center">
                                                                        <p className="text-[10px] opacity-40 font-bold mb-1">الوقت</p>
                                                                        <p className="text-xs font-black">19:45</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TooltipContent>
                                                    )}
                                                </Tooltip>
                                            </TooltipProvider>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function HighlightCard({ title, value, label, icon, color, theme }: { title: string, value: string | number, label: string, icon: React.ReactNode, color: string, theme: any }) {
    const colorMap: any = {
        blue: "from-blue-500 to-indigo-600 shadow-blue-500/20 text-blue-500",
        emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/20 text-emerald-500",
        amber: "from-amber-500 to-orange-600 shadow-amber-500/20 text-amber-500",
        rose: "from-rose-500 to-red-600 shadow-rose-500/20 text-rose-500"
    };

    return (
        <Card className={cn(
            "relative overflow-hidden transition-all duration-700 rounded-[2.5rem] border shadow-xl hover:shadow-2xl hover:-translate-y-2 group",
            theme.isLight ? "bg-white border-slate-100" : "bg-slate-900 border-white/5"
        )}>
            <div className={cn(
                "absolute -top-12 -right-12 w-32 h-32 blur-[60px] opacity-10 transition-all duration-700 group-hover:scale-150 group-hover:opacity-20",
                `bg-${color}-500/40`
            )} />

            <CardContent className="p-8 space-y-4">
                <div className="flex justify-between items-center">
                    <div className={cn("p-4 rounded-2xl bg-white/5 border border-white/5 shadow-inner", colorMap[color].split(' ')[2])}>
                        {icon}
                    </div>
                    <Star className="h-4 w-4 opacity-10 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                    <p className="text-xs font-black opacity-40 uppercase tracking-[0.3em] mb-2">{title}</p>
                    <h3 className="text-4xl font-headline font-black mb-1 tracking-tighter">{value}</h3>
                    <p className="text-[10px] font-bold opacity-30">{label}</p>
                </div>
            </CardContent>
        </Card>
    );
}
