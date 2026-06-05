"use client";

import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Users, CalendarCheck, BookOpen, Star, TrendingUp, TrendingDown, Clock, ShieldAlert } from 'lucide-react';
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
    view?: 'day' | 'week' | 'month' | 'stats' | 'students' | 'topStudents' | 'earlyWarning' | 'badges';
}

export function KPIDashboard({ sheikhs, getDayStats, dailySessions, groupSessions, selectedDate, students, view }: KPIDashboardProps) {
    const todayStr = format(selectedDate, 'yyyy-MM-dd');

    const kpiData = useMemo(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

        // Decide if we should show monthly or daily stats
        const isMonthly = view === 'month' || view === 'stats' || view === 'badges' || view === 'topStudents';

        if (isMonthly) {
            // ─── Monthly KPI Data Calculations ───
            let totalAtt = 0, attCount = 0;
            let monthSessionCount = 0;
            let holidaySessionsCount = 0;
            let sheikhAbsencesTotal = 0;
            let totalExcellent = 0, totalEvals = 0;
            let totalGoodPlus = 0, totalGood = 0, totalAcceptable = 0, totalWeak = 0, totalNotMemorized = 0;

            sheikhs.forEach(sh => {
                monthDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const stats = getDayStats(sh.group, dateStr);
                    if (!stats) return;

                    if (stats.type === 'غياب الشيخ') {
                        sheikhAbsencesTotal++;
                        return;
                    }
                    if (stats.type === 'يوم عطلة') {
                        holidaySessionsCount++;
                        return;
                    }

                    const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                    if (isReal) {
                        monthSessionCount++;
                        if (stats.attendance !== null) {
                            totalAtt += stats.attendance;
                            attCount++;
                        }
                        // Count evaluations inside real session
                        ['excellent', 'goodPlus', 'good', 'acceptable', 'weak', 'notMemorized'].forEach(key => {
                            const val = stats[key] ?? stats[key === 'notMemorized' ? 'notMem' : key];
                            if (val !== null && val !== undefined) {
                                totalEvals += val;
                                if (key === 'excellent') totalExcellent += val;
                                else if (key === 'goodPlus') totalGoodPlus += val;
                                else if (key === 'good') totalGood += val;
                                else if (key === 'acceptable') totalAcceptable += val;
                                else if (key === 'weak') totalWeak += val;
                                else if (key === 'notMemorized' || key === 'notMem') totalNotMemorized += val;
                            }
                        });
                    }
                });
            });

            const avgAttendance = attCount > 0 ? Math.round(totalAtt / attCount) : 0;
            const excellentRate = totalEvals > 0 ? Math.round((totalExcellent / totalEvals) * 100) : 0;
            const totalPossible = sheikhs.length * monthDays.length;
            const missingSessionsCount = Math.max(0, totalPossible - monthSessionCount - holidaySessionsCount - sheikhAbsencesTotal);

            return {
                isMonthly: true,
                avgAttendance,
                monthSessionCount,
                excellentRate,
                totalPossible,
                sheikhAbsencesTotal,
                totalGroups: sheikhs.length,
                holidaySessionsCount,
                missingSessionsCount,
                excellentCount: totalExcellent,
                goodPlusCount: totalGoodPlus,
                goodCount: totalGood,
                acceptableCount: totalAcceptable,
                weakCount: totalWeak,
                notMemorizedCount: totalNotMemorized,
                totalEvals,
                excellentRatePercent: totalEvals > 0 ? Math.round((totalExcellent / totalEvals) * 100) : 0,
                goodPlusRatePercent: totalEvals > 0 ? Math.round((totalGoodPlus / totalEvals) * 100) : 0,
                goodRatePercent: totalEvals > 0 ? Math.round((totalGood / totalEvals) * 100) : 0,
                acceptableRatePercent: totalEvals > 0 ? Math.round((totalAcceptable / totalEvals) * 100) : 0,
                weakRatePercent: totalEvals > 0 ? Math.round((totalWeak / totalEvals) * 100) : 0,
                notMemorizedRatePercent: totalEvals > 0 ? Math.round((totalNotMemorized / totalEvals) * 100) : 0,
            };
        } else {
            // ─── Today's (Daily) KPI Data Calculations ───
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

            const totalGroups = sheikhs.length;

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

            let totalExcellent = 0, totalEvals = 0;
            sheikhs.forEach(sh => {
                const stats = getDayStats(sh.group, todayStr);
                if (stats && stats.attendance !== null) {
                    if (stats.excellent !== null) totalExcellent += stats.excellent;
                    ['excellent', 'goodPlus', 'good', 'acceptable', 'weak', 'notMemorized'].forEach(key => {
                        const val = stats[key] ?? stats[key === 'notMemorized' ? 'notMem' : key];
                        if (val !== null && val !== undefined) totalEvals += val;
                    });
                }
            });
            const excellentRate = totalEvals > 0 ? Math.round((totalExcellent / totalEvals) * 100) : 0;

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

            return {
                isMonthly: false,
                avgAttendance,
                groupsRecorded,
                totalGroups,
                monthSessionCount,
                totalPossible,
                excellentRate,
                attTrend
            };
        }
    }, [sheikhs, getDayStats, todayStr, selectedDate, view]);

    if (kpiData.isMonthly) {
        const d = kpiData as any;
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
                {/* Card 1: Attendance Rate */}
                <div className="relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 border-blue-100 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group">
                    <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
                    <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                            <RingChart value={d.avgAttendance} max={100} color="#3b82f6" size={56} strokeWidth={5} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-black text-blue-600">{d.avgAttendance}%</span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Users className="h-3.5 w-3.5 text-blue-500" />
                                <span className="text-[10px] font-bold text-muted-foreground truncate">حضور الطلاب العام للشهر</span>
                            </div>
                            <div className="font-black text-lg text-gray-800">{d.avgAttendance > 0 ? `${d.avgAttendance}%` : '—'}</div>
                            <div className="text-[8px] text-muted-foreground font-semibold mt-1">
                                إجمالي التقييمات المسجلة: {d.totalEvals} تقييم
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 2: Sessions Analysis */}
                <div className="relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 border-emerald-100 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group flex flex-col justify-between">
                    <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 mb-1">
                            <CalendarCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[10px] font-bold text-emerald-800 truncate">تحليل الحصص والنشاط الشهري</span>
                        </div>
                        {/* Stacked Progress Bar */}
                        <div className="w-full h-3 rounded-full bg-gray-200/50 flex overflow-hidden border border-emerald-200 shadow-inner">
                            <div style={{ width: `${d.totalPossible > 0 ? Math.round((d.monthSessionCount / d.totalPossible) * 100) : 0}%` }} className="bg-gradient-to-r from-emerald-500 to-teal-500" title="حصص منجزة" />
                            <div style={{ width: `${d.totalPossible > 0 ? Math.round((d.holidaySessionsCount / d.totalPossible) * 100) : 0}%` }} className="bg-gradient-to-r from-blue-400 to-sky-400" title="أيام عطلة" />
                            <div style={{ width: `${d.totalPossible > 0 ? Math.round((d.sheikhAbsencesTotal / d.totalPossible) * 100) : 0}%` }} className="bg-gradient-to-r from-rose-400 to-red-400" title="غياب الشيخ" />
                            <div style={{ width: `${d.totalPossible > 0 ? Math.round((d.missingSessionsCount / d.totalPossible) * 100) : 0}%` }} className="bg-gray-300" title="غير مسجلة" />
                        </div>
                        {/* Legend with percentages */}
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[8px] text-gray-700 font-bold mt-1">
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="truncate">منجزة: {d.monthSessionCount} ({d.totalPossible > 0 ? Math.round((d.monthSessionCount / d.totalPossible) * 100) : 0}%)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                                <span className="truncate">عطلة: {d.holidaySessionsCount} ({d.totalPossible > 0 ? Math.round((d.holidaySessionsCount / d.totalPossible) * 100) : 0}%)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                                <span className="truncate">غياب: {d.sheikhAbsencesTotal} ({d.totalPossible > 0 ? Math.round((d.sheikhAbsencesTotal / d.totalPossible) * 100) : 0}%)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                                <span className="truncate">غير مسجلة: {d.missingSessionsCount} ({d.totalPossible > 0 ? Math.round((d.missingSessionsCount / d.totalPossible) * 100) : 0}%)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 3: Sheikh Absences & Discipline */}
                <div className="relative overflow-hidden rounded-2xl border p-4 bg-gradient-to-br from-amber-50/80 to-yellow-50/50 border-amber-100 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 group">
                    <div className="absolute -top-4 -left-4 w-20 h-20 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors" />
                    <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                            <RingChart value={d.sheikhAbsencesTotal} max={Math.max(d.totalGroups * 4, 1)} color="#f59e0b" size={56} strokeWidth={5} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-[10px] font-black text-amber-700">
                                    {d.totalPossible > 0 ? Math.round((d.sheikhAbsencesTotal / d.totalPossible) * 100) : 0}%
                                </span>
                            </div>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-[10px] font-bold text-muted-foreground truncate">إجمالي غياب المشايخ</span>
                            </div>
                            <div className="font-black text-lg text-gray-800">{d.sheikhAbsencesTotal} يوم غياب</div>
                            <div className="text-[8px] text-rose-600 font-bold mt-1">
                                معدل الغياب العام للشيخ: {d.totalPossible > 0 ? ((d.sheikhAbsencesTotal / d.totalPossible) * 100).toFixed(1) : 0}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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
                value={kpiData.groupsRecorded ?? 0}
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
                label="نسبة تقييم ممتاز اليوم"
                value={kpiData.excellentRate}
                displayValue={kpiData.excellentRate > 0 ? `${kpiData.excellentRate}%` : '—'}
                max={100}
                color="#8b5cf6"
                bgGradient="bg-gradient-to-br from-purple-50/80 to-violet-50/50 border-purple-100"
            />
        </div>
    );
}
