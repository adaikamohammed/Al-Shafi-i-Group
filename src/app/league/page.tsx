"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Shield, CheckCircle, XCircle, MinusCircle } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, DailySession, AttendanceStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface LeagueStat {
    studentId: string;
    studentName: string;
    photoURL?: string;
    played: number;
    wins: number;
    draws: number;
    losses: number;
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

            sessionsInMonth.forEach(session => {
                const record = session.records.find(r => r.studentId === student.id);
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
                points: (wins * 3) + (draws * 1),
                form: form.slice(-5)
            };
        });

        return stats.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.wins !== a.wins) return b.wins - a.wins;
            return a.studentName.localeCompare(b.studentName);
        });

    }, [activeStudents, dailySessions, selectedMonth, selectedYear]);

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
    
    const rankColor = (rank: number) => {
        if (rank === 1) return 'bg-yellow-100 dark:bg-yellow-900/30';
        if (rank <= 3) return 'bg-blue-50 dark:bg-blue-900/20';
        return '';
    };

    return (
        <TooltipProvider>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl font-headline font-bold flex items-center gap-2">
                            <Shield className="text-primary" />
                            دوري الاستقامة الصارمة
                        </CardTitle>
                        <CardDescription>
                            جدول الترتيب الشهري بناءً على الحضور: فوز (3 نقاط)، تعادل (نقطة)، خسارة (0 نقاط).
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
                                    <TableHead className="text-center">نقاط</TableHead>
                                    <TableHead className="text-center w-[200px]">آخر 5</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leagueTable.length > 0 ? leagueTable.map((s, index) => (
                                    <TableRow key={s.studentId} className={cn(rankColor(index + 1))}>
                                        <TableCell className="font-bold text-lg text-center">{index + 1}</TableCell>
                                        <TableCell>
                                             <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={s.photoURL} alt={s.studentName} />
                                                    <AvatarFallback>{s.studentName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="font-medium">{s.studentName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">{s.played}</TableCell>
                                        <TableCell className="text-center text-green-600 font-semibold">{s.wins}</TableCell>
                                        <TableCell className="text-center text-gray-500 font-semibold">{s.draws}</TableCell>
                                        <TableCell className="text-center text-red-600 font-semibold">{s.losses}</TableCell>
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
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center h-24">
                                            لا توجد بيانات حضور مسجلة لهذا الشهر.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}
