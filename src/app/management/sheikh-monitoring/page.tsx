"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import {
    Shield, Loader2, CheckCircle2, XCircle, Clock, BookOpen,
    ChevronLeft, ChevronRight, Users, Activity, RotateCcw,
    CalendarDays, BarChart2, AlertTriangle, UserX, Smile, UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, parseISO, addDays, subDays, getDay, isToday,
    addMonths, subMonths
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Constants ─────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
    'حصة أساسية': { label: 'أساسية', dot: 'bg-emerald-500', bg: 'bg-emerald-50  border-emerald-200', text: 'text-emerald-700' },
    'حصة تعويضية': { label: 'تعويضية', dot: 'bg-amber-500', bg: 'bg-amber-50   border-amber-200', text: 'text-amber-700' },
    'حصة إضافية': { label: 'إضافية', dot: 'bg-indigo-500', bg: 'bg-indigo-50  border-indigo-200', text: 'text-indigo-700' },
    'حصة أنشطة': { label: 'أنشطة', dot: 'bg-purple-500', bg: 'bg-purple-50  border-purple-200', text: 'text-purple-700' },
    'يوم عطلة': { label: 'عطلة', dot: 'bg-sky-400', bg: 'bg-sky-50     border-sky-200', text: 'text-sky-700' },
    'غياب الشيخ': { label: 'غياب شيخ', dot: 'bg-rose-500', bg: 'bg-rose-50    border-rose-200', text: 'text-rose-700' },
};

const getAttColor = (pct: number | null) => {
    if (pct === null) return 'text-muted-foreground';
    if (pct >= 90) return 'text-emerald-700 font-bold';
    if (pct >= 70) return 'text-amber-600 font-bold';
    return 'text-rose-600 font-bold';
};

// ─── Page ───────────────────────────────────────────────────────────────────
export default function SheikhMonitoringPage() {
    const { dailySessions, allUsers, loading, students } = useStudentContext();
    const { isManagement } = useAuth();

    const [view, setView] = useState<'day' | 'week' | 'month'>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());

    // ── Sheikhs grouped by group (one row per group) ──────────────────────
    const sheikhs = useMemo(() => {
        const map = new Map<string, any>();
        allUsers.filter(u => u.role === 'sheikh' && u.group).forEach(u => {
            if (!map.has(u.group!)) map.set(u.group!, { ...u, uids: new Set([u.uid]) });
            else map.get(u.group!).uids.add(u.uid);
        });
        return Array.from(map.values()).sort((a, b) => {
            const na = parseInt(a.group?.replace(/\D/g, '') || '0');
            const nb = parseInt(b.group?.replace(/\D/g, '') || '0');
            return na - nb;
        });
    }, [allUsers]);

    // ── Per-group sessions by date ─────────────────────────────────────────
    const groupSessions = useMemo(() => {
        const result = new Map<string, Map<string, any[]>>(); // group → date → sessions[]
        sheikhs.forEach(sh => result.set(sh.group, new Map()));

        if (!dailySessions) return result;
        Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
            Object.values(daySessions).forEach((session: any) => {
                const owner = sheikhs.find(sh => sh.uids.has(session.ownerId));
                if (!owner) return;
                const groupMap = result.get(owner.group)!;
                const arr = groupMap.get(dateStr) || [];
                // deduplicate by sessionNumber
                if (!arr.some(s => s.sessionNumber === session.sessionNumber)) {
                    arr.push({ ...session, dateStr });
                    groupMap.set(dateStr, arr);
                }
            });
        });
        return result;
    }, [sheikhs, dailySessions]);

    // ── Per-group student count ────────────────────────────────────────────
    const groupStudentCount = useMemo(() => {
        const map: Record<string, number> = {};
        sheikhs.forEach(sh => {
            map[sh.group] = (students || []).filter(
                s => s.status === 'نشط' && ((s as any).group === sh.group || s.groupName === sh.group)
            ).length;
        });
        return map;
    }, [sheikhs, students]);

    // ── Day stats per group ────────────────────────────────────────────────
    const getDayStats = useCallback((group: string, dateStr: string) => {
        const sessions = groupSessions.get(group)?.get(dateStr) || [];
        const session = sessions.find(s => s.sessionNumber === 1) || sessions[0] || null;
        if (!session) return null;

        const records: any[] = session.records || [];
        const total = groupStudentCount[group] || 0;

        if (!records.length || !total) {
            return { session, type: session.sessionType, attendance: null, excellent: null, goodPlus: null, good: null, acceptable: null, weak: null, notMemorized: null };
        }

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
        const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
        return {
            session,
            type: session.sessionType,
            attendance: pct(present),
            excellent: pct(excellent),
            goodPlus: pct(goodPlus),
            good: pct(good),
            acceptable: pct(acceptable),
            weak: pct(weak),
            notMemorized: pct(notMem),
        };
    }, [groupSessions, groupStudentCount]);

    const todayStr = format(selectedDate, 'yyyy-MM-dd');

    // ── Today summary ──────────────────────────────────────────────────────
    const todaySummary = useMemo(() => {
        let recorded = 0, missing = 0, totalAtt = 0, attCount = 0;
        sheikhs.forEach(sh => {
            const stats = getDayStats(sh.group, todayStr);
            if (stats) { recorded++; if (stats.attendance !== null) { totalAtt += stats.attendance; attCount++; } }
            else missing++;
        });
        return { recorded, missing, avgAtt: attCount > 0 ? Math.round(totalAtt / attCount) : null };
    }, [sheikhs, getDayStats, todayStr]);

    // ── Navigation ─────────────────────────────────────────────────────────
    const navigate = (dir: -1 | 1) => {
        if (view === 'day') setSelectedDate(d => addDays(d, dir));
        else if (view === 'week') setSelectedDate(d => addDays(d, dir * 7));
        else setSelectedDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    };

    const navLabel = view === 'day'
        ? format(selectedDate, 'EEEE، d MMMM yyyy', { locale: ar })
        : view === 'week'
            ? `${format(startOfWeek(selectedDate, { weekStartsOn: 6 }), 'd MMM', { locale: ar })} — ${format(endOfWeek(selectedDate, { weekStartsOn: 6 }), 'd MMM yyyy', { locale: ar })}`
            : format(selectedDate, 'MMMM yyyy', { locale: ar });

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
    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
    );

    // ─── Render ────────────────────────────────────────────────────────────
    return (
        <TooltipProvider>
            <div className="max-w-screen-xl mx-auto p-2 sm:p-4 space-y-4 pb-24 font-body" dir="rtl">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold leading-tight">مراقبة المشايخ</h1>
                            <p className="text-[11px] text-muted-foreground">{sheikhs.length} فوج مسجل</p>
                        </div>
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border">
                        {(['day', 'week', 'month'] as const).map(v => (
                            <button key={v} onClick={() => setView(v)} className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                view === v ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
                            )}>
                                {v === 'day' ? 'اليوم' : v === 'week' ? 'الأسبوع' : 'الشهر'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Date Navigation ── */}
                <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8 px-2">
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold">{navLabel}</span>
                        {!isToday(selectedDate) && (
                            <button onClick={() => setSelectedDate(new Date())} className="text-[10px] text-primary flex items-center gap-1 mt-0.5">
                                <RotateCcw className="h-2.5 w-2.5" /> اليوم
                            </button>
                        )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate(1)} className="h-8 px-2">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
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

                {/* ── Legend ── */}
                <div className="flex flex-wrap gap-2 text-[10px]">
                    {Object.entries(TYPE_CONFIG).map(([, cfg]) => (
                        <span key={cfg.label} className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-full border">
                            <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                            {cfg.label}
                        </span>
                    ))}
                    <span className="flex items-center gap-1 bg-muted/30 px-2 py-0.5 rounded-full border">
                        <span className="w-2 h-2 rounded-full bg-slate-300" />
                        لم يسجّل
                    </span>
                </div>

                {/* ── Main Table ── */}
                {view === 'day' ? <DayTable sheikhs={sheikhs} getDayStats={getDayStats} dateStr={todayStr} /> : (
                    <MatrixTable sheikhs={sheikhs} groupSessions={groupSessions} interval={interval} />
                )}

            </div>
        </TooltipProvider>
    );
}

