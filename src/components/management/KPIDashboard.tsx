"use client";

import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Users, CalendarCheck, BookOpen, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Ring Chart SVG Component ─────────────────────────────────────────────────
function RingChart({ value, max, color, size = 64, strokeWidth = 6 }: {
    value: number; max: number; color: string; size?: number; strokeWidth?: number;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = max > 0 ? Math.min(value / max, 1) : 0;
    const dashOffset = circumference * (1 - pct);

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            {/* Background ring */}
            <circle
                cx={size / 2} cy={size / 2} r={radius}
                stroke="currentColor"
                className="text-muted/20"
                strokeWidth={strokeWidth}
                fill="none"
            />
            {/* Progress ring */}
            <circle
                cx={size / 2} cy={size / 2} r={radius}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-1000 ease-out"
            />
        </svg>
    );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ icon, label, value, displayValue, max, color, bgGradient, trend }: {
    icon: React.ReactNode;
    label: string;
    value: number;
    displayValue: string;
    max: number;
    color: string;
    bgGradient: string;
    trend?: number | null;
}) {
    return (
        <div className={cn(
            "relative overflow-hidden rounded-2xl border p-3 sm:p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] group",
            bgGradient
        )}>
            {/* Background decoration */}
            <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />

            <div className="flex items-center gap-3">
                {/* Ring Chart */}
                <div className="relative shrink-0">
                    <RingChart value={value} max={max} color={color} size={56} strokeWidth={5} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black" style={{ color }}>{max > 0 ? Math.round((value / max) * 100) : 0}%</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        {icon}
                        <span className="text-[10px] font-bold text-muted-foreground truncate">{label}</span>
                    </div>
                    <div className="font-black text-lg leading-tight">{displayValue}</div>
                    {trend != null && (
                        <div className={cn("flex items-center gap-0.5 text-[9px] font-bold mt-0.5",
                            trend > 0 ? "text-emerald-600" : trend < 0 ? "text-rose-500" : "text-muted-foreground"
                        )}>
                            {trend > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : trend < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
                            {trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : 'مستقر'}
                            <span className="text-muted-foreground font-normal mr-0.5">عن الأسبوع الماضي</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main KPI Dashboard ──────────────────────────────────────────────────────
interface KPIDashboardProps {
    sheikhs: { group: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
    dailySessions: any;
    groupSessions: Map<string, Map<string, any[]>>;
    selectedDate: Date;
    students: any[];
}

export function KPIDashboard({ sheikhs, getDayStats, dailySessions, groupSessions, selectedDate, students }: KPIDashboardProps) {
    const todayStr = format(selectedDate, 'yyyy-MM-dd');

    const kpiData = useMemo(() => {
        // 1. Today's attendance
        let totalAtt = 0, attCount = 0;
        let groupsRecorded = 0;
        sheikhs.forEach(sh => {
            const stats = getDayStats(sh.group, todayStr);
            if (stats && stats.type !== 'يوم عطلة' && stats.type !== 'غياب الشيخ') {
                groupsRecorded++;
                if (stats.attendance !== null) { totalAtt += stats.attendance; attCount++; }
            }
        });
        const avgAttendance = attCount > 0 ? Math.round(totalAtt / attCount) : 0;

        // 2. Groups registered today vs total
        const totalGroups = sheikhs.length;

        // 3. Sessions this month
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        let monthSessionCount = 0;
        const totalPossible = sheikhs.length * monthDays.length;
        sheikhs.forEach(sh => {
            monthDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                if (stats && (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية')) {
                    monthSessionCount++;
                }
            });
        });

        // 4. Excellent evaluation rate (today)
        let totalExcellent = 0, totalEvals = 0;
        sheikhs.forEach(sh => {
            const stats = getDayStats(sh.group, todayStr);
            if (stats && stats.attendance !== null) {
                if (stats.excellent !== null) totalExcellent += stats.excellent;
                // Count total evaluated (non-null eval fields)
                ['excellent', 'goodPlus', 'good', 'acceptable', 'weak', 'notMemorized'].forEach(key => {
                    if ((stats as any)[key] !== null) totalEvals += (stats as any)[key];
                });
            }
        });
        const excellentRate = totalEvals > 0 ? Math.round((totalExcellent / totalEvals) * 100) : 0;

        // 5. Trend: compare to previous week same day
        const prevWeekStr = format(new Date(selectedDate.getTime() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
        let prevAtt = 0, prevAttCount = 0;
        sheikhs.forEach(sh => {
            const stats = getDayStats(sh.group, prevWeekStr);
            if (stats && stats.attendance !== null && stats.type !== 'يوم عطلة' && stats.type !== 'غياب الشيخ') {
                prevAtt += stats.attendance; prevAttCount++;
            }
        });
        const prevAvgAtt = prevAttCount > 0 ? Math.round(prevAtt / prevAttCount) : null;
        const attTrend = prevAvgAtt !== null && avgAttendance > 0 ? avgAttendance - prevAvgAtt : null;

        return { avgAttendance, groupsRecorded, totalGroups, monthSessionCount, totalPossible, excellentRate, attTrend };
    }, [sheikhs, getDayStats, todayStr, selectedDate]);

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 print:hidden">
            <KPICard
                icon={<Users className="h-3.5 w-3.5 text-blue-500" />}
                label="الحضور العام اليوم"
                value={kpiData.avgAttendance}
                displayValue={kpiData.avgAttendance > 0 ? `${kpiData.avgAttendance}%` : '—'}
                max={100}
                color="#3b82f6"
                bgGradient="bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border-blue-100"
                trend={kpiData.attTrend}
            />
            <KPICard
                icon={<CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />}
                label="الأفواج المسجلة اليوم"
                value={kpiData.groupsRecorded}
                displayValue={`${kpiData.groupsRecorded} / ${kpiData.totalGroups}`}
                max={kpiData.totalGroups}
                color="#10b981"
                bgGradient="bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border-emerald-100"
            />
            <KPICard
                icon={<BookOpen className="h-3.5 w-3.5 text-amber-500" />}
                label="حصص الشهر"
                value={kpiData.monthSessionCount}
                displayValue={`${kpiData.monthSessionCount}`}
                max={Math.max(kpiData.totalPossible, 1)}
                color="#f59e0b"
                bgGradient="bg-gradient-to-br from-amber-50/80 to-yellow-50/50 border-amber-100"
            />
            <KPICard
                icon={<Star className="h-3.5 w-3.5 text-purple-500" />}
                label="نسبة تقييم ممتاز"
                value={kpiData.excellentRate}
                displayValue={kpiData.excellentRate > 0 ? `${kpiData.excellentRate}%` : '—'}
                max={100}
                color="#8b5cf6"
                bgGradient="bg-gradient-to-br from-purple-50/80 to-violet-50/50 border-purple-100"
            />
        </div>
    );
}
