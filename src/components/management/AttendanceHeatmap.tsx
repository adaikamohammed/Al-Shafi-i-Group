"use client";

import React, { useMemo, useState, useCallback } from 'react';
import {
    format, eachDayOfInterval, startOfYear, endOfYear,
    getMonth, getDay, startOfMonth, endOfMonth, isToday, parseISO, addYears, subYears
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GroupSheikhInfo {
    uid: string;
    group: string;
    displayName: string;
    uids: Set<string>;
}

interface DayDetail {
    dateStr: string;
    sheikhs: Array<{
        group: string;
        displayName: string;
        type: string;
        attendance: number | null;
        excellent: number | null;
    }>;
    avgAttendance: number | null;
    recordedCount: number;
    totalCount: number;
    isHoliday: boolean;
    sheikhabsence: boolean;
}

interface AttendanceHeatmapProps {
    sheikhs: GroupSheikhInfo[];
    getDayStats: (group: string, dateStr: string) => {
        type: string;
        attendance: number | null;
        excellent: number | null;
    } | null;
    groupFilter?: string; // 'all' | specific group
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const ARABIC_WEEKDAYS_SHORT = ['أح', 'إث', 'ثث', 'أر', 'خم', 'جم', 'سب'];

// ─── Color Logic ──────────────────────────────────────────────────────────────
function heatColor(att: number | null, type: 'bg' | 'border' | 'text'): string {
    if (att === null) return type === 'bg' ? 'bg-slate-100 dark:bg-slate-800' : type === 'border' ? 'border-slate-200' : 'text-slate-400';
    if (att >= 90) return type === 'bg' ? 'bg-emerald-500' : type === 'border' ? 'border-emerald-600' : 'text-emerald-700';
    if (att >= 75) return type === 'bg' ? 'bg-emerald-300' : type === 'border' ? 'border-emerald-400' : 'text-emerald-600';
    if (att >= 60) return type === 'bg' ? 'bg-amber-400' : type === 'border' ? 'border-amber-500' : 'text-amber-700';
    if (att >= 40) return type === 'bg' ? 'bg-orange-400' : type === 'border' ? 'border-orange-500' : 'text-orange-700';
    return type === 'bg' ? 'bg-rose-500' : type === 'border' ? 'border-rose-600' : 'text-rose-700';
}

function heatColorStyle(att: number | null): string {
    if (att === null) return '#e2e8f0';
    if (att >= 90) return '#10b981';
    if (att >= 75) return '#6ee7b7';
    if (att >= 60) return '#fbbf24';
    if (att >= 40) return '#f97316';
    return '#ef4444';
}

function heatLabel(att: number | null): string {
    if (att === null) return 'لم يُسجَّل';
    if (att >= 90) return 'ممتاز';
    if (att >= 75) return 'جيد';
    if (att >= 60) return 'متوسط';
    if (att >= 40) return 'ضعيف';
    return 'ضعيف جداً';
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function AttendanceHeatmap({ sheikhs, getDayStats }: AttendanceHeatmapProps) {
    const [year, setYear] = useState(() => new Date().getFullYear());
    const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null);
    const [groupFilter, setGroupFilter] = useState<string>('all');
    const [metricMode, setMetricMode] = useState<'attendance' | 'excellent'>('attendance');

    const displayedSheikhs = useMemo(() =>
        groupFilter === 'all' ? sheikhs : sheikhs.filter(s => s.group === groupFilter),
        [sheikhs, groupFilter]
    );

    // Build yearly day data
    const yearlyData = useMemo(() => {
        const yearStart = startOfYear(new Date(year, 0, 1));
        const yearEnd = endOfYear(new Date(year, 0, 1));
        const allDays = eachDayOfInterval({ start: yearStart, end: yearEnd });

        return allDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const sheikhDetails: DayDetail['sheikhs'] = [];
            let totalAtt = 0, totalExc = 0, count = 0;
            let anyHoliday = false, anySheikhabsence = false;

            displayedSheikhs.forEach(sh => {
                const stats = getDayStats(sh.group, dateStr);
                if (!stats) return;
                if (stats.type === 'يوم عطلة') { anyHoliday = true; return; }
                if (stats.type === 'غياب الشيخ') { anySheikhabsence = true; return; }
                if (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                    sheikhDetails.push({ group: sh.group, displayName: sh.displayName, type: stats.type, attendance: stats.attendance, excellent: stats.excellent });
                    if (stats.attendance !== null) { totalAtt += stats.attendance; count++; }
                    if (stats.excellent !== null) { totalExc += stats.excellent; }
                }
            });

            return {
                day,
                dateStr,
                weekDay: getDay(day),
                month: getMonth(day),
                sheikhs: sheikhDetails,
                avgAttendance: count > 0 ? Math.round(totalAtt / count) : null,
                avgExcellent: count > 0 ? Math.round(totalExc / count) : null,
                recordedCount: sheikhDetails.length,
                totalCount: displayedSheikhs.length,
                isHoliday: anyHoliday && sheikhDetails.length === 0,
                sheikhabsence: anySheikhabsence && sheikhDetails.length === 0,
            };
        });
    }, [year, displayedSheikhs, getDayStats]);

    // Group by month columns
    const monthGrids = useMemo(() => {
        return Array.from({ length: 12 }, (_, m) => {
            const monthStart = startOfMonth(new Date(year, m, 1));
            const monthEnd = endOfMonth(new Date(year, m, 1));
            const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
            const firstDow = (getDay(monthStart) + 0) % 7; // 0=Sun
            return { month: m, days, firstDow };
        });
    }, [year]);

    // Yearly summary stats
    const yearStats = useMemo(() => {
        const active = yearlyData.filter(d => d.recordedCount > 0);
        const avgAtt = active.length ? Math.round(active.reduce((s, d) => s + (d.avgAttendance ?? 0), 0) / active.length) : 0;
        const best = active.reduce<typeof active[0] | null>((b, d) => !b || (d.avgAttendance ?? 0) > (b.avgAttendance ?? 0) ? d : b, null);
        const worst = active.reduce<typeof active[0] | null>((w, d) => !w || (d.avgAttendance ?? 100) < (w.avgAttendance ?? 100) ? d : w, null);
        const holidays = yearlyData.filter(d => d.isHoliday).length;
        const absDays = yearlyData.filter(d => d.sheikhabsence).length;
        return { avgAtt, best, worst, holidays, absDays, recordedDays: active.length };
    }, [yearlyData]);

    // Month stats for bar
    const monthStats = useMemo(() => Array.from({ length: 12 }, (_, m) => {
        const days = yearlyData.filter(d => d.month === m && d.recordedCount > 0);
        return days.length ? Math.round(days.reduce((s, d) => s + (d.avgAttendance ?? 0), 0) / days.length) : null;
    }), [yearlyData]);

    const handleDayClick = useCallback((d: typeof yearlyData[0]) => {
        setSelectedDay({
            dateStr: d.dateStr,
            sheikhs: d.sheikhs,
            avgAttendance: d.avgAttendance,
            recordedCount: d.recordedCount,
            totalCount: d.totalCount,
            isHoliday: d.isHoliday,
            sheikhabsence: d.sheikhabsence,
        });
    }, []);

    const dayDataMap = useMemo(() => {
        const m = new Map<string, typeof yearlyData[0]>();
        yearlyData.forEach(d => m.set(d.dateStr, d));
        return m;
    }, [yearlyData]);

    return (
        <div className="space-y-4" dir="rtl">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                        🌡️ خريطة الحضور الحرارية
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        لون كل يوم يعبر عن متوسط حضور جميع الأفواج — انقر على أي يوم لرؤية التفاصيل
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Metric toggle */}
                    <div className="flex rounded-lg border bg-muted/30 overflow-hidden text-xs">
                        <button onClick={() => setMetricMode('attendance')} className={cn("px-3 py-1.5 font-bold transition-all", metricMode === 'attendance' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted')}>
                            % حضور
                        </button>
                        <button onClick={() => setMetricMode('excellent')} className={cn("px-3 py-1.5 font-bold transition-all", metricMode === 'excellent' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted')}>
                            % ممتاز
                        </button>
                    </div>
                    {/* Group filter */}
                    <select
                        value={groupFilter}
                        onChange={e => setGroupFilter(e.target.value)}
                        className="text-xs border rounded-lg px-2 py-1.5 bg-background font-medium"
                    >
                        <option value="all">كل الأفواج</option>
                        {sheikhs.map(s => (
                            <option key={s.group} value={s.group}>{s.displayName} — فوج {s.group}</option>
                        ))}
                    </select>
                    {/* Year nav */}
                    <div className="flex items-center gap-1 border rounded-lg bg-card px-1 py-0.5">
                        <button onClick={() => setYear(y => y + 1)} className="p-1 hover:bg-muted rounded">
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-sm font-bold px-1">{year}</span>
                        <button onClick={() => setYear(y => y - 1)} className="p-1 hover:bg-muted rounded">
                            <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Summary KPI Cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {[
                    { label: 'متوسط الحضور', value: yearStats.avgAtt ? `${yearStats.avgAtt}%` : '—', icon: '📊', color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                    { label: 'أيام مسجَّلة', value: yearStats.recordedDays, icon: '📅', color: 'text-blue-700 bg-blue-50 border-blue-100' },
                    { label: 'أفضل يوم', value: yearStats.best ? `${yearStats.best.avgAttendance}%` : '—', icon: '🥇', color: 'text-amber-700 bg-amber-50 border-amber-100' },
                    { label: 'أسوأ يوم', value: yearStats.worst ? `${yearStats.worst.avgAttendance}%` : '—', icon: '⚠️', color: 'text-rose-700 bg-rose-50 border-rose-100' },
                    { label: 'أيام العطل', value: yearStats.holidays, icon: '🏖️', color: 'text-sky-700 bg-sky-50 border-sky-100' },
                    { label: 'غياب مشايخ', value: yearStats.absDays, icon: '❌', color: 'text-purple-700 bg-purple-50 border-purple-100' },
                ].map(kpi => (
                    <div key={kpi.label} className={cn("rounded-xl border p-2.5 text-center", kpi.color)}>
                        <div className="text-lg mb-0.5">{kpi.icon}</div>
                        <div className="text-lg font-black leading-none">{kpi.value}</div>
                        <div className="text-[10px] mt-0.5 opacity-80">{kpi.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Monthly Attendance Bar ── */}
            <div className="bg-card border rounded-xl p-4">
                <div className="text-xs font-bold mb-3 text-muted-foreground">متوسط الحضور الشهري</div>
                <div className="flex items-end gap-1 h-16">
                    {monthStats.map((val, m) => (
                        <div key={m} className="flex-1 flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground font-medium">{val !== null ? `${val}%` : ''}</span>
                            <div
                                className="w-full rounded-t-md transition-all"
                                style={{
                                    height: val !== null ? `${Math.max(4, (val / 100) * 52)}px` : '4px',
                                    backgroundColor: val !== null ? heatColorStyle(val) : '#e2e8f0',
                                }}
                                title={`${ARABIC_MONTHS[m]}: ${val ?? 'لا يوجد'}%`}
                            />
                            <span className="text-[8px] text-muted-foreground">{ARABIC_MONTHS[m].slice(0, 3)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Heatmap Grid — 4 columns (3 months each) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {monthGrids.map(({ month, days, firstDow }) => {
                    const monthStat = monthStats[month];
                    return (
                        <div key={month} className="bg-card border rounded-xl p-3">
                            {/* Month header */}
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold">{ARABIC_MONTHS[month]}</span>
                                {monthStat !== null && (
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                        monthStat >= 90 ? 'bg-emerald-100 text-emerald-700' :
                                            monthStat >= 75 ? 'bg-emerald-50 text-emerald-600' :
                                                monthStat >= 60 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-rose-100 text-rose-700'
                                    )}>
                                        {monthStat}% متوسط
                                    </span>
                                )}
                            </div>

                            {/* Weekday labels */}
                            <div className="grid grid-cols-7 mb-1">
                                {['أح', 'إث', 'ثث', 'أر', 'خم', 'جم', 'سب'].map(d => (
                                    <div key={d} className="text-center text-[8px] text-muted-foreground font-medium">{d}</div>
                                ))}
                            </div>

                            {/* Day cells */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {/* Empty cells before month start */}
                                {Array.from({ length: firstDow }, (_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}
                                {days.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const d = dayDataMap.get(dateStr);
                                    const val = metricMode === 'attendance' ? d?.avgAttendance ?? null : d?.avgExcellent ?? null;
                                    const isHoliday = d?.isHoliday;
                                    const isSheikhabsence = d?.sheikhabsence;
                                    const isTodayDay = isToday(day);
                                    const dayNum = format(day, 'd');

                                    return (
                                        <button
                                            key={dateStr}
                                            onClick={() => d && handleDayClick(d)}
                                            className={cn(
                                                "aspect-square w-full rounded-sm transition-all relative text-[7px] font-bold flex items-center justify-center",
                                                "hover:scale-125 hover:z-10 hover:shadow-md",
                                                isHoliday
                                                    ? 'bg-sky-100 text-sky-600'
                                                    : isSheikhabsence
                                                        ? 'bg-purple-100 text-purple-600'
                                                        : d?.recordedCount === 0 || !d
                                                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                                            : '',
                                                isTodayDay ? 'ring-2 ring-primary ring-offset-1' : '',
                                            )}
                                            style={{
                                                backgroundColor: isHoliday
                                                    ? undefined
                                                    : isSheikhabsence
                                                        ? undefined
                                                        : (d?.recordedCount ?? 0) > 0
                                                            ? heatColorStyle(val)
                                                            : undefined,
                                            }}
                                            title={`${format(day, 'EEEE d MMMM', { locale: ar })} — ${isHoliday ? 'عطلة' : isSheikhabsence ? 'غياب شيخ' : val !== null ? `${val}%` : 'لم يُسجَّل'}`}
                                        >
                                            <span className={cn(
                                                "select-none leading-none",
                                                (d?.recordedCount ?? 0) > 0 && !isHoliday && !isSheikhabsence && (val ?? 0) >= 60
                                                    ? 'text-white/90'
                                                    : ''
                                            )}>
                                                {dayNum}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Color Legend ── */}
            <div className="bg-card border rounded-xl p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-xs font-bold text-muted-foreground">المفتاح:</span>
                {[
                    { color: '#10b981', label: '≥90% ممتاز' },
                    { color: '#6ee7b7', label: '75–90% جيد' },
                    { color: '#fbbf24', label: '60–75% متوسط' },
                    { color: '#f97316', label: '40–60% ضعيف' },
                    { color: '#ef4444', label: '<40% ضعيف جداً' },
                    { color: '#e2e8f0', label: 'لم يُسجَّل' },
                ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-[11px] text-muted-foreground">{item.label}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-sm bg-sky-100 flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground">عطلة</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-sm bg-purple-100 flex-shrink-0" />
                    <span className="text-[11px] text-muted-foreground">غياب شيخ</span>
                </div>
            </div>

            {/* ── Day Detail Popup ── */}
            {selectedDay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedDay(null)}>
                    <div
                        className="bg-card border rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                        dir="rtl"
                    >
                        {/* Popup header */}
                        <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between rounded-t-2xl">
                            <div>
                                <div className="font-bold text-sm">
                                    {format(parseISO(selectedDay.dateStr), 'EEEE، d MMMM yyyy', { locale: ar })}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                    {selectedDay.recordedCount > 0
                                        ? `${selectedDay.recordedCount} فوج سجَّل الحصة من أصل ${selectedDay.totalCount}`
                                        : selectedDay.isHoliday ? '🏖️ يوم عطلة'
                                            : selectedDay.sheikhabsence ? '❌ غياب شيخ'
                                                : 'لا توجد بيانات'
                                    }
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedDay.avgAttendance !== null && (
                                    <div
                                        className="text-white text-sm font-black px-3 py-1.5 rounded-full"
                                        style={{ backgroundColor: heatColorStyle(selectedDay.avgAttendance) }}
                                    >
                                        {selectedDay.avgAttendance}%
                                    </div>
                                )}
                                <button onClick={() => setSelectedDay(null)} className="p-1.5 hover:bg-muted rounded-lg">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Sheikh rows */}
                        <div className="p-3 space-y-2">
                            {selectedDay.sheikhs.length === 0 ? (
                                <div className="text-center text-muted-foreground text-sm py-8">
                                    {selectedDay.isHoliday ? '🏖️ يوم عطلة رسمية'
                                        : selectedDay.sheikhabsence ? '❌ غياب شيخ'
                                            : 'لا توجد حصص مسجَّلة لهذا اليوم'}
                                </div>
                            ) : (
                                selectedDay.sheikhs
                                    .sort((a, b) => (b.attendance ?? 0) - (a.attendance ?? 0))
                                    .map(sh => (
                                        <div key={sh.group} className="flex items-center gap-3 bg-muted/30 rounded-xl px-3 py-2.5 border">
                                            {/* Attendance bar */}
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold">{sh.displayName}</span>
                                                    <div className="flex items-center gap-2">
                                                        {sh.excellent !== null && (
                                                            <span className="text-[10px] text-amber-600 font-medium">⭐ {sh.excellent}% ممتاز</span>
                                                        )}
                                                        <span
                                                            className="text-xs font-black"
                                                            style={{ color: heatColorStyle(sh.attendance) }}
                                                        >
                                                            {sh.attendance !== null ? `${sh.attendance}%` : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${sh.attendance ?? 0}%`,
                                                            backgroundColor: heatColorStyle(sh.attendance),
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                            {/* Session type badge */}
                                            <span className={cn(
                                                "text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0",
                                                sh.type === 'حصة أساسية' ? 'bg-emerald-100 text-emerald-700' :
                                                    sh.type === 'حصة تعويضية' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-indigo-100 text-indigo-700'
                                            )}>
                                                {sh.type === 'حصة أساسية' ? 'أساسية' :
                                                    sh.type === 'حصة تعويضية' ? 'تعويض' : 'إضافية'}
                                            </span>
                                        </div>
                                    ))
                            )}
                        </div>

                        {/* Summary footer */}
                        {selectedDay.sheikhs.length > 0 && (
                            <div className="px-4 pb-4">
                                <div className={cn(
                                    "rounded-xl border p-3 text-center text-sm font-bold",
                                    heatColor(selectedDay.avgAttendance, 'text'),
                                )}>
                                    المتوسط العام: {selectedDay.avgAttendance}% — {heatLabel(selectedDay.avgAttendance)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
