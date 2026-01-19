"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, UserCheck, Shield, UserPlus, TrendingUp, BarChart3, Award, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';

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
    const { students, preRegistrations, allUsers, loading } = useStudentContext();
    const { user } = useAuth();

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const stats = useMemo(() => {
        const activeStudents = students.filter(s => s.status === 'نشط').length;
        const totalSheikhs = allUsers.filter(u => u.role === 'sheikh').length;
        const pendingRegs = preRegistrations.filter(r => r.status === 'مرشح').length;

        return {
            totalStudents: activeStudents,
            totalSheikhs: totalSheikhs,
            pendingRegs: pendingRegs,
            completionRate: "92%" // This should be calculated from real data in a real app
        };
    }, [students, preRegistrations, allUsers]);

    return (
        <div className="w-full max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
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
                                        <th className="px-6 py-4">الطلبة</th>
                                        <th className="px-6 py-4">الحضور</th>
                                        <th className="px-6 py-4">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {/* Mock data for now, would be dynamically generated */}
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <tr key={i} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-bold">فوج {i}</td>
                                            <td className="px-6 py-4 text-sm opacity-80 font-body">الشيخ عبد الله {i}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold">2{i}</span>
                                                    <span className="text-[10px] opacity-40">طالب</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${85 + i}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold font-body">{85 + i}%</span>
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

                {/* Quick Actions / Recent Performance */}
                <div className="space-y-8">
                    <Card className={cn(
                        "border-none shadow-2xl overflow-hidden",
                        theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                    )}>
                        <CardHeader className="bg-primary/10">
                            <CardTitle className="text-xl font-headline font-bold flex items-center gap-3">
                                <BarChart3 className="text-primary h-5 w-5" />
                                أفضل الأفواج تميزاً
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {[
                                { name: "فوج الصديق", score: 98, trend: "up" },
                                { name: "فوج الفاروق", score: 94, trend: "up" },
                                { name: "فوج ذو النورين", score: 89, trend: "down" }
                            ].map((group, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                                            {idx + 1}
                                        </div>
                                        <span className="font-bold text-sm">{group.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-black font-headline">{group.score}</span>
                                        {group.trend === 'up' ? <TrendingUp className="h-4 w-4 text-emerald-400" /> : <TrendingUp className="h-4 w-4 text-rose-400 rotate-180" />}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card className={cn(
                        "border-none shadow-2xl relative overflow-hidden",
                        theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                    )}>
                        <CardContent className="p-6 text-center space-y-4">
                            <div className="p-4 rounded-3xl bg-amber-500/20 inline-block">
                                <Award className="h-8 w-8 text-amber-500" />
                            </div>
                            <h3 className="text-xl font-headline font-bold tracking-tight">تقارير الرقابة الدورية</h3>
                            <p className="text-xs opacity-60 font-body">يمكنك تصدير تقارير المتابعة الدورية للأشهر الثلاثة الأخيرة</p>
                            <Button className="w-full rounded-2xl h-12 shadow-lg shadow-primary/20">تصدير التقرير الفصلي</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
