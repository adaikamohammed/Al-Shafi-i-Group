

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Medal, BookOpenCheck, ShieldCheck, UserCheck, CheckCircle, XCircle, Crown } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, DailySession, BadgeConfig, StudentStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, isStudentInMenSheikhs, isStudentInWomenUstadhats, filterStudentsByGroup } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { GroupSelector } from '@/components/management/GroupSelector';


interface StudentScore {
    id: string;
    name: string;
    photoURL?: string;
    status: StudentStatus;
    points: number;
    pointsBreakdown: {
        hifz: number;
        attendance: number;
        behavior: number;
        bonus: number;
    };
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
    const { students, dailySessions, loading, settings, allUsers, selectedGroup, setSelectedGroup } = useStudentContext();
    const { isManagement } = useAuth();
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

    const pointsConfig = settings.points;

    const rankingData: StudentScore[] = useMemo(() => {
        if (!pointsConfig || !students) return [];

        const monthStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEndDate = endOfMonth(new Date(selectedYear, selectedMonth));

        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate =>
            Object.values(sessionsOnDate).filter(session => {
                if (!session?.date) return false;
                try {
                    const sessionDate = parseISO(session.date);
                    return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
                } catch (e) { return false; }
            })
        );

        const studentScores: Record<string, StudentScore> = {};

        let studentsToRank = students ?? [];
        if (isManagement) {
            studentsToRank = filterStudentsByGroup(studentsToRank, selectedGroup, allUsers);
        }

        // Initialize all students, active or not
        studentsToRank.forEach(student => {
            studentScores[student.id] = {
                id: student.id,
                name: student.fullName,
                photoURL: student.photoURL,
                status: student.status,
                points: 0,
                pointsBreakdown: { hifz: 0, attendance: 0, behavior: 0, bonus: 0 },
                stats: { present: 0, absent: 0, late: 0, makeup: 0, excellent: 0, good: 0, average: 0, calm: 0, medium: 0, undisciplined: 0, reviewed: 0, commitmentBalance: 0 }
            };
        });

        // Only calculate points for active students
        sessionsInMonth.forEach(session => {
            (session.records ?? []).forEach(record => {
                const studentId = record.studentId;
                if (studentScores[studentId] && studentScores[studentId].status === 'نشط') {
                    if (record.attendance && pointsConfig.attendance) {
                        const attendancePoints = pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] ?? 0;
                        studentScores[studentId].pointsBreakdown.attendance += attendancePoints;
                        if (record.attendance === 'حاضر') studentScores[studentId].stats.present++;
                        if (record.attendance === 'غائب') studentScores[studentId].stats.absent++;
                        if (record.attendance === 'متأخر') studentScores[studentId].stats.late++;
                        if (record.attendance === 'تعويض') studentScores[studentId].stats.makeup++;
                    }
                    // Accumulate both memorization and review points if present
                    if (record.memorization && pointsConfig.evaluation) {
                        const hifzPoints = pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] ?? 0;
                        studentScores[studentId].pointsBreakdown.hifz += hifzPoints;
                        if (record.memorization === 'ممتاز') studentScores[studentId].stats.excellent++;
                        if (record.memorization === 'جيد') studentScores[studentId].stats.good++;
                        if (record.memorization === 'متوسط' || record.memorization === 'مقبول' || record.memorization === 'حسن') studentScores[studentId].stats.average++;
                    }
                    if (record.behavior && pointsConfig.behavior) {
                        const behaviorPoints = pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] ?? 0;
                        studentScores[studentId].pointsBreakdown.behavior += behaviorPoints;
                        if (record.behavior === 'هادئ') studentScores[studentId].stats.calm++;
                        if ((record.behavior as string) === 'متوسط' || record.behavior === 'مقبول') studentScores[studentId].stats.medium++;
                        if ((record.behavior as string) === 'غير منضبط' || record.behavior === 'مشاغب') studentScores[studentId].stats.undisciplined++;
                    }
                    if (record.bonus) {
                        const BONUS_POINTS: Record<string, number> = {
                            'مشاركة مميزة': 1,
                            'تفاعل إيجابي': 1.5,
                            'انضباط متميز': 2,
                            'حفظ زائد': 3,
                            'لا يوجد': 0,
                            '': 0
                        };
                        const bp = BONUS_POINTS[record.bonus] ?? 0;
                        studentScores[studentId].pointsBreakdown.bonus += bp;
                    }
                    if (record.negativeBonus) {
                        const NEGATIVE_BONUS_POINTS: Record<string, number> = {
                            'لباس غير لائق': -1.5,
                            'بدون مصحف': -1,
                            'إهمال المراجعة المنزلية': -2,
                            'لا يوجد': 0,
                            '': 0
                        };
                        const nbp = NEGATIVE_BONUS_POINTS[record.negativeBonus] ?? 0;
                        studentScores[studentId].pointsBreakdown.bonus += nbp;
                    }
                    if (record.review && pointsConfig.review?.completed) {
                        studentScores[studentId].pointsBreakdown.hifz += pointsConfig.review.completed;
                        studentScores[studentId].stats.reviewed++;
                    }
                }
            });
        });

        Object.values(studentScores).forEach(score => {
            if (score.status === 'نشط') {
                (students.find(s => s.id === score.id)?.covenants || []).forEach(covenant => {
                    if (covenant.status === 'تم الوفاء بها') {
                        try {
                            const covenantDate = parseISO(covenant.date);
                            if (getMonth(covenantDate) === selectedMonth && getYear(covenantDate) === selectedYear) {
                                score.pointsBreakdown.hifz += pointsConfig.covenantCompleted;
                            }
                        } catch (e) { console.error("Invalid covenant date", covenant.date); }
                    }
                })
                score.stats.commitmentBalance = (score.stats.present + score.stats.makeup) - score.stats.absent;
                score.points = score.pointsBreakdown.hifz + score.pointsBreakdown.attendance + score.pointsBreakdown.behavior + score.pointsBreakdown.bonus;
            }
        });

        return Object.values(studentScores).sort((a, b) => b.points - a.points);
    }, [students, dailySessions, selectedMonth, selectedYear, pointsConfig, allUsers, selectedGroup, isManagement]);


    const topStudents = rankingData.filter(s => s.status === 'نشط').slice(0, 3);
    const masteryKingBadge = settings.badges.find(b => b.id === 'mastery_king');

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
        const activeRankingData = rankingData.filter(s => s.status === 'نشط');
        if (activeRankingData.length === 0) return {};
        const mostExcellent = activeRankingData.reduce((prev, current) => (prev.stats.excellent > current.stats.excellent) ? prev : current);
        const mostCalm = activeRankingData.reduce((prev, current) => (prev.stats.calm > current.stats.calm) ? prev : current);
        const mostReviewed = activeRankingData.reduce((prev, current) => (prev.stats.reviewed > current.stats.reviewed) ? prev : current);
        return { mostExcellent, mostCalm, mostReviewed };
    }, [rankingData]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    if ((students ?? []).length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض ترتيبهم</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }


    return (
        <TooltipProvider>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <h1 className="text-3xl font-headline font-bold">لوحة شرف الطلبة</h1>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        {isManagement && <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />}
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
                </div>

                {rankingData.length > 0 && rankingData.some(d => d.points !== 0) ? (
                    <>
                        <Card>
                            <CardHeader className="text-center">
                                <CardTitle className="text-2xl font-headline">منصة التتويج لشهر {format(new Date(selectedYear, selectedMonth), 'MMMM yyyy', { locale: ar })}</CardTitle>
                            </CardHeader>
                            <CardContent className="flex justify-center items-end gap-4 md:gap-8 h-64 md:h-80">
                                {/* Silver - 2nd Place */}
                                {topStudents[1] && getMedalStatus(topStudents[1], 2) !== 'none' && (
                                    <div className="flex flex-col items-center w-1/4">
                                        <div className="text-4xl">🥈</div>
                                        <Avatar className="w-16 h-16 mb-2 border-4 border-medal-silver">
                                            <AvatarImage src={topStudents[1].photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${topStudents[1].name}`} />
                                            <AvatarFallback>{topStudents[1].name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-bold text-md text-center">{topStudents[1].name}</div>
                                        <div className="h-28 w-full bg-medal-silver rounded-t-lg flex items-center justify-center font-bold text-xl text-medal-silver-foreground p-2 flex-col">
                                            <span>{topStudents[1].points.toFixed(1)}</span>
                                            <Tooltip>
                                                <TooltipTrigger className="text-xs font-normal mt-1 cursor-default">(تـفـاصـيـل)</TooltipTrigger>
                                                <TooltipContent>
                                                    <p>التحصيل: {topStudents[1].pointsBreakdown.hifz.toFixed(1)}</p>
                                                    <p>المواظبة: {topStudents[1].pointsBreakdown.attendance.toFixed(1)}</p>
                                                    <p>السلوك: {topStudents[1].pointsBreakdown.behavior.toFixed(1)}</p>
                                                    {topStudents[1].pointsBreakdown.bonus !== 0 && (
                                                        <p className={cn("font-bold", topStudents[1].pointsBreakdown.bonus > 0 ? "text-purple-600" : "text-red-600")}>
                                                            {topStudents[1].pointsBreakdown.bonus > 0 ? "البونص: +" : "الخصم السلوكي: "}
                                                            {topStudents[1].pointsBreakdown.bonus.toFixed(1)}
                                                        </p>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )}
                                {/* Gold - 1st Place */}
                                {topStudents[0] && getMedalStatus(topStudents[0], 1) !== 'none' && (
                                    <div className="flex flex-col items-center w-1/3">
                                        <div className="text-4xl">🥇</div>
                                        <Avatar className="w-20 h-20 mb-2 border-4 border-medal-gold">
                                            <AvatarImage src={topStudents[0].photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${topStudents[0].name}`} />
                                            <AvatarFallback>{topStudents[0].name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-bold text-lg text-center flex items-center gap-1">
                                            {topStudents[0].name}
                                            {masteryKingBadge && topStudents[0].points >= masteryKingBadge.threshold &&
                                                <Tooltip>
                                                    <TooltipTrigger><Crown className="h-5 w-5 text-yellow-500" /></TooltipTrigger>
                                                    <TooltipContent><p>{masteryKingBadge.name}</p></TooltipContent>
                                                </Tooltip>
                                            }
                                        </div>
                                        <div className="h-40 w-full bg-medal-gold rounded-t-lg flex items-center justify-center font-bold text-2xl text-medal-gold-foreground p-2 flex-col">
                                            <span>{topStudents[0].points.toFixed(1)}</span>
                                            <Tooltip>
                                                <TooltipTrigger className="text-sm font-normal mt-1 cursor-default">(تـفـاصـيـل)</TooltipTrigger>
                                                <TooltipContent>
                                                    <p>التحصيل: {topStudents[0].pointsBreakdown.hifz.toFixed(1)}</p>
                                                    <p>المواظبة: {topStudents[0].pointsBreakdown.attendance.toFixed(1)}</p>
                                                    <p>السلوك: {topStudents[0].pointsBreakdown.behavior.toFixed(1)}</p>
                                                    {topStudents[0].pointsBreakdown.bonus !== 0 && (
                                                        <p className={cn("font-bold", topStudents[0].pointsBreakdown.bonus > 0 ? "text-purple-600" : "text-red-600")}>
                                                            {topStudents[0].pointsBreakdown.bonus > 0 ? "البونص: +" : "الخصم السلوكي: "}
                                                            {topStudents[0].pointsBreakdown.bonus.toFixed(1)}
                                                        </p>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )}
                                {/* Bronze - 3rd Place */}
                                {topStudents[2] && getMedalStatus(topStudents[2], 3) !== 'none' && (
                                    <div className="flex flex-col items-center w-1/4">
                                        <div className="text-4xl">🥉</div>
                                        <Avatar className="w-16 h-16 mb-2 border-4 border-medal-bronze">
                                            <AvatarImage src={topStudents[2].photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${topStudents[2].name}`} />
                                            <AvatarFallback>{topStudents[2].name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="font-bold text-md text-center">{topStudents[2].name}</div>
                                        <div className="h-24 w-full bg-medal-bronze rounded-t-lg flex items-center justify-center font-bold text-lg text-medal-bronze-foreground p-2 flex-col">
                                            <span>{topStudents[2].points.toFixed(1)}</span>
                                            <Tooltip>
                                                <TooltipTrigger className="text-xs font-normal mt-1 cursor-default">(تـفـاصـيـل)</TooltipTrigger>
                                                <TooltipContent>
                                                    <p>التحصيل: {topStudents[2].pointsBreakdown.hifz.toFixed(1)}</p>
                                                    <p>المواظبة: {topStudents[2].pointsBreakdown.attendance.toFixed(1)}</p>
                                                    <p>السلوك: {topStudents[2].pointsBreakdown.behavior.toFixed(1)}</p>
                                                    {topStudents[2].pointsBreakdown.bonus !== 0 && (
                                                        <p className={cn("font-bold", topStudents[2].pointsBreakdown.bonus > 0 ? "text-purple-600" : "text-red-600")}>
                                                            {topStudents[2].pointsBreakdown.bonus > 0 ? "البونص: +" : "الخصم السلوكي: "}
                                                            {topStudents[2].pointsBreakdown.bonus.toFixed(1)}
                                                        </p>
                                                    )}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>شارات التكريم الخاصة</CardTitle>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-3 gap-4">
                                {specialBadges.mostExcellent && specialBadges.mostExcellent.stats.excellent > 0 && (
                                    <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center gap-3">
                                        <BookOpenCheck className="h-8 w-8 text-green-600" />
                                        <div>
                                            <p className="font-bold text-green-800 dark:text-green-200">الأكثر تميزًا في الحفظ</p>
                                            <p>{specialBadges.mostExcellent.name} ({specialBadges.mostExcellent.stats.excellent} مرات)</p>
                                        </div>
                                    </div>
                                )}
                                {specialBadges.mostCalm && specialBadges.mostCalm.stats.calm > 0 && (
                                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center gap-3">
                                        <ShieldCheck className="h-8 w-8 text-blue-600" />
                                        <div>
                                            <p className="font-bold text-blue-800 dark:text-blue-200">الأكثر انضباطًا وهدوءًا</p>
                                            <p>{specialBadges.mostCalm.name} ({specialBadges.mostCalm.stats.calm} مرات)</p>
                                        </div>
                                    </div>
                                )}
                                {specialBadges.mostReviewed && specialBadges.mostReviewed.stats.reviewed > 0 && (
                                    <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center gap-3">
                                        <UserCheck className="h-8 w-8 text-purple-600" />
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
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>الترتيب</TableHead>
                                                <TableHead>الاسم</TableHead>
                                                <TableHead>الحالة</TableHead>
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

                                                const isExpelled = student.status === 'مطرود';

                                                return (
                                                    <TableRow key={student.id} className={cn(medalClass, isExpelled && 'opacity-50 line-through')}>
                                                        <TableCell className="font-bold text-lg">{isExpelled ? '-' : index + 1}</TableCell>
                                                        <TableCell className="font-medium">{student.name}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={isExpelled ? 'destructive' : 'default'}>{student.status}</Badge>
                                                        </TableCell>
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
                                                        <TableCell className="text-center">
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <Badge variant="default" className="text-base cursor-help">{student.points.toFixed(1)}</Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <div className="text-xs space-y-1 text-right" dir="rtl">
                                                                        <p>📚 التحصيل: {student.pointsBreakdown.hifz.toFixed(1)}ن</p>
                                                                        <p>🎯 المواظبة: {student.pointsBreakdown.attendance.toFixed(1)}ن</p>
                                                                        <p>🤝 السلوك: {student.pointsBreakdown.behavior.toFixed(1)}ن</p>
                                                                        {student.pointsBreakdown.bonus !== 0 && (
                                                                            <p className={cn("font-bold", student.pointsBreakdown.bonus > 0 ? "text-purple-650" : "text-red-600")}>
                                                                                {student.pointsBreakdown.bonus > 0 ? "⭐ البونص: +" : "⚠️ الخصم السلوكي: "}
                                                                                {student.pointsBreakdown.bonus.toFixed(1)}ن
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
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








