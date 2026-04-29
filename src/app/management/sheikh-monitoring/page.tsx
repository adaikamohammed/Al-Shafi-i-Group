"use client";

import { db } from '@/lib/firebase';
import { ref, set, get, onValue, off } from 'firebase/database';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import {
    Shield, Loader2, CheckCircle2, XCircle, Clock, BookOpen,
    ChevronLeft, ChevronRight, Users, Activity, RotateCcw,
    TrendingUp, TrendingDown, Minus, BarChart2, Star, Award, AlertTriangle,
    UserX, XOctagon, Filter, Printer, ImageDown, CalendarDays, CalendarRange,
    ChevronDown, ChevronUp, FileDown, FileSpreadsheet, Save, Trophy, Crown, Medal, Sparkles, Target, Flame
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
    PieChart, Pie, LineChart, Line, Legend
} from 'recharts';
import { KPIDashboard } from '@/components/management/KPIDashboard';
import { EarlyWarningView, computeAtRiskStudents } from '@/components/management/EarlyWarning';
import { AdvancedCharts } from '@/components/management/AdvancedCharts';
import { StudentProfileDialog } from '@/components/management/StudentProfileDialog';
import { SheikhBadges } from '@/components/management/SheikhBadges';
import { PeriodComparison } from '@/components/management/PeriodComparison';
import { SmartSearch } from '@/components/management/SmartSearch';
import { QuickShare } from '@/components/management/QuickShare';
import { AIAnalytics } from '@/components/management/AIAnalytics';

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

    type ViewMode = 'day' | 'week' | 'month' | 'stats' | 'students' | 'topStudents' | 'earlyWarning' | 'badges';
    const [view, setView] = useState<ViewMode>('day');
    const [studentPeriod, setStudentPeriod] = useState<'day' | 'week' | 'month'>('month');
    const [studentGroupFilter, setStudentGroupFilter] = useState<string>('all');
    const [studentSort, setStudentSort] = useState<'absences' | 'notMem'>('absences');
    const [studentSelectedDate, setStudentSelectedDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [statsMonth, setStatsMonth] = useState(new Date());
    const [sortStat, setSortStat] = useState<'group' | 'att' | 'commit' | 'excellent'>('group');
    const [sortDir, setSortDir] = useState<1 | -1>(1);
    const [topStudentsGroupFilter, setTopStudentsGroupFilter] = useState<string>('all');
    const [starsMode, setStarsMode] = useState<'week' | 'month'>('week');
    const [selectedStudentProfile, setSelectedStudentProfile] = useState<{ id: string; name: string; group: string } | null>(null);

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

            // weekly breakdown — school week = Saturday (6) → Friday (6+6)
            // A week BELONGS TO a month if its Friday falls within that month.
            // → collect all Saturdays where (Saturday + 6) is within [start, end]
            const firstEligibleSat = addDays(start, -6); // earliest Sat whose Fri = start
            const lastEligibleSat = addDays(end, -6); // latest  Sat whose Fri = end
            const weekStarts = eachDayOfInterval({ start: firstEligibleSat, end: lastEligibleSat })
                .filter(d => getDay(d) === 6); // only Saturdays

            const weeklyBreakdown: WeekStats[] = weekStarts.map((wStart, i) => {
                const wEnd = addDays(wStart, 6); // Saturday → Friday (full week)
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
                const dateRange = `سبت ${startFmt} — جمعة ${endFmt}`;
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
            eachDayOfInterval({ start: wSat, end: addDays(wSat, 6) })
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

                    // Note: We only count students who are explicitly marked as
                    // 'غائب' or 'غياب' in the session records. Students missing
                    // from the records are NOT automatically counted as absent
                    // (matches the Day tab behavior).

                });
            });
        }

        return Array.from(studentMap.values())
            .filter(s => s.absences > 0 || s.notMem > 0)
            .sort((a, b) => b.absences - a.absences);
    }, [students, dailySessions, sheikhs, studentPeriod, studentSelectedDate]);

    // ── Weekly student stats (top performers) ─────────────────────────────
    const weeklyStudentStats = useMemo(() => {
        // Compute week boundaries (Sat-Fri) based on selectedDate
        const dow = getDay(selectedDate);
        const wSat = addDays(selectedDate, dow === 6 ? 0 : -(dow + 1));
        const weekDays = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(wSat, i));
        const weekDateStrs = weekDays.map(d => format(d, 'yyyy-MM-dd'));

        // Build group → session dates (only real sessions)
        const groupSessionDates = new Map<string, Set<string>>();
        sheikhs.forEach(sh => groupSessionDates.set(sh.group, new Set()));

        // Per-student accumulator
        type StudentStat = {
            id: string; name: string; group: string;
            attendanceDays: number; totalSessionDays: number;
            excellent: number; goodPlus: number; good: number;
            acceptable: number; weak: number; notMem: number;
            evalScore: number; totalEvals: number;
            lateDays: number;
            behaviorCalm: number; behaviorOk: number; behaviorBad: number;
            behaviorScore: number; totalBehaviorEvals: number;
        };
        const studentMap = new Map<string, StudentStat>();
        (students || []).filter(s => s.status === 'نشط').forEach(s => {
            const grp = (s as any).group || s.groupName || '—';
            studentMap.set(s.id, {
                id: s.id, name: s.fullName, group: grp,
                attendanceDays: 0, totalSessionDays: 0,
                excellent: 0, goodPlus: 0, good: 0,
                acceptable: 0, weak: 0, notMem: 0,
                evalScore: 0, totalEvals: 0,
                lateDays: 0,
                behaviorCalm: 0, behaviorOk: 0, behaviorBad: 0,
                behaviorScore: 0, totalBehaviorEvals: 0,
            });
        });

        // Build group→studentIds
        const groupStudentIds = new Map<string, Set<string>>();
        sheikhs.forEach(sh => groupStudentIds.set(sh.group, new Set()));
        (students || []).filter(s => s.status === 'نشط').forEach(s => {
            const grp = (s as any).group || s.groupName || '';
            groupStudentIds.get(grp)?.add(s.id);
        });

        // Track which dates each group had a real session (to avoid duplicates)
        const groupDateProcessed = new Map<string, Set<string>>();
        sheikhs.forEach(sh => groupDateProcessed.set(sh.group, new Set()));

        if (dailySessions) {
            weekDateStrs.forEach(dateStr => {
                const daySess = (dailySessions as any)[dateStr];
                if (!daySess) return;
                Object.values(daySess as Record<string, any>).forEach((session: any) => {
                    if (!session) return;
                    const sType = session.sessionType;
                    const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                    if (!isReal) return;
                    const shOwner = sheikhs.find(sh => sh.uids.has(session.ownerId));
                    if (!shOwner) return;
                    // Avoid double-counting same group+date
                    if (groupDateProcessed.get(shOwner.group)?.has(dateStr)) return;
                    groupDateProcessed.get(shOwner.group)?.add(dateStr);
                    groupSessionDates.get(shOwner.group)?.add(dateStr);

                    const records: any[] = Array.isArray(session.records)
                        ? session.records
                        : session.records ? Object.values(session.records) : [];
                    const recordedIds = new Set<string>(records.map((r: any) => r.studentId).filter(Boolean));

                    // Mark attendance for recorded students
                    records.forEach((r: any) => {
                        const sid = r.studentId;
                        if (!sid || !studentMap.has(sid)) return;
                        const st = studentMap.get(sid)!;
                        if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') {
                            st.attendanceDays++;
                        }
                        if (r.attendance === 'متأخر') {
                            st.lateDays++;
                        }
                        // Behavior eval
                        if (r.behavior) {
                            st.totalBehaviorEvals++;
                            if (r.behavior === 'هادئ') { st.behaviorCalm++; st.behaviorScore += 2; }
                            else if (r.behavior === 'مقبول') { st.behaviorOk++; st.behaviorScore += 1; }
                            else if (r.behavior === 'مشاغب' || r.behavior === 'غير منضبط') { st.behaviorBad++; st.behaviorScore += -1; }
                        }
                        // Memorization eval (not review)
                        if (!r.review && r.memorization) {
                            st.totalEvals++;
                            if (r.memorization === 'ممتاز') { st.excellent++; st.evalScore += 5; }
                            else if (r.memorization === 'جيد جدا' || r.memorization === 'جيد جداً') { st.goodPlus++; st.evalScore += 6; }
                            else if (r.memorization === 'جيد') { st.good++; st.evalScore += 3; }
                            else if (r.memorization === 'مقبول' || r.memorization === 'حسن') { st.acceptable++; st.evalScore += 2; }
                            else if (r.memorization === 'ضعيف' || r.memorization === 'متوسط') { st.weak++; st.evalScore += 1; }
                            else if (r.memorization === 'لم يحفظ') { st.notMem++; st.evalScore += 0; }
                        }
                    });
                });
            });
        }

        // Set totalSessionDays for each student based on their group
        studentMap.forEach(st => {
            st.totalSessionDays = groupSessionDates.get(st.group)?.size || 0;
        });

        // Compute and return all students
        const all = Array.from(studentMap.values()).map(st => {
            const attendanceRate = st.totalSessionDays > 0 ? Math.round((st.attendanceDays / st.totalSessionDays) * 100) : 0;
            const avgEvalScore = st.totalEvals > 0 ? Math.round((st.evalScore / st.totalEvals) * 100) / 100 : 0;
            const avgBehaviorScore = st.totalBehaviorEvals > 0 ? Math.round((st.behaviorScore / st.totalBehaviorEvals) * 100) / 100 : 0;
            // Scoring: attendance 40 + eval 40 + behavior×5 - late×2
            const attPoints = st.totalSessionDays > 0 ? (st.attendanceDays / st.totalSessionDays) * 40 : 0;
            const evalPoints = st.totalEvals > 0 ? (avgEvalScore / 6) * 40 : 0;
            const behPoints = avgBehaviorScore * 5;
            const latePenalty = st.lateDays * 2;
            const overallScore = Math.max(0, Math.round(attPoints + evalPoints + behPoints - latePenalty));
            return {
                ...st,
                attendanceRate,
                avgEvalScore,
                avgBehaviorScore,
                overallScore,
                bestEval: st.excellent > 0 ? 'ممتاز' : st.goodPlus > 0 ? 'جيد جداً' : st.good > 0 ? 'جيد' : st.acceptable > 0 ? 'مقبول' : st.weak > 0 ? 'ضعيف' : st.notMem > 0 ? 'لم يحفظ' : '—',
            };
        });

        // Week label
        const weekLabel = `سبت ${format(wSat, 'd MMM', { locale: ar })} — جمعة ${format(addDays(wSat, 6), 'd MMM yyyy', { locale: ar })}`;

        return { all, weekLabel, weekStart: wSat, weekEnd: addDays(wSat, 6) };
    }, [students, dailySessions, sheikhs, selectedDate]);

    // ── At-Risk Students (Early Warning) ──────────────────────────────────
    const atRiskStudents = useMemo(() => {
        return computeAtRiskStudents(students || [], dailySessions, sheikhs, selectedDate);
    }, [students, dailySessions, sheikhs, selectedDate]);

    // ── Navigation ──────────────────────────────────────────────────────────
    const navigate = (dir: -1 | 1) => {
        if (view === 'students') {
            if (studentPeriod === 'day') setStudentSelectedDate(d => addDays(d, dir));
            else if (studentPeriod === 'week') setStudentSelectedDate(d => addDays(d, dir * 7));
            else setStudentSelectedDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
        } else if (view === 'topStudents' || view === 'earlyWarning') {
            if (view === 'topStudents' && starsMode === 'month') setSelectedDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
            else setSelectedDate(d => addDays(d, dir * 7));
        }
        else if (view === 'day') setSelectedDate(d => addDays(d, dir));
        else if (view === 'week') setSelectedDate(d => addDays(d, dir * 7));
        else if (view === 'month') setSelectedDate(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
        else if (view === 'badges') setStatsMonth(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
        else setStatsMonth(d => dir === 1 ? addMonths(d, 1) : subMonths(d, 1));
    };

    const navLabel = view === 'badges'
        ? `نقاط المشايخ — ${format(statsMonth, 'MMMM yyyy', { locale: ar })}`
        : view === 'earlyWarning'
            ? `آخر أسبوعين حتى ${format(selectedDate, 'd MMMM yyyy', { locale: ar })}`
            : view === 'topStudents'
                ? (starsMode === 'month' ? format(selectedDate, 'MMMM yyyy', { locale: ar }) : weeklyStudentStats.weekLabel)
                : view === 'students'
                    ? (studentPeriod === 'day'
                        ? format(studentSelectedDate, 'EEEE، d MMMM yyyy', { locale: ar })
                        : studentPeriod === 'week'
                            ? `سبت ${format(addDays(studentSelectedDate, getDay(studentSelectedDate) === 6 ? 0 : -(getDay(studentSelectedDate) + 1)), 'd MMM', { locale: ar })} — جمعة ${format(addDays(addDays(studentSelectedDate, getDay(studentSelectedDate) === 6 ? 0 : -(getDay(studentSelectedDate) + 1)), 6), 'd MMM yyyy', { locale: ar })}`
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
                    <div className="flex items-center gap-2">
                        <SmartSearch students={students || []} sheikhs={sheikhs} onStudentClick={(id, name, group) => setSelectedStudentProfile({ id, name, group })} />
                        <QuickShare sheikhs={sheikhs} getDayStats={getDayStats} selectedDate={selectedDate} />
                    </div>
                </div>
                <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 border flex-wrap">
                    {(['day', 'week', 'month', 'stats', 'students', 'topStudents', 'earlyWarning', 'badges'] as const).map(v => (
                        <button key={v} onClick={() => setView(v)} className={cn("px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all", view === v ? (v === 'earlyWarning' ? 'bg-rose-500 text-white shadow-sm' : 'bg-primary text-white shadow-sm') : "text-muted-foreground hover:bg-muted", v === 'earlyWarning' && atRiskStudents.length > 0 && view !== v && 'text-rose-500')}>
                            {v === 'day' ? '📅 اليوم' : v === 'week' ? '📆 الأسبوع' : v === 'month' ? '🗓 الشهر' : v === 'stats' ? '📊 إحصائيات' : v === 'students' ? '📋 متابعة' : v === 'topStudents' ? '🌟 نجوم' : v === 'earlyWarning' ? `🔔 إنذارات${atRiskStudents.length > 0 ? ` (${atRiskStudents.length})` : ''}` : '🏆 شارات'}
                        </button>
                    ))}
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

                {/* ── KPI Dashboard (always visible) ── */}
                <KPIDashboard
                    sheikhs={sheikhs}
                    getDayStats={getDayStats}
                    dailySessions={dailySessions}
                    groupSessions={groupSessions}
                    selectedDate={selectedDate}
                    students={students || []}
                />

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
                {view === 'week' && (
                    <MatrixTable sheikhs={sheikhs} groupSessions={groupSessions} interval={interval} getDayStats={getDayStats} />
                )}
                {view === 'month' && (
                    <MonthTable
                        sheikhs={sheikhs}
                        getDayStats={getDayStats}
                        selectedDate={selectedDate}
                        monthlyStats={monthlyStats}
                    />
                )}
                {view === 'stats' && (
                    <>
                        <StatsView sortedStats={sortedStats} monthlyStats={monthlyStats} statsMonth={statsMonth} sortStat={sortStat} sortDir={sortDir} toggleSort={toggleSort} />
                        <AdvancedCharts sheikhs={sheikhs} getDayStats={getDayStats} selectedDate={statsMonth} dailySessions={dailySessions} />
                        <PeriodComparison sheikhs={sheikhs} getDayStats={getDayStats} selectedDate={statsMonth} />
                        <AIAnalytics sheikhs={sheikhs} getDayStats={getDayStats} selectedDate={statsMonth} students={students || []} />
                    </>
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
                {view === 'topStudents' && (
                    <TopStudentsView
                        stats={weeklyStudentStats}
                        groupFilter={topStudentsGroupFilter}
                        setGroupFilter={setTopStudentsGroupFilter}
                        sheikhs={sheikhs}
                        starsMode={starsMode}
                        setStarsMode={setStarsMode}
                        selectedDate={selectedDate}
                        dailySessions={dailySessions}
                        students={students}
                    />
                )}
                {view === 'earlyWarning' && (
                    <EarlyWarningView
                        atRiskStudents={atRiskStudents}
                        sheikhs={sheikhs}
                        onStudentClick={(id, name, group) => setSelectedStudentProfile({ id, name, group })}
                    />
                )}
                {view === 'badges' && (
                    <SheikhBadges sheikhs={sheikhs} getDayStats={getDayStats} selectedDate={statsMonth} />
                )}
            </div>

            {/* Student profile dialog */}
            {selectedStudentProfile && (
                <StudentProfileDialog
                    studentId={selectedStudentProfile.id}
                    studentName={selectedStudentProfile.name}
                    studentGroup={selectedStudentProfile.group}
                    dailySessions={dailySessions}
                    sheikhs={sheikhs}
                    onClose={() => setSelectedStudentProfile(null)}
                />
            )}
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

    // ── Absence reasons state + Firebase persistence ──────────────────────────
    const [absenceReasons, setAbsenceReasons] = useState<Record<string, string>>({});
    const [savingReasons, setSavingReasons] = useState<Set<string>>(new Set());

    // Compute the week key for Firebase path
    const weekKey = useMemo(() => {
        const dow = getDay(selectedDate);
        const sat = addDays(selectedDate, dow === 6 ? 0 : -(dow + 1));
        return format(sat, 'yyyy-MM-dd');
    }, [selectedDate]);

    // Load absence reasons from Firebase
    useEffect(() => {
        if (!weeklyMode) return;
        const reasonsRef = ref(db, `absence_reasons/${weekKey}`);
        const handler = onValue(reasonsRef, (snapshot: any) => {
            const data = snapshot.val() || {};
            setAbsenceReasons(data);
        });
        return () => off(reasonsRef, 'value', handler);
    }, [weekKey, weeklyMode]);

    // Save an individual absence reason
    const saveAbsenceReason = async (studentId: string, reason: string) => {
        setSavingReasons(prev => new Set(prev).add(studentId));
        try {
            const reasonRef = ref(db, `absence_reasons/${weekKey}/${studentId}`);
            await set(reasonRef, reason || null);
        } catch (e) {
            console.error('Error saving absence reason:', e);
        } finally {
            setSavingReasons(prev => { const n = new Set(prev); n.delete(studentId); return n; });
        }
    };

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
        return [0, 1, 2, 3, 4, 5, 6].map(i => addDays(sat, i));
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
            if (stats.attendance !== null) attendanceData.push({ name: sh.displayName.split(' ').slice(0, 2).join(' '), attendance: stats.attendance, fill: stats.attendance >= 90 ? '#10b981' : stats.attendance >= 70 ? '#f59e0b' : '#ef4444' });
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
            ? `${format(weekDays[0], 'EEEE d MMMM', { locale: ar })} — ${format(weekDays[6], 'EEEE d MMMM yyyy', { locale: ar })}`
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
                const reason = absenceReasons[rec.id] || '—';
                return `<tr><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg};font-weight:700;font-size:9px">${rec.name}</td><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg};text-align:center;font-size:8px"><span style="background:#f1f5f9;padding:1px 5px;border-radius:3px">${rec.group}</span></td><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg};text-align:center;font-weight:700;color:${cntClr}">${rec.count}</td><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg}">${dayTags}</td><td style="padding:4px 6px;border:1px solid #fed7aa;background:${rowBg};font-size:8px;color:#1e40af">${reason}</td></tr>`;
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
                            <th style="background:#fff7ed;padding:4px 6px;border:1px solid #fed7aa;font-size:8.5px;color:#1e40af">سبب الغياب</th>
                        </tr></thead>
                        <tbody>${abRows}</tbody>
                        <tfoot><tr>
                            <td colspan="2" style="padding:4px 6px;border:1px solid #fed7aa;background:#fff7ed;font-weight:700;color:#ea580c;font-size:9px">الإجمالي</td>
                            <td style="padding:4px 6px;border:1px solid #fed7aa;background:#fff7ed;text-align:center;font-weight:700;color:#dc2626">${weekAbsentData.reduce((s, r) => s + r.count, 0)}</td>
                            <td colspan="2" style="padding:4px 6px;border:1px solid #fed7aa;background:#fff7ed;font-size:8px">${weekAbsentData.length} طالب مُلاحَظ</td>
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
                const abHeaders = ['اسم الطالب', 'الفوج', 'عدد أيام الغياب', 'تواريخ الغياب', 'سبب الغياب'];
                const abRows = weekAbsentData.map(r => [r.name, r.group, r.count, r.absentDays.join(' | '), absenceReasons[r.id] || '']);
                const ws2 = XLSX.utils.aoa_to_sheet([abHeaders, ...abRows]);
                ws2['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 40 }, { wch: 25 }];
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

            {/* ── Charts + Stats (day mode only, screen only) ── */}
            {!weeklyMode && (() => {
                // Compute day absent students
                const dayAbsentStudents: { id: string; name: string; group: string; sheikhName: string }[] = [];
                const dayPresentCount = { total: 0, present: 0, absent: 0, late: 0 };
                filteredSheikhs.forEach(sh => {
                    const sessions = groupSessions.get(sh.group)?.get(dateStr) || [];
                    const session = sessions.find((s: any) => s.sessionNumber === 1) || sessions[0];
                    if (!session || !isRealType(session.sessionType)) return;
                    const records: any[] = session.records || [];
                    const recordedIds = new Set(records.map((r: any) => r.studentId).filter(Boolean));
                    const groupStudents = (students || []).filter((s: any) => s.status === 'نشط' && ((s as any).group === sh.group || s.groupName === sh.group));
                    dayPresentCount.total += groupStudents.length;
                    records.forEach((r: any) => {
                        if (r.attendance === 'حاضر' || r.attendance === 'تعويض') dayPresentCount.present++;
                        else if (r.attendance === 'متأخر') { dayPresentCount.present++; dayPresentCount.late++; }
                        else if (r.attendance === 'غائب' || r.attendance === 'غياب') {
                            dayPresentCount.absent++;
                            const st = groupStudents.find((s: any) => s.id === r.studentId);
                            if (st) dayAbsentStudents.push({ id: st.id, name: st.fullName, group: sh.group, sheikhName: sh.displayName });
                        }
                    });
                    // Students in group but not in records → absent
                    groupStudents.forEach((s: any) => {
                        if (!recordedIds.has(s.id)) {
                            dayPresentCount.absent++;
                            dayAbsentStudents.push({ id: s.id, name: s.fullName, group: sh.group, sheikhName: sh.displayName });
                        }
                    });
                });
                const dayAttRate = dayPresentCount.total > 0 ? Math.round((dayPresentCount.present / dayPresentCount.total) * 100) : null;

                return (
                    <div className="space-y-4 no-print print:hidden">
                        {/* ── Day Summary Cards ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-emerald-100 rounded-lg"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">الحاضرون</span>
                                </div>
                                <div className="text-xl font-black text-emerald-700">{dayPresentCount.present}<span className="text-[10px] text-muted-foreground font-normal">/{dayPresentCount.total}</span></div>
                            </div>
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-rose-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-rose-100 rounded-lg"><UserX className="h-3.5 w-3.5 text-rose-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">الغائبون</span>
                                </div>
                                <div className="text-xl font-black text-rose-700">{dayPresentCount.absent}</div>
                            </div>
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="h-3.5 w-3.5 text-blue-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">نسبة الحضور</span>
                                </div>
                                <div className={cn("text-xl font-black", dayAttRate !== null ? (dayAttRate >= 90 ? 'text-emerald-700' : dayAttRate >= 70 ? 'text-amber-600' : 'text-rose-600') : 'text-muted-foreground')}>
                                    {dayAttRate !== null ? `${dayAttRate}%` : '—'}
                                </div>
                            </div>
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-amber-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-amber-100 rounded-lg"><Clock className="h-3.5 w-3.5 text-amber-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">المتأخرون</span>
                                </div>
                                <div className="text-xl font-black text-amber-700">{dayPresentCount.late}</div>
                            </div>
                        </div>

                        {/* ── Charts ── */}
                        <div className="grid md:grid-cols-2 gap-4">
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
                                <h3 className="text-sm font-bold mb-4 text-center">نسبة الحضور — حسب الشيخ</h3>
                                <div className="h-48 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" />
                                            <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                            <RechartsTooltip cursor={{ fill: '#f1f5f9' }} formatter={(v: number) => [`${v}%`, 'الحضور']} contentStyle={{ direction: 'rtl', borderRadius: '12px' }} />
                                            <Bar dataKey="attendance" radius={[4, 4, 0, 0]}>
                                                {attendanceData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* ── Day Absent Students Table ── */}
                        {dayAbsentStudents.length > 0 && (
                            <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                                <div className="px-3 py-2 border-b flex items-center gap-2" style={{ backgroundColor: '#fff7ed' }}>
                                    <span className="text-sm font-bold text-orange-800">📋 الطلاب الغائبون اليوم</span>
                                    <span className="text-[10px] bg-orange-100 text-orange-600 border border-orange-200 rounded-full px-2 py-0.5 font-bold">{dayAbsentStudents.length} طالب</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-xs">
                                        <thead>
                                            <tr style={{ backgroundColor: '#fff7ed' }} className="border-b">
                                                <th className="text-right p-2 font-bold border-l w-8">#</th>
                                                <th className="text-right p-2 font-bold border-l min-w-[150px]">الطالب</th>
                                                <th className="p-2 text-center font-bold border-l min-w-[80px]">الفوج</th>
                                                <th className="p-2 text-center font-bold min-w-[120px]">الشيخ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dayAbsentStudents.map((rec, idx) => (
                                                <tr key={rec.id} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fff7ed' }} className="border-b">
                                                    <td className="p-2 border-l text-center text-muted-foreground">{idx + 1}</td>
                                                    <td className="p-2 border-l font-bold">{rec.name}</td>
                                                    <td className="p-2 border-l text-center">
                                                        <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded font-medium">{rec.group}</span>
                                                    </td>
                                                    <td className="p-2 text-center text-muted-foreground">{rec.sheikhName}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ backgroundColor: '#fff7ed', borderTop: '2px solid #fed7aa' }}>
                                                <td className="p-2 border-l font-bold text-orange-800" colSpan={2}>الإجمالي</td>
                                                <td className="p-2 border-l text-center font-bold text-rose-700">{dayAbsentStudents.length} غائب</td>
                                                <td className="p-2 text-center text-[10px] text-muted-foreground">{format(new Date(dateStr), 'EEEE d MMM', { locale: ar })}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ── Weekly Charts (week mode only, screen only) ── */}
            {weeklyMode && (() => {
                // ── Compute weekly chart data ──
                // 1) Daily attendance trend (line chart)
                const dailyAttTrend = weekDays.map(day => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const dayAvg = schoolDayAvg.find(x => x.dStr === dStr);
                    const dayName = format(day, 'EEE', { locale: ar });
                    return {
                        day: dayName,
                        attendance: dayAvg?.avg?.attendance ?? null,
                        excellent: dayAvg?.avg?.excellent ?? null,
                        notMemorized: dayAvg?.avg?.notMemorized ?? null,
                    };
                }).filter(d => d.attendance !== null);

                // 2) Session type distribution across the week
                const weekTypeCounts: Record<string, number> = { 'لم يسجل': 0 };
                weekDays.forEach(day => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    filteredSheikhs.forEach(sh => {
                        const stats = getDayStats(sh.group, dStr);
                        if (!stats) { weekTypeCounts['لم يسجل']++; }
                        else {
                            const t = TYPE_CONFIG[stats.type]?.label || stats.type;
                            weekTypeCounts[t] = (weekTypeCounts[t] || 0) + 1;
                        }
                    });
                });
                const weekPieData = Object.entries(weekTypeCounts).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));

                // 3) Group attendance comparison (bar chart)
                const groupAttData = filteredSheikhs.map(sh => {
                    const wa = groupWeekAvg[sh.group] || {};
                    return {
                        name: sh.displayName.split(' ').slice(0, 2).join(' '),
                        attendance: wa.attendance ?? 0,
                        fill: (wa.attendance ?? 0) >= 90 ? '#10b981' : (wa.attendance ?? 0) >= 70 ? '#f59e0b' : '#ef4444'
                    };
                }).filter(d => d.attendance > 0);

                // 4) Memorization levels comparison across the week (bar chart)
                const memLevelsData = weekDays.map(day => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    const dayAvg = schoolDayAvg.find(x => x.dStr === dStr);
                    if (!dayAvg) return null;
                    const a = dayAvg.avg;
                    if (a.attendance === null) return null;
                    return {
                        day: format(day, 'EEE', { locale: ar }),
                        'ممتاز': a.excellent ?? 0,
                        'ج.جداً': a.goodPlus ?? 0,
                        'جيد': a.good ?? 0,
                        'مقبول': a.acceptable ?? 0,
                        'ضعيف': a.weak ?? 0,
                        'لم يحفظ': a.notMemorized ?? 0,
                    };
                }).filter(Boolean) as any[];

                // 5) Top absent students
                const topAbsent = weekAbsentData.slice(0, 10);

                // 6) Summary stats
                const totalSessions = weekDays.reduce((sum, day) => {
                    const dStr = format(day, 'yyyy-MM-dd');
                    let count = 0;
                    filteredSheikhs.forEach(sh => {
                        const st = getDayStats(sh.group, dStr);
                        if (st && isRealType(st.type)) count++;
                    });
                    return sum + count;
                }, 0);
                const totalPossible = filteredSheikhs.length * weekDays.length;
                const avgWeekAtt = schoolWeekAvg.attendance;
                const avgWeekExc = schoolWeekAvg.excellent;
                const avgWeekNotMem = schoolWeekAvg.notMemorized;

                return (
                    <div className="space-y-4 no-print print:hidden">
                        {/* ── Summary Cards ── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-emerald-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-emerald-100 rounded-lg"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">حصص مسجلة</span>
                                </div>
                                <div className="text-xl font-black text-emerald-700">{totalSessions}<span className="text-[10px] text-muted-foreground font-normal">/{totalPossible}</span></div>
                            </div>
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-blue-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-blue-100 rounded-lg"><Users className="h-3.5 w-3.5 text-blue-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">متوسط الحضور</span>
                                </div>
                                <div className={cn("text-xl font-black", avgWeekAtt !== null ? (avgWeekAtt >= 90 ? 'text-emerald-700' : avgWeekAtt >= 70 ? 'text-amber-600' : 'text-rose-600') : 'text-muted-foreground')}>
                                    {avgWeekAtt !== null ? `${avgWeekAtt}%` : '—'}
                                </div>
                            </div>
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-purple-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-purple-100 rounded-lg"><Star className="h-3.5 w-3.5 text-purple-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">متوسط الممتاز</span>
                                </div>
                                <div className="text-xl font-black text-purple-700">{avgWeekExc !== null ? `${avgWeekExc}%` : '—'}</div>
                            </div>
                            <div className="border rounded-xl p-3 bg-gradient-to-br from-rose-50 to-white shadow-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 bg-rose-100 rounded-lg"><UserX className="h-3.5 w-3.5 text-rose-600" /></div>
                                    <span className="text-[10px] text-muted-foreground font-medium">طلاب غائبون</span>
                                </div>
                                <div className="text-xl font-black text-rose-700">{weekAbsentData.length}</div>
                            </div>
                        </div>

                        {/* ── Row 1: Attendance Trend + Session Types ── */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Daily Attendance Trend */}
                            {dailyAttTrend.length > 0 && (
                                <div className="border rounded-xl p-4 bg-white shadow-sm">
                                    <h3 className="text-sm font-bold mb-1 text-center">📈 تطور الحضور خلال الأسبوع</h3>
                                    <p className="text-[10px] text-center text-muted-foreground mb-3">متوسط المدرسة يوميًا</p>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={dailyAttTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                                                <RechartsTooltip formatter={(v: number, name: string) => [`${v}%`, name]} contentStyle={{ direction: 'rtl', textAlign: 'right', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
                                                <Legend verticalAlign="top" height={30} iconType="line" wrapperStyle={{ fontSize: '11px', direction: 'rtl' }} />
                                                <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={3} dot={{ r: 5, fill: '#10b981' }} name="نسبة الحضور" />
                                                <Line type="monotone" dataKey="excellent" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} strokeDasharray="5 5" name="نسبة الممتاز" />
                                                <Line type="monotone" dataKey="notMemorized" stroke="#ef4444" strokeWidth={2} dot={{ r: 4, fill: '#ef4444' }} strokeDasharray="3 3" name="نسبة لم يحفظ" />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Session Type Distribution */}
                            <div className="border rounded-xl p-4 bg-white shadow-sm">
                                <h3 className="text-sm font-bold mb-1 text-center">📊 توزيع الحصص خلال الأسبوع</h3>
                                <p className="text-[10px] text-center text-muted-foreground mb-3">عدد الحصص حسب النوع</p>
                                <div className="h-52 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={weekPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                                {weekPieData.map((entry, index) => <Cell key={index} fill={pieColors[entry.name] || '#94a3b8'} />)}
                                            </Pie>
                                            <RechartsTooltip formatter={(v: number) => [v, 'عدد الحصص']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        {/* ── Row 2: Group Comparison + Memorization Levels ── */}
                        <div className="grid md:grid-cols-2 gap-4">
                            {/* Group Attendance Comparison */}
                            {groupAttData.length > 0 && (
                                <div className="border rounded-xl p-4 bg-white shadow-sm">
                                    <h3 className="text-sm font-bold mb-1 text-center">🏆 متوسط حضور الأفواج — الأسبوع</h3>
                                    <p className="text-[10px] text-center text-muted-foreground mb-3">مقارنة بين الأفواج</p>
                                    <div className="h-52 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={groupAttData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" />
                                                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                                <RechartsTooltip cursor={{ fill: '#f1f5f9' }} formatter={(v: number) => [`${v}%`, 'متوسط الحضور']} />
                                                <Bar dataKey="attendance" radius={[4, 4, 0, 0]}>
                                                    {groupAttData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Memorization Levels by Day */}
                            {memLevelsData.length > 0 && (
                                <div className="border rounded-xl p-4 bg-white shadow-sm">
                                    <h3 className="text-sm font-bold mb-1 text-center">📚 مستويات الحفظ يوميًا</h3>
                                    <p className="text-[10px] text-center text-muted-foreground mb-3">توزيع مستويات الحفظ لكل يوم</p>
                                    <div className="h-52 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={memLevelsData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                                                <YAxis tick={{ fontSize: 10 }} />
                                                <RechartsTooltip formatter={(v: number) => [`${v}%`, '']} />
                                                <Bar dataKey="ممتاز" stackId="mem" fill="#10b981" radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="ج.جداً" stackId="mem" fill="#22c55e" />
                                                <Bar dataKey="جيد" stackId="mem" fill="#3b82f6" />
                                                <Bar dataKey="مقبول" stackId="mem" fill="#f59e0b" />
                                                <Bar dataKey="ضعيف" stackId="mem" fill="#ef4444" />
                                                <Bar dataKey="لم يحفظ" stackId="mem" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-2 mt-2 text-[9px]">
                                        {[{ l: 'ممتاز', c: '#10b981' }, { l: 'ج.جداً', c: '#22c55e' }, { l: 'جيد', c: '#3b82f6' }, { l: 'مقبول', c: '#f59e0b' }, { l: 'ضعيف', c: '#ef4444' }, { l: 'لم يحفظ', c: '#94a3b8' }].map(x => (
                                            <span key={x.l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: x.c }} />{x.l}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Row 3: Top Absent Students ── */}
                        {topAbsent.length > 0 && (
                            <div className="border rounded-xl p-4 bg-white shadow-sm">
                                <h3 className="text-sm font-bold mb-1 text-center">⚠️ أكثر الطلاب غيابًا خلال الأسبوع</h3>
                                <p className="text-[10px] text-center text-muted-foreground mb-3">أعلى {topAbsent.length} طالب من حيث عدد أيام الغياب</p>
                                <div className="h-52 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={topAbsent.map(r => ({ name: r.name.split(' ').slice(0, 2).join(' '), count: r.count, group: r.group, fill: r.count >= 4 ? '#dc2626' : r.count >= 3 ? '#ea580c' : r.count >= 2 ? '#f59e0b' : '#fb923c' }))} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                            <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 'dataMax + 1']} />
                                            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
                                            <RechartsTooltip formatter={(v: number, _: any, payload: any) => [`${v} أيام — ${payload?.payload?.group || ''}`, 'الغياب']} />
                                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                                {topAbsent.map((_, i) => <Cell key={i} fill={topAbsent[i].count >= 4 ? '#dc2626' : topAbsent[i].count >= 3 ? '#ea580c' : topAbsent[i].count >= 2 ? '#f59e0b' : '#fb923c'} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

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
                                ? `${format(weekDays[0], 'EEEE d MMMM', { locale: ar })} — ${format(weekDays[6], 'EEEE d MMMM yyyy', { locale: ar })}`
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
                                        <th className="p-2 font-bold text-muted-foreground border-l">تواريخ الغياب</th>
                                        <th className="p-2 font-bold text-blue-700 min-w-[180px]">سبب الغياب</th>
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
                                            <td className="p-2 border-l">
                                                <div className="flex flex-wrap gap-1">
                                                    {rec.absentDays.map(d => (
                                                        <span key={d} className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 px-1.5 py-0.5 rounded">{d}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-1 no-print">
                                                    <input
                                                        type="text"
                                                        data-student-id={rec.id}
                                                        placeholder="سبب الغياب..."
                                                        defaultValue={absenceReasons[rec.id] || ''}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.trim();
                                                            if (val !== (absenceReasons[rec.id] || '')) saveAbsenceReason(rec.id, val);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const val = (e.target as HTMLInputElement).value.trim();
                                                                saveAbsenceReason(rec.id, val);
                                                                (e.target as HTMLInputElement).blur();
                                                            }
                                                        }}
                                                        className="flex-1 text-[10px] border rounded-md px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 outline-none min-w-[100px]"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            const input = document.querySelector(`input[data-student-id="${rec.id}"]`) as HTMLInputElement;
                                                            if (input) saveAbsenceReason(rec.id, input.value.trim());
                                                        }}
                                                        disabled={savingReasons.has(rec.id)}
                                                        className="p-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors disabled:opacity-50"
                                                        title="حفظ السبب"
                                                    >
                                                        <Save className="h-3 w-3" />
                                                    </button>
                                                </div>
                                                {/* Print-only display */}
                                                <span className="hidden print:inline text-[10px]">{absenceReasons[rec.id] || '—'}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ backgroundColor: '#fff7ed', borderTop: '2px solid #fed7aa' }}>
                                        <td className="p-2 border-l font-bold text-orange-800" colSpan={2}>الإجمالي</td>
                                        <td className="p-2 border-l text-center font-bold text-rose-700">{weekAbsentData.reduce((s, r) => s + r.count, 0)} غياب</td>
                                        <td className="p-2 text-[10px] text-muted-foreground" colSpan={2}>{weekAbsentData.length} طالب مُلاحَظ خلال الأسبوع</td>
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

// ─── MonthTable Component ────────────────────────────────────────────────────
function MonthTable({
    sheikhs, getDayStats, selectedDate, monthlyStats
}: {
    sheikhs: GroupSheikhInfo[];
    getDayStats: (g: string, d: string) => DayStats | null;
    selectedDate: Date;
    monthlyStats: MonthlySheikhStats[];
}) {
    const tableRef = useRef<HTMLDivElement>(null);

    // Map group -> stats for quick lookup
    const statsMap = useMemo(() => {
        const m = new Map<string, MonthlySheikhStats>();
        monthlyStats.forEach(s => m.set(s.group, s));
        return m;
    }, [monthlyStats]);

    // All unique weeks from the monthly stats (use first sheikh's breakdown as reference)
    const weeks = monthlyStats[0]?.weeklyBreakdown || [];

    // School-wide averages per week
    const schoolWeekAvgs = useMemo(() => weeks.map((_, wi) => ({
        sessionDays: Math.round((monthlyStats.reduce((s, sh) => s + (sh.weeklyBreakdown[wi]?.sessionDays ?? 0), 0)) / (monthlyStats.length || 1)),
        avgAttendance: avg(monthlyStats.map(sh => sh.weeklyBreakdown[wi]?.avgAttendance ?? null)),
        avgExcellent: avg(monthlyStats.map(sh => sh.weeklyBreakdown[wi]?.avgExcellent ?? null)),
    })), [monthlyStats, weeks]);

    const monthLabel = format(selectedDate, 'MMMM yyyy', { locale: ar });

    // ── pctStyle helper for PDF ──────────────────────────────────────────────
    function pdfPctStyle(v: number | null, thresholds = [90, 70]): string {
        if (v === null) return 'color:#94a3b8';
        if (v >= thresholds[0]) return 'color:#059669;font-weight:700';
        if (v >= thresholds[1]) return 'color:#d97706;font-weight:700';
        return 'color:#e11d48;font-weight:700';
    }

    // ── Save image ───────────────────────────────────────────────────────────
    const handleSaveImage = async () => {
        if (!tableRef.current) return;
        try {
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(tableRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
            const link = document.createElement('a');
            link.download = `تقرير_شهر_${format(selectedDate, 'yyyy-MM')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (e) { console.error(e); }
    };

    // ── Export PDF ───────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        const thStyle = 'background:#1e3a5f;color:white;padding:5px 7px;font-size:8.5px;border:1px solid #1e40af;text-align:center;white-space:nowrap';
        const tdStyle = 'padding:4px 7px;border:1px solid #e2e8f0;vertical-align:top;text-align:center';
        const tdGroupStyle = 'padding:4px 7px;border:1px solid #e2e8f0;vertical-align:top;text-align:right;font-weight:700;font-size:9px;min-width:115px';

        const statsHead = `<tr>
            <th style="${thStyle};text-align:right">الفوج / الشيخ</th>
            <th style="${thStyle}">انتظام%</th>
            <th style="${thStyle}">جلسات</th>
            <th style="${thStyle}">غياب شيخ</th>
            <th style="${thStyle}">حضور%</th>
            <th style="${thStyle}">ممتاز%</th>
            <th style="${thStyle}">ج.جداً%</th>
            <th style="${thStyle}">جيد%</th>
            ${weeks.map((w, wi) => `<th style="${thStyle};background:#172554;min-width:90px">
                <div style="font-weight:700">${w.label}</div>
                <div style="font-weight:400;font-size:7.5px;opacity:.75;white-space:nowrap">${w.dateRange}</div>
                <div style="font-size:7px;opacity:.5">جلسات / حضور / ممتاز</div>
            </th>`).join('')}
        </tr>`;

        const bodyRows = sheikhs.map((sh, idx) => {
            const ms = statsMap.get(sh.group);
            const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
            if (!ms) return '';
            const weekCells = weeks.map((_, wi) => {
                const w = ms.weeklyBreakdown[wi];
                if (!w) return `<td style="${tdStyle};background:${rowBg}">—</td>`;
                const clrAtt = pdfPctStyle(w.avgAttendance);
                const clrExc = pdfPctStyle(w.avgExcellent, [50, 30]);
                return `<td style="${tdStyle};background:${rowBg}">
                    <div style="font-size:8px">${w.sessionDays}ج</div>
                    <div style="font-size:8px;${clrAtt}">${w.avgAttendance !== null ? w.avgAttendance + '%' : '—'}</div>
                    <div style="font-size:8px;${clrExc}">${w.avgExcellent !== null ? '★' + w.avgExcellent + '%' : '—'}</div>
                </td>`;
            }).join('');
            return `<tr>
                <td style="${tdGroupStyle};background:${rowBg}">${sh.group}<br/><span style="font-weight:400;font-size:8px;color:#6b7280">${sh.displayName}</span></td>
                <td style="${tdStyle};background:${rowBg}"><span style="${pdfPctStyle(ms.commitmentRate)}">${ms.commitmentRate}%</span></td>
                <td style="${tdStyle};background:${rowBg};font-size:8px">${ms.sessionDays}</td>
                <td style="${tdStyle};background:${rowBg};font-size:8px;${ms.sheikhabsences > 3 ? 'color:#dc2626;font-weight:700' : ms.sheikhabsences > 1 ? 'color:#d97706' : 'color:#94a3b8'}">${ms.sheikhabsences}</td>
                <td style="${tdStyle};background:${rowBg}"><span style="${pdfPctStyle(ms.avgAttendance)}">${ms.avgAttendance !== null ? ms.avgAttendance + '%' : '—'}</span></td>
                <td style="${tdStyle};background:${rowBg}"><span style="${pdfPctStyle(ms.avgExcellent, [50, 30])}">${ms.avgExcellent !== null ? ms.avgExcellent + '%' : '—'}</span></td>
                <td style="${tdStyle};background:${rowBg}"><span style="${pdfPctStyle(ms.avgGoodPlus, [40, 20])}">${ms.avgGoodPlus !== null ? ms.avgGoodPlus + '%' : '—'}</span></td>
                <td style="${tdStyle};background:${rowBg}"><span style="${pdfPctStyle(ms.avgGood, [40, 20])}">${ms.avgGood !== null ? ms.avgGood + '%' : '—'}</span></td>
                ${weekCells}
            </tr>`;
        }).join('');

        const avgCommit = avg(monthlyStats.map(s => s.commitmentRate));
        const avgSessions = monthlyStats.length ? Math.round(monthlyStats.reduce((a, s) => a + s.sessionDays, 0) / monthlyStats.length) : null;
        const avgAbs = monthlyStats.length ? Math.round(monthlyStats.reduce((a, s) => a + s.sheikhabsences, 0) / monthlyStats.length) : null;
        const avgAtt = avg(monthlyStats.map(s => s.avgAttendance));
        const avgExc = avg(monthlyStats.map(s => s.avgExcellent));
        const avgGp = avg(monthlyStats.map(s => s.avgGoodPlus));
        const avgGd = avg(monthlyStats.map(s => s.avgGood));
        const footCells = weeks.map((_, wi) => {
            const wa = schoolWeekAvgs[wi];
            return `<td style="padding:4px 7px;border:1px solid #1e40af;background:#172554;text-align:center;color:white">
                <div style="font-size:8px">${wa.sessionDays}ج</div>
                <div style="font-size:8px;color:${(wa.avgAttendance ?? 0) >= 90 ? '#34d399' : (wa.avgAttendance ?? 0) >= 70 ? '#fbbf24' : '#f87171'}">${wa.avgAttendance !== null ? wa.avgAttendance + '%' : '—'}</div>
                <div style="font-size:8px;color:#c7d2fe">${wa.avgExcellent !== null ? '★' + wa.avgExcellent + '%' : '—'}</div>
            </td>`;
        }).join('');
        const footRow = `<tfoot><tr>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;color:white;font-weight:700;font-size:9px;text-align:right">متوسط الكل</td>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;text-align:center"><span style="${pdfPctStyle(avgCommit)}">${avgCommit !== null ? avgCommit + '%' : '—'}</span></td>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;color:white;text-align:center;font-size:8px">${avgSessions ?? '—'}</td>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;color:white;text-align:center;font-size:8px">${avgAbs ?? '—'}</td>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;text-align:center"><span style="${pdfPctStyle(avgAtt)}">${avgAtt !== null ? avgAtt + '%' : '—'}</span></td>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;text-align:center"><span style="${pdfPctStyle(avgExc, [50, 30])}">${avgExc !== null ? avgExc + '%' : '—'}</span></td>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;text-align:center"><span style="${pdfPctStyle(avgGp, [40, 20])}">${avgGp !== null ? avgGp + '%' : '—'}</span></td>
            <td style="padding:4px 7px;border:1px solid #1e40af;background:#1e3a5f;text-align:center"><span style="${pdfPctStyle(avgGd, [40, 20])}">${avgGd !== null ? avgGd + '%' : '—'}</span></td>
            ${footCells}
        </tr></tfoot>`;

        const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8"/>
    <title>تقرير شهر ${monthLabel}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; background: white; color: #1e293b; font-size: 9px; }
        @media print {
            @page { size: A4 landscape; margin: 8mm; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { font-size: 8px; }
        }
        table { border-collapse: collapse; width: 100%; }
    </style>
</head>
<body style="padding:10px">
    <div style="border-bottom:2px solid #1e3a5f;padding-bottom:8px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:flex-start">
        <div>
            <h1 style="color:#1e3a5f;font-size:14px;font-weight:900">تقرير مراقبة المشايخ — الشهري</h1>
            <p style="margin-top:3px;font-size:9px;color:#475569">شهر ${monthLabel}</p>
            <p style="margin-top:2px;font-size:8px;color:#64748b">عدد الأفواج: ${sheikhs.length}</p>
        </div>
        <div style="text-align:left;font-size:8px;color:#64748b">
            <div style="font-weight:700">المدرسة القرآنية للشافعي</div>
            <div>${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        </div>
    </div>
    <div style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
        <div style="background:#1e3a5f;color:white;padding:5px 10px;font-weight:700;font-size:9px">ملخص شهر ${monthLabel}</div>
        <table>
            <thead>${statsHead}</thead>
            <tbody>${bodyRows}</tbody>
            ${footRow}
        </table>
    </div>
    <p style="margin-top:8px;font-size:8px;color:#94a3b8">* الانتظام = الجلسات ÷ أيام العمل الفعلية · تاريخ الطباعة: ${format(new Date(), 'EEEE d MMMM yyyy', { locale: ar })}</p>
</body>
</html>`;

        const pw = window.open('', '_blank', 'width=1400,height=900');
        if (!pw) { alert('يرجى السماح بالنوافذ المنبثقة لهذا الموقع'); return; }
        pw.document.write(html);
        pw.document.close();
        pw.focus();
        setTimeout(() => { pw.print(); }, 800);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    if (monthlyStats.length === 0) {
        return <div className="text-center text-muted-foreground py-12 text-sm">لا توجد بيانات لهذا الشهر</div>;
    }

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 justify-end">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => window.print()}>
                    <Printer className="h-3.5 w-3.5" /> طباعة
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleSaveImage}>
                    <ImageDown className="h-3.5 w-3.5" /> حفظ صورة PNG
                </Button>
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-rose-600 hover:bg-rose-700 text-white" onClick={handleExportPDF}>
                    <FileDown className="h-3.5 w-3.5" /> تصدير PDF
                </Button>
            </div>

            {/* Table */}
            <div ref={tableRef} className="border rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="bg-gradient-to-l from-slate-800 to-slate-700 text-white px-4 py-2.5 flex items-center justify-between">
                    <span className="font-bold text-sm">ملخص شهر {monthLabel}</span>
                    <span className="text-[11px] text-slate-300">{sheikhs.length} أفواج</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="border-collapse text-xs w-full">
                        <thead>
                            <tr className="bg-muted/30 border-b">
                                <th className="sticky right-0 z-20 bg-muted/30 text-right p-2 text-xs font-bold border-l min-w-[130px]">الفوج / الشيخ</th>
                                <th className="p-2 text-center border-l min-w-[55px] whitespace-nowrap">انتظام%</th>
                                <th className="p-2 text-center border-l min-w-[45px] whitespace-nowrap">جلسات</th>
                                <th className="p-2 text-center border-l min-w-[50px] whitespace-nowrap">غ.شيخ</th>
                                <th className="p-2 text-center border-l min-w-[55px] whitespace-nowrap">حضور%</th>
                                <th className="p-2 text-center border-l min-w-[50px] whitespace-nowrap">ممتاز%</th>
                                <th className="p-2 text-center border-l min-w-[50px] whitespace-nowrap">ج.جداً%</th>
                                <th className="p-2 text-center border-l min-w-[45px] whitespace-nowrap">جيد%</th>
                                {weeks.map((w, wi) => (
                                    <th key={wi} className="p-1.5 text-center border-l min-w-[90px] bg-blue-50/50 text-blue-800">
                                        <div className="font-bold text-[10px]">{w.label}</div>
                                        <div className="text-[8.5px] opacity-60 whitespace-nowrap">{w.dateRange}</div>
                                        <div className="text-[8px] text-muted-foreground">جلسات · حضور · ممتاز</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sheikhs.map((sh, idx) => {
                                const ms = statsMap.get(sh.group);
                                if (!ms) return null;
                                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-muted/10';
                                return (
                                    <tr key={sh.group} className={cn('border-b hover:bg-primary/5 transition-colors', rowBg)}>
                                        {/* Group info */}
                                        <td className={cn('sticky right-0 z-10 p-2 border-l shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]', idx % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                                            <div className="font-bold text-[11px] leading-tight">{sh.group}</div>
                                            <div className="text-[9px] text-muted-foreground truncate max-w-[120px]">{sh.displayName}</div>
                                        </td>
                                        {/* Commitment */}
                                        <td className="p-2 text-center border-l">
                                            <span className={cn('text-xs font-bold', pctColor(ms.commitmentRate))}>{ms.commitmentRate}%</span>
                                        </td>
                                        {/* Session days */}
                                        <td className="p-2 text-center border-l">
                                            <span className="text-xs font-medium">{ms.sessionDays}</span>
                                        </td>
                                        {/* Sheikh absences */}
                                        <td className="p-2 text-center border-l">
                                            <span className={cn('text-xs', ms.sheikhabsences > 3 ? 'text-rose-600 font-bold' : ms.sheikhabsences > 1 ? 'text-amber-600' : 'text-muted-foreground')}>
                                                {ms.sheikhabsences}
                                            </span>
                                        </td>
                                        {/* Avg attendance */}
                                        <td className="p-2 text-center border-l"><PctCell v={ms.avgAttendance} /></td>
                                        {/* Avg excellent */}
                                        <td className="p-2 text-center border-l"><PctCell v={ms.avgExcellent} thresholds={[50, 30]} /></td>
                                        {/* Avg goodPlus */}
                                        <td className="p-2 text-center border-l"><PctCell v={ms.avgGoodPlus} thresholds={[40, 20]} /></td>
                                        {/* Avg good */}
                                        <td className="p-2 text-center border-l"><PctCell v={ms.avgGood} thresholds={[40, 20]} /></td>
                                        {/* Weekly breakdown */}
                                        {weeks.map((_, wi) => {
                                            const w = ms.weeklyBreakdown[wi];
                                            if (!w) return <td key={wi} className="p-1 text-center border-l bg-blue-50/20"><span className="text-muted-foreground/40 text-xs">—</span></td>;
                                            return (
                                                <td key={wi} className="p-1 text-center border-l bg-blue-50/20">
                                                    <div className="text-[10px] font-bold text-blue-700">{w.sessionDays}ج</div>
                                                    <PctCell v={w.avgAttendance} />
                                                    <div className="text-[9px] text-emerald-600">{w.avgExcellent !== null ? `★${w.avgExcellent}%` : '—'}</div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="bg-muted/20 border-t-2 font-bold">
                                <td className="sticky right-0 z-10 bg-muted/20 p-2 border-l text-xs font-bold">متوسط الكل</td>
                                <td className="p-2 text-center border-l"><PctCell v={avg(monthlyStats.map(s => s.commitmentRate))} /></td>
                                <td className="p-2 text-center border-l text-xs">{monthlyStats.length ? Math.round(monthlyStats.reduce((a, s) => a + s.sessionDays, 0) / monthlyStats.length) : '—'}</td>
                                <td className="p-2 text-center border-l text-xs">{monthlyStats.length ? Math.round(monthlyStats.reduce((a, s) => a + s.sheikhabsences, 0) / monthlyStats.length) : '—'}</td>
                                <td className="p-2 text-center border-l"><PctCell v={avg(monthlyStats.map(s => s.avgAttendance))} /></td>
                                <td className="p-2 text-center border-l"><PctCell v={avg(monthlyStats.map(s => s.avgExcellent))} thresholds={[50, 30]} /></td>
                                <td className="p-2 text-center border-l"><PctCell v={avg(monthlyStats.map(s => s.avgGoodPlus))} thresholds={[40, 20]} /></td>
                                <td className="p-2 text-center border-l"><PctCell v={avg(monthlyStats.map(s => s.avgGood))} thresholds={[40, 20]} /></td>
                                {schoolWeekAvgs.map((wa, wi) => (
                                    <td key={wi} className="p-1 text-center border-l bg-blue-100/40">
                                        <div className="text-[10px] font-bold text-blue-700">{wa.sessionDays}ج</div>
                                        <PctCell v={wa.avgAttendance} />
                                        <div className="text-[9px] text-emerald-600">{wa.avgExcellent !== null ? `★${wa.avgExcellent}%` : '—'}</div>
                                    </td>
                                ))}
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p className="text-[10px] text-muted-foreground p-2 text-center border-t">
                    * الانتظام = عدد الجلسات ÷ أيام العمل الفعلية (مطروحاً منها العطل وغياب الشيخ)
                </p>
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

// ─── TopStudentsView Component ────────────────────────────────────────────────
type TopStudentEntry = {
    id: string; name: string; group: string;
    attendanceDays: number; totalSessionDays: number; attendanceRate: number;
    excellent: number; goodPlus: number; good: number;
    acceptable: number; weak: number; notMem: number;
    evalScore: number; totalEvals: number; avgEvalScore: number; bestEval: string;
    lateDays: number;
    behaviorCalm: number; behaviorOk: number; behaviorBad: number;
    behaviorScore: number; totalBehaviorEvals: number; avgBehaviorScore: number;
    overallScore: number;
};

function TopStudentsView({ stats, groupFilter, setGroupFilter, sheikhs, starsMode, setStarsMode, selectedDate, dailySessions, students }: {
    stats: { all: TopStudentEntry[]; weekLabel: string; weekStart: Date; weekEnd: Date };
    groupFilter: string;
    setGroupFilter: (g: string) => void;
    sheikhs: GroupSheikhInfo[];
    starsMode: 'week' | 'month';
    setStarsMode: (m: 'week' | 'month') => void;
    selectedDate: Date;
    dailySessions: any;
    students: any;
}) {
    // Monthly stats computation
    const monthlyData = useMemo(() => {
        if (starsMode !== 'month') return null;
        const mStart = startOfMonth(selectedDate);
        const mEnd = endOfMonth(selectedDate);
        const monthDays = eachDayOfInterval({ start: mStart, end: mEnd }).map(d => format(d, 'yyyy-MM-dd'));

        const groupSessionDates = new Map<string, Set<string>>();
        sheikhs.forEach(sh => groupSessionDates.set(sh.group, new Set()));

        type MStat = TopStudentEntry & {};
        const studentMap = new Map<string, any>();
        (students || []).filter((s: any) => s.status === 'نشط').forEach((s: any) => {
            const grp = (s as any).group || s.groupName || '—';
            studentMap.set(s.id, {
                id: s.id, name: s.fullName, group: grp,
                attendanceDays: 0, totalSessionDays: 0, excellent: 0, goodPlus: 0, good: 0,
                acceptable: 0, weak: 0, notMem: 0, evalScore: 0, totalEvals: 0,
                lateDays: 0, behaviorCalm: 0, behaviorOk: 0, behaviorBad: 0,
                behaviorScore: 0, totalBehaviorEvals: 0,
            });
        });
        const groupStudentIds = new Map<string, Set<string>>();
        sheikhs.forEach(sh => groupStudentIds.set(sh.group, new Set()));
        (students || []).filter((s: any) => s.status === 'نشط').forEach((s: any) => {
            const grp = (s as any).group || s.groupName || '';
            groupStudentIds.get(grp)?.add(s.id);
        });
        const groupDateProcessed = new Map<string, Set<string>>();
        sheikhs.forEach(sh => groupDateProcessed.set(sh.group, new Set()));

        if (dailySessions) {
            monthDays.forEach(dateStr => {
                const daySess = (dailySessions as any)[dateStr];
                if (!daySess) return;
                Object.values(daySess as Record<string, any>).forEach((session: any) => {
                    if (!session) return;
                    const sType = session.sessionType;
                    const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                    if (!isReal) return;
                    const shOwner = sheikhs.find(sh => sh.uids.has(session.ownerId));
                    if (!shOwner) return;
                    if (groupDateProcessed.get(shOwner.group)?.has(dateStr)) return;
                    groupDateProcessed.get(shOwner.group)?.add(dateStr);
                    groupSessionDates.get(shOwner.group)?.add(dateStr);
                    const records: any[] = Array.isArray(session.records) ? session.records : session.records ? Object.values(session.records) : [];
                    records.forEach((r: any) => {
                        const sid = r.studentId;
                        if (!sid || !studentMap.has(sid)) return;
                        const st = studentMap.get(sid)!;
                        if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') st.attendanceDays++;
                        if (r.attendance === 'متأخر') st.lateDays++;
                        if (r.behavior) {
                            st.totalBehaviorEvals++;
                            if (r.behavior === 'هادئ') { st.behaviorCalm++; st.behaviorScore += 2; }
                            else if (r.behavior === 'مقبول') { st.behaviorOk++; st.behaviorScore += 1; }
                            else { st.behaviorBad++; st.behaviorScore += -1; }
                        }
                        if (!r.review && r.memorization) {
                            st.totalEvals++;
                            if (r.memorization === 'ممتاز') { st.excellent++; st.evalScore += 5; }
                            else if (r.memorization === 'جيد جدا' || r.memorization === 'جيد جداً') { st.goodPlus++; st.evalScore += 6; }
                            else if (r.memorization === 'جيد') { st.good++; st.evalScore += 3; }
                            else if (r.memorization === 'مقبول' || r.memorization === 'حسن') { st.acceptable++; st.evalScore += 2; }
                            else if (r.memorization === 'ضعيف' || r.memorization === 'متوسط') { st.weak++; st.evalScore += 1; }
                            else if (r.memorization === 'لم يحفظ') { st.notMem++; st.evalScore += 0; }
                        }
                    });
                });
            });
        }
        studentMap.forEach(st => { st.totalSessionDays = groupSessionDates.get(st.group)?.size || 0; });
        const all: TopStudentEntry[] = Array.from(studentMap.values()).map((st: any) => {
            const attendanceRate = st.totalSessionDays > 0 ? Math.round((st.attendanceDays / st.totalSessionDays) * 100) : 0;
            const avgEvalScore = st.totalEvals > 0 ? Math.round((st.evalScore / st.totalEvals) * 100) / 100 : 0;
            const avgBehaviorScore = st.totalBehaviorEvals > 0 ? Math.round((st.behaviorScore / st.totalBehaviorEvals) * 100) / 100 : 0;
            const attPts = st.totalSessionDays > 0 ? (st.attendanceDays / st.totalSessionDays) * 40 : 0;
            const evalPts = st.totalEvals > 0 ? (avgEvalScore / 6) * 40 : 0;
            const behPts = avgBehaviorScore * 5;
            const latePenalty = st.lateDays * 2;
            return { ...st, attendanceRate, avgEvalScore, avgBehaviorScore, overallScore: Math.max(0, Math.round(attPts + evalPts + behPts - latePenalty)), bestEval: st.excellent > 0 ? 'ممتاز' : st.goodPlus > 0 ? 'جيد جداً' : st.good > 0 ? 'جيد' : st.acceptable > 0 ? 'مقبول' : st.weak > 0 ? 'ضعيف' : st.notMem > 0 ? 'لم يحفظ' : '—' };
        });
        return { all, weekLabel: format(selectedDate, 'MMMM yyyy', { locale: ar }), weekStart: mStart, weekEnd: mEnd };
    }, [starsMode, selectedDate, dailySessions, students, sheikhs]);

    const dataSource = starsMode === 'month' && monthlyData ? monthlyData : stats;
    const filtered = groupFilter === 'all' ? dataSource.all : dataSource.all.filter(s => s.group === groupFilter);
    const active = filtered.filter(s => s.totalSessionDays > 0);

    // Top performers
    const topAttendance = [...active].filter(s => s.attendanceRate > 0).sort((a, b) => b.attendanceRate - a.attendanceRate || b.attendanceDays - a.attendanceDays);
    const topExcellent = [...active].filter(s => s.excellent > 0).sort((a, b) => b.excellent - a.excellent || b.evalScore - a.evalScore);

    // Overall ranking using comprehensive score
    const overallRanked = [...active]
        .filter(s => s.totalEvals > 0 || s.attendanceDays > 0)
        .sort((a, b) => b.overallScore - a.overallScore);

    // Group champions: top 3 per group
    const groupChampions = sheikhs.map(sh => {
        const groupStudents = [...dataSource.all]
            .filter(s => s.group === sh.group && s.totalSessionDays > 0 && (s.totalEvals > 0 || s.attendanceDays > 0))
            .sort((a, b) => b.overallScore - a.overallScore);
        return { group: sh.group, displayName: sh.displayName, top3: groupStudents.slice(0, 3) };
    });

    // Eval distribution for pie chart
    const evalDistribution = [
        { name: 'ممتاز', value: active.reduce((s, st) => s + st.excellent, 0), color: '#10b981' },
        { name: 'جيد جداً', value: active.reduce((s, st) => s + st.goodPlus, 0), color: '#22c55e' },
        { name: 'جيد', value: active.reduce((s, st) => s + st.good, 0), color: '#3b82f6' },
        { name: 'مقبول', value: active.reduce((s, st) => s + st.acceptable, 0), color: '#f59e0b' },
        { name: 'ضعيف', value: active.reduce((s, st) => s + st.weak, 0), color: '#ef4444' },
        { name: 'لم يحفظ', value: active.reduce((s, st) => s + st.notMem, 0), color: '#94a3b8' },
    ].filter(e => e.value > 0);

    // Bar chart data: top 8 students by overall score
    const barData = overallRanked.slice(0, 8).map(s => ({
        name: s.name.split(' ').slice(0, 2).join(' '),
        score: s.overallScore,
        attendance: s.attendanceRate,
        eval: Math.round((s.avgEvalScore / 6) * 100),
    }));

    const EVAL_BADGE: Record<string, { bg: string; text: string }> = {
        'ممتاز': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
        'جيد جداً': { bg: 'bg-green-100', text: 'text-green-700' },
        'جيد': { bg: 'bg-blue-100', text: 'text-blue-700' },
        'مقبول': { bg: 'bg-amber-100', text: 'text-amber-700' },
        'ضعيف': { bg: 'bg-rose-100', text: 'text-rose-700' },
        'لم يحفظ': { bg: 'bg-gray-100', text: 'text-gray-500' },
        '—': { bg: 'bg-gray-50', text: 'text-gray-400' },
    };

    const medalEmoji = (rank: number) => rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`;

    const [selectedStudentDetail, setSelectedStudentDetail] = useState<TopStudentEntry | null>(null);
    const [rankingPage, setRankingPage] = useState(0);
    const RANKING_PAGE_SIZE = 15;

    // All-students rank (ignores groupFilter)
    const allActiveRanked = useMemo(() => [
        ...dataSource.all]
        .filter(s => s.totalSessionDays > 0 && (s.totalEvals > 0 || s.attendanceDays > 0))
        .sort((a, b) => b.overallScore - a.overallScore),
    [dataSource]);

    const overallRankMap = useMemo(() => {
        const map = new Map<string, number>();
        allActiveRanked.forEach((s, i) => map.set(s.id, i + 1));
        return map;
    }, [allActiveRanked]);

    const groupRankMap = useMemo(() => {
        const map = new Map<string, number>();
        sheikhs.forEach(sh => {
            [...dataSource.all]
                .filter(s => s.group === sh.group && s.totalSessionDays > 0 && (s.totalEvals > 0 || s.attendanceDays > 0))
                .sort((a, b) => b.overallScore - a.overallScore)
                .forEach((s, i) => map.set(s.id, i + 1));
        });
        return map;
    }, [dataSource, sheikhs]);

    const groupTotalMap = useMemo(() => {
        const map = new Map<string, number>();
        sheikhs.forEach(sh => {
            map.set(sh.group, dataSource.all.filter(s => s.group === sh.group && s.totalSessionDays > 0 && (s.totalEvals > 0 || s.attendanceDays > 0)).length);
        });
        return map;
    }, [dataSource, sheikhs]);

    if (active.length === 0) {
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-1 bg-card border rounded-xl px-3 py-2">
                    {(['week', 'month'] as const).map(m => (
                        <button key={m} onClick={() => setStarsMode(m)} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", starsMode === m ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted")}>
                            {m === 'week' ? '📆 الأسبوع' : '🗓 الشهر'}
                        </button>
                    ))}
                </div>
                <div className="text-center py-20 text-muted-foreground space-y-3">
                    <Sparkles className="h-12 w-12 text-amber-300 mx-auto animate-pulse" />
                    <div className="font-bold text-lg">لا توجد بيانات {starsMode === 'month' ? 'لهذا الشهر' : 'لهذا الأسبوع'}</div>
                    <p className="text-sm">جرّب التنقل إلى {starsMode === 'month' ? 'شهر' : 'أسبوع'} آخر يحتوي على حصص مسجلة</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5">

            {/* ── Mode toggle + Group filter ── */}
            <div className="flex flex-wrap items-center gap-2 bg-card border rounded-xl px-3 py-2">
                <div className="flex items-center gap-1 border-l pl-3 ml-1">
                    {(['week', 'month'] as const).map(m => (
                        <button key={m} onClick={() => setStarsMode(m)} className={cn("px-3 py-1.5 rounded-lg text-xs font-bold transition-all", starsMode === m ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:bg-muted")}>
                            {m === 'week' ? '📆 الأسبوع' : '🗓 الشهر'}
                        </button>
                    ))}
                </div>
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                    aria-label="تصفية حسب الفوج"
                    value={groupFilter}
                    onChange={e => setGroupFilter(e.target.value)}
                    className="text-xs border rounded-lg px-3 py-1.5 bg-background font-bold"
                    dir="rtl"
                >
                    <option value="all">🏫 جميع الأفواج</option>
                    {sheikhs.map(sh => <option key={sh.group} value={sh.group}>{sh.group} — {sh.displayName}</option>)}
                </select>
                <span className="text-[10px] text-muted-foreground mr-auto">{active.length} طالب نشط</span>
            </div>

            {/* ── Hero Cards (top 3 categories) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 🏆 Champion of Attendance */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-4 shadow-lg shadow-amber-100/50 group hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-2 left-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">🏆</div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-xl bg-amber-100 border border-amber-200">
                            <Trophy className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">بطل الحضور</div>
                            <div className="text-[9px] text-muted-foreground">أعلى نسبة حضور</div>
                        </div>
                    </div>
                    {topAttendance[0] ? (
                        <div className="space-y-1">
                            <div className="font-black text-base text-amber-900 leading-tight truncate">{topAttendance[0].name}</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-amber-200/60 text-amber-800 px-2 py-0.5 rounded-lg font-bold">{topAttendance[0].attendanceRate}%</span>
                                <span className="text-[10px] text-muted-foreground">{topAttendance[0].attendanceDays}/{topAttendance[0].totalSessionDays} أيام</span>
                            </div>
                            <div className="text-[10px] text-amber-700/60">{topAttendance[0].group}</div>
                        </div>
                    ) : <div className="text-xs text-muted-foreground">لا بيانات</div>}
                </div>

                {/* ⭐ Champion of Memorization */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 p-4 shadow-lg shadow-emerald-100/50 group hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-2 left-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">⭐</div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-200">
                            <Star className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">بطل الحفظ</div>
                            <div className="text-[9px] text-muted-foreground">أكثر تقييم ممتاز</div>
                        </div>
                    </div>
                    {topExcellent[0] ? (
                        <div className="space-y-1">
                            <div className="font-black text-base text-emerald-900 leading-tight truncate">{topExcellent[0].name}</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-lg font-bold">{topExcellent[0].excellent} ممتاز</span>
                                {topExcellent[0].goodPlus > 0 && <span className="text-[10px] text-green-600">+{topExcellent[0].goodPlus} ج.جداً</span>}
                            </div>
                            <div className="text-[10px] text-emerald-700/60">{topExcellent[0].group}</div>
                        </div>
                    ) : <div className="text-xs text-muted-foreground">لا بيانات</div>}
                </div>

                {/* 🎯 Top Overall */}
                <div className="relative overflow-hidden rounded-2xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 p-4 shadow-lg shadow-purple-100/50 group hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-2 left-2 text-4xl opacity-10 group-hover:opacity-20 transition-opacity">🎯</div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-xl bg-purple-100 border border-purple-200">
                            <Crown className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                            <div className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">المتفوق الشامل</div>
                            <div className="text-[9px] text-muted-foreground">أعلى نقاط (حضور + حفظ)</div>
                        </div>
                    </div>
                    {overallRanked[0] ? (
                        <div className="space-y-1">
                            <div className="font-black text-base text-purple-900 leading-tight truncate">{overallRanked[0].name}</div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-purple-200/60 text-purple-800 px-2 py-0.5 rounded-lg font-bold">{overallRanked[0].overallScore} نقطة</span>
                                <span className="text-[10px] text-muted-foreground">{overallRanked[0].attendanceRate}% حضور</span>
                            </div>
                            <div className="text-[10px] text-purple-700/60">{overallRanked[0].group}</div>
                        </div>
                    ) : <div className="text-xs text-muted-foreground">لا بيانات</div>}
                </div>
            </div>

            {/* ── Charts Row ── */}
            <div className="grid md:grid-cols-2 gap-4 print:hidden">
                {/* Bar chart: Top 8 overall */}
                <div className="border rounded-xl p-4 bg-white shadow-sm">
                    <h3 className="text-sm font-bold mb-3 text-center flex items-center justify-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        أفضل 8 طلاب — النقاط الإجمالية
                    </h3>
                    <div className="h-56 w-full">
                        {barData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={barData} margin={{ top: 15, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" />
                                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                                    <RechartsTooltip
                                        formatter={(value: number, name: string) => [`${value}%`, name === 'attendance' ? 'حضور' : name === 'eval' ? 'تقييم' : 'إجمالي']}
                                        contentStyle={{ direction: 'rtl', borderRadius: '12px', fontSize: '11px' }}
                                    />
                                    <Bar dataKey="score" name="إجمالي" fill="#8b5cf6" radius={[6, 6, 0, 0]} barSize={24}>
                                        {barData.map((_, i) => (
                                            <Cell key={i} fill={i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : '#8b5cf6'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">لا بيانات كافية</div>
                        )}
                    </div>
                </div>

                {/* Pie chart: Eval distribution */}
                <div className="border rounded-xl p-4 bg-white shadow-sm">
                    <h3 className="text-sm font-bold mb-3 text-center flex items-center justify-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" />
                        توزيع التقييمات — {groupFilter === 'all' ? 'كل الأفواج' : groupFilter}
                    </h3>
                    <div className="h-56 w-full">
                        {evalDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={evalDistribution}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={75}
                                        label={({ name, value }) => `${name} (${value})`}
                                    >
                                        {evalDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value: number, name: string) => [value, name]}
                                        contentStyle={{ direction: 'rtl', borderRadius: '12px', fontSize: '11px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">لا تقييمات مسجلة</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Top Students Ranking Table ── */}
            <div className="border rounded-2xl overflow-hidden shadow-lg bg-white">
                <div className="bg-gradient-to-l from-amber-50 via-yellow-50 to-orange-50 border-b p-3 flex items-center justify-between">
                    <h2 className="text-sm font-black flex items-center gap-2">
                        <Award className="h-5 w-5 text-amber-500" />
                        ترتيب نجوم {starsMode === 'month' ? 'الشهر' : 'الأسبوع'}
                    </h2>
                    <span className="text-[10px] text-muted-foreground bg-white/70 px-2 py-0.5 rounded-full border">{groupFilter === 'all' ? 'كل الأفواج' : groupFilter}</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50 border-b text-[10px]">
                                <th className="sticky right-0 z-20 bg-slate-50 p-2 border-l text-right min-w-[40px] font-bold">#</th>
                                <th className="p-2 border-l text-right min-w-[130px] font-bold">الطالب</th>
                                <th className="p-2 border-l text-center min-w-[70px] font-bold">الفوج</th>
                                <th className="p-2 border-l text-center min-w-[55px] font-bold text-amber-700">حضور%</th>
                                <th className="p-2 border-l text-center min-w-[40px] font-bold text-orange-600">تأخر</th>
                                <th className="p-2 border-l text-center min-w-[45px] font-bold text-emerald-700">ممتاز</th>
                                <th className="p-2 border-l text-center min-w-[45px] font-bold text-green-600">ج.جداً</th>
                                <th className="p-2 border-l text-center min-w-[40px] font-bold text-blue-600">جيد</th>
                                <th className="p-2 border-l text-center min-w-[40px] font-bold text-rose-600">ضعيف</th>
                                <th className="p-2 border-l text-center min-w-[50px] font-bold text-teal-700">السلوك</th>
                                <th className="p-2 border-l text-center min-w-[55px] font-bold">متوسط التقييم</th>
                                <th className="p-2 text-center min-w-[55px] font-bold text-purple-700">النقاط</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overallRanked.slice(rankingPage * RANKING_PAGE_SIZE, (rankingPage + 1) * RANKING_PAGE_SIZE).map((s, idx) => {
                                const globalRank = rankingPage * RANKING_PAGE_SIZE + idx;
                                return (
                                    <tr key={s.id}
                                        className={cn(
                                            "border-b hover:bg-amber-50/50 transition-colors cursor-pointer",
                                            globalRank === 0 ? "bg-amber-50/40" : globalRank === 1 ? "bg-slate-50/40" : globalRank === 2 ? "bg-orange-50/30" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                                        )}
                                        onClick={() => setSelectedStudentDetail(s)}
                                        title="انقر لرؤية تفصيل النقاط"
                                    >
                                        <td className={cn("sticky right-0 z-10 p-2 border-l text-center font-black text-sm",
                                            globalRank === 0 ? "bg-amber-50/40" : globalRank === 1 ? "bg-slate-50/40" : globalRank === 2 ? "bg-orange-50/30" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                                        )}>
                                            {medalEmoji(globalRank)}
                                        </td>
                                        <td className="p-2 border-l">
                                            <div className="font-bold text-[11px] leading-tight">{s.name}</div>
                                            <div className="flex gap-2 mt-0.5">
                                                <span className="text-[9px] text-indigo-600 font-bold">#{overallRankMap.get(s.id) ?? '—'} عاماً</span>
                                                <span className="text-[9px] text-amber-600 font-bold">#{groupRankMap.get(s.id) ?? '—'} في فوجه</span>
                                            </div>
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            <span className="text-[10px] bg-muted/40 px-1.5 py-0.5 rounded-md font-medium">{s.group}</span>
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            <span className={cn("font-bold", s.attendanceRate >= 90 ? "text-emerald-700" : s.attendanceRate >= 70 ? "text-amber-600" : "text-rose-600")}>
                                                {s.attendanceRate}%
                                            </span>
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            {s.lateDays > 0 ? <span className="text-orange-600 font-bold">{s.lateDays}</span> : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            {s.excellent > 0 ? <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{s.excellent}</span> : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            {s.goodPlus > 0 ? <span className="font-bold text-green-600">{s.goodPlus}</span> : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            {s.good > 0 ? <span className="text-blue-600 font-medium">{s.good}</span> : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            {s.weak > 0 ? <span className="text-rose-600">{s.weak}</span> : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            {s.totalBehaviorEvals > 0 ? (
                                                <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                                    s.behaviorCalm >= s.behaviorOk && s.behaviorCalm >= s.behaviorBad ? "bg-teal-50 text-teal-700" :
                                                        s.behaviorBad > 0 ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                                                )}>
                                                    {s.behaviorCalm > 0 && `${s.behaviorCalm}هـ`}
                                                    {s.behaviorOk > 0 && ` ${s.behaviorOk}مق`}
                                                    {s.behaviorBad > 0 && ` ${s.behaviorBad}مش`}
                                                </span>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-2 border-l text-center">
                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                s.avgEvalScore >= 5 ? "bg-emerald-100 text-emerald-700" :
                                                    s.avgEvalScore >= 3 ? "bg-blue-100 text-blue-700" :
                                                        s.avgEvalScore >= 1 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                                            )}>{s.avgEvalScore.toFixed(1)}</span>
                                        </td>
                                        <td className="p-2 text-center">
                                            <span className="font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg">{s.overallScore}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {overallRanked.length === 0 && (
                                <tr><td colSpan={13} className="p-8 text-center text-muted-foreground">لا توجد بيانات كافية {starsMode === 'month' ? 'لهذا الشهر' : 'لهذا الأسبوع'}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination for ranking table */}
                {overallRanked.length > RANKING_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t bg-muted/20">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => setRankingPage(p => Math.max(0, p - 1))}
                            disabled={rankingPage === 0}>
                            <ChevronRight className="h-3.5 w-3.5" /> السابق
                        </Button>
                        <span className="text-xs text-muted-foreground font-medium">
                            {rankingPage * RANKING_PAGE_SIZE + 1}–{Math.min((rankingPage + 1) * RANKING_PAGE_SIZE, overallRanked.length)} من {overallRanked.length} طالب
                        </span>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                            onClick={() => setRankingPage(p => p + 1)}
                            disabled={(rankingPage + 1) * RANKING_PAGE_SIZE >= overallRanked.length}>
                            التالي <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Group Champions Table ── */}
            <div className="border rounded-2xl overflow-hidden shadow-lg bg-white">
                <div className="bg-gradient-to-l from-indigo-50 via-blue-50 to-cyan-50 border-b p-3 flex items-center gap-2">
                    <Medal className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-sm font-black">أبطال الأفواج</h2>
                    <span className="text-[10px] text-muted-foreground mr-auto">أفضل 3 طلاب في كل فوج</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {groupChampions.map(gc => (
                        <div key={gc.group} className={cn(
                            "rounded-xl border p-3 space-y-2 transition-all hover:shadow-md",
                            gc.top3.length > 0 ? "bg-gradient-to-br from-white to-indigo-50/30 border-indigo-100" : "bg-muted/20 border-dashed"
                        )}>
                            <div className="flex items-center justify-between">
                                <div className="font-bold text-xs text-indigo-700">{gc.group}</div>
                                <div className="text-[9px] text-muted-foreground truncate max-w-[100px]">{gc.displayName}</div>
                            </div>
                            {gc.top3.length > 0 ? (
                                <div className="space-y-1.5">
                                    {gc.top3.map((ch, i) => (
                                        <div key={ch.id} className={cn("flex items-start gap-2 rounded-lg p-1.5", i === 0 ? "bg-amber-50/50" : "bg-slate-50/50")}>
                                            <span className="text-sm font-black mt-0.5">{medalEmoji(i)}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-[11px] leading-tight truncate">{ch.name}</div>
                                                <div className="flex flex-wrap gap-1 mt-0.5">
                                                    <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold">{ch.attendanceRate}%</span>
                                                    {ch.excellent > 0 && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded">{ch.excellent}ممتاز</span>}
                                                    {ch.lateDays > 0 && <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded">{ch.lateDays}تأخر</span>}
                                                    {ch.behaviorBad > 0 && <span className="text-[9px] bg-rose-100 text-rose-600 px-1 py-0.5 rounded">{ch.behaviorBad}مش</span>}
                                                    <span className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded font-black">{ch.overallScore}نقطة</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-muted-foreground py-2 text-center">لا بيانات</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Per-Group Detailed Breakdown ── */}
            <div className="border rounded-2xl overflow-hidden shadow-lg bg-white">
                <div className="bg-gradient-to-l from-violet-50 via-purple-50 to-indigo-50 border-b p-3 flex items-center gap-2">
                    <Users className="h-5 w-5 text-violet-500" />
                    <h2 className="text-sm font-black">تفصيل كل فوج</h2>
                    <span className="text-[10px] text-muted-foreground mr-auto">أفضل 5 طلاب لكل فوج</span>
                </div>
                <div className="p-3 space-y-3">
                    {sheikhs.map(sh => {
                        const grpStudents = [...dataSource.all]
                            .filter(s => s.group === sh.group && s.totalSessionDays > 0)
                            .sort((a, b) => b.overallScore - a.overallScore)
                            .slice(0, 5);
                        return (
                            <div key={sh.group} className="border rounded-xl overflow-hidden">
                                <div className="bg-gradient-to-l from-slate-100 to-slate-50 px-3 py-2 flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-700">{sh.group}</span>
                                    <span className="text-[9px] text-muted-foreground">{sh.displayName}</span>
                                </div>
                                {grpStudents.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-[10px] border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50/50 border-b">
                                                    <th className="p-1.5 text-right font-bold min-w-[30px]">#</th>
                                                    <th className="p-1.5 text-right font-bold min-w-[100px]">الطالب</th>
                                                    <th className="p-1.5 text-center font-bold">حضور%</th>
                                                    <th className="p-1.5 text-center font-bold">م.التقييم</th>
                                                    <th className="p-1.5 text-center font-bold">السلوك</th>
                                                    <th className="p-1.5 text-center font-bold">تأخر</th>
                                                    <th className="p-1.5 text-center font-bold text-purple-700">النقاط</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {grpStudents.map((s, i) => (
                                                    <tr key={s.id} className={cn("border-b", i === 0 ? "bg-amber-50/30" : i % 2 === 0 ? "bg-white" : "bg-slate-50/20")}>
                                                        <td className="p-1.5 text-center font-black">{medalEmoji(i)}</td>
                                                        <td className="p-1.5 font-bold truncate max-w-[120px]">{s.name}</td>
                                                        <td className="p-1.5 text-center">
                                                            <span className={cn("font-bold", s.attendanceRate >= 90 ? "text-emerald-700" : s.attendanceRate >= 70 ? "text-amber-600" : "text-rose-600")}>{s.attendanceRate}%</span>
                                                        </td>
                                                        <td className="p-1.5 text-center">
                                                            <span className={cn("font-bold", s.avgEvalScore >= 5 ? "text-emerald-700" : s.avgEvalScore >= 3 ? "text-blue-600" : "text-amber-600")}>{s.avgEvalScore.toFixed(1)}</span>
                                                        </td>
                                                        <td className="p-1.5 text-center">
                                                            {s.totalBehaviorEvals > 0 ? (
                                                                <span className={cn("font-bold", s.avgBehaviorScore >= 1.5 ? "text-teal-700" : s.avgBehaviorScore >= 0 ? "text-amber-600" : "text-rose-600")}>{s.avgBehaviorScore.toFixed(1)}</span>
                                                            ) : <span className="text-muted-foreground/30">—</span>}
                                                        </td>
                                                        <td className="p-1.5 text-center">
                                                            {s.lateDays > 0 ? <span className="text-orange-600 font-bold">{s.lateDays}</span> : <span className="text-muted-foreground/30">—</span>}
                                                        </td>
                                                        <td className="p-1.5 text-center">
                                                            <span className="font-black text-purple-700">{s.overallScore}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="p-3 text-center text-muted-foreground text-xs">لا بيانات</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Attendance Top 5 & Memorization Top 5 side-by-side ── */}
            <div className="grid md:grid-cols-2 gap-4">
                {/* Top 5 Attendance */}
                <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                    <div className="bg-gradient-to-l from-amber-50 to-yellow-50 border-b p-2.5 flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-bold">أعلى 5 طلاب حضوراً</span>
                    </div>
                    <div className="divide-y">
                        {topAttendance.slice(0, 5).map((s, i) => (
                            <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-amber-50/20 transition-colors">
                                <span className="font-black text-sm w-6 text-center">{medalEmoji(i)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-[11px] truncate">{s.name}</div>
                                    <div className="text-[9px] text-muted-foreground">{s.group}</div>
                                </div>
                                <div className="text-left">
                                    <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg", s.attendanceRate >= 90 ? "bg-emerald-100 text-emerald-700" : s.attendanceRate >= 70 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700")}>
                                        {s.attendanceRate}%
                                    </span>
                                    <div className="text-[9px] text-muted-foreground text-center mt-0.5">{s.attendanceDays}/{s.totalSessionDays}</div>
                                </div>
                            </div>
                        ))}
                        {topAttendance.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">لا بيانات</div>}
                    </div>
                </div>

                {/* Top 5 Memorization */}
                <div className="border rounded-xl overflow-hidden shadow-sm bg-white">
                    <div className="bg-gradient-to-l from-emerald-50 to-green-50 border-b p-2.5 flex items-center gap-2">
                        <Star className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs font-bold">أعلى 5 طلاب حفظاً (ممتاز)</span>
                    </div>
                    <div className="divide-y">
                        {topExcellent.slice(0, 5).map((s, i) => (
                            <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-emerald-50/20 transition-colors">
                                <span className="font-black text-sm w-6 text-center">{medalEmoji(i)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-[11px] truncate">{s.name}</div>
                                    <div className="text-[9px] text-muted-foreground">{s.group}</div>
                                </div>
                                <div className="text-left">
                                    <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg">{s.excellent} ممتاز</span>
                                    {s.goodPlus > 0 && <div className="text-[9px] text-green-600 text-center mt-0.5">+{s.goodPlus} ج.جداً</div>}
                                </div>
                            </div>
                        ))}
                        {topExcellent.length === 0 && <div className="p-4 text-center text-muted-foreground text-xs">لا بيانات</div>}
                    </div>
                </div>
            </div>

            {/* ── Scoring Explanation ── */}
            <div className="border rounded-xl p-4 bg-gradient-to-br from-slate-50 to-white shadow-sm space-y-2">
                <h3 className="text-xs font-black flex items-center gap-2 text-slate-700">
                    📊 آلية التنقيط (حد أقصى ≈ 90 نقطة)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px] border-collapse" dir="rtl">
                        <thead>
                            <tr className="border-b bg-slate-100/50">
                                <th className="p-1.5 text-right font-bold">المعيار</th>
                                <th className="p-1.5 text-center font-bold">النقاط</th>
                                <th className="p-1.5 text-right font-bold">التفصيل</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="p-1.5 font-bold text-amber-700">🎯 الحضور</td>
                                <td className="p-1.5 text-center font-black">40</td>
                                <td className="p-1.5 text-muted-foreground">(أيام الحضور ÷ إجمالي الحصص) × 40 — عادل بين الأفواج (نسبة)</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-1.5 font-bold text-emerald-700">📖 التقييم</td>
                                <td className="p-1.5 text-center font-black">40</td>
                                <td className="p-1.5 text-muted-foreground">ج.جداً=6 · ممتاز=5 · جيد=3 · مقبول=2 · ضعيف=1 · لم يحفظ=0 ← المتوسط÷6×40</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-1.5 font-bold text-teal-700">🤝 السلوك</td>
                                <td className="p-1.5 text-center font-black">×5</td>
                                <td className="p-1.5 text-muted-foreground">هادئ=2 · مقبول=1 · مشاغب=-1 · لم يسجل=0 ← المتوسط × 5</td>
                            </tr>
                            <tr className="bg-rose-50/30">
                                <td className="p-1.5 font-bold text-rose-600">⏰ خصم التأخر</td>
                                <td className="p-1.5 text-center font-black text-rose-600">-2</td>
                                <td className="p-1.5 text-muted-foreground">-2 نقطة لكل تأخر — الغياب يكلف أكثر (ينقص من نسبة الحضور + يفقد تقييمات)</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="text-[9px] text-muted-foreground/70 text-center">
                    هـ = هادئ &nbsp;|&nbsp; مق = مقبول &nbsp;|&nbsp; مش = مشاغب &nbsp;|&nbsp; الغياب يخصم من نسبة الحضور ويفقد الطالب فرصة التقييم
                </p>
            </div>

            {/* ── Student Score Detail Modal ── */}
            {selectedStudentDetail && (
                <StudentScoreDetailModal
                    student={selectedStudentDetail}
                    dailySessions={dailySessions}
                    sheikhs={sheikhs}
                    groupRank={groupRankMap.get(selectedStudentDetail.id) ?? 0}
                    overallRank={overallRankMap.get(selectedStudentDetail.id) ?? 0}
                    groupTotal={groupTotalMap.get(selectedStudentDetail.group) ?? 0}
                    overallTotal={allActiveRanked.length}
                    periodStart={starsMode === 'month' && monthlyData ? startOfMonth(selectedDate) : stats.weekStart}
                    periodEnd={starsMode === 'month' && monthlyData ? endOfMonth(selectedDate) : stats.weekEnd}
                    periodLabel={dataSource.weekLabel}
                    onClose={() => setSelectedStudentDetail(null)}
                />
            )}
        </div>
    );
}


// ─── StudentScoreDetailModal ──────────────────────────────────────────────────
function StudentScoreDetailModal({
    student, dailySessions, sheikhs, groupRank, overallRank, groupTotal, overallTotal,
    periodStart, periodEnd, periodLabel, onClose
}: {
    student: TopStudentEntry;
    dailySessions: any;
    sheikhs: GroupSheikhInfo[];
    groupRank: number;
    overallRank: number;
    groupTotal: number;
    overallTotal: number;
    periodStart: Date;
    periodEnd: Date;
    periodLabel: string;
    onClose: () => void;
}) {
    type DayRec = {
        date: string; label: string; sessionType: string;
        attendance: string; memorization: string | null;
        behavior: string | null; isReview: boolean;
        evalGrade: number; behaviorGrade: number; isLate: boolean;
    };

    const dayRecords = useMemo<DayRec[]>(() => {
        const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
        const recs: DayRec[] = [];
        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySess = (dailySessions as any)?.[dateStr];
            if (!daySess) return;
            let processed = false;
            Object.values(daySess as Record<string, any>).forEach((session: any) => {
                if (!session || processed) return;
                const sType = session.sessionType;
                const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                if (!isReal) return;
                const shOwner = sheikhs.find(sh => sh.uids.has(session.ownerId));
                if (!shOwner || shOwner.group !== student.group) return;
                processed = true;
                const sessionRecs: any[] = Array.isArray(session.records) ? session.records : session.records ? Object.values(session.records) : [];
                const myRec = sessionRecs.find((r: any) => r.studentId === student.id);
                const mem = myRec?.memorization || null;
                const beh = myRec?.behavior || null;
                const isReview = !!myRec?.review;
                let evalGrade = 0;
                if (myRec && !isReview && mem) {
                    if (mem === 'ممتاز') evalGrade = 5;
                    else if (mem === 'جيد جدا' || mem === 'جيد جداً') evalGrade = 6;
                    else if (mem === 'جيد') evalGrade = 3;
                    else if (mem === 'مقبول' || mem === 'حسن') evalGrade = 2;
                    else if (mem === 'ضعيف' || mem === 'متوسط') evalGrade = 1;
                }
                let behaviorGrade = 0;
                if (beh === 'هادئ') behaviorGrade = 2;
                else if (beh === 'مقبول') behaviorGrade = 1;
                else if (beh === 'مشاغب' || beh === 'غير منضبط') behaviorGrade = -1;
                recs.push({
                    date: dateStr,
                    label: format(day, 'EEE d MMM', { locale: ar }),
                    sessionType: sType,
                    attendance: myRec?.attendance || 'غائب',
                    memorization: isReview ? `مراجعة: ${mem || ''}` : mem,
                    behavior: beh,
                    isReview, evalGrade, behaviorGrade,
                    isLate: myRec?.attendance === 'متأخر',
                });
            });
        });
        return recs.sort((a, b) => a.date.localeCompare(b.date));
    }, [student, dailySessions, sheikhs, periodStart, periodEnd]);

    const attended = dayRecords.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض');
    const totalSess = dayRecords.length;
    const lateDays = dayRecords.filter(r => r.isLate).length;
    const evalRecs = dayRecords.filter(r => !r.isReview && r.memorization && r.attendance !== 'غائب' && r.attendance !== 'غياب');
    const avgEval = evalRecs.length > 0 ? evalRecs.reduce((s, r) => s + r.evalGrade, 0) / evalRecs.length : 0;
    const behRecs = dayRecords.filter(r => r.behavior);
    const avgBeh = behRecs.length > 0 ? behRecs.reduce((s, r) => s + r.behaviorGrade, 0) / behRecs.length : 0;
    const attPts = totalSess > 0 ? (attended.length / totalSess) * 40 : 0;
    const evalPts = evalRecs.length > 0 ? (avgEval / 6) * 40 : 0;
    const behPts = avgBeh * 5;
    const latePenalty = lateDays * 2;
    const score = Math.max(0, Math.round(attPts + evalPts + behPts - latePenalty));

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-gradient-to-l from-purple-600 to-indigo-600 text-white p-4 flex items-start justify-between shrink-0">
                    <div>
                        <div className="font-black text-lg leading-tight">{student.name}</div>
                        <div className="text-purple-200 text-sm mt-0.5">{student.group} · {periodLabel}</div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                            <span className="bg-white/20 text-white px-2 py-0.5 rounded-lg text-xs font-bold">🏆 {groupRank}/{groupTotal} في فوجه</span>
                            <span className="bg-white/20 text-white px-2 py-0.5 rounded-lg text-xs font-bold">🌍 {overallRank}/{overallTotal} عاماً</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white text-2xl font-bold leading-none mt-1">×</button>
                </div>
                {/* Score breakdown */}
                <div className="grid grid-cols-4 gap-0 border-b shrink-0 divide-x divide-border">
                    {[
                        { label: 'الحضور', val: `${attended.length}/${totalSess}`, pts: Math.round(attPts), max: 40, color: 'text-amber-700' },
                        { label: 'التقييم', val: avgEval.toFixed(1) + '/6', pts: Math.round(evalPts), max: 40, color: 'text-emerald-700' },
                        { label: 'السلوك', val: avgBeh.toFixed(1), pts: Math.round(behPts), max: null, color: 'text-teal-700' },
                        { label: 'الإجمالي', val: score.toString(), pts: latePenalty > 0 ? -latePenalty : null, max: null, color: 'text-purple-700' },
                    ].map(c => (
                        <div key={c.label} className="text-center py-2.5 px-1">
                            <div className="text-[10px] text-muted-foreground mb-0.5">{c.label}</div>
                            <div className={cn('font-black text-base leading-none', c.color)}>{c.val}</div>
                            <div className="text-[9px] text-muted-foreground mt-0.5">
                                {c.pts !== null ? (c.max ? `${c.pts}/${c.max} نقطة` : (c.pts < 0 ? `${c.pts} تأخر` : `${c.pts} نقطة`)) : ''}
                            </div>
                        </div>
                    ))}
                </div>
                {/* Day table */}
                <div className="overflow-y-auto flex-1 text-xs">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10 border-b">
                            <tr>
                                <th className="p-2 text-right font-bold">اليوم</th>
                                <th className="p-2 text-center font-bold">الحصة</th>
                                <th className="p-2 text-center font-bold">الحضور</th>
                                <th className="p-2 text-center font-bold">التقييم</th>
                                <th className="p-2 text-center font-bold">السلوك</th>
                                <th className="p-2 text-center font-bold text-purple-700">نقاط</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dayRecords.map((rec, i) => {
                                const isAbsent = rec.attendance === 'غائب' || rec.attendance === 'غياب';
                                const isPresent = rec.attendance === 'حاضر' || rec.attendance === 'تعويض' || rec.attendance === 'متأخر';
                                // Approximate per-day contribution
                                const dayAtt = isPresent ? (totalSess > 0 ? 40 / totalSess : 0) : 0;
                                const dayEval = !rec.isReview && isPresent && evalRecs.length > 0 ? (rec.evalGrade / 6) * (40 / evalRecs.length) : 0;
                                const dayBeh = rec.behavior && behRecs.length > 0 ? rec.behaviorGrade * (5 / behRecs.length) : 0;
                                const dayLate = rec.isLate ? 2 : 0;
                                const dayTotal = Math.round(dayAtt + dayEval + dayBeh - dayLate);
                                return (
                                    <tr key={rec.date + i} className={cn('border-b', isAbsent ? 'bg-rose-50/40' : rec.isLate ? 'bg-amber-50/30' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/20')}>
                                        <td className="p-1.5 font-medium whitespace-nowrap">{rec.label}</td>
                                        <td className="p-1.5 text-center">
                                            <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold', TYPE_CONFIG[rec.sessionType]?.bg || 'bg-muted/30', TYPE_CONFIG[rec.sessionType]?.text || '')}>
                                                {TYPE_CONFIG[rec.sessionType]?.label || rec.sessionType}
                                            </span>
                                        </td>
                                        <td className="p-1.5 text-center">
                                            <span className={cn('font-bold', isAbsent ? 'text-rose-600' : rec.isLate ? 'text-amber-600' : 'text-emerald-700')}>{rec.attendance}</span>
                                        </td>
                                        <td className="p-1.5 text-center">
                                            {rec.memorization ? (
                                                <span className={cn('font-bold', rec.evalGrade >= 5 ? 'text-emerald-700' : rec.evalGrade >= 3 ? 'text-blue-600' : rec.evalGrade >= 1 ? 'text-amber-600' : 'text-gray-400')}>
                                                    {rec.memorization}{!rec.isReview && <span className="text-[9px] text-muted-foreground ml-0.5">({rec.evalGrade})</span>}
                                                </span>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-1.5 text-center">
                                            {rec.behavior ? (
                                                <span className={cn('font-bold', rec.behaviorGrade >= 2 ? 'text-teal-700' : rec.behaviorGrade > 0 ? 'text-blue-600' : rec.behaviorGrade < 0 ? 'text-rose-600' : 'text-gray-400')}>
                                                    {rec.behavior}<span className="text-[9px] ml-0.5">({rec.behaviorGrade > 0 ? '+' : ''}{rec.behaviorGrade})</span>
                                                </span>
                                            ) : <span className="text-muted-foreground/30">—</span>}
                                        </td>
                                        <td className="p-1.5 text-center">
                                            <span className={cn('font-black', dayTotal > 0 ? 'text-purple-700' : dayTotal < 0 ? 'text-rose-600' : 'text-gray-300')}>
                                                {dayTotal > 0 ? `+${dayTotal}` : dayTotal || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {dayRecords.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد حصص مسجلة في هذه الفترة</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Footer */}
                <div className="p-3 border-t bg-slate-50 flex items-center justify-between shrink-0 gap-2">
                    <div className="text-[10px] text-muted-foreground flex-1">
                        الإجمالي = حضور ({Math.round(attPts)}) + تقييم ({Math.round(evalPts)}) + سلوك ({Math.round(behPts)}) − تأخر ({latePenalty}) = <span className="font-black text-purple-700">{score} نقطة</span>
                    </div>
                    <button onClick={onClose} className="text-xs px-4 py-1.5 bg-primary text-white rounded-lg font-bold shrink-0">إغلاق</button>
                </div>
            </div>
        </div>
    );
}
