"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, UserCheck, Shield, UserPlus, TrendingUp, BarChart3, Award, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';
import { GroupSelector } from './GroupSelector';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    startOfWeek, endOfWeek,
    startOfMonth, endOfMonth,
    startOfQuarter, endOfQuarter,
    startOfYear, endOfYear,
    isWithinInterval, parseISO, format
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFCM } from '@/hooks/useFCM';
import { MonitoringRadar } from './MonitoringRadar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { CalendarDays, CalendarRange, CalendarCheck, History, Info, Zap, Bell, BellOff } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: any;
    color: string;
    description?: string;
    theme: any;
}

const StatCard = ({ title, value, icon: Icon, color, description, theme }: StatCardProps) => (
    <Card className={cn(
        "relative overflow-hidden border-none shadow-xl transition-all duration-300 hover:scale-[1.02]",
        theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
    )}>
        <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-2xl", color)}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-right">
                    <p className="text-sm font-medium opacity-60 leading-tight">{title}</p>
                    <h3 className="text-3xl font-black font-headline mt-1 tracking-tight">{value}</h3>
                </div>
            </div>
            {description && (
                <div className="flex items-center gap-2 mt-2 opacity-60 text-xs font-body">
                    <TrendingUp className="h-3 w-3" />
                    <span>{description}</span>
                </div>
            )}
            {/* Background decoration */}
            <div className={cn("absolute -right-4 -bottom-4 opacity-10", color)}>
                <Icon size={120} />
            </div>
        </CardContent>
    </Card>
);

