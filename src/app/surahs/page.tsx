

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStudentContext } from '@/context/StudentContext';
import { surahs as allSurahs } from '@/lib/surahs';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, CheckCircle, Award, Check } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';


export default function SurahProgressPage() {
    const { students, surahProgress, toggleSurahStatus, loading } = useStudentContext();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');

    const studentsToShow = useMemo(() => (students ?? []).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')), [students]);

    const selectedStudent = useMemo(() => {
        return studentsToShow.find(s => s.id === selectedStudentId);
    }, [studentsToShow, selectedStudentId]);

    const studentProgress = useMemo(() => {
        if (!selectedStudentId || !surahProgress) return {};
        return surahProgress[selectedStudentId] || {};
    }, [surahProgress, selectedStudentId]);

    const progressCounts = useMemo(() => {
        const memorized = Object.values(studentProgress).filter(s => s.status === 1).length;
        const mastered = Object.values(studentProgress).filter(s => s.status === 2).length;
        return { memorized, mastered, total: memorized + mastered };
    }, [studentProgress]);

    const progressPercentage = useMemo(() => {
        if (progressCounts.total === 0) return { memorized: 0, mastered: 0 };
        const total = allSurahs.length;
        return {
            memorized: (progressCounts.memorized / total) * 100,
            mastered: (progressCounts.mastered / total) * 100
        };
    }, [progressCounts]);

    const leaderboard = useMemo(() => {
        return studentsToShow.map(student => {
            const progress = surahProgress ? (surahProgress[student.id] || {}) : {};
            const memorizedCount = Object.values(progress).filter(entry => entry.status === 1).length;
            const masteredCount = Object.values(progress).filter(entry => entry.status === 2).length;
            const masteryScore = (memorizedCount * 1) + (masteredCount * 3);

            return {
                ...student,
                masteryScore,
                memorizedCount,
                masteredCount
            }
        }).sort((a, b) => b.masteryScore - a.masteryScore);
    }, [studentsToShow, surahProgress]);


    const handleSurahClick = (surahId: number) => {
        if (!selectedStudent) return;
        toggleSurahStatus(selectedStudent.id, surahId);
    };

    React.useEffect(() => {
        if (studentsToShow.length > 0 && !selectedStudentId) {
            const firstActive = studentsToShow.find(s => s.status === 'نشط');
            setSelectedStudentId(firstActive ? firstActive.id : studentsToShow[0].id);
        }
    }, [studentsToShow, selectedStudentId]);


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (studentsToShow.length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض بياناتهم</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }


    return (
        <TooltipProvider>
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-3xl font-headline font-bold">متابعة الحفظ والإتقان</CardTitle>
                        <CardDescription>
                            حدد طالبًا، ثم انقر على السورة لتغيير حالتها: <span className="p-1 rounded-md bg-gray-200">غير محفوظة</span> &larr; <span className="p-1 rounded-md bg-green-200 text-green-800">محفوظة</span> &larr; <span className="p-1 rounded-md bg-green-600 text-white">متقنة</span>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                            <div className="max-w-md">
                                <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="اختر طالبًا..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {studentsToShow.map(student => (
                                            <SelectItem key={student.id} value={student.id}>
                                                {student.fullName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selectedStudent && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>تقدم الطالب: {selectedStudent.fullName}</span>
                                        <span className="text-muted-foreground">{progressCounts.total} من {allSurahs.length} سورة</span>
                                    </div>
                                    <Tooltip>
                                        <TooltipTrigger className="w-full">
                                            <Progress className="h-3 w-full">
                                                <Progress value={progressPercentage.mastered + progressPercentage.memorized} className="bg-green-300" />
                                                <Progress value={progressPercentage.mastered} className="bg-green-600 -mt-3" />
                                            </Progress>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>المجموع: {progressCounts.total} ({((progressCounts.total / allSurahs.length) * 100).toFixed(1)}%)</p>
                                            <p className="text-green-800">محفوظ: {progressCounts.memorized}</p>
                                            <p className="text-green-600 font-bold">متقن: {progressCounts.mastered}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid md:grid-cols-3 gap-6">
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle>لوحة شرف الحفظ</CardTitle>
                            <CardDescription>الترتيب حسب نقاط الإتقان: (المحفوظ * 1) + (المتقن * 3)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>الترتيب</TableHead>
                                            <TableHead>الطالب</TableHead>
                                            <TableHead>النقاط</TableHead>
                                            <TableHead>الحالة</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {leaderboard.map((student, index) => {
                                            const rank = index + 1;
                                            let rankClass = "";
                                            if (student.status === 'نشط') {
                                                if (rank === 1) rankClass = "bg-yellow-100 dark:bg-yellow-900/50 hover:bg-yellow-100/80";
                                                else if (rank === 2) rankClass = "bg-gray-200 dark:bg-gray-700/50 hover:bg-gray-200/80";
                                                else if (rank === 3) rankClass = "bg-orange-100 dark:bg-orange-900/50 hover:bg-orange-100/80";
                                            }

                                            const totalSurahs = student.memorizedCount + student.masteredCount;
                                            const memorizedPercent = (student.memorizedCount / allSurahs.length) * 100;
                                            const masteredPercent = (student.masteredCount / allSurahs.length) * 100;

                                            return (
                                                <TableRow key={student.id} className={cn(rankClass, student.status === 'مطرود' && 'opacity-50')}>
                                                    <TableCell className="font-bold text-lg">
                                                        {student.status === 'نشط' ? (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank) : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span>{student.fullName}</span>
                                                                {totalSurahs === 114 &&
                                                                    <Tooltip>
                                                                        <TooltipTrigger>
                                                                            <Award className="h-5 w-5 text-yellow-500" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>خاتم للقرآن الكريم</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                }
                                                            </div>
                                                            <Tooltip>
                                                                <TooltipTrigger>
                                                                    <Progress className="h-2 w-28 mt-1">
                                                                        <Progress value={masteredPercent + memorizedPercent} className="bg-green-300" />
                                                                        <Progress value={masteredPercent} className="bg-green-600 -mt-2" />
                                                                    </Progress>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>محفوظ: {student.memorizedCount}</p>
                                                                    <p>متقن: {student.masteredCount}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold">
                                                        {student.status === 'نشط' ? student.masteryScore : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={student.status === 'مطرود' ? 'destructive' : 'default'}>{student.status}</Badge>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>خريطة المصحف</CardTitle>
                            <CardDescription>
                                انقر على اسم السورة لتغيير حالة حفظها للطالب المحدد.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                                {allSurahs.map(surah => {
                                    const status = studentProgress[surah.id]?.status || 0;
                                    let buttonClass = "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200";
                                    if (status === 1) buttonClass = "bg-green-200 hover:bg-green-300 text-green-800 dark:bg-green-800 dark:hover:bg-green-700 dark:text-green-100";
                                    if (status === 2) buttonClass = "bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-500";

                                    return (
                                        <Tooltip key={surah.id}>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleSurahClick(surah.id)}
                                                    disabled={!selectedStudentId || selectedStudent?.status === 'مطرود'}
                                                    className={cn("h-auto justify-between transition-colors duration-300", buttonClass)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {status === 1 && <Check className="h-4 w-4" />}
                                                        {status === 2 && <CheckCircle className="h-4 w-4" />}
                                                        <span>{surah.id}. {surah.name}</span>
                                                    </div>
                                                    <span className="text-xs opacity-70">{surah.verses}</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>
                                                    {surah.name} - {status === 0 ? "غير محفوظة" : status === 1 ? "محفوظة" : "متقنة"}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TooltipProvider>
    );
}
