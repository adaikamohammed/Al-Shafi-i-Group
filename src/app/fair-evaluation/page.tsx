"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Medal, Calendar, Award, Star, UserCheck, CheckCircle, ShieldAlert, Info, TrendingUp, Sparkles, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, addWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, arabicCompare } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { GroupSelector } from '@/components/management/GroupSelector';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

// Constants for fallback points
const ATTENDANCE_POINTS: Record<string, number> = {
    'حاضر': 10,
    'تعويض': 8,
    'متأخر': 5,
    'غائب': 0,
    'غياب': 0
};

const PERFORMANCE_POINTS: Record<string, number> = {
    'ممتاز': 10,
    'جيد جدا': 8,
    'جيد جداً': 8,
    'جيد': 6,
    'حسن': 5,
    'متوسط': 4,
    'مقبول': 3,
    'ضعيف': 1,
    'لم يحفظ': 0,
};

const BEHAVIOR_POINTS: Record<string, number> = {
    'هادئ': 10,
    'متوسط': 7,
    'مقبول': 5,
    'غير منضبط': 2,
    'مشاغب': 0,
};

interface StudentEvaluationRow {
    id: string;
    name: string;
    photoURL?: string;
    groupName: string;
    ownerId: string;
    registrationDate?: Date;
    
    // Sessions Stats
    totalSessions: number; // Raw count
    weightedSessions: number; // Sum of weights (e.g. 0.5 for dual sessions)
    assessedMemorization: number;
    assessedBehavior: number;

    // Attendance breakdown
    presentCount: number;
    makeupCount: number;
    lateCount: number;
    absentCount: number;

    // Detailed counts
    attendanceCounts: Record<string, number>;
    memorizationCounts: Record<string, number>;
    behaviorCounts: Record<string, number>;

    // Rates (0 - 100)
    attendanceRate: number;
    memorizationRate: number;
    behaviorRate: number;
    
    // Final Scores
    academicScore: number;
    comprehensiveScore: number;
}

