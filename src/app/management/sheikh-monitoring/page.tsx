"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import {
    Shield, Loader2, CheckCircle2, XCircle, Clock, BookOpen,
    ChevronLeft, ChevronRight, Users, Activity, RotateCcw,
    TrendingUp, TrendingDown, Minus, BarChart2, Star, Award, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, getDay, isToday, addDays, addMonths, subMonths,
    getISOWeek, eachWeekOfInterval, min, max, parseISO
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Types ───────────────────────────────────────────────────────────────────
interface GroupSheikhInfo {
    uid: string;
    group: string;
    displayName: string;
    uids: Set<string>;
}

interface DayStats {
    session: any;
    type: string;
    attendance: number | null;
    excellent: number | null;
    goodPlus: number | null;
    good: number | null;
    acceptable: number | null;
    weak: number | null;
    notMemorized: number | null;
}

interface MonthlySheikhStats {
    group: string;
    displayName: string;
    totalDays: number;
    sessionDays: number;       // days with a basic/makeup/extra session
    sheikhabsences: number;    // days where sessionType = 'غياب الشيخ'
    holidays: number;          // days where sessionType = 'يوم عطلة'
    commitmentRate: number;    // sessionDays / (totalDays - holidays - sheikhabsences) * 100
    avgAttendance: number | null;
    avgExcellent: number | null;
    avgGoodPlus: number | null;
    avgGood: number | null;
    weeklyBreakdown: WeekStats[];
}

