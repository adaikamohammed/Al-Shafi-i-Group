

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Medal, BookOpenCheck, ShieldCheck, UserCheck, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, DailySession } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface StudentScore {
    id: string;
    name: string;
    points: number;
    stats: {
        present: number;
        absent: number;
        late: number;
        makeup: number;
        excellent: number;
        good: number;
        average: number;
        calm: number;
        medium: number;
        undisciplined: number;
        reviewed: number;
        commitmentBalance: number;
    }
}

export default function RankingPage() {
    const { students, dailySessions, loading, settings } = useStudentContext();
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const pointsConfig = settings.points;

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);

    const rankingData: StudentScore[] = useMemo(() => {
        if (!pointsConfig) return [];
        const seasonStartDate = settings.seasonStartDate ? parseISO(settings.seasonStartDate) : null;
        
        const monthStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEndDate = endOfMonth(new Date(selectedYear, selectedMonth));

        const calculationStartDate = seasonStartDate && isAfter(seasonStartDate, monthStartDate) ? seasonStartDate : monthStartDate;

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate => 
            Object.values(sessionsOnDate).filter(session => {
                if(!session?.date) return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return sessionDate >= calculationStartDate && sessionDate <= monthEndDate;
                } catch(e) { return false; }
            })
        );

        const studentScores: Record<string, StudentScore> = {};

        activeStudents.forEach(student => {
            studentScores[student.id] = {
                id: student.id,
                name: student.fullName,
                points: 0,
                stats: { present: 0, absent: 0, late: 0, makeup: 0, excellent: 0, good: 0, average: 0, calm: 0, medium: 0, undisciplined: 0, reviewed: 0, commitmentBalance: 0 }
            };
            // Add bonus points for fulfilled covenants in the selected month
            (student.covenants || []).forEach(covenant => {
                if (covenant.status === 'تم الوفاء به') {
                     try {
                        const covenantDate = parseISO(covenant.date);
                        if(getMonth(covenantDate) === selectedMonth && getYear(covenantDate) === selectedYear) {
                           studentScores[student.id].points += pointsConfig.covenantCompleted;
                        }
                     } catch(e) { console.error("Invalid covenant date", covenant.date); }
                }
            })
        });

        sessionsInMonth.forEach(session => {
            (session.records ?? []).forEach(record => {
                const studentId = record.studentId;
                if (studentScores[studentId]) {
                    let points = 0;
                    if (record.attendance && pointsConfig.attendance) {
                        points += pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] ?? 0;
                        if(record.attendance === 'حاضر') studentScores[studentId].stats.present++;
                        if(record.attendance === 'غائب') studentScores[studentId].stats.absent++;
                        if(record.attendance === 'متأخر') studentScores[studentId].stats.late++;
                        if(record.attendance === 'تعويض') studentScores[studentId].stats.makeup++;
                    }
                    if (record.memorization && pointsConfig.evaluation) {
                        points += pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] ?? 0;
                        if(record.memorization === 'ممتاز') studentScores[studentId].stats.excellent++;
                        if(record.memorization === 'جيد') studentScores[studentId].stats.good++;
                        if(record.memorization === 'متوسط') studentScores[studentId].stats.average++;
                    }
                    if (record.behavior && pointsConfig.behavior) {
                        points += pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] ?? 0;
                         if(record.behavior === 'هادئ') studentScores[studentId].stats.calm++;
                         if(record.behavior === 'متوسط') studentScores[studentId].stats.medium++;
                         if(record.behavior === 'غير منضبط') studentScores[studentId].stats.undisciplined++;
                    }
                    if (record.review && pointsConfig.review) {
                        points += pointsConfig.review.completed;
                        studentScores[studentId].stats.reviewed++;
                    }
                    studentScores[studentId].points += points;
                }
            });
        });
        
        Object.values(studentScores).forEach(score => {
            score.stats.commitmentBalance = (score.stats.present + score.stats.makeup) - score.stats.absent;
        });

        return Object.values(studentScores).sort((a, b) => b.points - a.points);
    }, [activeStudents, dailySessions, selectedMonth, selectedYear, pointsConfig, settings.seasonStartDate]);


    const topStudents = rankingData.slice(0, 3);

    const getMedalStatus = (student: StudentScore, rank: number) => {
        const uncompensatedAbsences = student.stats.absent - student.stats.makeup;
        if (rank === 1) {
            const isExcellentBehavior = student.stats.calm > (student.stats.medium + student.stats.undisciplined);
            if (uncompensatedAbsences <= 0 && isExcellentBehavior) return 'gold';
        }
        if (rank === 2 && uncompensatedAbsences <= 1) return 'silver';
        if (rank === 3 && uncompensatedAbsences <= 2) return 'bronze';
        return 'none';
    };
    
    const specialBadges = useMemo(() => {
        if(rankingData.length === 0) return {};
        const mostExcellent = rankingData.reduce((prev, current) => (prev.stats.excellent > current.stats.excellent) ? prev : current);
        const mostCalm = rankingData.reduce((prev, current) => (prev.stats.calm > current.stats.calm) ? prev : current);
        const mostReviewed = rankingData.reduce((prev, current) => (prev.stats.reviewed > current.stats.reviewed) ? prev : current);
        return { mostExcellent, mostCalm, mostReviewed };
    }, [rankingData]);


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
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض ترتيبهم</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }


    return (
        <TooltipProvider>
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-headline font-bold">🏅 لوحة شرف الطلبة</h1>
                 <div className="flex gap-2 w-full md:w-auto">
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
            </div>

            {rankingData.length > 0 && rankingData.some(d => d.points !== 0) ? (
                <>
                    <Card>
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl font-headline">منصة التتويج لشهر {format(new Date(selectedYear, selectedMonth), 'MMMM yyyy', {locale: ar})}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-center items-end gap-4 md:gap-8 h-48">
                                {topStudents[1] && getMedalStatus(topStudents[1], 2) !== 'none' && (
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="text-4xl">🥈</div>
                                        <div className="font-bold text-lg text-center">{topStudents[1].name}</div>
                                        <div className="h-24 w-full bg-medal-silver rounded-t-lg flex items-center justify-center font-bold text-xl text-medal-silver-foreground p-2">
                                            {topStudents[1].points.toFixed(1)} نقطة
                                        </div>
                                    </div>
                                )}
                                {topStudents[0] && getMedalStatus(topStudents[0], 1) !== 'none' && (
                                    <div className="flex flex-col items-center w-1/3">
                                         <div className="text-4xl">🥇</div>
                                        <div className="font-bold text-lg text-center">{topStudents[0].name}</div>
                                        <div className="h-36 w-full bg-medal-gold rounded-t-lg flex items-center justify-center font-bold text-2xl text-medal-gold-foreground p-2">
                                           {topStudents[0].points.toFixed(1)} نقطة
                                        </div>
                                    </div>
                                )}
                                 {topStudents[2] && getMedalStatus(topStudents[2], 3) !== 'none' && (
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="text-4xl">🥉</div>
                                        <div className="font-bold text-lg text-center">{topStudents[2].name}</div>
                                        <div className="h-20 w-full bg-medal-bronze rounded-t-lg flex items-center justify-center font-bold text-lg text-medal-bronze-foreground p-2">
                                           {topStudents[2].points.toFixed(1)} نقطة
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>شارات التكريم الخاصة</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-3 gap-4">
                            {specialBadges.mostExcellent && specialBadges.mostExcellent.stats.excellent > 0 && (
                                <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center gap-3">
                                    <BookOpenCheck className="h-8 w-8 text-green-600"/>
                                    <div>
                                        <p className="font-bold text-green-800 dark:text-green-200">الأكثر تميزًا في الحفظ</p>
                                        <p>{specialBadges.mostExcellent.name} ({specialBadges.mostExcellent.stats.excellent} مرات)</p>
                                    </div>
                                </div>
                            )}
                            {specialBadges.mostCalm && specialBadges.mostCalm.stats.calm > 0 && (
                                <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center gap-3">
                                    <ShieldCheck className="h-8 w-8 text-blue-600"/>
                                    <div>
                                        <p className="font-bold text-blue-800 dark:text-blue-200">الأكثر انضباطًا وهدوءًا</p>
                                        <p>{specialBadges.mostCalm.name} ({specialBadges.mostCalm.stats.calm} مرات)</p>
                                    </div>
                                </div>
                            )}
                             {specialBadges.mostReviewed && specialBadges.mostReviewed.stats.reviewed > 0 && (
                                <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center gap-3">
                                    <UserCheck className="h-8 w-8 text-purple-600"/>
                                    <div>
                                        <p className="font-bold text-purple-800 dark:text-purple-200">الأكثر مراجعة</p>
                                        <p>{specialBadges.mostReviewed.name} ({specialBadges.mostReviewed.stats.reviewed} مرات)</p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>جدول الترتيب التفصيلي</CardTitle>
                            <CardDescription>عرض تفصيلي لنقاط كل طالب ومصادرها خلال الشهر المحدد.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>الترتيب</TableHead>
                                        <TableHead>الاسم</TableHead>
                                        <TableHead className="text-center">حضور</TableHead>
                                        <TableHead className="text-center">غياب</TableHead>
                                        <TableHead className="text-center">ممتاز</TableHead>
                                        <TableHead className="text-center">هادئ</TableHead>
                                        <TableHead className="text-center">مراجعات</TableHead>
                                        <TableHead className="text-center">الالتزام</TableHead>
                                        <TableHead className="text-center font-bold">إجمالي النقاط</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rankingData.map((student, index) => {
                                        const rank = index + 1;
                                        const medal = getMedalStatus(student, rank);
                                        const medalClass = {
                                            gold: 'bg-medal-gold/30',
                                            silver: 'bg-medal-silver/30',
                                            bronze: 'bg-medal-bronze/30',
                                            none: ''
                                        }[medal];

                                        return (
                                        <TableRow key={student.id} className={cn(medalClass)}>
                                            <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                                            <TableCell className="font-medium">{student.name}</TableCell>
                                            <TableCell className="text-center">{student.stats.present}</TableCell>
                                            <TableCell className="text-center">{student.stats.absent}</TableCell>
                                            <TableCell className="text-center">{student.stats.excellent}</TableCell>
                                            <TableCell className="text-center">{student.stats.calm}</TableCell>
                                            <TableCell className="text-center">{student.stats.reviewed}</TableCell>
                                            <TableCell className="text-center">
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        {student.stats.commitmentBalance >= 0 ? 
                                                            <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : 
                                                            <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                                                        }
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>رصيد الالتزام: {student.stats.commitmentBalance}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                            <TableCell className="text-center"><Badge variant="default" className="text-base">{student.points.toFixed(1)}</Badge></TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </>
            ) : (
                 <div className="space-y-6 flex flex-col items-center justify-center h-60 border border-dashed rounded-lg">
                    <AlertTriangle className="h-16 w-16 text-muted-foreground" />
                    <h2 className="text-xl font-headline font-bold text-center">لا توجد بيانات مسجلة لهذا الشهر</h2>
                    <p className="text-muted-foreground text-center">
                        لا يمكن حساب الترتيب بدون سجلات للحصص في الشهر المحدد.
                    </p>
                </div>
            )}
        </div>
        </TooltipProvider>
    );
}

    