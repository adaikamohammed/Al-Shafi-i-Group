"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Swords, User, Calendar, Crown, Check, ChevronsUpDown, Zap, BookOpen, Star, Trophy, Target, Award, Activity, Sparkles } from 'lucide-react';
import { format, setMonth, startOfYear, endOfYear, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Student, PerformanceLevel, BehaviorLevel } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn, arabicCompare, formatGroupName } from '@/lib/utils';
import { calculateStandardPages } from '@/lib/surahs';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';

const calculateAge = (birthDate?: Date) => {
    if (!birthDate) return 'N/A';
    const ageDifMs = Date.now() - new Date(birthDate).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
};

// Colors for the two students
const COLOR_1 = "#3b82f6"; // Blue
const COLOR_2 = "#f97316"; // Orange

const StudentCard = ({ student, onSelectStudent, studentList, disabledStudentId, isRecordHolder, color }: { student: Student | null, onSelectStudent: (id: string | null) => void, studentList: Student[], disabledStudentId?: string | null, isRecordHolder?: boolean, color: string }) => {
    const { allUsers } = useStudentContext();
    const [open, setOpen] = useState(false);

    const gradientClass = color === COLOR_1
        ? "bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/30 dark:to-background border-blue-200 dark:border-blue-900/50"
        : "bg-gradient-to-b from-orange-50 to-white dark:from-orange-950/30 dark:to-background border-orange-200 dark:border-orange-900/50";

    const ringClass = color === COLOR_1 ? "ring-blue-500 shadow-blue-500/30" : "ring-orange-500 shadow-orange-500/30";

    return (
        <Card className={`flex-1 min-w-[300px] border-2 transition-all duration-300 hover:shadow-xl ${gradientClass}`}>
            <CardHeader className="pb-4">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between bg-white/60 dark:bg-black/20 backdrop-blur-sm border-primary/20 hover:bg-white dark:hover:bg-black/40 text-foreground"
                        >
                            {student
                                ? studentList.find((s) => s.id === student.id)?.fullName
                                : "اختر طالبًا..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="ابحث عن اسم الطالب..." />
                            <CommandEmpty>لم يتم العثور على أي طالب.</CommandEmpty>
                            <CommandGroup className="max-h-[300px] overflow-auto">
                                {studentList
                                    .filter((s) => s.id !== disabledStudentId)
                                    .map((s) => (
                                        <CommandItem
                                            key={s.id}
                                            value={s.fullName}
                                            onSelect={() => {
                                                onSelectStudent(s.id);
                                                setOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4 text-primary",
                                                    student?.id === s.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {s.fullName}
                                        </CommandItem>
                                    ))}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center px-6 pb-8 min-h-[260px]">
                {student ? (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-500 w-full">
                        <div className="relative mb-5">
                            <Avatar className={`w-32 h-32 ring-4 ring-offset-4 ring-offset-background ${ringClass} shadow-2xl transition-transform hover:scale-105 duration-300`}>
                                <AvatarImage src={student.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${student.fullName}`} alt={student.fullName} className="object-cover" />
                                <AvatarFallback className="text-3xl bg-primary/10 text-primary">{student.fullName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {isRecordHolder && (
                                <div className="absolute -top-4 -right-4 bg-yellow-500 rounded-full p-2 shadow-lg animate-bounce border-2 border-white dark:border-slate-900">
                                    <Crown className="h-6 w-6 text-white" />
                                </div>
                            )}
                        </div>
                        <h3 className="text-2xl font-bold mb-2 flex items-center justify-center gap-2 text-foreground">
                            {student.fullName}
                        </h3>
                        <div className="flex flex-wrap justify-center gap-2 mb-4">
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">{formatGroupName(student.groupName || '', allUsers) || 'بدون فوج'}</Badge>
                            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">{student.subscriptionTier || 'غير محدد'}</Badge>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 text-sm bg-white/80 dark:bg-black/30 p-3 rounded-xl w-full border border-primary/10 shadow-sm">
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="font-bold text-foreground text-lg">{calculateAge(student.birthDate)}</span>
                                <span className="text-xs text-muted-foreground font-medium">سنة</span>
                            </div>
                            <div className="w-px bg-border"></div>
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="font-bold text-primary flex items-center gap-1 text-lg">
                                    <BookOpen className="w-4 h-4" /> {student.memorizedSurahsCount || 0}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium">سورة</span>
                            </div>
                            <div className="w-px bg-border"></div>
                            <div className="flex flex-col items-center gap-1 flex-1">
                                <span className="font-bold text-foreground text-lg">{format(student.registrationDate, 'MMM yy', { locale: ar })}</span>
                                <span className="text-xs text-muted-foreground font-medium">الانضمام</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <User className="h-20 w-20 mb-4 stroke-1" />
                        <p className="text-lg font-medium">اختر طالبًا للمقارنة</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const ComparisonStat = ({ title, value1, value2, suffix = '', isPercentage = false, higherIsBetter = true, icon: Icon, emphasize = false }: { title: string, value1: number, value2: number, suffix?: string, isPercentage?: boolean, higherIsBetter?: boolean, icon?: React.ElementType, emphasize?: boolean }) => {
    // If it's a percentage, the maximum is 100 for visual bar. Otherwise, relative.
    const maxVal = isPercentage ? 100 : Math.max(value1 + value2, 1);
    
    // Width calculation
    const width1 = isPercentage ? value1 : (value1 / maxVal) * 100;
    const width2 = isPercentage ? value2 : (value2 / maxVal) * 100;

    const isDraw = value1 === value2;
    const isWinner1 = !isDraw && (higherIsBetter ? value1 > value2 : value1 < value2);
    const isWinner2 = !isDraw && (higherIsBetter ? value2 > value1 : value2 < value1);

    const displayV1 = isPercentage ? `${value1.toFixed(1)}%` : `${value1.toLocaleString()} ${suffix}`;
    const displayV2 = isPercentage ? `${value2.toFixed(1)}%` : `${value2.toLocaleString()} ${suffix}`;

    return (
        <div className={`space-y-2 py-1.5 ${emphasize ? 'bg-white dark:bg-black/30 p-4 rounded-xl border border-border shadow-sm' : ''}`}>
            {/* Title on Top for maximum horizontal space */}
            <div className="flex items-center justify-center gap-1.5 text-center mb-1">
                {Icon && <Icon className="w-3.5 h-3.5 text-primary shrink-0 opacity-70" />}
                <span className={cn(
                    "font-bold text-[10px] sm:text-xs text-slate-550 dark:text-slate-400 leading-tight",
                    emphasize && "text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-black"
                )}>
                    {title}
                </span>
            </div>

            {/* Values below title */}
            <div className="flex justify-between items-center px-1">
                <span className={cn(
                    "font-black text-xs sm:text-sm flex items-center gap-1",
                    isWinner1 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'
                )}>
                    {displayV1}
                    {isWinner1 && <Crown className="inline-block h-3.5 w-3.5 text-yellow-500 fill-yellow-550" />}
                </span>
                <span className={cn(
                    "font-black text-xs sm:text-sm flex items-center gap-1",
                    isWinner2 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500 dark:text-slate-400'
                )}>
                    {isWinner2 && <Crown className="inline-block h-3.5 w-3.5 text-yellow-500 fill-yellow-550" />}
                    {displayV2}
                </span>
            </div>
            
            {/* Visual comparison bar */}
            <div className={cn(
                "relative rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800",
                emphasize ? 'h-4 shadow-inner border border-slate-200/50 dark:border-slate-700/50' : 'h-2'
            )}>
                <div 
                    style={{ width: `${width1}%` }} 
                    className="bg-blue-500 h-full transition-all duration-1000 ease-out" 
                />
                <div 
                    style={{ width: `${width2}%` }} 
                    className="bg-orange-500 h-full transition-all duration-1000 ease-out" 
                />
                
                {/* Center marker */}
                <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/80 dark:bg-background/50 -translate-x-1/2 z-10 shadow-sm"></div>
            </div>
        </div>
    );
};

// Points Mappings for Fairness Calculation
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

const BONUS_POINTS: Record<string, number> = {
    'مشاركة مميزة': 1,
    'تفاعل إيجابي': 1.5,
    'انضباط متميز': 2,
    'حفظ زائد': 3,
    'لا يوجد': 0,
    '': 0
};

const NEGATIVE_BONUS_POINTS: Record<string, number> = {
    'لباس غير لائق': -1.5,
    'بدون مصحف': -1,
    'إهمال المراجعة المنزلية': -2,
    'لا يوجد': 0,
    '': 0
};

export default function ComparisonPage() {
    const { students, dailySessions, loading, hallOfFame, settings } = useStudentContext();

    const [periodType, setPeriodType] = useState<'month' | 'season' | 'year'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const [student1Id, setStudent1Id] = useState<string | null>(null);
    const [student2Id, setStudent2Id] = useState<string | null>(null);
    
    const [showWinnerDialog, setShowWinnerDialog] = useState(false);
    const [winnerData, setWinnerData] = useState<{winner: Student | null, reason: string, score1: number, score2: number, type: 'academic' | 'comprehensive'} | null>(null);

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط').sort((a, b) => arabicCompare(a.fullName, b.fullName)), [students]);

    const student1 = useMemo(() => activeStudents.find(s => s.id === student1Id) || null, [activeStudents, student1Id]);
    const student2 = useMemo(() => activeStudents.find(s => s.id === student2Id) || null, [activeStudents, student2Id]);

    const isRecordHolder = (studentId: string | null): boolean => {
        if (!studentId || !hallOfFame) return false;
        return Object.values(hallOfFame).some(record => {
            if (!record || !('id' in record)) return false;
            return (record as any).id === studentId;
        });
    }

    const comparisonData = useMemo(() => {
        if (!student1 || !student2) return null;

        let startDate: Date;
        let endDate: Date;

        switch (periodType) {
            case 'season':
                const seasonStartMonth = (selectedSeason - 1) * 3;
                startDate = startOfMonth(setMonth(new Date(selectedYear, 0), seasonStartMonth));
                endDate = endOfMonth(setMonth(new Date(selectedYear, 0), seasonStartMonth + 2));
                break;
            case 'year':
                startDate = startOfYear(new Date(selectedYear, 0));
                endDate = endOfYear(new Date(selectedYear, 0));
                break;
            case 'month':
            default:
                startDate = startOfMonth(new Date(selectedYear, selectedMonth));
                endDate = endOfMonth(new Date(selectedYear, selectedMonth));
                break;
        }

        const sessionsInRange = Object.values(dailySessions ?? {}).flatMap(day => Object.values(day)).filter(session => {
            if (!session.date) return false;
            const sessionDate = parseISO(session.date);
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        const sessionsByDate: Record<string, any[]> = {};
        sessionsInRange.forEach(session => {
            if (!sessionsByDate[session.date]) {
                sessionsByDate[session.date] = [];
            }
            sessionsByDate[session.date].push(session);
        });

        const getStatsForStudent = (studentId: string, studentObj: any) => {
            const stats = { 
                totalSessions: 0, 
                weightedSessions: 0,
                present: 0, absent: 0, late: 0, makeup: 0,
                attendancePoints: 0,
                
                assessedPerformanceSessions: 0,
                performancePoints: 0,
                maxPerformancePoints: 0,
                excellent: 0, veryGood: 0, good: 0, acceptable: 0, weak: 0,

                assessedBehaviorSessions: 0,
                behaviorPoints: 0,
                calm: 0, averageBehavior: 0, troublemaker: 0,

                bonusPointsSum: 0,
                bonusCounts: {
                    'مشاركة مميزة': 0,
                    'تفاعل إيجابي': 0,
                    'انضباط متميز': 0,
                    'حفظ زائد': 0,
                } as Record<string, number>,
                negativeBonusCounts: {
                    'لباس غير لائق': 0,
                    'بدون مصحف': 0,
                    'إهمال المراجعة المنزلية': 0,
                } as Record<string, number>,
            };

            const pointsConfig = settings?.points;
            const isGroup8User = studentObj && (studentObj.groupName === 'فوج 8' || studentObj.groupName === 'فوج الشيخ عبد الحق نصيرة' || (studentObj.groupName && studentObj.groupName.includes('عبد الحق')));
            const multiplier = isGroup8User ? (studentObj?.memorizationMultiplier ?? 1.0) : 1.0;

            sessionsInRange.forEach(session => {
                if (session.sessionType === 'يوم عطلة' || (session.sessionType === 'غياب الشيخ' && !session.substituteTeacher)) return;

                const record = (session.records ?? []).find(r => r.studentId === studentId);
                if (record) {
                    const dateSessions = sessionsByDate[session.date] || [];
                    const weight = dateSessions.length >= 2 ? 0.5 : 1.0;

                    stats.totalSessions++;
                    stats.weightedSessions += weight;
                    
                    // Attendance
                    const att = record.attendance || '';
                    if (att === 'حاضر') stats.present++;
                    else if (att === 'غائب' || att === 'غياب') stats.absent++;
                    else if (att === 'متأخر') stats.late++;
                    else if (att === 'تعويض') stats.makeup++;
                    
                    stats.attendancePoints += (ATTENDANCE_POINTS[att] ?? 0) * weight;

                    // Performance
                    const perf = record.memorization;
                    let earnedMemoPoints = 0;
                    let hasMemoAssessed = false;
                    const hasNewMemo = perf && perf !== 'لا يوجد' && (perf as string) !== '';
                    const hasReview = record.review && pointsConfig?.review?.completed;

                    if (hasNewMemo) {
                        earnedMemoPoints += PERFORMANCE_POINTS[perf] ?? 0;
                        hasMemoAssessed = true;
                        
                        if (perf === 'ممتاز') stats.excellent++;
                        else if (perf === 'جيد جدا' || perf === 'جيد جداً') stats.veryGood++;
                        else if (perf === 'جيد') stats.good++;
                        else if (perf === 'متوسط' || perf === 'مقبول' || perf === 'حسن') stats.acceptable++;
                        else if (perf === 'ضعيف' || perf === 'لم يحفظ') stats.weak++;
                    }

                    if (hasReview) {
                        earnedMemoPoints += pointsConfig.review.completed;
                        hasMemoAssessed = true;
                    }

                    if (hasMemoAssessed) {
                        stats.assessedPerformanceSessions += weight;
                        
                        const surahId = record.tasmieSurahId || record.surahId || 0;
                        const from = record.tasmieFromVerse || record.fromVerse || 0;
                        const to = record.tasmieToVerse || record.toVerse || 0;
                        const pages = surahId > 0 ? calculateStandardPages(surahId, from, to) : 1.0;

                        let maxMemoSession = 10;
                        if (hasReview) {
                            maxMemoSession += pointsConfig?.review?.completed || 0;
                        }
                        stats.maxPerformancePoints += maxMemoSession * weight * pages;

                        const penalty = (hasNewMemo && record.isDelayed) ? 0.8 : 1.0;
                        stats.performancePoints += earnedMemoPoints * weight * pages * multiplier * penalty;
                    }

                    // Behavior
                    const beh = record.behavior;
                    if (beh && (beh as any) !== '') {
                        stats.assessedBehaviorSessions += weight;
                        stats.behaviorPoints += (BEHAVIOR_POINTS[beh] ?? 0) * weight;

                        if (beh === 'هادئ') stats.calm++;
                        else if ((beh as string) === 'متوسط' || beh === 'مقبول') stats.averageBehavior++;
                        else if (beh === 'مشاغب' || (beh as string) === 'غير منضبط') stats.troublemaker++;
                    }

                    // Bonus
                    if (record.bonus) {
                        stats.bonusPointsSum += (BONUS_POINTS[record.bonus] ?? 0) * weight;
                        if (stats.bonusCounts[record.bonus] !== undefined) {
                            stats.bonusCounts[record.bonus]++;
                        }
                    }

                    // Negative Bonus
                    if (record.negativeBonus) {
                        stats.bonusPointsSum += (NEGATIVE_BONUS_POINTS[record.negativeBonus] ?? 0) * weight;
                        if (stats.negativeBonusCounts[record.negativeBonus] !== undefined) {
                            stats.negativeBonusCounts[record.negativeBonus]++;
                        }
                    }
                }
            });
            return stats;
        }

        const s1Stats = getStatsForStudent(student1.id, student1);
        const s2Stats = getStatsForStudent(student2.id, student2);
        
        // Calculate fair percentage scores (0 to 100)
        const calcRatio = (points: number, maxPoints: number) => maxPoints > 0 ? (points / maxPoints) * 100 : 0;

        const s1AttPct = calcRatio(s1Stats.attendancePoints, s1Stats.weightedSessions * 10);
        const s2AttPct = calcRatio(s2Stats.attendancePoints, s2Stats.weightedSessions * 10);

        const s1PerfPct = calcRatio(s1Stats.performancePoints, s1Stats.maxPerformancePoints);
        const s2PerfPct = calcRatio(s2Stats.performancePoints, s2Stats.maxPerformancePoints);

        const s1BehPct = calcRatio(s1Stats.behaviorPoints, s1Stats.assessedBehaviorSessions * 10);
        const s2BehPct = calcRatio(s2Stats.behaviorPoints, s2Stats.assessedBehaviorSessions * 10);

        // Academic Score (Without Behavior)
        const score1Academic = Math.min(100, ((s1AttPct + s1PerfPct) / 2) + s1Stats.bonusPointsSum);
        const score2Academic = Math.min(100, ((s2AttPct + s2PerfPct) / 2) + s2Stats.bonusPointsSum);

        // Comprehensive Score (With Behavior)
        const score1Comprehensive = Math.min(100, (s1Stats.assessedBehaviorSessions > 0 ? (s1AttPct + s1PerfPct + s1BehPct) / 3 : ((s1AttPct + s1PerfPct) / 2)) + s1Stats.bonusPointsSum);
        const score2Comprehensive = Math.min(100, (s2Stats.assessedBehaviorSessions > 0 ? (s2AttPct + s2PerfPct + s2BehPct) / 3 : ((s2AttPct + s2PerfPct) / 2)) + s2Stats.bonusPointsSum);

        return {
            student1: s1Stats,
            student2: s2Stats,
            pct1: { att: s1AttPct, perf: s1PerfPct, beh: s1BehPct },
            pct2: { att: s2AttPct, perf: s2PerfPct, beh: s2BehPct },
            score1Academic: Math.max(0, Math.round(score1Academic * 10) / 10) || 0,
            score2Academic: Math.max(0, Math.round(score2Academic * 10) / 10) || 0,
            score1Comprehensive: Math.max(0, Math.round(score1Comprehensive * 10) / 10) || 0,
            score2Comprehensive: Math.max(0, Math.round(score2Comprehensive * 10) / 10) || 0,
        };

    }, [student1, student2, periodType, selectedMonth, selectedSeason, selectedYear, dailySessions, settings]);

    // Prepare data for Radar Chart
    const radarData = useMemo(() => {
        if (!comparisonData || !student1 || !student2) return [];
        
        const { pct1, pct2 } = comparisonData;
        const maxSurahs = Math.max(student1.memorizedSurahsCount || 0, student2.memorizedSurahsCount || 0, 10);
        
        return [
            {
                subject: 'جودة الحضور',
                A: Math.round(pct1.att),
                B: Math.round(pct2.att),
                fullMark: 100,
            },
            {
                subject: 'التميز الأكاديمي',
                A: Math.round(pct1.perf),
                B: Math.round(pct2.perf),
                fullMark: 100,
            },
            {
                subject: 'الانضباط',
                A: Math.round(pct1.beh),
                B: Math.round(pct2.beh),
                fullMark: 100,
            },
            {
                subject: 'حفظ السور',
                A: Math.round(((student1.memorizedSurahsCount || 0) / maxSurahs) * 100) || 0,
                B: Math.round(((student2.memorizedSurahsCount || 0) / maxSurahs) * 100) || 0,
                fullMark: 100,
            }
        ];
    }, [comparisonData, student1, student2]);

    const handleCrownWinner = (type: 'academic' | 'comprehensive') => {
        if (!comparisonData || !student1 || !student2) return;

        const score1 = type === 'academic' ? comparisonData.score1Academic : comparisonData.score1Comprehensive;
        const score2 = type === 'academic' ? comparisonData.score2Academic : comparisonData.score2Comprehensive;
        const { pct1, pct2 } = comparisonData;

        let winner: Student | null = null;
        let reason = '';

        if (score1 > score2) {
            winner = student1;
            if (pct1.perf > pct2.perf) reason = "لتفوقه الدراسي الواضح وحصوله على تقييمات أعلى في الحفظ مقارنة بعدد الحصص.";
            else if (type === 'comprehensive' && pct1.beh > pct2.beh) reason = "لانضباطه المتميز وسلوكه الهادئ وثباته في الحلقة.";
            else reason = "لالتزامه الملحوظ بالحضور وتفوقه العام في الأداء.";
        } else if (score2 > score1) {
            winner = student2;
            if (pct2.perf > pct1.perf) reason = "لتفوقه الدراسي الواضح وحصوله على تقييمات أعلى في الحفظ مقارنة بعدد الحصص.";
            else if (type === 'comprehensive' && pct2.beh > pct1.beh) reason = "لانضباطه المتميز وسلوكه الهادئ وثباته في الحلقة.";
            else reason = "لالتزامه الملحوظ بالحضور وتفوقه العام في الأداء.";
        } else {
            reason = "أداء الطالبين متطابق تماماً في النسب! الاثنان أبديا مستوى متألقاً وعادلاً.";
        }

        setWinnerData({ winner, reason, score1, score2, type });
        setShowWinnerDialog(true);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (activeStudents.length < 2) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-500" />
                <h1 className="text-3xl font-headline font-bold text-center text-foreground">لا يوجد عدد كافٍ من الطلبة للمقارنة</h1>
                <p className="text-muted-foreground text-center text-lg">
                    يجب أن يكون لديك طالبان نشطان على الأقل لاستخدام هذه الميزة.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12">
            <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white">
                <CardHeader className="text-center md:text-right pb-4">
                    <CardTitle className="text-3xl font-headline font-bold flex items-center justify-center md:justify-start gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Swords className="text-white h-8 w-8" />
                        </div>
                        ساحة المقارنة بالعدل المطلق
                    </CardTitle>
                    <CardDescription className="text-blue-100 text-lg font-medium">
                        مقارنة دقيقة تعتمد على النسب المئوية لجودة الأداء، لضمان العدل حتى وإن اختلف عدد الحصص المقيّمة.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3 bg-black/20 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                        <Select dir="rtl" value={periodType} onValueChange={(value: 'month' | 'season' | 'year') => setPeriodType(value)}>
                            <SelectTrigger className="w-full md:w-[150px] bg-white/10 hover:bg-white/20 border-0 text-white font-bold"><SelectValue placeholder="نوع التقرير" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">مقارنة شهرية</SelectItem>
                                <SelectItem value="season">مقارنة موسمية</SelectItem>
                                <SelectItem value="year">مقارنة سنوية</SelectItem>
                            </SelectContent>
                        </Select>

                        {periodType === 'month' && (
                            <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[150px] bg-white/10 hover:bg-white/20 border-0 text-white font-bold"><SelectValue placeholder="الشهر" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', { locale: ar })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {periodType === 'season' && (
                            <Select dir="rtl" value={selectedSeason.toString()} onValueChange={(val) => setSelectedSeason(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[220px] bg-white/10 hover:bg-white/20 border-0 text-white font-bold"><SelectValue placeholder="الموسم" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">الموسم 1 (جانفي - مارس)</SelectItem>
                                    <SelectItem value="2">الموسم 2 (أفريل - جوان)</SelectItem>
                                    <SelectItem value="3">الموسم 3 (جويلية - سبتمبر)</SelectItem>
                                    <SelectItem value="4">الموسم 4 (أكتوبر - ديسمبر)</SelectItem>
                                </SelectContent>
                            </Select>
                        )}

                        <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                            <SelectTrigger className="w-full md:w-[120px] bg-white/10 hover:bg-white/20 border-0 text-white font-bold"><SelectValue placeholder="السنة" /></SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                <StudentCard
                    student={student1}
                    onSelectStudent={setStudent1Id}
                    studentList={activeStudents}
                    disabledStudentId={student2Id}
                    isRecordHolder={isRecordHolder(student1Id)}
                    color={COLOR_1}
                />

                <div className="flex flex-col items-center justify-center h-full py-8 lg:py-0 w-full lg:w-[300px]">
                    <div className="relative flex items-center justify-center w-24 h-24 bg-white dark:bg-slate-900 rounded-full border-8 border-slate-100 dark:border-slate-800 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] z-10 animate-pulse mb-6">
                        <span className="text-4xl font-black italic bg-gradient-to-br from-blue-600 to-orange-500 bg-clip-text text-transparent drop-shadow-sm">VS</span>
                    </div>
                    {comparisonData && (
                        <div className="flex flex-col gap-4 w-full px-2">
                            {/* Academic Score (Without Behavior) */}
                            <div className="relative p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg text-center overflow-hidden transition-transform hover:scale-105 group cursor-default">
                                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-100 dark:to-slate-800/50 opacity-50"></div>
                                <span className="text-sm text-slate-500 dark:text-slate-400 font-bold mb-3 block relative z-10 flex justify-center items-center gap-1">
                                    <BookOpen className="w-4 h-4" /> التقييم الأكاديمي (بدون سلوك)
                                </span>
                                <div className="flex justify-between items-center relative z-10">
                                    <span className={`text-3xl font-black transition-colors ${comparisonData.score1Academic > comparisonData.score2Academic ? 'text-blue-600 dark:text-blue-500' : 'text-blue-400/60 dark:text-blue-500/50'}`}>
                                        {comparisonData.score1Academic}%
                                    </span>
                                    <span className="text-slate-300 dark:text-slate-700 font-black text-xl">-</span>
                                    <span className={`text-3xl font-black transition-colors ${comparisonData.score2Academic > comparisonData.score1Academic ? 'text-orange-600 dark:text-orange-500' : 'text-orange-400/60 dark:text-orange-500/50'}`}>
                                        {comparisonData.score2Academic}%
                                    </span>
                                </div>
                            </div>
                            
                            {/* Comprehensive Score (With Behavior) */}
                            <div className="relative p-6 bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 rounded-2xl border-2 border-yellow-400/50 dark:border-yellow-600/50 shadow-[0_10px_30px_-10px_rgba(234,179,8,0.3)] text-center overflow-hidden transition-transform hover:scale-105 group cursor-default">
                                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
                                <span className="text-base text-yellow-700 dark:text-yellow-500 font-black mb-4 block relative z-10 flex items-center justify-center gap-1">
                                    <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" /> التقييم الشامل (مع السلوك) <Star className="w-5 h-5 fill-yellow-500 text-yellow-500" />
                                </span>
                                <div className="flex justify-between items-center relative z-10">
                                    <span className={`text-4xl font-black transition-colors ${comparisonData.score1Comprehensive > comparisonData.score2Comprehensive ? 'text-blue-600 dark:text-blue-400 drop-shadow-md' : 'text-blue-400/70 dark:text-blue-500/70'}`}>
                                        {comparisonData.score1Comprehensive}%
                                    </span>
                                    <span className="text-yellow-600 dark:text-yellow-500 text-sm font-black mx-2 bg-yellow-200/50 dark:bg-yellow-900/50 px-2 py-1 rounded-md">VS</span>
                                    <span className={`text-4xl font-black transition-colors ${comparisonData.score2Comprehensive > comparisonData.score1Comprehensive ? 'text-orange-600 dark:text-orange-400 drop-shadow-md' : 'text-orange-400/70 dark:text-orange-500/70'}`}>
                                        {comparisonData.score2Comprehensive}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <StudentCard
                    student={student2}
                    onSelectStudent={setStudent2Id}
                    studentList={activeStudents}
                    disabledStudentId={student1Id}
                    isRecordHolder={isRecordHolder(student2Id)}
                    color={COLOR_2}
                />
            </div>

            {student1 && student2 && comparisonData && (
                <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-12 mt-12">
                    
                    <div className="text-center space-y-2 bg-white dark:bg-slate-900 py-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                        <h2 className="text-3xl font-bold font-headline flex items-center justify-center gap-3 text-primary">
                            <BookOpen className="h-8 w-8" /> تفاصيل المقارنة المئوية والأرقام الخام
                        </h2>
                        <p className="text-muted-foreground text-lg font-medium">النسبة المئوية العادلة جنبًا إلى جنب مع التفاصيل والأرقام التي بُنيت عليها.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Attendance Details Card */}
                        <Card className="border-0 shadow-xl overflow-hidden bg-white dark:bg-slate-900 border-t-4 border-t-blue-500 hover:shadow-[0_15px_40px_-10px_rgba(59,130,246,0.15)] transition-all duration-300 transform hover:-translate-y-1">
                            <CardHeader className="bg-blue-50 dark:bg-blue-950/50 border-b border-blue-100 dark:border-blue-900/50 pb-5">
                                <CardTitle className="flex items-center gap-2 text-2xl text-blue-700 dark:text-blue-400 font-black">
                                    <Calendar className="h-6 w-6" /> جودة الحضور
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="p-6 border-b border-border bg-slate-50 dark:bg-slate-900/50">
                                    <ComparisonStat title="النسبة المئوية (العدل المطلق)" value1={comparisonData.pct1.att} value2={comparisonData.pct2.att} isPercentage icon={Target} emphasize />
                                </div>
                                <div className="p-6 space-y-4">
                                    <ComparisonStat title="إجمالي الحصص (المقام)" value1={comparisonData.student1.totalSessions} value2={comparisonData.student2.totalSessions} suffix="حصة" higherIsBetter={false} icon={Activity} />
                                    <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-4"></div>
                                    <ComparisonStat title="حاضر (10 نقاط)" value1={comparisonData.student1.present} value2={comparisonData.student2.present} suffix="مرة" />
                                    <ComparisonStat title="تعويض (8 نقاط)" value1={comparisonData.student1.makeup} value2={comparisonData.student2.makeup} suffix="مرة" />
                                    <ComparisonStat title="متأخر (5 نقاط)" value1={comparisonData.student1.late} value2={comparisonData.student2.late} suffix="مرة" higherIsBetter={false} />
                                    <ComparisonStat title="غائب (0 نقطة)" value1={comparisonData.student1.absent} value2={comparisonData.student2.absent} suffix="مرة" higherIsBetter={false} />
                                    
                                    <div className="mt-6 pt-5 border-t border-dashed border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-4 text-sm font-mono text-center shadow-inner">
                                        <p className="text-blue-800 dark:text-blue-300/70 mb-2 font-bold">المعادلة المستخدمة:</p>
                                        <p className="mb-4 bg-white dark:bg-black/40 py-2 px-3 rounded-lg border border-blue-100 dark:border-blue-900 shadow-sm text-slate-700 dark:text-slate-300 text-xs">النقاط المكتسبة (مع وزن) ÷ (الحصص الموزونة × 10)</p>
                                        <div className="flex justify-between items-center text-sm font-bold">
                                            <span className="text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-3 py-1.5 rounded-full text-xs">{comparisonData.student1.attendancePoints.toFixed(1)} / {(comparisonData.student1.weightedSessions * 10).toFixed(1)}</span>
                                            <span className="text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-3 py-1.5 rounded-full text-xs">{comparisonData.student2.attendancePoints.toFixed(1)} / {(comparisonData.student2.weightedSessions * 10).toFixed(1)}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {/* Performance Details Card */}
                        <Card className="border-0 shadow-xl overflow-hidden bg-white dark:bg-slate-900 border-t-4 border-t-amber-500 hover:shadow-[0_15px_40px_-10px_rgba(245,158,11,0.15)] transition-all duration-300 transform hover:-translate-y-1">
                            <CardHeader className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-100 dark:border-amber-900/50 pb-5">
                                <CardTitle className="flex items-center gap-2 text-2xl text-amber-700 dark:text-amber-400 font-black">
                                    <Star className="h-6 w-6" /> التميز الأكاديمي
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="p-6 border-b border-border bg-slate-50 dark:bg-slate-900/50">
                                    <ComparisonStat title="النسبة المئوية (العدل المطلق)" value1={comparisonData.pct1.perf} value2={comparisonData.pct2.perf} isPercentage icon={Target} emphasize />
                                </div>
                                <div className="p-6 space-y-4">
                                    <ComparisonStat title="حصص مُقيّمة (المقام)" value1={comparisonData.student1.assessedPerformanceSessions} value2={comparisonData.student2.assessedPerformanceSessions} suffix="حصة" higherIsBetter={false} icon={Activity} />
                                    <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-4"></div>
                                    <ComparisonStat title="ممتاز (10 نقاط)" value1={comparisonData.student1.excellent} value2={comparisonData.student2.excellent} suffix="مرة" />
                                    <ComparisonStat title="جيد جداً (8 نقاط)" value1={comparisonData.student1.veryGood} value2={comparisonData.student2.veryGood} suffix="مرة" />
                                    <ComparisonStat title="جيد / حسن (6/5 نق)" value1={comparisonData.student1.good} value2={comparisonData.student2.good} suffix="مرة" />
                                    <ComparisonStat title="متوسط / مقبول (4/3 نق)" value1={comparisonData.student1.acceptable} value2={comparisonData.student2.acceptable} suffix="مرة" higherIsBetter={false} />
                                    <ComparisonStat title="ضعيف / لم يحفظ (1/0 نق)" value1={comparisonData.student1.weak} value2={comparisonData.student2.weak} suffix="مرة" higherIsBetter={false} />
                                    
                                    <div className="mt-6 pt-5 border-t border-dashed border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl p-4 text-sm font-mono text-center shadow-inner">
                                        <p className="text-amber-800 dark:text-amber-300/70 mb-2 font-bold">المعادلة المستخدمة:</p>
                                        <p className="mb-4 bg-white dark:bg-black/40 py-2 px-3 rounded-lg border border-amber-100 dark:border-amber-900 shadow-sm text-slate-700 dark:text-slate-300 text-xs">النقاط المكتسبة (مع المعاملات) ÷ مجموع النقاط الأقصى للآيات المقروءة</p>
                                        <div className="flex justify-between items-center text-sm font-bold">
                                            <span className="text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-3 py-1.5 rounded-full text-xs">{comparisonData.student1.performancePoints.toFixed(1)} / {comparisonData.student1.maxPerformancePoints.toFixed(1)}</span>
                                            <span className="text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-3 py-1.5 rounded-full text-xs">{comparisonData.student2.performancePoints.toFixed(1)} / {comparisonData.student2.maxPerformancePoints.toFixed(1)}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        
                        {/* Behavior Details Card */}
                        <Card className="border-0 shadow-xl overflow-hidden bg-white dark:bg-slate-900 border-t-4 border-t-emerald-500 hover:shadow-[0_15px_40px_-10px_rgba(16,185,129,0.15)] transition-all duration-300 transform hover:-translate-y-1">
                            <CardHeader className="bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-100 dark:border-emerald-900/50 pb-5">
                                <CardTitle className="flex items-center gap-2 text-2xl text-emerald-700 dark:text-emerald-400 font-black">
                                    <User className="h-6 w-6" /> الانضباط والسلوك
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="p-6 border-b border-border bg-slate-50 dark:bg-slate-900/50">
                                    <ComparisonStat title="النسبة المئوية (العدل المطلق)" value1={comparisonData.pct1.beh} value2={comparisonData.pct2.beh} isPercentage icon={Target} emphasize />
                                </div>
                                <div className="p-6 space-y-4">
                                    <ComparisonStat title="حصص مُقيّمة (المقام)" value1={comparisonData.student1.assessedBehaviorSessions} value2={comparisonData.student2.assessedBehaviorSessions} suffix="حصة" higherIsBetter={false} icon={Activity} />
                                    <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-4"></div>
                                    <ComparisonStat title="هادئ (10 نقاط)" value1={comparisonData.student1.calm} value2={comparisonData.student2.calm} suffix="مرة" />
                                    <ComparisonStat title="متوسط / مقبول (7/5 نق)" value1={comparisonData.student1.averageBehavior} value2={comparisonData.student2.averageBehavior} suffix="مرة" />
                                    <ComparisonStat title="مشاغب (0 نقطة)" value1={comparisonData.student1.troublemaker} value2={comparisonData.student2.troublemaker} suffix="مرة" higherIsBetter={false} />
                                    
                                    <div className="mt-6 pt-5 border-t border-dashed border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl p-4 text-sm font-mono text-center shadow-inner">
                                        <p className="text-emerald-800 dark:text-emerald-300/70 mb-2 font-bold">المعادلة المستخدمة:</p>
                                        <p className="mb-4 bg-white dark:bg-black/40 py-2 px-3 rounded-lg border border-emerald-100 dark:border-emerald-900 shadow-sm text-slate-700 dark:text-slate-300">النقاط المكتسبة ÷ (الحصص المقيّمة × 10)</p>
                                        <div className="flex justify-between items-center text-sm font-bold">
                                            <span className="text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-4 py-1.5 rounded-full">{comparisonData.student1.behaviorPoints} / {comparisonData.student1.assessedBehaviorSessions * 10}</span>
                                            <span className="text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-4 py-1.5 rounded-full">{comparisonData.student2.behaviorPoints} / {comparisonData.student2.assessedBehaviorSessions * 10}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Bonus & Deductions Details Card */}
                        <Card className="border-0 shadow-xl overflow-hidden bg-white dark:bg-slate-900 border-t-4 border-t-purple-500 hover:shadow-[0_15px_40px_-10px_rgba(168,85,247,0.15)] transition-all duration-300 transform hover:-translate-y-1">
                            <CardHeader className="bg-purple-50 dark:bg-purple-950/50 border-b border-purple-100 dark:border-purple-900/50 pb-5">
                                <CardTitle className="flex items-center gap-2 text-2xl text-purple-700 dark:text-purple-400 font-black">
                                    <Sparkles className="h-6 w-6" /> البونص والخصومات
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="p-6 border-b border-border bg-slate-50 dark:bg-slate-900/50">
                                    <ComparisonStat title="المحصلة الصافية (بونص - خصم)" value1={comparisonData.student1.bonusPointsSum} value2={comparisonData.student2.bonusPointsSum} suffix="ن" icon={Target} emphasize />
                                </div>
                                <div className="p-6 space-y-4">
                                    <p className="text-xs font-bold text-slate-500 border-b pb-2">🎁 تفاصيل البونص الإيجابي الممنوح:</p>
                                    <ComparisonStat title="مشاركة مميزة (+1)" value1={comparisonData.student1.bonusCounts['مشاركة مميزة'] || 0} value2={comparisonData.student2.bonusCounts['مشاركة مميزة'] || 0} suffix="مرة" />
                                    <ComparisonStat title="تفاعل إيجابي (+1.5)" value1={comparisonData.student1.bonusCounts['تفاعل إيجابي'] || 0} value2={comparisonData.student2.bonusCounts['تفاعل إيجابي'] || 0} suffix="مرة" />
                                    <ComparisonStat title="انضباط متميز (+2)" value1={comparisonData.student1.bonusCounts['انضباط متميز'] || 0} value2={comparisonData.student2.bonusCounts['انضباط متميز'] || 0} suffix="مرة" />
                                    <ComparisonStat title="حفظ زائد (+3)" value1={comparisonData.student1.bonusCounts['حفظ زائد'] || 0} value2={comparisonData.student2.bonusCounts['حفظ زائد'] || 0} suffix="مرة" />
                                    
                                    <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-4"></div>
                                    
                                    <p className="text-xs font-bold text-rose-500 border-b pb-2">⚠️ تفاصيل الخصومات السلوكية:</p>
                                    <ComparisonStat title="لباس غير لائق (-1.5)" value1={comparisonData.student1.negativeBonusCounts['لباس غير لائق'] || 0} value2={comparisonData.student2.negativeBonusCounts['لباس غير لائق'] || 0} suffix="مرة" higherIsBetter={false} />
                                    <ComparisonStat title="بدون مصحف (-1)" value1={comparisonData.student1.negativeBonusCounts['بدون مصحف'] || 0} value2={comparisonData.student2.negativeBonusCounts['بدون مصحف'] || 0} suffix="مرة" higherIsBetter={false} />
                                    <ComparisonStat title="إهمال المراجعة المنزلية (-2)" value1={comparisonData.student1.negativeBonusCounts['إهمال المراجعة المنزلية'] || 0} value2={comparisonData.student2.negativeBonusCounts['إهمال المراجعة المنزلية'] || 0} suffix="مرة" higherIsBetter={false} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Radar Chart Section */}
                    <Card className="border-0 shadow-xl overflow-hidden flex flex-col max-w-4xl mx-auto mt-12 bg-white dark:bg-slate-900">
                        <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 text-center pb-6">
                            <CardTitle className="flex justify-center items-center gap-2 text-3xl font-black text-slate-800 dark:text-slate-200">
                                <Zap className="h-7 w-7 text-primary" />
                                المخطط الراداري
                            </CardTitle>
                            <CardDescription className="text-lg font-medium">
                                تمثيل بصري لتوازن الطالبين بناءً على النسب المئوية العادلة.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 h-[500px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                                    <PolarGrid stroke="#e2e8f0" className="dark:stroke-slate-700" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 16, fontWeight: '900' }} className="dark:fill-slate-300" />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <RechartsTooltip 
                                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderColor: '#cbd5e1', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', color: '#0f172a', fontWeight: 'bold' }}
                                        itemStyle={{ fontWeight: 'bold' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '18px', fontWeight: 'bold' }} />
                                    <Radar name={student1.fullName} dataKey="A" stroke={COLOR_1} fill={COLOR_1} fillOpacity={0.5} strokeWidth={3} />
                                    <Radar name={student2.fullName} dataKey="B" stroke={COLOR_2} fill={COLOR_2} fillOpacity={0.5} strokeWidth={3} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col sm:flex-row justify-center items-center gap-6 pt-10 pb-6">
                        <Button 
                            onClick={() => handleCrownWinner('academic')} 
                            size="lg" 
                            variant="outline"
                            className="h-16 px-10 text-xl font-bold border-2 border-blue-500/50 bg-white hover:bg-blue-50 dark:bg-slate-900 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full transition-all duration-300 shadow-md hover:shadow-lg"
                        >
                            تتويج بناءً على الأكاديمي فقط
                        </Button>
                        <Button 
                            onClick={() => handleCrownWinner('comprehensive')} 
                            size="lg" 
                            className="h-20 px-14 text-2xl font-black bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 hover:from-yellow-300 hover:via-amber-400 hover:to-yellow-500 text-slate-900 shadow-[0_15px_40px_-10px_rgba(245,158,11,0.6)] hover:shadow-[0_20px_50px_-10px_rgba(245,158,11,0.8)] transition-all duration-300 transform hover:-translate-y-2 rounded-full border-4 border-yellow-200 dark:border-yellow-700"
                        >
                            <Trophy className="ml-4 h-10 w-10 text-slate-900 fill-current" />
                            التتويج الشامل (مع السلوك)
                        </Button>
                    </div>
                </div>
            )}

            <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
                <DialogContent className="sm:max-w-xl text-center border-0 shadow-[0_0_100px_rgba(245,158,11,0.3)] bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 overflow-hidden rounded-3xl p-0">
                    <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400"></div>
                    <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-yellow-300/40 via-transparent to-transparent"></div>
                    
                    <div className="p-10 pt-14">
                        <DialogHeader>
                            <div className="flex justify-center mb-8 relative">
                                <div className="absolute inset-0 bg-yellow-400/30 blur-3xl rounded-full animate-pulse"></div>
                                {winnerData?.winner ? (
                                    <Avatar className="w-40 h-40 ring-8 ring-yellow-400 dark:ring-yellow-500 shadow-[0_20px_50px_rgba(245,158,11,0.5)] relative z-10 bg-white">
                                        <AvatarImage src={winnerData.winner.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${winnerData.winner.fullName}`} className="object-cover" />
                                        <AvatarFallback className="text-6xl text-yellow-600 bg-yellow-100 font-bold">{winnerData.winner.fullName.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                ) : (
                                    <div className="w-40 h-40 rounded-full bg-slate-100 dark:bg-slate-800 border-8 border-slate-300 dark:border-slate-600 flex items-center justify-center relative z-10 shadow-xl">
                                        <Award className="w-20 h-20 text-slate-400" />
                                    </div>
                                )}
                                
                                {winnerData?.winner && (
                                    <Crown className="absolute -top-10 h-20 w-20 text-yellow-500 drop-shadow-[0_10px_10px_rgba(245,158,11,0.5)] z-20 animate-bounce" />
                                )}
                            </div>
                            <DialogTitle className="text-4xl font-black font-headline text-center mb-4">
                                {winnerData?.winner ? (
                                    <span className="bg-gradient-to-r from-yellow-600 to-amber-600 dark:from-yellow-400 dark:to-amber-500 bg-clip-text text-transparent drop-shadow-sm leading-tight">
                                        {winnerData.type === 'academic' ? 'بطل التفوق الأكاديمي:' : 'الفائز بالتتويج الشامل:'} <br/> {winnerData.winner.fullName}
                                    </span>
                                ) : (
                                    <span className="text-slate-700 dark:text-slate-300">نتيجة تعادل مطلقة!</span>
                                )}
                            </DialogTitle>
                            <DialogDescription className="text-xl text-slate-700 dark:text-slate-300 mt-6 leading-relaxed font-medium bg-white/60 dark:bg-black/20 p-4 rounded-xl border border-yellow-200 dark:border-yellow-900/50">
                                {winnerData?.reason}
                            </DialogDescription>
                        </DialogHeader>
                        
                        {winnerData && (
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mt-8 flex justify-between items-center relative z-10 shadow-inner border border-slate-200 dark:border-slate-700">
                                <div className={`text-center flex-1 transition-all ${winnerData.winner?.id === student1?.id ? 'text-yellow-600 dark:text-yellow-400 scale-110 font-black' : 'text-slate-500 dark:text-slate-400 font-bold'}`}>
                                    <p className="text-sm mb-2 truncate px-2">{student1?.fullName}</p>
                                    <p className="text-4xl">{winnerData.score1}%</p>
                                </div>
                                <div className="w-px h-16 bg-slate-300 dark:bg-slate-600 mx-4"></div>
                                <div className={`text-center flex-1 transition-all ${winnerData.winner?.id === student2?.id ? 'text-yellow-600 dark:text-yellow-400 scale-110 font-black' : 'text-slate-500 dark:text-slate-400 font-bold'}`}>
                                    <p className="text-sm mb-2 truncate px-2">{student2?.fullName}</p>
                                    <p className="text-4xl">{winnerData.score2}%</p>
                                </div>
                            </div>
                        )}
                        
                        <DialogFooter className="mt-10 flex justify-center sm:justify-center w-full">
                            <Button onClick={() => setShowWinnerDialog(false)} variant="outline" className="px-12 py-6 text-xl font-bold z-10 relative rounded-full border-2 hover:bg-slate-100 dark:hover:bg-slate-800 w-full sm:w-auto">
                                رائع، إغلاق!
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
