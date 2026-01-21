"use client";

import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, Star, Smile } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface MonitoringChartsProps {
    data: any[]; // Aggregated data per group
}

export const MonitoringCharts = ({ data }: MonitoringChartsProps) => {
    const { user } = useAuth();
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const chartConfig = useMemo(() => {
        const isRamadan = currentThemeId === 'ramadan';
        return [
            { key: 'attendanceRate', label: 'نسبة الحضور', color: isRamadan ? '#10b981' : '#3b82f6', icon: Users },
            { key: 'reviewRate', label: 'معدل المراجعة', color: isRamadan ? '#f59e0b' : '#f59e0b', icon: BookOpen },
            { key: 'evaluationScore', label: 'جودة الحفظ', color: isRamadan ? '#10b981' : '#10b981', icon: Star },
            { key: 'behaviorScore', label: 'مستوى الانضباط', color: isRamadan ? '#f59e0b' : '#8b5cf6', icon: Smile },
        ];
    }, [currentThemeId]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {chartConfig.map((chart) => (
                <Card key={chart.key} className={cn(
                    "border-none shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-500 hover:scale-[1.02] group",
                    theme.isLight
                        ? "bg-white/60 border-slate-200 shadow-slate-200/50"
                        : "bg-slate-900/40 border-white/5"
                )}>
                    <CardHeader className={cn(
                        "flex flex-row items-center justify-between pb-2 space-y-0 border-b",
                        theme.isLight ? "border-slate-100 bg-white/50" : "border-white/5 bg-white/5"
                    )}>
                        <CardTitle className={cn(
                            "text-lg font-headline font-black flex items-center gap-3",
                            theme.isLight ? "text-slate-800" : "text-white/90"
                        )}>
                            <div className={cn(
                                "p-2 rounded-xl transition-colors",
                                theme.isLight ? "bg-slate-100 group-hover:bg-slate-200" : "bg-white/5 group-hover:bg-white/10"
                            )}>
                                <chart.icon className="h-5 w-5" style={{ color: chart.color }} />
                            </div>
                            {chart.label}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-8 relative">
                        {/* Background Decoration */}
                        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />

                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data}>
                                <defs>
                                    <linearGradient id={`gradient-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chart.color} stopOpacity={0.8} />
                                        <stop offset="100%" stopColor={chart.color} stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.05} />
                                <XAxis
                                    dataKey="groupName"
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => `${value}%`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: theme.isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                                        border: theme.isLight ? '1px solid rgba(0,0,0,0.05)' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                        backdropFilter: 'blur(10px)',
                                        color: theme.isLight ? '#1e293b' : '#f8fafc'
                                    }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Bar
                                    dataKey={chart.key}
                                    fill={`url(#gradient-${chart.key})`}
                                    radius={[8, 8, 0, 0]}
                                    barSize={32}
                                    animationDuration={1500}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