export const ManagementDashboard = () => {
    const { students, preRegistrations, allUsers, dailySessions, loading, generateDemoData } = useStudentContext();
    const { user } = useAuth();
    const [selectedGroup, setSelectedGroup] = React.useState<string>('all');
    const [timeframe, setTimeframe] = React.useState<string>('weekly');

    // FCM Integration
    const { permission, requestPermission } = useFCM();

    const aggregatedData = useMemo(() => {
        if (!dailySessions) return [];

        let start: Date, end: Date;
        const now = new Date();

        switch (timeframe) {
            case 'monthly':
                start = startOfMonth(now); end = endOfMonth(now); break;
            case 'seasonal':
                start = startOfQuarter(now); end = endOfQuarter(now); break;
            case 'yearly':
                start = startOfYear(now); end = endOfYear(now); break;
            case 'weekly':
            default:
                start = startOfWeek(now, { weekStartsOn: 6 });
                end = endOfWeek(now, { weekStartsOn: 6 }); break;
        }

        const uniqueGroups = Array.from(new Set(allUsers.filter(u => u.role === 'sheikh' && u.group).map(u => u.group)));

        return uniqueGroups.map(groupName => {
            let totalSessions = 0;
            let totalAttendance = 0;
            let totalRecords = 0;
            let totalReview = 0;
            let totalEvaluationPoints = 0;
            let totalBehaviorPoints = 0;

            Object.entries(dailySessions).forEach(([date, sessionsOnDay]) => {
                const sessionDate = parseISO(date);
                if (isWithinInterval(sessionDate, { start, end })) {
                    Object.values(sessionsOnDay).forEach((session: any) => {
                        const sheikh = allUsers.find(u => u.uid === session.ownerId);
                        if (sheikh?.group === groupName) {
                            totalSessions++;
                            (session.records || []).forEach(record => {
                                totalRecords++;
                                if (record.attendance === 'حاضر' || record.attendance === 'متأخر') totalAttendance++;
                                if (record.review) totalReview++;
                                const evalMap: Record<string, number> = { 'ممتاز': 100, 'جيد جداً': 80, 'جيد': 60, 'متوسط': 40, 'ضعيف': 20 };
                                totalEvaluationPoints += evalMap[record.memorization || ''] || 0;
                                const behavMap: Record<string, number> = { 'هادئ': 100, 'متوسط': 60, 'غير منضبط': 20 };
                                totalBehaviorPoints += behavMap[record.behavior || ''] || 0;
                            });
                        }
                    });
                }
            });

            const countRecords = totalRecords || 1;
            return {
                groupName,
                attendanceRate: Math.round((totalAttendance / countRecords) * 100),
                reviewRate: Math.round((totalReview / countRecords) * 100),
                evaluationScore: Math.round(totalEvaluationPoints / countRecords),
                behaviorScore: Math.round(totalBehaviorPoints / countRecords)
            };
        }).sort((a, b) => {
            const groupA = parseInt((a.groupName || '').replace(/[^0-9]/g, '')) || 999;
            const groupB = parseInt((b.groupName || '').replace(/[^0-9]/g, '')) || 999;
            return groupA - groupB;
        });
    }, [dailySessions, allUsers, timeframe]);

    React.useEffect(() => {
        const handleGenerate = () => generateDemoData(); // using the existing function name but new logic
        window.addEventListener('INITIALIZE_STRUCTURE', handleGenerate);
        return () => window.removeEventListener('INITIALIZE_STRUCTURE', handleGenerate);
    }, [generateDemoData]);

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const stats = React.useMemo(() => {
        let activeStudentsList = students;

        // Filter by Group Name instead of Owner ID to handle duplicates/merges
        if (selectedGroup !== 'all') {
            activeStudentsList = students.filter(s => s.groupName === selectedGroup);
        }

        const countActive = activeStudentsList.filter(s => s.status === 'نشط').length;

        // Fix: Count unique groups for Total Sheikhs
        const uniqueSheikhGroups = new Set(allUsers.filter(u => u.role === 'sheikh' && u.group).map(u => u.group));
        const totalSheikhs = selectedGroup === 'all' ? uniqueSheikhGroups.size : 1;

        const countPending = preRegistrations.filter(r => r.status === 'مرشح').length;

        // Group Comparison Data
        // 1. Get unique group names
        const uniqueGroups = Array.from(new Set(allUsers.filter(u => u.role === 'sheikh' && u.group).map(u => u.group)));

        const groupComparisonData = uniqueGroups.map(groupName => {
            // Find primary sheikh for display name (just pick one)
            const representativeSheikh = allUsers.find(u => u.group === groupName && u.role === 'sheikh');

            // CRITICAL: Filter students by groupName string, effectively merging all duplicates
            const groupStudents = students.filter(s => s.groupName === groupName);

            return {
                name: groupName || 'غير محدد',
                students: groupStudents.length,
                active: groupStudents.filter(s => s.status === 'نشط').length
            };
        })
            // Sort by Group Number (1-9)
            .sort((a, b) => {
                const groupA = parseInt((a.name || '').replace(/[^0-9]/g, '')) || 999;
                const groupB = parseInt((b.name || '').replace(/[^0-9]/g, '')) || 999;
                return groupA - groupB;
            });

        // Level Distribution Data
        const levelCounts: Record<string, number> = {};
        activeStudentsList.forEach(s => {
            const level = s.educationalLevel || 'غير محدد';
            levelCounts[level] = (levelCounts[level] || 0) + 1;
        });
        const levelDistributionData = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

        return {
            totalStudents: countActive,
            totalSheikhs: totalSheikhs,
            pendingRegs: countPending,
            completionRate: "92%",
            groupComparisonData,
            levelDistributionData,
            activeStudentsList
        };
    }, [students, preRegistrations, allUsers, selectedGroup]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

    return (
        <div className="w-full max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-1">
                    <h2 className="text-3xl font-headline font-bold">لوحة القيادة</h2>
                    <p className="text-muted-foreground opacity-60 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        نظرة شاملة ومراقبة حية لأداء المدرسة
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                        {permission === 'default' && (
                            <Button variant="outline" size="sm" onClick={requestPermission} className="gap-2 h-7 text-xs">
                                <Bell className="h-3 w-3" />
                                تفعيل التنبيهات
                            </Button>
                        )}
                        {permission === 'granted' && (
                            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-100">
                                <Bell className="h-3 w-3" />
                                <span>التنبيهات مفعلة</span>
                            </div>
                        )}
                        {permission === 'denied' && (
                            <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                                <BellOff className="h-3 w-3" />
                                <span>التنبيهات محظورة</span>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mr-2">
                            {format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
                    <Tabs value={timeframe} onValueChange={setTimeframe} className="w-full md:w-auto">
                        <TabsList className={cn(
                            "p-1 h-auto grid grid-cols-4 gap-1 rounded-xl border",
                            theme.isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                        )}>
                            <TabsTrigger value="weekly" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                                <CalendarDays className="ml-1 h-3 w-3" /> أسبوعي
                            </TabsTrigger>
                            <TabsTrigger value="monthly" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                                <CalendarRange className="ml-1 h-3 w-3" /> شهري
                            </TabsTrigger>
                            <TabsTrigger value="seasonal" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                                <CalendarCheck className="ml-1 h-3 w-3" /> فصلي
                            </TabsTrigger>
                            <TabsTrigger value="yearly" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-500 data-[state=active]:text-white">
                                <History className="ml-1 h-3 w-3" /> سنوي
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (window.confirm('هل أنت متأكد من توليد بيانات تجريبية؟ سيتم إضافة مشايخ وطلاب وهميين.')) {
                                    window.dispatchEvent(new CustomEvent('GENERATE_DEMO_DATA'));
                                }
                            }}
                            className={cn(
                                "gap-2 border-dashed h-10 rounded-xl",
                                theme.isLight ? "border-amber-500/50 hover:bg-amber-50/50" : "border-amber-500/30 hover:bg-amber-500/10"
                            )}
                        >
                            <Shield className="h-4 w-4" />
                            تهيئة
                        </Button>
                        <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />
                    </div>
                </div>
            </div>

            {/* Monitoring Radar Section - Added from Monitoring page */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <MonitoringRadar data={aggregatedData} selectedGroup={selectedGroup} />
                </div>
                <div className="space-y-6">
                    <Card className={cn(
                        "border-none shadow-xl h-full",
                        theme.isLight ? "bg-white text-slate-800" : "bg-white/5 text-white"
                    )}>
                        <CardHeader>
                            <CardTitle className="text-lg font-headline font-bold flex items-center gap-2">
                                <Zap className="h-5 w-5 text-amber-400" />
                                ملخص الأداء {timeframe === 'weekly' ? 'الأسبوعي' : timeframe === 'monthly' ? 'الشهري' : timeframe === 'seasonal' ? 'الفصلي' : 'السنوي'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {selectedGroup === 'all' ? (
                                <div className="space-y-4">
                                    <p className="text-sm opacity-60">يعرض الرادار متوسط أداء كافة الأفواج. يمكنك اختيار فوج محدد للحصول على تفاصيل دقيقة.</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                            <p className="text-xs opacity-60">إجمالي الأفواج</p>
                                            <p className="text-2xl font-black font-headline text-primary">{aggregatedData.length}</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                            <p className="text-xs opacity-60">متوسط الحضور</p>
                                            <p className="text-2xl font-black font-headline text-emerald-400">
                                                {aggregatedData.length > 0 ? Math.round(aggregatedData.reduce((acc, curr) => acc + curr.attendanceRate, 0) / aggregatedData.length) : 0}%
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {aggregatedData.find(g => g.groupName === selectedGroup) ? (
                                        <>
                                            <p className="text-sm font-bold">تحليل {selectedGroup}:</p>
                                            <ul className="space-y-3">
                                                <li className="flex justify-between items-center text-sm">
                                                    <span className="opacity-60">نسبة الحفظ:</span>
                                                    <span className="font-bold">{aggregatedData.find(g => g.groupName === selectedGroup)?.evaluationScore}%</span>
                                                </li>
                                                <li className="flex justify-between items-center text-sm">
                                                    <span className="opacity-60">وتيرة المراجعة:</span>
                                                    <span className="font-bold">{aggregatedData.find(g => g.groupName === selectedGroup)?.reviewRate}%</span>
                                                </li>
                                                <li className="flex justify-between items-center text-sm">
                                                    <span className="opacity-60">مستوى الانضباط:</span>
                                                    <span className="font-bold">{aggregatedData.find(g => g.groupName === selectedGroup)?.behaviorScore}%</span>
                                                </li>
                                            </ul>
                                        </>
                                    ) : (
                                        <p className="text-sm opacity-40">لا توجد بيانات لهذا الفوج في الفترة المختارة</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="إجمالي الطلبة النشطين"
                    value={stats.totalStudents}
                    icon={Users}
                    color="bg-blue-500"
                    description="طالب مسجل حالياً"
                    theme={theme}
                />
                <StatCard
                    title="عدد المشايخ"
                    value={stats.totalSheikhs}
                    icon={UserCheck}
                    color="bg-emerald-500"
                    description="شيخ يدرس في المدرسة"
                    theme={theme}
                />
                <StatCard
                    title="تسجيلات مرشحة"
                    value={stats.pendingRegs}
                    icon={UserPlus}
                    color="bg-amber-500"
                    description="في انتظار المراجعة"
                    theme={theme}
                />
                <StatCard
                    title="معدل الحفظ العام"
                    value={stats.completionRate}
                    icon={TrendingUp}
                    color="bg-purple-500"
                    description="نسبة إتقان السور المقررة"
                    theme={theme}
                />
            </div>

            {/* Main Sections Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Groups Overview */}
                <Card className={cn(
                    "lg:col-span-2 border-none shadow-2xl",
                    theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                )}>
                    <CardHeader className="border-b border-white/5">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-2xl font-headline font-bold flex items-center gap-3">
                                    <Shield className="text-primary h-6 w-6" />
                                    مراقبة الأفواج
                                </CardTitle>
                                <CardDescription className="opacity-60">نظرة عامة على أداء المجموعات التعليمية</CardDescription>
                            </div>
                            <Button variant="ghost" className="rounded-xl hover:bg-white/10" asChild>
                                <a href="/management/groups">عرض كل الأفواج</a>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className={cn(
                                    "text-xs uppercase tracking-wider opacity-60",
                                    theme.isLight ? "bg-slate-50" : "bg-white/5"
                                )}>
                                    <tr>
                                        <th className="px-6 py-4">الفوج</th>
                                        <th className="px-6 py-4">الشيخ</th>
                                        <th className="px-6 py-4 text-center">الطلبة</th>
                                        <th className="px-6 py-4 text-center">النشطون</th>
                                        <th className="px-6 py-4">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {stats.groupComparisonData.map((group, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-bold">{group.name}</td>
                                            <td className="px-6 py-4 text-sm opacity-80 font-body">
                                                {allUsers.find(u => u.group === group.name)?.displayName || 'غير محدد'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold">{group.students}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-xs font-bold font-body">{group.active}</span>
                                                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full"
                                                            style={{ width: `${(group.active / (group.students || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">نشط</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Comparison Chart */}
                {selectedGroup === 'all' ? (
                    <Card className={cn(
                        "border-none shadow-2xl overflow-hidden",
                        theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                    )}>
                        <CardHeader>
                            <CardTitle className="text-xl font-headline font-bold flex items-center gap-3">
                                <BarChart3 className="text-primary h-5 w-5" />
                                مقارنة أعداد الطلاب
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.groupComparisonData.slice(0, 5)}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis dataKey="name" hide />
                                    <YAxis hide />
                                    <RechartsTooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Bar dataKey="students" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className={cn(
                        "border-none shadow-2xl overflow-hidden",
                        theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                    )}>
                        <CardHeader>
                            <CardTitle className="text-xl font-headline font-bold flex items-center gap-3">
                                <BarChart3 className="text-primary h-5 w-5" />
                                توزيع المستويات الدراسية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] p-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.levelDistributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.levelDistributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};
