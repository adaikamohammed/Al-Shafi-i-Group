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
        const handleGenerate = () => generateDemoData();
        window.addEventListener('INITIALIZE_STRUCTURE', handleGenerate);
        return () => window.removeEventListener('INITIALIZE_STRUCTURE', handleGenerate);
    }, [generateDemoData]);

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const stats = React.useMemo(() => {
        // DEFENSIVE CHECK: Ensure arrays exist before processing
        if (!students || !allUsers || !preRegistrations) {
            return {
                totalStudents: 0,
                totalSheikhs: 0,
                pendingRegs: 0,
                completionRate: "0%",
                groupComparisonData: [],
                levelDistributionData: [],
                activeStudentsList: []
            };
        }

        let activeStudentsList = students;

        // Filter by Group Name handling duplicates merging
        if (selectedGroup !== 'all') {
            activeStudentsList = students.filter(s => s.groupName === selectedGroup);
        }

        const countActive = activeStudentsList.filter(s => s.status === 'نشط').length;

        // SAFEGUARD: Ensure u.group is a string
        const uniqueGroupsSet = new Set(allUsers.filter(u => u.role === 'sheikh' && u.group).map(u => String(u.group)));
        const totalSheikhs = selectedGroup === 'all' ? uniqueGroupsSet.size : 1;

        const countPending = preRegistrations.filter(r => r.status === 'مرشح').length;

        // Group Comparison Data
        const uniqueGroups = Array.from(uniqueGroupsSet);

        const groupComparisonData = uniqueGroups.map(groupName => {
            const groupStudents = students.filter(s => s.groupName === groupName);
            const activeCount = groupStudents.filter(s => s.status === 'نشط').length;
            return {
                name: groupName || 'غير محدد',
                students: groupStudents.length,
                active: activeCount,
                performance: Math.round((activeCount / (groupStudents.length || 1)) * 100)
            };
        })
            // STRICT SAFE SORT
            .sort((a, b) => {
                const groupA = parseInt(String(a.name || '').replace(/[^0-9]/g, '')) || 999;
                const groupB = parseInt(String(b.name || '').replace(/[^0-9]/g, '')) || 999;
                return groupA - groupB;
            });

        // Level Distribution
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
        <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 p-2 md:p-6">
            {/* Header Section with Dark/Glass effect */}
            <div className={cn(
                "rounded-3xl p-8 border shadow-2xl relative overflow-hidden",
                theme.isLight
                    ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-800"
                    : "bg-gradient-to-br from-indigo-950/50 to-purple-950/50 border-white/10"
            )}>
                {/* Background Pattern */}
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                    <div className="absolute right-0 top-0 bg-blue-500 w-[300px] h-[300px] rounded-full blur-[100px]" />
                    <div className="absolute left-0 bottom-0 bg-purple-500 w-[300px] h-[300px] rounded-full blur-[100px]" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium mb-3 border border-white/10">
                            <Shield className="w-3 h-3" />
                            <span>بوابة الإدارة المركزية</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black font-headline tracking-tight mb-2">
                            لوحة التحكم
                        </h1>
                        <p className="text-lg opacity-80 max-w-xl font-body leading-relaxed">
                            نظرة تحليلية شاملة لأداء المدرسة القرآنية، متابعة المشايخ، وإدارة شؤون الطلبة بدقة.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="bg-white/10 p-1 rounded-2xl flex items-center gap-2 backdrop-blur-md border border-white/10">
                            <GroupSelector value={selectedGroup} onChange={setSelectedGroup} className="w-[200px]" />
                        </div>
                        <Button
                            variant="default"
                            onClick={() => {
                                if (window.confirm('هل أنت متأكد من تهيئة الهيكل التنظيمي للنظام؟ (سيتم ضبط حسابات المشايخ والأفواج)')) {
                                    window.dispatchEvent(new CustomEvent('INITIALIZE_STRUCTURE'));
                                }
                            }}
                            className="h-12 px-6 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold border-0 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:scale-105"
                        >
                            <Shield className="h-5 w-5 ml-2" />
                            بناء الهيكلية
                        </Button>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatCard
                    title="الطلبة النشطون"
                    value={stats.totalStudents}
                    icon={Users}
                    color="bg-blue-600"
                    description="مقيد في النظام"
                    theme={theme}
                />
                <StatCard
                    title="الكادر التعليمي"
                    value={stats.totalSheikhs} // This is now deduped (9)
                    icon={Award}
                    color="bg-purple-600"
                    description="فوج تعليمي" // Changed text to reflect "Group" focus
                    theme={theme}
                />
                <StatCard
                    title="طلبات التسجيل"
                    value={stats.pendingRegs}
                    icon={UserPlus}
                    color="bg-amber-500"
                    description="في قاعة الانتظار"
                    theme={theme}
                />
                <StatCard
                    title="الأداء العام"
                    value={stats.completionRate}
                    icon={TrendingUp}
                    color="bg-emerald-600"
                    description="نسبة الحضور والإتقان"
                    theme={theme}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Monitoring Table - Takes 2/3 width */}
                <Card className={cn(
                    "lg:col-span-2 border-none shadow-xl overflow-hidden flex flex-col",
                    theme.isLight ? "bg-white text-slate-900" : "bg-white/5 text-white"
                )}>
                    <CardHeader className="border-b border-gray-100/10 pb-6 pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                    مراقبة أداء الأفواج
                                </CardTitle>
                                <CardDescription>ترتيب الأفواج حسب النشاط والعدد (1-9)</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <div className="flex-1 overflow-x-auto min-h-[400px]">
                        <table className="w-full text-right">
                            <thead className={cn(
                                "text-xs font-bold uppercase tracking-wider opacity-70",
                                theme.isLight ? "bg-slate-50/50" : "bg-black/20"
                            )}>
                                <tr>
                                    <th className="px-6 py-4">الترتيب</th>
                                    <th className="px-6 py-4">الفوج</th>
                                    <th className="px-6 py-4">المشرف</th>
                                    <th className="px-6 py-4 text-center">التعداد</th>
                                    <th className="px-6 py-4">مؤشر النشاط</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/10">
                                {stats.groupComparisonData.map((group, idx) => (
                                    <tr key={idx} className="group hover:bg-primary/5 transition-colors">
                                        <td className="px-6 py-4 font-mono opacity-50">#{idx + 1}</td>
                                        <td className="px-6 py-4 font-bold text-lg">{group.name}</td>
                                        <td className="px-6 py-4 text-sm opacity-80">
                                            {allUsers.find(u => u.group === group.name)?.displayName || 'غير محدد'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <span className="font-bold text-lg">{group.students}</span>
                                                <span className="text-[10px] opacity-60">طالب</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-full max-w-[120px]">
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className="font-bold text-emerald-500">{group.performance}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-200/20 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                                        style={{ width: `${group.performance}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {stats.groupComparisonData.length === 0 && (
                            <div className="p-12 text-center opacity-50">
                                لا توجد بيانات أفواج حالياً. اضغط "بناء الهيكلية" للبدء.
                            </div>
                        )}
                    </div>
                </Card>

                {/* Side Stats */}
                <div className="space-y-6">
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
                                {stats.groupComparisonData && stats.groupComparisonData.length > 0 ? (
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
                                ) : (
                                    <div className="flex items-center justify-center h-full opacity-50 text-sm">لا توجد بيانات للعرض</div>
                                )}
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
                                {stats.levelDistributionData && stats.levelDistributionData.length > 0 ? (
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
                                ) : (
                                    <div className="flex items-center justify-center h-full opacity-50 text-sm">لا توجد بيانات للعرض</div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
