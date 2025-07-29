
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStudentContext } from '@/context/StudentContext';
import { surahs as allSurahs } from '@/lib/surahs';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, CheckCircle, Award } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';


export default function SurahProgressPage() {
    const { students, surahProgress, toggleSurahStatus, loading } = useStudentContext();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');

    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const selectedStudent = useMemo(() => {
        return activeStudents.find(s => s.id === selectedStudentId);
    }, [activeStudents, selectedStudentId]);

    const studentProgress = useMemo(() => {
        if (!selectedStudentId) return [];
        return surahProgress[selectedStudentId] || [];
    }, [surahProgress, selectedStudentId]);

    const progressPercentage = useMemo(() => {
        if (studentProgress.length === 0) return 0;
        return (studentProgress.length / allSurahs.length) * 100;
    }, [studentProgress]);
    
    const leaderboard = useMemo(() => {
        return activeStudents.map(student => ({
            ...student,
            savedCount: surahProgress[student.id]?.length || 0
        })).sort((a,b) => b.savedCount - a.savedCount);
    }, [activeStudents, surahProgress]);

    const handleSurahClick = (surahId: number) => {
        if (!selectedStudentId) return;
        toggleSurahStatus(selectedStudentId, surahId);
    };
    
    React.useEffect(() => {
        if(activeStudents.length > 0 && !selectedStudentId) {
            setSelectedStudentId(activeStudents[0].id);
        }
    }, [activeStudents, selectedStudentId]);


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
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض بياناتهم</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold">📖 متابعة حفظ السور</CardTitle>
                    <CardDescription>
                        حدد طالبًا لعرض وتحديث السور التي حفظها. اضغط على السورة لتبديل حالتها بين "محفوظة" و "غير محفوظة".
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="max-w-md">
                         <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                            <SelectTrigger>
                                <SelectValue placeholder="اختر طالبًا..." />
                            </SelectTrigger>
                            <SelectContent>
                                {activeStudents.map(student => (
                                    <SelectItem key={student.id} value={student.id}>
                                        {student.fullName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {selectedStudent && (
                 <Card>
                    <CardHeader>
                        <CardTitle>معدل تقدم: {selectedStudent.fullName}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                             <Progress value={progressPercentage} />
                             <p className="text-sm text-muted-foreground">
                                {studentProgress.length} من {allSurahs.length} سورة ({progressPercentage.toFixed(1)}%)
                             </p>
                        </div>
                    </CardContent>
                </Card>
            )}
            
            <div className="grid md:grid-cols-3 gap-6">
                 <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>قائمة السور الكاملة</CardTitle>
                         <CardDescription>انقر على اسم السورة لتغيير حالة حفظها للطالب المحدد.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {allSurahs.map(surah => {
                                const isSaved = studentProgress.includes(surah.id);
                                return (
                                    <Button
                                        key={surah.id}
                                        variant={isSaved ? "default" : "outline"}
                                        onClick={() => handleSurahClick(surah.id)}
                                        disabled={!selectedStudentId}
                                        className="h-auto justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            {isSaved && <CheckCircle className="h-4 w-4" />}
                                            <span>{surah.id}. {surah.name}</span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">{surah.verses}</span>
                                    </Button>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>🏆 لوحة شرف الحفظ</CardTitle>
                        <CardDescription>ترتيب الطلبة حسب عدد السور المحفوظة.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>الترتيب</TableHead>
                                    <TableHead>الطالب</TableHead>
                                    <TableHead>السور</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {leaderboard.map((student, index) => (
                                <TableRow key={student.id}>
                                    <TableCell className="font-bold">{index + 1}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span>{student.fullName}</span>
                                            {student.savedCount === 114 && 
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger>
                                                             <Award className="h-5 w-5 text-yellow-500" />
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>🎉 خاتم للقرآن الكريم</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            }
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="w-8">{student.savedCount}</span>
                                            <Progress value={(student.savedCount / allSurahs.length) * 100} className="w-20"/>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}

