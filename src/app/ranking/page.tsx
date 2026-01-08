
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Medal, BookOpenCheck, ShieldCheck, UserCheck } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, DailySession } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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
    }
}

export default function RankingPage() {
    const { students, dailySessions, loading, settings } = useStudentContext();
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const pointsConfig = settings.points;

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);

    const rankingData: StudentScore[] = useMemo(() => {
        // Use season start date from settings, or fall back to the start of the student's registration year if not set.
        const seasonStartDate = settings.seasonStartDate ? parseISO(settings.seasonStartDate) : null;
        
        const monthStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEndDate = endOfMonth(new Date(selectedYear, selectedMonth));

        // Ensure we only calculate for the selected month, but also respect the season start date.
        const calculationStartDate = seasonStartDate && isAfter(seasonStartDate, monthStartDate) ? seasonStartDate : monthStartDate;

        const filteredSessions = Object.values(dailySessions ?? {}).filter(session => {
            const sessionDate = parseISO(session.date);
            // The session must be within the selected month AND after the season start date.
            return sessionDate >= calculationStartDate && sessionDate <= monthEndDate;
        });

        const studentScores: Record<string, StudentScore> = {};

        activeStudents.forEach(student => {
            studentScores[student.id] = {
                id: student.id,
                name: student.fullName,
                points: 0,
                stats: { present: 0, absent: 0, late: 0, makeup: 0, excellent: 0, good: 0, average: 0, calm: 0, medium: 0, undisciplined: 0, reviewed: 0 }
            };
        });

        filteredSessions.forEach(session => {
            (session.records ?? []).forEach(record => {
                if (studentScores[record.studentId]) {
                    let points = 0;
                    if (record.attendance) {
                        points += pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] ?? 0;
                        if(record.attendance === 'حاضر') studentScores[record.studentId].stats.present++;
                        if(record.attendance === 'غائب') studentScores[record.studentId].stats.absent++;
                        if(record.attendance === 'متأخر') studentScores[record.studentId].stats.late++;
                        if(record.attendance === 'تعويض') studentScores[record.studentId].stats.makeup++;
                    }
                    if (record.memorization) {
                        points += pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] ?? 0;
                        if(record.memorization === 'ممتاز') studentScores[record.studentId].stats.excellent++;
                        if(record.memorization === 'جيد') studentScores[record.studentId].stats.good++;
                        if(record.memorization === 'متوسط') studentScores[record.studentId].stats.average++;
                    }
                    if (record.behavior) {
                        points += pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] ?? 0;
                         if(record.behavior === 'هادئ') studentScores[record.studentId].stats.calm++;
                         if(record.behavior === 'متوسط') studentScores[record.studentId].stats.medium++;
                         if(record.behavior === 'غير منضبط') studentScores[record.studentId].stats.undisciplined++;
                    }
                    if (record.review) {
                        points += pointsConfig.review.completed;
                        studentScores[record.studentId].stats.reviewed++;
                    }
                    studentScores[record.studentId].points += points;
                }
            });
        });

        return Object.values(studentScores).sort((a, b) => b.points - a.points);
    }, [activeStudents, dailySessions, selectedMonth, selectedYear, pointsConfig, settings.seasonStartDate]);


    const topStudents = rankingData.slice(0, 3);
    
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
                                {topStudents[1] && (
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="text-4xl">🥈</div>
                                        <div className="font-bold text-lg text-center">{topStudents[1].name}</div>
                                        <div className="h-24 w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-lg flex items-center justify-center font-bold text-xl text-blue-800 dark:text-blue-200 p-2">
                                            {topStudents[1].points.toFixed(1)} نقطة
                                        </div>
                                    </div>
                                )}
                                {topStudents[0] && (
                                    <div className="flex flex-col items-center w-1/3">
                                         <div className="text-4xl">🥇</div>
                                        <div className="font-bold text-lg text-center">{topStudents[0].name}</div>
                                        <div className="h-36 w-full bg-yellow-100 dark:bg-yellow-900/30 rounded-t-lg flex items-center justify-center font-bold text-2xl text-yellow-800 dark:text-yellow-200 p-2">
                                           {topStudents[0].points.toFixed(1)} نقطة
                                        </div>
                                    </div>
                                )}
                                 {topStudents[2] && (
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="text-4xl">🥉</div>
                                        <div className="font-bold text-lg text-center">{topStudents[2].name}</div>
                                        <div className="h-20 w-full bg-orange-100 dark:bg-orange-900/30 rounded-t-lg flex items-center justify-center font-bold text-lg text-orange-800 dark:text-orange-200 p-2">
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
                                        <TableHead className="text-center">تقييم ممتاز</TableHead>
                                        <TableHead className="text-center">سلوك هادئ</TableHead>
                                        <TableHead className="text-center">مراجعات</TableHead>
                                        <TableHead className="text-center font-bold">إجمالي النقاط</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rankingData.map((student, index) => (
                                        <TableRow key={student.id}>
                                            <TableCell className="font-bold text-lg">{index + 1}</TableCell>
                                            <TableCell className="font-medium">{student.name}</TableCell>
                                            <TableCell className="text-center">{student.stats.present}</TableCell>
                                            <TableCell className="text-center">{student.stats.absent}</TableCell>
                                            <TableCell className="text-center">{student.stats.excellent}</TableCell>
                                            <TableCell className="text-center">{student.stats.calm}</TableCell>
                                            <TableCell className="text-center">{student.stats.reviewed}</TableCell>
                                            <TableCell className="text-center"><Badge variant="default" className="text-base">{student.points.toFixed(1)}</Badge></TableCell>
                                        </TableRow>
                                    ))}
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
    );
}
