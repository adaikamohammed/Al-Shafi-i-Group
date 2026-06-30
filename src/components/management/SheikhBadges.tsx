"use client";

import React, { useMemo, useRef, useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getYear, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
    Trophy, Crown, Medal, Star, Award, Flame, Target, Sparkles,
    BookOpen, Users, TrendingUp, TrendingDown, Minus, Calendar, CheckCircle, Zap, ImageDown, Info, ShieldAlert, Share2,
    SlidersHorizontal, Download, Goal, ChevronDown, ChevronUp, RotateCcw, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HonorCardGenerator, HonorCardData } from './HonorCardGenerator';
import { db } from '@/lib/firebase';
import { ref, set, onValue } from 'firebase/database';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoringWeights {
    sessionWeight: number;      // points per session (default: 15)
    attendanceWeight: number;   // max points per session for attendance (default: 12)
    extraSessionBonus: number;  // bonus points per extra session (default: 5)
    excellentBonus: number;     // points per session for excellent (default: 3)
    goodPlusBonus: number;      // points per session for good plus (default: 1.5)
    commitmentBonus: number;    // bonus points for 100% commitment (default: 40)
    commitmentBase: number;     // base points for commitment (default: 30)
    absencePenalty: number;     // penalty per absence (default: 20)
    punctualityBonus: number;   // max bonus per session for timely recording (default: 3)
    punctualityPenalty: number; // max penalty per session for very late recording (default: 2)
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
    sessionWeight: 15,
    attendanceWeight: 12,
    extraSessionBonus: 5,
    excellentBonus: 3,
    goodPlusBonus: 1.5,
    commitmentBonus: 40,
    commitmentBase: 30,
    absencePenalty: 20,
    punctualityBonus: 3,
    punctualityPenalty: 2,
};

interface SheikhScore {
    group: string;
    displayName: string;
    totalPoints: number;
    sessionPoints: number;
    excellencePoints: number;
    attendancePoints: number;
    commitmentPoints: number;
    extraSessionBonus: number;   // بونص الحصص الإضافية والتعويضية
    punctualityPoints: number;   // نقاط/خصم توقيت تسجيل الحصص
    punctualSessions: number;    // عدد الحصص الموثقة مبكراً (0-3 أيام)
    lateSessions: number;        // عدد الحصص الموثقة متأخراً (>7 أيام)
    totalSessions: number;
    basicSessions: number;        // عدد الحصص الأساسية/تعويضية/إضافية
    activitySessions: number;     // عدد حصص الأنشطة
    holidaySessions: number;      // عدد أيام العطلة
    totalDays: number;
    avgAttendance: number;
    avgExcellent: number;       // % students rated ممتاز
    avgGoodPlus: number;        // % students rated جيد جداً
    commitmentRate: number;     // % days sheikh held a session
    highAttDays: number;
    sheikhabsences: number;
    badges: BadgeInfo[];
    rank: number;
    podiumCounts: { first: number; second: number; third: number };
    extraSessionsCount: number;  // عدد الحصص التعويضية/الإضافية
}

interface BadgeInfo {
    icon: string;
    label: string;
    colorClass: string;
    glowClass: string;
    description: string;
}