interface WeekStats {
    label: string;          // e.g. "أ1"
    dateRange: string;     // e.g. "سبت 1 — أرب 5 فبراير"
    startDate: Date;
    endDate: Date;
    sessionDays: number;
    avgAttendance: number | null;
    avgExcellent: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    'حصة أساسية': { label: 'أساسية', dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
    'حصة تعويضية': { label: 'تعويضية', dot: 'bg-amber-500', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
    'حصة إضافية': { label: 'إضافية', dot: 'bg-indigo-500', bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700' },
    'حصة أنشطة': { label: 'أنشطة', dot: 'bg-purple-500', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
    'يوم عطلة': { label: 'عطلة', dot: 'bg-sky-400', bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700' },
    'غياب الشيخ': { label: 'غياب شيخ', dot: 'bg-rose-500', bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700' },
};

const EVAL_COLS = [
    { key: 'attendance', label: 'الحضور', color: (v: number) => v >= 90 ? 'text-emerald-700 font-bold' : v >= 70 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold' },
    { key: 'excellent', label: 'ممتاز', color: () => 'text-emerald-700' },
    { key: 'goodPlus', label: 'ج.جداً', color: () => 'text-green-600' },
    { key: 'good', label: 'جيد', color: () => 'text-blue-600' },
    { key: 'acceptable', label: 'مقبول', color: () => 'text-orange-600' },
    { key: 'weak', label: 'ضعيف', color: () => 'text-rose-600' },
    { key: 'notMemorized', label: 'لم يحفظ', color: () => 'text-gray-500' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pctColor(v: number | null, thresholds = [90, 70]) {
    if (v === null) return 'text-muted-foreground';
    if (v >= thresholds[0]) return 'text-emerald-700 font-bold';
    if (v >= thresholds[1]) return 'text-amber-600 font-bold';
    return 'text-rose-600 font-bold';
}

function avg(nums: (number | null)[]): number | null {
    const valid = nums.filter((n): n is number => n !== null);
    return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}

function PctCell({ v, thresholds }: { v: number | null; thresholds?: [number, number] }) {
    if (v === null) return <span className="text-muted-foreground/40 text-xs">—</span>;
    return <span className={cn('text-xs', pctColor(v, thresholds || [90, 70]))}>{v}%</span>;
}

function TrendIcon({ curr, prev }: { curr: number | null; prev: number | null }) {
    if (curr === null || prev === null) return null;
    const diff = curr - prev;
    if (Math.abs(diff) < 2) return <Minus className="h-3 w-3 text-gray-400 inline-block ml-0.5" />;
    if (diff > 0) return <TrendingUp className="h-3 w-3 text-emerald-500 inline-block ml-0.5" />;
    return <TrendingDown className="h-3 w-3 text-rose-500 inline-block ml-0.5" />;
}

function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
    const bg: Record<string, string> = { emerald: 'bg-emerald-50 border-emerald-100', amber: 'bg-amber-50 border-amber-100', blue: 'bg-blue-50 border-blue-100', purple: 'bg-purple-50 border-purple-100' };
    return (
        <div className={cn("rounded-xl border p-3 flex items-center gap-3", bg[color] || 'bg-muted/30 border')}>
            <div className="shrink-0">{icon}</div>
            <div>
                <div className="text-base font-bold leading-none">{value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SheikhMonitoringPage() {
    const { dailySessions, allUsers, loading, students } = useStudentContext();
    const { isManagement } = useAuth();

    type ViewMode = 'day' | 'week' | 'month' | 'stats';
    const [view, setView] = useState<ViewMode>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [statsMonth, setStatsMonth] = useState(new Date());
    const [sortStat, setSortStat] = useState<'group' | 'att' | 'commit' | 'excellent'>('group');
    const [sortDir, setSortDir] = useState<1 | -1>(1);

    // ── Sheikhs ────────────────────────────────────────────────────────────
    const sheikhs = useMemo<GroupSheikhInfo[]>(() => {
        const map = new Map<string, GroupSheikhInfo>();
        allUsers.filter(u => u.role === 'sheikh' && u.group).forEach(u => {
            if (!map.has(u.group!)) map.set(u.group!, { ...u, group: u.group!, uids: new Set([u.uid]) } as any);
            else map.get(u.group!)!.uids.add(u.uid);
        });
        return Array.from(map.values()).sort((a, b) => parseInt(a.group.replace(/\D/g, '') || '0') - parseInt(b.group.replace(/\D/g, '') || '0'));
    }, [allUsers]);

    // ── Group sessions index: group → date → sessions[] ───────────────────
    const groupSessions = useMemo(() => {
        const result = new Map<string, Map<string, any[]>>();
        sheikhs.forEach(sh => result.set(sh.group, new Map()));
        if (!dailySessions) return result;

        Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
            Object.values(daySessions as Record<string, any>).forEach(session => {
                const owner = sheikhs.find(sh => sh.uids.has(session.ownerId));
                if (!owner) return;
                const gMap = result.get(owner.group)!;
                const arr = gMap.get(dateStr) || [];
                if (!arr.some(s => s.sessionNumber === session.sessionNumber)) {
                    arr.push({ ...session, dateStr });
                    gMap.set(dateStr, arr);
                }
            });
        });
        return result;
    }, [sheikhs, dailySessions]);

    // ── Student counts ──────────────────────────────────────────────────────
    const groupStudentCount = useMemo(() => {
        const map: Record<string, number> = {};
        sheikhs.forEach(sh => {
            map[sh.group] = (students || []).filter(
                s => s.status === 'نشط' && ((s as any).group === sh.group || s.groupName === sh.group)
            ).length;
        });
        return map;
    }, [sheikhs, students]);

    // ── Get day stats for one group+date ──────────────────────────────────
    const getDayStats = useCallback((group: string, dateStr: string): DayStats | null => {
        const sessions = groupSessions.get(group)?.get(dateStr) || [];
        const session = sessions.find(s => s.sessionNumber === 1) || sessions[0] || null;
        if (!session) return null;

        const records: any[] = session.records || [];
        const total = groupStudentCount[group] || 0;
        if (!records.length || !total) return { session, type: session.sessionType, attendance: null, excellent: null, goodPlus: null, good: null, acceptable: null, weak: null, notMemorized: null };

        let present = 0, excellent = 0, goodPlus = 0, good = 0, acceptable = 0, weak = 0, notMem = 0;
        records.forEach(r => {
            if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') present++;
            if (!r.review) {
                if (r.memorization === 'ممتاز') excellent++;
                else if (r.memorization === 'جيد جدا' || r.memorization === 'جيد جداً') goodPlus++;
                else if (r.memorization === 'جيد') good++;
                else if (r.memorization === 'مقبول' || r.memorization === 'حسن') acceptable++;
                else if (r.memorization === 'ضعيف' || r.memorization === 'متوسط') weak++;
                else if (r.memorization === 'لم يحفظ') notMem++;
            }
        });
        const p = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
        return { session, type: session.sessionType, attendance: p(present), excellent: p(excellent), goodPlus: p(goodPlus), good: p(good), acceptable: p(acceptable), weak: p(weak), notMemorized: p(notMem) };
    }, [groupSessions, groupStudentCount]);

    // ── Monthly analytics per sheikh ───────────────────────────────────────
    const monthlyStats = useMemo<MonthlySheikhStats[]>(() => {
        const start = startOfMonth(statsMonth);
        const end = endOfMonth(statsMonth);
        const allDays = eachDayOfInterval({ start, end });


        return sheikhs.map(sh => {
            let sessionDays = 0, sheikhabsences = 0, holidays = 0;
            const attVals: (number | null)[] = [];
            const excVals: (number | null)[] = [];
            const gpVals: (number | null)[] = [];
            const gdVals: (number | null)[] = [];

            allDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                if (!stats) return;
                if (stats.type === 'يوم عطلة') { holidays++; return; }
                if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }
                if (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                    sessionDays++;
                    attVals.push(stats.attendance);
                    excVals.push(stats.excellent);
                    gpVals.push(stats.goodPlus);
                    gdVals.push(stats.good);
                }
            });

            const workingDays = allDays.length - holidays - sheikhabsences;
            const commitmentRate = workingDays > 0 ? Math.round((sessionDays / workingDays) * 100) : 0;

            // weekly breakdown — school week = Saturday (6) → Wednesday (6+4)
            // A week BELONGS TO a month if its Wednesday falls within that month.
            // → collect all Saturdays where (Saturday + 4) is within [start, end]
            const firstEligibleSat = addDays(start, -4); // earliest Sat whose Wed = start
            const lastEligibleSat = addDays(end, -4); // latest  Sat whose Wed = end
            const weekStarts = eachDayOfInterval({ start: firstEligibleSat, end: lastEligibleSat })
                .filter(d => getDay(d) === 6); // only Saturdays

            const weeklyBreakdown: WeekStats[] = weekStarts.map((wStart, i) => {
                const wEnd = addDays(wStart, 4); // always Wednesday, no clipping
                // School days: Sat(6), Sun(0), Mon(1), Tue(2), Wed(3) — already guaranteed by Sat+0..4
                const wDays = eachDayOfInterval({ start: wStart, end: wEnd });
                let wSessions = 0;
                const wAtt: (number | null)[] = [];
                const wExc: (number | null)[] = [];
                wDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const stats = getDayStats(sh.group, dateStr);
                    if (!stats || stats.type === 'يوم عطلة' || stats.type === 'غياب الشيخ') return;
                    if (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        wSessions++;
                        wAtt.push(stats.attendance);
                        wExc.push(stats.excellent);
                    }
                });
                // Full date range e.g. "سبت 28 فبراير — أرب 04 مارس"
                const startFmt = format(wStart, 'dd MMM', { locale: ar });
                const endFmt = format(wEnd, 'dd MMM', { locale: ar });
                const dateRange = `سبت ${startFmt} — أرب ${endFmt}`;
                return {
                    label: `أ${i + 1}`,
                    dateRange,
                    startDate: wStart,
                    endDate: wEnd,
                    sessionDays: wSessions,
                    avgAttendance: avg(wAtt),
                    avgExcellent: avg(wExc)
                };
            });

            return {
                group: sh.group, displayName: sh.displayName,
                totalDays: allDays.length, sessionDays, sheikhabsences, holidays, commitmentRate,
                avgAttendance: avg(attVals), avgExcellent: avg(excVals), avgGoodPlus: avg(gpVals), avgGood: avg(gdVals),
                weeklyBreakdown,
            };
        });
    }, [sheikhs, statsMonth, getDayStats]);

    const sortedStats = useMemo(() => {
        return [...monthlyStats].sort((a, b) => {
            if (sortStat === 'group') return sortDir * a.group.localeCompare(b.group, 'ar');
            if (sortStat === 'att') return sortDir * ((b.avgAttendance ?? -1) - (a.avgAttendance ?? -1));
            if (sortStat === 'commit') return sortDir * (b.commitmentRate - a.commitmentRate);
            if (sortStat === 'excellent') return sortDir * ((b.avgExcellent ?? -1) - (a.avgExcellent ?? -1));
            return 0;
        });
    }, [monthlyStats, sortStat, sortDir]);

    const toggleSort = (col: typeof sortStat) => {
        if (sortStat === col) setSortDir(d => d === 1 ? -1 : 1);
        else { setSortStat(col); setSortDir(1); }
    };

    // ── Today data ──────────────────────────────────────────────────────────
    const todayStr = format(selectedDate, 'yyyy-MM-dd');
    const todaySummary = useMemo(() => {
        let recorded = 0, missing = 0, totalAtt = 0, attCount = 0;
        sheikhs.forEach(sh => {
            const stats = getDayStats(sh.group, todayStr);
            if (stats) { recorded++; if (stats.attendance !== null) { totalAtt += stats.attendance; attCount++; } }
            else missing++;
        });
        return { recorded, missing, avgAtt: attCount > 0 ? Math.round(totalAtt / attCount) : null };
    }, [sheikhs, getDayStats, todayStr]);

    // ── Navigation ──────────────────────────────────────────────────────────
    const navigate = (dir: -1 | 1) => {
        if (view === 'day') setSelectedDate(d => addDays(d, dir));
        else if (view === 'week') setSelectedDate(d => addDays(d, dir * 7));
        else if (view === 'month') setSelectedDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
        else setStatsMonth(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    };

    const navLabel = view === 'day'
        ? format(selectedDate, 'EEEE، d MMMM yyyy', { locale: ar })
        : view === 'week'
            ? `${format(startOfWeek(selectedDate, { weekStartsOn: 6 }), 'd MMM', { locale: ar })} — ${format(endOfWeek(selectedDate, { weekStartsOn: 6 }), 'd MMM yyyy', { locale: ar })}`
            : view === 'month'
                ? format(selectedDate, 'MMMM yyyy', { locale: ar })
                : format(statsMonth, 'MMMM yyyy', { locale: ar });

    const interval = useMemo(() => {
        if (view === 'week') return eachDayOfInterval({ start: startOfWeek(selectedDate, { weekStartsOn: 6 }), end: endOfWeek(selectedDate, { weekStartsOn: 6 }) });
        if (view === 'month') return eachDayOfInterval({ start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) });
        return [];
    }, [view, selectedDate]);

    // ─── Guards ────────────────────────────────────────────────────────────
    if (!isManagement) return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Shield className="h-16 w-16 text-rose-500" />
            <h1 className="text-2xl font-bold">هذه الصفحة للإدارة فقط</h1>
            <Button asChild><Link href="/home">الرئيسية</Link></Button>
        </div>
    );
    if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

    // ─── Render ────────────────────────────────────────────────────────────
    return (
        <TooltipProvider>
            <div className="max-w-screen-xl mx-auto p-2 sm:p-4 space-y-4 pb-24 font-body" dir="rtl">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-xl"><Shield className="h-5 w-5 text-primary" /></div>
                        <div>
                            <h1 className="text-lg font-bold leading-tight">مراقبة المشايخ</h1>
                            <p className="text-[11px] text-muted-foreground">{sheikhs.length} فوج مسجل</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border">
                        {(['day', 'week', 'month', 'stats'] as const).map(v => (
                            <button key={v} onClick={() => setView(v)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all", view === v ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted")}>
                                {v === 'day' ? '📅 اليوم' : v === 'week' ? '📆 الأسبوع' : v === 'month' ? '🗓 الشهر' : '📊 إحصائيات'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Date Navigation ── */}
                <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8 px-2"><ChevronRight className="h-4 w-4" /></Button>
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold">{navLabel}</span>
                        {view !== 'stats' && !isToday(selectedDate) && (
                            <button onClick={() => setSelectedDate(new Date())} className="text-[10px] text-primary flex items-center gap-1 mt-0.5">
                                <RotateCcw className="h-2.5 w-2.5" /> اليوم
                            </button>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(1)} className="h-8 px-2"><ChevronLeft className="h-4 w-4" /></Button>
                </div>

                {/* ── Summary Row (Day view only) ── */}
                {view === 'day' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <SummaryCard icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} label="سجّلوا الحصة" value={todaySummary.recorded} color="emerald" />
                        <SummaryCard icon={<Clock className="h-4 w-4 text-amber-500" />} label="لم يسجّلوا" value={todaySummary.missing} color="amber" />
                        <SummaryCard icon={<Users className="h-4 w-4 text-blue-600" />} label="إجمالي الأفواج" value={sheikhs.length} color="blue" />
                        <SummaryCard icon={<Activity className="h-4 w-4 text-purple-600" />} label="متوسط الحضور" value={todaySummary.avgAtt !== null ? `${todaySummary.avgAtt}%` : '—'} color="purple" />
                    </div>
                )}

                {/* ── Legend (day/week/month only) ── */}
                {view !== 'stats' && (
                    <div className="flex flex-wrap gap-2 text-[10px]">
                        {Object.entries(TYPE_CONFIG).map(([, cfg]) => (
                            <span key={cfg.label} className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-full border">
                                <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />{cfg.label}
                            </span>
                        ))}
                        <span className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-full border">
                            <span className="w-2 h-2 rounded-full bg-slate-300" />لم يسجّل
                        </span>
                    </div>
                )}

                {/* ── Main Content ── */}
                {view === 'day' && <DayTable sheikhs={sheikhs} getDayStats={getDayStats} dateStr={todayStr} />}
                {(view === 'week' || view === 'month') && (
                    <MatrixTable sheikhs={sheikhs} groupSessions={groupSessions} interval={interval} />
                )}
                {view === 'stats' && (
                    <StatsView sortedStats={sortedStats} monthlyStats={monthlyStats} statsMonth={statsMonth} sortStat={sortStat} sortDir={sortDir} toggleSort={toggleSort} />
                )}
            </div>
        </TooltipProvider>
    );
}

// ─── DayTable Component ───────────────────────────────────────────────────────
function DayTable({ sheikhs, getDayStats, dateStr }: { sheikhs: GroupSheikhInfo[]; getDayStats: (g: string, d: string) => DayStats | null; dateStr: string }) {
    return (
        <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-muted/30 border-b">
                            <th className="sticky right-0 z-20 bg-muted/30 text-right p-2 sm:p-3 text-xs font-bold border-l min-w-[120px] sm:min-w-[160px]">الفوج / الشيخ</th>
                            <th className="p-2 text-center text-xs font-bold border-l min-w-[100px] whitespace-nowrap">نوع الحصة</th>
                            {EVAL_COLS.map(col => <th key={col.key} className="p-2 text-center text-xs font-bold border-l min-w-[55px]">{col.label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {sheikhs.map((sh, idx) => {
                            const stats = getDayStats(sh.group, dateStr);
                            const cfg = stats?.type ? TYPE_CONFIG[stats.type] : null;
                            const isHoliday = stats?.type === 'يوم عطلة' || stats?.type === 'غياب الشيخ' || stats?.type === 'حصة أنشطة';
                            return (
                                <tr key={sh.uid} className={cn("border-b hover:bg-muted/10 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-muted/10')}>
                                    <td className={cn("sticky right-0 z-10 p-2 sm:p-3 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                                        <div className="font-bold text-xs sm:text-sm leading-tight">{sh.group}</div>
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[110px] sm:max-w-none">{sh.displayName}</div>
                                    </td>
                                    <td className="p-2 text-center border-l">
                                        {stats ? (
                                            <span className={cn("inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg border", cfg?.bg || 'bg-muted/30 border-border')}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg?.dot || 'bg-gray-400')} />
                                                <span className={cfg?.text || 'text-muted-foreground'}>{cfg?.label || stats.type}</span>
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground/50 border border-dashed rounded-lg px-2 py-1 inline-block">—</span>
                                        )}
                                    </td>
                                    {EVAL_COLS.map(col => {
                                        const val: number | null = stats ? (stats as any)[col.key] : null;
                                        const showDash = !stats || isHoliday || val === null;
                                        return (
                                            <td key={col.key} className="p-2 text-center border-l">
                                                {showDash ? <span className="text-muted-foreground/30 text-xs">—</span> : <span className={cn("text-xs", col.color(val as number))}>{val}%</span>}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── MatrixTable Component ────────────────────────────────────────────────────
function MatrixTable({ sheikhs, groupSessions, interval }: { sheikhs: GroupSheikhInfo[]; groupSessions: Map<string, Map<string, any[]>>; interval: Date[] }) {
    return (
        <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="border-collapse text-xs w-full">
                    <thead>
                        <tr className="bg-muted/30 border-b">
                            <th className="sticky right-0 z-20 bg-muted/30 text-right p-2 text-xs font-bold border-l min-w-[130px]">الفوج / الشيخ</th>
                            {interval.map(day => {
                                const isWk = getDay(day) === 4 || getDay(day) === 5;
                                return (
                                    <th key={day.toISOString()} className={cn("p-1.5 text-center border-l min-w-[48px]", isWk ? "bg-sky-50/60 text-sky-600" : "", isToday(day) && "bg-primary/5 text-primary")}>
                                        <div className="font-bold text-[10px]">{format(day, 'EEE', { locale: ar })}</div>
                                        <div className="text-[9px] opacity-60">{format(day, 'd')}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {sheikhs.map((sh, idx) => (
                            <tr key={sh.uid} className={cn("border-b hover:bg-muted/5 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-muted/10')}>
                                <td className={cn("sticky right-0 z-10 p-2 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                                    <div className="font-bold text-[11px] leading-tight">{sh.group}</div>
                                    <div className="text-[9px] text-muted-foreground truncate max-w-[120px]">{sh.displayName}</div>
                                </td>
                                {interval.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const isWk = getDay(day) === 4 || getDay(day) === 5;
                                    const sessions = groupSessions.get(sh.group)?.get(dateStr) || [];
                                    const s1 = sessions.find(s => s.sessionNumber === 1);
                                    const s2 = sessions.find(s => s.sessionNumber === 2);

                                    return (
                                        <td key={day.toISOString()} className={cn("p-1 text-center border-l", isWk && "bg-sky-50/30", isToday(day) && "bg-primary/[0.03]")}>
                                            <div className="flex items-center justify-center gap-0.5 min-h-[28px]">
                                                {sessions.length === 0 ? (isWk ? null : (
                                                    <span className="w-5 h-5 rounded border border-dashed border-slate-200 flex items-center justify-center">
                                                        <XCircle className="h-3 w-3 text-slate-200" />
                                                    </span>
                                                )) : (
                                                    [s1, s2].filter(Boolean).map(s => {
                                                        const cfg = TYPE_CONFIG[s!.sessionType];
                                                        return (
                                                            <Tooltip key={`${s!.id}-${s!.sessionNumber}`} delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <div className={cn("w-5 h-5 rounded-md flex items-center justify-center text-white font-bold text-[9px] cursor-default shadow-sm", cfg?.dot || 'bg-emerald-500')}>
                                                                        {s!.sessionNumber}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="text-xs p-2 max-w-[180px]">
                                                                    <div className="space-y-1">
                                                                        <div className="font-bold">{sh.group} — {format(day, 'd MMM', { locale: ar })}</div>
                                                                        <div>{s!.sessionType}</div>
                                                                        {s!.substituteTeacher && <div className="text-amber-500">البديل: {s!.substituteTeacher}</div>}
                                                                        <div className="text-muted-foreground">{s!.records?.length || 0} طالب</div>
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── StatsView Component ──────────────────────────────────────────────────────
function StatsView({ sortedStats, monthlyStats, statsMonth, sortStat, sortDir, toggleSort }: {
    sortedStats: MonthlySheikhStats[];
    monthlyStats: MonthlySheikhStats[];
    statsMonth: Date;
    sortStat: string;
    sortDir: 1 | -1;
    toggleSort: (col: any) => void;
}) {
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [compareMode, setCompareMode] = useState(false);

    // Top performers
    const topAttendance = [...monthlyStats].sort((a, b) => (b.avgAttendance ?? -1) - (a.avgAttendance ?? -1))[0];
    const topExcellent = [...monthlyStats].sort((a, b) => (b.avgExcellent ?? -1) - (a.avgExcellent ?? -1))[0];
    const topCommit = [...monthlyStats].sort((a, b) => b.commitmentRate - a.commitmentRate)[0];
    const mosAbsent = [...monthlyStats].sort((a, b) => b.sheikhabsences - a.sheikhabsences)[0];

    const SortBtn = ({ col, label }: { col: string; label: string }) => (
        <button onClick={() => toggleSort(col as any)} className={cn("text-xs font-bold flex items-center gap-0.5 whitespace-nowrap hover:text-primary transition-colors", sortStat === col && "text-primary")}>
            {label}
            {sortStat === col ? (sortDir === 1 ? ' ↑' : ' ↓') : ' ⇅'}
        </button>
    );

    return (
        <div className="space-y-4">

            {/* ── Medal summary cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                    { icon: '🏆', label: 'أعلى حضور', group: topAttendance?.group, val: topAttendance?.avgAttendance != null ? `${topAttendance.avgAttendance}%` : '—', color: 'border-amber-200 bg-amber-50' },
                    { icon: '⭐', label: 'أعلى تقييم ممتاز', group: topExcellent?.group, val: topExcellent?.avgExcellent != null ? `${topExcellent.avgExcellent}%` : '—', color: 'border-emerald-200 bg-emerald-50' },
                    { icon: '✅', label: 'أعلى انتظام', group: topCommit?.group, val: `${topCommit?.commitmentRate ?? 0}%`, color: 'border-blue-200 bg-blue-50' },
                    { icon: '⚠️', label: 'أكثر غياب شيخ', group: mosAbsent?.group, val: `${mosAbsent?.sheikhabsences ?? 0} أيام`, color: 'border-rose-200 bg-rose-50' },
                ].map(m => (
                    <div key={m.label} className={cn("rounded-xl border p-3 space-y-1", m.color)}>
                        <div className="text-lg">{m.icon}</div>
                        <div className="text-[10px] text-muted-foreground">{m.label}</div>
                        <div className="font-bold text-sm leading-tight">{m.group || '—'}</div>
                        <div className="text-xs text-muted-foreground">{m.val}</div>
                    </div>
                ))}
            </div>

            {/* ── Main table ── */}
            <div className="border rounded-xl overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-3 bg-muted/20 border-b">
                    <h2 className="font-bold text-sm">ملخص شهر {format(statsMonth, 'MMMM yyyy', { locale: ar })}</h2>
                    <button
                        onClick={() => setCompareMode(c => !c)}
                        className={cn("text-[11px] font-bold px-3 py-1 rounded-lg border transition-colors", compareMode ? "bg-primary text-white border-primary" : "bg-white border-border hover:bg-muted")}
                    >
                        {compareMode ? '◀ عرض مبسط' : '▶ مقارنة أسبوعية'}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-muted/20 border-b">
                                <th className="sticky right-0 z-20 bg-muted/20 text-right p-2 border-l min-w-[130px]"><SortBtn col="group" label="الفوج" /></th>
                                <th className="p-2 text-center border-l min-w-[55px]"><SortBtn col="commit" label="انتظام%" /></th>
                                <th className="p-2 text-center border-l min-w-[50px]">جلسات</th>
                                <th className="p-2 text-center border-l min-w-[50px]">غياب شيخ</th>
                                <th className="p-2 text-center border-l min-w-[55px]"><SortBtn col="att" label="حضور%" /></th>
                                <th className="p-2 text-center border-l min-w-[55px]"><SortBtn col="excellent" label="ممتاز%" /></th>
                                <th className="p-2 text-center border-l min-w-[50px]">ج.جداً%</th>
                                <th className="p-2 text-center border-l min-w-[45px]">جيد%</th>

                                {compareMode && sortedStats[0]?.weeklyBreakdown.map((w, i) => (
                                    <th key={i} className="p-2 text-center border-l min-w-[110px] bg-blue-50/40 text-blue-700">
                                        <div className="font-bold">{w.label}</div>
                                        <div className="text-[9px] opacity-70 whitespace-nowrap">{w.dateRange}</div>
                                        <div className="text-[9px] opacity-50">جلسات / حضور%</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedStats.map((sh, idx) => {
                                // compute prev month trend placeholders — just using current weekly breakdown trend
                                const weeks = sh.weeklyBreakdown;
                                const attTrend = weeks.length >= 2 ? { curr: weeks[weeks.length - 1].avgAttendance, prev: weeks[weeks.length - 2].avgAttendance } : null;

                                return (
                                    <React.Fragment key={sh.group}>
                                        <tr
                                            className={cn("border-b hover:bg-muted/10 transition-colors cursor-pointer", idx % 2 === 0 ? 'bg-white' : 'bg-muted/10', expandedGroup === sh.group && "bg-primary/5")}
                                            onClick={() => setExpandedGroup(g => g === sh.group ? null : sh.group)}
                                        >
                                            <td className={cn("sticky right-0 z-10 p-2 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50', expandedGroup === sh.group && "bg-primary/5")}>
                                                <div className="font-bold text-[11px] leading-tight">{sh.group}</div>
                                                <div className="text-[9px] text-muted-foreground truncate max-w-[120px]">{sh.displayName}</div>
                                            </td>

                                            {/* Commitment rate */}
                                            <td className="p-2 text-center border-l">
                                                <span className={cn("text-xs font-bold", pctColor(sh.commitmentRate))}>{sh.commitmentRate}%</span>
                                            </td>

                                            {/* Session days */}
                                            <td className="p-2 text-center border-l">
                                                <span className="text-xs font-medium">{sh.sessionDays}</span>
                                            </td>

                                            {/* Sheikh absences */}
                                            <td className="p-2 text-center border-l">
                                                <span className={cn("text-xs", sh.sheikhabsences > 3 ? "text-rose-600 font-bold" : sh.sheikhabsences > 1 ? "text-amber-600" : "text-muted-foreground")}>
                                                    {sh.sheikhabsences}
                                                </span>
                                            </td>

                                            {/* Avg attendance */}
                                            <td className="p-2 text-center border-l">
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <PctCell v={sh.avgAttendance} />
                                                    {attTrend && <TrendIcon curr={attTrend.curr} prev={attTrend.prev} />}
                                                </div>
                                            </td>

                                            {/* Avg excellent */}
                                            <td className="p-2 text-center border-l"><PctCell v={sh.avgExcellent} thresholds={[50, 30]} /></td>
                                            <td className="p-2 text-center border-l"><PctCell v={sh.avgGoodPlus} thresholds={[40, 20]} /></td>
                                            <td className="p-2 text-center border-l"><PctCell v={sh.avgGood} thresholds={[40, 20]} /></td>

                                            {/* Weekly breakdown columns (compare mode) */}
                                            {compareMode && sh.weeklyBreakdown.map((w, wi) => (
                                                <td key={wi} className="p-2 text-center border-l bg-blue-50/20">
                                                    <div className="text-[10px] font-bold">{w.sessionDays}ج</div>
                                                    <PctCell v={w.avgAttendance} />
                                                </td>
                                            ))}
                                        </tr>

                                        {/* Expanded week-by-week detail */}
                                        {expandedGroup === sh.group && (
                                            <tr className="border-b bg-primary/5">
                                                <td colSpan={99} className="p-3">
                                                    <div className="space-y-2">
                                                        <div className="text-xs font-bold text-primary mb-2">تفصيل أسبوعي لـ {sh.group} — {sh.displayName}</div>
                                                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                                                            {sh.weeklyBreakdown.map((w, wi) => (
                                                                <div key={wi} className="bg-white rounded-lg border p-2 text-center space-y-1">
                                                                    <div className="font-bold text-[11px] text-primary">{w.label}</div>
                                                                    <div className="text-[9px] text-muted-foreground leading-tight">{w.dateRange}</div>
                                                                    <div className="text-xs"><span className="font-bold">{w.sessionDays}</span> جلسة</div>
                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                        <div className="flex items-center gap-1 text-[10px]">
                                                                            <span className="text-muted-foreground">حضور:</span>
                                                                            <PctCell v={w.avgAttendance} />
                                                                            {wi > 0 && <TrendIcon curr={w.avgAttendance} prev={sh.weeklyBreakdown[wi - 1].avgAttendance} />}
                                                                        </div>
                                                                        <div className="flex items-center gap-1 text-[10px]">
                                                                            <span className="text-muted-foreground">ممتاز:</span>
                                                                            <PctCell v={w.avgExcellent} thresholds={[50, 30]} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        {/* Trend mini chart using CSS */}
                                                        <div className="flex items-end gap-1 mt-2 h-10">
                                                            {sh.weeklyBreakdown.map((w, wi) => {
                                                                const h = w.avgAttendance ?? 0;
                                                                return (
                                                                    <Tooltip key={wi} delayDuration={0}>
                                                                        <TooltipTrigger asChild>
                                                                            <div className="flex flex-col items-center gap-0.5 flex-1">
                                                                                <div
                                                                                    className={cn("w-full rounded-t transition-all", h >= 90 ? 'bg-emerald-400' : h >= 70 ? 'bg-amber-400' : 'bg-rose-400')}
                                                                                    style={{ height: `${Math.max(4, h * 0.4)}px` }}
                                                                                />
                                                                                <div className="text-[8px] text-muted-foreground">{w.label}</div>
                                                                            </div>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="text-xs">{w.label} ({w.dateRange}): {w.avgAttendance ?? '—'}% حضور</TooltipContent>
                                                                    </Tooltip>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>

                        {/* Footer averages */}
                        <tfoot>
                            <tr className="bg-muted/20 border-t-2 font-bold">
                                <td className="sticky right-0 z-10 bg-muted/20 p-2 border-l text-xs font-bold">متوسط الكل</td>
                                <td className="p-2 text-center border-l text-xs">
                                    <PctCell v={avg(sortedStats.map(s => s.commitmentRate))} />
                                </td>
                                <td className="p-2 text-center border-l text-xs">
                                    {avg(sortedStats.map(s => s.sessionDays))}
                                </td>
                                <td className="p-2 text-center border-l text-xs">
                                    {avg(sortedStats.map(s => s.sheikhabsences))}
                                </td>
                                <td className="p-2 text-center border-l text-xs">
                                    <PctCell v={avg(sortedStats.map(s => s.avgAttendance))} />
                                </td>
                                <td className="p-2 text-center border-l text-xs">
                                    <PctCell v={avg(sortedStats.map(s => s.avgExcellent))} thresholds={[50, 30]} />
                                </td>
                                <td className="p-2 text-center border-l text-xs">
                                    <PctCell v={avg(sortedStats.map(s => s.avgGoodPlus))} thresholds={[40, 20]} />
                                </td>
                                <td className="p-2 text-center border-l text-xs">
                                    <PctCell v={avg(sortedStats.map(s => s.avgGood))} thresholds={[40, 20]} />
                                </td>
                                {compareMode && sortedStats[0]?.weeklyBreakdown.map((_, wi) => (
                                    <td key={wi} className="p-2 text-center border-l text-xs bg-blue-50/20">
                                        <PctCell v={avg(sortedStats.map(s => s.weeklyBreakdown[wi]?.avgAttendance ?? null))} />
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* ── Note ── */}
            <p className="text-[10px] text-muted-foreground text-center">
                * انتظام الشيخ = عدد الجلسات المسجلة ÷ أيام العمل الفعلية (مطروحاً منها العطل وأيام غياب الشيخ)
                &nbsp;|&nbsp; اضغط على أي صف لعرض التفصيل الأسبوعي
            </p>
        </div>
    );
}