export default function FairEvaluationPage() {
    const { students, dailySessions, loading, settings } = useStudentContext();
    const { isManagement, isSuperAdmin, user } = useAuth();
    
    // Filters State
    const [periodType, setPeriodType] = useState<'week' | 'month' | 'season' | 'year'>('month');
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedSeason, setSelectedSeason] = useState<number>(Math.floor(new Date().getMonth() / 3) + 1);
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [thresholdPercent, setThresholdPercent] = useState<number>(50); // Default to 50%
    const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
    const [showGuide, setShowGuide] = useState<boolean>(false);
    const [showCompare, setShowCompare] = useState<boolean>(false);
    const [compareStudent1Id, setCompareStudent1Id] = useState<string>('');
    const [compareStudent2Id, setCompareStudent2Id] = useState<string>('');
    
    // Sort State
    const [sortBy, setSortBy] = useState<'comprehensiveScore' | 'academicScore' | 'attendanceRate' | 'memorizationRate' | 'behaviorRate'>('academicScore');

    const pointsConfig = settings?.points;

    // Resolve date boundary based on selected period
    const dateBoundaries = useMemo(() => {
        const year = getYear(selectedDate);
        const month = getMonth(selectedDate);

        let start: Date;
        let end: Date;
        let title = '';

        switch (periodType) {
            case 'week':
                start = startOfWeek(selectedDate, { weekStartsOn: 6 });
                end = endOfWeek(selectedDate, { weekStartsOn: 6 });
                title = `الأسبوع من ${format(start, 'dd MMM', { locale: ar })} إلى ${format(end, 'dd MMM yyyy', { locale: ar })}`;
                break;
            case 'season':
                const startMonth = (selectedSeason - 1) * 3;
                start = startOfMonth(new Date(year, startMonth));
                end = endOfMonth(new Date(year, startMonth + 2));
                const seasonNames = ['الشتاء (الربع الأول)', 'الربيع (الربع الثاني)', 'الصيف (الربع الثالث)', 'الخريف (الربع الرابع)'];
                title = `موسم ${seasonNames[selectedSeason - 1]} - سنة ${year}`;
                break;
            case 'year':
                start = new Date(year, 0, 1);
                end = new Date(year, 11, 31, 23, 59, 59);
                title = `سنة ${year}`;
                break;
            case 'month':
            default:
                start = startOfMonth(selectedDate);
                end = endOfMonth(selectedDate);
                title = `شهر ${format(selectedDate, 'MMMM yyyy', { locale: ar })}`;
                break;
        }

        return { start, end, title };
    }, [periodType, selectedDate, selectedSeason]);

    // Main logic for aggregating and calculating fair metrics
    const evaluationData = useMemo(() => {
        if (!students || !dailySessions) return { ranked: [], pending: [], maxSessionsInPeriod: 0, minSessionsRequired: 0 };

        const { start, end } = dateBoundaries;

        // 1. Filter and sort target sessions in range (excluding holidays & un-substituted sheikh absences)
        const sessionsInRange = Object.values(dailySessions).flatMap(day => Object.values(day)).filter(session => {
            if (!session?.date || session.sessionType === 'يوم عطلة' || (session.sessionType === 'غياب الشيخ' && !session.substituteTeacher)) return false;
            try {
                const sessionDate = parseISO(session.date);
                return sessionDate >= start && sessionDate <= end;
            } catch {
                return false;
            }
        });

        // 2. Group sessions by date to calculate weights (0.5 for days with two sessions)
        const sessionsByDate: Record<string, any[]> = {};
        sessionsInRange.forEach(session => {
            if (!sessionsByDate[session.date]) {
                sessionsByDate[session.date] = [];
            }
            sessionsByDate[session.date].push(session);
        });

        // 3. Resolve active point limits dynamically
        const maxAttendanceVal = pointsConfig?.attendance ? Math.max(...Object.values(pointsConfig.attendance).map(Number)) : 10;
        const maxMemorizationVal = pointsConfig?.evaluation ? Math.max(...Object.values(pointsConfig.evaluation).map(Number)) : 10;
        const maxBehaviorVal = pointsConfig?.behavior ? Math.max(...Object.values(pointsConfig.behavior).map(Number)) : 10;

        // Helper to resolve student points
        const getAttPoints = (att: string) => pointsConfig?.attendance?.[att] ?? ATTENDANCE_POINTS[att] ?? 0;
        const getMemoPoints = (memo: string) => pointsConfig?.evaluation?.[memo] ?? PERFORMANCE_POINTS[memo] ?? 0;
        const getBehPoints = (beh: string) => pointsConfig?.behavior?.[beh] ?? BEHAVIOR_POINTS[beh] ?? 0;

        // 4. Initialize scores structure
        const scores: Record<string, StudentEvaluationRow> = {};
        let targetStudents = students.filter(s => s.status === 'نشط');
        
        if (isManagement && selectedGroup !== 'all') {
            targetStudents = targetStudents.filter(s => s.ownerId === selectedGroup);
        } else if (!isManagement && !isSuperAdmin && user) {
            // Regular Sheikh can only see their own group
            targetStudents = targetStudents.filter(s => s.ownerId === user.uid);
        }

        targetStudents.forEach(s => {
            scores[s.id] = {
                id: s.id,
                name: s.fullName,
                photoURL: s.photoURL,
                groupName: s.groupName || 'غير محدد',
                ownerId: s.ownerId,
                registrationDate: s.registrationDate ? new Date(s.registrationDate) : undefined,
                totalSessions: 0,
                weightedSessions: 0,
                assessedMemorization: 0,
                assessedBehavior: 0,
                presentCount: 0,
                makeupCount: 0,
                lateCount: 0,
                absentCount: 0,
                attendanceCounts: {
                    'حاضر': 0,
                    'تعويض': 0,
                    'متأخر': 0,
                    'غائب': 0
                },
                memorizationCounts: {
                    'ممتاز': 0,
                    'جيد جداً': 0,
                    'جيد': 0,
                    'حسن': 0,
                    'متوسط': 0,
                    'مقبول': 0,
                    'ضعيف': 0,
                    'لم يحفظ': 0,
                    'أوراد مراجعة': 0
                },
                behaviorCounts: {
                    'هادئ': 0,
                    'متوسط': 0,
                    'مقبول': 0,
                    'غير منضبط': 0,
                    'مشاغب': 0
                },
                attendanceRate: 0,
                memorizationRate: 0,
                behaviorRate: 0,
                academicScore: 0,
                comprehensiveScore: 0
            };
        });

        // 5. Aggregate session records
        sessionsInRange.forEach(session => {
            const dateSessions = sessionsByDate[session.date] || [];
            const weight = dateSessions.length >= 2 ? 0.5 : 1.0;

            (session.records ?? []).forEach(record => {
                const sId = record.studentId;
                const score = scores[sId];
                if (!score) return;

                score.totalSessions++;
                score.weightedSessions += weight;

                // A. Attendance
                if (record.attendance) {
                    const earned = getAttPoints(record.attendance) * weight;
                    score.attendanceRate += earned;
                    
                    if (record.attendance === 'حاضر') score.presentCount++;
                    else if (record.attendance === 'غياب' || record.attendance === 'غائب') score.absentCount++;
                    else if (record.attendance === 'متأخر') score.lateCount++;
                    else if (record.attendance === 'تعويض') score.makeupCount++;

                    const attKey = (record.attendance === 'غياب' || record.attendance === 'غائب') ? 'غائب' : record.attendance;
                    if (score.attendanceCounts[attKey] !== undefined) {
                        score.attendanceCounts[attKey]++;
                    }
                }

                // B. Memorization
                if (!record.review && record.memorization && record.memorization !== 'لا يوجد' && record.memorization !== '') {
                    score.assessedMemorization += weight;
                    score.memorizationRate += getMemoPoints(record.memorization) * weight;
                    
                    const memoKey = record.memorization === 'جيد جدا' ? 'جيد جداً' : record.memorization;
                    if (score.memorizationCounts[memoKey] !== undefined) {
                        score.memorizationCounts[memoKey]++;
                    }
                } else if (record.review && pointsConfig?.review?.completed) {
                    score.assessedMemorization += weight;
                    score.memorizationRate += pointsConfig.review.completed * weight;
                    score.memorizationCounts['أوراد مراجعة']++;
                }

                // C. Behavior
                if (record.behavior && record.behavior !== '') {
                    score.assessedBehavior += weight;
                    score.behaviorRate += getBehPoints(record.behavior) * weight;

                    const behKey = record.behavior;
                    if (score.behaviorCounts[behKey] !== undefined) {
                        score.behaviorCounts[behKey]++;
                    }
                }
            });
        });

        // 6. Find max sessions held by any student in this period to compute dynamic threshold
        let maxSessionsInPeriod = 0;
        Object.values(scores).forEach(s => {
            if (s.totalSessions > maxSessionsInPeriod) {
                maxSessionsInPeriod = s.totalSessions;
            }
        });

        // Dynamic minimum sessions required based on threshold percent
        const minSessionsRequired = Math.max(1, Math.round(maxSessionsInPeriod * (thresholdPercent / 100)));

        // 7. Calculate Final Percentage Scores
        const results = Object.values(scores).map(score => {
            const maxAttPoints = score.weightedSessions * maxAttendanceVal;
            const maxMemoPoints = score.assessedMemorization * maxMemorizationVal;
            const maxBehPoints = score.assessedBehavior * maxBehaviorVal;

            const attPct = maxAttPoints > 0 ? (score.attendanceRate / maxAttPoints) * 100 : 0;
            const memoPct = maxMemoPoints > 0 ? (score.memorizationRate / maxMemoPoints) * 100 : 0;
            const behPct = maxBehPoints > 0 ? (score.behaviorRate / maxBehPoints) * 100 : 0;

            const academic = (attPct + memoPct) / 2;
            const comprehensive = score.assessedBehavior > 0 ? (attPct + memoPct + behPct) / 3 : academic;

            return {
                ...score,
                attendanceRate: Math.max(0, Math.round(attPct * 10) / 10),
                memorizationRate: Math.max(0, Math.round(memoPct * 10) / 10),
                behaviorRate: Math.max(0, Math.round(behPct * 10) / 10),
                academicScore: Math.max(0, Math.round(academic * 10) / 10),
                comprehensiveScore: Math.max(0, Math.round(comprehensive * 10) / 10)
            };
        });

        // 8. Split into Leaderboard (Ranked) and Pending (Insufficient Sessions)
        const ranked: StudentEvaluationRow[] = [];
        const pending: StudentEvaluationRow[] = [];

        results.forEach(r => {
            if (r.totalSessions >= minSessionsRequired) {
                ranked.push(r);
            } else {
                pending.push(r);
            }
        });

        // Sort both by selected sort criteria
        const sortFn = (a: any, b: any) => {
            if (b[sortBy] !== a[sortBy]) return b[sortBy] - a[sortBy];
            if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions;
            return a.name.localeCompare(b.name);
        };

        return {
            ranked: ranked.sort(sortFn),
            pending: pending.sort(sortFn),
            maxSessionsInPeriod,
            minSessionsRequired
        };

    }, [students, dailySessions, dateBoundaries, pointsConfig, sortBy, selectedGroup, isManagement, isSuperAdmin, user, thresholdPercent]);

    // Top three for Podium display
    const podiumStudents = useMemo(() => {
        return evaluationData.ranked.slice(0, 3);
    }, [evaluationData.ranked]);

    const activeMetric = useMemo(() => {
        switch (sortBy) {
            case 'comprehensiveScore':
                return { label: 'التقييم الشامل', key: 'comprehensiveScore' as const };
            case 'academicScore':
                return { label: 'التقييم الأكاديمي', key: 'academicScore' as const };
            case 'attendanceRate':
                return { label: 'نسبة المواظبة', key: 'attendanceRate' as const };
            case 'memorizationRate':
                return { label: 'جودة الحفظ والتسميع', key: 'memorizationRate' as const };
            case 'behaviorRate':
                return { label: 'انضباط السلوك', key: 'behaviorRate' as const };
            default:
                return { label: 'التقييم الأكاديمي', key: 'academicScore' as const };
        }
    }, [sortBy]);

    // Resolved compare students
    const s1 = useMemo(() => {
        if (compareStudent1Id) {
            return evaluationData.ranked.find(s => s.id === compareStudent1Id) || evaluationData.pending.find(s => s.id === compareStudent1Id);
        }
        return evaluationData.ranked[1] || evaluationData.ranked[0];
    }, [evaluationData.ranked, evaluationData.pending, compareStudent1Id]);

    const s2 = useMemo(() => {
        if (compareStudent2Id) {
            return evaluationData.ranked.find(s => s.id === compareStudent2Id) || evaluationData.pending.find(s => s.id === compareStudent2Id);
        }
        return evaluationData.ranked[4] || evaluationData.ranked[2] || evaluationData.ranked[1];
    }, [evaluationData.ranked, evaluationData.pending, compareStudent2Id]);

    const generateComparisonExplanation = (std1: StudentEvaluationRow, std2: StudentEvaluationRow) => {
        const metricKey = sortBy;
        const metricLabel = activeMetric.label;
        
        const val1 = std1[metricKey];
        const val2 = std2[metricKey];
        
        const higher = val1 >= val2 ? std1 : std2;
        const lower = val1 >= val2 ? std2 : std1;
        const diff = Math.abs(val1 - val2).toFixed(1);
        
        const attDiff = (std1.attendanceRate - std2.attendanceRate).toFixed(1);
        const memoDiff = (std1.memorizationRate - std2.memorizationRate).toFixed(1);
        const behDiff = (std1.behaviorRate - std2.behaviorRate).toFixed(1);
        
        let explanationText = "";
        
        if (val1 === val2) {
            explanationText = `يتساوى الطالبان **${std1.name}** و **${std2.name}** في معيار ${metricLabel} بنسبة **${val1}%**. \n\n`;
            if (std1.totalSessions !== std2.totalSessions) {
                const sessionsHigher = std1.totalSessions > std2.totalSessions ? std1 : std2;
                const sessionsLower = std1.totalSessions > std2.totalSessions ? std2 : std1;
                explanationText += `ولكن تم ترتيب **${sessionsHigher.name}** أولاً لأنه يمتلك حصصاً مقيمة أكثر (${sessionsHigher.totalSessions} حصة مقابل ${sessionsLower.totalSessions} حصة) مما يعطي مصداقية أكبر لبياناته.`;
            } else {
                explanationText += `تم الترتيب أبجدياً لتطابق جميع الدرجات والحصص.`;
            }
        } else {
            explanationText = `يتفوق الطالب **${higher.name}** على **${lower.name}** في معيار الفرز المختار (${metricLabel}) بفارق **${diff}%** (حيث حصل ${higher.name} على ${val1}% بينما حصل ${lower.name} على ${val2}%). \n\n`;
            
            explanationText += `**🔍 تفاصيل الفروقات بينهما:**\n`;
            
            // Attendance diff
            const attDiffNum = parseFloat(attDiff);
            if (attDiffNum > 0) {
                explanationText += `• يتفوق **${std1.name}** في المواظبة (الحضور) بفارق **${Math.abs(attDiffNum)}%** (${std1.attendanceRate}% مقابل ${std2.attendanceRate}%).\n`;
            } else if (attDiffNum < 0) {
                explanationText += `• يتفوق **${std2.name}** في المواظبة (الحضور) بفارق **${Math.abs(attDiffNum)}%** (${std2.attendanceRate}% مقابل ${std1.attendanceRate}%).\n`;
            } else {
                explanationText += `• الطالبان متساويان تماماً في المواظبة والحضور بنسبة **${std1.attendanceRate}%**.\n`;
            }

            // Memorization diff
            const memoDiffNum = parseFloat(memoDiff);
            if (memoDiffNum > 0) {
                explanationText += `• يتفوق **${std1.name}** في جودة الحفظ والتسميع بفارق **${Math.abs(memoDiffNum)}%** (${std1.memorizationRate}% مقابل ${std2.memorizationRate}%).\n`;
            } else if (memoDiffNum < 0) {
                explanationText += `• يتفوق **${std2.name}** في جودة الحفظ والتسميع بفارق **${Math.abs(memoDiffNum)}%** (${std2.memorizationRate}% مقابل ${std1.memorizationRate}%).\n`;
            } else {
                explanationText += `• الطالبان متساويان تماماً في جودة الحفظ بنسبة **${std1.memorizationRate}%**.\n`;
            }

            // Behavior diff
            const behDiffNum = parseFloat(behDiff);
            if (behDiffNum > 0) {
                explanationText += `• يتفوق **${std1.name}** في انضباط السلوك بفارق **${Math.abs(behDiffNum)}%** (${std1.behaviorRate}% مقابل ${std2.behaviorRate}%).\n`;
            } else if (behDiffNum < 0) {
                explanationText += `• يتفوق **${std2.name}** في انضباط السلوك بفارق **${Math.abs(behDiffNum)}%** (${std2.behaviorRate}% مقابل ${std1.behaviorRate}%).\n`;
            } else {
                explanationText += `• الطالبان متساويان في انضباط السلوك بنسبة **${std1.behaviorRate}%**.\n`;
            }

            // Academic Score logic
            if (metricKey === 'academicScore') {
                explanationText += `\n**💡 كيف رُجّحت الكفة؟**\nالمعدل الأكاديمي يُحسب بمتوسط الحضور والحفظ بالتساوي (50% لكل منهما). `;
                if (Math.abs(attDiffNum) > 0 && Math.abs(memoDiffNum) > 0) {
                    if (Math.sign(attDiffNum) === Math.sign(memoDiffNum)) {
                        explanationText += `يتفوق **${higher.name}** في كلا الجانبين (المواظبة وجودة الحفظ) مما جعله يستحق الصدارة بوضوح.`;
                    } else {
                        const betterAtt = attDiffNum > 0 ? std1 : std2;
                        const betterMemo = memoDiffNum > 0 ? std1 : std2;
                        explanationText += `على الرغم من أن **${betterAtt.name}** أفضل في نسبة الحضور، إلا أن تفوق **${betterMemo.name}** الأكبر في جودة الحفظ والتسميع عوّض ذلك الفارق ورجح كفته في المعدل الأكاديمي النهائي (أو العكس).`;
                    }
                } else if (Math.abs(attDiffNum) > 0) {
                    explanationText += `بما أنهما متساويان في جودة الحفظ والتسميع، فإن تفوق **${higher.name}** في نسبة الحضور هو الذي حسم صدارته.`;
                } else if (Math.abs(memoDiffNum) > 0) {
                    explanationText += `بما أنهما متساويان في المواظبة والحضور، فإن تفوق **${higher.name}** في جودة الحفظ والتسميع هو الذي حسم صدارته.`;
                }
            } else if (metricKey === 'comprehensiveScore') {
                explanationText += `\n**💡 كيف رُجّحت الكفة؟**\nالمعدل الشامل يُحسب بمتوسط الحضور والحفظ والسلوك بالتساوي (ثلث لكل جانب). التفوق في الجوانب السلوكية أو الحفظ هو الذي أحدث هذا الفارق الإجمالي.`;
            }
        }
        
        return explanationText;
    };

    // Handle date navigation
    const handleDateNavigation = (direction: 'prev' | 'next') => {
        const offset = direction === 'next' ? 1 : -1;
        if (periodType === 'week') setSelectedDate(d => addWeeks(d, offset));
        else if (periodType === 'month') setSelectedDate(d => new Date(getYear(d), getMonth(d) + offset, 1));
        else if (periodType === 'season' || periodType === 'year') {
            setSelectedDate(d => new Date(getYear(d) + offset, getMonth(d), 1));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div dir="rtl" className="space-y-8 pb-20 animate-in fade-in duration-500">
                {/* 1. Header Banner */}
                <Card className="border-none shadow-xl bg-gradient-to-r from-emerald-900 via-teal-800 to-indigo-900 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                    <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 p-8">
                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-headline font-black tracking-tight flex items-center gap-3">
                                <Sparkles className="h-8 w-8 text-amber-400 animate-pulse" />
                                لوحة التقييم العادل والشامل للفوج
                            </CardTitle>
                            <CardDescription className="text-teal-100 text-base font-medium max-w-2xl leading-relaxed">
                                لوحة شرف متكاملة تقوم بحساب دقيق لمستويات الطلاب بناءً على النسب المئوية العادلة، للتخلص من أفضلية الحضور المطلق وإبراز الكفاءة الحقيقية.
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>

                {/* Collapsible Quick Guide */}
                <div className="transition-all duration-300">
                    <Card className={cn(
                        "border shadow-sm overflow-hidden transition-all duration-300 bg-emerald-500/5 border-emerald-500/10",
                        showGuide ? "rounded-[2rem] p-6 space-y-4" : "rounded-2xl p-4 flex items-center justify-between"
                    )}>
                        {showGuide ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b pb-3 border-emerald-500/20">
                                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                                        <Award className="h-6 w-6 text-emerald-600" />
                                        <h3 className="font-headline font-black text-base md:text-lg">👑 كيف يعمل نظام "التقييم العادل والشامل الجديد"؟ (دليل المشايخ)</h3>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => setShowGuide(false)} className="h-8 text-emerald-850 font-bold hover:bg-emerald-500/10">إخفاء الدليل</Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right leading-relaxed">
                                    <div className="space-y-3">
                                        <div className="bg-white/80 dark:bg-slate-900/40 p-4 rounded-2xl border border-emerald-500/10">
                                            <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-250 mb-1">1️⃣ التقييم الأكاديمي مقابل الشامل</h4>
                                            <p className="text-xs text-muted-foreground font-bold leading-normal">
                                                <strong>التقييم الأكاديمي (الأساسي والافتراضي للترتيب)</strong>: هو العمود الفقري للطالب ويجمع بين (المواظبة والحضور) و(جودة الحفظ والتسميع) فقط لضمان أقصى عدالة وتكافؤ.
                                                <br />
                                                <strong>التقييم الشامل</strong>: يضيف انضباط السلوك، وهو غير أساسي للترتيب لأن السلوك لا يقيم يومياً بانتظام وقد يقيم نادراً.
                                            </p>
                                        </div>
                                        <div className="bg-white/80 dark:bg-slate-900/40 p-4 rounded-2xl border border-emerald-500/10">
                                            <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-250 mb-1">2️⃣ آلية وزن الحصص اليومية (ص/م)</h4>
                                            <p className="text-xs text-muted-foreground font-bold leading-normal">
                                                عند وجود حصتين للطالب في يوم واحد (حصة صباحية ومسائية تعويضية)، يتم احتساب كل حصة بوزن نصف يوم (0.5) في معادلات الحضور والتقييم لضمان توازن التقييمات للفترة وتفادي انحياز التراكمي المفرط.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="bg-white/80 dark:bg-slate-900/40 p-4 rounded-2xl border border-emerald-500/10">
                                            <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-250 mb-1">3️⃣ الحد الأدنى وتجنب تلاعب العينات</h4>
                                            <p className="text-xs text-muted-foreground font-bold leading-normal">
                                                لمنع تصدر طلاب جدد أو ذوي حضور قليل بنسب مئوية خادعة (100% من حصة واحدة)، يلزم النظام حضور الطالب حداً أدنى من الحصص للمنافسة بالجدول الرئيسي. الطلاب الأقل يوضعون بجدول منفصل بالأسفل لعرض نسبهم الحقيقية دون التأثير على الترتيب العام.
                                            </p>
                                        </div>
                                        <div className="bg-white/80 dark:bg-slate-900/40 p-4 rounded-2xl border border-emerald-500/10">
                                            <h4 className="font-bold text-xs text-emerald-900 dark:text-emerald-250 mb-1">4️⃣ تنبيه قلة البيانات (رمز التحذير ⚠️)</h4>
                                            <p className="text-xs text-muted-foreground font-bold leading-normal">
                                                يظهر رمز ⚠️ بجانب نسبة الحفظ أو السلوك إذا كان عدد التقييمات المسجلة قليلاً جداً مقارنة بإجمالي الحضور، للتنبيه بأن النسبة قد تكون خادعة إحصائياً ولا تعكس الواقع بدقة وتتطلب مزيداً من التقييمات.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-emerald-500/10 p-3 rounded-xl text-center text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                                    💡 <strong>معلومة إضافية</strong>: يمكنك النقر فوق اسم أي طالب في الجدول لعرض كشف تفصيلي بالأعداد الدقيقة لكافة أيامه ومراتب حفظه وسلوكه.
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-700 dark:text-emerald-400">
                                        <Info className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-headline font-bold text-sm text-emerald-900 dark:text-emerald-200">👑 دليل المشايخ المبسط: كيف يتم حساب الترتيب والعدالة؟</h3>
                                        <p className="text-xs text-muted-foreground font-bold mt-0.5">افتح الدليل للتعرف على الفرق بين التقييم الأكاديمي والشامل، ونسب الحضور، ورمز ⚠️.</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setShowGuide(true)} className="h-8 font-bold border-emerald-500/20 text-emerald-700 hover:bg-emerald-500/10">عرض الدليل المبسط</Button>
                            </>
                        )}
                    </Card>
                </div>

                {/* 2. Advanced Filters */}
                <div className="bg-card rounded-[2rem] border p-6 shadow-sm flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-bold text-muted-foreground ml-2">نوع الفرز الزمني:</span>
                            <div className="flex items-center bg-muted p-1 rounded-xl shadow-inner">
                                <Button variant={periodType === 'week' ? 'secondary' : 'ghost'} size="sm" onClick={() => setPeriodType('week')} className="h-9 px-4 rounded-lg font-bold text-xs">أسبوعي</Button>
                                <Button variant={periodType === 'month' ? 'secondary' : 'ghost'} size="sm" onClick={() => setPeriodType('month')} className="h-9 px-4 rounded-lg font-bold text-xs">شهري</Button>
                                <Button variant={periodType === 'season' ? 'secondary' : 'ghost'} size="sm" onClick={() => setPeriodType('season')} className="h-9 px-4 rounded-lg font-bold text-xs">موسمي</Button>
                                <Button variant={periodType === 'year' ? 'secondary' : 'ghost'} size="sm" onClick={() => setPeriodType('year')} className="h-9 px-4 rounded-lg font-bold text-xs">سنوي</Button>
                            </div>
                        </div>

                        {/* Date Navigation & Label */}
                        <div className="flex items-center gap-2 bg-background p-1 rounded-xl border shadow-sm">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDateNavigation('prev')}><ChevronLeft className="h-4 w-4 transform rotate-180" /></Button>
                            <span className="font-bold px-4 min-w-[150px] text-center text-xs text-primary">{dateBoundaries.title}</span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDateNavigation('next')}><ChevronRight className="h-4 w-4 transform rotate-180" /></Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                            {isManagement && (
                                <div className="w-full sm:w-[220px]">
                                    <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />
                                </div>
                            )}

                            {periodType === 'season' && (
                                <Select dir="rtl" value={selectedSeason.toString()} onValueChange={(val) => setSelectedSeason(parseInt(val))}>
                                    <SelectTrigger className="w-[180px] bg-background"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">الربع 1 (شتاء)</SelectItem>
                                        <SelectItem value="2">الربع 2 (ربيع)</SelectItem>
                                        <SelectItem value="3">الربع 3 (صيف)</SelectItem>
                                        <SelectItem value="4">الربع 4 (خريف)</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto justify-end">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">الحد الأدنى لحضور الحصص:</span>
                                <Select dir="rtl" value={thresholdPercent.toString()} onValueChange={(val) => {
                                    setThresholdPercent(parseInt(val));
                                    setExpandedStudentId(null);
                                }}>
                                    <SelectTrigger className="w-[155px] bg-background font-bold text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="10">10% من حصص الفترة</SelectItem>
                                        <SelectItem value="30">30% من حصص الفترة</SelectItem>
                                        <SelectItem value="50">50% من حصص الفترة</SelectItem>
                                        <SelectItem value="70">70% من حصص الفترة</SelectItem>
                                        <SelectItem value="90">90% من حصص الفترة</SelectItem>
                                        <SelectItem value="100">100% من حصص الفترة</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground p-0">
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs font-bold text-right max-w-xs leading-relaxed" dir="rtl">
                                        <p className="font-black mb-1">الحد الأدنى للمنافسة:</p>
                                        <p>يمنع الطلاب الجدد أو قليل الحضور من تصدر الترتيب بنسبة 100% وهمية من حصة واحدة. الطلاب الأقل يوضعون بالجدول السفلي.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">الترتيب حسب:</span>
                                <Select dir="rtl" value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                                    <SelectTrigger className="w-full sm:w-[200px] bg-background font-bold text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="comprehensiveScore">التقييم الشامل العادل</SelectItem>
                                        <SelectItem value="academicScore">التقييم الأكاديمي (حضور+حفظ)</SelectItem>
                                        <SelectItem value="attendanceRate">نسبة المواظبة (الحضور)</SelectItem>
                                        <SelectItem value="memorizationRate">جودة الحفظ والتسميع</SelectItem>
                                        <SelectItem value="behaviorRate">انضباط السلوك والأخلاق</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground p-0">
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs font-bold text-right max-w-xs leading-relaxed" dir="rtl">
                                        <p className="font-black mb-1">معايير الترتيب:</p>
                                        <p className="mb-1">• <strong>التقييم الأكاديمي (الأساسي)</strong>: يعتمد على الحضور والحفظ فقط لضمان العدالة وتفادي تباعد تقييمات السلوك.</p>
                                        <p>• <strong>التقييم الشامل (الفرعي)</strong>: يضيف السلوك، ولكنه غير أساسي لأن السلوك لا يقيم يومياً بانتظام.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. The Fair Podium Section */}
                {podiumStudents.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto items-end pt-8">
                        {/* 2nd Place */}
                        {podiumStudents[1] && (
                            <div className="flex flex-col items-center order-2 md:order-1 animate-in slide-in-from-bottom-8 duration-500 delay-100">
                                <span className="text-3xl mb-1">🥈</span>
                                <div className="bg-slate-100 dark:bg-slate-800/40 p-4 rounded-3xl w-full border border-slate-200 text-center space-y-3 relative hover:scale-105 transition-transform duration-300">
                                    <Avatar className="w-16 h-16 mx-auto border-2 border-slate-300 shadow-md">
                                        <AvatarImage src={podiumStudents[1].photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${podiumStudents[1].name}`} />
                                        <AvatarFallback className="bg-primary/5">{podiumStudents[1].name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="font-bold font-headline text-md text-slate-800 truncate">{podiumStudents[1].name}</h4>
                                        <p className="text-[10px] text-muted-foreground font-bold">{podiumStudents[1].groupName}</p>
                                    </div>
                                    <div className="bg-white/80 p-2 rounded-xl text-center shadow-inner">
                                        <p className="text-[10px] text-muted-foreground font-bold">{activeMetric.label}</p>
                                        <p className="text-xl font-black text-slate-700">{podiumStudents[1][activeMetric.key]}%</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 1st Place - Golden Crown */}
                        {podiumStudents[0] && (
                            <div className="flex flex-col items-center order-1 md:order-2 animate-in slide-in-from-bottom-8 duration-700">
                                <span className="text-4xl mb-1 drop-shadow-md animate-bounce">👑</span>
                                <div className="bg-gradient-to-b from-amber-50 to-white dark:from-amber-950/20 dark:to-background p-6 rounded-3xl w-full border-2 border-amber-300 text-center space-y-4 relative shadow-lg hover:scale-105 transition-transform duration-300">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-amber-500 text-white font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider">البطل</div>
                                    <Avatar className="w-20 h-20 mx-auto border-4 border-amber-400 shadow-lg">
                                        <AvatarImage src={podiumStudents[0].photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${podiumStudents[0].name}`} />
                                        <AvatarFallback className="bg-amber-100">{podiumStudents[0].name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="font-black font-headline text-lg text-amber-950">{podiumStudents[0].name}</h4>
                                        <p className="text-[10px] text-amber-700 font-bold">{podiumStudents[0].groupName}</p>
                                    </div>
                                    <div className="bg-amber-100/50 p-2 rounded-2xl text-center shadow-inner">
                                        <p className="text-[10px] text-amber-800 font-bold">{activeMetric.label}</p>
                                        <p className="text-2xl font-black text-amber-700">{podiumStudents[0][activeMetric.key]}%</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3rd Place */}
                        {podiumStudents[2] && (
                            <div className="flex flex-col items-center order-3 md:order-3 animate-in slide-in-from-bottom-8 duration-500 delay-200">
                                <span className="text-3xl mb-1">🥉</span>
                                <div className="bg-amber-50/10 dark:bg-amber-950/10 p-4 rounded-3xl w-full border border-amber-100 text-center space-y-3 relative hover:scale-105 transition-transform duration-300">
                                    <Avatar className="w-16 h-16 mx-auto border-2 border-amber-200 shadow-md">
                                        <AvatarImage src={podiumStudents[2].photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${podiumStudents[2].name}`} />
                                        <AvatarFallback className="bg-primary/5">{podiumStudents[2].name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h4 className="font-bold font-headline text-md text-amber-900/80 truncate">{podiumStudents[2].name}</h4>
                                        <p className="text-[10px] text-muted-foreground font-bold">{podiumStudents[2].groupName}</p>
                                    </div>
                                    <div className="bg-white/80 p-2 rounded-xl text-center shadow-inner">
                                        <p className="text-[10px] text-muted-foreground font-bold">{activeMetric.label}</p>
                                        <p className="text-xl font-black text-amber-800/80">{podiumStudents[2][activeMetric.key]}%</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 3.5 Compare Arena */}
                <div className="space-y-4">
                    <div className="flex justify-center">
                        <Button 
                            variant="outline" 
                            onClick={() => setShowCompare(!showCompare)} 
                            className={cn(
                                "rounded-full px-6 font-bold text-xs gap-2 transition-all shadow-sm h-10",
                                showCompare ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 hover:bg-indigo-500/20" : "border-slate-200 hover:bg-slate-50"
                            )}
                        >
                            <TrendingUp className="h-4 w-4 text-indigo-600" />
                            {showCompare ? "إغلاق ساحة المقارنة" : "⚖️ مقارنة ثنائية تحليلية بين طالبين"}
                        </Button>
                    </div>

                    {showCompare && s1 && s2 && (
                        <Card className="rounded-[2.5rem] border border-indigo-500/20 bg-gradient-to-b from-indigo-50/20 to-white shadow-lg p-6 max-w-4xl mx-auto space-y-6 animate-in slide-in-from-top-4 duration-350">
                            <div className="border-b pb-3 border-indigo-500/10 text-center">
                                <h3 className="font-headline font-black text-lg text-indigo-950 flex items-center justify-center gap-2">
                                    ⚖️ ساحة التحليل والمقارنة التفصيلية
                                </h3>
                                <p className="text-xs text-muted-foreground font-bold mt-1">اختر أي طالبين من القائمة بالأسفل لمقارنة الأداء والنسب وتفاصيل التفوق البرمجي</p>
                            </div>

                            {/* Select Dropdowns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-black text-slate-500 block">الطالب الأول:</label>
                                    <Select dir="rtl" value={s1.id} onValueChange={(val) => setCompareStudent1Id(val)}>
                                        <SelectTrigger className="w-full bg-background font-bold text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[...evaluationData.ranked, ...evaluationData.pending].map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name} ({s.groupName})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1.5 text-right">
                                    <label className="text-xs font-black text-slate-500 block">الطالب الثاني:</label>
                                    <Select dir="rtl" value={s2.id} onValueChange={(val) => setCompareStudent2Id(val)}>
                                        <SelectTrigger className="w-full bg-background font-bold text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[...evaluationData.ranked, ...evaluationData.pending].map(s => (
                                                <SelectItem key={s.id} value={s.id}>{s.name} ({s.groupName})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Side by side stats */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-100">
                                {/* Student 1 Details */}
                                <div className="space-y-4 text-right">
                                    <div className="flex items-center gap-3 border-b pb-3">
                                        <Avatar className="h-12 w-12 border shadow-sm">
                                            <AvatarImage src={s1.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${s1.name}`} />
                                            <AvatarFallback>{s1.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="font-headline font-black text-slate-900 text-sm">{s1.name}</h4>
                                            <Badge variant="outline" className="text-[10px] font-black mt-1 py-0.5 px-2">الترتيب: {evaluationData.ranked.findIndex(x => x.id === s1.id) !== -1 ? evaluationData.ranked.findIndex(x => x.id === s1.id) + 1 : 'خارج الترتيب'}</Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-primary font-black">التقييم الأكاديمي: {s1.academicScore}%</span>
                                                <span className="text-slate-400">({s1.totalSessions} حصة)</span>
                                            </div>
                                            <Progress value={s1.academicScore} className="h-2 bg-slate-100 [&>div]:bg-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-emerald-600">المواظبة (الحضور): {s1.attendanceRate}%</span>
                                            </div>
                                            <Progress value={s1.attendanceRate} className="h-1.5 bg-slate-100 [&>div]:bg-emerald-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-amber-500">جودة الحفظ والتسميع: {s1.memorizationRate}%</span>
                                            </div>
                                            <Progress value={s1.memorizationRate} className="h-1.5 bg-slate-100 [&>div]:bg-amber-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-indigo-600">انضباط السلوك: {s1.behaviorRate}%</span>
                                            </div>
                                            <Progress value={s1.behaviorRate} className="h-1.5 bg-slate-100 [&>div]:bg-indigo-500" />
                                        </div>
                                        <div className="space-y-1 border-t pt-2 mt-2">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-indigo-950 font-black">التقييم الشامل: {s1.comprehensiveScore}%</span>
                                            </div>
                                            <Progress value={s1.comprehensiveScore} className="h-2 bg-indigo-50 [&>div]:bg-indigo-950" />
                                        </div>
                                    </div>
                                </div>

                                {/* Student 2 Details */}
                                <div className="space-y-4 text-right">
                                    <div className="flex items-center gap-3 border-b pb-3">
                                        <Avatar className="h-12 w-12 border shadow-sm">
                                            <AvatarImage src={s2.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${s2.name}`} />
                                            <AvatarFallback>{s2.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h4 className="font-headline font-black text-slate-900 text-sm">{s2.name}</h4>
                                            <Badge variant="outline" className="text-[10px] font-black mt-1 py-0.5 px-2">الترتيب: {evaluationData.ranked.findIndex(x => x.id === s2.id) !== -1 ? evaluationData.ranked.findIndex(x => x.id === s2.id) + 1 : 'خارج الترتيب'}</Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-primary font-black">التقييم الأكاديمي: {s2.academicScore}%</span>
                                                <span className="text-slate-400">({s2.totalSessions} حصة)</span>
                                            </div>
                                            <Progress value={s2.academicScore} className="h-2 bg-slate-100 [&>div]:bg-primary" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-emerald-600">المواظبة (الحضور): {s2.attendanceRate}%</span>
                                            </div>
                                            <Progress value={s2.attendanceRate} className="h-1.5 bg-slate-100 [&>div]:bg-emerald-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-amber-500">جودة الحفظ والتسميع: {s2.memorizationRate}%</span>
                                            </div>
                                            <Progress value={s2.memorizationRate} className="h-1.5 bg-slate-100 [&>div]:bg-amber-400" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-indigo-600">انضباط السلوك: {s2.behaviorRate}%</span>
                                            </div>
                                            <Progress value={s2.behaviorRate} className="h-1.5 bg-slate-100 [&>div]:bg-indigo-500" />
                                        </div>
                                        <div className="space-y-1 border-t pt-2 mt-2">
                                            <div className="flex justify-between text-xs font-bold">
                                                <span className="text-indigo-950 font-black">التقييم الشامل: {s2.comprehensiveScore}%</span>
                                            </div>
                                            <Progress value={s2.comprehensiveScore} className="h-2 bg-indigo-50 [&>div]:bg-indigo-950" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Analysis Text */}
                            <div className="bg-indigo-500/5 border border-indigo-500/10 p-5 rounded-3xl space-y-2 text-right">
                                <h4 className="font-headline font-black text-xs text-indigo-950 flex items-center gap-2">
                                    🔬 تحليل الفروقات البرمجية والترتيب:
                                </h4>
                                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-bold">
                                    {generateComparisonExplanation(s1, s2)}
                                </p>
                            </div>
                        </Card>
                    )}
                </div>

                {/* 4. Leaderboard Grid */}
                <Card className="rounded-[2.5rem] border shadow-md overflow-hidden">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="text-xl font-headline font-bold text-slate-800">جدول الترتيب العام</CardTitle>
                                <CardDescription className="text-xs font-medium">الترتيب يعتمد تلقائياً على <strong>التقييم الأكاديمي كمعيار أساسي</strong> (أو معيار الفرز المختار). انقر فوق الطالب لعرض التفاصيل الكاملة والعدديّة.</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-black border-primary/20 bg-primary/5 text-primary py-1 px-3">
                                الحد الأدنى للتقييم: {evaluationData.minSessionsRequired} حصص
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead className="w-[80px] text-center font-bold">#</TableHead>
                                        <TableHead className="font-bold">الطالب</TableHead>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <TableHead className="text-center cursor-pointer font-bold w-[100px]">الحصص (وزن)</TableHead>
                                            </TooltipTrigger>
                                            <TooltipContent className="text-xs font-bold text-right" dir="rtl">
                                                <p>إجمالي الحصص المسجلة للطالب، مع احتساب وزن 0.5 لكل حصة إذا عُقدت حصتان في يوم واحد (حصة صباحية ومسائية) لضمان التكافؤ وعدم انحياز التراكمي.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                        <TableHead className="text-center font-bold">المواظبة %</TableHead>
                                        <TableHead className="text-center font-bold">جودة الحفظ %</TableHead>
                                        <TableHead className="text-center font-bold">السلوك %</TableHead>
                                        <TableHead className="text-center font-bold text-primary bg-primary/5">الأكاديمي %</TableHead>
                                        <TableHead className="text-center font-bold text-indigo-700 bg-indigo-50/50">الشامل %</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {evaluationData.ranked.length > 0 ? (
                                        evaluationData.ranked.flatMap((s, index) => {
                                            const rank = index + 1;
                                            let medal = '';
                                            if (rank === 1) medal = '🥇';
                                            else if (rank === 2) medal = '🥈';
                                            else if (rank === 3) medal = '🥉';

                                            const isBehaviorInsufficient = s.assessedBehavior < Math.max(3, s.totalSessions * 0.2);
                                            const isMemorizationInsufficient = s.assessedMemorization < Math.max(3, s.totalSessions * 0.2);
                                            const isExpanded = expandedStudentId === s.id;

                                            return [
                                                <TableRow 
                                                    key={s.id} 
                                                    onClick={() => setExpandedStudentId(isExpanded ? null : s.id)}
                                                    className={cn(
                                                        "cursor-pointer transition-colors duration-200 select-none",
                                                        isExpanded ? "bg-slate-100/50 dark:bg-slate-900/40 hover:bg-slate-100/60" : "hover:bg-slate-50/50"
                                                    )}
                                                >
                                                    <TableCell className="text-center font-black text-lg">
                                                        {medal || rank}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border shadow-sm shrink-0">
                                                                <AvatarImage src={s.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${s.name}`} alt="" />
                                                                <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <span className="font-bold text-sm text-foreground block leading-tight">{s.name}</span>
                                                                <span className="text-[10px] text-muted-foreground font-bold">{s.groupName}</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-xs">
                                                        {s.totalSessions} <span className="text-slate-400 font-normal">({s.weightedSessions.toFixed(1)})</span>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-bold text-sm">{s.attendanceRate}%</span>
                                                            <Progress value={s.attendanceRate} className="h-1 w-12 bg-slate-100 [&>div]:bg-emerald-500" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="flex items-center gap-1 justify-center">
                                                                <span className="font-bold text-sm">{s.memorizationRate}%</span>
                                                                {isMemorizationInsufficient && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="text-xs font-bold text-right" dir="rtl">
                                                                            تقييمات حفظ غير كافية ({s.assessedMemorization} من أصل {s.totalSessions})
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                            <Progress value={s.memorizationRate} className="h-1 w-12 bg-slate-100 [&>div]:bg-amber-400" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <div className="flex items-center gap-1 justify-center">
                                                                <span className="font-bold text-sm">{s.behaviorRate}%</span>
                                                                {isBehaviorInsufficient && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="text-xs font-bold text-right" dir="rtl">
                                                                            تقييمات سلوك غير كافية ({s.assessedBehavior} من أصل {s.totalSessions})
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                            <Progress value={s.behaviorRate} className="h-1 w-12 bg-slate-100 [&>div]:bg-indigo-400" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cn("text-center font-black text-sm bg-primary/5", sortBy === 'academicScore' && "bg-primary/10 text-primary")}>
                                                        {s.academicScore}%
                                                    </TableCell>
                                                    <TableCell className={cn("text-center font-black text-md bg-indigo-50/30", sortBy === 'comprehensiveScore' && "bg-indigo-100/50 text-indigo-700")}>
                                                        {s.comprehensiveScore}%
                                                    </TableCell>
                                                </TableRow>,
                                                isExpanded && (
                                                    <TableRow key={`${s.id}-expanded`} className="bg-slate-50/40 dark:bg-slate-900/10 border-t-0">
                                                        <TableCell colSpan={8} className="p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-900/20">
                                                            <StudentDetailCard student={s} maxSessions={evaluationData.maxSessionsInPeriod} />
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            ].filter(Boolean);
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                                لا توجد بيانات حضور مسجلة ومستوفية للحد الأدنى في هذه الفترة.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Pending Section (Insufficient Sessions) */}
                {evaluationData.pending.length > 0 && (
                    <Card className="rounded-[2.5rem] border border-dashed shadow-none">
                        <CardHeader className="bg-slate-50/20 p-6 border-b border-dashed">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-50 rounded-xl text-yellow-600"><ShieldAlert className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-lg font-headline font-bold text-slate-700">طلاب بحصص غير كافية لضمان العدالة</CardTitle>
                                    <CardDescription className="text-xs font-medium">الطلاب الذين يقل عدد حصصهم المقيمة عن الحد الأدنى ({evaluationData.minSessionsRequired} حصص). يتم عرض أدائهم هنا دون مقارنتهم بجدول الترتيب لضمان التكافؤ. انقر لعرض التفاصيل.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>الطالب</TableHead>
                                            <TableHead className="text-center font-bold w-[120px]">الحصص المسجلة</TableHead>
                                            <TableHead className="text-center font-bold">المواظبة %</TableHead>
                                            <TableHead className="text-center font-bold">جودة الحفظ %</TableHead>
                                            <TableHead className="text-center font-bold">السلوك %</TableHead>
                                            <TableHead className="text-center font-bold text-muted-foreground bg-slate-50/50">الأكاديمي %</TableHead>
                                            <TableHead className="text-center font-bold text-muted-foreground bg-slate-50/50">الشامل %</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {evaluationData.pending.map((s) => {
                                            const isBehaviorInsufficient = s.assessedBehavior < Math.max(3, s.totalSessions * 0.2);
                                            const isMemorizationInsufficient = s.assessedMemorization < Math.max(3, s.totalSessions * 0.2);
                                            const isExpanded = expandedStudentId === s.id;

                                            return (
                                                <React.Fragment key={s.id}>
                                                    <TableRow 
                                                        onClick={() => setExpandedStudentId(isExpanded ? null : s.id)}
                                                        className={cn(
                                                            "opacity-85 hover:opacity-100 transition-opacity cursor-pointer select-none",
                                                            isExpanded ? "bg-slate-100/50 dark:bg-slate-900/40" : "hover:bg-slate-50/50"
                                                        )}
                                                    >
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-8 w-8 shrink-0">
                                                                    <AvatarImage src={s.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${s.name}`} alt="" />
                                                                    <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <span className="font-bold text-sm text-foreground block leading-tight">{s.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-bold">{s.groupName}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-xs text-yellow-600">
                                                            {s.totalSessions} / {evaluationData.minSessionsRequired} <span className="text-slate-400 font-normal">({s.weightedSessions.toFixed(1)})</span>
                                                        </TableCell>
                                                        <TableCell className="text-center font-semibold text-sm">{s.attendanceRate}%</TableCell>
                                                        <TableCell className="text-center font-semibold text-sm">
                                                            <div className="flex items-center gap-1 justify-center">
                                                                <span>{s.memorizationRate}%</span>
                                                                {isMemorizationInsufficient && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <AlertTriangle className="h-3 w-3 text-amber-500 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="text-xs font-bold text-right" dir="rtl">
                                                                            تقييمات حفظ غير كافية ({s.assessedMemorization} من أصل {s.totalSessions})
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-semibold text-sm">
                                                            <div className="flex items-center gap-1 justify-center">
                                                                <span>{s.behaviorRate}%</span>
                                                                {isBehaviorInsufficient && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <AlertTriangle className="h-3 w-3 text-amber-500 cursor-help" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent className="text-xs font-bold text-right" dir="rtl">
                                                                            تقييمات سلوك غير كافية ({s.assessedBehavior} من أصل {s.totalSessions})
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold text-sm bg-slate-50/50">{s.academicScore}%</TableCell>
                                                        <TableCell className="text-center font-bold text-sm bg-slate-50/50">{s.comprehensiveScore}%</TableCell>
                                                    </TableRow>
                                                    {isExpanded && (
                                                        <TableRow className="bg-slate-50/40 dark:bg-slate-900/10 border-t-0">
                                                            <TableCell colSpan={7} className="p-4 sm:p-6 bg-slate-50/30 dark:bg-slate-900/20">
                                                                <StudentDetailCard student={s} maxSessions={evaluationData.maxSessionsInPeriod} />
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </TooltipProvider>
    );
}

// StudentDetailCard component to render the detailed stats
function StudentDetailCard({ student, maxSessions }: { student: StudentEvaluationRow; maxSessions: number }) {
    const isBehaviorInsufficient = student.assessedBehavior < Math.max(3, student.totalSessions * 0.2);
    const isMemorizationInsufficient = student.assessedMemorization < Math.max(3, student.totalSessions * 0.2);

    return (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-950 border text-right space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4 border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border shadow-sm">
                        <AvatarImage src={student.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} />
                        <AvatarFallback>{student.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h4 className="font-headline font-black text-slate-800 dark:text-white text-md leading-tight">{student.name}</h4>
                        <p className="text-[10px] text-muted-foreground font-bold mt-1">
                            {student.groupName} | تاريخ انضمام الطالب: {student.registrationDate ? format(student.registrationDate, 'd MMMM yyyy', { locale: ar }) : 'غير محدد'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px] font-black py-1 px-3 border-emerald-500/20 bg-emerald-500/5 text-emerald-600">
                        حضور الطالب: {student.totalSessions} حصة (وزن: {student.weightedSessions.toFixed(1)})
                    </Badge>
                    <Badge variant="outline" className="text-[10px] font-black py-1 px-3 border-indigo-500/20 bg-indigo-500/5 text-indigo-600">
                        أقصى حضور بالفوج: {maxSessions} حصة
                    </Badge>
                </div>
            </div>

            {/* Warnings Alert */}
            {(isBehaviorInsufficient || isMemorizationInsufficient) && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 text-amber-700 dark:text-amber-400 text-xs">
                    <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1 font-bold">
                        <p className="font-black text-sm">تنبيه لضمان الدقة والعدالة:</p>
                        {isBehaviorInsufficient && (
                            <p>⚠️ تم تقييم السلوك في ({student.assessedBehavior}) حصة فقط من أصل ({student.totalSessions}) حصة حضور. النسبة المئوية للسلوك ({student.behaviorRate}%) قد لا تكون دليلاً حاسماً على انضباط الطالب الفعلي.</p>
                        )}
                        {isMemorizationInsufficient && (
                            <p>⚠️ تم تقييم الحفظ والتسميع في ({student.assessedMemorization}) حصة فقط من أصل ({student.totalSessions}) حصة حضور. النسبة المئوية للحفظ ({student.memorizationRate}%) قد تكون خادعة إحصائياً.</p>
                        )}
                    </div>
                </div>
            )}

            {/* Metrics Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Attendance */}
                <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 border-b pb-2 border-slate-100 dark:border-slate-800">
                        <UserCheck className="h-5 w-5" />
                        <span className="font-headline font-bold text-sm">تفاصيل الحضور والمواظبة ({student.attendanceRate}%)</span>
                    </div>
                    <div className="space-y-2 text-xs font-bold font-body">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">حاضر (أساسية/إضافية):</span>
                            <span className="text-emerald-600">{student.attendanceCounts['حاضر'] || 0} يوم</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">تعويض (حضر فوج آخر):</span>
                            <span className="text-teal-600">{student.attendanceCounts['تعويض'] || 0} يوم</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">متأخر:</span>
                            <span className="text-amber-500">{student.attendanceCounts['متأخر'] || 0} يوم</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">غائب بعذر / غائب:</span>
                            <span className="text-rose-500">{student.attendanceCounts['غائب'] || 0} يوم</span>
                        </div>
                    </div>
                </div>

                {/* Memorization */}
                <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-amber-500 border-b pb-2 border-slate-100 dark:border-slate-800">
                        <BookOpen className="h-5 w-5" />
                        <span className="font-headline font-bold text-sm">تفاصيل جودة الحفظ ({student.memorizationRate}%)</span>
                    </div>
                    <div className="max-h-[150px] overflow-y-auto custom-scrollbar space-y-2 text-xs font-bold font-body">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">ممتاز:</span>
                            <span className="text-emerald-600">{student.memorizationCounts['ممتاز'] || 0} مرة</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">جيد جداً:</span>
                            <span className="text-teal-600">{student.memorizationCounts['جيد جداً'] || 0} مرة</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">جيد:</span>
                            <span className="text-blue-600">{student.memorizationCounts['جيد'] || 0} مرة</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">حسن / مقبول:</span>
                            <span className="text-amber-500">{(student.memorizationCounts['حسن'] || 0) + (student.memorizationCounts['مقبول'] || 0)} مرة</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">متوسط / ضعيف:</span>
                            <span className="text-orange-500">{(student.memorizationCounts['متوسط'] || 0) + (student.memorizationCounts['ضعيف'] || 0)} مرة</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">لم يحفظ:</span>
                            <span className="text-rose-500">{student.memorizationCounts['لم يحفظ'] || 0} مرة</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-1.5 border-slate-200 dark:border-slate-800">
                            <span className="text-muted-foreground">أوراد مراجعة منتهية:</span>
                            <span className="text-indigo-600">{student.memorizationCounts['أوراد مراجعة'] || 0} ورد</span>
                        </div>
                    </div>
                </div>

                {/* Behavior */}
                <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border shadow-sm space-y-3">
                    <div className="flex items-center gap-2 text-indigo-500 border-b pb-2 border-slate-100 dark:border-slate-800">
                        <Award className="h-5 w-5" />
                        <span className="font-headline font-bold text-sm">تفاصيل السلوك والأخلاق ({student.behaviorRate}%)</span>
                    </div>
                    <div className="space-y-2 text-xs font-bold font-body">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">هادئ ومنضبط:</span>
                            <span className="text-emerald-600">{student.behaviorCounts['هادئ'] || 0} يوم</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">متوسط / مقبول:</span>
                            <span className="text-amber-500">{(student.behaviorCounts['متوسط'] || 0) + (student.behaviorCounts['مقبول'] || 0)} يوم</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">غير منضبط:</span>
                            <span className="text-orange-500">{student.behaviorCounts['غير منضبط'] || 0} يوم</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">مشاغب:</span>
                            <span className="text-rose-500">{student.behaviorCounts['مشاغب'] || 0} يوم</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-1.5 border-slate-200 dark:border-slate-800">
                            <span className="text-muted-foreground">إجمالي التقييمات:</span>
                            <span className="text-primary">{student.assessedBehavior} مرات</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