// ─── Summary Card ────────────────────────────────────────────────────────────
function SummaryCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-50 border-emerald-100',
        amber: 'bg-amber-50 border-amber-100',
        blue: 'bg-blue-50 border-blue-100',
        purple: 'bg-purple-50 border-purple-100',
    };
    return (
        <div className={cn("rounded-xl border p-3 flex items-center gap-3", colorMap[color] || 'bg-muted/30 border')}>
            <div className="shrink-0">{icon}</div>
            <div>
                <div className="text-base font-bold leading-none">{value}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
            </div>
        </div>
    );
}

// ─── Day Table ───────────────────────────────────────────────────────────────
const EVAL_COLS = [
    { key: 'attendance', label: 'الحضور', color: (v: number) => v >= 90 ? 'text-emerald-700 font-bold' : v >= 70 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold' },
    { key: 'excellent', label: 'ممتاز', color: () => 'text-emerald-700' },
    { key: 'goodPlus', label: 'ج.جداً', color: () => 'text-green-600' },
    { key: 'good', label: 'جيد', color: () => 'text-blue-600' },
    { key: 'acceptable', label: 'مقبول', color: () => 'text-orange-600' },
    { key: 'weak', label: 'ضعيف', color: () => 'text-rose-600' },
    { key: 'notMemorized', label: 'لم يحفظ', color: () => 'text-gray-500' },
] as const;

function DayTable({ sheikhs, getDayStats, dateStr }: {
    sheikhs: any[];
    getDayStats: (group: string, date: string) => any;
    dateStr: string;
}) {
    return (
        <div className="border rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-muted/30 border-b">
                            <th className="sticky right-0 z-20 bg-muted/30 text-right p-2 sm:p-3 text-xs font-bold border-l min-w-[120px] sm:min-w-[160px]">الفوج / الشيخ</th>
                            <th className="p-2 text-center text-xs font-bold border-l min-w-[100px] whitespace-nowrap">نوع الحصة</th>
                            {EVAL_COLS.map(col => (
                                <th key={col.key} className="p-2 text-center text-xs font-bold border-l min-w-[55px]">{col.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sheikhs.map((sh, idx) => {
                            const stats = getDayStats(sh.group, dateStr);
                            const cfg = stats?.type ? TYPE_CONFIG[stats.type] : null;
                            const isHoliday = stats?.type === 'يوم عطلة' || stats?.type === 'غياب الشيخ' || stats?.type === 'حصة أنشطة';

                            return (
                                <tr key={sh.uid} className={cn("border-b hover:bg-muted/10 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-muted/10')}>
                                    {/* Sticky group column */}
                                    <td className={cn(
                                        "sticky right-0 z-10 p-2 sm:p-3 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]",
                                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                                    )}>
                                        <div className="font-bold text-xs sm:text-sm leading-tight">{sh.group}</div>
                                        <div className="text-[10px] text-muted-foreground truncate max-w-[110px] sm:max-w-none">{sh.displayName}</div>
                                    </td>

                                    {/* Session type badge */}
                                    <td className="p-2 text-center border-l">
                                        {stats ? (
                                            <span className={cn(
                                                "inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg border",
                                                cfg?.bg || 'bg-muted/30 border-border'
                                            )}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg?.dot || 'bg-gray-400')} />
                                                <span className={cfg?.text || 'text-muted-foreground'}>{cfg?.label || stats.type}</span>
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground/50 border border-dashed rounded-lg px-2 py-1 inline-block">—</span>
                                        )}
                                    </td>

                                    {/* Eval columns */}
                                    {EVAL_COLS.map(col => {
                                        const val: number | null = stats ? stats[col.key] : null;
                                        const showDash = !stats || isHoliday || val === null;
                                        return (
                                            <td key={col.key} className="p-2 text-center border-l">
                                                {showDash ? (
                                                    <span className="text-muted-foreground/30 text-xs">—</span>
                                                ) : (
                                                    <span className={cn("text-xs", col.color(val as number))}>{val}%</span>
                                                )}
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

// ─── Matrix Table (Week / Month) ─────────────────────────────────────────────
function MatrixTable({ sheikhs, groupSessions, interval }: {
    sheikhs: any[];
    groupSessions: Map<string, Map<string, any[]>>;
    interval: Date[];
}) {
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
                                    <th key={day.toISOString()} className={cn(
                                        "p-1.5 text-center border-l min-w-[48px]",
                                        isWk ? "bg-sky-50/60 text-sky-600" : "text-foreground",
                                        isToday(day) && "bg-primary/5 text-primary"
                                    )}>
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
                                <td className={cn(
                                    "sticky right-0 z-10 p-2 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]",
                                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                                )}>
                                    <div className="font-bold text-[11px] leading-tight">{sh.group}</div>
                                    <div className="text-[9px] text-muted-foreground truncate max-w-[120px]">{sh.displayName}</div>
                                </td>
                                {interval.map(day => {
                                    const dateStr = format(day, 'yyyy-MM-dd');
                                    const dayOfWeek = getDay(day);
                                    const isWk = dayOfWeek === 4 || dayOfWeek === 5;
                                    const sessions = groupSessions.get(sh.group)?.get(dateStr) || [];
                                    const s1 = sessions.find(s => s.sessionNumber === 1);
                                    const s2 = sessions.find(s => s.sessionNumber === 2);

                                    return (
                                        <td key={day.toISOString()} className={cn("p-1 text-center border-l", isWk && "bg-sky-50/30", isToday(day) && "bg-primary/[0.03]")}>
                                            <div className="flex items-center justify-center gap-0.5 min-h-[28px]">
                                                {sessions.length === 0 ? (
                                                    isWk ? null : <span className="w-5 h-5 rounded border border-dashed border-slate-200 flex items-center justify-center">
                                                        <XCircle className="h-3 w-3 text-slate-200" />
                                                    </span>
                                                ) : (
                                                    [s1, s2].filter(Boolean).map(s => {
                                                        const cfg = TYPE_CONFIG[s!.sessionType];
                                                        return (
                                                            <Tooltip key={`${s!.id}-${s!.sessionNumber}`} delayDuration={0}>
                                                                <TooltipTrigger asChild>
                                                                    <div className={cn(
                                                                        "w-5 h-5 rounded-md flex items-center justify-center text-white font-bold text-[9px] cursor-default shadow-sm",
                                                                        cfg?.dot ? cfg.dot : 'bg-emerald-500'
                                                                    )}>
                                                                        {s!.sessionNumber}
                                                                    </div>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="top" className="text-xs p-2 max-w-[180px]">
                                                                    <div className="space-y-1">
                                                                        <div className="font-bold">{sh.group} — {format(day, 'd MMM', { locale: ar })}</div>
                                                                        <div>{s!.sessionType}</div>
                                                                        {s!.substituteTeacher && <div className="text-amber-300">البديل: {s!.substituteTeacher}</div>}
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
