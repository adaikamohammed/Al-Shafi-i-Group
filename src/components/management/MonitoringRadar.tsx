"use client";

import React, { useMemo } from 'react';
import {
    Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    ResponsiveContainer, Tooltip
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Target, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

interface MonitoringRadarProps {
    data: any[]; // Aggregated data per group
    selectedGroup: string;
}

export const MonitoringRadar = ({ data, selectedGroup }: MonitoringRadarProps) => {
    const { user } = useAuth();
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const chartData = useMemo(() => {
        let targetData;

        if (selectedGroup === 'all') {
            // Calculate Global Average
            if (data.length === 0) return [];

            const count = data.length;
            targetData = {
                groupName: 'جميع الأفواج',
                attendanceRate: Math.round(data.reduce((acc, curr) => acc + curr.attendanceRate, 0) / count),
                reviewRate: Math.round(data.reduce((acc, curr) => acc + curr.reviewRate, 0) / count),
                evaluationScore: Math.round(data.reduce((acc, curr) => acc + curr.evaluationScore, 0) / count),
                behaviorScore: Math.round(data.reduce((acc, curr) => acc + curr.behaviorScore, 0) / count),
            };
        } else {
            targetData = data.find(g => g.groupName === selectedGroup);
        }

        if (!targetData) return [];

        // Overall commitment is the average of the 4 metrics
        const commitment = Math.round(
            (targetData.attendanceRate + targetData.reviewRate + targetData.evaluationScore + targetData.behaviorScore) / 4
        );

        return [
            { subject: 'الحضور', value: targetData.attendanceRate, fullMark: 100 },
            { subject: 'المراجعة', value: targetData.reviewRate, fullMark: 100 },
            { subject: 'الحفظ', value: targetData.evaluationScore, fullMark: 100 },
            { subject: 'الانضباط', value: targetData.behaviorScore, fullMark: 100 },
            { subject: 'الالتزام العام', value: commitment, fullMark: 100 },
        ];
    }, [data, selectedGroup]);

    const activeColor = currentThemeId === 'ramadan' ? '#10b981' : '#34d399';

    if (data.length === 0) {
        return (
            <Card className={cn(
                "border-none shadow-2xl backdrop-blur-xl p-12 text-center",
                theme.isLight ? "bg-white/60" : "bg-slate-900/40"
            )}>
                <Shield className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/40 font-body">لا يوجد بيانات كافية لعرض الرادار</p>
            </Card>
        );
    }

    return (
        <Card className={cn(
            "border-none shadow-2xl backdrop-blur-xl overflow-hidden transition-all duration-500 group relative",
            theme.isLight
                ? "bg-white/60 border-slate-200 shadow-slate-200/50"
                : "bg-slate-900/40 border-white/5"
        )}>
            {/* Decoration */}
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                <Target className="h-32 w-32 text-primary" />
            </div>

            <CardHeader className={cn(
                "flex flex-row items-center justify-between pb-2 space-y-0 border-b",
                theme.isLight ? "border-slate-100 bg-white/50" : "border-white/5 bg-white/5"
            )}>
                <div className="space-y-1">
                    <CardTitle className={cn(
                        "text-2xl font-headline font-black flex items-center gap-3",
                        theme.isLight ? "text-slate-800" : "text-white/90"
                    )}>
                        <div className={cn(
                            "p-2 rounded-xl transition-colors bg-primary/10"
                        )}>
                            <Zap className="h-6 w-6 text-primary" />
                        </div>
                        رادار الأداء الموحد
                    </CardTitle>
                    <CardDescription className="font-body text-white/40">
                        تحليل شامل لـ {selectedGroup === 'all' ? 'أداء المدرسة ككل' : selectedGroup}
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="h-[450px] pt-8 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                        <PolarGrid
                            stroke={theme.isLight ? "#e2e8f0" : "rgba(255,255,255,0.1)"}
                            gridType="polygon"
                        />
                        <PolarAngleAxis
                            dataKey="subject"
                            tick={{
                                fill: theme.isLight ? "#64748b" : "#94a3b8",
                                fontSize: 14,
                                fontWeight: 'bold',
                                fontFamily: 'var(--font-headline)'
                            }}
                        />
                        <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={false}
                            axisLine={false}
                        />
                        <Radar
                            name={selectedGroup === 'all' ? 'متوسط المدرسة' : selectedGroup}
                            dataKey="value"
                            stroke={activeColor}
                            fill={activeColor}
                            fillOpacity={0.4}
                            strokeWidth={3}
                            animationDuration={1500}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: theme.isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 23, 42, 0.95)',
                                border: 'none',
                                borderRadius: '16px',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                backdropFilter: 'blur(10px)',
                                color: theme.isLight ? '#1e293b' : '#f8fafc',
                                direction: 'rtl'
                            }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};