interface SheikhBadgesProps {
    sheikhs: { group: string; displayName: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
    selectedDate: Date;
    dailySessions: any; // needed to read createdAt for punctuality scoring
}

// ─── Badge Definitions ────────────────────────────────────────────────────────

function computeBadges(s: Omit<SheikhScore, 'badges' | 'rank' | 'podiumCounts'>): BadgeInfo[] {
    const badges: BadgeInfo[] = [];

    if (s.commitmentRate >= 100 && s.totalSessions > 0)
        badges.push({ icon: '💎', label: 'التزام الشيخ الكامل', colorClass: 'bg-cyan-100 text-cyan-800 border-cyan-300', glowClass: 'shadow-cyan-200', description: 'حضر وسجّل جميع أيام العمل المطلوبة للشيخ' });

    // شارة التوثيق السريع: 80%+ من الحصص موثقة خلال 3 أيام
    const punctualityRatio = s.basicSessions > 0 ? s.punctualSessions / s.basicSessions : 0;
    if (punctualityRatio >= 0.8 && s.basicSessions >= 5)
        badges.push({ icon: '⚡', label: 'ثبات التوثيق السريع', colorClass: 'bg-yellow-100 text-yellow-800 border-yellow-300', glowClass: 'shadow-yellow-200', description: '80%+ من حصصه موثقة خلال 3 أيام من تاريخ الحصة' });

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

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    return (
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden w-full">
            <div
                className={cn('h-full rounded-full transition-all duration-700', colorClass)}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ─── Rank Medal ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
    if (rank === 1) return (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-200 text-white font-black text-lg">
            🥇
        </div>
    );
    if (rank === 2) return (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center shadow-lg shadow-slate-200 text-white font-black text-lg">
            🥈
        </div>
    );
    if (rank === 3) return (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-800 flex items-center justify-center shadow-lg shadow-orange-200 text-white font-black text-lg">
            🥉
        </div>
    );
    return (
        <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-muted/60 border flex items-center justify-center font-black text-muted-foreground text-sm">
            {rank}
        </div>
    );
}

/**
 * نظام تنقيط التوقيت المتدرج (4 مستويات):
 * يوم 0     → +punctualityBonus (3 نقاط افتراضياً)
 * يوم 1     → +punctualityBonus - 1
 * يوم 2-3   → +1 نقطة
 * يوم 4-7   → 0 (محايد)
 * يوم 8-14  → -1 نقطة
 * يوم 15+   → -punctualityPenalty (-2 نقطة افتراضياً)
 * بدون createdAt → 0 (للبيانات القديمة)
 */
const getSessionTimingPoints = (session: any, weights: ScoringWeights): number => {
    if (!session || !session.createdAt || !session.date) return 0; // بيانات قديمة = محايد
    try {
        const sessionDate = new Date(session.date + 'T00:00:00');
        const createdDate = new Date(session.createdAt);
        const diffDays = Math.floor((createdDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return weights.punctualityBonus; // سُجّل قبل تاريخ الحصة (مستحيل لكن آمن)
        if (diffDays === 0) return weights.punctualityBonus;        // ⚡ نفس اليوم
        if (diffDays === 1) return Math.max(1, weights.punctualityBonus - 1); // ✅ اليوم التالي
        if (diffDays <= 3)  return 1;                               // 📋 يوم 2-3
        if (diffDays <= 7)  return 0;                               // ⏳ يوم 4-7 محايد
        if (diffDays <= 14) return -1;                              // ⚠️ يوم 8-14
        return -weights.punctualityPenalty;                         // 🔴 بعد 14 يوم
    } catch (e) {
        return 0;
    }
};

// ─── Main Component ───────────────────────────────────────────────────────────

export function SheikhBadges({ sheikhs, getDayStats, selectedDate, dailySessions }: SheikhBadgesProps) {
    const { role } = useAuth();
    const isManagement = role === 'super_admin' || role === 'management';
    const printRef = useRef<HTMLDivElement>(null);
    const [showGuide, setShowGuide] = useState(false);
    const [showWeightsSim, setShowWeightsSim] = useState(false);
    const [showGoals, setShowGoals] = useState(false);
    const [honorCard, setHonorCard] = useState<HonorCardData | null>(null);
    const [selectedSheikhDetail, setSelectedSheikhDetail] = useState<SheikhScore | null>(null);
    // Phase 3: regression sort
    const [sortMode, setSortMode] = useState<'rank' | 'improvement' | 'regression'>('rank');

    const [weights, setWeights] = useState<ScoringWeights>(DEFAULT_WEIGHTS);
    const [isSavingWeights, setIsSavingWeights] = useState(false);
    // Phase 5: Monthly Goals
    const [goals, setGoals] = useState({ attendanceTarget: 85, excellentTarget: 25, commitmentTarget: 90 });
    const [isSavingGoals, setIsSavingGoals] = useState(false);

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
                    punctualityPenalty: typeof val.punctualityPenalty === 'number' ? val.punctualityPenalty : DEFAULT_WEIGHTS.punctualityPenalty,
                });
            } else {
                const local = localStorage.getItem('sheikh_scoring_weights');
                if (local) {
                    try {
                        setWeights(JSON.parse(local));
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const saveWeights = async () => {
        setIsSavingWeights(true);
        try {
            const weightsRef = ref(db, 'settings/sheikh_scoring_weights');
            await set(weightsRef, weights);
            localStorage.setItem('sheikh_scoring_weights', JSON.stringify(weights));
        } catch (e) {
            console.error("Failed to save weights", e);
        } finally {
            setIsSavingWeights(false);
        }
    };

    const resetWeights = async () => {
        setIsSavingWeights(true);
        try {
            const weightsRef = ref(db, 'settings/sheikh_scoring_weights');
            await set(weightsRef, DEFAULT_WEIGHTS);
            localStorage.setItem('sheikh_scoring_weights', JSON.stringify(DEFAULT_WEIGHTS));
            setWeights(DEFAULT_WEIGHTS);
        } catch (e) {
            console.error("Failed to reset weights", e);
        } finally {
            setIsSavingWeights(false);
        }
    };

    // Phase 5: Load / save Monthly Goals
    useEffect(() => {
        const monthKey = format(selectedDate, 'yyyy-MM');
        const goalsRef = ref(db, `settings/sheikh_goals/${monthKey}`);
        const unsub = onValue(goalsRef, (snap: any) => {
            if (snap.exists()) {
                const v = snap.val();
                setGoals({
                    attendanceTarget: typeof v.attendanceTarget === 'number' ? v.attendanceTarget : 85,
                    excellentTarget: typeof v.excellentTarget === 'number' ? v.excellentTarget : 25,
                    commitmentTarget: typeof v.commitmentTarget === 'number' ? v.commitmentTarget : 90,
                });
            } else {
                setGoals({ attendanceTarget: 85, excellentTarget: 25, commitmentTarget: 90 });
            }
        });
        return () => unsub();
    }, [selectedDate]);

    const saveGoals = async () => {
        setIsSavingGoals(true);
        try {
            const monthKey = format(selectedDate, 'yyyy-MM');
            const goalsRef = ref(db, `settings/sheikh_goals/${monthKey}`);
            await set(goalsRef, goals);
        } catch (e) {
            console.error('Failed to save goals', e);
        } finally {
            setIsSavingGoals(false);
        }
    };

    const openHonorCard = (s: SheikhScore) => {
        const typeMap: Record<number, HonorCardData['type']> = { 1: 'sheikh_first', 2: 'sheikh_second', 3: 'sheikh_third' };
        const cleanGroup = s.group.replace(/^فوج\s*/, '').trim();
        setHonorCard({
            type: typeMap[s.rank] || 'sheikh_first',
            name: s.displayName,
            group: `فوج ${cleanGroup}`,
            subtitle: s.rank === 1 ? '🏆 شيخ وفوج الشهر' : s.rank === 2 ? '🥈 المركز الثاني' : '🥉 المركز الثالث',
            month: format(selectedDate, 'MMMM yyyy', { locale: ar }),
            schoolName: 'المدرسة القرآنية للإمام الشافعي',
            stats: [
                { label: 'حصص مسجلة', value: String(s.totalSessions) },
                { label: 'حضور الطلاب', value: `${s.avgAttendance}%` },
                { label: 'التزام الشيخ', value: `${s.commitmentRate}%` },
                { label: 'مجموع النقاط', value: String(s.totalPoints) },
            ],
        });
    };

    // Explicit grid template columns used dynamically to bypass Tailwind JIT compilation limits
    const gridColumnsStyle = {
        display: 'grid',
        gridTemplateColumns: '45px 1.8fr 210px 85px 85px 80px 80px 80px',
        gap: '8px'
    };

    const scores = useMemo<SheikhScore[]>(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const activeYear = getYear(selectedDate);

        // ─── Calculate Monthly Rankings & Podium Statistics for the Active Year ───
        const monthsInYear = Array.from({ length: 12 }, (_, i) => i);
        const sheikhPodiumCounts: Record<string, { first: number, second: number, third: number }> = {};
        
        sheikhs.forEach(sh => {
            sheikhPodiumCounts[sh.group] = { first: 0, second: 0, third: 0 };
        });

        // Helper points system calculation formula used across both current month and historic calculations
        const calculatePoints = (data: {
            sessions: number;
            avgAttendance: number;
            avgExcellent: number;
            avgGoodPlus: number;
            commitmentRate: number;
            sheikhabsences: number;
            extraSessions: number;
            excCount: number;
            punctualityPoints: number; // صافي نقاط التوقيت المحسوبة مسبقاً
        }) => {
            // 1) نقاط تسجيل الحصص للشيخ (نشاط الشيخ وتوثيقه): weights.sessionWeight نقطة لكل حصة مسجلة للفوج
            const sessionPoints = data.sessions * weights.sessionWeight;

            // 2) نقاط حضور طلاب الفوج (مواظبة وحضور الفوج - موضوعي):
            // (متوسط حضور الطلاب / 100) × weights.attendanceWeight × عدد الحصص
            const attendancePoints = data.sessions > 0 ? Math.round((data.avgAttendance / 100) * weights.attendanceWeight * data.sessions) : 0;

            // 3) بونص الحصص الإضافية والتعويضية (موضوعي - نشاط الشيخ ومساعدته للطلاب):
            // weights.extraSessionBonus نقاط إضافية عن كل حصة تعويضية أو إضافية مسجلة
            const extraSessionBonus = data.extraSessions * weights.extraSessionBonus;

            // 4) بونص جودة تحفيظ الفوج:
            const excellenceBonus = data.excCount > 0 ? Math.round((data.avgExcellent / 100) * weights.excellentBonus * data.sessions) : 0;
            const goodPlusBonus = data.excCount > 0 ? Math.round((data.avgGoodPlus / 100) * weights.goodPlusBonus * data.sessions) : 0;
            const excellencePoints = excellenceBonus + goodPlusBonus;

            // 5) التزام الشيخ بالجدول وغيابه:
            const commitmentBonus = (data.commitmentRate >= 100 && data.sheikhabsences === 0 && data.sessions > 0) ? weights.commitmentBonus : 0;
            const absencePenalty = data.sheikhabsences * weights.absencePenalty;
            const commitmentBase = Math.round((data.commitmentRate / 100) * weights.commitmentBase);
            const commitmentPoints = Math.max(0, commitmentBase + commitmentBonus - absencePenalty);

            // 6) نقاط توقيت تسجيل الحصص (متدرج: +3 نفس اليوم إلى -2 بعد 14 يوم)
            const punctualityBonus = data.punctualityPoints; // محسوبة مسبقاً من dailySessions

            const totalPoints = sessionPoints + attendancePoints + extraSessionBonus + excellencePoints + commitmentPoints + punctualityBonus;

            return {
                totalPoints,
                sessionPoints,
                attendancePoints,
                extraSessionBonus,
                excellencePoints,
                commitmentPoints,
                punctualityPoints: punctualityBonus,
            };
        };

        monthsInYear.forEach(m => {
            const mStart = startOfMonth(new Date(activeYear, m, 1));
            const mEnd = endOfMonth(new Date(activeYear, m, 1));
            const mDays = eachDayOfInterval({ start: mStart, end: mEnd });

            const mScores = sheikhs.map(sh => {
                let sessions = 0, extraSessions = 0;
                let attTotal = 0, attCount = 0;
                let excTotal = 0, gpTotal = 0, excCount = 0;
                let sheikhabsences = 0, holidays = 0;
                mDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const stats = getDayStats(sh.group, dateStr);
                    if (!stats) return;

                    if (stats.type === 'يوم عطلة') { holidays++; return; }
                    if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }

                    const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                    const isActivity = stats.type === 'حصة أنشطة';
                    if (isReal) {
                        sessions++;
                        if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                            extraSessions++;
                        }
                        if (stats.attendance !== null) {
                            attTotal += stats.attendance;
                            attCount++;
                        }
                        if (stats.excellent !== null) {
                            excTotal += stats.excellent;
                            excCount++;
                        }
                        if (stats.goodPlus !== null) gpTotal += stats.goodPlus;
                    } else if (isActivity) {
                        // حصة أنشطة: تُحسب بوزن 0.8 من حصة عادية
                        sessions += 0.5;
                        if (stats.attendance !== null) {
                            attTotal += stats.attendance;
                            attCount++;
                        }
                    }
                });

                const workingDays = mDays.length - holidays - sheikhabsences;
                const avgAttendance = attCount > 0 ? Math.round(attTotal / attCount) : 0;
                const avgExcellent = excCount > 0 ? Math.round(excTotal / excCount) : 0;
                const avgGoodPlus = excCount > 0 ? Math.round(gpTotal / excCount) : 0;
                const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

                const pointsBreakdown = calculatePoints({
                    sessions,
                    avgAttendance,
                    avgExcellent,
                    avgGoodPlus,
                    commitmentRate,
                    sheikhabsences,
                    extraSessions,
                    excCount,
                    punctualityPoints: 0, // لا بيانات createdAt للشهور السابقة
                });

                return {
                    group: sh.group,
                    totalPoints: pointsBreakdown.totalPoints,
                    sessions
                };
            });

            // Sort and rank this month's sheikhs (only those who had sessions)
            const activeSheikhs = mScores.filter(s => s.sessions > 0);
            if (activeSheikhs.length > 0) {
                activeSheikhs.sort((a, b) => b.totalPoints - a.totalPoints);
                activeSheikhs.forEach((s, idx) => {
                    const rank = idx + 1;
                    if (sheikhPodiumCounts[s.group]) {
                        if (rank === 1) sheikhPodiumCounts[s.group].first++;
                        else if (rank === 2) sheikhPodiumCounts[s.group].second++;
                        else if (rank === 3) sheikhPodiumCounts[s.group].third++;
                    }
                });
            }
        });

        // ─── Current Month Detailed Calculations ───
        const rawScores = sheikhs.map(sh => {
            let sessions = 0, extraSessions = 0, highAttDays = 0, totalDays = 0;
            let basicCount = 0, activityCount = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
            allDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                totalDays++;
                if (!stats) return;

                if (stats.type === 'يوم عطلة') { holidays++; return; }
                if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }

                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                const isActivity = stats.type === 'حصة أنشطة';
                if (isReal) {
                    sessions++;
                    basicCount++;
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
                } else if (isActivity) {
                    // حصة أنشطة: تُحسب بوزن 0.8 من حصة عادية
                    sessions += 0.5;
                    activityCount++;
                    if (stats.attendance !== null) {
                        attTotal += stats.attendance;
                        attCount++;
                        if (stats.attendance >= 90) highAttDays++;
                    }
                }
            });

