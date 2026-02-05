import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PreRegistration } from '@/lib/types';

interface RegistrationsChartsProps {
    registrations: PreRegistration[];
    levelFilter: string[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const STATUS_COLORS: Record<string, string> = {
    'تم الإنضمام': '#22c55e', // green-500
    'تم الإتصال': '#a855f7', // purple-500
    'تم إرسال رسالة': '#06b6d4', // cyan-500
    'لم يرد': '#6366f1', // indigo-500
    'مرشح': '#f97316', // orange-500
    'مؤجل': '#eab308', // yellow-500
    'مرفوض': '#ef4444', // red-500
    'إنضم لمدرسة أخرى': '#ef4444', // red-500
    'مكرر': '#94a3b8', // slate-400
    'ملغى': '#94a3b8', // slate-400
};

export const RegistrationsCharts = ({ registrations, levelFilter }: RegistrationsChartsProps) => {

    // 1. Determine Chart Mode based on Level Filter
    const mode = useMemo(() => {
        if (levelFilter.length === 0) return 'general'; // No level selected -> Compare Stages
        // Check if it looks like a stage (e.g. all selected levels are from same stage? or simply just check logic)
        // For simplicity, if we have specific levels selected, we treat it as "Detailed" or "Specific"
        // But the requirement was:
        // - No filter/All -> Compare Stages
        // - Stage selected -> Compare Years
        // - Specific Level -> Gender/Status Pie

        // Simple heuristic: 
        // If 1 specific level is selected (e.g. "1 ابتدائي") -> Specific Mode
        if (levelFilter.length === 1) return 'specific';

        // If multiple levels (likely a stage group like "1,2,3... sec") -> Stage Mode
        return 'stage';
    }, [levelFilter]);

    // 2. Prepare Data
    const data = useMemo(() => {
        if (mode === 'general') {
            // Group by Stage (Primary, Middle, Secondary)
            const stages = { 'الطور الابتدائي': 0, 'الطور المتوسط': 0, 'الطور الثانوي': 0, 'أخرى': 0 };
            registrations.forEach(reg => {
                const lvl = reg.educationalLevel || '';
                if (lvl.includes('إبتدائي')) stages['الطور الابتدائي']++;
                else if (lvl.includes('متوسط')) stages['الطور المتوسط']++;
                else if (lvl.includes('ثانوي') || lvl.includes('بكالوريا')) stages['الطور الثانوي']++;
                else stages['أخرى']++;
            });
            return Object.entries(stages).map(([name, count]) => ({ name, count }));
        }

        if (mode === 'stage') {
            // Group by Level Name (the filters themselves usually)
            const levels: Record<string, number> = {};
            registrations.forEach(reg => {
                const lvl = reg.educationalLevel || 'غير محدد';
                levels[lvl] = (levels[lvl] || 0) + 1;
            });
            return Object.entries(levels).map(([name, count]) => ({ name, count }));
        }

        if (mode === 'specific') {
            // Gender Dist
            const genderCounts = { 'ذكر': 0, 'أنثى': 0 };
            const statusCounts: Record<string, number> = {};

            registrations.forEach(reg => {
                if (reg.gender === 'ذكر') genderCounts['ذكر']++;
                else if (reg.gender === 'أنثى') genderCounts['أنثى']++;

                statusCounts[reg.status] = (statusCounts[reg.status] || 0) + 1;
            });

            return {
                gender: Object.entries(genderCounts).map(([name, value]) => ({ name, value })),
                status: Object.entries(statusCounts).map(([name, value]) => ({ name, value }))
            };
        }

        return [];
    }, [registrations, mode]);

    if (registrations.length === 0) return null;

    return (
        <Card className="mb-6 border-dashed bg-slate-50/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {mode === 'general' && 'توزيع الطلاب حسب الأطوار'}
                    {mode === 'stage' && 'توزيع الطلاب حسب السنوات'}
                    {mode === 'specific' && 'تحليل المستوى الدراسي'}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[250px] w-full" dir="ltr">
                    {mode === 'specific' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                            {/* Gender Pie */}
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={(data as any).gender}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {(data as any).gender.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.name === 'ذكر' ? '#3b82f6' : '#ec4899'} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>

                            {/* Status Pie */}
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={(data as any).status}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {(data as any).status.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#8884d8'} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data as any[]}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tick={{ fill: '#64748b' }} />
                                <YAxis fontSize={12} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    cursor={{ fill: '#f1f5f9' }}
                                />
                                <Bar dataKey="count" name="عدد الطلاب" radius={[4, 4, 0, 0]}>
                                    {(data as any[]).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
