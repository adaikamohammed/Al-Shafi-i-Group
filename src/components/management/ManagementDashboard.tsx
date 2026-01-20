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
    const { students, preRegistrations, allUsers, loading, generateDemoData } = useStudentContext();
    const { user } = useAuth();
    const [selectedGroup, setSelectedGroup] = React.useState<string>('all');

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
        const totalSheikhs = selectedGroup === 'all' ? allUsers.filter(u => u.role === 'sheikh').length : 1;
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-headline font-bold">لوحة القيادة</h2>
                    <p className="text-muted-foreground opacity-60">نظرة شاملة على أداء المدرسة</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => {
                            if (window.confirm('هل أنت متأكد من توليد بيانات تجريبية؟ سيتم إضافة مشايخ وطلاب وهميين.')) {
                                window.dispatchEvent(new CustomEvent('GENERATE_DEMO_DATA'));
                            }
                        }}
                        className="gap-2 border-dashed border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-600"
                    >
                        <Shield className="h-4 w-4" />
                        تهيئة النظام
                    </Button>
                    <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />
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
