
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Filter, BookOpen } from 'lucide-react';
import { surahs } from '@/lib/surahs';
import { Admin5SurahEvaluation, SurahMasteryEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Admin5SurahEvaluationViewProps {
    students: any[];
    surahProgress: Record<string, Record<number, SurahMasteryEntry>>;
    onUpdateEvaluation: (studentId: string, surahId: number, evaluation: Admin5SurahEvaluation) => void;
}

export const Admin5SurahEvaluationView: React.FC<Admin5SurahEvaluationViewProps> = ({
    students,
    surahProgress,
    onUpdateEvaluation
}) => {
    const [selectedSurahId, setSelectedSurahId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGroup, setFilterGroup] = useState<string>('all');

    const surahOptions: SearchableSelectOption[] = useMemo(() =>
        surahs.map(s => ({ value: s.id.toString(), label: `${s.id}. ${s.name}` })),
        []);

    const filteredStudents = useMemo(() => {
        let result = students.filter(s => s.status === 'نشط'); // Only active students

        if (filterGroup !== 'all') {
            result = result.filter(s => s.groupName === filterGroup);
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(s => s.fullName.toLowerCase().includes(lowerTerm));
        }

        return result.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
    }, [students, searchTerm, filterGroup]);

    const groups = useMemo(() => {
        const uniqueGroups = Array.from(new Set(students.map(s => s.groupName))).filter(Boolean);
        return uniqueGroups.sort();
    }, [students]);

    const handleEvaluationClick = (studentId: string, evaluation: Admin5SurahEvaluation) => {
        if (!selectedSurahId) return;
        onUpdateEvaluation(studentId, selectedSurahId, evaluation);
    };

    const getEvaluationColor = (evaluation?: Admin5SurahEvaluation) => {
        if (!evaluation) return "bg-gray-100 text-gray-800";
        switch (evaluation) {
            case 'ممتاز': return "bg-emerald-600 text-white";
            case 'جيد جداً': return "bg-emerald-500 text-white";
            case 'جيد': return "bg-teal-500 text-white";
            case 'حسن': return "bg-cyan-500 text-white";
            case 'متوسط': return "bg-orange-400 text-white";
            case 'لم يحفظ': return "bg-red-500 text-white";
            default: return "bg-gray-100 text-gray-800";
        }
    };

    const selectedSurahName = selectedSurahId ? surahs.find(s => s.id === selectedSurahId)?.name : '';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card className="border-2 border-emerald-100/50 shadow-md">
                <CardHeader className="bg-emerald-50/50 pb-8">
                    <CardTitle className="text-2xl font-bold font-headline flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-emerald-600" />
                        نظام التقييم بالسورة
                    </CardTitle>
                    <CardDescription>
                        اختر السورة أولاً، ثم قم بتقييم الطلاب واحداً تلو الآخر لتلك السورة.
                    </CardDescription>

                    <div className="mt-6 max-w-xl">
                        <label className="text-sm font-semibold mb-2 block text-muted-foreground">اختر السورة للبدء:</label>
                        <SearchableSelect
                            options={surahOptions}
                            value={selectedSurahId?.toString() || ''}
                            onValueChange={(val) => setSelectedSurahId(Number(val))}
                            placeholder="ابحث عن اسم السورة..."
                            searchPlaceholder="اكتب اسم السورة..."
                        />
                    </div>
                </CardHeader>
            </Card>

            {selectedSurahId && (
                <Card>
                    <CardHeader>
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <CardTitle>تقييم سورة {selectedSurahName}</CardTitle>
                                <CardDescription>عدد الطلاب: {filteredStudents.length}</CardDescription>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <div className="relative flex-1 md:w-64">
                                    <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="بحث عن طالب..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pr-9"
                                    />
                                </div>
                                <div className="relative w-40">
                                    <select
                                        aria-label="تصفية حسب الفوج"
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={filterGroup}
                                        onChange={(e) => setFilterGroup(e.target.value)}
                                    >
                                        <option value="all">كل الأفواج</option>
                                        {groups.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="text-right w-[200px]">الطالب</TableHead>
                                        <TableHead className="text-right w-[120px]">التقييم الحالي</TableHead>
                                        <TableHead className="text-center">إجراء التقييم</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStudents.map(student => {
                                        const entry = surahProgress[student.id]?.[selectedSurahId];
                                        const currentEval = entry?.admin5Evaluation;

                                        return (
                                            <TableRow key={student.id}>
                                                <TableCell className="font-medium">
                                                    <div>{student.fullName}</div>
                                                    <div className="text-xs text-muted-foreground">{student.groupName}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {currentEval ? (
                                                        <Badge className={cn("hover:none", getEvaluationColor(currentEval))}>
                                                            {currentEval}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                        {(['ممتاز', 'جيد جداً', 'جيد', 'حسن', 'متوسط', 'لم يحفظ'] as Admin5SurahEvaluation[]).map((grade) => (
                                                            <Button
                                                                key={grade}
                                                                size="sm"
                                                                variant={currentEval === grade ? "default" : "outline"}
                                                                className={cn(
                                                                    "text-xs h-8 px-2 min-w-[60px]",
                                                                    currentEval === grade
                                                                        ? getEvaluationColor(grade)
                                                                        : "hover:bg-slate-100 text-slate-600 border-slate-200"
                                                                )}
                                                                onClick={() => handleEvaluationClick(student.id, grade)}
                                                            >
                                                                {grade}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
