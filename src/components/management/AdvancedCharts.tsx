"use client";

import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, addDays, getDay, subWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';
import { TrendingUp, BarChart2, Radar as RadarIcon, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// ─── Group colors ─────────────────────────────────────────────────────────────
const GROUP_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
    '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
    '#0ea5e9', '#a855f7', '#e11d48', '#059669',
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdvancedChartsProps {
    sheikhs: { group: string; displayName: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
    selectedDate: Date;
    dailySessions: any;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AdvancedCharts({ sheikhs, getDayStats, selectedDate, dailySessions }: AdvancedChartsProps) {
    const [activeChart, setActiveChart] = useState<'line' | 'heatmap' | 'radar'>('line');
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [radarGroups, setRadarGroups] = useState<string[]>(sheikhs.slice(0, 3).map(s => s.group));

    // ── Line Chart Data: Weekly attendance over last 8 weeks ──
    const lineChartData = useMemo(() => {
        const weeks: { label: string; startDate: Date; endDate: Date }[] = [];
        for (let i = 7; i >= 0; i--) {
            const weekStart = startOfWeek(subWeeks(selectedDate, i), { weekStartsOn: 6 });
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 6 });
            weeks.push({
                label: `${format(weekStart, 'd/M', { locale: ar })}`,
                startDate: weekStart,
                endDate: weekEnd,
            });
        }

        return weeks.map(week => {
            const weekDays = eachDayOfInterval({ start: week.startDate, end: week.endDate });
            const entry: Record<string, any> = { name: week.label };

            sheikhs.forEach(sh => {
                let total = 0, count = 0;
                weekDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const stats = getDayStats(sh.group, dateStr);
                    if (stats && stats.attendance !== null && stats.type !== 'يوم عطلة' && stats.type !== 'غياب الشيخ') {
                        total += stats.attendance;
                        count++;
                    }
                });
                entry[sh.group] = count > 0 ? Math.round(total / count) : null;
            });

            return entry;
        });
    }, [sheikhs, getDayStats, selectedDate]);

    // ── Heatmap Data: Sheikh activity this month ──
    const heatmapData = useMemo(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

        return sheikhs.map(sh => {
            const days = allDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                let status: 'session' | 'absent' | 'holiday' | 'none' = 'none';
                let attendance: number | null = null;

                if (stats) {
                    if (stats.type === 'يوم عطلة') status = 'holiday';
                    else if (stats.type === 'غياب الشيخ') status = 'absent';
                    else if (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        status = 'session';
                        attendance = stats.attendance;
                    }
                }

                return {
                    date: day,
                    dateStr,
                    dayLabel: format(day, 'd'),
                    dayOfWeek: getDay(day),
                    status,
                    attendance,
                };
            });

            return { group: sh.group, displayName: sh.displayName, days };
        });
    }, [sheikhs, getDayStats, selectedDate]);

    // ── Radar Data: Multi-metric comparison between groups ──
    const radarData = useMemo(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const metrics = radarGroups.map(group => {
            let attTotal = 0, attCount = 0;
            let excTotal = 0, excCount = 0;
            let sessionDays = 0, totalDays = 0;
            let gpTotal = 0, gpCount = 0;

            allDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(group, dateStr);
                totalDays++;
                if (stats) {
                    const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                    if (isReal) {
                        sessionDays++;
                        if (stats.attendance !== null) { attTotal += stats.attendance; attCount++; }
                        if (stats.excellent !== null) { excTotal += stats.excellent; excCount++; }
                        if (stats.goodPlus !== null) { gpTotal += stats.goodPlus; gpCount++; }
                    }
                }
            });

            const sh = sheikhs.find(s => s.group === group);
            return {
                group,
                displayName: sh?.displayName || group,
                attendance: attCount > 0 ? Math.round(attTotal / attCount) : 0,
                commitment: totalDays > 0 ? Math.round((sessionDays / totalDays) * 100) : 0,
                excellent: excCount > 0 ? Math.round(excTotal / excCount) : 0,
                goodPlus: gpCount > 0 ? Math.round(gpTotal / gpCount) : 0,
            };
        });

        // Transform to radar data format
        const categories = [
            { key: 'attendance', label: 'الحضور' },
            { key: 'commitment', label: 'الالتزام' },
            { key: 'excellent', label: 'ممتاز' },
            { key: 'goodPlus', label: 'ج.جداً' },
        ];

        return categories.map(cat => {
            const entry: Record<string, any> = { metric: cat.label };
            metrics.forEach(m => {
                entry[m.group] = (m as any)[cat.key];
            });
            return entry;
        });
    }, [radarGroups, sheikhs, getDayStats, selectedDate]);

    const displayGroups = selectedGroups.length > 0 ? selectedGroups : sheikhs.map(s => s.group);

    const toggleLineGroup = (group: string) => {
        setSelectedGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    const toggleRadarGroup = (group: string) => {
        setRadarGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    return (
        <div className="space-y-4">
            {/* Chart type selector */}
            <div className="flex items-center gap-2 flex-wrap">
                {[
                    { key: 'line' as const, label: '📈 تطور الحضور', icon: <TrendingUp className="h-3.5 w-3.5" /> },
                    { key: 'heatmap' as const, label: '🟩 خريطة النشاط', icon: <BarChart2 className="h-3.5 w-3.5" /> },
                    { key: 'radar' as const, label: '🎯 مقارنة رادار', icon: <RadarIcon className="h-3.5 w-3.5" /> },
                ].map(item => (
                    <button
                        key={item.key}
                        onClick={() => setActiveChart(item.key)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                            activeChart === item.key ? "bg-primary text-white border-primary shadow-sm" : "bg-background hover:bg-muted border-border"
                        )}
                    >
                        {item.icon} {item.label}
                    </button>
                ))}
            </div>

            {/* ── Line Chart ── */}
            {activeChart === 'line' && (
                <div className="border rounded-2xl overflow-hidden shadow-lg bg-white">
                    <div className="bg-gradient-to-l from-blue-50 to-indigo-50 border-b p-3 flex items-center justify-between">
                        <h3 className="text-sm font-black flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            تطور نسبة الحضور — آخر 8 أسابيع
                        </h3>
                    </div>
                    {/* Group filter chips */}
                    <div className="flex flex-wrap gap-1.5 p-3 border-b bg-slate-50/50">
                        <span className="text-[10px] text-muted-foreground font-bold self-center ml-1">الأفواج:</span>
                        {sheikhs.map((sh, i) => (
                            <button
                                key={sh.group}
                                onClick={() => toggleLineGroup(sh.group)}
                                className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                                    (selectedGroups.length === 0 || selectedGroups.includes(sh.group))
                                        ? "text-white border-transparent shadow-sm"
                                        : "bg-white text-muted-foreground border-border hover:bg-muted"
                                )}
                                style={(selectedGroups.length === 0 || selectedGroups.includes(sh.group))
                                    ? { backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length] }
                                    : {}}
                            >
                                {sh.group}
                            </button>
                        ))}
                    </div>
                    <div className="h-72 p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                                <RechartsTooltip
                                    formatter={(value: number, name: string) => [`${value}%`, name]}
                                    contentStyle={{ direction: 'rtl', borderRadius: '12px', fontSize: '11px' }}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                                {sheikhs.map((sh, i) => {
                                    if (selectedGroups.length > 0 && !selectedGroups.includes(sh.group)) return null;
                                    return (
                                        <Line
                                            key={sh.group}
                                            type="monotone"
                                            dataKey={sh.group}
                                            name={sh.group}
                                            stroke={GROUP_COLORS[i % GROUP_COLORS.length]}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                            connectNulls
                                        />
                                    );
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ── Heatmap ── */}
            {activeChart === 'heatmap' && (
                <div className="border rounded-2xl overflow-hidden shadow-lg bg-white">
                    <div className="bg-gradient-to-l from-emerald-50 to-green-50 border-b p-3">
                        <h3 className="text-sm font-black flex items-center gap-2">
                            <BarChart2 className="h-4 w-4 text-emerald-500" />
                            خريطة نشاط المشايخ — {format(selectedDate, 'MMMM yyyy', { locale: ar })}
                        </h3>
                        <p className="text-[9px] text-muted-foreground mt-0.5">كل مربع يمثّل يوماً واحداً — كلّما كان اللون أغمق كان الحضور أعلى</p>
                    </div>
                    <div className="overflow-x-auto p-3">
                        <div className="space-y-2 min-w-[600px]">
                            {/* Header: Day numbers */}
                            <div className="flex items-center gap-0.5">
                                <div className="w-24 shrink-0" />
                                {heatmapData[0]?.days.map((d, i) => (
                                    <div key={i} className="w-7 h-5 flex items-center justify-center text-[8px] text-muted-foreground font-bold">
                                        {d.dayLabel}
                                    </div>
                                ))}
                            </div>
                            {/* Rows */}
                            {heatmapData.map((row, ri) => (
                                <div key={row.group} className="flex items-center gap-0.5">
                                    <div className="w-24 shrink-0 text-[10px] font-bold truncate text-right pr-2">{row.group}</div>
                                    {row.days.map((d, di) => {
                                        let bg = 'bg-slate-100'; // none
                                        let title = `${format(d.date, 'EEEE d/M', { locale: ar })}: لم يسجّل`;
                                        if (d.status === 'holiday') { bg = 'bg-slate-200'; title = `${format(d.date, 'EEEE d/M', { locale: ar })}: عطلة`; }
                                        else if (d.status === 'absent') { bg = 'bg-rose-200'; title = `${format(d.date, 'EEEE d/M', { locale: ar })}: غياب الشيخ`; }
                                        else if (d.status === 'session') {
                                            const att = d.attendance || 0;
                                            if (att >= 90) bg = 'bg-emerald-600';
                                            else if (att >= 80) bg = 'bg-emerald-500';
                                            else if (att >= 70) bg = 'bg-emerald-400';
                                            else if (att >= 60) bg = 'bg-yellow-400';
                                            else if (att >= 50) bg = 'bg-amber-400';
                                            else bg = 'bg-rose-400';
                                            title = `${format(d.date, 'EEEE d/M', { locale: ar })}: حضور ${att}%`;
                                        }
                                        return (
                                            <div
                                                key={di}
                                                className={cn("w-7 h-7 rounded-[4px] transition-all hover:scale-125 hover:z-10 cursor-default", bg)}
                                                title={title}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                            {/* Legend */}
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                                <span className="text-[9px] text-muted-foreground">الدلالة:</span>
                                {[
                                    { bg: 'bg-slate-100', label: 'لم يسجّل' },
                                    { bg: 'bg-slate-200', label: 'عطلة' },
                                    { bg: 'bg-rose-200', label: 'غياب شيخ' },
                                    { bg: 'bg-rose-400', label: '<60%' },
                                    { bg: 'bg-amber-400', label: '50-60%' },
                                    { bg: 'bg-yellow-400', label: '60-70%' },
                                    { bg: 'bg-emerald-400', label: '70-80%' },
                                    { bg: 'bg-emerald-500', label: '80-90%' },
                                    { bg: 'bg-emerald-600', label: '90%+' },
                                ].map(item => (
                                    <span key={item.label} className="flex items-center gap-0.5">
                                        <span className={cn("w-3 h-3 rounded-sm", item.bg)} />
                                        <span className="text-[8px] text-muted-foreground">{item.label}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Radar Chart ── */}
            {activeChart === 'radar' && (
                <div className="border rounded-2xl overflow-hidden shadow-lg bg-white">
                    <div className="bg-gradient-to-l from-purple-50 to-violet-50 border-b p-3">
                        <h3 className="text-sm font-black flex items-center gap-2">
                            <RadarIcon className="h-4 w-4 text-purple-500" />
                            مقارنة شاملة للأفواج — {format(selectedDate, 'MMMM yyyy', { locale: ar })}
                        </h3>
                        <p className="text-[9px] text-muted-foreground mt-0.5">اختر حتى 5 أفواج للمقارنة</p>
                    </div>
                    {/* Group selector */}
                    <div className="flex flex-wrap gap-1.5 p-3 border-b bg-slate-50/50">
                        {sheikhs.map((sh, i) => (
                            <button
                                key={sh.group}
                                onClick={() => toggleRadarGroup(sh.group)}
                                className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all",
                                    radarGroups.includes(sh.group)
                                        ? "text-white border-transparent shadow-sm"
                                        : "bg-white text-muted-foreground border-border hover:bg-muted"
                                )}
                                style={radarGroups.includes(sh.group)
                                    ? { backgroundColor: GROUP_COLORS[i % GROUP_COLORS.length] }
                                    : {}}
                                disabled={!radarGroups.includes(sh.group) && radarGroups.length >= 5}
                            >
                                {sh.group}
                            </button>
                        ))}
                    </div>
                    <div className="h-80 p-3">
                        {radarGroups.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fontWeight: 700 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                                    {radarGroups.map((group, i) => {
                                        const idx = sheikhs.findIndex(s => s.group === group);
                                        return (
                                            <Radar
                                                key={group}
                                                name={group}
                                                dataKey={group}
                                                stroke={GROUP_COLORS[idx % GROUP_COLORS.length]}
                                                fill={GROUP_COLORS[idx % GROUP_COLORS.length]}
                                                fillOpacity={0.15}
                                                strokeWidth={2}
                                            />
                                        );
                                    })}
                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                    <RechartsTooltip
                                        formatter={(value: number, name: string) => [`${value}%`, name]}
                                        contentStyle={{ direction: 'rtl', borderRadius: '12px', fontSize: '11px' }}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">اختر فوجاً واحداً على الأقل</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
