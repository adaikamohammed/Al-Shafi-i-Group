"use client";

import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addDays, subWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface PeriodComparisonProps {
    sheikhs: { group: string; displayName: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
    selectedDate: Date;
}

export function PeriodComparison({ sheikhs, getDayStats, selectedDate }: PeriodComparisonProps) {
    const [mode, setMode] = useState<'month' | 'week'>('month');
    const [viewType, setViewType] = useState<'split' | 'overlay'>('split');

    // Calculate stats for a date range
    const calcPeriodStats = (startDate: Date, endDate: Date) => {
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const groupStats: Record<string, { att: number; attCount: number; sessions: number; exc: number; excCount: number }> = {};
        let totalAtt = 0, totalAttCount = 0, totalExc = 0, totalExcCount = 0, totalSessions = 0;

        sheikhs.forEach(sh => {
            groupStats[sh.group] = { att: 0, attCount: 0, sessions: 0, exc: 0, excCount: 0 };
            days.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                if (stats) {
                    const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                    if (isReal) {
                        groupStats[sh.group].sessions++;
                        totalSessions++;
                        if (stats.attendance !== null) { groupStats[sh.group].att += stats.attendance; groupStats[sh.group].attCount++; totalAtt += stats.attendance; totalAttCount++; }
                        if (stats.excellent !== null) { groupStats[sh.group].exc += stats.excellent; groupStats[sh.group].excCount++; totalExc += stats.excellent; totalExcCount++; }
                    }
                }
            });
        });

        const avgAtt = totalAttCount > 0 ? Math.round(totalAtt / totalAttCount) : 0;
        const avgExc = totalExcCount > 0 ? Math.round(totalExc / totalExcCount) : 0;

        const perGroup = sheikhs.map(sh => ({
            group: sh.group,
            displayName: sh.displayName,
            avgAtt: groupStats[sh.group].attCount > 0 ? Math.round(groupStats[sh.group].att / groupStats[sh.group].attCount) : 0,
            sessions: groupStats[sh.group].sessions,
            avgExc: groupStats[sh.group].excCount > 0 ? Math.round(groupStats[sh.group].exc / groupStats[sh.group].excCount) : 0,
        }));

        return { avgAtt, avgExc, totalSessions, perGroup, days: days.length };
    };

    const periods = useMemo(() => {
        if (mode === 'month') {
            const current = { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) };
            const prev = { start: startOfMonth(subMonths(selectedDate, 1)), end: endOfMonth(subMonths(selectedDate, 1)) };
            return {
                current: { ...calcPeriodStats(current.start, current.end), label: format(selectedDate, 'MMMM yyyy', { locale: ar }) },
                previous: { ...calcPeriodStats(prev.start, prev.end), label: format(subMonths(selectedDate, 1), 'MMMM yyyy', { locale: ar }) },
            };
        } else {
            const wStart = startOfWeek(selectedDate, { weekStartsOn: 6 });
            const wEnd = endOfWeek(selectedDate, { weekStartsOn: 6 });
            const pStart = startOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 6 });
            const pEnd = endOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 6 });
            return {
                current: { ...calcPeriodStats(wStart, wEnd), label: `${format(wStart, 'd/M')} — ${format(wEnd, 'd/M')}` },
                previous: { ...calcPeriodStats(pStart, pEnd), label: `${format(pStart, 'd/M')} — ${format(pEnd, 'd/M')}` },
            };
        }
    }, [sheikhs, getDayStats, selectedDate, mode]);

    const attDiff = periods.current.avgAtt - periods.previous.avgAtt;
    const excDiff = periods.current.avgExc - periods.previous.avgExc;
    const sessionDiff = periods.current.totalSessions - periods.previous.totalSessions;

    // Chart data for overlay
    const chartData = useMemo(() => {
        return sheikhs.map(sh => {
            const curr = periods.current.perGroup.find(g => g.group === sh.group);
            const prev = periods.previous.perGroup.find(g => g.group === sh.group);
            return {
                name: sh.group,
                current: curr?.avgAtt || 0,
                previous: prev?.avgAtt || 0,
            };
        });
    }, [periods, sheikhs]);

    const DiffBadge = ({ value, suffix = '%' }: { value: number; suffix?: string }) => (
        <span className={cn("text-[10px] font-bold flex items-center gap-0.5",
            value > 0 ? "text-emerald-600" : value < 0 ? "text-rose-500" : "text-muted-foreground"
        )}>
            {value > 0 ? <TrendingUp className="h-3 w-3" /> : value < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {value > 0 ? '+' : ''}{value}{suffix}
        </span>
    );

    return (
        <div className="space-y-4">
            {/* Mode selector */}
            <div className="flex items-center gap-2 flex-wrap">
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                {[
                    { key: 'month' as const, label: '📅 شهر ↔ شهر' },
                    { key: 'week' as const, label: '📆 أسبوع ↔ أسبوع' },
                ].map(item => (
                    <button key={item.key} onClick={() => setMode(item.key)}
                        className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                            mode === item.key ? "bg-primary text-white border-primary" : "bg-white hover:bg-muted border-border"
                        )}>
                        {item.label}
                    </button>
                ))}
                <span className="text-muted-foreground mx-1">|</span>
                {[
                    { key: 'split' as const, label: '⬛⬛ جنباً لجنب' },
                    { key: 'overlay' as const, label: '📊 تراكب' },
                ].map(item => (
                    <button key={item.key} onClick={() => setViewType(item.key)}
                        className={cn("text-xs font-bold px-3 py-1.5 rounded-lg border transition-all",
                            viewType === item.key ? "bg-indigo-500 text-white border-indigo-500" : "bg-white hover:bg-muted border-border"
                        )}>
                        {item.label}
                    </button>
                ))}
            </div>

            {/* Diff summary */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-blue-700">{periods.current.avgAtt}%</div>
                    <div className="text-[9px] text-muted-foreground mb-1">الحضور الحالي</div>
                    <DiffBadge value={attDiff} />
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-purple-700">{periods.current.avgExc}%</div>
                    <div className="text-[9px] text-muted-foreground mb-1">ممتاز الحالي</div>
                    <DiffBadge value={excDiff} />
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-3 text-center">
                    <div className="text-xl font-black text-emerald-700">{periods.current.totalSessions}</div>
                    <div className="text-[9px] text-muted-foreground mb-1">إجمالي الحصص</div>
                    <DiffBadge value={sessionDiff} suffix="" />
                </div>
            </div>

            {viewType === 'split' ? (
                /* Split View */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[periods.current, periods.previous].map((period, idx) => (
                        <div key={idx} className={cn("border rounded-2xl overflow-hidden shadow-md",
                            idx === 0 ? "bg-blue-50/20" : "bg-slate-50/20"
                        )}>
                            <div className={cn("p-3 border-b font-bold text-sm text-center",
                                idx === 0 ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700"
                            )}>
                                {idx === 0 ? '📅 الفترة الحالية' : '📅 الفترة السابقة'}: {period.label}
                            </div>
                            <div className="divide-y">
                                {period.perGroup.map(g => (
                                    <div key={g.group} className="flex items-center gap-2 px-3 py-2">
                                        <span className="text-xs font-bold min-w-[40px]">{g.group}</span>
                                        <div className="flex-1 bg-muted/30 rounded-full h-3 overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all", idx === 0 ? "bg-blue-400" : "bg-slate-400")}
                                                style={{ width: `${g.avgAtt}%` }} />
                                        </div>
                                        <span className="text-[10px] font-bold min-w-[35px] text-right">{g.avgAtt}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Overlay chart */
                <div className="border rounded-2xl overflow-hidden shadow-lg bg-white">
                    <div className="bg-gradient-to-l from-indigo-50 to-blue-50 border-b p-3">
                        <h3 className="text-sm font-black flex items-center gap-2">
                            <BarChart2 className="h-4 w-4 text-indigo-500" />
                            مقارنة الحضور: {periods.current.label} vs {periods.previous.label}
                        </h3>
                    </div>
                    <div className="h-64 p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                                <RechartsTooltip
                                    formatter={(value: number, name: string) => [`${value}%`, name === 'current' ? 'الحالي' : 'السابق']}
                                    contentStyle={{ direction: 'rtl', borderRadius: '12px', fontSize: '11px' }}
                                />
                                <Legend formatter={(value: string) => value === 'current' ? '📅 الحالي' : '📅 السابق'} wrapperStyle={{ fontSize: '10px' }} />
                                <Bar dataKey="current" fill="#3b82f6" radius={[4, 4, 0, 0]} name="current" />
                                <Bar dataKey="previous" fill="#94a3b8" radius={[4, 4, 0, 0]} name="previous" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