            // ─── حساب نقاط التوقيت من dailySessions ───
            let punctualityPoints = 0;
            let punctualSessions = 0;  // حصص موثقة خلال 3 أيام (نقاط إيجابية)
            let lateSessions = 0;      // حصص موثقة بعد 7 أيام (خصم)
            if (dailySessions) {
                allDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const daySess = (dailySessions as any)[dateStr];
                    if (!daySess) return;
                    // الحصل على الجلسة التي تخص هذا الشيخ (session 1 أو أول جلسة متاحة)
                    const sessions_for_day = Object.values(daySess as Record<string, any>).filter(
                        (s: any) => sh.uids.has(s.ownerId)
                    );
                    if (!sessions_for_day.length) return;
                    const session = sessions_for_day.find((s: any) => s.sessionNumber === 1) || sessions_for_day[0];
                    if (!session) return;
                    // تحقق من نوع الحصة (أساسية فقط لتنقيط التوقيت)
                    const sType = session.sessionType;
                    const isReal2 = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية' || sType === 'حصة أنشطة';
                    if (!isReal2) return;
                    const pts = getSessionTimingPoints(session, weights);
                    punctualityPoints += pts;
                    if (pts > 0) punctualSessions++;
                    else if (pts < 0) lateSessions++;
                });
            }

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
                punctualityPoints,
            });

            const base: Omit<SheikhScore, 'badges' | 'rank' | 'podiumCounts'> = {
                group: sh.group,
                displayName: sh.displayName,
                totalPoints: pts.totalPoints,
                sessionPoints: pts.sessionPoints,
                excellencePoints: pts.excellencePoints,
                attendancePoints: pts.attendancePoints,
                commitmentPoints: pts.commitmentPoints,
                extraSessionBonus: pts.extraSessionBonus,
                punctualityPoints: pts.punctualityPoints,
                punctualSessions,
                lateSessions,
                totalSessions: sessions,
                basicSessions: basicCount,
                activitySessions: activityCount,
                holidaySessions: holidays,
                totalDays,
                avgAttendance,
                avgExcellent,
                avgGoodPlus,
                commitmentRate,
                highAttDays,
                sheikhabsences,
                extraSessionsCount: extraSessions
            };

            return {
                ...base,
                badges: computeBadges(base),
                podiumCounts: sheikhPodiumCounts[sh.group] || { first: 0, second: 0, third: 0 },
                rank: 0
            };
        });

        // Sort and assign ranks
        rawScores.sort((a, b) => b.totalPoints - a.totalPoints);
        rawScores.forEach((s, i) => { s.rank = i + 1; });

        return rawScores;
    }, [sheikhs, getDayStats, selectedDate, weights, dailySessions]);

    // Sync computed scores to firebase database so they can be viewed by sheikhs
    useEffect(() => {
        if (!scores || scores.length === 0 || !isManagement) return;
        const monthKey = format(selectedDate, 'yyyy-MM');
        const scoresRef = ref(db, `sheikh_scores/${monthKey}`);
        
        const serialized = scores.map(s => ({
            group: s.group,
            displayName: s.displayName,
            totalPoints: s.totalPoints,
            sessionPoints: s.sessionPoints,
            excellencePoints: s.excellencePoints,
            attendancePoints: s.attendancePoints,
            commitmentPoints: s.commitmentPoints,
            extraSessionBonus: s.extraSessionBonus,
            punctualityPoints: s.punctualityPoints,
            punctualSessions: s.punctualSessions,
            lateSessions: s.lateSessions,
            totalSessions: s.totalSessions,
            totalDays: s.totalDays,
            avgAttendance: s.avgAttendance,
            avgExcellent: s.avgExcellent,
            avgGoodPlus: s.avgGoodPlus,
            commitmentRate: s.commitmentRate,
            highAttDays: s.highAttDays,
            sheikhabsences: s.sheikhabsences,
            rank: s.rank,
            podiumCounts: s.podiumCounts,
            extraSessionsCount: s.extraSessionsCount,            badges: s.badges.map(b => ({
                icon: b.icon,
                label: b.label,
                colorClass: b.colorClass,
                glowClass: b.glowClass,
                description: b.description
            }))
        }));

        set(scoresRef, serialized).catch((err: any) => {
            console.error("Failed to sync sheikh scores to Firebase:", err);
        });
    }, [scores, selectedDate, isManagement]);

    // Phase 3: Calculate previous month scores for regression comparison
    const prevMonthScores = useMemo<Record<string, number>>(() => {
        const prevDate = subMonths(selectedDate, 1);
        const prevStart = startOfMonth(prevDate);
        const prevEnd = endOfMonth(prevDate);
        const prevDays = eachDayOfInterval({ start: prevStart, end: prevEnd });
        const result: Record<string, number> = {};

        sheikhs.forEach(sh => {
            let sessions = 0, extraSessions = 0;
            let attTotal = 0, attCount = 0;
            let excTotal = 0, gpTotal = 0, excCount = 0;
            let sheikhabsences = 0, holidays = 0;
            prevDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                if (!stats) return;
                if (stats.type === 'يوم عطلة') { holidays++; return; }
                if (stats.type === 'غياب الشيخ') { sheikhabsences++; return; }
                const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                const isActivity = stats.type === 'حصة أنشطة';
                if (isReal) {
                    sessions++;
                    if (stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') extraSessions++;
                    if (stats.attendance !== null) { attTotal += stats.attendance; attCount++; }
                    if (stats.excellent !== null) { excTotal += stats.excellent; excCount++; }
                    if (stats.goodPlus !== null) gpTotal += stats.goodPlus;                } else if (isActivity) {
                    // حصة أنشطة: تُحسب بوزن 0.8
                    sessions += 0.5;
                    if (stats.attendance !== null) { attTotal += stats.attendance; attCount++; }
                }
            });

            const workingDays = prevDays.length - holidays - sheikhabsences;
            const avgAttendance = attCount > 0 ? Math.round(attTotal / attCount) : 0;
            const avgExcellent = excCount > 0 ? Math.round(excTotal / excCount) : 0;
            const avgGoodPlus = excCount > 0 ? Math.round(gpTotal / excCount) : 0;
            const commitmentRate = workingDays > 0 ? Math.round((sessions / workingDays) * 100) : 0;

            const sessionPoints = sessions * weights.sessionWeight;
            const attendancePoints = sessions > 0 ? Math.round((avgAttendance / 100) * weights.attendanceWeight * sessions) : 0;
            const extraSessionBonus = extraSessions * weights.extraSessionBonus;
            const excellencePoints = excCount > 0 ? Math.round((avgExcellent / 100) * weights.excellentBonus * sessions) + Math.round((avgGoodPlus / 100) * weights.goodPlusBonus * sessions) : 0;
            const commitmentBonus = (commitmentRate >= 100 && sheikhabsences === 0 && sessions > 0) ? weights.commitmentBonus : 0;
            const commitmentBase = Math.round((commitmentRate / 100) * weights.commitmentBase);
            const commitmentPoints = Math.max(0, commitmentBase + commitmentBonus - sheikhabsences * weights.absencePenalty);
            result[sh.group] = sessionPoints + attendancePoints + extraSessionBonus + excellencePoints + commitmentPoints;
        });
        return result;
    }, [sheikhs, getDayStats, selectedDate, weights]);

    // Apply sort mode
    const displayedScores = useMemo(() => {
        if (sortMode === 'rank') return scores;
        return [...scores].sort((a, b) => {
            const aDiff = a.totalPoints - (prevMonthScores[a.group] ?? a.totalPoints);
            const bDiff = b.totalPoints - (prevMonthScores[b.group] ?? b.totalPoints);
            return sortMode === 'improvement' ? bDiff - aDiff : aDiff - bDiff;
        });
    }, [scores, sortMode, prevMonthScores]);

    // Phase 6: CSV Export
    const handleExportCSV = () => {
        const monthLabel_ = format(selectedDate, 'MMMM yyyy', { locale: ar });
        const headers = ['الترتيب', 'الشيخ', 'الفوج', 'الحصص المسجلة', 'حضور الطلاب%', 'ممتاز%', 'التزام الشيخ%', 'غياب الشيخ', 'حصص إضافية', 'نقاط التسجيل', 'نقاط الحضور', 'نقاط الالتزام', 'نقاط التسميع', 'بونص إضافية', 'المجموع', 'مقارنة الشهر السابق'];
        const rows = scores.map(s => {
            const prev = prevMonthScores[s.group] ?? 0;
            const diff = prev > 0 ? (s.totalPoints - prev) : 0;
            const diffStr = prev > 0 ? (diff > 0 ? `+${diff}` : `${diff}`) : 'لا بيانات';
            return [
                s.rank, s.displayName, s.group,
                s.totalSessions, s.avgAttendance, s.avgExcellent, s.commitmentRate,
                s.sheikhabsences, s.extraSessionsCount,
                s.sessionPoints, s.attendancePoints, s.commitmentPoints, s.excellencePoints,
                s.extraSessionBonus, s.totalPoints, diffStr
            ];
        });
        const csvContent = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `تقرير_المشايخ_${monthLabel_}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const maxPoints = scores[0]?.totalPoints || 1;
    const monthLabel = format(selectedDate, 'MMMM yyyy', { locale: ar });

    // Overall month stats
    const overallAvgAtt = scores.length
        ? Math.round(scores.reduce((a, s) => a + s.avgAttendance, 0) / scores.length)
        : 0;
    const overallAvgExc = scores.length
        ? Math.round(scores.reduce((a, s) => a + s.avgExcellent, 0) / scores.length)
        : 0;
    const overallCommit = scores.length
        ? Math.round(scores.reduce((a, s) => a + s.commitmentRate, 0) / scores.length)
        : 0;

    const top = scores[0];

    // ─── Download as image via print ─────────────────────────────────────────
    const handlePrint = () => {
        const el = printRef.current;
        if (!el) return;
        const win = window.open('', '_blank', 'width=1000,height=1200');
        if (!win) return;
        win.document.write(`
            <html dir="rtl">
            <head>
                <title>تقرير شارات المشايخ — ${monthLabel}</title>
                <meta charset="utf-8"/>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
                    * { box-sizing: border-box; }
                    body { font-family: 'Cairo', sans-serif; background: #f8f9fa; margin: 0; padding: 20px; }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="max-w-4xl mx-auto space-y-6">
                    <div class="text-center py-4 border-b border-gray-200">
                        <h1 class="text-2xl font-black text-gray-800">حلقات الشافعي القرآنية</h1>
                        <p class="text-sm font-bold text-gray-500 mt-1">تقرير شارات وترتيب المشايخ لشهر ${monthLabel}</p>
                    </div>
                    ${el.innerHTML}
                </div>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 850);
    };

    return (
        <div className="space-y-5" dir="rtl">

            {/* ── Collapsible Guide (دليل معايير التقييم العادل والمشترك للشيخ والطلاب) ── */}
            <div className="transition-all duration-300">
                <div className={cn(
                    "border shadow-sm overflow-hidden transition-all duration-300 bg-amber-500/5 border-amber-500/20 rounded-2xl",
                    showGuide ? "p-5 space-y-4" : "p-4 flex items-center justify-between"
                )}>
                    {showGuide ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b pb-3 border-amber-500/20">
                                <div className="flex items-center gap-2 text-amber-800">
                                    <Sparkles className="h-5 w-5 text-amber-600 animate-pulse" />
                                    <h3 className="font-headline font-black text-sm md:text-base">👑 دليل المعايير العادل والحيادي لتقييم المشايخ والفوج</h3>
                                </div>
                                <button
                                    onClick={() => setShowGuide(false)}
                                    className="text-xs text-amber-900 font-bold hover:bg-amber-500/10 px-3 py-1 rounded-xl transition-all"
                                >
                                    إخفاء الدليل
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right leading-relaxed text-xs">
                                <div className="space-y-3">
                                    <div className="bg-white/80 p-3.5 rounded-xl border border-amber-500/10">
                                        <h4 className="font-bold text-[11px] text-amber-900 mb-1">📝 1️⃣ تسجيل الحصص للشيخ (وزن 50% تقريباً)</h4>
                                        <p className="text-[10px] text-muted-foreground leading-normal">
                                            معيار موضوعي بحت: يمنح المعلم **15 نقطة** عن كل حصة يقوم بتأديتها وتوثيقها بانتظام لتشجيعه على التواجد والتسجيل المستمر.
                                        </p>
                                    </div>
                                    <div className="bg-white/80 p-3.5 rounded-xl border border-amber-500/10">
                                        <h4 className="font-bold text-[11px] text-amber-900 mb-1">👥 2️⃣ مواظبة حضور طلاب الفوج (وزن 36% تقريباً)</h4>
                                        <p className="text-[10px] text-muted-foreground leading-normal">
                                            معيار موضوعي بحت يقيس حضور طلاب الفوج ويتناسب طردياً مع عدد الحصص.
                                            <br/>
                                            <strong>المعادلة:</strong> (متوسط حضور الطلاب / 100) × 12 نقطة × عدد الحصص.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="bg-white/80 p-3.5 rounded-xl border border-amber-500/10">
                                        <h4 className="font-bold text-[11px] text-amber-900 mb-1">🚫 3️⃣ التزام الشيخ بالجدول وغيابه (وزن 11% تقريباً)</h4>
                                        <p className="text-[10px] text-muted-foreground leading-normal">
                                            • **بونص التزام كامل (100%):** إضافة **40 نقطة** عند تسجيل كامل الجدول وبلا أي يوم غياب للشيخ.
                                            <br/>
                                            • **عقوبة الغياب للشيخ:** خصم **20 نقطة** عن كل غياب للمعلم نفسه.
                                            <br/>
                                            • **التزام التسجيل النسبي:** نقاط تصل حتى **30 نقطة** حسب نسبة إدخال الجدول.
                                        </p>
                                    </div>
                                    <div className="bg-white/80 p-3.5 rounded-xl border border-amber-500/10">
                                        <h4 className="font-bold text-[11px] text-amber-900 mb-1">➕ 4️⃣ بونص الحصص الإضافية والتعويضية (معيار إضافي مرن)</h4>
                                        <p className="text-[10px] text-muted-foreground leading-normal">
                                            معيار موضوعي يمنح **5 نقاط إضافية** لكل حصة تعويضية أو إضافية يعقدها الشيخ لدعم طلابه.
                                        </p>
                                    </div>
                                    <div className="bg-white/80 p-3.5 rounded-xl border border-amber-500/10 bg-yellow-50/40">
                                        <h4 className="font-bold text-[11px] text-amber-900 mb-1">⚖️ 5️⃣ جودة التحفيظ وتخفيف وزنها (وزن 3% فقط للحياد)</h4>
                                        <p className="text-[10px] text-muted-foreground leading-normal">
                                            تجنباً لانحياز التقييمات لصالح الحلقات المتساهلة علمياً ضد المشايخ المتشددين؛ تم **تخفيض وزن معيار درجات التسميع (ممتاز / جيد جداً) بنسبة 75%** لتصبح نقاط مكافأة ثانوية جداً لا تؤثر على الترتيب العام.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-amber-500/10 p-2.5 rounded-xl text-center text-[10px] text-amber-800 font-bold">
                                💡 <strong>ملاحظة الشفافية:</strong> يرتكز التقييم بنسبة 97% على الأرقام والنسب الموضوعية (التواجد، حضور الفوج، الالتزام بالجدول) ليكون عادلاً ومقنعاً لجميع المشايخ.
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 text-amber-900">
                                <Sparkles className="h-4 w-4 text-amber-600 animate-pulse" />
                                <span className="text-xs font-black">👑 دليل المعايير: التقييم الحيادي القائم على الالتزام وحضور الفوج ونسب احتساب كل معيار</span>
                            </div>
                            <button
                                onClick={() => setShowGuide(true)}
                                className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 font-bold px-3 py-1 rounded-lg transition-all"
                            >
                                عرض تفاصيل المعايير ونسب التقييم
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ── Header KPI Row ── */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-3 text-white shadow-lg shadow-emerald-200">
                    <div className="text-[10px] font-bold opacity-80 mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> متوسط حضور الطلاب</div>
                    <div className="text-2xl font-black leading-none">{overallAvgAtt}%</div>
                    <div className="text-[9px] opacity-70 mt-1">جميع الأفواج</div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-3 text-white shadow-lg shadow-amber-200">
                    <div className="text-[10px] font-bold opacity-80 mb-1 flex items-center gap-1"><Star className="h-3 w-3" /> جودة التسميع (ممتاز)</div>
                    <div className="text-2xl font-black leading-none">{overallAvgExc}%</div>
                    <div className="text-[9px] opacity-70 mt-1">متوسط أداء الطلاب الممتاز</div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-3 text-white shadow-lg shadow-purple-200">
                    <div className="text-[10px] font-bold opacity-80 mb-1 flex items-center gap-1"><Target className="h-3 w-3" /> التزام المشايخ بتسجيل الحصص</div>
                    <div className="text-2xl font-black leading-none">{overallCommit}%</div>
                    <div className="text-[9px] opacity-70 mt-1">متوسط التزام التسجيل</div>
                </div>
            </div>

            {/* ── Top Sheikh Card ── */}
            {top && top.totalPoints > 0 && (
                <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-amber-100">
                    {/* Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-400" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.3),transparent_60%)]" />
                    {/* Decorative circles */}
                    <div className="absolute -top-8 -left-8 w-40 h-40 rounded-full bg-white/10" />
                    <div className="absolute -bottom-10 -right-4 w-32 h-32 rounded-full bg-white/10" />
                    <div className="absolute top-2 left-20 w-16 h-16 rounded-full bg-white/10" />

                    <div className="relative p-5">
                        {/* Title */}
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <div className="bg-white/30 backdrop-blur-sm rounded-xl px-2.5 py-1 text-[11px] font-black text-amber-900 border border-white/40">
                                🏆 شيخ وفوج الشهر
                            </div>
                            <div className="text-xs text-amber-900/70 font-bold">{monthLabel}</div>
                            <button
                                onClick={() => openHonorCard(top)}
                                className="mr-auto flex items-center gap-1.5 bg-amber-950/20 hover:bg-amber-950/30 transition-colors text-amber-950 text-[10px] font-black px-3 py-1.5 rounded-xl border border-amber-900/20"
                            >
                                <Share2 className="h-3 w-3" />
                                تصدير بطاقة التكريم
                            </button>
                        </div>

                        <div className="flex items-start gap-4">
                            {/* Trophy */}
                            <div className="text-6xl drop-shadow-lg flex-shrink-0">🏆</div>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="text-2xl font-black text-amber-950 leading-tight truncate">{top.displayName}</div>
                                <div className="text-sm text-amber-800 font-bold mt-0.5">فوج {top.group} — {top.totalPoints} نقطة</div>

                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    <div className="bg-white/40 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[11px] font-black text-amber-950 border border-white/30">
                                        📚 {top.totalSessions} حصة مسجلة للشيخ
                                    </div>
                                    <div className="bg-white/40 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[11px] font-black text-amber-950 border border-white/30">
                                        👥 حضور الطلاب {top.avgAttendance}%
                                    </div>
                                    <div className="bg-white/40 backdrop-blur-sm rounded-lg px-2.5 py-1 text-[11px] font-black text-amber-950 border border-white/30">
                                        🎯 التزام الشيخ {top.commitmentRate}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Badges */}
                        {top.badges.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-white/30">
                                {top.badges.map(b => (
                                    <span
                                        key={b.label}
                                        title={b.description}
                                        className="bg-white/40 backdrop-blur-sm border border-white/40 text-amber-950 text-[10px] font-black px-2.5 py-1 rounded-full cursor-default"
                                    >
                                        {b.icon} {b.label}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Points breakdown */}
                        <div className="grid grid-cols-4 gap-2 mt-4">
                            {[
                                { label: 'حصة الشيخ', value: top.sessionPoints, icon: '📝' },
                                { label: 'حضور الطلاب', value: top.attendancePoints, icon: '👥' },
                                { label: 'التزام الشيخ', value: top.commitmentPoints, icon: '🎯' },
                                { label: 'جودة التسميع', value: top.excellencePoints, icon: '⭐' },
                            ].map(item => (
                                <div key={item.label} className="bg-white/30 backdrop-blur-sm rounded-xl p-2 text-center border border-white/30">
                                    <div className="text-lg">{item.icon}</div>
                                    <div className="text-sm font-black text-amber-950">{item.value}</div>
                                    <div className="text-[9px] text-amber-900/70 font-bold">{item.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Phase 2: Weights Simulator Panel ── */}
            {showWeightsSim && (
                <div className="rounded-2xl border bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm font-black text-indigo-900">🎛️ محاكي أوزان نقاط التقييم (تفاعلي)</span>
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold border border-indigo-200">يُحدّث الترتيب فوراً</span>
                        </div>
                        <button onClick={() => setShowWeightsSim(false)} className="text-indigo-600 hover:text-indigo-800 text-xl font-light leading-none">×</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {([
                            { key: 'sessionWeight' as keyof ScoringWeights, label: '📝 نقاط كل حصة مسجلة', min: 1, max: 30, step: 1, color: 'indigo' },
                            { key: 'attendanceWeight' as keyof ScoringWeights, label: '👥 وزن حضور الطلاب (لكل حصة)', min: 1, max: 25, step: 1, color: 'emerald' },
                            { key: 'commitmentBonus' as keyof ScoringWeights, label: '💎 بونص الالتزام الكامل', min: 0, max: 80, step: 5, color: 'cyan' },
                            { key: 'commitmentBase' as keyof ScoringWeights, label: '🎯 نقاط الالتزام النسبي (حد أقصى)', min: 0, max: 60, step: 5, color: 'purple' },
                            { key: 'absencePenalty' as keyof ScoringWeights, label: '🚫 عقوبة غياب الشيخ (للغياب الواحد)', min: 0, max: 50, step: 5, color: 'rose' },
                            { key: 'extraSessionBonus' as keyof ScoringWeights, label: '➕ بونص الحصة التعويضية/الإضافية', min: 0, max: 20, step: 1, color: 'amber' },
                            { key: 'excellentBonus' as keyof ScoringWeights, label: '⭐ بونص تسميع ممتاز (لكل حصة)', min: 0, max: 10, step: 0.5, color: 'yellow' },
                            { key: 'goodPlusBonus' as keyof ScoringWeights, label: '🌟 بونص جيد جداً (لكل حصة)', min: 0, max: 5, step: 0.5, color: 'orange' },
                            { key: 'punctualityBonus' as keyof ScoringWeights, label: '⚡ بونص التسجيل الفوري (نفس اليوم)', min: 0, max: 8, step: 1, color: 'lime' },
                            { key: 'punctualityPenalty' as keyof ScoringWeights, label: '⏰ خصم التسجيل المتأخر (14+ يوم)', min: 0, max: 8, step: 1, color: 'red' },
                        ] as const).map(({ key, label, min, max, step, color }) => (
                            <div key={key} className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-[11px] font-bold text-slate-700">{label}</label>
                                    <span className={`text-xs font-black text-${color}-700 bg-${color}-50 border border-${color}-200 rounded-lg px-2 py-0.5 min-w-[2.5rem] text-center`}>{weights[key]}</span>
                                </div>
                                <input
                                    type="range" min={min} max={max} step={step}
                                    value={weights[key]}
                                    onChange={e => setWeights(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-indigo-600"
                                />
                                <div className="flex justify-between text-[9px] text-slate-400">
                                    <span>{min}</span><span>{max}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-indigo-200">
                        <button
                            onClick={saveWeights}
                            disabled={isSavingWeights}
                            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                            <Save className="h-3.5 w-3.5" />
                            {isSavingWeights ? 'جاري الحفظ...' : 'حفظ الأوزان في قاعدة البيانات'}
                        </button>
                        <button
                            onClick={resetWeights}
                            disabled={isSavingWeights}
                            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl transition-all border"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            إعادة تعيين الافتراضية
                        </button>
                        <span className="text-[10px] text-slate-400 mr-auto">💡 التغييرات تُطبَّق فوراً على الترتيب — الحفظ يُزامن مع Firebase</span>
                    </div>
                </div>
            )}

            {/* ── Phase 5: Monthly Goals Panel ── */}
            {showGoals && (
                <div className="rounded-2xl border bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Goal className="h-4 w-4 text-emerald-600" />
                            <span className="text-sm font-black text-emerald-900">🎯 الأهداف المستهدفة لشهر {monthLabel}</span>
                        </div>
                        <button onClick={() => setShowGoals(false)} className="text-emerald-600 hover:text-emerald-800 text-xl font-light leading-none">×</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {([
                            { key: 'attendanceTarget' as const, label: '👥 هدف حضور الطلاب', min: 50, max: 100, unit: '%', color: 'emerald', current: overallAvgAtt },
                            { key: 'excellentTarget' as const, label: '⭐ هدف نسبة الممتاز', min: 5, max: 80, unit: '%', color: 'amber', current: overallAvgExc },
                            { key: 'commitmentTarget' as const, label: '💎 هدف التزام المشايخ', min: 50, max: 100, unit: '%', color: 'purple', current: overallCommit },
                        ]).map(({ key, label, min, max, unit, color, current }) => {
                            const target = goals[key];
                            const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                            const achieved = current >= target;
                            return (
                                <div key={key} className={`rounded-xl border p-3.5 space-y-2 ${achieved ? 'bg-white border-emerald-300 shadow-sm shadow-emerald-100' : 'bg-white/60 border-slate-200'}`}>
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-slate-700">{label}</label>
                                        {achieved && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-black">✅ محقق</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range" min={min} max={max} step={1}
                                            value={target}
                                            onChange={e => setGoals(prev => ({ ...prev, [key]: parseInt(e.target.value) }))}
                                            className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-emerald-500"
                                        />
                                        <span className={`text-sm font-black text-${color}-700 min-w-[3rem] text-center bg-${color}-50 border border-${color}-200 rounded-lg px-2 py-0.5`}>{target}{unit}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-slate-500">الحالي: <strong className={`text-${color}-700`}>{current}{unit}</strong></span>
                                            <span className="text-slate-500">{progress}% من الهدف</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${achieved ? 'bg-gradient-to-l from-emerald-400 to-teal-500' : progress >= 70 ? 'bg-gradient-to-l from-amber-400 to-yellow-500' : 'bg-gradient-to-l from-rose-400 to-red-500'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-3 pt-2 border-t border-emerald-200">
                        <button
                            onClick={saveGoals}
                            disabled={isSavingGoals}
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-50"
                        >
                            <Save className="h-3.5 w-3.5" />
                            {isSavingGoals ? 'جاري الحفظ...' : 'حفظ الأهداف الشهرية'}
                        </button>
                        <span className="text-[10px] text-slate-400">💡 تُحفظ الأهداف لكل شهر بشكل مستقل</span>
                    </div>
                </div>
            )}

            {/* ── Leaderboard ── */}
            <div ref={printRef} className="rounded-3xl border shadow-lg bg-white overflow-hidden">
                {/* Header Title Bar */}
                <div className="bg-gradient-to-l from-indigo-600 via-purple-600 to-violet-700 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                            <div className="bg-white/20 rounded-xl p-1.5 backdrop-blur-sm">
                                <Trophy className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-white leading-tight">جدول ترتيب وأداء المشايخ والفوج (تقييم موضوعي)</h3>
                                <p className="text-[11px] text-white/70 font-bold">{monthLabel}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {/* Phase 2: Weights Simulator toggle */}
                            <button
                                onClick={() => { setShowWeightsSim(v => !v); setShowGoals(false); }}
                                className={cn(
                                    "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors",
                                    showWeightsSim ? 'bg-white text-indigo-700 border-white' : 'bg-white/20 hover:bg-white/30 text-white border-white/20'
                                )}
                                title="محاكي أوزان التقييم"
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                الأوزان
                            </button>
                            {/* Phase 5: Goals toggle */}
                            <button
                                onClick={() => { setShowGoals(v => !v); setShowWeightsSim(false); }}
                                className={cn(
                                    "flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border transition-colors",
                                    showGoals ? 'bg-white text-emerald-700 border-white' : 'bg-white/20 hover:bg-white/30 text-white border-white/20'
                                )}
                                title="الأهداف الشهرية"
                            >
                                <Goal className="h-3.5 w-3.5" />
                                الأهداف
                            </button>
                            {/* Phase 6: CSV Export */}
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-1.5 bg-emerald-500/80 hover:bg-emerald-600 transition-colors text-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-emerald-400/50"
                                title="تصدير بيانات Excel/CSV"
                            >
                                <Download className="h-3.5 w-3.5" />
                                تصدير Excel
                            </button>
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors text-white text-[11px] font-bold px-3 py-1.5 rounded-xl border border-white/20"
                                title="طباعة / حفظ كصورة"
                            >
                                <ImageDown className="h-3.5 w-3.5" />
                                طباعة
                            </button>
                        </div>
                    </div>
                    {/* Phase 3: Sort mode buttons */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20">
                        <span className="text-[10px] text-white/70 font-bold">ترتيب:</span>
                        {([
                            { mode: 'rank' as const, label: '🏆 الترتيب العام', icon: null },
                            { mode: 'improvement' as const, label: '📈 الأكثر تحسناً', icon: null },
                            { mode: 'regression' as const, label: '🔻 الأكثر تراجعاً', icon: null },
                        ]).map(({ mode, label }) => (
                            <button
                                key={mode}
                                onClick={() => setSortMode(mode)}
                                className={cn(
                                    'text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all',
                                    sortMode === mode
                                        ? mode === 'improvement' ? 'bg-emerald-400 text-white shadow'
                                            : mode === 'regression' ? 'bg-rose-400 text-white shadow'
                                                : 'bg-white text-indigo-800 shadow'
                                        : 'text-white/70 hover:bg-white/20'
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table Body & Column Labels (Scroll together on mobile) */}
                <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                        {/* Column labels (Dark sub-header) */}
                        <div className="bg-indigo-950/90 py-2.5 px-3 border-b border-indigo-900 text-center" style={gridColumnsStyle}>
                            {[
                                { label: '#', tooltip: 'الترتيب الشهري' },
                                { label: 'الشيخ والفوج', tooltip: 'اسم الشيخ وفوج التحفيظ' },
                                { label: 'حصص الشهر', tooltip: 'تفصيل أنواع الحصص خلال الشهر' },
                                { label: 'حضور الطلاب', tooltip: 'متوسط نسبة حضور طلاب الفوج طوال الشهر' },
                                { label: 'ممتاز للطلاب', tooltip: 'متوسط نسبة تقييم ممتاز لطلاب الفوج في التسميع' },
                                { label: 'التزام الشيخ', tooltip: 'حضور الشيخ لجدوله وحصصه وغياباته' },
                                { label: 'توقيت التسجيل', tooltip: 'نقاط تسجيل الحصص في وقتها — +3ن نفس اليوم إلى -2ن بعد 14 يوم' },
                                { label: 'النقاط', tooltip: 'مجموع نقاط الشيخ التراكمية بناءً على معايير الأداء والالتزام' }
                            ].map(h => (
                                <div key={h.label} className="text-[10px] font-black text-indigo-100/90 text-center select-none" title={h.tooltip}>
                                    {h.label}
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        <div className="divide-y bg-white">
                            {displayedScores.map((s) => {
                                const isTop3 = s.rank <= 3;
                                const rowBg = s.rank === 1
                                    ? 'bg-gradient-to-l from-amber-50/80 to-yellow-50/80'
                                    : s.rank === 2
                                        ? 'bg-gradient-to-l from-slate-50 to-gray-50'
                                        : s.rank === 3
                                            ? 'bg-gradient-to-l from-orange-50/60 to-amber-50/40'
                                            : 'hover:bg-muted/20';

                                return (
                                    <div
                                        key={s.group}
                                        className={cn('transition-colors cursor-pointer hover:bg-slate-50', rowBg)}
                                        onClick={() => setSelectedSheikhDetail(s)}
                                    >
                                        {/* Main row with explicit inline styles for columns grid */}
                                        <div className="items-center px-3 py-3 text-center" style={gridColumnsStyle}>
                                            {/* Rank */}
                                            <div className="flex justify-center items-center">
                                                <RankBadge rank={s.rank} />
                                            </div>

                                            {/* Name & Group info & Podium counts */}
                                            <div className="text-right min-w-0 pr-2">
                                                <div className={cn('font-black text-sm truncate', isTop3 ? 'text-gray-900' : 'text-gray-700')}>{s.displayName}</div>
                                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-muted-foreground font-bold">فوج {s.group}</span>
                                                    {/* Historic podium stats */}
                                                    {(s.podiumCounts.first > 0 || s.podiumCounts.second > 0 || s.podiumCounts.third > 0) && (
                                                        <div className="flex items-center gap-1">
                                                            {s.podiumCounts.first > 0 && (
                                                                <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-black" title="المركز الأول شهرياً">
                                                                    🥇 <span className="mr-0.5">{s.podiumCounts.first}</span> الأول
                                                                </span>
                                                            )}
                                                            {s.podiumCounts.second > 0 && (
                                                                <span className="text-[9px] bg-slate-50 text-slate-700 border border-slate-200 px-1.5 py-0.2 rounded font-black" title="المركز الثاني شهرياً">
                                                                    🥈 <span className="mr-0.5">{s.podiumCounts.second}</span> الثاني
                                                                </span>
                                                            )}
                                                            {s.podiumCounts.third > 0 && (
                                                                <span className="text-[9px] bg-orange-50 text-orange-700 border border-orange-200 px-1.5 py-0.2 rounded font-black" title="المركز الثالث شهرياً">
                                                                    🥉 <span className="mr-0.5">{s.podiumCounts.third}</span> الثالث
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {s.badges.slice(0, 4).map(b => (
                                                        <span
                                                            key={b.label}
                                                            title={b.description}
                                                            className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border cursor-default', b.colorClass)}
                                                        >
                                                            {b.icon} {b.label}
                                                        </span>
                                                    ))}
                                                    {s.badges.length > 4 && (
                                                        <span className="text-[9px] text-muted-foreground font-bold">+{s.badges.length - 4}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sessions breakdown */}
                                            <div className="flex justify-center items-center gap-1.5">
                                                {/* أساسية */}
                                                <div className="flex flex-col items-center bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 min-w-[58px]">
                                                    <span className={cn('text-sm font-black', s.basicSessions >= 20 ? 'text-emerald-700' : s.basicSessions >= 15 ? 'text-blue-700' : 'text-gray-600')}>
                                                        {Math.floor(s.basicSessions)}
                                                    </span>
                                                    <span className="text-[8px] text-emerald-600 font-bold">أساسية</span>
                                                </div>
                                                {/* أنشطة */}
                                                <div className="flex flex-col items-center bg-purple-50 border border-purple-200 rounded-lg px-2 py-1 min-w-[52px]">
                                                    <span className={cn('text-sm font-black', s.activitySessions > 0 ? 'text-purple-700' : 'text-gray-300')}>
                                                        {s.activitySessions}
                                                    </span>
                                                    <span className="text-[8px] text-purple-500 font-bold">أنشطة</span>
                                                </div>
                                                {/* عطلة */}
                                                <div className="flex flex-col items-center bg-sky-50 border border-sky-200 rounded-lg px-2 py-1 min-w-[44px]">
                                                    <span className="text-sm font-black text-sky-500">{s.holidaySessions}</span>
                                                    <span className="text-[8px] text-sky-500 font-bold">عطلة</span>
                                                </div>
                                            </div>

                                            {/* Attendance (Student) */}
                                            <div className="flex flex-col justify-center items-center">
                                                <div className={cn('text-sm font-black',
                                                    s.avgAttendance >= 90 ? 'text-emerald-700' :
                                                        s.avgAttendance >= 75 ? 'text-amber-600' : 'text-rose-600'
                                                )}>{s.avgAttendance}%</div>
                                                <div className="text-[8px] text-muted-foreground">حضور الطلاب</div>
                                            </div>

                                            {/* Excellent (Student Quality) */}
                                            <div className="flex flex-col justify-center items-center">
                                                <div className={cn('text-sm font-black',
                                                    s.avgExcellent >= 50 ? 'text-amber-600' :
                                                        s.avgExcellent >= 30 ? 'text-green-600' : 'text-gray-500'
                                                )}>{s.avgExcellent}%</div>
                                                <div className="text-[8px] text-muted-foreground">ممتاز للطلاب</div>
                                            </div>

                                            {/* Commitment (Sheikh himself) */}
                                            <div className="flex flex-col justify-center items-center">
                                                <div className={cn('text-sm font-black',
                                                    s.commitmentRate >= 90 ? 'text-purple-700' :
                                                        s.commitmentRate >= 70 ? 'text-indigo-600' : 'text-gray-500'
                                                )}>{s.commitmentRate}%</div>
                                                {s.commitmentRate >= 100 && s.sheikhabsences === 0 ? (
                                                    <div className="text-[8px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 rounded px-1 mt-0.5 inline-block">التزام كامل بالجدول</div>
                                                ) : s.sheikhabsences > 0 ? (
                                                    <div className="text-[8px] text-rose-650 font-bold bg-rose-50 border border-rose-100 rounded px-1 mt-0.5 inline-block">غياب الشيخ: {s.sheikhabsences} يوم</div>
                                                ) : (
                                                    <div className="text-[8px] text-amber-600 font-bold bg-amber-50 border border-amber-100 rounded px-1 mt-0.5 inline-block">تسجيل جزئي: {s.totalSessions} حصة</div>
                                                )}
                                            </div>

                                            {/* Punctuality (Timing) */}
                                            <div className="flex flex-col justify-center items-center">
                                                <div className={cn(
                                                    'text-sm font-black',
                                                    s.punctualityPoints > 0 ? 'text-emerald-700' :
                                                        s.punctualityPoints < 0 ? 'text-rose-600' : 'text-gray-400'
                                                )}>
                                                    {s.punctualityPoints > 0 ? `+${s.punctualityPoints}` : s.punctualityPoints}
                                                </div>
                                                <div className={cn(
                                                    'text-[8px] font-bold px-1 mt-0.5 rounded inline-block',
                                                    s.punctualityPoints > 0 ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' :
                                                        s.punctualityPoints < 0 ? 'text-rose-600 bg-rose-50 border border-rose-100' :
                                                            'text-gray-400'
                                                )}>
                                                    {s.punctualityPoints > 0 ? `⚡ ${s.punctualSessions} مبكرة` :
                                                        s.punctualityPoints < 0 ? `⚠️ ${s.lateSessions} متأخرة` :
                                                            '⏳ محايد'}
                                                </div>
                                            </div>

                                            {/* Total points */}
                                            <div className="flex flex-col justify-center items-center">
                                                <div className={cn(
                                                    'text-sm font-black px-2 py-0.5 rounded-lg',
                                                    s.rank === 1 ? 'bg-amber-100 text-amber-800' :
                                                        s.rank === 2 ? 'bg-slate-100 text-slate-700' :
                                                            s.rank === 3 ? 'bg-orange-100 text-orange-800' :
                                                                'text-primary'
                                                )}>{s.totalPoints}</div>
                                                <div className="text-[8px] text-muted-foreground mt-0.5">نقطة</div>
                                                <ScoreBar value={s.totalPoints} max={maxPoints} colorClass={
                                                    s.rank === 1 ? 'bg-gradient-to-l from-amber-400 to-yellow-500' :
                                                        s.rank === 2 ? 'bg-gradient-to-l from-slate-400 to-slate-500' :
                                                            s.rank === 3 ? 'bg-gradient-to-l from-orange-400 to-amber-500' :
                                                                'bg-primary/60'
                                                } />
                                            </div>
                                        </div>

                                        {/* Points breakdown sub-row */}
                                        <div className="flex flex-wrap gap-1.5 px-4 pb-3 pt-0">
                                            {/* Phase 3: Month-over-month change badge */}
                                            {(() => {
                                                const prev = prevMonthScores[s.group];
                                                if (!prev) return null;
                                                const diff = s.totalPoints - prev;
                                                const pct = Math.abs(Math.round((diff / prev) * 100));
                                                if (Math.abs(diff) < 3) return (
                                                    <span className="text-[9px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                                        <Minus className="h-2.5 w-2.5" />مستقر ({pct}%)
                                                    </span>
                                                );
                                                return diff > 0 ? (
                                                    <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                                        <TrendingUp className="h-2.5 w-2.5" />+{diff} نقطة ({pct}% ↑)
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                                        <TrendingDown className="h-2.5 w-2.5" />{diff} نقطة ({pct}% ↓)
                                                    </span>
                                                );
                                            })()}
                                            <span className="text-[9px] text-muted-foreground font-bold ml-1">تفصيل احتساب نقاط التقييم:</span>
                                            <span className="text-[9px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-bold">📝 تسجيل حصص الشيخ (50%): {s.sessionPoints}ن</span>
                                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold">👥 حضور الطلاب بالفوج (36%): {s.attendancePoints}ن</span>
                                            <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full font-bold">🎯 التزام الشيخ وحضوره (11%): {s.commitmentPoints}ن</span>
                                            {s.extraSessionsCount > 0 && (
                                                <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-bold">➕ بونص الحصص الإضافية/التعويضية: {s.extraSessionBonus}ن</span>
                                            )}
                                            <span
                                                className={cn(
                                                    'text-[9px] px-2 py-0.5 rounded-full font-bold border',
                                                    s.punctualityPoints > 0 ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                                                        s.punctualityPoints < 0 ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                            'bg-gray-50 text-gray-500 border-gray-100'
                                                )}
                                                title="نقاط تسجيل الحصص في وقتها (+3 نفس اليوم إلى -2 بعد 14 يوم)"
                                            >
                                                ⚡ توقيت التسجيل: {s.punctualityPoints > 0 ? `+${s.punctualityPoints}` : s.punctualityPoints}ن
                                            </span>
                                            <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full font-medium opacity-80" title="تم خفض وزنها لضمان حيادية التقييم وتفادي التشدد والتساهل الشخصي في العلامات">⭐ جودة التسميع للطلاب (3%): {s.excellencePoints}ن</span>
                                            {isTop3 && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openHonorCard(s); }}
                                                    className="mr-auto flex items-center gap-1 text-[9px] font-black px-2.5 py-0.5 rounded-full border cursor-pointer transition-all"
                                                    style={{
                                                        background: s.rank === 1 ? '#fef9c3' : s.rank === 2 ? '#f1f5f9' : '#fff7ed',
                                                        borderColor: s.rank === 1 ? '#fbbf24' : s.rank === 2 ? '#94a3b8' : '#f97316',
                                                        color: s.rank === 1 ? '#92400e' : s.rank === 2 ? '#475569' : '#9a3412',
                                                    }}
                                                >
                                                    <Share2 className="h-2.5 w-2.5" />
                                                    تصدير بطاقة التكريم
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Scoring System Card ── */}
            <div className="rounded-2xl border bg-gradient-to-br from-slate-50 to-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 bg-primary/10 rounded-lg">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-xs font-black text-gray-800">نظام احتساب النقاط التنافسي الحيادي والموضوعي</span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-[10px]">
                    {[
                        { icon: '📝', label: 'تسجيل الحصص للشيخ', pts: '15 نقطة لكل حصة مسجلة للفوج [50%]', color: 'bg-blue-50 border-blue-100 text-blue-800' },
                        { icon: '👥', label: 'حضور الطلاب بالفوج (موضوعي)', pts: 'نسبة الحضور × 12 نقطة × عدد الحصص [36%]', color: 'bg-emerald-50 border-emerald-100 text-emerald-800' },
                        { icon: '🚫', label: 'التزام الشيخ وغيابه', pts: 'بونص التزام كامل (+40) | عقوبة غياب الشيخ (-20/يوم) [11%]', color: 'bg-purple-50 border-purple-100 text-purple-800' },
                        { icon: '➕', label: 'بونص الحصص الإضافية/التعويضية', pts: '5 نقاط إضافية عن كل حصة تعويضية', color: 'bg-indigo-50 border-indigo-100 text-indigo-800' },
                        { icon: '⚖️', label: 'جودة التسميع (مخففة للحياد)', pts: '(نسبة ممتاز × 3 + نسبة جيد جداً × 1.5) × الحصص [3%]', color: 'bg-amber-50 border-amber-100 text-amber-800' },
                    ].map(item => (
                        <div key={item.label} className={cn('rounded-xl border p-2.5 flex items-start gap-2', item.color)}>
                            <span className="text-base mt-0.5">{item.icon}</span>
                            <div>
                                <div className="font-bold leading-snug">{item.label}</div>
                                <div className="font-black mt-0.5 opacity-80">{item.pts}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Badges legend */}
                <div className="pt-2 border-t">
                    <div className="text-[10px] font-black text-gray-700 mb-2">🎖️ الشارات التكريمية وشروطها</div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {[
                            { icon: '💎', label: 'التزام الشيخ الكامل', desc: 'حضور وتسجيل 100% من حصص العمل دون غياب للشيخ' },
                            { icon: '👑', label: 'حضور طلاب الفوج (👑)', desc: 'متوسط حضور طلاب الفوج الشهري ≥ 95%' },
                            { icon: '🔥', label: 'صفر غياب للشيخ', desc: 'لم يغب الشيخ نفسه ولو يوماً واحداً طوال الشهر' },
                            { icon: '🎯', label: 'انضباط الفوج المرتفع', desc: '15+ يوماً بحضور طلاب الفوج فوق 90%' },
                            { icon: '📚', label: 'ثبات تسجيل الشيخ', desc: 'سجل المعلم 22 حصة أو أكثر في الشهر' },
                            { icon: '🌟', label: 'تميز تسميع الفوج (ممتاز)', desc: '25% أو أكثر من تقييمات طلاب الفوج حصلوا على ممتاز' },
                            { icon: '🏅', label: 'جودة الفوج العالية', desc: '60%+ من الطلاب بتقييم جيد جداً أو ممتاز بالفوج' },
                        ].map(b => (
                            <div key={b.label} className="flex items-center gap-1.5 text-[9px] text-gray-600">
                                <span className="text-sm">{b.icon}</span>
                                <span><strong>{b.label}:</strong> {b.desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Sheikh Score Detail Modal ── */}
            {selectedSheikhDetail && (
                <SheikhScoreDetailModal
                    sheikh={selectedSheikhDetail}
                    getDayStats={getDayStats}
                    selectedDate={selectedDate}
                    onClose={() => setSelectedSheikhDetail(null)}
                    onExportHonorCard={openHonorCard}
                    weights={weights}
                />
            )}

            {/* ── Honor Card Dialog ── */}
            {honorCard && (
                <HonorCardGenerator
                    data={honorCard}
                    onClose={() => setHonorCard(null)}
                />
            )}
        </div>
    );
}

// ─── SheikhScoreDetailModal ──────────────────────────────────────────────────
export function SheikhScoreDetailModal({
    sheikh,
    getDayStats,
    selectedDate,
    onClose,
    onExportHonorCard,
    weights
}: {
    sheikh: SheikhScore;
    getDayStats: (group: string, dateStr: string) => any;
    selectedDate: Date;
    onClose: () => void;
    onExportHonorCard?: (sheikh: SheikhScore) => void;
    weights: ScoringWeights;
}) {
    const monthLabel = format(selectedDate, 'MMMM yyyy', { locale: ar });
    const cleanGroup = sheikh.group.replace(/^فوج\s*/, '').trim();
    const groupName = `فوج ${cleanGroup}`;

    const dayRecords = useMemo(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
        const recs: any[] = [];

        days.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const stats = getDayStats(sheikh.group, dateStr);
            
            // Calculate daily points breakdown
            let dayPts = 0;
            let sType = 'غير مسجلة';
            let attendance = null;
            let excellent = null;
            let goodPlus = null;

            if (stats) {
                sType = stats.type;
                attendance = stats.attendance;
                excellent = stats.excellent;
                goodPlus = stats.goodPlus;

                const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                const isActivityDay = sType === 'حصة أنشطة';
                if (isReal) {
                    dayPts += weights.sessionWeight;
                    if (stats.attendance !== null) {
                        dayPts += Math.round((stats.attendance / 100) * weights.attendanceWeight);
                    }
                    if (sType === 'حصة تعويضية' || sType === 'حصة إضافية') {
                        dayPts += weights.extraSessionBonus;
                    }
                    let excellenceBonus = 0;
                    let goodPlusBonus = 0;
                    if (stats.excellent !== null) {
                        excellenceBonus = Math.round((stats.excellent / 100) * weights.excellentBonus);
                    }
                    if (stats.goodPlus !== null) {
                        goodPlusBonus = Math.round((stats.goodPlus / 100) * weights.goodPlusBonus);
                    }
                    dayPts += (excellenceBonus + goodPlusBonus);
                } else if (isActivityDay) {
                    // حصة أنشطة: تُحسب بوزن 0.8 من نقطة تسجيل الحصة + حضور الطلاب
                    dayPts += Math.round(weights.sessionWeight * 0.5);
                    if (stats.attendance !== null) {
                        dayPts += Math.round((stats.attendance / 100) * weights.attendanceWeight * 0.5);
                    }
                } else if (sType === 'غياب الشيخ') {
                    dayPts -= weights.absencePenalty;
                }
            }

            recs.push({
                date: dateStr,
                label: format(day, 'EEE d MMM', { locale: ar }),
                type: sType,
                attendance,
                excellent,
                goodPlus,
                dayPoints: dayPts
            });
        });

        return recs.sort((a, b) => a.date.localeCompare(b.date));
    }, [sheikh, getDayStats, selectedDate, weights]);

    // Local TYPE_CONFIG for rendering session labels in the modal
    const LOCAL_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
        'حصة أساسية': { label: 'أساسية', bg: 'bg-emerald-50 border border-emerald-250/30', text: 'text-emerald-700' },
        'حصة تعويضية': { label: 'تعويضية', bg: 'bg-amber-50 border border-amber-250/30', text: 'text-amber-700' },
        'حصة إضافية': { label: 'إضافية', bg: 'bg-indigo-50 border border-indigo-250/30', text: 'text-indigo-700' },
        'حصة أنشطة': { label: 'أنشطة', bg: 'bg-purple-50 border border-purple-250/30', text: 'text-purple-700' },
        'يوم عطلة': { label: 'عطلة', bg: 'bg-sky-50 border border-sky-250/30', text: 'text-sky-700' },
        'غياب الشيخ': { label: 'غياب شيخ', bg: 'bg-rose-50 border border-rose-250/30', text: 'text-rose-700' },
        'غير مسجلة': { label: 'غير مسجلة', bg: 'bg-slate-100 border border-slate-200', text: 'text-slate-500' }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4" onClick={onClose}>
            {/* Styles for responsive layout */}
            <style dangerouslySetInnerHTML={{__html: `
                .sheikh-modal-container {
                    width: 100%;
                    max-width: 950px;
                    height: 90vh;
                    max-height: 700px;
                }
                .sheikh-dashboard-grid {
                    display: flex;
                    flex-direction: column;
                    height: calc(100% - 130px); /* Adjust for header and footer */
                    overflow: hidden;
                }
                @media (min-width: 768px) {
                    .sheikh-dashboard-grid {
                        display: grid !important;
                        grid-template-columns: 320px 1fr !important;
                        flex-direction: row;
                    }
                }
            `}} />

            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col sheikh-modal-container" dir="rtl" onClick={e => e.stopPropagation()}>
                {/* Header with robust gradient */}
                <div 
                    className="text-white p-4 flex items-center justify-between shrink-0 relative overflow-hidden"
                    style={{ background: 'linear-gradient(to left, #6b21a8, #3730a3)' }} // Purple-900 to Indigo-900
                >
                    <div className="absolute -top-10 -left-10 w-28 h-28 rounded-full bg-white/10 blur-xl" />
                    <div className="absolute -bottom-10 -right-10 w-28 h-28 rounded-full bg-white/10 blur-xl" />

                    <div className="relative z-10">
                        <div className="font-black text-xl leading-tight flex items-center gap-2">
                            <Crown className="h-6 w-6 text-yellow-300 animate-pulse" />
                            <span>{sheikh.displayName}</span>
                        </div>
                        <div className="text-purple-200 text-xs font-semibold mt-1">
                            {groupName} · {monthLabel}
                        </div>
                    </div>

                    <button 
                        onClick={onClose} 
                        className="text-white/80 hover:text-white text-3xl font-light leading-none relative z-10 transition-colors bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center"
                    >
                        &times;
                    </button>
                </div>

                {/* Main Dashboard Layout */}
                <div className="sheikh-dashboard-grid bg-slate-50/50">
                    
                    {/* Right column: Sheikh Stats Summary Card */}
                    <div className="p-4 border-l border-slate-200 flex flex-col justify-between overflow-y-auto bg-white shrink-0">
                        <div className="space-y-4">
                            {/* Score Card Banner */}
                            <div className="relative rounded-2xl p-4 overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
                                <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-white/10" />
                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] font-bold text-purple-200">الترتيب والمجموع</div>
                                        <div className="text-2xl font-black">{sheikh.totalPoints} <span className="text-xs font-bold text-purple-200">نقطة</span></div>
                                    </div>
                                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-2.5 py-1.5 text-center">
                                        <div className="text-[9px] font-bold text-purple-100">ترتيب الشيخ</div>
                                        <div className="text-sm font-black">🏆 {sheikh.rank}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Performance metrics list */}
                            <div className="space-y-2.5">
                                {[
                                    { label: 'حصة المعلم', val: sheikh.totalSessions.toString(), pts: sheikh.sessionPoints, icon: '📝', colorClass: 'border-blue-150 bg-blue-50/35 text-blue-700' },
                                    { label: 'حضور الطلاب بالفوج', val: `${sheikh.avgAttendance}%`, pts: sheikh.attendancePoints, icon: '👥', colorClass: 'border-emerald-150 bg-emerald-50/35 text-emerald-700' },
                                    { label: 'التزام الشيخ بتسجيل الحصص', val: `${sheikh.commitmentRate}%`, pts: sheikh.commitmentPoints, icon: '🎯', colorClass: 'border-purple-150 bg-purple-50/35 text-purple-700' },
                                    { label: 'جودة تسميع الطلاب (ممتاز)', val: `${sheikh.avgExcellent}%`, pts: sheikh.excellencePoints, icon: '⭐', colorClass: 'border-amber-150 bg-amber-50/35 text-amber-700' },                                ].map((c, i) => (
                                    <div key={i} className={cn("border rounded-xl p-3 flex items-center justify-between transition-all hover:shadow-sm", c.colorClass)}>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{c.icon}</span>
                                            <div>
                                                <div className="text-[10px] font-bold text-slate-500">{c.label}</div>
                                                <div className="text-sm font-black mt-0.5">{c.val}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-black">{c.pts !== null ? `+${c.pts}` : '—'}</div>
                                            <div className="text-[8px] font-semibold text-slate-400">نقطة</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Badges won section if any */}
                        {sheikh.badges.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-100">
                                <div className="text-[10px] font-bold text-slate-500 mb-2">🏅 الشارات المحققة هذا الشهر</div>
                                <div className="flex flex-wrap gap-1">
                                    {sheikh.badges.map((b, idx) => (
                                        <span 
                                            key={idx} 
                                            title={b.description}
                                            className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full border cursor-default", b.colorClass)}
                                        >
                                            {b.icon} {b.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Left column: Daily logs table */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 p-4">
                        <div className="text-xs font-black text-slate-700 mb-2 flex items-center gap-1.5 shrink-0">
                            <span className="w-1.5 h-3 bg-indigo-600 rounded-full" />
                            <span>سجل الحصص اليومي وتفصيل النقاط لشهر {monthLabel}</span>
                        </div>
                        
                        <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl bg-white text-[11px] shadow-sm">
                            <table className="w-full border-collapse">
                                <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b text-center font-bold text-gray-750">
                                    <tr>
                                        <th className="p-2.5 text-right pr-4">اليوم</th>
                                        <th className="p-2.5 text-center">نوع الحصة</th>
                                        <th className="p-2.5 text-center text-emerald-700">حضور الطلاب</th>
                                        <th className="p-2.5 text-center text-amber-600">ممتاز</th>
                                        <th className="p-2.5 text-center text-green-650">ج.جداً</th>
                                        <th className="p-2.5 text-center text-indigo-750 font-black">النقاط</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dayRecords.map((rec, i) => {
                                        const isReal = rec.type === 'حصة أساسية' || rec.type === 'حصة تعويضية' || rec.type === 'حصة إضافية';
                                        const isActivityRec = rec.type === 'حصة أنشطة';
                                        const isAbsent = rec.type === 'غياب الشيخ';
                                        const isHoliday = rec.type === 'يوم عطلة';
                                        const isNotRegistered = rec.type === 'غير مسجلة';
                                        return (
                                            <tr key={rec.date + i} className={cn(
                                                'border-b text-center transition-colors hover:bg-slate-50/40',
                                                isAbsent ? 'bg-rose-50/15' : isHoliday ? 'bg-sky-50/10' : isActivityRec ? 'bg-purple-50/20' : isNotRegistered ? 'bg-slate-100/20' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/5'
                                            )}>
                                                <td className="p-2 text-right font-bold text-gray-650 whitespace-nowrap pr-4">{rec.label}</td>
                                                <td className="p-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className={cn('text-[9px] px-2 py-0.5 rounded font-black border', LOCAL_TYPE_CONFIG[rec.type]?.bg || 'bg-muted/30', LOCAL_TYPE_CONFIG[rec.type]?.text || '')}>
                                                            {LOCAL_TYPE_CONFIG[rec.type]?.label || rec.type}
                                                        </span>
                                                        {isReal && (
                                                            rec.isPunctual ? (
                                                                <span className="text-[9px] text-emerald-600 cursor-default" title="تم التسجيل في الوقت المحدد (بونص)">⏱️</span>
                                                            ) : (
                                                                <span className="text-[9px] text-slate-350 cursor-default" title="تم تسجيل الحصة متأخراً">⏱️</span>
                                                            )
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center font-bold">
                                                    {(isReal || isActivityRec) && rec.attendance !== null ? (
                                                        <span className={cn('text-[11px]', rec.attendance >= 90 ? 'text-emerald-700' : rec.attendance >= 70 ? 'text-amber-600' : 'text-rose-600')}>
                                                            {rec.attendance}%
                                                        </span>
                                                    ) : <span className="text-muted-foreground/30">—</span>}
                                                </td>
                                                <td className="p-2 text-center font-bold">
                                                    {isReal && rec.excellent !== null ? (
                                                        <span className="text-[11px] text-emerald-600">
                                                            {rec.excellent}%
                                                        </span>
                                                    ) : <span className="text-muted-foreground/30">—</span>}
                                                </td>
                                                <td className="p-2 text-center font-bold">
                                                    {isReal && rec.goodPlus !== null ? (
                                                        <span className="text-[11px] text-green-600">
                                                            {rec.goodPlus}%
                                                        </span>
                                                    ) : <span className="text-muted-foreground/30">—</span>}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <span className={cn('font-black text-[11px]', rec.dayPoints > 0 ? 'text-indigo-750' : rec.dayPoints < 0 ? 'text-rose-600' : 'text-gray-300')}>
                                                        {rec.dayPoints > 0 ? `+${rec.dayPoints}` : rec.dayPoints < 0 ? rec.dayPoints : '—'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer breakdown & action buttons */}
                <div className="p-3.5 border-t bg-slate-50 flex items-center justify-between shrink-0 gap-3">
                    <div className="text-[10px] text-muted-foreground flex-1 leading-normal text-right">
                        <span>الإجمالي = تسجيل الحصص ({sheikh.sessionPoints})</span>
                        <span> + حضور الفوج ({sheikh.attendancePoints})</span>
                        <span> + التزام وغياب الشيخ ({sheikh.commitmentPoints})</span>
                        <span> + جودة الطلاب ({sheikh.excellencePoints})</span>
                        {sheikh.extraSessionBonus > 0 && <span> + بونص تعويضية ({sheikh.extraSessionBonus})</span>}
                        <span> = <span className="font-black text-indigo-700">{sheikh.totalPoints} نقطة</span></span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {onExportHonorCard && (
                            <button
                                onClick={() => onExportHonorCard(sheikh)}
                                className="text-xs px-3.5 py-2 bg-gradient-to-l from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-sm transition-all hover:shadow active:scale-95"
                            >
                                <Share2 className="h-4.5 w-4.5" />
                                تصدير بطاقة التكريم
                            </button>
                        )}
                        <button onClick={onClose} className="text-xs px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-350 rounded-xl font-bold transition-colors">إغلاق</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
