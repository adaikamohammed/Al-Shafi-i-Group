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
    
    // Sort State
    const [sortBy, setSortBy] = useState<'comprehensiveScore' | 'academicScore' | 'attendanceRate' | 'memorizationRate' | 'behaviorRate'>('comprehensiveScore');

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

    // Group-based Minimum Sessions Threshold for Leaderboard Entry
    const minSessionsRequired = useMemo(() => {
        switch (periodType) {
            case 'week': return 2;
            case 'season': return 10;
            case 'year': return 35;
            case 'month':
            default:
                return 5;
        }
    }, [periodType]);

    // Main logic for aggregating and calculating fair metrics
    const evaluationData = useMemo(() => {
        if (!students || !dailySessions) return { ranked: [], pending: [] };

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
                totalSessions: 0,
                weightedSessions: 0,
                assessedMemorization: 0,
                assessedBehavior: 0,
                presentCount: 0,
                makeupCount: 0,
                lateCount: 0,
                absentCount: 0,
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
                    const maxPossible = maxAttendanceVal * weight;
                    
                    score.attendanceRate += earned;
                    // Increment raw metrics
                    if (record.attendance === 'حاضر') score.presentCount++;
                    else if (record.attendance === 'غياب' || record.attendance === 'غائب') score.absentCount++;
                    else if (record.attendance === 'متأخر') score.lateCount++;
                    else if (record.attendance === 'تعويض') score.makeupCount++;
                }

                // B. Memorization (Exclude review flags from regular memo evaluation denominator)
                if (!record.review && record.memorization && record.memorization !== 'لا يوجد' && record.memorization !== '') {
                    score.assessedMemorization += weight;
                    score.memorizationRate += getMemoPoints(record.memorization) * weight;
                } else if (record.review && pointsConfig?.review?.completed) {
                    // Count completed review wards under memorization rate
                    score.assessedMemorization += weight;
                    score.memorizationRate += pointsConfig.review.completed * weight;
                }

                // C. Behavior
                if (record.behavior && record.behavior !== '') {
                    score.assessedBehavior += weight;
                    score.behaviorRate += getBehPoints(record.behavior) * weight;
                }
            });
        });

        // 6. Calculate Final Percentage Scores
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

        // 7. Split into Leaderboard (Ranked) and Pending (Insufficient Sessions)
        const ranked: StudentEvaluationRow[] = [];
        const pending: StudentEvaluationRow[] = [];

        results.forEach(r => {
            // Verify if student meets minimum sessions threshold
            if (r.totalSessions >= minSessionsRequired) {
                ranked.push(r);
            } else {
                pending.push(r);
            }
        });

        // Sort both by selected sort criteria
        const sortFn = (a: any, b: any) => {
            if (b[sortBy] !== a[sortBy]) return b[sortBy] - a[sortBy];
            // Tie breaker on sessions, then alphabetical
            if (b.totalSessions !== a.totalSessions) return b.totalSessions - a.totalSessions;
            return a.name.localeCompare(b.name);
        };

        return {
            ranked: ranked.sort(sortFn),
            pending: pending.sort(sortFn)
        };

    }, [students, dailySessions, dateBoundaries, pointsConfig, sortBy, minSessionsRequired, selectedGroup, isManagement, isSuperAdmin, user]);

    // Top three for Podium display
    const podiumStudents = useMemo(() => {
        return evaluationData.ranked.slice(0, 3);
    }, [evaluationData.ranked]);

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

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
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
                                        <p className="text-[10px] text-muted-foreground font-bold">التقييم الشامل</p>
                                        <p className="text-xl font-black text-slate-700">{podiumStudents[1].comprehensiveScore}%</p>
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
                                        <p className="text-[10px] text-amber-800 font-bold">التقييم الشامل</p>
                                        <p className="text-2xl font-black text-amber-700">{podiumStudents[0].comprehensiveScore}%</p>
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
                                        <p className="text-[10px] text-muted-foreground font-bold">التقييم الشامل</p>
                                        <p className="text-xl font-black text-amber-800/80">{podiumStudents[2].comprehensiveScore}%</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 4. Leaderboard Grid */}
                <Card className="rounded-[2.5rem] border shadow-md overflow-hidden">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="text-xl font-headline font-bold text-slate-800">جدول الترتيب العام</CardTitle>
                                <CardDescription className="text-xs font-medium">الترتيب يعتمد بشكل عادل ومباشر على معيار الفرز المختار.</CardDescription>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-black border-primary/20 bg-primary/5 text-primary py-1 px-3">
                                الحد الأدنى للتقييم: {minSessionsRequired} حصص
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
                                        <Tooltip><TooltipTrigger asChild><TableHead className="text-center cursor-pointer font-bold w-[100px]">الحصص (وزن)</TableHead></TooltipTrigger><TooltipContent><p>عدد الحصص المقيمة (ص/م تُحسب كـ 0.5)</p></TooltipContent></Tooltip>
                                        <TableHead className="text-center font-bold">المواظبة %</TableHead>
                                        <TableHead className="text-center font-bold">جودة الحفظ %</TableHead>
                                        <TableHead className="text-center font-bold">السلوك %</TableHead>
                                        <TableHead className="text-center font-bold text-primary bg-primary/5">الأكاديمي %</TableHead>
                                        <TableHead className="text-center font-bold text-indigo-700 bg-indigo-50/50">الشامل %</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {evaluationData.ranked.length > 0 ? (
                                        evaluationData.ranked.map((s, index) => {
                                            const rank = index + 1;
                                            let medal = '';
                                            if (rank === 1) medal = '🥇';
                                            else if (rank === 2) medal = '🥈';
                                            else if (rank === 3) medal = '🥉';

                                            return (
                                                <TableRow key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <TableCell className="text-center font-black text-lg">
                                                        {medal || rank}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar className="h-9 w-9 border shadow-sm">
                                                                <AvatarImage src={s.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${s.name}`} />
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
                                                            <span className="font-bold text-sm">{s.memorizationRate}%</span>
                                                            <Progress value={s.memorizationRate} className="h-1 w-12 bg-slate-100 [&>div]:bg-amber-400" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-bold text-sm">{s.behaviorRate}%</span>
                                                            <Progress value={s.behaviorRate} className="h-1 w-12 bg-slate-100 [&>div]:bg-indigo-400" />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className={cn("text-center font-black text-sm bg-primary/5", sortBy === 'academicScore' && "bg-primary/10 text-primary")}>
                                                        {s.academicScore}%
                                                    </TableCell>
                                                    <TableCell className={cn("text-center font-black text-md bg-indigo-50/30", sortBy === 'comprehensiveScore' && "bg-indigo-100/50 text-indigo-700")}>
                                                        {s.comprehensiveScore}%
                                                    </TableCell>
                                                </TableRow>
                                            );
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
                                    <CardDescription className="text-xs font-medium">الطلاب الذين يقل عدد حصصهم المقيمة عن الحد الأدنى ({minSessionsRequired} حصص). يتم عرض أدائهم هنا دون مقارنتهم بجدول الترتيب لضمان التكافؤ.</CardDescription>
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
                                        {evaluationData.pending.map((s) => (
                                            <TableRow key={s.id} className="opacity-75 hover:opacity-100 transition-opacity">
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={s.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${s.name}`} />
                                                            <AvatarFallback>{s.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <span className="font-bold text-sm text-foreground block leading-tight">{s.name}</span>
                                                            <span className="text-[10px] text-muted-foreground font-bold">{s.groupName}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-xs text-yellow-600">
                                                    {s.totalSessions} / {minSessionsRequired} <span className="text-slate-400 font-normal">({s.weightedSessions.toFixed(1)})</span>
                                                </TableCell>
                                                <TableCell className="text-center font-semibold text-sm">{s.attendanceRate}%</TableCell>
                                                <TableCell className="text-center font-semibold text-sm">{s.memorizationRate}%</TableCell>
                                                <TableCell className="text-center font-semibold text-sm">{s.behaviorRate}%</TableCell>
                                                <TableCell className="text-center font-bold text-sm bg-slate-50/50">{s.academicScore}%</TableCell>
                                                <TableCell className="text-center font-bold text-sm bg-slate-50/50">{s.comprehensiveScore}%</TableCell>
                                            </TableRow>
                                        ))}
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
