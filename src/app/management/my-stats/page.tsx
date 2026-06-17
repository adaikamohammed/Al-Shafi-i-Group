"use client";

import React, { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { cn } from '@/lib/utils';
import {
    Activity, Calendar, Award, Star, Shield, Users,
    ChevronLeft, ChevronRight, FileDown, AlertTriangle, Target,
    BarChart2, Flame, TrendingUp, TrendingDown, Minus,
    BookOpen, CheckCircle2, X, Eye, Clock, XCircle, UserCheck,
    Trophy, Zap
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import {
    format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
    addMonths, subMonths, addDays, parseISO
} from 'date-fns';
import { ar } from 'date-fns/locale';

import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend
} from 'recharts';

import { computeAtRiskStudents } from '@/components/management/EarlyWarning';

// ─── Heavy components loaded lazily ──────────────────────────────────────────
const AttendanceHeatmap = dynamic(
    () => import('@/components/management/AttendanceHeatmap').then(m => ({ default: m.AttendanceHeatmap })),
    { ssr: false, loading: () => <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">جاري تحميل الجدول...</div> }
);
const StudentProgressChart = dynamic(
    () => import('@/components/management/StudentProgressChart').then(m => ({ default: m.StudentProgressChart })),
    { ssr: false, loading: () => <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">جاري تحميل الرسم...</div> }
);
const EarlyWarningView = dynamic(
    () => import('@/components/management/EarlyWarning').then(m => ({ default: m.EarlyWarningView })),
    { ssr: false, loading: () => <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">جاري تحميل التنبيهات...</div> }
);
const HonorCardGenerator = dynamic(
    () => import('@/components/management/HonorCardGenerator').then(m => ({ default: m.HonorCardGenerator })),
    { ssr: false, loading: () => <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">جاري تحميل البطاقات...</div> }
);
const SheikhScoreDetailModal = dynamic(
    () => import('@/components/management/SheikhBadges').then(m => ({ default: m.SheikhScoreDetailModal })),
    { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type TabId = 'overview' | 'attendance' | 'students' | 'warnings' | 'honor' | 'sheikh_eval' | 'month_comparison';


interface SessionRecord {
    studentId: string;
    name: string;
    attendance: string;
    memorization?: string;
    behavior?: string;
    review?: boolean;
}

interface DayDetailData {
    dateStr: string;
    sessionType: string;
    records: SessionRecord[];
    presentCount: number;
    absentCount: number;
    lateCount: number;
    attendanceRate: number;
    excellentCount: number;
}

interface EnrichedStudentStats {
    id: string;
    name: string;
    photoURL?: string;
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    substituteCount: number;
    attendanceRate: number;
    excellentCount: number;
    veryGoodCount: number;
    goodCount: number;
    acceptableCount: number;
    weakCount: number;
    avgScore: number;
    excellentRate: number;
    lastSessions: Array<{
        date: string;
        attendance: string;
        memorization: string;
        behavior?: string;
        score: number | null;
    }>;
    trend: 'up' | 'stable' | 'down';
    academicScore: number;
    comprehensiveScore: number;
    memorizationRate: number;
    behaviorRate: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ATTENDANCE_POINTS: Record<string, number> = {
    'حاضر': 5,
    'تعويض': 3.5,
    'متأخر': 2,
    'غائب': -10,
    'غياب': -10
};

const PERFORMANCE_POINTS: Record<string, number> = {
    'ممتاز': 10,
    'جيد جدا': 7,
    'جيد جداً': 7,
    'جيد': 5,
    'حسن': 3,
    'متوسط': 2,
    'مقبول': 2,
    'ضعيف': 1,
    'لم يحفظ': 0,
};

const BEHAVIOR_POINTS: Record<string, number> = {
    'هادئ': 10,
    'مقبول': 5,
    'متوسط': 5, // قيمة قديمة - تُحوّل إلى مقبول
    'مشاغب': 0,
    'غير منضبط': 0, // قيمة قديمة - تُحوّل إلى مشاغب
};

const EVAL_SCORE: Record<string, number> = {
    'ممتاز': 6, 'جيد جداً': 5, 'جيد جدا': 5,
    'جيد': 4, 'حسن': 3, 'مقبول': 2, 'متوسط': 2,
    'ضعيف': 1, 'لم يحفظ': 0,
};

const SESSION_TYPES = ['حصة أساسية', 'حصة تعويضية', 'حصة إضافية'];

interface ScoringWeights {
    sessionWeight: number;
    attendanceWeight: number;
    extraSessionBonus: number;
    excellentBonus: number;
    goodPlusBonus: number;
    commitmentBonus: number;
    commitmentBase: number;
    absencePenalty: number;
    punctualityBonus: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
    sessionWeight: 15,
    attendanceWeight: 12,
    extraSessionBonus: 5,
    excellentBonus: 3,
    goodPlusBonus: 1.5,
    commitmentBonus: 40,
    commitmentBase: 30,
    absencePenalty: 20,
    punctualityBonus: 5
};

interface BadgeInfo {
    icon: string;
    label: string;
    colorClass: string;
    glowClass: string;
    description: string;
}

function computeBadges(s: any): BadgeInfo[] {
    const badges: BadgeInfo[] = [];

    if (s.commitmentRate >= 100 && s.totalSessions > 0)
        badges.push({ icon: '💎', label: 'التزام الشيخ الكامل', colorClass: 'bg-cyan-100 text-cyan-800 border-cyan-300', glowClass: 'shadow-cyan-200', description: 'حضر وسجّل جميع أيام العمل المطلوبة للشيخ' });

    if (s.avgAttendance >= 95 && s.totalSessions > 0)
        badges.push({ icon: '👑', label: 'حضور طلاب الفوج (👑)', colorClass: 'bg-amber-100 text-amber-800 border-amber-300', glowClass: 'shadow-amber-200', description: 'متوسط حضور طلاب الفوج ≥ 95%' });
    else if (s.avgAttendance >= 90 && s.totalSessions > 0)
        badges.push({ icon: '⭐', label: 'حضور طلاب الفوج (⭐)', colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300', glowClass: 'shadow-yellow-200', description: 'متوسط حضور طلاب الفوج ≥ 90%' });

    if (s.avgExcellent >= 25 && s.totalSessions > 0)
        badges.push({ icon: '🌟', label: 'تميز تسميع الفوج (ممتاز)', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', glowClass: 'shadow-emerald-200', description: '25% أو أكثر من تقييمات طلاب الفوج حصلوا على ممتاز' });

    if ((s.avgExcellent + s.avgGoodPlus) >= 60 && s.totalSessions > 0)
        badges.push({ icon: '🏅', label: 'جودة الفوج العالية', colorClass: 'bg-indigo-100 text-indigo-800 border-indigo-300', glowClass: 'shadow-indigo-200', description: '60%+ من الطلاب بتقييم جيد جداً أو ممتاز بالفوج' });

    if (s.sheikhabsences === 0 && s.totalSessions > 0)
        badges.push({ icon: '🔥', label: 'صفر غياب للشيخ', colorClass: 'bg-rose-100 text-rose-800 border-rose-300', glowClass: 'shadow-rose-200', description: 'لم يغب الشيخ نفسه ولو يوماً واحداً طوال الشهر' });

    if (s.highAttDays >= 15)
        badges.push({ icon: '🎯', label: 'انضباط الفوج المرتفع', colorClass: 'bg-purple-100 text-purple-800 border-purple-300', glowClass: 'shadow-purple-200', description: '15+ يوماً بحضور طلاب الفوج فوق 90%' });

    if (s.totalSessions >= 22)
        badges.push({ icon: '📚', label: 'ثبات تسجيل الشيخ', colorClass: 'bg-blue-100 text-blue-800 border-blue-300', glowClass: 'shadow-blue-200', description: 'سجّل المعلم 22 حصة أو أكثر في الشهر' });

    return badges;
}

const isSessionPunctual = (session: any): boolean => {
    if (!session) return true;
    if (!session.createdAt) return true;
    try {
        const sessionDate = new Date(session.date);
        const createdDate = new Date(session.createdAt);
        const diffMs = createdDate.getTime() - sessionDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours <= 36;
    } catch (e) {
        return true;
    }
};

const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview',   label: 'الملخص',       icon: <BarChart2 className="h-4 w-4" /> },
    { id: 'attendance', label: 'الحضور',       icon: <Calendar className="h-4 w-4" /> },
    { id: 'students',   label: 'الطلاب',       icon: <Users className="h-4 w-4" /> },
    { id: 'sheikh_eval', label: 'تقييم المعلم', icon: <Trophy className="h-4 w-4" /> },
    { id: 'month_comparison', label: 'مقارنة الأشهر وذروة الأداء', icon: <TrendingUp className="h-4 w-4" /> },
    { id: 'warnings',   label: 'التنبيهات',    icon: <AlertTriangle className="h-4 w-4" /> },
    { id: 'honor',      label: 'بطاقات الشرف', icon: <Award className="h-4 w-4" /> },
];

// ─── Memorization badge helper ─────────────────────────────────────────────────
function MemBadge({ mem, review }: { mem?: string; review?: boolean }) {
    if (review) return <span className="text-[9px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded-full font-bold">مراجعة</span>;
    if (!mem) return null;
    const cls: Record<string, string> = {
        'ممتاز': 'bg-emerald-100 text-emerald-700',
        'جيد جداً': 'bg-green-100 text-green-700',
        'جيد جدا': 'bg-green-100 text-green-700',
        'جيد': 'bg-lime-100 text-lime-700',
        'مقبول': 'bg-amber-100 text-amber-700',
        'متوسط': 'bg-amber-100 text-amber-700',
        'حسن': 'bg-amber-100 text-amber-700',
        'ضعيف': 'bg-orange-100 text-orange-700',
        'لم يحفظ': 'bg-rose-100 text-rose-700',
    };
    return <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold', cls[mem] || 'bg-muted text-muted-foreground')}>{mem}</span>;
}

function BehaviorEmoji({ beh }: { beh?: string }) {
    if (!beh) return null;
    const map: Record<string, string> = { 'هادئ': '😊', 'مقبول': '😐', 'متوسط': '😐', 'مشاغب': '😠', 'غير منضبط': '😠' };
    return <span className="text-sm" title={beh}>{map[beh] || ''}</span>;
}

// ─── Day Attendance Modal ──────────────────────────────────────────────────────
function DayAttendanceModal({ data, onClose }: { data: DayDetailData; onClose: () => void }) {
    const present   = data.records.filter(r => r.attendance === 'حاضر');
    const late      = data.records.filter(r => r.attendance === 'متأخر' || r.attendance === 'تعويض');
    const absent    = data.records.filter(r => r.attendance === 'غائب' || !r.attendance || (r.attendance !== 'حاضر' && r.attendance !== 'متأخر' && r.attendance !== 'تعويض'));
    const attColor  = data.attendanceRate >= 90 ? '#059669' : data.attendanceRate >= 70 ? '#d97706' : '#dc2626';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
            <div
                className="bg-card border rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-4 flex items-start justify-between rounded-t-3xl flex-shrink-0">
                    <div>
                        <div className="font-black text-base">
                            {format(parseISO(data.dateStr), 'EEEE، d MMMM yyyy', { locale: ar })}
                        </div>
                        <div className="text-white/70 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="bg-white/20 px-2 py-0.5 rounded-full">{data.sessionType}</span>
                            <span>{data.records.length} طالب مسجَّل</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-center">
                            <div className="text-2xl font-black" style={{ color: data.attendanceRate >= 70 ? '#86efac' : '#fca5a5' }}>
                                {data.attendanceRate}%
                            </div>
                            <div className="text-[10px] text-white/60">الحضور</div>
                        </div>
                        <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Summary bar */}
                <div className="px-5 py-3 border-b bg-muted/10 flex-shrink-0">
                    <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full" style={{ width: `${data.attendanceRate}%`, backgroundColor: attColor }} />
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                            { label: 'حاضر',          count: data.presentCount,   color: 'text-emerald-600', icon: '✅' },
                            { label: 'متأخر/تعويض',   count: data.lateCount,      color: 'text-amber-600',   icon: '⏰' },
                            { label: 'غائب',           count: data.absentCount,    color: 'text-rose-600',    icon: '❌' },
                            { label: 'ممتاز',          count: data.excellentCount, color: 'text-blue-600',    icon: '⭐' },
                        ].map(item => (
                            <div key={item.label}>
                                <div className={cn('font-black text-lg leading-none', item.color)}>{item.count}</div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">{item.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Student lists */}
                <div className="overflow-y-auto flex-1 p-4 space-y-5">
                    {/* Present */}
                    {present.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-xs font-bold text-emerald-700">حاضرون ({present.length})</span>
                            </div>
                            <div className="space-y-1.5">
                                {present.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                                        <span className="text-sm font-semibold">{r.name}</span>
                                        <div className="flex items-center gap-1.5">
                                            <BehaviorEmoji beh={r.behavior} />
                                            <MemBadge mem={r.memorization} review={r.review} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Late */}
                    {late.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <Clock className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-bold text-amber-700">متأخر / تعويض ({late.length})</span>
                            </div>
                            <div className="space-y-1.5">
                                {late.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                                        <span className="text-sm font-semibold">{r.name}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">{r.attendance}</span>
                                            <MemBadge mem={r.memorization} review={r.review} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Absent */}
                    {absent.length > 0 && (
                        <div>
                            <div className="flex items-center gap-2 mb-2.5">
                                <XCircle className="h-4 w-4 text-rose-500" />
                                <span className="text-xs font-bold text-rose-700">غائبون ({absent.length})</span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5">
                                {absent.map((r, i) => (
                                    <div key={i} className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-100 rounded-xl">
                                        <XCircle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                                        <span className="text-xs font-medium truncate">{r.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.records.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">
                            <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">لا توجد سجلات لهذا اليوم</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Student Detail Modal ──────────────────────────────────────────────────────
function StudentDetailModal({
    student,
    sessionHistory,
    onClose,
}: {
    student: EnrichedStudentStats;
    sessionHistory: Array<{
        date: string;
        sessionType: string;
        attendance: string;
        memorization: string;
        behavior?: string;
        score: number | null;
    }>;
    onClose: () => void;
}) {
    const attColor = student.attendanceRate >= 90 ? 'text-emerald-600' :
                     student.attendanceRate >= 70 ? 'text-amber-600' : 'text-rose-600';
    const totalMem = student.excellentCount + student.veryGoodCount + student.goodCount + student.acceptableCount + student.weakCount;

    const scoreDot = (score: number | null, absent: boolean) => {
        if (absent) return <div className="w-3 h-3 rounded-full bg-rose-300 flex-shrink-0" title="غائب" />;
        if (score === null) return <div className="w-3 h-3 rounded-full bg-slate-200 flex-shrink-0" title="لم يُسجَّل" />;
        const dotColors: Record<number, string> = {
            6: 'bg-emerald-500', 5: 'bg-green-400', 4: 'bg-lime-400',
            3: 'bg-amber-400', 2: 'bg-orange-400', 1: 'bg-rose-500'
        };
        return <div className={cn('w-3 h-3 rounded-full flex-shrink-0', dotColors[Math.round(score)] || 'bg-slate-300')} title={String(score)} />;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150" onClick={onClose}>
            <div
                className="bg-card border rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-indigo-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0 rounded-t-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center font-black text-lg">
                            {student.name.charAt(0)}
                        </div>
                        <div>
                            <div className="font-black text-base">{student.name}</div>
                            <div className="text-white/60 text-xs mt-0.5">سجل الحضور والتسميع الشهري التفصيلي</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {student.trend === 'up'     && <TrendingUp   className="h-5 w-5 text-emerald-400" aria-label="في تحسن مستمر" />}
                        {student.trend === 'down'   && <TrendingDown  className="h-5 w-5 text-rose-400"    aria-label="في تراجع" />}
                        {student.trend === 'stable' && <Minus         className="h-5 w-5 text-slate-400"   aria-label="مستقر" />}
                        <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-xl transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-4 gap-0 border-b flex-shrink-0">
                    {[
                        { label: 'التقييم الأكاديمي', value: `${student.academicScore}%`, sub: 'المعدل الموحد', color: 'text-indigo-600', bg: 'bg-indigo-50/50' },
                        { label: 'المواظبة والحضور', value: `${student.attendanceRate}%`, sub: `${student.presentCount + student.lateCount}/${student.totalSessions}`, color: attColor, bg: '' },
                        { label: 'جودة الحفظ والتسميع', value: `${student.memorizationRate}%`, sub: `متوسط: ${student.avgScore > 0 ? student.avgScore.toFixed(1) : '—'}/6`, color: 'text-emerald-600', bg: 'bg-emerald-50/30' },
                        { label: 'انضباط السلوك', value: student.behaviorRate > 0 ? `${student.behaviorRate}%` : '—', sub: 'التقييم السلوكي', color: 'text-amber-600', bg: '' },
                    ].map(kpi => (
                        <div key={kpi.label} className={cn('text-center py-3 border-l first:border-l-0', kpi.bg)}>
                            <div className={cn('text-xl md:text-2xl font-black leading-none', kpi.color)}>{kpi.value}</div>
                            <div className="text-[9px] text-muted-foreground mt-0.5">{kpi.sub}</div>
                            <div className="text-[9px] font-bold text-muted-foreground/70 mt-0.5">{kpi.label}</div>
                        </div>
                    ))}
                </div>

                {/* Memorization breakdown */}
                {totalMem > 0 && (
                    <div className="px-5 py-3 border-b flex-shrink-0">
                        <div className="text-xs font-bold text-muted-foreground mb-2">توزيع تقييمات الحفظ هذا الشهر</div>
                        <div className="flex rounded-full overflow-hidden h-3 gap-px">
                            {[
                                { count: student.excellentCount,  color: '#059669', label: 'ممتاز' },
                                { count: student.veryGoodCount,   color: '#10b981', label: 'جيد جداً' },
                                { count: student.goodCount,       color: '#84cc16', label: 'جيد' },
                                { count: student.acceptableCount, color: '#f59e0b', label: 'مقبول' },
                                { count: student.weakCount,       color: '#ef4444', label: 'ضعيف/لم يحفظ' },
                                { count: student.absentCount,     color: '#e2e8f0', label: 'غائب' },
                            ].filter(s => s.count > 0).map((seg, i) => (
                                <div key={i} className="h-full transition-all" title={`${seg.label}: ${seg.count}`}
                                    style={{ width: `${(seg.count / student.totalSessions) * 100}%`, backgroundColor: seg.color }} />
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {[
                                { label: 'ممتاز',      count: student.excellentCount,  color: 'bg-emerald-100 text-emerald-700' },
                                { label: 'جيد جداً',   count: student.veryGoodCount,   color: 'bg-green-100 text-green-700'   },
                                { label: 'جيد',        count: student.goodCount,        color: 'bg-lime-100 text-lime-700'     },
                                { label: 'مقبول',      count: student.acceptableCount,  color: 'bg-amber-100 text-amber-700'   },
                                { label: 'ضعيف',       count: student.weakCount,        color: 'bg-rose-100 text-rose-700'     },
                                { label: 'غياب',       count: student.absentCount,      color: 'bg-slate-100 text-slate-600'   },
                            ].filter(s => s.count > 0).map(s => (
                                <span key={s.label} className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', s.color)}>
                                    {s.label}: {s.count}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Session history */}
                <div className="overflow-y-auto flex-1 p-4">
                    <div className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        سجل الجلسات الشهرية ({sessionHistory.length} حصة)
                    </div>
                    {sessionHistory.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground text-sm">لا توجد جلسات مسجَّلة هذا الشهر</div>
                    ) : (
                        <div className="space-y-1.5">
                            {sessionHistory.map((session, idx) => {
                                const isPresent  = session.attendance === 'حاضر' || session.attendance === 'متأخر' || session.attendance === 'تعويض';
                                const isAbsent   = !isPresent;
                                return (
                                    <div key={idx} className={cn(
                                        'flex items-center gap-2.5 p-2.5 rounded-xl border text-sm',
                                        isAbsent ? 'bg-rose-50 border-rose-100' : 'bg-white border-muted'
                                    )}>
                                        {scoreDot(session.score, isAbsent)}
                                        <span className="text-xs text-muted-foreground w-28 flex-shrink-0 font-medium">
                                            {format(parseISO(session.date), 'EEE d MMM', { locale: ar })}
                                        </span>
                                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0',
                                            session.sessionType === 'حصة أساسية' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'
                                        )}>
                                            {session.sessionType === 'حصة أساسية' ? 'أساسية' : 'تعويض'}
                                        </span>
                                        <span className={cn('flex-shrink-0 font-bold text-xs',
                                            isAbsent ? 'text-rose-600' :
                                            session.attendance === 'متأخر' ? 'text-amber-600' : 'text-emerald-600'
                                        )}>
                                            {isAbsent ? '❌ غائب' : session.attendance === 'متأخر' ? '⏰ متأخر' : '✅ حاضر'}
                                        </span>
                                        <span className="flex-1 text-xs text-center">
                                            {!isAbsent && session.memorization ? <MemBadge mem={session.memorization} review={session.memorization === 'مراجعة'} /> : null}
                                        </span>
                                        {session.behavior && !isAbsent && (
                                            <BehaviorEmoji beh={session.behavior} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Custom Tooltip for Recharts Comparison Chart ───────────────────────────
function CustomChartTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;
    return (
        <div className="bg-card border rounded-2xl p-4 shadow-xl text-right text-xs space-y-2 max-w-[220px] border-slate-100" dir="rtl">
            <div className="font-bold text-sm text-slate-800 border-b pb-1.5 mb-1.5">{data.monthName}</div>
            <div className="flex justify-between gap-4">
                <span className="text-muted-foreground font-semibold">النقاط الكلية:</span>
                <span className="font-black text-indigo-600">+{data.totalPoints}</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-muted-foreground font-semibold">حضور الطلاب:</span>
                <span className="font-black text-emerald-600">{data.avgAttendance}%</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-muted-foreground font-semibold">عدد الحصص:</span>
                <span className="font-black text-blue-600">{data.totalSessions} حصة</span>
            </div>
            <div className="flex justify-between gap-4">
                <span className="text-muted-foreground font-semibold">نسبة الممتاز:</span>
                <span className="font-black text-amber-600">{data.avgExcellent}%</span>
            </div>
            {data.badges && data.badges.length > 0 && (
                <div className="border-t pt-1.5 mt-1.5">
                    <span className="text-[10px] text-muted-foreground font-bold">الشارات المحققة:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {data.badges.map((b: any, i: number) => (
                            <span key={i} className="text-sm" title={b.label}>{b.icon}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyStatsPage() {
    const { dailySessions, allUsers, loading, students, settings } = useStudentContext();
    const { user, role } = useAuth();

    const isSheikh     = role === 'sheikh';
    const isManagement = role === 'super_admin' || role === 'management';

    const [activeTab, setActiveTab]           = useState<TabId>('overview');
    const [statsMonth, setStatsMonth]         = useState(new Date());
    const [selectedGroup, setSelectedGroup]   = useState<string>('');
    const [dayDetailDate, setDayDetailDate]   = useState<string | null>(null);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [studentHonorCard, setStudentHonorCard]   = useState<any | null>(null);
    const [showDetailedModal, setShowDetailedModal] = useState(false);

    const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
    const [dbSheikhScores, setDbSheikhScores] = useState<any[] | null>(null);

    useEffect(() => {
        const weightsRef = ref(db, 'settings/sheikh_scoring_weights');
        const unsubscribe = onValue(weightsRef, (snapshot: any) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                setWeights({
                    sessionWeight: typeof val.sessionWeight === 'number' ? val.sessionWeight : DEFAULT_WEIGHTS.sessionWeight,
                    attendanceWeight: typeof val.attendanceWeight === 'number' ? val.attendanceWeight : DEFAULT_WEIGHTS.attendanceWeight,
                    extraSessionBonus: typeof val.extraSessionBonus === 'number' ? val.extraSessionBonus : DEFAULT_WEIGHTS.extraSessionBonus,
                    excellentBonus: typeof val.excellentBonus === 'number' ? val.excellentBonus : DEFAULT_WEIGHTS.excellentBonus,
                    goodPlusBonus: typeof val.goodPlusBonus === 'number' ? val.goodPlusBonus : DEFAULT_WEIGHTS.goodPlusBonus,
                    commitmentBonus: typeof val.commitmentBonus === 'number' ? val.commitmentBonus : DEFAULT_WEIGHTS.commitmentBonus,
                    commitmentBase: typeof val.commitmentBase === 'number' ? val.commitmentBase : DEFAULT_WEIGHTS.commitmentBase,
                    absencePenalty: typeof val.absencePenalty === 'number' ? val.absencePenalty : DEFAULT_WEIGHTS.absencePenalty,
                    punctualityBonus: typeof val.punctualityBonus === 'number' ? val.punctualityBonus : DEFAULT_WEIGHTS.punctualityBonus,
                });
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const monthKey = format(statsMonth, 'yyyy-MM');
        const scoresRef = ref(db, `sheikh_scores/${monthKey}`);
        const unsubscribe = onValue(scoresRef, (snapshot: any) => {
            if (snapshot.exists()) {
                setDbSheikhScores(snapshot.val());
            } else {
                setDbSheikhScores(null);
            }
        });
        return () => unsubscribe();
    }, [statsMonth]);

    // ── Sheikh list ────────────────────────────────────────────────────────
    const sheikhsList = useMemo(() => {
        const map = new Map<string, { uid: string; displayName: string; group: string; uids: Set<string> }>();
        allUsers.filter(u => u.role === 'sheikh' && u.group).forEach(u => {
            if (!map.has(u.group!)) {
                map.set(u.group!, { uid: u.uid, displayName: u.displayName || '', group: u.group!, uids: new Set([u.uid]) });
            } else {
                map.get(u.group!)!.uids.add(u.uid);
            }
        });
        const list = Array.from(map.values());
        // Fallback: If list is empty and user is sheikh, add the logged-in sheikh
        if (list.length === 0 && isSheikh && user && user.group) {
            list.push({
                uid: user.uid,
                displayName: user.displayName || 'الشيخ',
                group: user.group,
                uids: new Set([user.uid])
            });
        }
        return list.sort((a, b) => {
            const na = parseInt(a.group.replace(/\D/g, '') || '0');
            const nb = parseInt(b.group.replace(/\D/g, '') || '0');
            return na - nb;
        });
    }, [allUsers, isSheikh, user]);

    const groupStudentCount = useMemo(() => {
        const map: Record<string, number> = {};
        if (!students) return map;
        students.forEach(s => {
            if (s.status === 'نشط' && s.groupName) {
                map[s.groupName] = (map[s.groupName] || 0) + 1;
            }
        });
        return map;
    }, [students]);

    const getDayStatsForScore = useCallback((group: string, dateStr: string) => {
        const sh = sheikhsList.find(s => s.group === group);
        if (!sh) return null;

        const ownerUids = sh.uids;
        const sessions: any[] = [];
        if (dailySessions && dailySessions[dateStr]) {
            Object.values(dailySessions[dateStr] as Record<string, any>).forEach(session => {
                if (!session) return;
                const ownerMatch = ownerUids.has(session.ownerId);
                const groupMatch  = session.groupName === group;
                if (ownerMatch || groupMatch) {
                    sessions.push(session);
                }
            });
        }
        const session = sessions.find(s => s.sessionNumber === 1) || sessions[0] || null;
        if (!session) return null;

        const records: any[] = Array.isArray(session.records)
            ? session.records
            : session.records ? Object.values(session.records) : [];

        // حساب عدد الطلاب النشطين في الفوج الذين انضموا قبل أو في هذا اليوم
        const sessionDate = new Date(dateStr);
        sessionDate.setHours(12, 0, 0, 0);
        const total = (students || []).filter(s => {
            if (s.status !== 'نشط' || s.groupName !== group) return false;
            if (!s.registrationDate) return true;
            const regDate = s.registrationDate instanceof Date
                ? s.registrationDate
                : new Date(s.registrationDate as any);
            const regDateNoon = new Date(regDate);
            regDateNoon.setHours(12, 0, 0, 0);
            return sessionDate >= regDateNoon;
        }).length;

        if (!records.length || !total) return { session, type: session.sessionType, attendance: null, excellent: null, goodPlus: null, good: null, acceptable: null, weak: null, notMemorized: null };

        let present = 0, excellent = 0, goodPlus = 0, good = 0, acceptable = 0, weak = 0, notMem = 0;
        records.forEach(r => {
            if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') present++;
            if (!r.review) {
                if (r.memorization === 'ممتاز') excellent++;
                else if (r.memorization === 'جيد جدا' || r.memorization === 'جيد جداً') goodPlus++;
                else if (r.memorization === 'جيد') good++;
                else if (r.memorization === 'مقبول' || r.memorization === 'حسن' || r.memorization === 'متوسط') acceptable++;
                else if (r.memorization === 'ضعيف') weak++;
                else if (r.memorization === 'لم يحفظ') notMem++;
            }
        });
        const p = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
        return { session, type: session.sessionType, attendance: p(present), excellent: p(excellent), goodPlus: p(goodPlus), good: p(good), acceptable: p(acceptable), weak: p(weak), notMemorized: p(notMem) };
    }, [dailySessions, sheikhsList, students]);

    const sheikhScores = useMemo(() => {
        if (dbSheikhScores && dbSheikhScores.length > 0) {
            return dbSheikhScores;
        }

        if (!sheikhsList.length) return [];

        const monthStart = startOfMonth(statsMonth);
        const monthEnd = endOfMonth(statsMonth);
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const calculatePoints = (data: {
            sessions: number;
            avgAttendance: number;
            avgExcellent: number;
            avgGoodPlus: number;
            commitmentRate: number;
            sheikhabsences: number;
            extraSessions: number;
            excCount: number;
            punctualSessions: number;
        }) => {
            const sessionPoints = data.sessions * weights.sessionWeight;
            const attendancePoints = data.sessions > 0 ? Math.round((data.avgAttendance / 100) * weights.attendanceWeight * data.sessions) : 0;
            const extraSessionBonus = data.extraSessions * weights.extraSessionBonus;
            const excellenceBonus = data.excCount > 0 ? Math.round((data.avgExcellent / 100) * weights.excellentBonus * data.sessions) : 0;
            const goodPlusBonus = data.excCount > 0 ? Math.round((data.avgGoodPlus / 100) * weights.goodPlusBonus * data.sessions) : 0;
            const excellencePoints = excellenceBonus + goodPlusBonus;

            const commitmentBonus = (data.commitmentRate >= 100 && data.sheikhabsences === 0 && data.sessions > 0) ? weights.commitmentBonus : 0;
            const absencePenalty = data.sheikhabsences * weights.absencePenalty;
            const commitmentBase = Math.round((data.commitmentRate / 100) * weights.commitmentBase);
            const commitmentPoints = Math.max(0, commitmentBase + commitmentBonus - absencePenalty);

            const punctualityBonus = data.punctualSessions * weights.punctualityBonus;

            const totalPoints = sessionPoints + attendancePoints + extraSessionBonus + excellencePoints + commitmentPoints + punctualityBonus;

            return {
                totalPoints,
                sessionPoints,
                attendancePoints,
                extraSessionBonus,
                excellencePoints,
                commitmentPoints,
                punctualityBonus
            };
        };

        const rawScores = sheikhsList.map(sh => {
            let sessions = 0, extraSessions = 0, highAttDays = 0, totalDays = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
            let punctualSessions = 0;

            allDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStatsForScore(sh.group, dateStr);
                totalDays++;
                if (!stats) return;

                if (stats.type === 'يوم عطلة') { holidays++; return; }
                if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }

                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                if (isReal) {
                    sessions++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        extraSessions++;
                    }
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                    if (stats.excellent !== null) {
                        excTotal += stats.excellent;
                        excCount++;
                    }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;

                    if (isSessionPunctual(stats.session)) {
                        punctualSessions++;
                    }
                }
            });

            const workingDays = totalDays - holidays - sheikhabsences;
            const avgAttendance = attCount > 0 ? Math.round(attTotal / attCount) : 0;
            const avgExcellent = excCount > 0 ? Math.round(excTotal / excCount) : 0;
            const avgGoodPlus = excCount > 0 ? Math.round(gpTotal / excCount) : 0;
            const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount,
                punctualSessions
            });

            const base = {
                group: sh.group,
                displayName: sh.displayName,
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                punctualityBonus: pts.punctualityBonus,
                totalSessions: sessions,
                totalDays,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays,
                sheikhabsences,
                extraSessionsCount: extraSessions,
                punctualSessionsCount: punctualSessions
            };

            return {
                ...base,
                badges: computeBadges(base),
                rank: 0
            };
        });

        rawScores.sort((a, b) => b.totalPoints - a.totalPoints);
        rawScores.forEach((s, i) => { s.rank = i + 1; });

        return rawScores;
    }, [dbSheikhScores, sheikhsList, getDayStatsForScore, statsMonth, weights]);

    // ── Active sheikh (with fallback for sheikhs who aren't in allUsers yet) ─
    const activeSheikh = useMemo(() => {
        if (!selectedGroup) return null;
        const found = sheikhsList.find(s => s.group === selectedGroup);
        if (found) return found;
        if (isSheikh && user && user.group === selectedGroup) {
            return { uid: user.uid, displayName: (user as any).displayName || 'الشيخ', group: selectedGroup, uids: new Set<string>([user.uid]) };
        }
        return null;
    }, [sheikhsList, selectedGroup, isSheikh, user]);

    const effectiveSheikhsList = useMemo(() => {
        if (!activeSheikh) return sheikhsList;
        return sheikhsList.some(s => s.group === activeSheikh.group) ? sheikhsList : [activeSheikh];
    }, [sheikhsList, activeSheikh]);

    const mySheikhScore = useMemo(() => {
        return sheikhScores.find(s => s.group === selectedGroup) || null;
    }, [sheikhScores, selectedGroup]);

    // ── Yearly stats for Month Comparison & Peak Performance ──────────────
    const yearlyMonthlyStats = useMemo(() => {
        if (!selectedGroup || !activeSheikh) return [];
        const year = statsMonth.getFullYear();
        const results = [];

        const calculatePoints = (data: {
            sessions: number;
            avgAttendance: number;
            avgExcellent: number;
            avgGoodPlus: number;
            commitmentRate: number;
            sheikhabsences: number;
            extraSessions: number;
            excCount: number;
            punctualSessions: number;
        }) => {
            const sessionPoints = data.sessions * weights.sessionWeight;
            const attendancePoints = data.sessions > 0 ? Math.round((data.avgAttendance / 100) * weights.attendanceWeight * data.sessions) : 0;
            const extraSessionBonus = data.extraSessions * weights.extraSessionBonus;
            const excellenceBonus = data.excCount > 0 ? Math.round((data.avgExcellent / 100) * weights.excellentBonus * data.sessions) : 0;
            const goodPlusBonus = data.excCount > 0 ? Math.round((data.avgGoodPlus / 100) * weights.goodPlusBonus * data.sessions) : 0;
            const excellencePoints = excellenceBonus + goodPlusBonus;

            const commitmentBonus = (data.commitmentRate >= 100 && data.sheikhabsences === 0 && data.sessions > 0) ? weights.commitmentBonus : 0;
            const absencePenalty = data.sheikhabsences * weights.absencePenalty;
            const commitmentBase = Math.round((data.commitmentRate / 100) * weights.commitmentBase);
            const commitmentPoints = Math.max(0, commitmentBase + commitmentBonus - absencePenalty);

            const punctualityBonus = data.punctualSessions * weights.punctualityBonus;

            const totalPoints = sessionPoints + attendancePoints + extraSessionBonus + excellencePoints + commitmentPoints + punctualityBonus;

            return {
                totalPoints,
                sessionPoints,
                attendancePoints,
                extraSessionBonus,
                excellencePoints,
                commitmentPoints,
                punctualityBonus
            };
        };

        for (let m = 0; m < 12; m++) {
            const monthDate = new Date(year, m, 1);
            const monthStart = startOfMonth(monthDate);
            const monthEnd = endOfMonth(monthDate);
            const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

            let sessions = 0, extraSessions = 0, highAttDays = 0, totalDays = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
            let punctualSessions = 0;

            allDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStatsForScore(selectedGroup, dateStr);
                totalDays++;
                if (!stats) return;

                if (stats.type === 'يوم عطلة') { holidays++; return; }
                if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }

                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                if (isReal) {
                    sessions++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        extraSessions++;
                    }
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                    if (stats.excellent !== null) {
                        excTotal += stats.excellent;
                        excCount++;
                    }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;

                    if (isSessionPunctual(stats.session)) {
                        punctualSessions++;
                    }
                }
            });

            const workingDays = totalDays - holidays - sheikhabsences;
            const avgAttendance = attCount > 0 ? Math.round(attTotal / attCount) : 0;
            const avgExcellent = excCount > 0 ? Math.round(excTotal / excCount) : 0;
            const avgGoodPlus = excCount > 0 ? Math.round(gpTotal / excCount) : 0;
            const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

            const hasData = sessions > 0;

            const pts = calculatePoints({
                sessions,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                sheikhabsences,
                extraSessions,
                excCount,
                punctualSessions
            });

            const base = {
                monthIndex: m,
                monthName: ARABIC_MONTHS[m],
                monthKey: format(monthDate, 'yyyy-MM'),
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                punctualityBonus: pts.punctualityBonus,
                totalSessions: sessions,
                totalDays,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays,
                sheikhabsences,
                extraSessionsCount: extraSessions,
                punctualSessionsCount: punctualSessions,
                hasData
            };

            results.push({
                ...base,
                badges: computeBadges(base)
            });
        }

        return results;
    }, [selectedGroup, activeSheikh, statsMonth, getDayStatsForScore, weights]);

    const activeMonths = useMemo(() => {
        return yearlyMonthlyStats.filter(m => m.hasData);
    }, [yearlyMonthlyStats]);

    const bestMonthOverall = useMemo(() => {
        if (activeMonths.length === 0) return null;
        return [...activeMonths].sort((a, b) => b.totalPoints - a.totalPoints)[0];
    }, [activeMonths]);

    const bestMonthSessions = useMemo(() => {
        if (activeMonths.length === 0) return null;
        return [...activeMonths].sort((a, b) => b.totalSessions - a.totalSessions)[0];
    }, [activeMonths]);

    const bestMonthAttendance = useMemo(() => {
        if (activeMonths.length === 0) return null;
        return [...activeMonths].sort((a, b) => b.avgAttendance - a.avgAttendance)[0];
    }, [activeMonths]);

    const bestMonthExcellence = useMemo(() => {
        if (activeMonths.length === 0) return null;
        return [...activeMonths].sort((a, b) => b.avgExcellent - a.avgExcellent)[0];
    }, [activeMonths]);

    const currentMonthStats = useMemo(() => {
        const currentKey = format(statsMonth, 'yyyy-MM');
        return yearlyMonthlyStats.find(m => m.monthKey === currentKey) || null;
    }, [yearlyMonthlyStats, statsMonth]);


    // ── Auto-select group ──────────────────────────────────────────────────
    useEffect(() => {
        if (isSheikh && user?.group) {
            setSelectedGroup(user.group);
        } else if (isManagement && sheikhsList.length > 0 && !selectedGroup) {
            setSelectedGroup(sheikhsList[0].group);
        }
    }, [isSheikh, user?.group, isManagement, sheikhsList, selectedGroup]);



    // ── Group students ─────────────────────────────────────────────────────
    const groupStudents = useMemo(() => {
        if (!students) return [];
        const byGroup = students.filter(s => s.status === 'نشط' && s.groupName === selectedGroup);
        if (byGroup.length > 0) return byGroup;
        if (isSheikh) return students.filter(s => s.status === 'نشط');
        return [];
    }, [students, selectedGroup, isSheikh]);

    // ── Session map (all sessions for this group) ──────────────────────────
    const groupSessionsMap = useMemo(() => {
        const map = new Map<string, any[]>();
        if (!dailySessions || !activeSheikh) return map;
        const ownerUids = new Set<string>(activeSheikh.uids);
        if (isSheikh && user?.uid) ownerUids.add(user.uid);

        Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
            if (!daySessions) return;
            Object.values(daySessions as Record<string, any>).forEach(session => {
                if (!session) return;
                const ownerMatch = !session.ownerId || ownerUids.has(session.ownerId);
                const groupMatch  = session.groupName === selectedGroup;
                if (ownerMatch || groupMatch) {
                    const arr = map.get(dateStr) || [];
                    if (!arr.some(s => s.sessionNumber === session.sessionNumber)) {
                        arr.push({ ...session, dateStr });
                        map.set(dateStr, arr);
                    }
                }
            });
        });
        return map;
    }, [dailySessions, activeSheikh, isSheikh, user?.uid, selectedGroup]);

    // ── Adapted sessions (inject ownerId for child components) ────────────
    const adaptedDailySessions = useMemo(() => {
        if (!dailySessions || !activeSheikh || !isSheikh) return dailySessions;
        const uid = user?.uid || activeSheikh.uid;
        const result: Record<string, Record<string, any>> = {};
        Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
            if (!daySessions) return;
            result[dateStr] = {};
            Object.entries(daySessions as Record<string, any>).forEach(([sid, session]) => {
                result[dateStr][sid] = { ...session, ownerId: uid, groupName: session.groupName || selectedGroup };
            });
        });
        return result;
    }, [dailySessions, activeSheikh, isSheikh, user?.uid, selectedGroup]);

    // ── getDayStats ────────────────────────────────────────────────────────
    const getDayStats = useCallback((group: string, dateStr: string) => {
        const sessions = groupSessionsMap.get(dateStr) || [];
        const session  = sessions[0] || null;
        if (!session) return null;

        const records: any[] = Array.isArray(session.records)
            ? session.records
            : session.records ? Object.values(session.records) : [];

        if (!records.length) return { type: session.sessionType, attendance: null, excellent: null };

        let present = 0, excellent = 0;
        records.forEach((r: any) => {
            if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') present++;
            if (!r.review && r.memorization === 'ممتاز') excellent++;
        });
        const p = (n: number) => Math.round((n / records.length) * 100);
        return { type: session.sessionType, attendance: p(present), excellent: p(excellent) };
    }, [groupSessionsMap]);

    // ── Day detail data (for modal) ────────────────────────────────────────
    const dayDetailData = useMemo((): DayDetailData | null => {
        if (!dayDetailDate) return null;
        const sessions = groupSessionsMap.get(dayDetailDate) || [];
        const session  = sessions[0] || null;
        if (!session || !SESSION_TYPES.includes(session.sessionType)) return null;

        const rawRecords: any[] = Array.isArray(session.records)
            ? session.records
            : session.records ? Object.values(session.records) : [];

        // Sort: حاضر → متأخر/تعويض → غائب
        const records: SessionRecord[] = rawRecords.map((r: any) => ({
            studentId:   r.studentId,
            name:        groupStudents.find(s => s.id === r.studentId)?.fullName || 'طالب',
            attendance:  r.attendance || 'غائب',
            memorization: r.memorization,
            behavior:    r.behavior,
            review:      r.review,
        })).sort((a, b) => {
            const order: Record<string, number> = { 'حاضر': 0, 'متأخر': 1, 'تعويض': 1, 'غائب': 2 };
            return (order[a.attendance] ?? 2) - (order[b.attendance] ?? 2);
        });

        const presentCount   = records.filter(r => r.attendance === 'حاضر').length;
        const lateCount      = records.filter(r => r.attendance === 'متأخر' || r.attendance === 'تعويض').length;
        const absentCount    = records.filter(r => r.attendance === 'غائب' || !['حاضر','متأخر','تعويض'].includes(r.attendance)).length;
        const excellentCount = records.filter(r => !r.review && r.memorization === 'ممتاز').length;
        const attendanceRate = records.length > 0 ? Math.round(((presentCount + lateCount) / records.length) * 100) : 0;

        return { dateStr: dayDetailDate, sessionType: session.sessionType, records, presentCount, absentCount, lateCount, attendanceRate, excellentCount };
    }, [dayDetailDate, groupSessionsMap, groupStudents]);

    // ── Enriched student stats ─────────────────────────────────────────────
    const enrichedStudentStats = useMemo((): EnrichedStudentStats[] => {
        if (!groupStudents.length) return [];

        const start   = startOfMonth(statsMonth);
        const end     = endOfMonth(statsMonth);
        const allDays = eachDayOfInterval({ start, end });

        // Build ordered session list for the month
        const monthSessions: Array<{ date: string; records: any[] }> = [];
        allDays.forEach(day => {
            const dateStr  = format(day, 'yyyy-MM-dd');
            const sessions = groupSessionsMap.get(dateStr) || [];
            sessions.forEach(session => {
                if (!SESSION_TYPES.includes(session.sessionType)) return;
                const recs: any[] = Array.isArray(session.records)
                    ? session.records
                    : session.records ? Object.values(session.records) : [];
                monthSessions.push({ date: dateStr, records: recs });
            });
        });

        // Group sessions by date to calculate weights
        const sessionsByDate: Record<string, any[]> = {};
        monthSessions.forEach(session => {
            if (!sessionsByDate[session.date]) {
                sessionsByDate[session.date] = [];
            }
            sessionsByDate[session.date].push(session);
        });

        const pointsConfig = settings?.points;

        const maxAttendanceVal = pointsConfig?.attendance ? Math.max(...Object.values(pointsConfig.attendance).map(Number)) : 10;
        const maxMemorizationVal = pointsConfig?.evaluation ? Math.max(...Object.values(pointsConfig.evaluation).map(Number)) : 10;
        const maxBehaviorVal = pointsConfig?.behavior ? Math.max(...Object.values(pointsConfig.behavior).map(Number)) : 10;

        const getAttPoints = (att: string) => (pointsConfig?.attendance as any)?.[att] ?? ATTENDANCE_POINTS[att] ?? 0;
        const getMemoPoints = (memo: string) => (pointsConfig?.evaluation as any)?.[memo] ?? PERFORMANCE_POINTS[memo] ?? 0;
        const getBehPoints = (beh: string) => (pointsConfig?.behavior as any)?.[beh] ?? BEHAVIOR_POINTS[beh] ?? 0;

        return groupStudents.map(student => {
            let present = 0, absent = 0, late = 0, substitute = 0, makeupCount = 0;
            let excellent = 0, veryGood = 0, good = 0, acceptable = 0, weak = 0;
            let scoreSum = 0, scoreCount = 0;
            const allHistory: EnrichedStudentStats['lastSessions'] = [];

            let weightedSessions = 0;
            let attendancePointsEarned = 0;
            let assessedMemorization = 0;
            let memorizationPointsEarned = 0;
            let assessedBehavior = 0;
            let behaviorPointsEarned = 0;

            monthSessions.forEach(({ date, records }) => {
                const rec      = records.find((r: any) => r.studentId === student.id);
                const att      = rec?.attendance || 'غائب';
                const isPresent = att === 'حاضر' || att === 'متأخر' || att === 'تعويض';

                const dateSessions = sessionsByDate[date] || [];
                const weight = dateSessions.length >= 2 ? 0.5 : 1.0;

                weightedSessions += weight;

                if (att === 'حاضر') present++;
                else if (att === 'متأخر') late++;
                else if (att === 'تعويض') substitute++;
                else absent++;

                if (rec?.attendance) {
                    attendancePointsEarned += getAttPoints(rec.attendance) * weight;
                }

                let score: number | null = null;
                if (isPresent && rec) {
                    const hasNewMemo = !rec.review && rec.memorization && rec.memorization !== 'لا يوجد' && rec.memorization !== '';
                    const hasReview = rec.review && pointsConfig?.review?.completed;

                    let earnedMemoPoints = 0;
                    let hasMemo = false;

                    if (hasNewMemo) {
                        earnedMemoPoints += getMemoPoints(rec.memorization);
                        hasMemo = true;

                        score = EVAL_SCORE[rec.memorization] ?? null;
                        if (score !== null) { scoreSum += score; scoreCount++; }
                        const m = rec.memorization;
                        if (m === 'ممتاز')                                    excellent++;
                        else if (m === 'جيد جداً' || m === 'جيد جدا')         veryGood++;
                        else if (m === 'جيد')                                  good++;
                        else if (m === 'مقبول' || m === 'متوسط' || m === 'حسن') acceptable++;
                        else if (m === 'ضعيف' || m === 'لم يحفظ')              weak++;
                    }
                    if (hasReview) {
                        earnedMemoPoints += pointsConfig.review.completed;
                        hasMemo = true;
                    }

                    if (hasMemo) {
                        assessedMemorization += weight;
                        const isGroup8User = student.groupName === 'فوج 8' || student.groupName === 'فوج الشيخ عبد الحق نصيرة' || (student.groupName || '').includes('عبد الحق');
                        const multiplier = isGroup8User ? (student.memorizationMultiplier ?? 1.0) : 1.0;
                        const penalty = (hasNewMemo && rec.isDelayed) ? 0.8 : 1.0;
                        memorizationPointsEarned += earnedMemoPoints * weight * multiplier * penalty;
                    }
                }

                if (isPresent && rec?.behavior && rec.behavior !== '') {
                    assessedBehavior += weight;
                    behaviorPointsEarned += getBehPoints(rec.behavior) * weight;
                }

                // Process individual makeup sessions for student metrics
                if (rec?.makeupSessions && Array.isArray(rec.makeupSessions)) {
                    makeupCount += rec.makeupSessions.length;
                    rec.makeupSessions.forEach((makeup: any) => {
                        const makeupAttPts = getAttPoints('تعويض');
                        attendancePointsEarned += makeupAttPts;

                        let mkMemoPoints = 0;
                        let hasMkMemo = false;
                        const mkMemo = makeup.memorization;
                        if (mkMemo && mkMemo !== 'لا يوجد' && mkMemo !== '') {
                            mkMemoPoints += getMemoPoints(mkMemo);
                            hasMkMemo = true;

                            const scoreVal = EVAL_SCORE[mkMemo] ?? null;
                            if (scoreVal !== null) { scoreSum += scoreVal; scoreCount++; }

                            if (mkMemo === 'ممتاز') excellent++;
                            else if (mkMemo === 'جيد جداً' || mkMemo === 'جيد جدا') veryGood++;
                            else if (mkMemo === 'جيد') good++;
                            else if (mkMemo === 'مقبول' || mkMemo === 'متوسط' || mkMemo === 'حسن') acceptable++;
                            else if (mkMemo === 'ضعيف' || mkMemo === 'لم يحفظ') weak++;
                        }
                        if (makeup.review && pointsConfig?.review?.completed) {
                            mkMemoPoints += pointsConfig.review.completed;
                            hasMkMemo = true;
                        }
                        if (hasMkMemo) {
                            assessedMemorization += weight;
                            const isGroup8User = student.groupName === 'فوج 8' || student.groupName === 'فوج الشيخ عبد الحق نصيرة' || (student.groupName || '').includes('عبد الحق');
                            const multiplier = isGroup8User ? (student.memorizationMultiplier ?? 1.0) : 1.0;
                            memorizationPointsEarned += mkMemoPoints * weight * multiplier;
                        }

                        if (makeup.behavior && makeup.behavior !== '') {
                            assessedBehavior += weight;
                            behaviorPointsEarned += getBehPoints(makeup.behavior) * weight;
                        }
                    });
                }

                allHistory.push({
                    date,
                    attendance:   att,
                    memorization: rec?.review ? 'مراجعة' : rec?.memorization || '',
                    behavior:     rec?.behavior,
                    score,
                });
            });

            const totalSessions  = monthSessions.length;
            const presentTotal   = present + late + substitute + makeupCount;

            const maxAttPoints = weightedSessions * maxAttendanceVal;
            const maxMemoPoints = assessedMemorization * maxMemorizationVal;
            const maxBehPoints = assessedBehavior * maxBehaviorVal;

            const attPct = maxAttPoints > 0 ? (attendancePointsEarned / maxAttPoints) * 100 : 0;
            const memoPct = maxMemoPoints > 0 ? (memorizationPointsEarned / maxMemoPoints) * 100 : 0;
            const behPct = maxBehPoints > 0 ? (behaviorPointsEarned / maxBehPoints) * 100 : 0;

            const academic = (attPct + memoPct) / 2;
            const comprehensive = assessedBehavior > 0 ? (attPct + memoPct + behPct) / 3 : academic;

            const attendanceRate = totalSessions > 0 ? Math.round((presentTotal / totalSessions) * 100) : 100;
            const avgScore       = scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0;
            const excellentRate  = presentTotal > 0 ? Math.round((excellent / presentTotal) * 100) : 0;

            // Trend: first half vs second half
            const scores = allHistory.filter(h => h.score !== null).map(h => h.score!);
            let trend: 'up' | 'stable' | 'down' = 'stable';
            if (scores.length >= 4) {
                const half1 = scores.slice(0, Math.floor(scores.length / 2));
                const half2 = scores.slice(Math.floor(scores.length / 2));
                const avg1  = half1.reduce((a, b) => a + b, 0) / half1.length;
                const avg2  = half2.reduce((a, b) => a + b, 0) / half2.length;
                if (avg2 > avg1 + 0.4) trend = 'up';
                else if (avg2 < avg1 - 0.4) trend = 'down';
            }

            return {
                id: student.id, name: student.fullName, photoURL: student.photoURL,
                totalSessions, presentCount: present, absentCount: absent, lateCount: late, substituteCount: substitute,
                attendanceRate, excellentCount: excellent, veryGoodCount: veryGood, goodCount: good,
                acceptableCount: acceptable, weakCount: weak, avgScore, excellentRate,
                lastSessions: allHistory.slice(-6),
                trend,
                academicScore: Math.max(0, Math.round(academic * 10) / 10),
                comprehensiveScore: Math.max(0, Math.round(comprehensive * 10) / 10),
                memorizationRate: Math.max(0, Math.round(memoPct * 10) / 10),
                behaviorRate: Math.max(0, Math.round(behPct * 10) / 10),
            };
        }).sort((a, b) => b.academicScore - a.academicScore || b.attendanceRate - a.attendanceRate);
    }, [groupStudents, statsMonth, groupSessionsMap, settings]);

    // ── Selected student detail ────────────────────────────────────────────
    const selectedStudentDetail = useMemo(() =>
        selectedStudentId ? enrichedStudentStats.find(s => s.id === selectedStudentId) || null : null,
        [selectedStudentId, enrichedStudentStats]
    );

    const studentSessionHistory = useMemo(() => {
        if (!selectedStudentId) return [];
        const start   = startOfMonth(statsMonth);
        const end     = endOfMonth(statsMonth);
        const allDays = eachDayOfInterval({ start, end });
        const history: Array<{ date: string; sessionType: string; attendance: string; memorization: string; behavior?: string; score: number | null }> = [];

        allDays.forEach(day => {
            const dateStr  = format(day, 'yyyy-MM-dd');
            const sessions = groupSessionsMap.get(dateStr) || [];
            sessions.forEach(session => {
                if (!SESSION_TYPES.includes(session.sessionType)) return;
                const recs: any[] = Array.isArray(session.records)
                    ? session.records
                    : session.records ? Object.values(session.records) : [];
                const rec       = recs.find(r => r.studentId === selectedStudentId);
                const att       = rec?.attendance || 'غائب';
                const isPresent = att === 'حاضر' || att === 'متأخر' || att === 'تعويض';
                const score     = isPresent && rec && !rec.review && rec.memorization ? (EVAL_SCORE[rec.memorization] ?? null) : null;
                history.push({
                    date: dateStr, sessionType: session.sessionType,
                    attendance:   att,
                    memorization: rec?.review ? 'مراجعة' : rec?.memorization || '',
                    behavior:     rec?.behavior,
                    score,
                });
            });
        });
        return history;
    }, [selectedStudentId, statsMonth, groupSessionsMap]);

    // ── Monthly overview stats ─────────────────────────────────────────────
    const myStats = useMemo(() => {
        if (!selectedGroup || !activeSheikh) return null;
        const start   = startOfMonth(statsMonth);
        const end     = endOfMonth(statsMonth);
        const allDays = eachDayOfInterval({ start, end });

        let sessionDays = 0, absences = 0, holidays = 0;
        const attVals: number[] = [], excVals: number[] = [];

        allDays.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const res     = getDayStats(selectedGroup, dateStr);
            if (!res) return;
            if (res.type === 'يوم عطلة')   { holidays++; return; }
            if (res.type === 'غياب الشيخ') { absences++; return; }
            if (SESSION_TYPES.includes(res.type)) {
                sessionDays++;
                if (res.attendance !== null) attVals.push(res.attendance);
                if (res.excellent  !== null) excVals.push(res.excellent);
            }
        });

        const workingDays    = allDays.length - holidays;
        const commitmentRate = workingDays > 0 ? Math.round((sessionDays / workingDays) * 100) : 0;
        const avgAtt         = attVals.length ? Math.round(attVals.reduce((a, b) => a + b, 0) / attVals.length) : 0;
        const avgExc         = excVals.length ? Math.round(excVals.reduce((a, b) => a + b, 0) / excVals.length) : 0;

        const Saturdays = allDays.filter(d => getDay(d) === 6);
        const weeklyBreakdown = Saturdays.map((sat, i) => {
            const fri   = addDays(sat, 6);
            const wDays = eachDayOfInterval({ start: sat, end: fri });
            let wSessions = 0;
            const wAtt: number[] = [], wExc: number[] = [];
            wDays.forEach(day => {
                const r = getDayStats(selectedGroup, format(day, 'yyyy-MM-dd'));
                if (!r || r.type === 'يوم عطلة' || r.type === 'غياب الشيخ') return;
                if (SESSION_TYPES.includes(r.type)) {
                    wSessions++;
                    if (r.attendance !== null) wAtt.push(r.attendance);
                    if (r.excellent  !== null) wExc.push(r.excellent);
                }
            });
            return {
                label: `أسبوع ${i + 1}`,
                dateRange: `${format(sat, 'd MMM', { locale: ar })} — ${format(fri, 'd MMM', { locale: ar })}`,
                sessions: wSessions,
                attendance: wAtt.length ? Math.round(wAtt.reduce((a, b) => a + b, 0) / wAtt.length) : null,
                excellent:  wExc.length ? Math.round(wExc.reduce((a, b) => a + b, 0) / wExc.length) : null,
            };
        });

        return { commitmentRate, sessionDays, absences, holidays, avgAttendance: avgAtt, avgExcellent: avgExc, weeklyBreakdown, workingDays };
    }, [selectedGroup, activeSheikh, statsMonth, getDayStats]);

    // ── At-risk students (use adapted sessions for sheikhs) ───────────────
    const atRiskStudents = useMemo(() => {
        if (!groupStudents.length || !adaptedDailySessions || !activeSheikh) return [];
        const today = new Date();
        const isCurrentMonth = statsMonth.getMonth() === today.getMonth() && statsMonth.getFullYear() === today.getFullYear();
        const refDate = isCurrentMonth ? today : endOfMonth(statsMonth);
        const computed = computeAtRiskStudents(groupStudents, adaptedDailySessions, [activeSheikh], refDate);
        return isSheikh ? computed : computed.filter(s => s.group === selectedGroup);
    }, [groupStudents, adaptedDailySessions, activeSheikh, selectedGroup, statsMonth, isSheikh]);

    // ── PDF Export ─────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        if (!myStats || !activeSheikh) return;
        const monthLabel = format(statsMonth, 'MMMM yyyy', { locale: ar });
        const studentsRows = enrichedStudentStats.map(s => `
            <tr>
                <td style="text-align:right;padding:8px 10px;">${s.name}</td>
                <td style="text-align:center;font-weight:700;color:${s.attendanceRate>=90?'#059669':s.attendanceRate>=70?'#d97706':'#dc2626'}">${s.attendanceRate}%</td>
                <td style="text-align:center">${s.presentCount+s.lateCount}/${s.totalSessions}</td>
                <td style="text-align:center">${s.absentCount}</td>
                <td style="text-align:center;color:#4f46e5;font-weight:700">${s.excellentCount}</td>
                <td style="text-align:center">${s.avgScore>0?s.avgScore.toFixed(1):'—'}</td>
                <td style="text-align:center">${s.trend==='up'?'📈 تحسن':s.trend==='down'?'📉 تراجع':'➡️ مستقر'}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
<title>تقرير فوج ${selectedGroup}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Cairo',sans-serif;direction:rtl;background:#fff;color:#1e293b;padding:24px;font-size:11px}
.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #4f46e5;padding-bottom:16px;margin-bottom:24px}
h1{font-size:18px;font-weight:900;color:#4f46e5}h2{font-size:12px;font-weight:700;color:#0f172a;margin:20px 0 10px}
.kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.kcard{border:1px solid #e2e8f0;border-radius:8px;padding:12px;text-align:center;background:#f8fafc}
.kval{font-size:22px;font-weight:900;color:#4f46e5}.klbl{font-size:9px;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#4f46e5;color:#fff;padding:8px;font-size:9px;text-align:center}
td{border:1px solid #e2e8f0;padding:7px;font-size:10px}tr:nth-child(even){background:#f8fafc}
.footer{margin-top:40px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px}
@media print{@page{size:A4;margin:1cm}}
</style></head><body>
<div class="hdr">
    <div><h1>مدرسة الإمام الشافعي لتعليم القرآن الكريم</h1>
    <div style="font-size:12px;color:#4f46e5;font-weight:700;margin-top:4px">فوج: ${selectedGroup} — الشيخ: ${activeSheikh.displayName}</div>
    <div style="color:#64748b;font-size:10px;margin-top:2px">شهر التقرير: ${monthLabel}</div></div>
    <div style="text-align:left;font-size:9px;color:#64748b">
        <div>الاستخراج: ${format(new Date(),'dd/MM/yyyy HH:mm')}</div>
        <div style="margin-top:2px">عدد الطلاب: ${groupStudents.length}</div>
    </div>
</div>
<div class="kpi">
    <div class="kcard"><div class="kval">${myStats.commitmentRate}%</div><div class="klbl">التزام بالحصص</div></div>
    <div class="kcard"><div class="kval">${myStats.avgAttendance}%</div><div class="klbl">متوسط الحضور</div></div>
    <div class="kcard"><div class="kval">${myStats.avgExcellent}%</div><div class="klbl">نسبة الممتاز</div></div>
    <div class="kcard"><div class="kval">${myStats.sessionDays}</div><div class="klbl">الحصص المنعقدة</div></div>
</div>
<h2>📋 سجل أداء الطلاب — ${monthLabel}</h2>
<table><thead><tr><th>الطالب</th><th>الحضور%</th><th>الحضور/المجموع</th><th>الغياب</th><th>ممتاز</th><th>متوسط الحفظ</th><th>الاتجاه</th></tr></thead>
<tbody>${studentsRows}</tbody></table>
<h2>📅 الملخص الأسبوعي</h2>
<table><thead><tr><th>الأسبوع</th><th>الفترة</th><th>الحصص</th><th>حضور%</th><th>ممتاز%</th></tr></thead>
<tbody>${myStats.weeklyBreakdown.map(w=>`<tr><td style="font-weight:700">${w.label}</td><td>${w.dateRange}</td><td>${w.sessions}</td>
<td style="font-weight:700;color:${w.attendance&&w.attendance>=90?'#059669':'#d97706'}">${w.attendance!==null?w.attendance+'%':'—'}</td>
<td style="color:#4f46e5">${w.excellent!==null?w.excellent+'%':'—'}</td></tr>`).join('')}</tbody></table>
${atRiskStudents.length>0?`<h2>⚠️ طلاب يحتاجون متابعة</h2>
<table><thead><tr><th>الطالب</th><th>مستوى الخطر</th><th>الغياب (أسبوعين)</th><th>الأسباب</th></tr></thead>
<tbody>${atRiskStudents.map(s=>`<tr><td style="text-align:right">${s.name}</td>
<td style="color:${s.riskLevel==='high'?'#dc2626':'#d97706'}">${s.riskLevel==='high'?'🔴 في خطر':'🟡 يحتاج انتباه'}</td>
<td>${s.absencesLast2Weeks}/${s.totalSessionsLast2Weeks}</td><td style="text-align:right">${s.reasons.join(' • ')}</td></tr>`).join('')}</tbody></table>`
:'<p style="color:#059669;font-weight:700;margin:12px 0">✅ جميع الطلاب في وضع جيد</p>'}
<div class="footer">مدرسة الإمام الشافعي • ${format(new Date(),'dd/MM/yyyy HH:mm')}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;

        const pw = window.open('', '_blank', 'width=900,height=1000');
        if (!pw) { alert('يرجى السماح بالنوافذ المنبثقة'); return; }
        pw.document.write(html); pw.document.close();
    };

    // ─────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px] gap-3">
                <Activity className="h-7 w-7 text-primary animate-spin" />
                <span className="text-sm text-muted-foreground">جاري تحميل بيانات الحلقة...</span>
            </div>
        );
    }

    if (!selectedGroup || !activeSheikh) {
        return (
            <div className="text-center py-20 space-y-4">
                <Shield className="h-14 w-14 text-slate-300 mx-auto" />
                <div className="text-lg font-bold">لم يتم تخصيص فوج لهذا الحساب</div>
                <p className="text-sm text-muted-foreground">تواصل مع الإدارة لتخصيص فوج تعليمي وتحديث بياناتك.</p>
            </div>
        );
    }

    const monthLabel = format(statsMonth, 'MMMM yyyy', { locale: ar });
    const hasData    = myStats && myStats.sessionDays > 0;

    return (
        <ProtectedPage>
            <div className="container mx-auto p-4 space-y-5 pb-24 max-w-7xl">

                {/* ── Header ── */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl border border-white/10 shadow-2xl">
                    <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-bold">بوابة المعلم</span>
                                <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full font-bold">{selectedGroup}</span>
                                <span className="text-xs bg-white/10 text-white/60 border border-white/20 px-3 py-1 rounded-full">{activeSheikh.displayName}</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white">إحصائيات الحلقة والأداء</h1>
                            <p className="text-white/50 text-sm mt-1">{groupStudents.length} طالب نشط · {monthLabel}</p>
                        </div>
                        <div className="relative flex flex-wrap items-center gap-2">
                            {isManagement && sheikhsList.length > 0 && (
                                <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}
                                    className="text-sm font-bold border rounded-xl px-4 py-2 bg-white/10 text-white border-white/20" dir="rtl">
                                    {sheikhsList.map(s => <option key={s.group} value={s.group}>{s.group} — {s.displayName}</option>)}
                                </select>
                            )}
                            <Button variant="outline" size="sm" onClick={handleExportPDF}
                                className="gap-2 h-10 border-white/20 bg-white/10 hover:bg-white/20 text-white">
                                <FileDown className="h-4 w-4" /> تصدير PDF
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Month Navigator ── */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border rounded-2xl p-3 shadow-sm">
                    <Button variant="ghost" size="sm" onClick={() => setStatsMonth(p => subMonths(p, 1))} className="gap-1 w-full sm:w-auto">
                        <ChevronRight className="h-4 w-4" /> السابق
                    </Button>
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-500" />
                        <select value={statsMonth.getMonth()}
                            onChange={e => { const d = new Date(statsMonth); d.setMonth(+e.target.value); setStatsMonth(d); }}
                            className="text-sm font-bold border rounded-lg px-2 py-1 bg-background" dir="rtl">
                            {ARABIC_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <select value={statsMonth.getFullYear()}
                            onChange={e => { const d = new Date(statsMonth); d.setFullYear(+e.target.value); setStatsMonth(d); }}
                            className="text-sm font-bold border rounded-lg px-2 py-1 bg-background" dir="rtl">
                            {Array.from({ length: 7 }, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setStatsMonth(p => addMonths(p, 1))} className="gap-1 w-full sm:w-auto">
                        التالي <ChevronLeft className="h-4 w-4" />
                    </Button>
                </div>

                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'حضور الطلاب',      value: `${myStats?.avgAttendance ?? 0}%`,  icon: Users,        color: 'emerald', sub: 'متوسط الفوج' },
                        { label: 'التزام المعلم',     value: `${myStats?.commitmentRate ?? 0}%`, icon: CheckCircle2, color: 'indigo',  sub: 'نسبة الحصص' },
                        { label: 'الحفظ الممتاز',    value: `${myStats?.avgExcellent ?? 0}%`,   icon: Star,         color: 'amber',   sub: 'تقدير ممتاز' },
                        { label: 'الحصص المنعقدة',   value: String(myStats?.sessionDays ?? 0),  icon: Calendar,     color: 'rose',    sub: 'هذا الشهر' },
                    ].map(kpi => {
                        const Icon = kpi.icon;
                        const cls: Record<string, string> = {
                            emerald: 'from-emerald-50 border-emerald-200 text-emerald-600',
                            indigo:  'from-indigo-50 border-indigo-200 text-indigo-600',
                            amber:   'from-amber-50 border-amber-200 text-amber-600',
                            rose:    'from-rose-50 border-rose-200 text-rose-600',
                        };
                        const textCls = cls[kpi.color].split(' ').find(c => c.startsWith('text-')) || '';
                        return (
                            <Card key={kpi.label} className={cn('border bg-gradient-to-br to-white', cls[kpi.color])}>
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                                        <Icon className={cn('h-4 w-4', textCls)} />
                                    </div>
                                    <div className={cn('text-3xl font-black', textCls)}>{kpi.value}</div>
                                    <div className="text-[10px] text-muted-foreground mt-1">{kpi.sub}</div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* ── Tab Bar ── */}
                <div className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-2xl border overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 flex-shrink-0',
                                activeTab === tab.id
                                    ? 'bg-white shadow-sm text-indigo-700 border border-indigo-100'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                            )}>
                            {tab.icon} {tab.label}
                            {tab.id === 'warnings' && atRiskStudents.length > 0 && (
                                <span className="bg-rose-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                                    {atRiskStudents.length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ══════════════════════════════════════════════════════════
                    Tab: Overview
                ══════════════════════════════════════════════════════════ */}
                {activeTab === 'overview' && (
                    <div className="space-y-5 animate-in fade-in duration-300">
                        {!hasData ? (
                            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed">
                                <BookOpen className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="font-bold text-muted-foreground">لا توجد حصص مسجَّلة في {monthLabel}</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">ابدأ بتسجيل حصصك اليومية لتظهر الإحصائيات</p>
                            </div>
                        ) : (
                            <>
                                <Card>
                                    <CardHeader className="border-b bg-muted/20 pb-3">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Target className="h-4 w-4 text-indigo-500" />
                                            الملخص الأسبوعي — {monthLabel}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm" dir="rtl">
                                                <thead>
                                                    <tr className="border-b bg-muted/10 text-xs text-muted-foreground">
                                                        {['الأسبوع','الفترة','الحصص','الحضور','الممتاز','التقييم'].map(h => (
                                                            <th key={h} className={cn('p-3 font-semibold', h === 'الأسبوع' ? 'text-right' : 'text-center')}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {myStats!.weeklyBreakdown.map((w, i) => (
                                                        <tr key={i} className="hover:bg-muted/20 transition-colors">
                                                            <td className="p-3 font-bold">{w.label}</td>
                                                            <td className="p-3 text-center text-xs text-muted-foreground">{w.dateRange}</td>
                                                            <td className="p-3 text-center font-bold">{w.sessions}</td>
                                                            <td className="p-3 text-center">
                                                                {w.attendance !== null ? (
                                                                    <div className="inline-flex items-center gap-2">
                                                                        <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                                                                            <div className="h-full rounded-full" style={{
                                                                                width: `${w.attendance}%`,
                                                                                backgroundColor: w.attendance>=90?'#059669':w.attendance>=70?'#d97706':'#dc2626'
                                                                            }} />
                                                                        </div>
                                                                        <span className="font-bold text-xs" style={{
                                                                            color: w.attendance>=90?'#059669':w.attendance>=70?'#d97706':'#dc2626'
                                                                        }}>{w.attendance}%</span>
                                                                    </div>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="p-3 text-center font-bold text-blue-600 text-xs">
                                                                {w.excellent !== null ? `${w.excellent}%` : '—'}
                                                            </td>
                                                            <td className="p-3 text-center text-xs">
                                                                {w.sessions === 0 ? '—' :
                                                                 w.attendance && w.attendance >= 90 ? '🟢 ممتاز' :
                                                                 w.attendance && w.attendance >= 70 ? '🟡 جيد' : '🔴 ضعيف'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'أيام العطل',    value: myStats!.holidays, icon: '🏖️', bg: 'bg-sky-50 border-sky-200 text-sky-700' },
                                        { label: 'غياب الشيخ',    value: myStats!.absences, icon: '❌', bg: 'bg-rose-50 border-rose-200 text-rose-700' },
                                        { label: 'طلاب نشطون',   value: groupStudents.length, icon: '👥', bg: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                                    ].map(item => (
                                        <div key={item.label} className={cn('rounded-2xl border p-4 text-center', item.bg)}>
                                            <div className="text-2xl mb-1">{item.icon}</div>
                                            <div className="text-2xl font-black">{item.value}</div>
                                            <div className="text-xs mt-1 opacity-80">{item.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    Tab: Attendance Heatmap
                ══════════════════════════════════════════════════════════ */}
                {activeTab === 'attendance' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
                            <Eye className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                            <span>انقر على أي يوم في الخريطة لعرض قائمة حضور وغياب طلاب الفوج بالتفصيل</span>
                        </div>
                        <Card className="border shadow-sm">
                            <CardContent className="p-4">
                                <AttendanceHeatmap
                                    sheikhs={effectiveSheikhsList}
                                    getDayStats={getDayStats}
                                    groupFilter={selectedGroup}
                                    onDayClick={(dateStr) => setDayDetailDate(dateStr)}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    Tab: Students
                ══════════════════════════════════════════════════════════ */}
                {activeTab === 'students' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold">طلاب {selectedGroup}</h2>
                                <p className="text-xs text-muted-foreground">{groupStudents.length} طالب · {monthLabel} · انقر على طالب لعرض سجله التفصيلي</p>
                            </div>
                        </div>

                        {enrichedStudentStats.length === 0 ? (
                            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed">
                                <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground font-medium">لا يوجد طلاب نشطون</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {enrichedStudentStats.map((st, idx) => {
                                    const attColor  = st.attendanceRate >= 90 ? '#059669' : st.attendanceRate >= 70 ? '#d97706' : '#dc2626';
                                    const TrendIcon = st.trend === 'up' ? TrendingUp : st.trend === 'down' ? TrendingDown : Minus;
                                    const trendCls  = st.trend === 'up' ? 'text-emerald-500' : st.trend === 'down' ? 'text-rose-500' : 'text-slate-400';

                                    return (
                                        <button key={st.id} onClick={() => setSelectedStudentId(st.id)}
                                            className="text-right w-full p-4 bg-card rounded-2xl border shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-200 group">
                                            {/* Top row */}
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className={cn(
                                                    'w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0',
                                                    idx === 0 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300' :
                                                    idx === 1 ? 'bg-slate-100 text-slate-600' :
                                                    idx === 2 ? 'bg-orange-100 text-orange-600' :
                                                    'bg-muted text-muted-foreground text-xs'
                                                )}>
                                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-bold text-sm truncate">{st.name}</span>
                                                        <TrendIcon className={cn('h-3.5 w-3.5 flex-shrink-0', trendCls)} aria-label={st.trend === 'up' ? 'في تحسن' : st.trend === 'down' ? 'في تراجع' : 'مستقر'} />
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                        {st.presentCount + st.lateCount} حضر · {st.absentCount} غياب · جودة الحفظ: {st.memorizationRate}% {st.behaviorRate > 0 ? `· السلوك: ${st.behaviorRate}%` : ''}
                                                    </div>
                                                </div>
                                                <div className="text-left flex-shrink-0 flex gap-3">
                                                    <div className="text-center">
                                                        <div className="font-black text-base md:text-lg leading-none text-indigo-600 dark:text-indigo-400">{st.academicScore}%</div>
                                                        <div className="text-[9px] text-muted-foreground mt-0.5">التقييم الأكاديمي</div>
                                                    </div>
                                                    <div className="text-center border-r pr-3">
                                                        <div className="font-black text-base md:text-lg leading-none" style={{ color: attColor }}>{st.attendanceRate}%</div>
                                                        <div className="text-[9px] text-muted-foreground mt-0.5">المواظبة</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Attendance bar */}
                                            <div className="mb-2">
                                                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                                                    <span>الحضور</span><span>{st.presentCount + st.lateCount}/{st.totalSessions}</span>
                                                </div>
                                                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${st.attendanceRate}%`, backgroundColor: attColor }} />
                                                </div>
                                            </div>

                                            {/* Memorization distribution bar */}
                                            {st.totalSessions > 0 && (
                                                <div className="mb-3">
                                                    <div className="text-[10px] text-muted-foreground mb-0.5">توزيع الحفظ</div>
                                                    <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
                                                        {[
                                                            { c: st.excellentCount,  color: '#059669' },
                                                            { c: st.veryGoodCount,   color: '#10b981' },
                                                            { c: st.goodCount,       color: '#84cc16' },
                                                            { c: st.acceptableCount, color: '#f59e0b' },
                                                            { c: st.weakCount,       color: '#ef4444' },
                                                            { c: st.absentCount,     color: '#e2e8f0' },
                                                        ].map((seg, i) => seg.c > 0 && (
                                                            <div key={i} className="h-full"
                                                                style={{ width: `${(seg.c / st.totalSessions) * 100}%`, backgroundColor: seg.color }} />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Last 6 session dots */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[9px] text-muted-foreground flex-shrink-0">آخر جلسات:</span>
                                                {st.lastSessions.map((s, i) => {
                                                    const isAbs  = s.attendance === 'غائب';
                                                    const dotClr = isAbs ? '#fca5a5' :
                                                        s.score === 6 ? '#059669' : s.score === 5 ? '#10b981' :
                                                        s.score === 4 ? '#84cc16' : s.score === 3 ? '#f59e0b' :
                                                        s.score !== null ? '#f97316' : '#94a3b8';
                                                    return (
                                                        <div key={i} title={`${s.date}: ${isAbs ? 'غائب' : s.memorization || '—'}`}
                                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                                            style={{ backgroundColor: dotClr }} />
                                                    );
                                                })}
                                            </div>

                                            <div className="mt-2 text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                <Eye className="h-3 w-3" /> انقر لعرض السجل الكامل
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Progress chart */}
                        <Card className="border shadow-sm mt-4">
                            <CardHeader className="border-b bg-muted/20">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-indigo-500" />
                                    منحنى تطور الحفظ لكل طالب
                                </CardTitle>
                                <CardDescription className="text-xs">اختر طالباً لمقارنة مسيرته بمتوسط الفوج</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4">
                                <StudentProgressChart
                                    sheikhs={effectiveSheikhsList}
                                    students={students || []}
                                    dailySessions={adaptedDailySessions}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    Tab: Warnings
                ══════════════════════════════════════════════════════════ */}
                {activeTab === 'warnings' && (
                    <Card className="border shadow-sm animate-in fade-in duration-300">
                        <CardHeader className="border-b bg-muted/20">
                            <CardTitle className="text-sm font-bold text-rose-600 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                طلاب يحتاجون متابعة — الأسبوعين الأخيرين
                            </CardTitle>
                            <CardDescription className="text-xs">
                                {atRiskStudents.length === 0
                                    ? '✅ جميع الطلاب في وضع جيد'
                                    : `${atRiskStudents.filter(s=>s.riskLevel==='high').length} في خطر عالٍ · ${atRiskStudents.filter(s=>s.riskLevel==='medium').length} يحتاج انتباهاً`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4">
                            <EarlyWarningView
                                atRiskStudents={atRiskStudents}
                                sheikhs={effectiveSheikhsList}
                                onStudentClick={(id) => { setSelectedStudentId(id); setActiveTab('students'); }}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* ══════════════════════════════════════════════════════════
                    Tab: Sheikh Evaluation
                ══════════════════════════════════════════════════════════ */}
                {activeTab === 'sheikh_eval' && (
                    <div className="space-y-5 animate-in fade-in duration-300">
                        {mySheikhScore ? (
                            <>
                                {/* Top Score card */}
                                <Card className="border-none shadow-xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 text-white relative overflow-hidden rounded-3xl">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none" />
                                    <CardContent className="p-6 relative z-10">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white text-3xl">
                                                    🏆
                                                </div>
                                                <div>
                                                    <h2 className="text-xl font-headline font-black">{mySheikhScore.displayName}</h2>
                                                    <p className="text-indigo-200 text-xs mt-1 font-medium">مستوى الأداء والترتيب لشهر {monthLabel}</p>
                                                    
                                                    {/* Badges list */}
                                                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                                                        {mySheikhScore.badges.map((badge: any, idx: number) => (
                                                            <span key={idx} className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border", badge.colorClass)} title={badge.description}>
                                                                {badge.icon} {badge.label}
                                                            </span>
                                                        ))}
                                                        {mySheikhScore.badges.length === 0 && (
                                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-1 rounded-lg">لا توجد شارات نشطة بعد</span>
                                                        )}
                                                    </div>

                                                    <div className="mt-3">
                                                        <Button 
                                                            size="sm" 
                                                            onClick={() => setShowDetailedModal(true)}
                                                            className="h-8 text-xs bg-indigo-650 hover:bg-indigo-700 text-white font-bold gap-1.5 rounded-xl border border-indigo-500/20 shadow-sm transition-all duration-300"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" /> عرض سجل الحصص والتقييم المفصل للشيخ
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6 self-stretch md:self-auto justify-between border-t md:border-t-0 md:border-r border-white/10 pt-4 md:pt-0 md:pr-6">
                                                <div className="text-center">
                                                    <div className="text-4xl font-headline font-black text-indigo-400">{mySheikhScore.totalPoints}</div>
                                                    <div className="text-[10px] text-white/50 mt-1 font-bold">مجموع النقاط</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-4xl font-headline font-black text-emerald-400">#{mySheikhScore.rank}</div>
                                                    <div className="text-[10px] text-white/50 mt-1 font-bold">الترتيب العام</div>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                                    {/* Breakdown Column */}
                                    <div className="lg:col-span-3 space-y-4">
                                        <h3 className="font-headline font-black text-base text-slate-800">📊 تفاصيل وتوزيع النقاط</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {[
                                                { label: 'نقاط تسجيل الحصص', val: mySheikhScore.sessionPoints, max: 24 * weights.sessionWeight, sub: `${mySheikhScore.totalSessions} حصة مسجلة`, icon: '📝', desc: `${weights.sessionWeight} نقطة عن كل حصة مؤداة` },
                                                { label: 'حضور طلاب الفوج', val: mySheikhScore.attendancePoints, max: 24 * weights.attendanceWeight, sub: `متوسط حضور: ${mySheikhScore.avgAttendance}%`, icon: '👥', desc: `تناسب طردي مع نسبة الحضور والحصص` },
                                                { label: 'التزام الشيخ وغيابه', val: mySheikhScore.commitmentPoints, max: weights.commitmentBase + weights.commitmentBonus, sub: `التزام: ${mySheikhScore.commitmentRate}% · غياب: ${mySheikhScore.sheikhabsences}`, icon: '🚫', desc: `بونص للالتزام الكامل وعقوبة للغياب` },
                                                { label: 'جودة وتسميع الفوج', val: mySheikhScore.excellencePoints, max: 24 * weights.excellentBonus, sub: `ممتاز: ${mySheikhScore.avgExcellent}% · ج.جداً: ${mySheikhScore.avgGoodPlus}%`, icon: '⚖️', desc: `نقاط إضافية لطلاب الممتاز والجيد جداً` },
                                                { label: 'بونص الحصص الإضافية', val: mySheikhScore.extraSessionBonus, max: 40, sub: `${mySheikhScore.extraSessionsCount} حصة إضافية/تعويضية`, icon: '➕', desc: `${weights.extraSessionBonus} نقاط عن كل حصة تعويضية` },
                                                { label: 'بونص التوثيق السريع', val: mySheikhScore.punctualityBonus, max: 120, sub: `${mySheikhScore.punctualSessionsCount} حصة موثقة سريعاً`, icon: '⚡', desc: `توثيق الحصة خلال 36 ساعة من موعدها` },
                                            ].map(item => (
                                                <Card key={item.label} className="border shadow-sm">
                                                    <CardContent className="p-4 space-y-2.5">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xl">{item.icon}</span>
                                                                <span className="text-xs font-bold text-slate-800">{item.label}</span>
                                                            </div>
                                                            <span className="font-black text-sm text-indigo-700">+{item.val}</span>
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground font-semibold">{item.sub}</div>
                                                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(100, (item.val / Math.max(1, item.max)) * 100)}%` }} />
                                                        </div>
                                                        <div className="text-[9px] text-muted-foreground/80 leading-normal">{item.desc}</div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Leaderboard Column */}
                                    <div className="lg:col-span-2 space-y-4">
                                        <h3 className="font-headline font-black text-base text-slate-800">🏆 جدول ترتيب المشايخ والتقييم الشهري</h3>
                                        <Card className="border shadow-sm overflow-hidden">
                                            <CardContent className="p-0">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm" dir="rtl">
                                                        <thead>
                                                            <tr className="border-b bg-muted/10 text-xs text-muted-foreground">
                                                                <th className="p-3 text-right font-bold w-12">الترتيب</th>
                                                                <th className="p-3 text-right font-bold">الشيخ</th>
                                                                <th className="p-3 text-center font-bold w-16">الفوج</th>
                                                                <th className="p-3 text-center font-bold w-20">النقاط</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y">
                                                            {sheikhScores.map((s, idx) => {
                                                                const isMe = s.group === selectedGroup;
                                                                const isPodium = s.rank <= 3;
                                                                const podiumEmojis = ['🥇', '🥈', '🥉'];
                                                                return (
                                                                    <tr key={s.group} className={cn(
                                                                        "transition-colors",
                                                                        isMe ? "bg-indigo-500/10 font-bold hover:bg-indigo-500/15" : "hover:bg-muted/10"
                                                                    )}>
                                                                        <td className="p-3 text-right">
                                                                            {isPodium ? (
                                                                                <span className="text-base" title={`المركز ${s.rank}`}>{podiumEmojis[s.rank - 1]}</span>
                                                                            ) : (
                                                                                <span className="text-xs text-muted-foreground">#{s.rank}</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="p-3 text-right">
                                                                            <div className="truncate text-xs">{s.displayName}</div>
                                                                        </td>
                                                                        <td className="p-3 text-center text-xs">
                                                                            <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-bold text-muted-foreground">{s.group}</span>
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <span className={cn(
                                                                                "font-black text-xs",
                                                                                isMe ? "text-indigo-700" : "text-slate-700"
                                                                            )}>{s.totalPoints}</span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed">
                                <Trophy className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="font-bold text-muted-foreground">لا توجد بيانات تقييم للشيخ في {monthLabel}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    Tab: Honor Cards
                ══════════════════════════════════════════════════════════ */}
                {activeTab === 'honor' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div>
                            <h2 className="text-lg font-bold">بطاقات الشرف — {monthLabel}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">تكريم المجتهدين في {selectedGroup}</p>
                        </div>
                        {enrichedStudentStats.length === 0 ? (
                            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed">
                                <Award className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground">لا يوجد طلاب</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {enrichedStudentStats.map(st => (
                                    <div key={st.id} className={cn(
                                        'p-5 rounded-2xl border transition-all hover:shadow-lg',
                                        st.attendanceRate >= 90 ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200' : 'bg-card hover:border-indigo-200'
                                    )}>
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <div className="font-bold text-sm">{st.name}</div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    حضور {st.attendanceRate}% · ممتاز {st.excellentCount} · غياب {st.absentCount}
                                                </div>
                                            </div>
                                            <span className="text-2xl">{st.attendanceRate>=90?'🏆':st.attendanceRate>=70?'🌟':'📚'}</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            {[
                                                { label: 'الحضور', value: `${st.attendanceRate}%`, color: st.attendanceRate>=90?'text-emerald-600':'text-amber-600' },
                                                { label: 'ممتاز',  value: st.excellentCount,       color: 'text-indigo-600' },
                                                { label: 'الغياب', value: st.absentCount,           color: st.absentCount===0?'text-emerald-600':'text-rose-600' },
                                            ].map(s => (
                                                <div key={s.label} className="text-center bg-white/60 rounded-xl p-2 border border-white">
                                                    <div className={cn('font-black text-base', s.color)}>{s.value}</div>
                                                    <div className="text-[9px] text-muted-foreground">{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <Button size="sm" onClick={() => setStudentHonorCard({
                                            type: 'student_excellence',
                                            name: st.name,
                                            group: selectedGroup,
                                            subtitle: st.attendanceRate >= 90 ? '🏆 نجم التميز والالتزام' : '⭐ طالب مجتهد',
                                            month: monthLabel,
                                            schoolName: 'مدرسة الإمام الشافعي القرآنية',
                                            stats: [
                                                { label: 'نسبة الحضور',   value: `${st.attendanceRate}%` },
                                                { label: 'تقييم ممتاز',   value: `${st.excellentCount} حصة` },
                                                { label: 'إجمالي الحصص', value: `${st.totalSessions} حصة` },
                                                { label: 'أيام الغياب',   value: `${st.absentCount} يوم` },
                                            ]
                                        })}
                                            className="w-full h-8 text-xs bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold gap-1.5">
                                            <Award className="h-3 w-3" /> توليد بطاقة تكريم
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    Tab: Month Comparison & Peak Performance
                ══════════════════════════════════════════════════════════ */}
                {activeTab === 'month_comparison' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {activeMonths.length === 0 ? (
                            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed">
                                <TrendingUp className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="font-bold text-muted-foreground">لا توجد بيانات كافية لمقارنة الأشهر حتى الآن</p>
                                <p className="text-xs text-muted-foreground/50 mt-1">
                                    قم بتسجيل حصص الحلقة اليومية على مدار الأشهر لتظهر مقارنات الأداء والتحليلات البيانية هنا.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Golden Peaks Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* Peak 1: Best Overall (Points) */}
                                    <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-5 rounded-2xl border border-indigo-500/25 shadow-lg group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl" />
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-xs text-indigo-300 font-bold bg-indigo-500/20 px-2.5 py-0.5 rounded-full">القمة الذهبية تقييماً</span>
                                            <span className="text-2xl">🏆</span>
                                        </div>
                                        {bestMonthOverall ? (
                                            <>
                                                <div className="text-3xl font-black text-indigo-300">{bestMonthOverall.totalPoints} <span className="text-xs font-bold text-white/50">نقطة</span></div>
                                                <div className="text-sm font-bold mt-2">{bestMonthOverall.monthName}</div>
                                                <div className="text-[10px] text-white/60 mt-1">الذروة التاريخية للأداء العام للفوج والمعلم.</div>
                                            </>
                                        ) : (
                                            <span className="text-xs text-white/50">لا يوجد بيانات</span>
                                        )}
                                    </div>

                                    {/* Peak 2: Best Attendance */}
                                    <div className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 text-white p-5 rounded-2xl border border-emerald-500/25 shadow-lg group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl" />
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-xs text-emerald-300 font-bold bg-emerald-500/20 px-2.5 py-0.5 rounded-full">القمة حضوراً للطلاب</span>
                                            <span className="text-2xl">👑</span>
                                        </div>
                                        {bestMonthAttendance ? (
                                            <>
                                                <div className="text-3xl font-black text-emerald-300">{bestMonthAttendance.avgAttendance}%</div>
                                                <div className="text-sm font-bold mt-2">{bestMonthAttendance.monthName}</div>
                                                <div className="text-[10px] text-white/60 mt-1">أعلى معدل انضباط وتواجد لطلاب الفوج.</div>
                                            </>
                                        ) : (
                                            <span className="text-xs text-white/50">لا يوجد بيانات</span>
                                        )}
                                    </div>

                                    {/* Peak 3: Best Sessions */}
                                    <div className="relative overflow-hidden bg-gradient-to-br from-blue-950 via-slate-900 to-blue-900 text-white p-5 rounded-2xl border border-blue-500/25 shadow-lg group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-500/10 rounded-full blur-xl" />
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-xs text-blue-300 font-bold bg-blue-500/20 px-2.5 py-0.5 rounded-full">الأكثر نشاطاً بالحصص</span>
                                            <span className="text-2xl">📚</span>
                                        </div>
                                        {bestMonthSessions ? (
                                            <>
                                                <div className="text-3xl font-black text-blue-300">{bestMonthSessions.totalSessions} <span className="text-xs font-bold text-white/50">حصة</span></div>
                                                <div className="text-sm font-bold mt-2">{bestMonthSessions.monthName}</div>
                                                <div className="text-[10px] text-white/60 mt-1">الشهر الأكثر عطاءً وتسجيلاً للحصص والأنشطة.</div>
                                            </>
                                        ) : (
                                            <span className="text-xs text-white/50">لا يوجد بيانات</span>
                                        )}
                                    </div>

                                    {/* Peak 4: Best Excellence */}
                                    <div className="relative overflow-hidden bg-gradient-to-br from-amber-950 via-slate-900 to-amber-900 text-white p-5 rounded-2xl border border-amber-500/25 shadow-lg group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-500/10 rounded-full blur-xl" />
                                        <div className="flex justify-between items-start mb-3">
                                            <span className="text-xs text-amber-300 font-bold bg-amber-500/20 px-2.5 py-0.5 rounded-full">القمة تميزاً وجودة</span>
                                            <span className="text-2xl">🌟</span>
                                        </div>
                                        {bestMonthExcellence ? (
                                            <>
                                                <div className="text-3xl font-black text-amber-300">{bestMonthExcellence.avgExcellent}%</div>
                                                <div className="text-sm font-bold mt-2">{bestMonthExcellence.monthName}</div>
                                                <div className="text-[10px] text-white/60 mt-1">أعلى معدل تسميع ممتاز وجودة حفظ للطلاب.</div>
                                            </>
                                        ) : (
                                            <span className="text-xs text-white/50">لا يوجد بيانات</span>
                                        )}
                                    </div>
                                </div>

                                {/* Smart Hero / Analysis Card */}
                                {bestMonthOverall && currentMonthStats && (
                                    <Card className="border shadow-lg relative overflow-hidden bg-gradient-to-l from-indigo-50/50 via-white to-white dark:from-slate-900/50">
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-600" />
                                        <CardContent className="p-6">
                                            <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-2xl flex-shrink-0 text-indigo-700">
                                                    💡
                                                </div>
                                                <div className="space-y-1.5 flex-1">
                                                    <h3 className="font-headline font-black text-base text-slate-800">تحليل الذروة وتوجيهات الأداء</h3>
                                                    <div className="text-xs text-slate-600 leading-relaxed font-medium">
                                                        {bestMonthOverall.monthKey === currentMonthStats.monthKey ? (
                                                            <p className="text-emerald-700 font-bold flex items-center gap-1.5">
                                                                🎉 هنيئاً لك! أنت حالياً في ذروة أدائك التاريخية لهذا العام! شهر {currentMonthStats.monthName} يسجل أعلى النقاط التقييمية لك بـ {currentMonthStats.totalPoints} نقطة. حافظ على هذا التميز!
                                                            </p>
                                                        ) : (
                                                            <div>
                                                                <p className="mb-2 text-slate-800">
                                                                    أعلى تقييم حققته كان في شهر <span className="font-bold text-indigo-700">{bestMonthOverall.monthName}</span> بمجموع <span className="font-bold text-indigo-700">{bestMonthOverall.totalPoints} نقطة</span> (حضور طلاب الفوج: {bestMonthOverall.avgAttendance}%، عدد الجلسات: {bestMonthOverall.totalSessions}).
                                                                </p>
                                                                <p className="mb-2 text-slate-500">
                                                                    في هذا الشهر المختار ({currentMonthStats.monthName})، حصلت على <span className="font-bold text-slate-700">{currentMonthStats.totalPoints} نقطة</span>.
                                                                </p>
                                                                
                                                                {/* Difference breakdown */}
                                                                <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 mt-3 space-y-2">
                                                                    <div className="font-bold text-[11px] text-slate-800 mb-1">لكي تتفوق وتكسر رقمك القياسي السابق، ننصح بـ:</div>
                                                                    <ul className="space-y-1.5 list-disc list-inside text-[11px] text-slate-700">
                                                                        {bestMonthOverall.totalSessions > currentMonthStats.totalSessions && (
                                                                            <li>
                                                                                زيادة عدد الحصص بمقدار <span className="font-bold text-blue-600">{bestMonthOverall.totalSessions - currentMonthStats.totalSessions} حصة</span> (لتصل إلى {bestMonthOverall.totalSessions} حصة كالشهر القياسي).
                                                                            </li>
                                                                        )}
                                                                        {bestMonthOverall.avgAttendance > currentMonthStats.avgAttendance && (
                                                                            <li>
                                                                                رفع معدل حضور الطلاب بمقدار <span className="font-bold text-emerald-600">{bestMonthOverall.avgAttendance - currentMonthStats.avgAttendance}%</span> (لتصل إلى {bestMonthOverall.avgAttendance}% من خلال متابعة الغائبين هاتفياً).
                                                                            </li>
                                                                        )}
                                                                        {bestMonthOverall.avgExcellent > currentMonthStats.avgExcellent && (
                                                                            <li>
                                                                                تحسين تميز الطلاب وزيادة نسبة تقدير "ممتاز" بمقدار <span className="font-bold text-amber-600">{bestMonthOverall.avgExcellent - currentMonthStats.avgExcellent}%</span> (من خلال التشجيع وتكثيف المراجعة).
                                                                            </li>
                                                                        )}
                                                                        {bestMonthOverall.totalPoints > currentMonthStats.totalPoints && 
                                                                         bestMonthOverall.totalSessions <= currentMonthStats.totalSessions && 
                                                                         bestMonthOverall.avgAttendance <= currentMonthStats.avgAttendance && (
                                                                            <li>
                                                                                زيادة سرعة توثيق الحصص خلال 36 ساعة لكسب "بونص التوثيق السريع" (+{weights.punctualityBonus} نقاط لكل حصة)، والحد من الغيابات الطارئة للشيخ.
                                                                            </li>
                                                                        )}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Comparison Chart Card */}
                                <Card className="border shadow-sm">
                                    <CardHeader className="border-b bg-muted/20">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                                            منحنى تطور النقاط والنشاط السنوي
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            مخطط بياني يوضح أداء الفوج والمعلم طوال أشهر السنة الجارية (العام المختار: {statsMonth.getFullYear()})
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4">
                                        <div className="h-[380px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <ComposedChart data={activeMonths} margin={{ top: 20, right: 5, left: 5, bottom: 5 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-muted/20" />
                                                    <XAxis dataKey="monthName" stroke="currentColor" className="text-muted-foreground text-[10px]" />
                                                    <YAxis yAxisId="left" stroke="currentColor" className="text-indigo-600 text-[10px]" label={{ value: 'النقاط الإجمالية', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#4f46e5', fontSize: 10, fontWeight: 'bold' } }} />
                                                    <YAxis yAxisId="right" orientation="right" stroke="currentColor" className="text-emerald-600 text-[10px]" label={{ value: 'الحضور والحصص', angle: 90, position: 'insideRight', style: { textAnchor: 'middle', fill: '#059669', fontSize: 10, fontWeight: 'bold' } }} />
                                                    <RechartsTooltip content={<CustomChartTooltip />} />
                                                    <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                                                    <Bar yAxisId="right" dataKey="totalSessions" name="عدد الحصص" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={25} />
                                                    <Line yAxisId="right" type="monotone" dataKey="avgAttendance" name="حضور الطلاب (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                    <Line yAxisId="left" type="monotone" dataKey="totalPoints" name="النقاط الكلية" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                                </ComposedChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Monthly Comparison Table */}
                                <Card className="border shadow-sm">
                                    <CardHeader className="border-b bg-muted/20">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <Users className="h-4 w-4 text-indigo-500" />
                                            جدول التقييم والمقارنة السنوي للأفواج
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            قارن إحصائيات الأشهر وسجلاتها وقم بالانتقال السريع لأي شهر لعرض تفاصيله
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-right" dir="rtl">
                                                <thead>
                                                    <tr className="border-b bg-muted/10 text-xs text-muted-foreground">
                                                        <th className="p-3 font-bold">الشهر</th>
                                                        <th className="p-3 font-bold text-center">النقاط الكلية</th>
                                                        <th className="p-3 font-bold text-center">الحصص</th>
                                                        <th className="p-3 font-bold text-center">حضور الطلاب</th>
                                                        <th className="p-3 font-bold text-center">نسبة الممتاز</th>
                                                        <th className="p-3 font-bold text-center">التزام الشيخ</th>
                                                        <th className="p-3 font-bold text-center">الشارات</th>
                                                        <th className="p-3 font-bold text-center">إجراءات</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y">
                                                    {yearlyMonthlyStats.map((item) => {
                                                        const isSelected = format(statsMonth, 'yyyy-MM') === item.monthKey;
                                                        const isPeak = bestMonthOverall && bestMonthOverall.monthKey === item.monthKey;
                                                        
                                                        return (
                                                            <tr key={item.monthKey} className={cn(
                                                                "transition-colors",
                                                                !item.hasData ? "opacity-45 hover:bg-slate-50/50" : "hover:bg-slate-50/80",
                                                                isSelected && "bg-indigo-500/10 font-bold"
                                                            )}>
                                                                <td className="p-3">
                                                                    <div className="flex items-center gap-2 font-bold text-slate-800">
                                                                        <span>{item.monthName}</span>
                                                                        {isPeak && <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded font-black flex items-center gap-0.5">👑 الذروة</span>}
                                                                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-650" />}
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="font-black text-indigo-700">{item.hasData ? `+${item.totalPoints}` : '—'}</span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="font-semibold">{item.hasData ? `${item.totalSessions} حصة` : '—'}</span>
                                                                    {item.extraSessionsCount > 0 && <span className="text-[10px] text-blue-600 block">(+{item.extraSessionsCount} إضافية)</span>}
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    {item.hasData ? (
                                                                        <span className={cn(
                                                                            "font-bold text-xs",
                                                                            item.avgAttendance >= 90 ? "text-emerald-600" : item.avgAttendance >= 70 ? "text-amber-600" : "text-rose-600"
                                                                        )}>{item.avgAttendance}%</span>
                                                                    ) : '—'}
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="font-bold text-amber-600">{item.hasData ? `${item.avgExcellent}%` : '—'}</span>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <span className="font-bold text-slate-700">{item.hasData ? `${item.commitmentRate}%` : '—'}</span>
                                                                    {item.sheikhabsences > 0 && <span className="text-[9px] text-rose-600 block">(غياب: {item.sheikhabsences})</span>}
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {item.badges.map((b: any, i: number) => (
                                                                            <span key={i} className="text-sm" title={b.label}>{b.icon}</span>
                                                                        ))}
                                                                        {item.hasData && item.badges.length === 0 && <span className="text-xs text-muted-foreground/50">—</span>}
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 text-center">
                                                                    {item.hasData ? (
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <Button 
                                                                                size="sm"
                                                                                variant="outline"
                                                                                onClick={() => {
                                                                                    const d = new Date(statsMonth);
                                                                                    d.setMonth(item.monthIndex);
                                                                                    setStatsMonth(d);
                                                                                }}
                                                                                disabled={isSelected}
                                                                                className="h-7 text-[10px] px-2.5 rounded-lg font-bold"
                                                                            >
                                                                                تحديد الشهر
                                                                            </Button>
                                                                            <Button 
                                                                                size="sm"
                                                                                onClick={() => {
                                                                                    const d = new Date(statsMonth);
                                                                                    d.setMonth(item.monthIndex);
                                                                                    setStatsMonth(d);
                                                                                    setActiveTab('sheikh_eval');
                                                                                }}
                                                                                className="h-7 text-[10px] px-2.5 bg-indigo-650 hover:bg-indigo-700 text-white rounded-lg font-bold"
                                                                            >
                                                                                عرض التقييم 👁️
                                                                            </Button>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-muted-foreground/40 font-semibold">بلا بيانات</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                )}

                {/* ── Modals ── */}
                {dayDetailDate && dayDetailData && (
                    <DayAttendanceModal data={dayDetailData} onClose={() => setDayDetailDate(null)} />
                )}

                {selectedStudentId && selectedStudentDetail && (
                    <StudentDetailModal
                        student={selectedStudentDetail}
                        sessionHistory={studentSessionHistory}
                        onClose={() => setSelectedStudentId(null)}
                    />
                )}

                {studentHonorCard && (
                    <HonorCardGenerator data={studentHonorCard} onClose={() => setStudentHonorCard(null)} />
                )}

                {showDetailedModal && mySheikhScore && (
                    <SheikhScoreDetailModal
                        sheikh={mySheikhScore}
                        getDayStats={getDayStatsForScore}
                        selectedDate={statsMonth}
                        onClose={() => setShowDetailedModal(false)}
                        weights={weights}
                    />
                )}

            </div>
        </ProtectedPage>
    );
}
