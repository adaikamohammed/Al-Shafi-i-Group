"use client";

import React, { useMemo, useState, memo } from 'react';
import { Award, GraduationCap, Shield, BookOpen, FolderKanban, User as UserIcon, Phone, Archive, CheckCircle, XCircle, UserX, Loader2, ArrowRight, BarChart3, PieChart as PieChartIcon, TrendingUp, ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { format, parseISO, getYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Student } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { cn } from '@/lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ReTooltip, Legend, LineChart, Line } from 'recharts';

const statusVariant: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    "نشط": "default",
    "مطرود": "destructive",
    "محذوف": "outline"
};

interface StudentProfileCardProps {
    student: Student;
    user: any;
    rankingData: any[];
    medalHistory: { history: (string | null)[]; goldCount: number; grandMaster: boolean };
    onEdit: () => void;
    onViewStats: () => void;
}

export const StudentProfileCard = memo(({ student, user, rankingData, medalHistory, onEdit, onViewStats }: StudentProfileCardProps) => {
    const { allUsers } = useStudentContext();
    const [showStats, setShowStats] = useState(false);

    const supervisorName = useMemo(() => {
        const supervisor = allUsers.find(u => u.uid === student.ownerId);
        return supervisor?.displayName || student.sheikhName || 'غير محدد';
    }, [allUsers, student.ownerId, student.sheikhName]);

    const { rank, commitmentBalance, stats } = useMemo(() => {
        const studentRankData = rankingData.find((r: any) => r.id === student.id);
        if (!studentRankData) return { rank: 'N/A', commitmentBalance: 0, stats: null };
        const rankIndex = rankingData.findIndex((r: any) => r.id === student.id);
        const rankToShow = rankIndex !== -1 ? rankIndex + 1 : 'N/A';
        return {
            rank: rankToShow,
            commitmentBalance: studentRankData.stats.commitmentBalance,
            stats: studentRankData.stats
        }
    }, [rankingData, student.id]);

    const attendanceData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'حضور', value: stats.present, color: '#10b981' },
            { name: 'غياب', value: stats.absent, color: '#ef4444' },
            { name: 'تعويض', value: stats.makeup, color: '#f59e0b' },
        ].filter(d => d.value > 0);
    }, [stats]);

    const behaviorData = useMemo(() => {
        if (!stats) return [];
        return [
            { name: 'هادئ', value: stats.calm, color: '#10b981' },
            { name: 'مقبول', value: stats.medium, color: '#f59e0b' },
            { name: 'مشاغب', value: stats.undisciplined, color: '#ef4444' },
        ];
    }, [stats]);

    const timelineItems = useMemo(() => {
        const items: any[] = [];

        (student.covenants || []).forEach(c => {
            try {
                items.push({
                    date: parseISO(c.date),
                    type: 'covenant',
                    item: c
                });
            } catch (e) { console.error("Invalid covenant date", (e as Error).message) }
        });

        (student.expulsionHistory || []).forEach(e => {
            try {
                items.push({
                    date: parseISO(e.date),
                    type: 'expulsion',
                    item: e
                });
            } catch (e) { console.error("Invalid expulsion date", (e as Error).message) }
        });

        (student.transferHistory || []).forEach(t => {
            try {
                items.push({
                    date: parseISO(t.date),
                    type: 'transfer',
                    item: t
                });
            } catch (e) { console.error("Invalid transfer date", (e as Error).message) }
        });

        return items.sort((a, b) => b.date.getTime() - a.date.getTime());

    }, [student.covenants, student.expulsionHistory]);

    const totalCovenants = student.covenants?.length || 0;
    const fulfilledCovenants = student.covenants?.filter(c => c.status === 'تم الوفاء بها').length || 0;

    return (
        <DialogContent className="sm:max-w-3xl p-0 flex flex-col max-h-[90vh] overflow-hidden border-none shadow-2xl animate-in-up">
            <DialogHeader className="sr-only">
                <DialogTitle>ملف الطالب: {student.fullName}</DialogTitle>
                <DialogDescription>عرض تفصيلي لبيانات وأداء الطالب.</DialogDescription>
            </DialogHeader>

            {showStats ? (
                <div className="flex flex-col h-full bg-background">
                    <div className="p-6 border-b flex items-center justify-between bg-primary/5">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => setShowStats(false)}>
                                <ArrowRight className="h-5 w-5" />
                            </Button>
                            <div>
                                <h2 className="text-xl font-headline font-bold text-primary">الإحصائيات الشاملة</h2>
                                <p className="text-sm text-muted-foreground font-body">{student.fullName}</p>
                            </div>
                        </div>
                        <Badge variant="outline" className="font-bold">الشهر الحالي</Badge>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Attendance Pie Chart */}
                            <Card className="border-border/40 shadow-sm overflow-hidden">
                                <CardHeader className="pb-2 bg-muted/30">
                                    <CardTitle className="text-sm font-headline flex items-center gap-2">
                                        <PieChartIcon className="h-4 w-4" /> توزيع الحضور والغياب
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px] p-4">
                                    {attendanceData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={attendanceData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {attendanceData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <ReTooltip />
                                                <Legend formatter={(value) => <span className="font-body text-xs">{value}</span>} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground font-body text-sm">
                                            لا توجد بيانات سجل حضور لهذا الشهر
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Behavior Bar Chart */}
                            <Card className="border-border/40 shadow-sm overflow-hidden">
                                <CardHeader className="pb-2 bg-muted/30">
                                    <CardTitle className="text-sm font-headline flex items-center gap-2">
                                        <BarChart3 className="h-4 w-4" /> تقييم السلوك والانضباط
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px] p-4 font-body">
                                    {stats ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={behaviorData}>
                                                <XAxis dataKey="name" fontSize={10} tick={{ fill: 'currentColor' }} />
                                                <YAxis fontSize={10} />
                                                <ReTooltip />
                                                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                    {behaviorData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-muted-foreground font-body text-sm">
                                            لا توجد بيانات سلوك
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Summary Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <Card className="p-4 bg-primary/5 border-none">
                                <p className="text-[10px] text-muted-foreground font-body">إجمالي النقاط</p>
                                <p className="text-2xl font-bold text-primary font-headline">{(rankingData.find(r => r.id === student.id)?.points || 0)}</p>
                            </Card>
                            <Card className="p-4 bg-emerald-50 border-none">
                                <p className="text-[10px] text-emerald-600 font-body">نسبة الحضور</p>
                                <p className="text-2xl font-bold text-emerald-700 font-headline">
                                    {stats ? Math.round((stats.present / (stats.present + stats.absent || 1)) * 100) : 0}%
                                </p>
                            </Card>
                            <Card className="p-4 bg-amber-50 border-none">
                                <p className="text-[10px] text-amber-600 font-body">المستوى الحالي</p>
                                <p className="text-xl font-bold text-amber-700 font-headline">{student.subscriptionTier}</p>
                            </Card>
                            <Card className="p-4 bg-blue-50 border-none">
                                <p className="text-[10px] text-blue-600 font-body">رتبة الفوج</p>
                                <p className="text-2xl font-bold text-blue-700 font-headline">{rank !== 'N/A' ? `#${rank}` : '--'}</p>
                            </Card>
                        </div>
                    </div>

                    <DialogFooter className="border-t p-6 bg-muted/5 glass">
                        <Button variant="outline" onClick={() => setShowStats(false)} className="w-full font-headline font-bold">العودة للملف الشخصي</Button>
                    </DialogFooter>
                </div>
            ) : (
                <>

                    {/* Premium Header with Glassmorphism */}
                    <div className="relative p-8 flex flex-col items-center bg-gradient-to-b from-primary/10 to-transparent">
                        <Avatar className="w-28 h-28 mb-4 border-4 border-background shadow-xl ring-4 ring-primary/20 transition-transform hover:scale-105">
                            <AvatarImage src={student.photoURL} alt={student.fullName} />
                            <AvatarFallback className="bg-primary/5 text-primary text-3xl font-headline">
                                {student.fullName.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <h2 className="text-3xl font-headline font-bold flex items-center gap-3 text-primary">
                            {student.fullName}
                            {medalHistory.grandMaster && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger>
                                            <Award className="h-8 w-8 text-accent animate-pulse" />
                                        </TooltipTrigger>
                                        <TooltipContent className="glass shadow-xl border-border/50">
                                            <p className="font-body font-bold">وسام "المتقن الكبير" (3 ميداليات ذهبية متتالية)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </h2>
                        <div className="flex items-center gap-4 mt-3">
                            <Badge variant={statusVariant[student.status] || "secondary"} className="px-3 py-1 font-bold shadow-sm">{student.status}</Badge>
                            <div className="flex items-center gap-2 text-muted-foreground font-body">
                                <UserIcon className="h-4 w-4" />
                                <span className="text-sm">بإشراف: {supervisorName}</span>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto px-6 pb-8 space-y-6">
                        {student.status === 'مطرود' && student.expulsionDate && (
                            <Card className="bg-red-50/50 border-red-200 shadow-sm animate-pulse">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base text-red-800 flex items-center gap-2 font-headline">
                                        <UserX className="h-5 w-5" />
                                        حالة طرد مفعلة
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-red-700 font-body">
                                    <p><strong>التاريخ:</strong> {format(parseISO(student.expulsionDate), 'd MMMM yyyy', { locale: ar })}</p>
                                    <p><strong>السبب:</strong> {student.expulsionReason || 'لم يحدد سبب'}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Performance Dashboard */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-3 bg-primary/10 rounded-xl text-primary">
                                        <GraduationCap className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-body">المستوى الدراسي</p>
                                        <p className="font-bold font-headline text-lg leading-none">{student.educationalLevel || 'غير محدد'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-3 bg-accent/10 rounded-xl text-accent">
                                        <Award className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-body">الترتيب الشهري</p>
                                        <p className="font-bold font-headline text-lg leading-none text-accent">{rank !== 'N/A' ? `#${rank}` : '--'}</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="p-3 bg-orange-100/50 rounded-xl text-orange-600">
                                        <FolderKanban className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground font-body">ميزان الالتزام</p>
                                        <p className={cn("font-bold font-headline text-lg leading-none", commitmentBalance > 0 ? "text-red-500" : "text-green-600")}>
                                            {commitmentBalance > 0 ? `${commitmentBalance} حصص` : "منضبط"}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Basic Info Card */}
                            <Card className="border-border/40 shadow-sm">
                                <CardHeader className="pb-3 bg-muted/30">
                                    <CardTitle className="text-sm font-headline flex items-center gap-2">
                                        <UserIcon className="h-4 w-4" /> البيانات الأساسية
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 space-y-3 font-body">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">فئة الاشتراك:</span>
                                        <Badge variant="outline" className="font-bold">{student.subscriptionTier}</Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">مقدار الحفظ:</span>
                                        <span className="font-bold text-primary">{student.dailyMemorizationAmount}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">اسم الولي:</span>
                                        <span className="font-bold">{student.guardianName}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">رقم الهاتف:</span>
                                        <span className="font-bold flex items-center gap-1 dir-ltr">
                                            {student.phone1} <Phone className="h-3 w-3" />
                                            {student.hasWhatsApp !== false ? (
                                                <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded border border-green-200 dark:border-green-900/50 mr-1 font-bold">واتساب ✅</span>
                                            ) : (
                                                <span className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-950/30 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800 mr-1 font-bold">SMS ✉️</span>
                                            )}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Medal Harvest */}
                            <Card className="border-border/40 shadow-sm">
                                <CardHeader className="pb-3 bg-muted/30">
                                    <CardTitle className="text-sm font-headline flex items-center gap-2">
                                        <Award className="h-4 w-4" /> حصاد الأوسمة السنوي
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="grid grid-cols-6 gap-2">
                                        {medalHistory.history.slice(0, 12).map((medal, index) => {
                                            const monthName = format(new Date(2024, index, 1), 'MMM', { locale: ar });
                                            return (
                                                <div key={index} className="flex flex-col items-center gap-1">
                                                    <span className="text-[10px] text-muted-foreground">{monthName}</span>
                                                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center text-sm shadow-inner",
                                                        medal === 'gold' ? 'bg-medal-gold' :
                                                            medal === 'silver' ? 'bg-medal-silver' :
                                                                medal === 'bronze' ? 'bg-medal-bronze' :
                                                                    'bg-background border border-muted'
                                                    )}>
                                                        {medal === 'gold' ? '🥇' : medal === 'silver' ? '🥈' : medal === 'bronze' ? '🥉' : ''}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="mt-4 pt-3 border-t text-center">
                                        <p className="text-sm font-body">إجمالي الميداليات الذهبية: <span className="font-bold text-accent text-lg">{medalHistory.goldCount}</span></p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Timeline with Enhanced Design */}
                        <Card className="border-border/40 shadow-sm overflow-hidden">
                            <CardHeader className="pb-3 bg-muted/30 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-headline flex items-center gap-2">
                                    <Archive className="h-4 w-4" /> السجل التاريخي والتأديبي
                                </CardTitle>
                                {totalCovenants > 0 && (
                                    <Badge variant="secondary" className="text-[10px] font-bold">
                                        الإنجاز: {fulfilledCovenants} / {totalCovenants}
                                    </Badge>
                                )}
                            </CardHeader>
                            <CardContent className="p-6">
                                {timelineItems.length > 0 ? (
                                    <div className="relative pr-8 pl-2 space-y-6 before:absolute before:right-3 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-border before:via-primary/20 before:to-border">
                                        {timelineItems.map((timelineItem, index) => {
                                            const isCovenant = timelineItem.type === 'covenant';
                                            const item = timelineItem.item;
                                            const dateStr = format(timelineItem.date, 'd MMM yyyy', { locale: ar });

                                            const typeColors: any = {
                                                'covenant': 'bg-primary/10 text-primary border-primary/20',
                                                'expulsion': 'bg-red-100 text-red-700 border-red-200',
                                                'transfer': 'bg-blue-100 text-blue-700 border-blue-200',
                                                'إجراء تأديبي': 'bg-amber-100 text-amber-900 border-amber-200'
                                            };

                                            return (
                                                <div key={index} className="relative animate-in-up" style={{ animationDelay: `${index * 50}ms` }}>
                                                    <div className={cn(
                                                        "absolute right-[-26px] top-1 h-4 w-4 rounded-full ring-4 ring-background z-10 flex items-center justify-center",
                                                        isCovenant ? (item.type === 'إجراء تأديبي' ? 'bg-amber-500' : 'bg-primary') : timelineItem.type === 'transfer' ? 'bg-blue-600' : 'bg-red-600'
                                                    )}>
                                                        {timelineItem.type === 'transfer' && <ArrowRightLeft className="h-2 w-2 text-white" />}
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center justify-between">
                                                            <Badge variant="outline" className={cn("text-[10px] font-bold", typeColors[timelineItem.type])}>
                                                                {isCovenant ? item.type : timelineItem.type === 'transfer' ? 'نقل طالب' : "قرار طرد جاد"}
                                                            </Badge>
                                                            <span className="text-[11px] text-muted-foreground font-body">{dateStr}</span>
                                                        </div>
                                                        <div className={cn(
                                                            "p-3 rounded-lg border-r-4 font-body shadow-sm",
                                                            isCovenant && item.card === 'بطاقة صفراء' ? 'bg-yellow-50/50 border-yellow-400' :
                                                                isCovenant && item.card === 'بطاقة حمراء' ? 'bg-red-50/50 border-red-500' :
                                                                    timelineItem.type === 'transfer' ? 'bg-blue-50/30 border-blue-400' :
                                                                        'bg-muted/30 border-muted'
                                                        )}>
                                                            {timelineItem.type === 'transfer' ? (
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-medium">
                                                                        تم نقله من <span className="font-bold text-primary">{item.fromSheikhName}</span> <span className="text-xs text-muted-foreground">({item.fromGroupName})</span> إلى <span className="font-bold text-primary">{item.toSheikhName}</span> <span className="text-xs text-muted-foreground">({item.toGroupName})</span>
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">السبب: {item.reason}</p>
                                                                </div>
                                                            ) : (
                                                                <p className="text-sm font-medium">
                                                                    {isCovenant ? (
                                                                        <span className="flex flex-col gap-1">
                                                                            <span>{item.text}</span>
                                                                            {item.commitmentType && <span className="text-[9px] bg-gray-100 text-gray-500 w-fit px-1.5 rounded">{item.commitmentType}</span>}
                                                                        </span>
                                                                    ) : item.reason}
                                                                </p>
                                                            )}
                                                            {isCovenant && (
                                                                <div className="mt-2 text-[10px] space-y-2">
                                                                    {item.type === 'إجراء تأديبي' ? (
                                                                        <>
                                                                            {/* Penalty Details */}
                                                                            <div className="grid grid-cols-2 gap-2 bg-white/50 p-2 rounded border border-amber-200/50">
                                                                                {item.absenceDays && (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-muted-foreground text-[9px]">أيام الغياب</span>
                                                                                        <span className="font-bold text-red-600">{item.absenceDays} أيام</span>
                                                                                    </div>
                                                                                )}
                                                                                {item.writtenPenalty && (
                                                                                    <div className="flex flex-col col-span-2">
                                                                                        <span className="text-muted-foreground text-[9px]">العقوبة الكتابية</span>
                                                                                        <div className="font-bold text-amber-900 leading-tight bg-amber-50 p-1.5 rounded text-xs mt-0.5 border border-amber-100">
                                                                                            {item.writtenPenalty}
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                                {item.dueDate && (
                                                                                    <div className="flex flex-col">
                                                                                        <span className="text-muted-foreground text-[9px]">تاريخ الاستحقاق</span>
                                                                                        <span className="font-bold">{format(parseISO(item.dueDate), 'd MMM yyyy', { locale: ar })}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Status Badge for Disciplinary */}
                                                                            <div className="mt-2 flex items-center justify-between">
                                                                                <Badge variant="outline" className={cn("text-[9px]",
                                                                                    item.status === 'تم الوفاء بها' ? "bg-green-50 text-green-700 border-green-200" :
                                                                                        item.status === 'نُقِض' ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-500"
                                                                                )}>
                                                                                    {item.status || 'نشط'}
                                                                                </Badge>
                                                                            </div>

                                                                            {/* Compensation Details */}
                                                                            {(item.compensationSessions || item.compensationDate) && (
                                                                                <div className="mt-2 pt-2 border-t border-amber-200/50">
                                                                                    <span className="text-[10px] font-bold text-blue-800 block mb-1">تفاصيل التعويض:</span>
                                                                                    <div className="flex flex-wrap gap-2 text-[10px]">
                                                                                        {item.compensationSessions && (
                                                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                                                                {item.compensationSessions} حصص
                                                                                            </Badge>
                                                                                        )}
                                                                                        {item.compensationDate && (
                                                                                            <span className="flex items-center gap-1 text-muted-foreground">
                                                                                                <ArrowRight className="h-3 w-3" />
                                                                                                {format(parseISO(item.compensationDate), 'd MMM', { locale: ar })}
                                                                                            </span>
                                                                                        )}
                                                                                        <Badge variant={item.isCompensated ? "default" : "secondary"} className={cn("text-[9px]", item.isCompensated ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-gray-100 text-gray-500")}>
                                                                                            {item.isCompensated ? "تم التعويض ✅" : "لم يتم التعويض بعد"}
                                                                                        </Badge>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1 font-bold opacity-70">
                                                                            {item.status === 'تم الوفاء بها' ? <CheckCircle className="h-3 w-3 text-green-600" /> : <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
                                                                            <span>الحالة: {item.status}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="py-8 text-center bg-muted/10 rounded-xl border border-dashed">
                                        <p className="text-sm text-muted-foreground font-body">لا يوجد سجل تاريخي أو تأديبي حالياً لهذا الطالب.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <DialogFooter className="border-t p-6 gap-3 flex-col sm:flex-row glass">
                        <Button variant="outline" onClick={onEdit} className="flex-1 font-headline font-bold hover:bg-muted">تعديل البيانات</Button>
                        <Button onClick={onViewStats} className="flex-1 font-headline font-bold shadow-lg shadow-primary/20">عرض الإحصائيات الشاملة</Button>
                    </DialogFooter>
                </>
            )}
        </DialogContent>
    );
});
