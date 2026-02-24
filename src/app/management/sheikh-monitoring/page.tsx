"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import {
    Shield, Loader2, CheckCircle2, XCircle, Clock, BookOpen,
    ChevronLeft, ChevronRight, Users, Activity, RotateCcw,
    TrendingUp, TrendingDown, Minus, BarChart2, Star, Award, AlertTriangle,
    UserX, XOctagon, Filter, Printer, ImageDown, CalendarDays, CalendarRange,
    ChevronDown, ChevronUp, FileDown, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
    format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
    eachDayOfInterval, getDay, isToday, addDays, addMonths, subMonths
} from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    PieChart, Pie, LineChart, Line
} from 'recharts';

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

    type ViewMode = 'day' | 'week' | 'month' | 'stats' | 'students';
    const [view, setView] = useState<ViewMode>('day');
    const [studentPeriod, setStudentPeriod] = useState<'day' | 'week' | 'month'>('month');
    const [studentGroupFilter, setStudentGroupFilter] = useState<string>('all');
    const [studentSort, setStudentSort] = useState<'absences' | 'notMem'>('absences');
    const [studentSelectedDate, setStudentSelectedDate] = useState(new Date());
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

    // ── Student tracking data ─────────────────────────────────────────────
    const studentTrackingData = useMemo(() => {
        // Date set for the selected period
        const periodDateSet = new Set<string>();
        if (studentPeriod === 'day') {
            periodDateSet.add(format(studentSelectedDate, 'yyyy-MM-dd'));
        } else if (studentPeriod === 'week') {
            const dow = getDay(studentSelectedDate);
            const wSat = addDays(studentSelectedDate, dow === 6 ? 0 : -(dow + 1));
            eachDayOfInterval({ start: wSat, end: addDays(wSat, 4) })
                .forEach(d => periodDateSet.add(format(d, 'yyyy-MM-dd')));
        } else {
            eachDayOfInterval({ start: startOfMonth(studentSelectedDate), end: endOfMonth(studentSelectedDate) })
                .forEach(d => periodDateSet.add(format(d, 'yyyy-MM-dd')));
        }

        // Build per-student accumulator — only active (نشط) students
        const studentMap = new Map<string, {
            id: string; name: string; group: string;
            absences: number; notMem: number; lateDays: number;
            absentDates: string[]; notMemDates: string[];
        }>();
        (students || []).filter(s => s.status === 'نشط').forEach(s => {
            studentMap.set(s.id, {
                id: s.id, name: s.fullName,
                group: (s as any).group || s.groupName || '—',
                absences: 0, notMem: 0, lateDays: 0,
                absentDates: [], notMemDates: []
            });
        });

        // Build group→studentIds for cross-reference (only active students)
        const groupStudentIds = new Map<string, Set<string>>();
        sheikhs.forEach(sh => groupStudentIds.set(sh.group, new Set()));
        (students || []).filter(s => s.status === 'نشط').forEach(s => {
            const grp = (s as any).group || s.groupName || '';
            groupStudentIds.get(grp)?.add(s.id);
        });

        // Scan ALL dailySessions for the period dates directly
        if (dailySessions) {
            Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
                if (!periodDateSet.has(dateStr)) return;
                if (!daySessions) return;

                Object.values(daySessions as Record<string, any>).forEach((session: any) => {
                    if (!session) return;
                    const sType = session.sessionType;
                    const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                    if (!isReal) return;

                    const records: any[] = Array.isArray(session.records)
                        ? session.records
                        : session.records ? Object.values(session.records) : [];

                    if (!records.length) return;

                    // Track which student IDs appear in this session's records
                    const recordedIds = new Set<string>(records.map(r => r.studentId).filter(Boolean));

                    records.forEach(r => {
                        const sid = r.studentId;
                        if (!sid || !studentMap.has(sid)) return;
                        const st = studentMap.get(sid)!;
                        if (r.attendance === 'غائب' || r.attendance === 'غياب') {
                            st.absences++;
                            if (!st.absentDates.includes(dateStr)) st.absentDates.push(dateStr);
                        }
                        if (r.attendance === 'متأخر') st.lateDays++;
                        if (!r.review && r.memorization === 'لم يحفظ') {
                            st.notMem++;
                            if (!st.notMemDates.includes(dateStr)) st.notMemDates.push(dateStr);
                        }
                    });

                    // Cross-reference: find which group this session belongs to
                    // by checking the ownerId against sheikhs
                    const shOwner = sheikhs.find(sh => sh.uids.has(session.ownerId));
                    if (shOwner) {
                        // Students in this group NOT in records → absent
                        (groupStudentIds.get(shOwner.group) || new Set()).forEach(sid => {
                            if (!recordedIds.has(sid) && studentMap.has(sid)) {
                                const st = studentMap.get(sid)!;
                                if (!st.absentDates.includes(dateStr)) {
                                    st.absences++;
                                    st.absentDates.push(dateStr);
                                }
                            }
                        });
                    }
                });
            });
        }

        return Array.from(studentMap.values())
            .filter(s => s.absences > 0 || s.notMem > 0)
            .sort((a, b) => b.absences - a.absences);
    }, [students, dailySessions, sheikhs, studentPeriod, studentSelectedDate]);

    // ── Navigation ──────────────────────────────────────────────────────────
    const navigate = (dir: -1 | 1) => {
        if (view === 'students') {
            if (studentPeriod === 'day') setStudentSelectedDate(d => addDays(d, dir));
            else if (studentPeriod === 'week') setStudentSelectedDate(d => addDays(d, dir * 7));
            else setStudentSelectedDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
        } else if (view === 'day') setSelectedDate(d => addDays(d, dir));
        else if (view === 'week') setSelectedDate(d => addDays(d, dir * 7));
        else if (view === 'month') setSelectedDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
        else setStatsMonth(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    };

    const navLabel = view === 'students'
        ? (studentPeriod === 'day'
            ? format(studentSelectedDate, 'EEEE، d MMMM yyyy', { locale: ar })
            : studentPeriod === 'week'
                ? `سبت ${format(addDays(studentSelectedDate, getDay(studentSelectedDate) === 6 ? 0 : -(getDay(studentSelectedDate) + 1)), 'd MMM', { locale: ar })} — أرب ${format(addDays(addDays(studentSelectedDate, getDay(studentSelectedDate) === 6 ? 0 : -(getDay(studentSelectedDate) + 1)), 4), 'd MMM yyyy', { locale: ar })}`
                : format(studentSelectedDate, 'MMMM yyyy', { locale: ar }))
        : view === 'day'
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
                        {(['day', 'week', 'month', 'stats', 'students'] as const).map(v => (
                            <button key={v} onClick={() => setView(v)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all", view === v ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted")}>
                                {v === 'day' ? '📅 اليوم' : v === 'week' ? '📆 الأسبوع' : v === 'month' ? '🗓 الشهر' : v === 'stats' ? '📊 إحصائيات' : '📋 متابعة الطلاب'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Date Navigation ── */}
                <div className="flex items-center justify-between bg-card border rounded-xl px-3 py-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8 px-2"><ChevronRight className="h-4 w-4" /></Button>
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-bold">{navLabel}</span>
                        {(view !== 'stats') && !isToday(selectedDate) && (
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
                {(view === 'day' || view === 'week' || view === 'month') && (
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
                {view === 'day' && <DayTable sheikhs={sheikhs} getDayStats={getDayStats} dateStr={todayStr} groupSessions={groupSessions} selectedDate={selectedDate} students={students} dailySessions={dailySessions} />}
                {(view === 'week' || view === 'month') && (
                    <MatrixTable sheikhs={sheikhs} groupSessions={groupSessions} interval={interval} getDayStats={getDayStats} />
                )}
                {view === 'stats' && (
                    <StatsView sortedStats={sortedStats} monthlyStats={monthlyStats} statsMonth={statsMonth} sortStat={sortStat} sortDir={sortDir} toggleSort={toggleSort} />
                )}
                {view === 'students' && (
                    <StudentTrackingView
                        data={studentTrackingData}
                        period={studentPeriod}
                        setPeriod={setStudentPeriod}
                        selectedDate={studentSelectedDate}
                        groupFilter={studentGroupFilter}
                        setGroupFilter={setStudentGroupFilter}
                        sort={studentSort}
                        setSort={setStudentSort}
                        sheikhs={sheikhs}
                    />
                )}
            </div>
        </TooltipProvider>
    );
}

// ─── DayTable Component ───────────────────────────────────────────────────────
function DayTable({
    sheikhs, getDayStats, dateStr, groupSessions, selectedDate, students, dailySessions
}: {
    sheikhs: GroupSheikhInfo[];
    getDayStats: (g: string, d: string) => DayStats | null;
    dateStr: string;
    groupSessions: Map<string, Map<string, any[]>>;
    selectedDate: Date;
    students: any[];
    dailySessions: any;
}) {
    // ── State ────────────────────────────────────────────────────────────────
    const [selectedSheikhs, setSelectedSheikhs] = useState<Set<string>>(
        () => new Set(sheikhs.map(s => s.group))
    );
    const [showSelector, setShowSelector] = useState(false);
    const [weeklyMode, setWeeklyMode] = useState(false);
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSelectedSheikhs(prev => {
            const next = new Set<string>();
            sheikhs.forEach(s => { if (prev.has(s.group)) next.add(s.group); });
            return next.size > 0 ? next : new Set(sheikhs.map(s => s.group));
        });
    }, [sheikhs]);

    const filteredSheikhs = useMemo(
        () => sheikhs.filter(s => selectedSheikhs.has(s.group)),
        [sheikhs, selectedSheikhs]
    );

    // ── Week days (Sat→Wed) ──────────────────────────────────────────────────
    const weekDays = useMemo(() => {
        const dow = getDay(selectedDate);
        const sat = addDays(selectedDate, dow === 6 ? 0 : -(dow + 1));
        return [0, 1, 2, 3, 4].map(i => addDays(sat, i));
    }, [selectedDate]);

    // ── Helper ───────────────────────────────────────────────────────────────
    const isRealType = (t?: string) =>
        t === 'حصة أساسية' || t === 'حصة تعويضية' || t === 'حصة إضافية';

    // ── Per-group week averages ──────────────────────────────────────────────
    const groupWeekAvg = useMemo(() => {
        const result: Record<string, Record<string, number | null>> = {};
        filteredSheikhs.forEach(sh => {
            const acc: Record<string, number[]> = {};
            EVAL_COLS.forEach(c => acc[c.key] = []);
            weekDays.forEach(day => {
                const st = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                if (!st || !isRealType(st.type)) return;
                EVAL_COLS.forEach(c => { const v = (st as any)[c.key]; if (v !== null) acc[c.key].push(v); });
            });
            result[sh.group] = {};
            EVAL_COLS.forEach(c => {
                const vals = acc[c.key];
                result[sh.group][c.key] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
            });
        });
        return result;
    }, [filteredSheikhs, weekDays, getDayStats]);

    // ── School avg per day ───────────────────────────────────────────────────
    const schoolDayAvg = useMemo(() => {
        return weekDays.map(day => {
            const dStr = format(day, 'yyyy-MM-dd');
            const acc: Record<string, number[]> = {};
            EVAL_COLS.forEach(c => acc[c.key] = []);
            filteredSheikhs.forEach(sh => {
                const st = getDayStats(sh.group, dStr);
                if (!st || !isRealType(st.type)) return;
                EVAL_COLS.forEach(c => { const v = (st as any)[c.key]; if (v !== null) acc[c.key].push(v); });
            });
            const res: Record<string, number | null> = {};
            EVAL_COLS.forEach(c => { const vals = acc[c.key]; res[c.key] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null; });
            return { dStr, avg: res };
        });
    }, [filteredSheikhs, weekDays, getDayStats]);

    // ── School week overall avg ──────────────────────────────────────────────
    const schoolWeekAvg = useMemo(() => {
        const acc: Record<string, number[]> = {};
        EVAL_COLS.forEach(c => acc[c.key] = []);
        filteredSheikhs.forEach(sh => {
            weekDays.forEach(day => {
                const st = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                if (!st || !isRealType(st.type)) return;
                EVAL_COLS.forEach(c => { const v = (st as any)[c.key]; if (v !== null) acc[c.key].push(v); });
            });
        });
        const res: Record<string, number | null> = {};
        EVAL_COLS.forEach(c => { const vals = acc[c.key]; res[c.key] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null; });
        return res;
    }, [filteredSheikhs, weekDays, getDayStats]);

    // ── Absent students for the week ─────────────────────────────────────────
    const weekAbsentData = useMemo(() => {
        if (!weeklyMode) return [];
        type AR = { id: string; name: string; group: string; absentDays: string[]; count: number };
        const map = new Map<string, AR>();
        const groupStudentIds = new Map<string, Set<string>>();
        filteredSheikhs.forEach(sh => groupStudentIds.set(sh.group, new Set()));
        (students || []).filter((s: any) => s.status === 'نشط').forEach((s: any) => {
            const grp = s.group || s.groupName || '';
            if (groupStudentIds.has(grp)) {
                groupStudentIds.get(grp)!.add(s.id);
                map.set(s.id, { id: s.id, name: s.fullName, group: grp, absentDays: [], count: 0 });
            }
        });
        if (dailySessions) {
            weekDays.forEach(day => {
                const dStr = format(day, 'yyyy-MM-dd');
                const dayLabel = format(day, 'EEE d/M', { locale: ar });
                const daySess = (dailySessions as any)[dStr];
                if (!daySess) return;
                Object.values(daySess as Record<string, any>).forEach((session: any) => {
                    if (!session || !isRealType(session.sessionType)) return;
                    const shOwner = sheikhs.find(sh => sh.uids.has(session.ownerId));
                    if (!shOwner || !filteredSheikhs.some(s => s.group === shOwner.group)) return;
                    const records: any[] = Array.isArray(session.records) ? session.records : session.records ? Object.values(session.records) : [];
                    const recordedIds = new Set<string>(records.map((r: any) => r.studentId).filter(Boolean));
                    records.forEach((r: any) => {
                        if (!r.studentId || !map.has(r.studentId)) return;
                        if (r.attendance === 'غائب' || r.attendance === 'غياب') {
                            const rec = map.get(r.studentId)!;
                            if (!rec.absentDays.includes(dayLabel)) { rec.absentDays.push(dayLabel); rec.count++; }
                        }
                    });
                    (groupStudentIds.get(shOwner.group) || new Set()).forEach(sid => {
                        if (!recordedIds.has(sid) && map.has(sid)) {
                            const rec = map.get(sid)!;
                            if (!rec.absentDays.includes(dayLabel)) { rec.absentDays.push(dayLabel); rec.count++; }
                        }
                    });
                });
            });
        }
        return Array.from(map.values()).filter(r => r.count > 0).sort((a, b) => b.count - a.count || a.group.localeCompare(b.group, 'ar'));
    }, [weeklyMode, weekDays, students, dailySessions, sheikhs, filteredSheikhs]);

    // ── Charts data (all sheikhs, day mode) ──────────────────────────────────
    const typeCounts: Record<string, number> = { 'لم يسجل': 0 };
    const attendanceData: { name: string; attendance: number; fill: string }[] = [];
    sheikhs.forEach(sh => {
        const stats = getDayStats(sh.group, dateStr);
        if (!stats) { typeCounts['لم يسجل']++; }
        else {
            const t = TYPE_CONFIG[stats.type]?.label || stats.type;
            typeCounts[t] = (typeCounts[t] || 0) + 1;
            if (stats.attendance !== null) attendanceData.push({ name: sh.group.replace('فوج ', ''), attendance: stats.attendance, fill: stats.attendance >= 90 ? '#10b981' : stats.attendance >= 70 ? '#f59e0b' : '#ef4444' });
        }
    });
    const pieData = Object.entries(typeCounts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));
    const pieColors: Record<string, string> = { 'أساسية': '#10b981', 'تعويضية': '#f59e0b', 'إضافية': '#6366f1', 'أنشطة': '#a855f7', 'عطلة': '#38bdf8', 'غياب شيخ': '#f43f5e', 'لم يسجل': '#cbd5e1' };

    // ── Day-mode average row ─────────────────────────────────────────────────
    function computeDayAvgRow() {
        const colData: Record<string, (number | null)[]> = {};
        EVAL_COLS.forEach(c => colData[c.key] = []);
        filteredSheikhs.forEach(sh => {
            const st = getDayStats(sh.group, dateStr);
            if (!st || !isRealType(st.type)) return;
            EVAL_COLS.forEach(c => colData[c.key].push((st as any)[c.key]));
        });
        return colData;
    }

    // ── Handlers ─────────────────────────────────────────────────────────────
    const toggleSheikh = (group: string) => {
        setSelectedSheikhs(prev => {
            const next = new Set(prev);
            if (next.has(group)) { if (next.size > 1) next.delete(group); }
            else next.add(group);
            return next;
        });
    };
    const handlePrint = () => window.print();
    const handleSaveImage = async () => {
        if (!tableRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(tableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
            const link = document.createElement('a');
            link.download = `جدول_المشايخ_${weeklyMode ? `أسبوع_${format(weekDays[0], 'yyyy-MM-dd')}` : dateStr}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) { console.error(e); }
    };

    // ── Export to PDF via printWindow (Arabic-safe) ───────────────────────────
    const handleExportPDF = () => {
        const weekLabel = weeklyMode
            ? `${format(weekDays[0], 'EEEE d MMMM', { locale: ar })} — ${format(weekDays[4], 'EEEE d MMMM yyyy', { locale: ar })}`
            : format(new Date(dateStr), 'EEEE، d MMMM yyyy', { locale: ar });

        // ── Build stats table rows HTML ────────────────────────────────────────
        const evalColColors: Record<string, (v: number) => string> = {};
        EVAL_COLS.forEach(c => { evalColColors[c.key] = c.color; });

        function pctStyle(key: string, val: number | null): string {
            if (val === null) return 'color:#94a3b8';
            const cls = evalColColors[key]?.(val) || '';
            if (cls.includes('emerald')) return 'color:#059669;font-weight:700';
            if (cls.includes('amber')) return 'color:#d97706;font-weight:700';
            if (cls.includes('rose') || cls.includes('red')) return 'color:#e11d48;font-weight:700';
            if (cls.includes('blue')) return 'color:#2563eb;font-weight:700';
            if (cls.includes('purple')) return 'color:#7c3aed;font-weight:700';
            if (cls.includes('slate')) return 'color:#64748b;font-weight:700';
            return 'color:#374151;font-weight:700';
        }

        function cellMetrics(st: DayStats | null): string {
            if (!st) return '<span style="color:#cbd5e1">—</span>';
            const cfg = TYPE_CONFIG[st.type];
            const badge = `<div style="display:inline-block;padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700;margin-bottom:3px;${cfg ? `background:${cfg.bg?.includes('emerald') ? '#d1fae5' : cfg.bg?.includes('amber') ? '#fef3c7' : cfg.bg?.includes('indigo') ? '#e0e7ff' : cfg.bg?.includes('purple') ? '#f3e8ff' : cfg.bg?.includes('sky') ? '#e0f2fe' : cfg.bg?.includes('rose') ? '#ffe4e6' : '#f1f5f9'};color:${cfg.text?.includes('emerald') ? '#065f46' : cfg.text?.includes('amber') ? '#92400e' : cfg.text?.includes('indigo') ? '#312e81' : cfg.text?.includes('purple') ? '#581c87' : cfg.text?.includes('sky') ? '#0c4a6e' : cfg.text?.includes('rose') ? '#9f1239' : '#374151'};` : 'background:#f1f5f9;color:#374151;'}">${cfg?.label || st.type}</div>`;
            if (!isRealType(st.type)) return badge;
            const metrics = EVAL_COLS.map(c => {
                const v = (st as any)[c.key];
                if (v === null) return '';
                return `<div style="display:flex;justify-content:space-between;gap:4px;font-size:8px;line-height:1.4"><span style="color:#6b7280">${c.label}</span><span style="${pctStyle(c.key, v)}">${v}%</span></div>`;
            }).join('');
            return badge + metrics;
        }


        const thStyle = 'background:#1e3a5f;color:white;padding:5px 6px;font-size:8.5px;border:1px solid #1e40af;text-align:center';
        const tdStyle = 'padding:4px 6px;border:1px solid #e2e8f0;vertical-align:top;text-align:center';
        const tdGroupStyle = 'padding:4px 6px;border:1px solid #e2e8f0;vertical-align:top;text-align:right;font-weight:700;font-size:9px;min-width:110px';

        // Stats table body rows
        const statsBodyRows = filteredSheikhs.map((sh, idx) => {
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            if (weeklyMode) {
                const dayCells = weekDays.map(day => {
                    const st = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                    return `<td style="${tdStyle};background:${rowBg}">${cellMetrics(st)}</td>`;
                }).join('');
                const wa = groupWeekAvg[sh.group] || {};
                const avgCell = `<div style="background:#eff6ff;border-radius:4px;padding:2px">${EVAL_COLS.map(c => {
                    const v = wa[c.key];
                    if (v === null) return '';
                    return `<div style="display:flex;justify-content:space-between;gap:4px;font-size:8px;line-height:1.4"><span style="color:#3b82f6">${c.label}</span><span style="${pctStyle(c.key, v)}">${v}%</span></div>`;
                }).join('')}</div>`;
                return `<tr><td style="${tdGroupStyle};background:${rowBg}">${sh.group}<br/><span style="font-weight:400;font-size:8px;color:#6b7280">${sh.displayName}</span></td>${dayCells}<td style="${tdStyle};background:${idx % 2 === 0 ? '#eff6ff' : '#e0f2fe'}">${avgCell}</td></tr>`;
            } else {
                const st = getDayStats(sh.group, dateStr);
                const cfg = st?.type ? TYPE_CONFIG[st.type] : null;
                const typeBadge = st ? `<span style="padding:1px 5px;border-radius:4px;font-size:8px;font-weight:700">${cfg?.label || st.type}</span>` : '—';
                const metricCells = EVAL_COLS.map(c => {
                    if (!st || !isRealType(st.type)) return `<td style="${tdStyle};background:${rowBg}"><span style="color:#cbd5e1">—</span></td>`;
                    const v = (st as any)[c.key];
                    return `<td style="${tdStyle};background:${rowBg}"><span style="${pctStyle(c.key, v)}">${v !== null ? v + '%' : '—'}</span></td>`;
                }).join('');
                return `<tr><td style="${tdGroupStyle};background:${rowBg}">${sh.group}<br/><span style="font-weight:400;font-size:8px;color:#6b7280">${sh.displayName}</span></td><td style="${tdStyle};background:${rowBg}">${typeBadge}</td>${metricCells}</tr>`;
            }
        }).join('');

        // School average tfoot
        let schoolFootRow = '';
        if (weeklyMode) {
            const dayCells = schoolDayAvg.map(({ avg: da }) => {
                const metrics = EVAL_COLS.map(c => {
                    const v = da[c.key];
                    if (v === null) return '';
                    const clr = c.key === 'attendance' ? (v >= 90 ? '#34d399' : v >= 70 ? '#fbbf24' : '#f87171') : '#e2e8f0';
                    return `<div style="display:flex;justify-content:space-between;gap:4px;font-size:8px;line-height:1.4"><span style="color:#94a3b8">${c.label}</span><span style="color:${clr};font-weight:700">${v}%</span></div>`;
                }).join('');
                return `<td style="padding:4px 6px;border:1px solid #1e40af;background:#1e3a5f;vertical-align:top;text-align:center">${metrics}</td>`;
            }).join('');
            const weekCell = EVAL_COLS.map(c => {
                const v = schoolWeekAvg[c.key];
                if (v === null) return '';
                const clr = c.key === 'attendance' ? (v >= 90 ? '#34d399' : v >= 70 ? '#fbbf24' : '#f87171') : '#c7d2fe';
                return `<div style="display:flex;justify-content:space-between;gap:4px;font-size:8px;line-height:1.4"><span style="color:#7dd3fc">${c.label}</span><span style="color:${clr};font-weight:700">${v}%</span></div>`;
            }).join('');
            schoolFootRow = `<tfoot><tr><td style="padding:4px 6px;border:1px solid #1e40af;background:#1e3a5f;color:white;font-weight:700;font-size:9px;text-align:right">متوسط المدرسة<br/><span style="font-weight:400;font-size:8px;opacity:.6">القرآنية — يومي</span></td>${dayCells}<td style="padding:4px 6px;border:1px solid #1e40af;background:#172554;vertical-align:top;text-align:center">${weekCell}</td></tr></tfoot>`;
        } else {
            const dayAvgRowData = computeDayAvgRow();
            const avgCells = EVAL_COLS.map(c => {
                const vals = dayAvgRowData[c.key].filter((v): v is number => v !== null);
                const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                return `<td style="padding:4px 6px;border:1px solid #93c5fd;background:#eff6ff;text-align:center"><span style="${pctStyle(c.key, avg)}">${avg !== null ? avg + '%' : '—'}</span></td>`;
            }).join('');
            schoolFootRow = `<tfoot><tr><td style="padding:4px 6px;border:1px solid #93c5fd;background:#eff6ff;font-weight:700;font-size:9px;color:#1e40af;text-align:right">متوسط المدرسة<br/><span style="font-size:8px;color:#3b82f6">القرآنية</span></td><td style="padding:4px 6px;border:1px solid #93c5fd;background:#eff6ff;text-align:center;font-size:8px;color:#93c5fd;font-style:italic">متوسط</td>${avgCells}</tr></tfoot>`;
        }

        // Stats header (must be after thStyle is defined)
        const statsHead = weeklyMode
            ? `<tr><th style="${thStyle};text-align:right">الفوج / الشيخ</th>${weekDays.map(d => `<th style="${thStyle}">${format(d, 'EEEE', { locale: ar })}<br/><span style="font-weight:400;font-size:8px;opacity:.7">${format(d, 'd MMM', { locale: ar })}</span></th>`).join('')}<th style="${thStyle}">متوسط الأسبوع</th></tr>`
            : `<tr><th style="${thStyle};text-align:right">الفوج / الشيخ</th><th style="${thStyle}">نوع الحصة</th>${EVAL_COLS.map(c => `<th style="${thStyle}">${c.label}</th>`).join('')}</tr>`;

        // Absent students table
        let absentSection = '';
        if (weeklyMode && weekAbsentData.length > 0) {
            const abRows = weekAbsentData.map((rec, idx) => {
                const rowBg = idx % 2 === 0 ? '#ffffff' : '#fff7ed';
                const cntClr = rec.count >= 3 ? '#dc2626' : rec.count === 2 ? '#d97706' : '#ea580c';
                const dayTags = rec.absentDays.map(d => `<span style="display:inline-block;background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;border-radius:3px;padding:0 4px;font-size:8px;margin:1px">${d}</span>`).join(' ');
                return `<tr><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg};font-weight:700;font-size:9px">${rec.name}</td><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg};text-align:center;font-size:8px"><span style="background:#f1f5f9;padding:1px 5px;border-radius:3px">${rec.group}</span></td><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg};text-align:center;font-weight:700;color:${cntClr}">${rec.count}</td><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg}">${dayTags}</td></tr>`;
            }).join('');

            const byGroup: Record<string, number> = {};
            weekAbsentData.forEach(r => { byGroup[r.group] = (byGroup[r.group] || 0) + 1; });
            const summary = Object.entries(byGroup).map(([g, n]) => `<span style="background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;border-radius:4px;padding:2px 8px;font-size:8.5px;font-weight:700">${g}: ${n} طالب</span>`).join(' ');

            absentSection = `
            <div style="page-break-before:always;padding-top:8px">
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;overflow:hidden">
                    <div style="background:#ea580c;color:white;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
                        <h2 style="margin:0;font-size:12px;font-weight:700">الطلاب الغائبون خلال الأسبوع</h2>
                        <span style="background:rgba(255,255,255,.2);padding:2px 10px;border-radius:12px;font-size:9px">${weekAbsentData.length} طالب · ${weekAbsentData.reduce((s, r) => s + r.count, 0)} غياب إجمالي</span>
                    </div>
                    <table style="width:100%;border-collapse:collapse">
                        <thead><tr>
                            <th style="background:#fff7ed;padding:4px 6px;border:1px solid #fed7aa;font-size:8.5px;text-align:right">اسم الطالب</th>
                            <th style="background:#fff7ed;padding:4px 6px;border:1px solid #fed7aa;font-size:8.5px;text-align:center">الفوج</th>
                            <th style="background:#fff7ed;padding:4px 6px;border:1px solid #fed7aa;font-size:8.5px;text-align:center;color:#dc2626">أيام الغياب</th>
                            <th style="background:#fff7ed;padding:4px 6px;border:1px solid #fed7aa;font-size:8.5px">تواريخ الغياب</th>
                        </tr></thead>
                        <tbody>${abRows}</tbody>
                        <tfoot><tr>
                            <td colspan="2" style="padding:4px 6px;border:1px solid #fed7aa;background:#fff7ed;font-weight:700;color:#ea580c;font-size:9px">الإجمالي</td>
                            <td style="padding:4px 6px;border:1px solid #fed7aa;background:#fff7ed;text-align:center;font-weight:700;color:#dc2626">${weekAbsentData.reduce((s, r) => s + r.count, 0)}</td>
                            <td style="padding:4px 6px;border:1px solid #fed7aa;background:#fff7ed;font-size:8px">${weekAbsentData.length} طالب مُلاحَظ</td>
                        </tr></tfoot>
                    </table>
                    <div style="padding:8px 12px;border-top:1px solid #fed7aa;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                        <span style="font-size:8px;color:#6b7280;font-weight:600">ملخص حسب الفوج:</span>
                        ${summary}
                    </div>
                </div>
            </div>`;
        }

        // Build full HTML
        const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width"/>
    <title>تقرير المشايخ الأسبوعي</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; background: white; color: #1e293b; font-size: 9px; }
        @media print {
            @page { size: A4 landscape; margin: 8mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
            body { font-size: 8px; }
        }
        table { border-collapse: collapse; width: 100%; }
        h1 { font-size: 14px; font-weight: 900; }
        h2 { font-size: 11px; font-weight: 700; }
    </style>
</head>
<body style="padding:10px">
    <!-- Header -->
    <div style="border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start">
        <div>
            <h1 style="color:#1e3a5f">تقرير مراقبة المشايخ — ${weeklyMode ? 'الأسبوع الدراسي' : 'اليوم'}</h1>
            <p style="margin-top:3px;font-size:9px;color:#475569">${weekLabel}</p>
            <p style="margin-top:2px;font-size:8px;color:#64748b">الأفواج: ${filteredSheikhs.map(s => s.group).join('، ')}</p>
        </div>
        <div style="text-align:left;font-size:8px;color:#64748b">
            <div style="font-weight:700">المدرسة القرآنية للشافعي</div>
            <div>${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>
    </div>
    <!-- Stats table -->
    <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:10px">
        <div style="background:#1e3a5f;color:white;padding:5px 10px;font-weight:700;font-size:9px">إحصائيات ${weeklyMode ? 'الأسبوع' : 'اليوم'}</div>
        <table>
            <thead>${statsHead}</thead>
            <tbody>${statsBodyRows}</tbody>
            ${schoolFootRow}
        </table>
    </div>
    ${absentSection}
</body>
</html>`;

        const pw = window.open('', '_blank', 'width=1200,height=800');
        if (!pw) { alert('يرجى السماح بالنوافذ المنبثقة لهذا الموقع'); return; }
        pw.document.write(html);
        pw.document.close();
        pw.focus();
        setTimeout(() => { pw.print(); }, 800);
    };


    // ── Export to Excel (xlsx) ────────────────────────────────────────────────
    const handleExportExcel = async () => {
        try {
            const XLSX = await import('xlsx');
            const wb = XLSX.utils.book_new();

            // ── Sheet 1: Weekly Stats ──────────────────────────────────────────
            const headers = weeklyMode
                ? ['الفوج', 'الشيخ', ...weekDays.flatMap(d => EVAL_COLS.map(c => `${format(d, 'EEE dd/MM')} | ${c.label}`)), ...EVAL_COLS.map(c => `متوسط الأسبوع | ${c.label}`)]
                : ['الفوج', 'الشيخ', 'نوع الحصة', ...EVAL_COLS.map(c => c.label)];

            const rows: any[][] = filteredSheikhs.map(sh => {
                if (weeklyMode) {
                    const dayCols = weekDays.flatMap(day => {
                        const st = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                        return EVAL_COLS.map(c => {
                            if (!st || !isRealType(st.type)) return null;
                            const v = (st as any)[c.key];
                            return v !== null ? v / 100 : null;
                        });
                    });
                    const wa = groupWeekAvg[sh.group] || {};
                    const avgCols = EVAL_COLS.map(c => wa[c.key] !== null ? (wa[c.key] as number) / 100 : null);
                    return [sh.group, sh.displayName, ...dayCols, ...avgCols];
                } else {
                    const st = getDayStats(sh.group, dateStr);
                    const cfg = st?.type ? TYPE_CONFIG[st.type] : null;
                    return [sh.group, sh.displayName, cfg?.label || st?.type || '—', ...EVAL_COLS.map(c => {
                        if (!st || !isRealType(st.type)) return null;
                        const v = (st as any)[c.key];
                        return v !== null ? v / 100 : null;
                    })];
                }
            });

            // School avg row
            if (weeklyMode) {
                const avgRow: any[] = ['متوسط المدرسة', 'القرآنية',
                    ...weekDays.flatMap(day => {
                        const { avg: da } = schoolDayAvg.find(x => x.dStr === format(day, 'yyyy-MM-dd')) || { avg: {} as Record<string, number | null> };
                        return EVAL_COLS.map(c => da[c.key] !== null ? (da[c.key] as number) / 100 : null);
                    }),
                    ...EVAL_COLS.map(c => schoolWeekAvg[c.key] !== null ? (schoolWeekAvg[c.key] as number) / 100 : null)
                ];
                rows.push(avgRow);
            }

            const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            // Format percentage columns
            const pctFmt = '0%';
            const startCol = weeklyMode ? 2 : 3;
            for (let r = 1; r <= rows.length; r++) {
                for (let c = startCol; c < headers.length; c++) {
                    const addr = XLSX.utils.encode_cell({ r, c });
                    if (ws1[addr] && typeof ws1[addr].v === 'number') ws1[addr].z = pctFmt;
                }
            }
            XLSX.utils.book_append_sheet(wb, ws1, 'إحصائيات الأسبوع');

            // ── Sheet 2: Absent Students ───────────────────────────────────────
            if (weeklyMode && weekAbsentData.length > 0) {
                const abHeaders = ['اسم الطالب', 'الفوج', 'عدد أيام الغياب', 'تواريخ الغياب'];
                const abRows = weekAbsentData.map(r => [r.name, r.group, r.count, r.absentDays.join(' | ')]);
                const ws2 = XLSX.utils.aoa_to_sheet([abHeaders, ...abRows]);
                ws2['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 40 }];
                XLSX.utils.book_append_sheet(wb, ws2, 'الطلاب الغائبون');
            }

            const weekStr = weeklyMode ? format(weekDays[0], 'yyyy-MM-dd') : dateStr;
            XLSX.writeFile(wb, `تقرير_المشايخ_${weekStr}.xlsx`);
        } catch (e) { console.error('Excel export error', e); }
    };

    const dayAvgRow = computeDayAvgRow();

    // ── Sub-components ────────────────────────────────────────────────────────
    function WeekCell({ sh, day }: { sh: GroupSheikhInfo; day: Date }) {
        const dStr = format(day, 'yyyy-MM-dd');
        const st = getDayStats(sh.group, dStr);
        const cfg = st?.type ? TYPE_CONFIG[st.type] : null;
        const real = st && isRealType(st.type);
        if (!st) return <span className="text-[10px] text-muted-foreground/30 block text-center py-2">—</span>;
        return (
            <div className="flex flex-col items-stretch gap-[2px] px-1.5 py-1.5">
                <span className={cn("self-center inline-flex items-center gap-0.5 font-bold px-1.5 py-0.5 rounded border mb-1 text-[9px]", cfg?.bg || 'bg-muted/30 border-border')}>
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg?.dot || 'bg-gray-400')} />
                    <span className={cfg?.text || 'text-muted-foreground'}>{cfg?.label || st.type}</span>
                </span>
                {real && EVAL_COLS.map(col => {
                    const val = (st as any)[col.key];
                    if (val === null) return null;
                    return (
                        <div key={col.key} className="flex justify-between gap-1 text-[10px] leading-tight">
                            <span className="text-muted-foreground shrink-0">{col.label}</span>
                            <span className={cn("font-bold", col.color(val))}>{val}%</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    function AvgCol({ avgData, bg }: { avgData: Record<string, number | null>; bg?: string }) {
        return (
            <div className="flex flex-col items-stretch gap-[2px] px-1.5 py-1.5" style={bg ? { backgroundColor: bg } : {}}>
                {EVAL_COLS.map(col => {
                    const val = avgData[col.key];
                    if (val === null) return null;
                    return (
                        <div key={col.key} className="flex justify-between gap-1 text-[10px] leading-tight">
                            <span className="text-blue-500 shrink-0">{col.label}</span>
                            <span className={cn("font-bold", col.color(val))}>{val}%</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    function SchoolAvgCell({ avgData, dark }: { avgData: Record<string, number | null>; dark?: boolean }) {
        return (
            <div className="flex flex-col items-stretch gap-[2px] px-1.5 py-1.5">
                {EVAL_COLS.map(col => {
                    const val = avgData[col.key];
                    if (val === null) return null;
                    const clr = col.key === 'attendance'
                        ? (val >= 90 ? '#34d399' : val >= 70 ? '#fbbf24' : '#f87171')
                        : (dark ? '#e2e8f0' : '#c7d2fe');
                    return (
                        <div key={col.key} className="flex justify-between gap-1 text-[10px] leading-tight">
                            <span style={{ color: dark ? '#94a3b8' : '#7dd3fc' }}>{col.label}</span>
                            <span style={{ color: clr, fontWeight: 'bold' }}>{val}%</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* ── Print CSS ── */}
            <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 7mm; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                    .no-print { display: none !important; }
                    .print-card { box-shadow: none !important; }
                    .absent-section { page-break-before: always; }
                    td, th { font-size: 8.5px !important; padding: 2px 3px !important; }
                }
            `}</style>

            {/* ── Charts (day mode only, screen only) ── */}
            {!weeklyMode && (
                <div className="grid md:grid-cols-2 gap-4 no-print print:hidden">
                    <div className="border rounded-xl p-4 bg-white shadow-sm">
                        <h3 className="text-sm font-bold mb-4 text-center">توزيع الحصص</h3>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {pieData.map((entry, index) => <Cell key={index} fill={pieColors[entry.name] || '#94a3b8'} />)}
                                    </Pie>
                                    <RechartsTooltip formatter={(v: number) => [v, 'عدد الأفواج']} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="border rounded-xl p-4 bg-white shadow-sm">
                        <h3 className="text-sm font-bold mb-4 text-center">نسبة الحضور للأفواج</h3>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                    <RechartsTooltip cursor={{ fill: '#f1f5f9' }} formatter={(v: number) => [`${v}%`, 'الحضور']} />
                                    <Bar dataKey="attendance" radius={[4, 4, 0, 0]}>
                                        {attendanceData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toolbar ── */}
            <div className="no-print print:hidden flex flex-wrap items-center justify-between gap-2 bg-card border rounded-xl px-3 py-2">
                {/* Sheikh selector */}
                <div className="relative">
                    <button onClick={() => setShowSelector(v => !v)} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-muted transition-colors">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        <span>المشايخ ({selectedSheikhs.size}/{sheikhs.length})</span>
                        {showSelector ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {showSelector && (
                        <div className="absolute top-full mt-1 right-0 z-50 bg-white border rounded-xl shadow-lg p-3 min-w-[220px] space-y-2">
                            <div className="flex gap-2">
                                <button onClick={() => setSelectedSheikhs(new Set(sheikhs.map(s => s.group)))} className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold hover:bg-primary/20">الكل</button>
                                <button onClick={() => setSelectedSheikhs(new Set([sheikhs[0]?.group].filter(Boolean)))} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-bold hover:bg-muted/80">إلغاء</button>
                            </div>
                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                {sheikhs.map(sh => (
                                    <label key={sh.group} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 rounded-md px-1.5 py-1">
                                        <input type="checkbox" checked={selectedSheikhs.has(sh.group)} onChange={() => toggleSheikh(sh.group)} className="accent-primary h-3.5 w-3.5" />
                                        <span className="text-xs font-medium">{sh.group}</span>
                                        <span className="text-[10px] text-muted-foreground truncate">{sh.displayName}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Day / Week toggle */}
                <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5 border">
                    <button onClick={() => setWeeklyMode(false)} className={cn("flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md transition-all", !weeklyMode ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}>
                        <CalendarDays className="h-3.5 w-3.5" /> يوم
                    </button>
                    <button onClick={() => setWeeklyMode(true)} className={cn("flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md transition-all", weeklyMode ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground")}>
                        <CalendarRange className="h-3.5 w-3.5" /> أسبوع
                    </button>
                </div>

                {/* Print / Export */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={handlePrint} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white hover:bg-muted transition-colors">
                        <Printer className="h-3.5 w-3.5" /> طباعة
                    </button>
                    <button onClick={handleExportPDF} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-red-50 border-red-200 text-red-700 hover:bg-red-100 transition-colors">
                        <FileDown className="h-3.5 w-3.5" /> تصدير PDF
                    </button>
                    <button onClick={handleExportExcel} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors">
                        <FileSpreadsheet className="h-3.5 w-3.5" /> تصدير Excel
                    </button>
                    <button onClick={handleSaveImage} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100 transition-colors">
                        <ImageDown className="h-3.5 w-3.5" /> صورة PNG
                    </button>
                </div>
            </div>

            {/* ── Print header ── */}
            <div className="hidden print:block mb-3" dir="rtl">
                <div className="flex items-center justify-between border-b border-black pb-2">
                    <div>
                        <h1 className="text-base font-bold">جدول مراقبة المشايخ — {weeklyMode ? 'الأسبوع الدراسي' : 'اليوم'}</h1>
                        <p className="text-[11px] text-gray-600">
                            {weeklyMode
                                ? `${format(weekDays[0], 'EEEE d MMMM', { locale: ar })} — ${format(weekDays[4], 'EEEE d MMMM yyyy', { locale: ar })}`
                                : format(new Date(dateStr), 'EEEE، d MMMM yyyy', { locale: ar })
                            }
                        </p>
                        <p className="text-[10px] text-gray-500">الأفواج: {filteredSheikhs.map(s => s.group).join('، ')}</p>
                    </div>
                    <div className="text-[10px] text-gray-500 text-left">
                        <div>المدرسة القرآنية للشافعي</div>
                        <div>{format(new Date(), 'dd/MM/yyyy')}</div>
                    </div>
                </div>
            </div>

            {/* ── Main printable area ── */}
            <div ref={tableRef}>

                {/* ════════════ WEEKLY TABLE ════════════ */}
                {weeklyMode && (
                    <div className="border rounded-xl overflow-hidden shadow-sm print-card bg-white" dir="rtl">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9' }} className="border-b">
                                        <th className="sticky right-0 z-20 text-right p-2 font-bold border-l min-w-[130px]" style={{ backgroundColor: '#f1f5f9' }}>الفوج / الشيخ</th>
                                        {weekDays.map(day => (
                                            <th key={day.toISOString()} className="p-2 text-center font-bold border-l min-w-[105px]">
                                                <div>{format(day, 'EEEE', { locale: ar })}</div>
                                                <div className="text-[9px] opacity-60 font-normal">{format(day, 'd MMM', { locale: ar })}</div>
                                            </th>
                                        ))}
                                        <th className="p-2 text-center font-bold border-l min-w-[105px]" style={{ backgroundColor: '#dbeafe' }}>
                                            <div>متوسط الأسبوع</div>
                                            <div className="text-[9px] opacity-60 font-normal">للفوج</div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSheikhs.map((sh, idx) => (
                                        <tr key={sh.uid} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }} className="border-b">
                                            <td className="sticky right-0 z-10 p-2 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.07)] align-top" style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                <div className="font-bold text-xs leading-tight">{sh.group}</div>
                                                <div className="text-[10px] text-muted-foreground">{sh.displayName}</div>
                                            </td>
                                            {weekDays.map(day => (
                                                <td key={day.toISOString()} className="border-l align-top p-0">
                                                    <WeekCell sh={sh} day={day} />
                                                </td>
                                            ))}
                                            <td className="border-l align-top p-0" style={{ backgroundColor: idx % 2 === 0 ? '#eff6ff' : '#e0f2fe' }}>
                                                <AvgCol avgData={groupWeekAvg[sh.group] || {}} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* ── School average tfoot ── */}
                                <tfoot>
                                    <tr style={{ backgroundColor: '#1e3a5f', borderTop: '3px solid #1e40af' }}>
                                        <td className="sticky right-0 z-10 p-2 border-l align-top font-bold text-xs" style={{ backgroundColor: '#1e3a5f', color: '#e2e8f0' }}>
                                            <div>متوسط المدرسة</div>
                                            <div className="text-[9px] opacity-60">القرآنية — يومي</div>
                                        </td>
                                        {schoolDayAvg.map(({ dStr, avg: da }) => (
                                            <td key={dStr} className="border-l align-top p-0">
                                                <SchoolAvgCell avgData={da} dark />
                                            </td>
                                        ))}
                                        <td className="border-l align-top p-0" style={{ backgroundColor: '#172554' }}>
                                            <SchoolAvgCell avgData={schoolWeekAvg} />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* ════════════ DAY TABLE ════════════ */}
                {!weeklyMode && (
                    <div className="border rounded-xl overflow-hidden shadow-sm print-card bg-white" dir="rtl">
                        <div className="hidden print:block px-4 pt-3 pb-1">
                            <div className="text-xs font-bold text-gray-600 mb-1">الأفواج المعروضة: {filteredSheikhs.map(s => s.group).join('، ')}</div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                    <tr style={{ backgroundColor: '#f1f5f9' }} className="border-b">
                                        <th className="sticky right-0 z-20 text-right p-2 sm:p-3 text-xs font-bold border-l min-w-[120px] sm:min-w-[160px]" style={{ backgroundColor: '#f1f5f9' }}>الفوج / الشيخ</th>
                                        <th className="p-2 text-center text-xs font-bold border-l min-w-[100px] whitespace-nowrap">نوع الحصة</th>
                                        {EVAL_COLS.map(col => <th key={col.key} className="p-2 text-center text-xs font-bold border-l min-w-[55px]">{col.label}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSheikhs.map((sh, idx) => {
                                        const stats = getDayStats(sh.group, dateStr);
                                        const cfg = stats?.type ? TYPE_CONFIG[stats.type] : null;
                                        const isHoliday = !isRealType(stats?.type);
                                        return (
                                            <tr key={sh.uid} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }} className="border-b hover:bg-muted/10 transition-colors">
                                                <td className="sticky right-0 z-10 p-2 sm:p-3 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]" style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                                    <div className="font-bold text-xs sm:text-sm leading-tight">{sh.group}</div>
                                                    <div className="text-[10px] text-muted-foreground truncate max-w-[110px] sm:max-w-none">{sh.displayName}</div>
                                                </td>
                                                <td className="p-2 text-center border-l">
                                                    {stats ? (
                                                        <span className={cn("inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold px-2 py-1 rounded-lg border", cfg?.bg || 'bg-muted/30 border-border')}>
                                                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg?.dot || 'bg-gray-400')} />
                                                            <span className={cfg?.text || 'text-muted-foreground'}>{cfg?.label || stats.type}</span>
                                                        </span>
                                                    ) : <span className="text-[10px] text-muted-foreground/50 border border-dashed rounded-lg px-2 py-1 inline-block">—</span>}
                                                </td>
                                                {EVAL_COLS.map(col => {
                                                    const val: number | null = stats ? (stats as any)[col.key] : null;
                                                    const showDash = !stats || isHoliday || val === null;
                                                    return (
                                                        <td key={col.key} className="p-2 text-center border-l">
                                                            {showDash ? <span className="text-muted-foreground/30 text-xs">—</span> : <span className={cn('text-xs', col.color(val as number))}>{val}%</span>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#eff6ff', borderTop: '2px solid #93c5fd' }}>
                                        <td className="sticky right-0 z-10 p-2 sm:p-3 border-l font-bold text-xs text-blue-800" style={{ backgroundColor: '#eff6ff' }}>
                                            <div className="font-bold text-xs leading-tight">متوسط المدرسة</div>
                                            <div className="text-[10px] text-blue-500">القرآنية · {format(new Date(dateStr), 'd MMM', { locale: ar })}</div>
                                        </td>
                                        <td className="p-2 text-center border-l"><span className="text-[10px] text-blue-400 font-medium italic">متوسط</span></td>
                                        {EVAL_COLS.map(col => {
                                            const vals = dayAvgRow[col.key].filter((v): v is number => v !== null);
                                            const avgVal = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                                            return (
                                                <td key={col.key} className="p-2 text-center border-l">
                                                    {avgVal !== null ? <span className={cn('text-xs font-bold', col.color(avgVal))}>{avgVal}%</span> : <span className="text-muted-foreground/30 text-xs">—</span>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* ════════════ ABSENT STUDENTS (weekly) ════════════ */}
                {weeklyMode && weekAbsentData.length > 0 && (
                    <div className="absent-section mt-4 border rounded-xl overflow-hidden bg-white shadow-sm" dir="rtl">
                        <div className="px-3 py-2 border-b flex items-center gap-2" style={{ backgroundColor: '#fff7ed' }}>
                            <span className="text-sm font-bold text-orange-800">الطلاب الغائبون خلال الأسبوع</span>
                            <span className="text-[10px] bg-orange-100 text-orange-600 border border-orange-200 rounded-full px-2 py-0.5 font-bold">{weekAbsentData.length} طالب</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr style={{ backgroundColor: '#fff7ed' }} className="border-b">
                                        <th className="text-right p-2 font-bold border-l min-w-[150px]">الطالب</th>
                                        <th className="p-2 text-center font-bold border-l min-w-[100px]">الفوج</th>
                                        <th className="p-2 text-center font-bold border-l min-w-[60px] text-rose-700">أيام الغياب</th>
                                        <th className="p-2 font-bold text-muted-foreground">تواريخ الغياب</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {weekAbsentData.map((rec, idx) => (
                                        <tr key={rec.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fff7ed' }} className="border-b">
                                            <td className="p-2 border-l font-bold">{rec.name}</td>
                                            <td className="p-2 border-l text-center">
                                                <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded font-medium">{rec.group}</span>
                                            </td>
                                            <td className="p-2 border-l text-center">
                                                <span className={cn("font-bold text-xs px-2 py-0.5 rounded-md", rec.count >= 3 ? 'bg-rose-100 text-rose-700' : rec.count === 2 ? 'bg-amber-50 text-amber-700' : 'text-orange-500')}>
                                                    {rec.count}
                                                </span>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex flex-wrap gap-1">
                                                    {rec.absentDays.map(d => (
                                                        <span key={d} className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded">{d}</span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#fff7ed', borderTop: '2px solid #fed7aa' }}>
                                        <td className="p-2 border-l font-bold text-orange-800" colSpan={2}>الإجمالي</td>
                                        <td className="p-2 border-l text-center font-bold text-rose-700">{weekAbsentData.reduce((s, r) => s + r.count, 0)} غياب</td>
                                        <td className="p-2 text-[10px] text-muted-foreground">{weekAbsentData.length} طالب مُلاحَظ خلال الأسبوع</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── MatrixTable Component ────────────────────────────────────────────────────
function MatrixTable({ sheikhs, groupSessions, interval, getDayStats }: { sheikhs: GroupSheikhInfo[]; groupSessions: Map<string, Map<string, any[]>>; interval: Date[]; getDayStats: (g: string, d: string) => DayStats | null }) {
    const trendData = interval.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        let total = 0, count = 0;
        sheikhs.forEach(sh => {
            const st = getDayStats(sh.group, dateStr);
            if (st && st.attendance !== null) {
                total += st.attendance;
                count++;
            }
        });
        return {
            name: format(day, 'd MMM', { locale: ar }),
            attendance: count > 0 ? Math.round(total / count) : null
        };
    }).filter(d => d.attendance !== null);

    return (
        <div className="space-y-4">
            {trendData.length > 0 && (
                <div className="border rounded-xl p-4 bg-white shadow-sm flex flex-col print:hidden">
                    <h3 className="text-sm font-bold mb-4 text-center">متوسط الحضور اليومي للمدرسة</h3>
                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                <RechartsTooltip formatter={(value: number) => [`${value}%`, 'الحضور']} />
                                <Line type="monotone" dataKey="attendance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
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

            {/* ── Average Attendance & Commitment Chart ── */}
            <div className="border rounded-xl p-4 bg-white shadow-sm flex flex-col print:hidden">
                <h3 className="text-sm font-bold mb-4 text-center">مقارنة الالتزام ومتوسط الحضور</h3>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedStats.map(s => ({ name: s.group.replace('فوج ', ''), attendance: s.avgAttendance || 0, commitment: s.commitmentRate || 0 }))} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" />
                            <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                            <RechartsTooltip cursor={{ fill: '#f8fafc' }} formatter={(value: number, name: string) => [`${value}%`, name === 'attendance' ? 'الحضور' : 'الالتزام']} />
                            <Bar dataKey="commitment" name="commitment" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                            <Bar dataKey="attendance" name="attendance" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
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

// ─── StudentTrackingView Component ───────────────────────────────────────────
interface StudentRecord {
    id: string; name: string; group: string;
    absences: number; notMem: number; lateDays: number;
    absentDates: string[]; notMemDates: string[];
}

function StudentTrackingView({
    data, period, setPeriod, selectedDate, groupFilter, setGroupFilter, sort, setSort, sheikhs
}: {
    data: StudentRecord[];
    period: 'day' | 'week' | 'month';
    setPeriod: (p: 'day' | 'week' | 'month') => void;
    selectedDate: Date;
    groupFilter: string;
    setGroupFilter: (g: string) => void;
    sort: 'absences' | 'notMem';
    setSort: (s: 'absences' | 'notMem') => void;
    sheikhs: GroupSheikhInfo[];
}) {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const filtered = data
        .filter(s => groupFilter === 'all' || s.group === groupFilter)
        .sort((a, b) => sort === 'absences' ? b.absences - a.absences : b.notMem - a.notMem);

    // Reset pagination when data or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [period, selectedDate, groupFilter, sort, data]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const topAbsent = [...data].sort((a, b) => b.absences - a.absences)[0];
    const topNotMem = [...data].sort((a, b) => b.notMem - a.notMem)[0];
    const topLate = [...data].sort((a, b) => b.lateDays - a.lateDays)[0];
    const totalFlagged = data.length;
    const totalAbsences = data.reduce((s, r) => s + r.absences, 0);

    const periodLabel = period === 'day'
        ? format(selectedDate, 'EEEE، d MMMM yyyy', { locale: ar })
        : period === 'week' ? 'الأسبوع الدراسي' : format(selectedDate, 'MMMM yyyy', { locale: ar });

    const handlePrint = () => window.print();

    const downloadCSV = () => {
        if (!filtered.length) return;
        const headers = ['الطالب', 'الفوج', 'غياب', 'تأخر', 'لم يحفظ', 'تواريخ الغياب', 'تواريخ (لم يحفظ)'];
        const rows = filtered.map(s => [
            s.name, s.group, s.absences, s.lateDays, s.notMem,
            s.absentDates.join(' | '), s.notMemDates.join(' | ')
        ]);
        const csv = ['\uFEFF' + headers.join(','), ...rows.map(r => r.map(f => `"${String(f).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `غياب_${period}_${format(selectedDate, 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };

    const isAllGroups = groupFilter === 'all';

    // Aggregations for charts
    const absData: Record<string, number> = {};
    const notMemData: Record<string, number> = {};

    filtered.forEach(s => {
        const key = isAllGroups ? s.group.replace('فوج ', '') : s.name.split(' ').slice(0, 2).join(' ');
        if (s.absences > 0) absData[key] = (absData[key] || 0) + s.absences;
        if (s.notMem > 0) notMemData[key] = (notMemData[key] || 0) + s.notMem;
    });

    const absencePieData = Object.entries(absData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, isAllGroups ? 8 : 5);
    const notMemPieData = Object.entries(notMemData).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, isAllGroups ? 8 : 5);
    const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#06b6d4', '#3b82f6', '#8b5cf6'];

    return (
        <div className="space-y-4">
            {/* ── Analytical Charts ── */}
            <div className="grid md:grid-cols-2 gap-4 print:hidden">
                <div className="border rounded-xl p-4 bg-white shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold mb-4 text-center">أكثر {isAllGroups ? 'الأفواج' : 'الطلاب'} غياباً</h3>
                    <div className="h-48 w-full">
                        {absencePieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={absencePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                                        {absencePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: number) => [value, 'غياب']} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">لا توجد غيابات مسجلة</div>
                        )}
                    </div>
                </div>
                <div className="border rounded-xl p-4 bg-white shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold mb-4 text-center">أكثر {isAllGroups ? 'الأفواج' : 'الطلاب'} بضبط (لم يحفظ)</h3>
                    <div className="h-48 w-full">
                        {notMemPieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={notMemPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                                        {notMemPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <RechartsTooltip formatter={(value: number) => [value, 'لم يحفظ']} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">لا توجد حالات (لم يحفظ) مسجلة</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Print-only report (hidden on screen) ── */}
            <style type="text/css" media="print">{`
                @page { size: A4 landscape; margin: 10mm; }
                thead th { background-color: #e5e7eb !important; print-color-adjust: exact; }
                body { background-color: white !important; }
            `}</style>

            <div className="student-tracking-print hidden print:block" dir="rtl">
                {Array.from({ length: Math.ceil(Math.max(1, filtered.length) / 10) }).map((_, pageIndex) => {
                    const pageStudents = filtered.slice(pageIndex * 10, (pageIndex + 1) * 10);
                    const isLastPage = pageIndex === Math.ceil(Math.max(1, filtered.length) / 10) - 1;
                    return (
                        <div key={pageIndex} className="page-break-after-always relative min-h-[190mm]">
                            <div className="flex items-center justify-between mb-6 border-b border-black pb-3">
                                <div>
                                    <h1 className="text-xl font-bold">تقرير الغيابات و(لم يحفظ) — {periodLabel}</h1>
                                    <p className="text-sm text-gray-600">المدرسة القرآنية للإمام الشافعي · فوج: {groupFilter === 'all' ? 'جميع الأفواج' : groupFilter}</p>
                                </div>
                                <div className="text-sm flex flex-col items-end gap-1">
                                    <span>تاريخ: {format(new Date(), 'dd/MM/yyyy')}</span>
                                    <span className="text-xs text-muted-foreground">صفحة {pageIndex + 1} من {Math.ceil(Math.max(1, filtered.length) / 10)}</span>
                                </div>
                            </div>
                            <table className="w-full border-collapse border border-black text-sm text-right">
                                <thead className="bg-gray-200">
                                    <tr>
                                        <th className="p-2 border border-black w-12">#</th>
                                        <th className="p-2 border border-black w-48">الطالب</th>
                                        <th className="p-2 border border-black w-24">الفوج</th>
                                        <th className="p-2 border border-black w-16 text-center">غياب</th>
                                        <th className="p-2 border border-black w-16 text-center">تأخر</th>
                                        <th className="p-2 border border-black w-20 text-center">لم يحفظ</th>
                                        <th className="p-2 border border-black text-center">تواريخ الغياب</th>
                                        <th className="p-2 border border-black text-center">تواريخ (لم يحفظ)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageStudents.map((s, i) => (
                                        <tr key={s.id} className="border-b border-black">
                                            <td className="p-1.5 border border-black text-center">{pageIndex * 10 + i + 1}</td>
                                            <td className="p-1.5 border border-black font-bold whitespace-nowrap">{s.name}</td>
                                            <td className="p-1 border border-black text-center">{s.group}</td>
                                            <td className="p-1 border border-black text-center font-bold">{s.absences || '—'}</td>
                                            <td className="p-1 border border-black text-center">{s.lateDays || '—'}</td>
                                            <td className="p-1 border border-black text-center font-bold text-red-600 print:text-black">{s.notMem || '—'}</td>
                                            <td className="p-1 border border-black text-[10px] leading-tight" dir="ltr">
                                                <div className="flex flex-wrap gap-0.5 justify-end">{s.absentDates.map(d => <span key={d} className="bg-gray-100 px-0.5 rounded">{format(new Date(d), 'd/M')}</span>)}</div>
                                            </td>
                                            <td className="p-1 border border-black text-[10px] leading-tight" dir="ltr">
                                                <div className="flex flex-wrap gap-0.5 justify-end">{s.notMemDates.map(d => <span key={d} className="bg-gray-100 px-0.5 rounded">{format(new Date(d), 'd/M')}</span>)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!filtered.length && (
                                        <tr><td colSpan={8} className="p-4 text-center border border-black">لا توجد بيانات (الجميع ملتزمون ولله الحمد)</td></tr>
                                    )}
                                </tbody>
                            </table>
                            {isLastPage && (
                                <div className="mt-8 flex justify-between text-xs border-t border-black pt-4">
                                    <span>تم استخراج هذا التقرير آلياً من نظام الإدارة</span>
                                    <span>التوقيع: .......................................&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;الختم: .......................................</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Controls ── */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-card border rounded-xl p-3 print:hidden">
                <div className="flex items-center gap-1">
                    {(['day', 'week', 'month'] as const).map(p => (
                        <button key={p} onClick={() => setPeriod(p)} className={cn("px-3 py-1 rounded-lg text-xs font-bold border transition-all", period === p ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:bg-muted")}>
                            {p === 'day' ? 'اليوم' : p === 'week' ? 'الأسبوع' : 'الشهر'}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <select aria-label="تصفية حسب الفوج" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="text-xs border rounded-lg px-2 py-1 bg-background font-medium" dir="rtl">
                        <option value="all">كل الأفواج</option>
                        {sheikhs.map(sh => <option key={sh.group} value={sh.group}>{sh.group}</option>)}
                    </select>
                </div>
                <div className="flex items-center gap-1.5">
                    <button onClick={downloadCSV} className="flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1 hover:bg-muted font-bold transition-colors">
                        ⬇️ تصدير Excel
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-1 text-xs border rounded-lg px-2.5 py-1 hover:bg-muted font-bold transition-colors">
                        🖨️ طباعة
                    </button>
                </div>
                <div className="text-[10px] text-muted-foreground italic">{periodLabel}</div>
            </div>

            {/* ── Medal cards ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 print:hidden">
                <div className="rounded-xl border bg-rose-50 border-rose-100 p-3 space-y-0.5">
                    <div className="text-lg">🏅</div>
                    <div className="text-[10px] text-muted-foreground">الأكثر غياباً</div>
                    <div className="font-bold text-sm text-rose-700 leading-tight truncate">{topAbsent?.name || '—'}</div>
                    <div className="text-[10px] text-rose-500">{topAbsent?.absences ?? 0} غياب · {topAbsent?.group || ''}</div>
                </div>
                <div className="rounded-xl border bg-amber-50 border-amber-100 p-3 space-y-0.5">
                    <div className="text-lg">📚</div>
                    <div className="text-[10px] text-muted-foreground">الأكثر (لم يحفظ)</div>
                    <div className="font-bold text-sm text-amber-700 leading-tight truncate">{topNotMem?.name || '—'}</div>
                    <div className="text-[10px] text-amber-500">{topNotMem?.notMem ?? 0} مرة · {topNotMem?.group || ''}</div>
                </div>
                <div className="rounded-xl border bg-orange-50 border-orange-100 p-3 space-y-0.5">
                    <div className="text-lg">⏰</div>
                    <div className="text-[10px] text-muted-foreground">الأكثر تأخراً</div>
                    <div className="font-bold text-sm text-orange-700 leading-tight truncate">{topLate?.name || '—'}</div>
                    <div className="text-[10px] text-orange-500">{topLate?.lateDays ?? 0} يوم · {topLate?.group || ''}</div>
                </div>
                <div className="rounded-xl border bg-blue-50 border-blue-100 p-3 space-y-0.5">
                    <div className="text-lg">📊</div>
                    <div className="text-[10px] text-muted-foreground">إجمالي</div>
                    <div className="font-bold text-sm text-blue-700">{totalFlagged} طالب مُلاحَظ</div>
                    <div className="text-[10px] text-blue-500">{totalAbsences} غياب إجمالاً</div>
                </div>
            </div>

            {/* ── Sort toggles ── */}
            <div className="flex items-center gap-2 text-xs print:hidden">
                <span className="text-muted-foreground font-medium">ترتيب حسب:</span>
                <button onClick={() => setSort('absences')} className={cn("px-2.5 py-1 rounded-lg border font-bold transition-all", sort === 'absences' ? "bg-rose-100 text-rose-700 border-rose-200" : "border-border text-muted-foreground hover:bg-muted")}>
                    <UserX className="h-3 w-3 inline-block ml-1" />الغياب
                </button>
                <button onClick={() => setSort('notMem')} className={cn("px-2.5 py-1 rounded-lg border font-bold transition-all", sort === 'notMem' ? "bg-amber-100 text-amber-700 border-amber-200" : "border-border text-muted-foreground hover:bg-muted")}>
                    <XOctagon className="h-3 w-3 inline-block ml-1" />لم يحفظ
                </button>
            </div>

            {/* ── Table (screen) ── */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground space-y-2 print:hidden">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                    <div className="font-bold text-sm text-emerald-700">لا توجد غيابات أو (لم يحفظ) في هذه الفترة 🎉</div>
                </div>
            ) : (
                <div className="border rounded-xl overflow-hidden shadow-sm print:hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs">
                            <thead>
                                <tr className="bg-muted/30 border-b">
                                    <th className="sticky right-0 z-20 bg-muted/30 text-right p-2 border-l min-w-[120px] font-bold">#  الطالب</th>
                                    <th className="p-2 text-center border-l min-w-[80px] font-bold">الفوج</th>
                                    <th className="p-2 text-center border-l min-w-[60px] font-bold text-rose-700">غياب</th>
                                    <th className="p-2 text-center border-l min-w-[60px] font-bold text-orange-600">تأخر</th>
                                    <th className="p-2 text-center border-l min-w-[70px] font-bold text-amber-700">لم يحفظ</th>
                                    <th className="p-2 text-center border-l min-w-[100px] font-bold text-muted-foreground">تواريخ الغياب</th>
                                    <th className="p-2 text-center border-l min-w-[100px] font-bold text-muted-foreground">تواريخ (لم يحفظ)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.map((s, idx) => (
                                    <tr key={s.id} className={cn("border-b hover:bg-muted/10 transition-colors", idx % 2 === 0 ? 'bg-white' : 'bg-muted/10')}>
                                        <td className={cn("sticky right-0 z-10 p-2 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.07)]", idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] text-muted-foreground font-bold w-4">{(currentPage - 1) * itemsPerPage + idx + 1}</span>
                                                <span className="font-bold text-[11px] leading-tight">{s.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-2 text-center border-l">
                                            <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded-md font-medium">{s.group}</span>
                                        </td>
                                        <td className="p-2 text-center border-l">
                                            {s.absences > 0 ? (
                                                <span className={cn("font-bold text-xs px-1.5 py-0.5 rounded-md", s.absences >= 4 ? 'bg-rose-100 text-rose-700' : s.absences >= 2 ? 'bg-amber-50 text-amber-700' : 'text-orange-500')}>{s.absences}</span>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 text-center border-l">
                                            {s.lateDays > 0 ? <span className="text-orange-500 font-semibold">{s.lateDays}</span> : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 text-center border-l">
                                            {s.notMem > 0 ? (
                                                <span className={cn("font-bold text-xs px-1.5 py-0.5 rounded-md", s.notMem >= 3 ? 'bg-amber-100 text-amber-800' : 'text-amber-600')}>{s.notMem}</span>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 border-l">
                                            <div className="flex flex-wrap gap-0.5 justify-center">
                                                {s.absentDates.slice(0, 5).map(d => (
                                                    <span key={d} className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 px-1 py-0.5 rounded">{format(new Date(d), 'd MMM', { locale: ar })}</span>
                                                ))}
                                                {s.absentDates.length > 5 && <span className="text-[9px] text-muted-foreground">+{s.absentDates.length - 5}</span>}
                                            </div>
                                        </td>
                                        <td className="p-2 border-l">
                                            <div className="flex flex-wrap gap-0.5 justify-center">
                                                {s.notMemDates.slice(0, 5).map(d => (
                                                    <span key={d} className="text-[9px] bg-amber-50 text-amber-700 border border-amber-100 px-1 py-0.5 rounded">{format(new Date(d), 'd MMM', { locale: ar })}</span>
                                                ))}
                                                {s.notMemDates.length > 5 && <span className="text-[9px] text-muted-foreground">+{s.notMemDates.length - 5}</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination Controls */}
                    {filtered.length > 0 && (
                        <div className="flex items-center justify-between p-3 border-t bg-muted/30">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="h-8 text-xs"
                                >
                                    السابق
                                </Button>
                                <span className="text-xs font-medium px-2">
                                    صفحة {currentPage} من {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="h-8 text-xs"
                                >
                                    التالي
                                </Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                عرض {(currentPage - 1) * itemsPerPage + 1} إلى {Math.min(currentPage * itemsPerPage, filtered.length)} من أصل {filtered.length} طالب
                            </div>
                        </div>
                    )}
                </div>
            )}
            <p className="text-[10px] text-muted-foreground text-center print:hidden">
                * الغياب = مسجّل غائب + طلاب لم تظهر أسماؤهم في سجلات الحصة &nbsp;|&nbsp; أحمر ≥ 4 / برتقالي 2–3
            </p>
        </div>
    );
}
