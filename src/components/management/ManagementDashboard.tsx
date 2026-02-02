"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, UserCheck, Shield, UserPlus, TrendingUp, BarChart3, Award, Calendar, ChevronRight, Activity, Target, PieChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';
import { GroupSelector } from './GroupSelector';
import dynamic from 'next/dynamic';

const MonitoringRadar = dynamic(() => import('./MonitoringRadar').then(mod => mod.MonitoringRadar), { ssr: false });
const InteractiveGrowthChart = dynamic(() => import('./ManagementCharts').then(mod => mod.InteractiveGrowthChart), { ssr: false });
const LevelDistributionChart = dynamic(() => import('./ManagementCharts').then(mod => mod.LevelDistributionChart), { ssr: false });

import {
    startOfWeek, endOfWeek,
    startOfMonth, endOfMonth,
    startOfQuarter, endOfQuarter,
    startOfYear, endOfYear,
    isWithinInterval, parseISO, format
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { useFCM } from '@/hooks/useFCM';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { CalendarDays, CalendarRange, CalendarCheck, History, Info, Zap, Bell, BellOff } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: any;
    color: string;
    gradient: string;
    description?: string;
    theme: any;
}

const StatCard = ({ title, value, icon: Icon, color, gradient, description, theme }: StatCardProps) => (
    <motion.div
        whileHover={{ scale: 1.02, translateY: -5 }}
        transition={{ type: "spring", stiffness: 300 }}
    >
        <Card className={cn(
            "relative overflow-hidden border-none shadow-xl h-full",
            theme.isLight ? "bg-white/80 backdrop-blur-md text-slate-900" : "bg-white/5 backdrop-blur-md text-white"
        )}>
            <div className={cn("absolute inset-0 opacity-10 bg-gradient-to-br", gradient)} />
            <div className={cn("absolute -right-10 -bottom-10 opacity-5 rotate-12", color)}>
                <Icon size={140} />
            </div>
            <CardContent className="p-6 relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className={cn("p-3 rounded-2xl shadow-lg", color)}>
                        <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium opacity-70 leading-tight">{title}</p>
                        <h3 className="text-3xl font-black font-headline mt-1 tracking-tight">{value}</h3>
                    </div>
                </div>
                {description && (
                    <div className="flex items-center gap-2 mt-2 py-1 px-2 rounded-lg bg-white/5 w-fit ml-auto">
                        <TrendingUp className="h-3 w-3 text-emerald-500" />
                        <span className="text-xs opacity-70">{description}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    </motion.div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white/95 backdrop-blur-xl p-4 rounded-xl shadow-2xl border border-slate-100 text-right min-w-[200px]">
                <div className="flex items-center gap-2 mb-2 border-b pb-2">
                    <div className="p-1.5 bg-indigo-50 rounded-lg">
                        <Shield className="h-4 w-4 text-indigo-600" />
                    </div>
                    <p className="font-bold text-slate-800">{data.name}</p>
                </div>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500 flex items-center gap-1"><UserCheck className="h-3 w-3" /> الشيخ:</span>
                        <span className="font-semibold text-slate-800 dir-rtl">{data.sheikhName}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">إجمالي الطلبة:</span>
                        <span className="font-bold text-slate-800">{data.students}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-slate-500">الطلبة النشطون:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-600">{data.active}</span>
                            <span className="text-xs text-slate-400">({Math.round((data.active / data.students) * 100)}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export const ManagementDashboard = () => {
    const { students, preRegistrations, allUsers, dailySessions, loading, generateDemoData } = useStudentContext();
    const { user, isManagement, isSuperAdmin } = useAuth();
    const [selectedGroup, setSelectedGroup] = React.useState<string>('all');
    const [timeframe, setTimeframe] = React.useState<string>('weekly');

    const isSheikh = user?.role === 'sheikh';

    // Auto-select group for sheikhs
    React.useEffect(() => {
        if (isSheikh && user?.group) {
            setSelectedGroup(user.group);
        }
    }, [isSheikh, user?.group]);

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

        const sheikhUsers = allUsers.length > 0
            ? allUsers.filter(u => u.role === 'sheikh' && u.group)
            : (isSheikh && user ? [{ ...user }] : []);

        const uniqueGroups = Array.from(new Set(sheikhUsers.map(u => u.group)));

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
                        const sheikh = allUsers.find(u => u.uid === session.ownerId) || (isSheikh && session.ownerId === user?.uid ? user : null);
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
        const sheikhUsers = allUsers.length > 0
            ? allUsers.filter(u => u.role === 'sheikh' && u.group)
            : (isSheikh && user ? [{ ...user }] : []);

        const uniqueGroups = Array.from(new Set(sheikhUsers.map(u => u.group)));

        const groupComparisonData = uniqueGroups.map(groupName => {
            // Find primary sheikh for display name (just pick one)
            const representativeSheikh = allUsers.find(u => u.group === groupName && u.role === 'sheikh');

            // CRITICAL: Filter students by groupName string, effectively merging all duplicates
            const groupStudents = students.filter(s => s.groupName === groupName);

            return {
                name: groupName || 'غير محدد',
                sheikhName: representativeSheikh?.displayName || 'غير محدد',
                students: groupStudents.length,
                active: groupStudents.filter(s => s.status === 'نشط').length,
                inactive: groupStudents.length - groupStudents.filter(s => s.status === 'نشط').length
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

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#6366f1'];

    return (
        <div className="w-full max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
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
                            <TabsTrigger value="weekly" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
                                <CalendarDays className="ml-1 h-3 w-3" /> أسبوعي
                            </TabsTrigger>
                            <TabsTrigger value="monthly" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
                                <CalendarRange className="ml-1 h-3 w-3" /> شهري
                            </TabsTrigger>
                            <TabsTrigger value="seasonal" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
                                <CalendarCheck className="ml-1 h-3 w-3" /> فصلي
                            </TabsTrigger>
                            <TabsTrigger value="yearly" className="rounded-lg py-2 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg">
                                <History className="ml-1 h-3 w-3" /> سنوي
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex items-center gap-3">
                        {!isSheikh && (
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
                        )}
                        {!isSheikh && <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />}
                        {isSheikh && (
                            <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl border border-emerald-100 font-bold flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                {user?.group}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Smart Monitoring Section (Combined Chart + Table Concept) */}
            <div className={cn("grid grid-cols-1 gap-8", isSheikh ? "" : "lg:grid-cols-4")}>
                {/* Main Interactive Chart - Only for Management */}
                {!isSheikh && (
                    <Card className={cn(
                        "lg:col-span-3 border-none shadow-2xl overflow-hidden flex flex-col",
                        theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                    )}>
                        <CardHeader className="pb-2 border-b border-gray-100 dark:border-white/10">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-2xl font-headline font-bold flex items-center gap-3">
                                        <Activity className="text-indigo-500 h-6 w-6" />
                                        مراقبة نمو الأفواج
                                    </CardTitle>
                                    <CardDescription className="opacity-70 mt-1">
                                        تحليل تفاعلي لتوزيع الطلبة ونشاطهم عبر المجموعات التعليمية
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2 text-xs font-bold">
                                    <div className="flex items-center gap-1 bg-indigo-50 px-3 py-1 rounded-full text-indigo-700">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                        <span>نشط</span>
                                    </div>
                                    <div className="flex items-center gap-1 bg-slate-50 px-3 py-1 rounded-full text-slate-600 text-xs">
                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                        <span>خامل</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 p-4 min-h-[400px]">
                            <InteractiveGrowthChart data={stats.groupComparisonData} />
                        </CardContent>
                    </Card>
                )}

                {/* Radar & Summary - Compact Side Panel */}
                <div className={cn("flex flex-col gap-6 h-full", isSheikh ? "w-full" : "")}>
                    <div className={cn("grid grid-cols-1 gap-6", isSheikh ? "md:grid-cols-2" : "")}>
                        {/* Radar Chart */}
                        <div className="bg-white dark:bg-white/5 rounded-xl shadow-xl overflow-hidden min-h-[300px] relative">
                            <div className="absolute top-4 right-4 z-10">
                                <h3 className="font-bold text-sm bg-white/50 backdrop-blur px-2 py-1 rounded-lg">الأداء النوعي للفوج</h3>
                            </div>
                            <MonitoringRadar data={aggregatedData} selectedGroup={selectedGroup} />
                        </div>

                        {/* Quick KPI for selected Group or All */}
                        <Card className={cn(
                            "border-none shadow-xl flex flex-col justify-center",
                            theme.isLight ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white" : "bg-gradient-to-br from-indigo-900 to-purple-900 text-white"
                        )}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xl font-bold flex items-center justify-between">
                                    <span>{selectedGroup === 'all' ? 'متوسط الأداء العام' : selectedGroup}</span>
                                    <Target className="h-6 w-6 opacity-80" />
                                </CardTitle>
                                <CardDescription className="text-white/70">
                                    تحليل الأداء بناءً على تقييمات الحصص الأخيرة
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6 pt-4">
                                <div className="flex justify-between items-end border-b border-white/20 pb-4">
                                    <span className="text-sm opacity-80">نسبة الحضور</span>
                                    <span className="text-3xl font-black font-headline">
                                        {selectedGroup === 'all'
                                            ? (aggregatedData.length > 0 ? Math.round(aggregatedData.reduce((acc, curr) => acc + curr.attendanceRate, 0) / aggregatedData.length) : 0)
                                            : (aggregatedData.find(g => g.groupName === selectedGroup)?.attendanceRate || 0)
                                        }%
                                    </span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/20 pb-4">
                                    <span className="text-sm opacity-80">نسبة المراجعة</span>
                                    <span className="text-3xl font-black font-headline text-emerald-300">
                                        {selectedGroup === 'all'
                                            ? (aggregatedData.length > 0 ? Math.round(aggregatedData.reduce((acc, curr) => acc + curr.reviewRate, 0) / aggregatedData.length) : 0)
                                            : (aggregatedData.find(g => g.groupName === selectedGroup)?.reviewRate || 0)
                                        }%
                                    </span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-sm opacity-80">تقييم الحفظ</span>
                                    <span className="text-3xl font-black font-headline text-amber-300">
                                        {selectedGroup === 'all'
                                            ? (aggregatedData.length > 0 ? Math.round(aggregatedData.reduce((acc, curr) => acc + curr.evaluationScore, 0) / aggregatedData.length) : 0)
                                            : (aggregatedData.find(g => g.groupName === selectedGroup)?.evaluationScore || 0)
                                        }
                                        <span className="text-sm text-white/50 mr-1">/100</span>
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Stats Overview Gradient Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="الطلبة النشطين"
                    value={stats.totalStudents}
                    icon={Users}
                    color="bg-blue-500"
                    gradient="from-blue-500 to-cyan-400"
                    description={isSheikh ? "طلاب فوجك الحالي" : "+12% نمو شهري"}
                    theme={theme}
                />
                {!isSheikh && (
                    <StatCard
                        title="الكادر التعليمي"
                        value={stats.totalSheikhs}
                        icon={UserCheck}
                        color="bg-emerald-500"
                        gradient="from-emerald-500 to-teal-400"
                        description="مشايخ وأساتذة"
                        theme={theme}
                    />
                )}
                {isSheikh && (
                    <StatCard
                        title="رقم الفوج"
                        value={user?.group?.replace(/[^0-9]/g, '') || '-'}
                        icon={Shield}
                        color="bg-emerald-500"
                        gradient="from-emerald-500 to-teal-400"
                        description={user?.group || "فوجك التعليمي"}
                        theme={theme}
                    />
                )}
                {!isSheikh && (
                    <StatCard
                        title="تسجيلات جديدة"
                        value={stats.pendingRegs}
                        icon={UserPlus}
                        color="bg-amber-500"
                        gradient="from-amber-500 to-orange-400"
                        description="في انتظار الموافقة"
                        theme={theme}
                    />
                )}
                {isSheikh && (
                    <StatCard
                        title="معدل الحضور"
                        value={`${aggregatedData.find(g => g.groupName === selectedGroup)?.attendanceRate || 0}%`}
                        icon={UserCheck}
                        color="bg-amber-500"
                        gradient="from-amber-500 to-orange-400"
                        description="التزام الطلبة بالفوج"
                        theme={theme}
                    />
                )}
                <StatCard
                    title="معدل الإنجاز"
                    value={isSheikh ? `${aggregatedData.find(g => g.groupName === selectedGroup)?.evaluationScore || 0}%` : stats.completionRate}
                    icon={Award}
                    color="bg-purple-500"
                    gradient="from-purple-500 to-pink-400"
                    description="جودة الحفظ والإتقان"
                    theme={theme}
                />
            </div>

            {/* Footer with Distribution Pie Chart */}
            <div className="w-full">
                <Card className={cn(
                    "w-full border-none shadow-xl",
                    theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                )}>
                    <CardHeader>
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                            <PieChart className="text-primary h-6 w-6" />
                            توزيع المستويات التعليمية
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[400px] relative p-6">
                        <LevelDistributionChart data={stats.levelDistributionData} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
