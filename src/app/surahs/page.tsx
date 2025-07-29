
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useStudentContext } from '@/context/StudentContext';
import { surahs as allSurahs } from '@/lib/surahs';
import { cn } from '@/lib/utils';
import { Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { Student } from '@/lib/types';

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

    const handleSurahClick = (surahId: number) => {
        if (!selectedStudentId) return;
        toggleSurahStatus(selectedStudentId, surahId);
    };
    
    // Set default selected student
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

            <Card>
                <CardHeader>
                    <CardTitle>قائمة السور الكاملة</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
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

        </div>
    );
}

