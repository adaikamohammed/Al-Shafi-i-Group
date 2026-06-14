
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Shield, CheckCircle, XCircle, MinusCircle, Flame, Star, Info, BookOpenCheck, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, DailySession, AttendanceStatus, PerformanceLevel, LeagueStat } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { MatchOfTheWeek } from '@/components/ui/MatchOfTheWeek';
import { ManagementLeagueView } from '@/components/management/ManagementLeagueView';
import { useAuth } from '@/context/AuthContext';


const FormIcon = ({ status }: { status: AttendanceStatus }) => {
    switch (status) {
        case 'حاضر':
            return <CheckCircle className="h-5 w-5 text-green-500" />;
        case 'متأخر':
            return <MinusCircle className="h-5 w-5 text-gray-500" />;
        case 'غائب':
            return <XCircle className="h-5 w-5 text-red-500" />;
        default:
            return null;
    }
};

export default function LeaguePage() {
    const { students, dailySessions, loading } = useStudentContext();
    const { isManagement, isSuperAdmin } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isFlipped, setIsFlipped] = useState(false);
    const previousRankingRef = useRef<Map<string, number>>(new Map());


    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);

    const leagueTable = useMemo(() => {
        const monthStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEndDate = endOfMonth(new Date(selectedYear, selectedMonth));

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(daySessions =>
            Object.values(daySessions).filter(session => {
                if (!session?.date || session.sessionType === 'يوم عطلة' || session.sessionType === 'حصة أنشطة') return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                } catch (e) {
                    return false;
                }
            })
        ).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

        const stats: Omit<LeagueStat, 'rank' | 'previousRank' | 'movement'>[] = activeStudents.map(student => {
            let wins = 0, draws = 0, losses = 0;
            const form: AttendanceStatus[] = [];
            let goalsFor = 0;
            let goalsAgainst = 0;
            let assists = 0;

            sessionsInMonth.forEach(session => {
                const record = (session.records ?? []).find(r => r.studentId === student.id);
                if (record) {
                    form.push(record.attendance);
                    switch (record.attendance) {
                        case 'حاضر':
                            wins++;
                            break;
                        case 'متأخر':
                            draws++;
                            break;
                        case 'غائب':
                            losses++;
                            break;
                    }

                    if (record.memorization) {
                        if (record.memorization === 'ممتاز') {
                            goalsFor += 2;
                        } else if (record.memorization === 'جيد جداً' || record.memorization === 'جيد جدا') {
                            goalsFor += 1;
                        } else if (record.memorization === 'متوسط' || record.memorization === 'مقبول' || record.memorization === 'حسن') {
                            goalsAgainst += 1;
                        } else if (record.memorization === 'ضعيف' || record.memorization === 'لم يحفظ') {
                            goalsAgainst += 2;
                        }
                    }

                    if (record.behavior === 'هادئ') {
                        assists += 2;
                    } else if ((record.behavior as string) === 'متوسط' || record.behavior === 'مقبول') {
                        assists += 1;
                    }
                }
            });

            return {
                studentId: student.id,
                studentName: student.fullName,
                photoURL: student.photoURL,
                played: wins + draws + losses,
                wins,
                draws,
                losses,
                goalsFor,
                goalsAgainst,
                goalDifference: goalsFor - goalsAgainst,
                points: (wins * 3) + (draws * 1),
                form: form.slice(-5),
                assists,
            };
        });

        const sortedStats = stats.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            if (a.losses !== b.losses) return a.losses - b.losses;
            return a.studentName.localeCompare(b.studentName);
        });

        const newRankingWithMovement = sortedStats.map((stat, index) => {
            const currentRank = index + 1;
            const previousRank = previousRankingRef.current.get(stat.studentId);
            const movement = previousRank ? previousRank - currentRank : 0;
            return {
                ...stat,
                rank: currentRank,
                previousRank: previousRank || null,
                movement,
            };
        });

        return newRankingWithMovement;

    }, [activeStudents, dailySessions, selectedMonth, selectedYear]);

    // Group statistics for management view
    const groupLeagueStats = useMemo(() => {
        if (!isManagement && !isSuperAdmin) return [];

        const groups = activeStudents.reduce((acc, student) => {
            const groupName = student.groupName || 'غير محدد';
            if (!acc[groupName]) {
                acc[groupName] = {
                    groupName,
                    sheikhName: groupName.includes('فوج') ? groupName : groupName,
                    students: [],
                    totalStudents: 0,
                    activeStudents: 0,
                };
            }
            acc[groupName].students.push(student);
            acc[groupName].totalStudents++;
            acc[groupName].activeStudents++;
            return acc;
        }, {} as Record<string, any>);

        return Object.values(groups).map((group: any) => {
            const groupPlayers = leagueTable.filter(player =>
                group.students.some((s: any) => s.id === player.studentId)
            );

            const averagePoints = groupPlayers.length > 0
                ? groupPlayers.reduce((sum, p) => sum + p.points, 0) / groupPlayers.length
                : 0;

            const totalWins = groupPlayers.reduce((sum, p) => sum + p.wins, 0);
            const totalGoals = groupPlayers.reduce((sum, p) => sum + p.goalsFor, 0);
            const totalPlayed = groupPlayers.reduce((sum, p) => sum + p.played, 0);
            const winRate = totalPlayed > 0 ? (totalWins / totalPlayed) * 100 : 0;

            const topPlayers = groupPlayers
                .sort((a, b) => b.points - a.points)
                .slice(0, 3)
                .map(p => ({ name: p.studentName, points: p.points }));

            return {
                groupName: group.groupName,
                sheikhName: group.sheikhName,
                totalStudents: group.totalStudents,
                activeStudents: group.activeStudents,
                averagePoints,
                totalWins,
                totalGoals,
                winRate,
                topPlayers,
                players: groupPlayers,
            };
        }).sort((a, b) => b.averagePoints - a.averagePoints);
    }, [activeStudents, leagueTable, isManagement, isSuperAdmin]);

    useEffect(() => {
        const newRankMap = new Map<string, number>();
        leagueTable.forEach((stat) => {
            newRankMap.set(stat.studentId, stat.rank);
        });
        previousRankingRef.current = newRankMap;
    }, [leagueTable]);

    const topScorers = useMemo(() => {
        return [...leagueTable]
            .filter(s => s.goalsFor > 0)
            .sort((a, b) => b.goalsFor - a.goalsFor)
            .slice(0, 10);
    }, [leagueTable]);

    const topAssists = useMemo(() => {
        return [...leagueTable]
            .filter(s => s.assists > 0)
            .sort((a, b) => b.assists - a.assists)
            .slice(0, 10);
    }, [leagueTable]);

    const starOfTheMonth = useMemo(() => {
        if (!leagueTable || leagueTable.length === 0 || !dailySessions) return null;

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(daySessions =>
            Object.values(daySessions).filter(session => {
                if (!session?.date || session.sessionType === 'يوم عطلة' || session.sessionType === 'حصة أنشطة') return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return getMonth(sessionDate) === selectedMonth && getYear(sessionDate) === selectedYear;
                } catch (e) {
                    return false;
                }
            })
        );

        const star = leagueTable
            .filter(s => s.played > 0)
            .reduce((best, current) => {
                const currentScore = current.points + current.goalsFor + current.assists;
                const bestScore = best ? (best.points + best.goalsFor + best.assists) : -1;

                if (currentScore > bestScore) {
                    return current;
                }
                if (currentScore === bestScore) {
                    if (current.losses < best.losses) {
                        return current;
                    }
                }
                return best;
            }, leagueTable[0]);

        if (!star) return null;

        // Overall Rating Calculation
        const totalPossibleSessions = sessionsInMonth.length;

        const attendanceScore = totalPossibleSessions > 0 ? (star.wins / totalPossibleSessions) * 100 : 0;

        const maxGoals = totalPossibleSessions > 0 ? totalPossibleSessions * 2 : 1;
        const memorizationScore = (star.goalsFor / maxGoals) * 100;

        const maxAssists = totalPossibleSessions > 0 ? totalPossibleSessions * 2 : 1;
        const behaviorScore = (star.assists / maxAssists) * 100;

        const tajweedScore = 85; // Placeholder
        const akhlaqScore = 90; // Placeholder

        const overallAverage = (attendanceScore + memorizationScore + behaviorScore + tajweedScore + akhlaqScore) / 5;
        const overallRating = Math.min(99, Math.round((overallAverage / 100) * 99));

        return {
            ...star,
            overallRating,
            stats: { MEM: star.goalsFor, BEH: star.assists, ATT: star.wins, TAJ: 8.5 }
        };
    }, [leagueTable, dailySessions, selectedMonth, selectedYear]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (activeStudents.length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض الدوري</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl font-headline font-bold flex items-center gap-2">
                            <Shield className="text-primary" />
                            دوري الاستقامة والحفظ
                        </CardTitle>
                        <CardDescription>
                            جدول الترتيب الشهري. في حال تساوي النقاط، يتم اللجوء لفارق الأهداف ثم عدد الأهداف المسجلة.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', { locale: ar })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="السنة" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Management Group Comparison View */}
                {(isManagement || isSuperAdmin) && <ManagementLeagueView groupStats={groupLeagueStats} />}

                <MatchOfTheWeek leagueTable={leagueTable} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardContent className="pt-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>الطالب</TableHead>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="w-[80px] text-center cursor-pointer">الحراك</TableHead></TooltipTrigger><TooltipContent><p>مؤشر تغير مركز الطالب</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center cursor-pointer">ل</TableHead></TooltipTrigger><TooltipContent><p>لعب</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center text-green-600 cursor-pointer">ف</TableHead></TooltipTrigger><TooltipContent><p>فوز (حضور)</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center text-gray-500 cursor-pointer">ت</TableHead></TooltipTrigger><TooltipContent><p>تعادل (تأخر)</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center text-red-600 cursor-pointer">خ</TableHead></TooltipTrigger><TooltipContent><p>خسارة (غياب)</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center cursor-pointer">له</TableHead></TooltipTrigger><TooltipContent><p>أهداف مسجلة (جودة الحفظ)</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center cursor-pointer">عليه</TableHead></TooltipTrigger><TooltipContent><p>أهداف مستقبلة (ضعف الحفظ)</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center cursor-pointer">+/-</TableHead></TooltipTrigger><TooltipContent><p>فارق الأهداف</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center cursor-pointer">تم (AST)</TableHead></TooltipTrigger><TooltipContent><p>تمريرات مساعدة (السلوك)</p></TooltipContent></Tooltip>
                                            <Tooltip><TooltipTrigger asChild><TableHead className="text-center cursor-pointer">نقاط</TableHead></TooltipTrigger><TooltipContent><p>إجمالي النقاط (الحضور)</p></TooltipContent></Tooltip>
                                            <TableHead className="text-center w-[150px]">آخر 5</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leagueTable.length > 0 ? leagueTable.map((s, index) => {
                                            const rank = s.rank;
                                            const totalPlayers = leagueTable.length;
                                            let rankDisplay;
                                            let rowClass = '';

                                            if (rank <= 3) {
                                                if (rank === 1) rankDisplay = '🥇';
                                                else if (rank === 2) rankDisplay = '🥈';
                                                else rankDisplay = '🥉';
                                                rowClass = 'bg-green-100 dark:bg-green-900/30';
                                            } else {
                                                rankDisplay = rank;
                                            }

                                            if (rank > totalPlayers - 3 && totalPlayers > 5 && rank > 3) {
                                                rowClass = 'bg-red-100 dark:bg-red-900/30';
                                            }

                                            return (
                                                <TableRow key={s.studentId} className={cn(rowClass)}>
                                                    <TableCell className="font-bold text-lg text-center">{rankDisplay}</TableCell>
                                                    <TableCell>
                                                        <Link href={`/parent-portal?id=${s.studentId}`} className="flex items-center gap-3 hover:underline">
                                                            <Avatar className="h-9 w-9">
                                                                <AvatarImage src={s.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${s.studentName}`} alt={s.studentName} />
                                                                <AvatarFallback>{s.studentName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="font-medium">{s.studentName}</span>
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-center font-semibold">
                                                        <Tooltip>
                                                            <TooltipTrigger>
                                                                <div className="flex items-center justify-center gap-1">
                                                                    {s.movement > 0 && <TrendingUp className="h-4 w-4 text-green-500" />}
                                                                    {s.movement < 0 && <TrendingDown className="h-4 w-4 text-red-500" />}
                                                                    {s.movement === 0 && s.previousRank !== null && <Minus className="h-4 w-4 text-gray-500" />}
                                                                    {s.previousRank === null && <Star className="h-4 w-4 text-blue-400" />}
                                                                    {s.movement !== 0 && <span>{Math.abs(s.movement)}</span>}
                                                                </div>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                {s.movement > 0 && <p>صعود {s.movement} {s.movement > 1 ? 'مراكز' : 'مركز'}</p>}
                                                                {s.movement < 0 && <p>هبوط {Math.abs(s.movement)} {Math.abs(s.movement) > 1 ? 'مراكز' : 'مركز'}</p>}
                                                                {s.movement === 0 && s.previousRank !== null && <p>المركز ثابت</p>}
                                                                {s.previousRank === null && <p>طالب جديد في الترتيب هذا الشهر</p>}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TableCell>
                                                    <TableCell className="text-center">{s.played}</TableCell>
                                                    <TableCell className="text-center text-green-600 font-semibold">{s.wins}</TableCell>
                                                    <TableCell className="text-center text-gray-500 font-semibold">{s.draws}</TableCell>
                                                    <TableCell className="text-center text-red-600 font-semibold">{s.losses}</TableCell>
                                                    <TableCell className="text-center font-semibold">{s.goalsFor}</TableCell>
                                                    <TableCell className="text-center font-semibold">{s.goalsAgainst}</TableCell>
                                                    <TableCell className="text-center font-semibold">{s.goalDifference}</TableCell>
                                                    <TableCell className="text-center font-semibold">{s.assists}</TableCell>
                                                    <TableCell className="text-center font-bold text-lg">{s.points}</TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-2">
                                                            {s.form.map((status, i) => (
                                                                <Tooltip key={i}>
                                                                    <TooltipTrigger>
                                                                        <FormIcon status={status} />
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{status}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={14} className="text-center h-24">
                                                    لا توجد بيانات حضور مسجلة لهذا الشهر.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-6">
                        {starOfTheMonth && leagueTable.length > 0 && (
                            <div className="w-full max-w-sm mx-auto [perspective:1000px]">
                                <div
                                    className={cn(
                                        "relative h-[480px] w-full rounded-xl shadow-2xl transition-all duration-700 [transform-style:preserve-3d] cursor-pointer",
                                        isFlipped ? '[transform:rotateY(180deg)]' : ''
                                    )}
                                    onClick={() => setIsFlipped(!isFlipped)}
                                >
                                    {/* Front Side */}
                                    <div className="absolute inset-0 [backface-visibility:hidden]">
                                        <Card className="relative overflow-hidden bg-gradient-to-br from-yellow-300 via-amber-500 to-yellow-600 text-white shadow-2xl h-full">
                                            <div className="absolute inset-0 w-full h-full bg-black/10"></div>
                                            <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] animate-shine bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
                                            <CardHeader className="relative z-10 text-center pt-4 pb-2">
                                                <CardTitle className="text-xl font-headline text-white drop-shadow-lg">
                                                    نجم شهر {format(new Date(selectedYear, selectedMonth), 'MMMM', { locale: ar })}
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="relative z-10 flex flex-col items-center text-center p-4 pt-0">
                                                <div className="font-bold text-4xl text-black bg-white/80 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2 border-2 border-white/50 shadow-inner">
                                                    {starOfTheMonth.overallRating}
                                                </div>
                                                <Avatar className="w-28 h-28 mb-2 mx-auto border-4 border-white/50">
                                                    <AvatarImage src={starOfTheMonth.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${starOfTheMonth.studentName}`} alt={starOfTheMonth.studentName} />
                                                    <AvatarFallback>{starOfTheMonth.studentName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <h3 className="text-2xl font-bold drop-shadow-md">{starOfTheMonth.studentName}</h3>
                                                <div className="w-full h-px bg-white/30 my-3"></div>
                                                <div className="grid grid-cols-4 gap-2 w-full text-black">
                                                    <div className="bg-white/80 p-1.5 rounded-md">
                                                        <p className="font-bold text-xl">{starOfTheMonth.stats.MEM}</p><p className="text-xs font-semibold">حفظ</p>
                                                    </div>
                                                    <div className="bg-white/80 p-1.5 rounded-md">
                                                        <p className="font-bold text-xl">{starOfTheMonth.stats.BEH}</p><p className="text-xs font-semibold">سلوك</p>
                                                    </div>
                                                    <div className="bg-white/80 p-1.5 rounded-md">
                                                        <p className="font-bold text-xl">{starOfTheMonth.stats.ATT}</p><p className="text-xs font-semibold">حضور</p>
                                                    </div>
                                                    <div className="bg-white/80 p-1.5 rounded-md">
                                                        <p className="font-bold text-xl">{starOfTheMonth.stats.TAJ.toFixed(1)}</p><p className="text-xs font-semibold">تجويد</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    {/* Back Side */}
                                    <div className="absolute inset-0 h-full w-full rounded-xl bg-gradient-to-br from-gray-800 via-black to-gray-900 text-white [transform:rotateY(180deg)] [backface-visibility:hidden]">
                                        <div className="flex min-h-full flex-col items-center justify-center text-center p-4">
                                            <BookOpenCheck className="h-20 w-20 text-yellow-400 mb-4" />
                                            <h3 className="text-xl font-bold font-headline">المدرسة القرآنية للإمام الشافعي</h3>
                                            <p className="mt-4 text-2xl font-headline text-yellow-300">من هو نجم هذا الشهر؟</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Flame className="text-orange-500" />
                                    قائمة الهدافين
                                </CardTitle>
                                <CardDescription>
                                    الترتيب حسب الحفظ: ممتاز = هدفان، جيد جداً = هدف.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>الطالب</TableHead>
                                            <TableHead className="text-center">الأهداف</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topScorers.length > 0 ? topScorers.map((scorer, index) => (
                                            <TableRow key={scorer.studentId}>
                                                <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={scorer.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${scorer.studentName}`} alt={scorer.studentName} />
                                                            <AvatarFallback>{scorer.studentName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{scorer.studentName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-lg">{scorer.goalsFor}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center h-24">
                                                    لم يسجل أي طالب أهدافاً هذا الشهر.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="text-blue-500" />
                                    أفضل صانعي الألعاب
                                </CardTitle>
                                <CardDescription>
                                    الترتيب حسب السلوك: هادئ (+2)، متوسط (+1). من يتصدر يلقب بـ "مهندس الحلقة".
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>الطالب</TableHead>
                                            <TableHead className="text-center">تمريرات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topAssists.length > 0 ? topAssists.map((player, index) => (
                                            <TableRow key={player.studentId}>
                                                <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-9 w-9">
                                                            <AvatarImage src={player.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${player.studentName}`} alt={player.studentName} />
                                                            <AvatarFallback>{player.studentName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="font-medium">{player.studentName}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-lg">{player.assists}</TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center h-24">
                                                    لم يسجل أي طالب تمريرات هذا الشهر.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}

