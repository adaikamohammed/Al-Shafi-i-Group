

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { surahs as allSurahs } from '@/lib/surahs';
import { cn, arabicCompare } from '@/lib/utils';
import { Loader2, AlertTriangle, CheckCircle, Award, Check, Layers, Users, X, BookOpen, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { SurahStatsChart } from '@/components/profile/SurahStatsChart';
import { GroupComparisonCard } from '@/components/management/GroupComparisonCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ManagementSurahsView } from '@/components/management/ManagementSurahsView';
import { SurahEvaluationStatsChart } from '@/components/profile/SurahEvaluationStatsChart';
import { SurahEvaluationView } from '@/components/management/SurahEvaluationView';


export default function SurahProgressPage() {
    const { students, dailySessions, surahProgress, toggleSurahStatus, bulkUpdateSurahStatus, setSurahEvaluation, migrateSurahDataToEvaluationSystem, loading } = useStudentContext();
    const { isManagement, isSuperAdmin, role } = useAuth();
    const { toast } = useToast();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [selectedSurahIds, setSelectedSurahIds] = useState<number[]>([]);
    const [isApplying, setIsApplying] = useState(false);
    const [selectedGroupForDetails, setSelectedGroupForDetails] = useState<string | null>(null);
    const [evaluationDialogOpen, setEvaluationDialogOpen] = useState(false);
    const [selectedSurahForEvaluation, setSelectedSurahForEvaluation] = useState<number | null>(null);
    const [viewMode, setViewMode] = useState<'student' | 'surah'>('student');

    const studentsToShow = useMemo(() => (students ?? []).sort((a, b) => arabicCompare(a.fullName, b.fullName)), [students]);
    const studentOptions: SearchableSelectOption[] = useMemo(() => studentsToShow.map(s => ({ value: s.id, label: s.fullName })), [studentsToShow]);

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

            // New 6-tier scoring weights
            const weights: Record<string, number> = {
                'ممتاز': 50,
                'جيد جداً': 40,
                'جيد': 30,
                'حسن': 20,
                'متوسط': 10,
                'لم يحفظ': 0
            };

            const masteryScore = Object.values(progress).reduce((sum, entry) => {
                const evalValue = entry.evaluation || (entry.status === 2 ? 'ممتاز' : entry.status === 1 ? 'جيد' : 'لم يحفظ');
                return sum + (weights[evalValue] || 0);
            }, 0);

            const memorizedCount = Object.values(progress).filter(entry => entry.status > 0).length;
            const masteredCount = Object.values(progress).filter(entry => entry.status === 2 || entry.evaluation === 'ممتاز').length;

            return {
                ...student,
                masteryScore,
                memorizedCount,
                masteredCount
            }
        }).sort((a, b) => b.masteryScore - a.masteryScore);
    }, [studentsToShow, surahProgress]);

    // Group statistics for management view
    const groupStats = useMemo(() => {
        if (!isManagement && !isSuperAdmin) return [];

        const groups = studentsToShow.reduce((acc, student) => {
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
            if (student.status === 'نشط') {
                acc[groupName].activeStudents++;
            }
            return acc;
        }, {} as Record<string, any>);

        return Object.values(groups).map((group: any) => {
            const groupProgress = group.students.map((student: any) => {
                const progress = surahProgress ? (surahProgress[student.id] || {}) : {};
                const memorizedCount = Object.values(progress).filter((entry: any) => entry.status === 1).length;
                const masteredCount = Object.values(progress).filter((entry: any) => entry.status === 2).length;
                const masteryScore = (memorizedCount * 1) + (masteredCount * 3);
                return {
                    ...student,
                    memorizedCount,
                    masteredCount,
                    masteryScore,
                };
            });

            const activeGroupProgress = groupProgress.filter((s: any) => s.status === 'نشط');
            const averageMasteryScore = activeGroupProgress.length > 0
                ? activeGroupProgress.reduce((sum: number, s: any) => sum + s.masteryScore, 0) / activeGroupProgress.length
                : 0;

            const totalMemorized = groupProgress.reduce((sum: number, s: any) => sum + s.memorizedCount, 0);
            const totalMastered = groupProgress.reduce((sum: number, s: any) => sum + s.masteredCount, 0);
            const totalSurahs = groupProgress.reduce((sum: number, s: any) => sum + s.memorizedCount + s.masteredCount, 0);
            const progressPercentage = (totalSurahs / (allSurahs.length * group.totalStudents)) * 100;

            const topStudents = groupProgress
                .sort((a: any, b: any) => b.masteryScore - a.masteryScore)
                .slice(0, 3)
                .map((s: any) => ({ name: s.fullName, score: s.masteryScore }));

            return {
                groupName: group.groupName,
                sheikhName: group.sheikhName,
                totalStudents: group.totalStudents,
                activeStudents: group.activeStudents,
                averageMasteryScore,
                totalMemorized,
                totalMastered,
                progressPercentage,
                topStudents,
                students: groupProgress,
            };
        }).sort((a, b) => b.averageMasteryScore - a.averageMasteryScore);
    }, [studentsToShow, surahProgress, isManagement, isSuperAdmin]);


    const handleSurahClick = (surahId: number) => {
        if (isBulkMode) {
            setSelectedSurahIds(prev =>
                prev.includes(surahId)
                    ? prev.filter(id => id !== surahId)
                    : [...prev, surahId]
            );
            return;
        }

        if (viewMode === 'surah') {
            setSelectedSurahForEvaluation(surahId);
            return;
        }

        if (!selectedStudent) return;

        // Open evaluation dialog instead of toggling for all users
        if (isManagement) {
            setSelectedSurahForEvaluation(surahId);
            setEvaluationDialogOpen(true);
            return;
        }

        toggleSurahStatus(selectedStudent.id, surahId);
    };

    const handleApplyBulkStatus = async (status: 0 | 1 | 2) => {
        if (selectedStudentIds.length === 0 || selectedSurahIds.length === 0) {
            toast({
                title: "تنبيه",
                description: "يرجى اختيار طالب واحد على الأقل وسورة واحدة على الأقل.",
                variant: "destructive"
            });
            return;
        }

        setIsApplying(true);
        try {
            await bulkUpdateSurahStatus(selectedStudentIds, selectedSurahIds, status);
            setSelectedSurahIds([]);
            toast({
                title: "تم بنجاح",
                description: `تم تحديث حالة ${selectedSurahIds.length} سورة لـ ${selectedStudentIds.length} طلاب.`
            });
        } catch (error) {
            console.error("Bulk update error:", error);
        } finally {
            setIsApplying(false);
        }
    };

    const selectJuz = (juzNumber: number) => {
        // Juz definition (Surah ranges)
        const juzSurahs: Record<number, number[]> = {
            30: Array.from({ length: 114 - 78 + 1 }, (_, i) => 78 + i),
            29: Array.from({ length: 77 - 67 + 1 }, (_, i) => 67 + i),
            28: Array.from({ length: 66 - 58 + 1 }, (_, i) => 58 + i),
            27: Array.from({ length: 57 - 51 + 1 }, (_, i) => 51 + i),
            26: Array.from({ length: 50 - 46 + 1 }, (_, i) => 46 + i),
            25: Array.from({ length: 45 - 42 + 1 }, (_, i) => 42 + i),
            24: Array.from({ length: 41 - 39 + 1 }, (_, i) => 39 + i),
            23: Array.from({ length: 38 - 36 + 1 }, (_, i) => 36 + i),
        };

        if (juzSurahs[juzNumber]) {
            const surahsInJuz = juzSurahs[juzNumber];
            setSelectedSurahIds(prev => {
                const newSelection = new Set([...prev, ...surahsInJuz]);
                return Array.from(newSelection);
            });
        }
    };

    const { user } = useAuth();
    const handleEvaluation = (evaluation: import('@/lib/types').SurahEvaluation) => {
        if (selectedStudentId && selectedSurahForEvaluation) {
            setSurahEvaluation(selectedStudentId, selectedSurahForEvaluation, evaluation);
        }
    };

    const lastSessionProgress = useMemo(() => {
        if (!selectedStudentId || !dailySessions) return null;

        // Find the latest session for this student that has surah data
        const studentRecords = Object.values(dailySessions as Record<string, any>)
            .flatMap(day => Object.values(day as Record<string, any>))
            .filter((s: any) => s.records && s.records.some((r: any) => r.studentId === selectedStudentId && r.surahId))
            .sort((a: any, b: any) => (b.date || '').localeCompare(a.date || ''));

        if (studentRecords.length === 0) return null;

        const latestSession: any = studentRecords[0];
        const record = latestSession.records.find((r: any) => r.studentId === selectedStudentId && r.surahId);
        const surah = record ? allSurahs.find(s => s.id === record.surahId) : null;

        return record && surah ? { ...record, surahName: surah.name, date: latestSession.date } : null;
    }, [dailySessions, selectedStudentId]);

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
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-3xl font-headline font-bold">متابعة الحفظ والإتقان</CardTitle>
                                <CardDescription className="flex flex-wrap items-center gap-2 mt-2">
                                    <span>التقييمات:</span>
                                    <Badge variant="secondary" className="bg-emerald-600 text-white hover:bg-emerald-600">ممتاز</Badge>
                                    <Badge variant="secondary" className="bg-emerald-500 text-white hover:bg-emerald-500">جيد جداً</Badge>
                                    <Badge variant="secondary" className="bg-teal-500 text-white hover:bg-teal-500">جيد</Badge>
                                    <Badge variant="secondary" className="bg-cyan-500 text-white hover:bg-cyan-500">حسن</Badge>
                                    <Badge variant="secondary" className="bg-orange-400 text-white hover:bg-orange-400">متوسط</Badge>
                                    <Badge variant="secondary" className="bg-red-500 text-white hover:bg-red-500">لم يحفظ</Badge>
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                {(isManagement || isSuperAdmin || role === 'sheikh') && (
                                    <div className="flex bg-muted p-1 rounded-lg">
                                        <Button
                                            variant={viewMode === 'student' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewMode('student')}
                                            className="text-xs"
                                        >
                                            تقييم طالب
                                        </Button>
                                        <Button
                                            variant={viewMode === 'surah' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewMode('surah')}
                                            className="text-xs"
                                        >
                                            تقييم سورة
                                        </Button>
                                    </div>
                                )}
                                {isSuperAdmin && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={migrateSurahDataToEvaluationSystem}
                                        className="text-xs hover:bg-orange-50 border-orange-200 text-orange-700"
                                    >
                                        <Layers className="h-4 w-4 ml-1" />
                                        تحديث نظام التقييم
                                    </Button>
                                )}
                                <Button
                                    variant={isBulkMode ? "destructive" : "default"}
                                    onClick={() => {
                                        setIsBulkMode(!isBulkMode);
                                        if (!isBulkMode) {
                                            setSelectedStudentIds(selectedStudentId ? [selectedStudentId] : []);
                                            setSelectedSurahIds([]);
                                        }
                                    }}
                                    className="flex items-center gap-2"
                                >
                                    {isBulkMode ? <X className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                                    {isBulkMode ? "إلغاء التحديث الجماعي" : "وضع التحديث الجماعي"}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {(isManagement || isSuperAdmin || role === 'sheikh') && viewMode === 'surah' ? (
                            <SurahEvaluationView
                                students={students}
                                surahProgress={surahProgress || {}}
                                onUpdateEvaluation={setSurahEvaluation}
                                externalSurahId={selectedSurahForEvaluation}
                                onSurahChange={setSelectedSurahForEvaluation}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                <div className="flex flex-col gap-4">
                                    {!isBulkMode ? (
                                        <>
                                            <div className="max-w-md">
                                                <SearchableSelect
                                                    options={studentOptions}
                                                    value={selectedStudentId}
                                                    onValueChange={setSelectedStudentId}
                                                    placeholder="اختر طالبًا..."
                                                    searchPlaceholder="ابحث عن طالب..."
                                                />
                                            </div>

                                            {lastSessionProgress && (
                                                <div className="bg-primary/5 p-3 rounded-xl border border-primary/10 animate-in fade-in slide-in-from-right-4 duration-500">
                                                    <div className="flex items-center gap-2 text-primary font-bold mb-1">
                                                        <Award className="h-4 w-4" />
                                                        <span className="text-sm font-headline">آخر ما تم تسجيله:</span>
                                                    </div>
                                                    <div className="text-sm font-body">
                                                        سورة <span className="font-bold underlineDecoration-primary">{lastSessionProgress?.surahName}</span>
                                                        {lastSessionProgress?.fromVerse && lastSessionProgress?.toVerse && (
                                                            <> (من الآية <span className="font-bold">{lastSessionProgress?.fromVerse}</span> إلى <span className="font-bold">{lastSessionProgress?.toVerse}</span>)</>
                                                        )}
                                                        <span className="text-xs text-muted-foreground mr-2 opacity-70">
                                                            - بتاريخ {lastSessionProgress?.date}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="font-bold flex items-center gap-2">
                                                    <Users className="h-4 w-4" />
                                                    تحديد الطلاب ({selectedStudentIds.length})
                                                </h3>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedStudentIds(
                                                        selectedStudentIds.length === studentsToShow.length
                                                            ? []
                                                            : studentsToShow.map(s => s.id)
                                                    )}
                                                >
                                                    {selectedStudentIds.length === studentsToShow.length ? "إلغاء الكل" : "تحديد الكل"}
                                                </Button>
                                            </div>
                                            <Card className="p-0 overflow-hidden border-primary/20">
                                                <ScrollArea className="h-[200px] w-full p-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {studentsToShow.map(student => (
                                                            <div key={student.id} className="flex items-center space-x-2 space-x-reverse">
                                                                <Checkbox
                                                                    id={`student-${student.id}`}
                                                                    checked={selectedStudentIds.includes(student.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        setSelectedStudentIds(prev =>
                                                                            checked
                                                                                ? [...prev, student.id]
                                                                                : prev.filter(id => id !== student.id)
                                                                        );
                                                                    }}
                                                                />
                                                                <label
                                                                    htmlFor={`student-${student.id}`}
                                                                    className="text-sm font-medium leading-none cursor-pointer select-none"
                                                                >
                                                                    {student.fullName}
                                                                </label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </Card>
                                        </div>
                                    )}
                                </div>

                                {!isBulkMode ? (
                                    selectedStudent && (
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm font-medium">
                                                <span>تقدم الطالب: {selectedStudent?.fullName}</span>
                                                <span className="text-muted-foreground">{progressCounts.total} من {allSurahs.length} سورة</span>
                                            </div>
                                            <Tooltip>
                                                <TooltipTrigger className="w-full">
                                                    <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                        <div
                                                            className="absolute top-0 right-0 h-full bg-emerald-300 transition-all duration-500"
                                                            style={{ width: `${progressPercentage.mastered + progressPercentage.memorized}%` }}
                                                        />
                                                        <div
                                                            className="absolute top-0 right-0 h-full bg-emerald-700 transition-all duration-500"
                                                            style={{ width: `${progressPercentage.mastered}%` }}
                                                        />
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>المجموع: {progressCounts.total} ({((progressCounts.total / allSurahs.length) * 100).toFixed(1)}%)</p>
                                                    <p className="text-green-800">محفوظ: {progressCounts.memorized}</p>
                                                    <p className="text-green-600 font-bold">متقن: {progressCounts.mastered}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    )
                                ) : (
                                    <div className="space-y-4">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <BookOpen className="h-4 w-4" />
                                            أدوات اختيار السور ({selectedSurahIds.length})
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            <Button size="sm" variant="outline" onClick={() => selectJuz(30)}>جزء عم (30)</Button>
                                            <Button size="sm" variant="outline" onClick={() => selectJuz(29)}>جزء تبارك (29)</Button>
                                            <Button size="sm" variant="outline" onClick={() => selectJuz(28)}>جزء قد سمع (28)</Button>
                                            <Button size="sm" variant="outline" onClick={() => selectJuz(27)}>جزء الذاريات (27)</Button>
                                            <Button size="sm" variant="outline" onClick={() => selectJuz(26)}>جزء الاحقاف (26)</Button>
                                            <Button size="sm" variant="outline" onClick={() => setSelectedSurahIds(allSurahs.map(s => s.id))}>تحديد المصحف كاملاً</Button>
                                            <Button size="sm" variant="ghost" className="text-destructive h-[36px]" onClick={() => setSelectedSurahIds([])}>
                                                <Trash2 className="h-4 w-4 ml-1" />
                                                مسح الاختيار
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            يمكنك أيضاً تحديد السور يدوياً من "خريطة المصحف" أدناه.
                                        </p>
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                className="flex-1 bg-green-200 text-green-800 hover:bg-green-300 border-none"
                                                onClick={() => handleApplyBulkStatus(1)}
                                                disabled={isApplying || selectedStudentIds.length === 0 || selectedSurahIds.length === 0}
                                            >
                                                {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "ضبط كمحفوظ"}
                                            </Button>
                                            <Button
                                                className="flex-1 bg-green-600 text-white hover:bg-green-700 border-none"
                                                onClick={() => handleApplyBulkStatus(2)}
                                                disabled={isApplying || selectedStudentIds.length === 0 || selectedSurahIds.length === 0}
                                            >
                                                {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "ضبط كمتقن"}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                                                onClick={() => handleApplyBulkStatus(0)}
                                                disabled={isApplying || selectedStudentIds.length === 0 || selectedSurahIds.length === 0}
                                            >
                                                {isApplying ? <Loader2 className="h-4 w-4 animate-spin" /> : "إلغاء الحفظ"}
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Management Group Comparison View */}
                {(isManagement || isSuperAdmin) && <ManagementSurahsView groupStats={groupStats} />}

                <div className="grid md:grid-cols-3 gap-6">
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle>لوحة شرف الحفظ</CardTitle>
                            <CardDescription>الترتيب حسب نقاط الإتقان: (المحفوظ * 1) + (المتقن * 3)</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            <div className="overflow-x-auto w-full">
                                <Table className="min-w-[400px] sm:min-w-full">
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
                        <CardContent className="p-3 sm:p-6">
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(75px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1.5 sm:gap-3">
                                {allSurahs.map(surah => {
                                    const entry = studentProgress[surah.id];
                                    const status = isBulkMode ? (selectedSurahIds.includes(surah.id) ? 1 : 0) : (entry?.status || 0);
                                    let buttonClass = "bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200";

                                    if (!isBulkMode) {
                                        const evaluation = entry?.evaluation || (entry?.status === 2 ? 'ممتاز' : entry?.status === 1 ? 'جيد' : 'لم يحفظ');
                                        if (evaluation === 'ممتاز') buttonClass = "bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md ring-1 ring-emerald-400/40";
                                        else if (evaluation === 'جيد جداً') buttonClass = "bg-gradient-to-br from-emerald-400 to-emerald-600 hover:from-emerald-500 hover:to-emerald-700 text-white shadow-sm";
                                        else if (evaluation === 'جيد') buttonClass = "bg-gradient-to-br from-teal-400 to-teal-600 hover:from-teal-500 hover:to-teal-700 text-white";
                                        else if (evaluation === 'حسن') buttonClass = "bg-gradient-to-br from-cyan-400 to-cyan-600 hover:from-cyan-500 hover:to-cyan-700 text-white";
                                        else if (evaluation === 'متوسط') buttonClass = "bg-gradient-to-br from-orange-300 to-orange-500 hover:from-orange-400 hover:to-orange-600 text-white";
                                        else if (evaluation === 'لم يحفظ') buttonClass = "bg-gradient-to-br from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-inner";
                                        else buttonClass = "bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 text-slate-400";
                                    } else {
                                        if (selectedSurahIds.includes(surah.id)) buttonClass = "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg ring-2 ring-primary ring-offset-2";
                                    }

                                    return (
                                        <Tooltip key={surah.id}>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => handleSurahClick(surah.id)}
                                                    disabled={!isBulkMode && (!selectedStudentId || selectedStudent?.status === 'مطرود')}
                                                    className={cn("h-auto justify-between transition-all duration-200 px-1.5 py-1 sm:px-3 sm:py-2", buttonClass, isBulkMode && selectedSurahIds.includes(surah.id) && "ring-2 ring-primary ring-offset-2 scale-105")}
                                                >
                                                    <div className="flex items-center gap-1.5 overflow-hidden w-full justify-center sm:justify-start">
                                                        {!isBulkMode ? (
                                                            <div className="flex flex-col items-center sm:items-start overflow-hidden leading-tight">
                                                                <span className="text-[9px] sm:text-[10px] font-bold truncate max-w-full">
                                                                    {entry?.evaluation || (entry?.status === 2 ? 'ممتاز' : entry?.status === 1 ? 'جيد' : "")}
                                                                </span>
                                                                <span className="truncate text-[8px] xs:text-[9px] sm:text-[11px] font-medium opacity-90 max-w-full">
                                                                    {`${surah.id}. ${surah.name}`}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {selectedSurahIds.includes(surah.id) && <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />}
                                                                <span className="truncate text-[8px] xs:text-[9px] sm:text-xs font-medium">
                                                                    {`${surah.id}. ${surah.name}`}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <span className="text-[8px] sm:text-[10px] opacity-70 shrink-0 hidden xs:inline">{surah.verses}</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>
                                                    {surah.name} - {isBulkMode ? (selectedSurahIds.includes(surah.id) ? "منتقاة للتعديل" : "غير منتقاة") : (entry?.evaluation || "غير محفوظة")}
                                                </p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="w-full">
                    <SurahEvaluationStatsChart students={students} surahProgress={surahProgress || {}} />
                </div>
            </div >

            {/* Evaluation Dialog */}
            < Dialog open={evaluationDialogOpen} onOpenChange={setEvaluationDialogOpen} >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>تقييم السورة</DialogTitle>
                        <DialogDescription>
                            يرجى اختيار تقييم الطالب للسورة المحددة.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-3 py-4">
                        <Button
                            onClick={() => handleEvaluation('ممتاز')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-lg"
                        >
                            ممتاز
                        </Button>
                        <Button
                            onClick={() => handleEvaluation('جيد جداً')}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white h-12 text-lg"
                        >
                            جيد جداً
                        </Button>
                        <Button
                            onClick={() => handleEvaluation('جيد')}
                            className="bg-teal-500 hover:bg-teal-600 text-white h-12 text-lg"
                        >
                            جيد
                        </Button>
                        <Button
                            onClick={() => handleEvaluation('حسن')}
                            className="bg-cyan-500 hover:bg-cyan-600 text-white h-12 text-lg"
                        >
                            حسن
                        </Button>
                        <Button
                            onClick={() => handleEvaluation('متوسط')}
                            className="bg-orange-400 hover:bg-orange-500 text-white h-12 text-lg"
                        >
                            متوسط
                        </Button>
                        <Button
                            onClick={() => handleEvaluation('لم يحفظ')}
                            className="bg-red-500 hover:bg-red-600 text-white h-12 text-lg"
                        >
                            لم يحفظ
                        </Button>
                    </div>
                </DialogContent>
            </Dialog >
        </TooltipProvider >
    );
}
