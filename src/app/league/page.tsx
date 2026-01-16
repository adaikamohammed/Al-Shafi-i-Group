
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Shield, CheckCircle, XCircle, MinusCircle, Flame } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, DailySession, AttendanceStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

interface LeagueStat {
    studentId: string;
    studentName: string;
    photoURL?: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
    points: number;
    form: AttendanceStatus[];
}

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
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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
        
        const stats: LeagueStat[] = activeStudents.map(student => {
            let wins = 0, draws = 0, losses = 0;
            const form: AttendanceStatus[] = [];
            let goalsFor = 0;
            let goalsAgainst = 0;

            sessionsInMonth.forEach(session => {
                const record = (session.records || []).find(r => r.studentId === student.id);
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
                    if (record.memorization === 'ممتاز') {
                        switch (student.dailyMemorizationAmount) {
                            case 'ثمن': goalsFor += 1; break;
                            case 'ربع': goalsFor += 2; break;
                            case 'نصف': goalsFor += 4; break;
                            case 'صفحة': goalsFor += 8; break;
                            case 'أكثر': goalsFor += 10; break;
                        }
                    }
                    if (record.memorization === 'ضعيف') {
                        goalsAgainst += 1;
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
            };
        });

        return stats.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
            if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
            if (a.losses !== b.losses) return a.losses - b.losses;
            return a.studentName.localeCompare(b.studentName);
        });

    }, [activeStudents, dailySessions, selectedMonth, selectedYear]);

     const topScorers = useMemo(() => {
        return [...leagueTable]
            .filter(s => s.goalsFor > 0)
            .sort((a, b) => b.goalsFor - a.goalsFor)
            .slice(0, 10);
    }, [leagueTable]);


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
                            جدول الترتيب الشهري بناءً على الحضور والأداء. في حال تساوي النقاط، يتم اللجوء لفارق الأهداف ثم عدد الأهداف المسجلة.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                             <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[180px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({length: 12}, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', {locale: ar})}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="السنة" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card>
                            <CardContent className="pt-6">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>الطالب</TableHead>
                                            <TableHead className="text-center">ل</TableHead>
                                            <TableHead className="text-center text-green-600">ف</TableHead>
                                            <TableHead className="text-center text-gray-500">ت</TableHead>
                                            <TableHead className="text-center text-red-600">خ</TableHead>
                                            <TableHead className="text-center">له</TableHead>
                                            <TableHead className="text-center">عليه</TableHead>
                                            <TableHead className="text-center">فارق</TableHead>
                                            <TableHead className="text-center">نقاط</TableHead>
                                            <TableHead className="text-center w-[150px]">آخر 5</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leagueTable.length > 0 ? leagueTable.map((s, index) => {
                                            const rank = index + 1;
                                            const totalPlayers = leagueTable.length;
                                            let rankDisplay;
                                            let rowClass = '';

                                            if (rank === 1) { rankDisplay = '🥇'; rowClass = 'bg-green-100 dark:bg-green-900/30'; }
                                            else if (rank === 2) { rankDisplay = '🥈'; rowClass = 'bg-green-100 dark:bg-green-900/30'; }
                                            else if (rank === 3) { rankDisplay = '🥉'; rowClass = 'bg-green-100 dark:bg-green-900/30'; }
                                            else { rankDisplay = rank; }
                                            
                                            if (rank > totalPlayers - 3 && totalPlayers > 5 && rank > 3) {
                                                rowClass = 'bg-red-100 dark:bg-red-900/30';
                                            }

                                            return (
                                                <TableRow key={s.studentId} className={cn(rowClass)}>
                                                    <TableCell className="font-bold text-lg text-center">{rankDisplay}</TableCell>
                                                    <TableCell>
                                                        <Link href={`/parent-portal/${s.studentId}`} className="flex items-center gap-3 hover:underline">
                                                            <Avatar className="h-9 w-9">
                                                                <AvatarImage src={s.photoURL} alt={s.studentName} />
                                                                <AvatarFallback>{s.studentName.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="font-medium">{s.studentName}</span>
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-center">{s.played}</TableCell>
                                                    <TableCell className="text-center text-green-600 font-semibold">{s.wins}</TableCell>
                                                    <TableCell className="text-center text-gray-500 font-semibold">{s.draws}</TableCell>
                                                    <TableCell className="text-center text-red-600 font-semibold">{s.losses}</TableCell>
                                                    <TableCell className="text-center font-semibold">{s.goalsFor}</TableCell>
                                                    <TableCell className="text-center font-semibold">{s.goalsAgainst}</TableCell>
                                                    <TableCell className="text-center font-semibold">{s.goalDifference}</TableCell>
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
                                                <TableCell colSpan={11} className="text-center h-24">
                                                    لا توجد بيانات حضور مسجلة لهذا الشهر.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                     <div>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Flame className="text-orange-500" />
                                    قائمة الهدافين
                                </CardTitle>
                                <CardDescription>
                                    ترتيب الطلاب حسب أهداف الحفظ (ثمن ممتاز = هدف، ربع ممتاز = هدفان...).
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
                                                            <AvatarImage src={scorer.photoURL} alt={scorer.studentName} />
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
                    </div>
                </div>
            </div>
        </TooltipProvider>
    );
}
