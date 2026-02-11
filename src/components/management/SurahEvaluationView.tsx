
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchableSelect, SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Filter, BookOpen, LayoutGrid, List, Users as UsersIcon } from 'lucide-react';
import { surahs } from '@/lib/surahs';
import { SurahEvaluation, SurahMasteryEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SurahEvaluationViewProps {
    students: any[];
    surahProgress: Record<string, Record<number, SurahMasteryEntry>>;
    onUpdateEvaluation: (studentId: string, surahId: number, evaluation: SurahEvaluation) => void;
    externalSurahId?: number | null;
    onSurahChange?: (surahId: number | null) => void;
}

export const SurahEvaluationView: React.FC<SurahEvaluationViewProps> = ({
    students,
    surahProgress,
    onUpdateEvaluation,
    externalSurahId,
    onSurahChange
}) => {
    const [selectedSurahId, setSelectedSurahId] = useState<number | null>(externalSurahId || null);

    // Sync externalSurahId to local state
    React.useEffect(() => {
        if (externalSurahId !== undefined && externalSurahId !== selectedSurahId) {
            setSelectedSurahId(externalSurahId);
        }
    }, [externalSurahId]);

    const handleSurahSelect = (id: number | null) => {
        setSelectedSurahId(id);
        if (onSurahChange) onSurahChange(id);
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGroup, setFilterGroup] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'evaluated' | 'not_evaluated'>('all');
    const [activeTab, setActiveTab] = useState<'table' | 'distribution'>('table');

    const surahOptions: SearchableSelectOption[] = useMemo(() =>
        surahs.map(s => ({ value: s.id.toString(), label: `${s.id}. ${s.name}` })),
        []);

    const filteredStudents = useMemo(() => {
        let result = students.filter(s => s.status === 'نشط'); // Only active students

        if (filterGroup !== 'all') {
            result = result.filter(s => s.groupName === filterGroup);
        }

        if (filterStatus !== 'all') {
            result = result.filter(s => {
                const hasEval = surahProgress[s.id]?.[selectedSurahId || 0]?.evaluation;
                return filterStatus === 'evaluated' ? !!hasEval : !hasEval;
            });
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(s => s.fullName.toLowerCase().includes(lowerTerm));
        }

        return result.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
    }, [students, searchTerm, filterGroup, filterStatus, surahProgress, selectedSurahId]);

    const groups = useMemo(() => {
        const uniqueGroups = Array.from(new Set(students.map(s => s.groupName))).filter(Boolean);
        return uniqueGroups.sort();
    }, [students]);

    const groupedByLevel = useMemo(() => {
        const levels: (SurahEvaluation | 'unranked')[] = ['ممتاز', 'جيد جداً', 'جيد', 'حسن', 'متوسط', 'لم يحفظ', 'unranked'];
        const result: Record<string, any[]> = {};
        levels.forEach(l => result[l] = []);

        filteredStudents.forEach(student => {
            const evalValue = surahProgress[student.id]?.[selectedSurahId || 0]?.evaluation;
            if (evalValue) {
                result[evalValue].push(student);
            } else {
                result['unranked'].push(student);
            }
        });
        return result;
    }, [filteredStudents, surahProgress, selectedSurahId]);

    const handleEvaluationClick = (studentId: string, evaluation: SurahEvaluation) => {
        if (!selectedSurahId) return;
        onUpdateEvaluation(studentId, selectedSurahId, evaluation);
    };

    const getEvaluationColor = (evaluation?: SurahEvaluation) => {
        if (!evaluation) return "bg-gray-100 text-gray-800";
        switch (evaluation) {
            case 'ممتاز': return "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm";
            case 'جيد جداً': return "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm";
            case 'جيد': return "bg-gradient-to-r from-teal-500 to-teal-600 text-white";
            case 'حسن': return "bg-gradient-to-r from-cyan-500 to-cyan-600 text-white";
            case 'متوسط': return "bg-gradient-to-r from-orange-400 to-orange-500 text-white";
            case 'لم يحفظ': return "bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-inner";
            default: return "bg-slate-100 text-slate-800";
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
                            onValueChange={(val) => handleSurahSelect(Number(val))}
                            placeholder="ابحث عن اسم السورة..."
                            searchPlaceholder="اكتب اسم السورة..."
                        />
                    </div>
                </CardHeader>
            </Card>

            {selectedSurahId && (
                <Card>
                    <CardContent className="bg-emerald-50/20 py-4 border-b">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase">إجمالي الطلاب</p>
                                <p className="text-xl font-bold text-emerald-700">{filteredStudents.length}</p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase">تم تقييمهم</p>
                                <p className="text-xl font-bold text-emerald-600">
                                    {filteredStudents.filter(s => surahProgress[s.id]?.[selectedSurahId]?.evaluation).length}
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase">نسبة الإنجاز</p>
                                <p className="text-xl font-bold text-emerald-500">
                                    {filteredStudents.length > 0
                                        ? Math.round((filteredStudents.filter(s => surahProgress[s.id]?.[selectedSurahId]?.evaluation).length / filteredStudents.length) * 100)
                                        : 0}%
                                </p>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase">المتوسط</p>
                                <p className="text-xl font-bold text-amber-600">
                                    {(() => {
                                        const evals = filteredStudents.map(s => surahProgress[s.id]?.[selectedSurahId]?.evaluation).filter(Boolean);
                                        if (evals.length === 0) return '---';

                                        const weights: Record<string, number> = {
                                            'ممتاز': 5,
                                            'جيد جداً': 4,
                                            'جيد': 3,
                                            'حسن': 2,
                                            'متوسط': 1,
                                            'لم يحفظ': 0
                                        };

                                        const totalWeight = evals.reduce((acc, e) => acc + (weights[e as string] || 0), 0);
                                        const avgWeight = totalWeight / evals.length;

                                        if (avgWeight >= 4.5) return 'ممتاز';
                                        if (avgWeight >= 3.5) return 'جيد جداً';
                                        if (avgWeight >= 2.5) return 'جيد';
                                        if (avgWeight >= 1.5) return 'حسن';
                                        if (avgWeight >= 0.5) return 'متوسط';
                                        return 'لم يحفظ';
                                    })()}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                    <CardHeader className="pb-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold">تقارير سورة {selectedSurahName}</CardTitle>
                                <CardDescription>استعرض توزيع المستويات أو قائمة التقييم الفردية</CardDescription>
                            </div>
                            <div className="flex bg-muted p-1 rounded-lg">
                                <Button
                                    variant={activeTab === 'table' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setActiveTab('table')}
                                    className="gap-2"
                                >
                                    <List className="h-4 w-4" />
                                    القائمة الفردية
                                </Button>
                                <Button
                                    variant={activeTab === 'distribution' ? 'secondary' : 'ghost'}
                                    size="sm"
                                    onClick={() => setActiveTab('distribution')}
                                    className="gap-2"
                                >
                                    <LayoutGrid className="h-4 w-4" />
                                    التوزيع الجماعي
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {activeTab === 'table' ? (
                            <>
                                <div className="mb-4 flex flex-col md:flex-row gap-4 items-center">
                                    <div className="relative flex-1 w-full scale-95 origin-right">
                                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="بحث عن طالب..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pr-9"
                                        />
                                    </div>
                                    <div className="flex gap-2 scale-95">
                                        <select
                                            aria-label="تصفية حسب الحالة"
                                            className="flex h-10 w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={filterStatus}
                                            onChange={(e) => setFilterStatus(e.target.value as any)}
                                        >
                                            <option value="all">كل الحالات</option>
                                            <option value="evaluated">تم التقييم</option>
                                            <option value="not_evaluated">لم يتم التقييم</option>
                                        </select>
                                        <select
                                            aria-label="تصفية حسب الفوج"
                                            className="flex h-10 w-40 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={filterGroup}
                                            onChange={(e) => setFilterGroup(e.target.value)}
                                        >
                                            <option value="all">كل الأفواج</option>
                                            {groups.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="rounded-md border overflow-hidden">
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
                                                const currentEval = entry?.evaluation;

                                                return (
                                                    <TableRow key={student.id} className="hover:bg-slate-50 transition-colors">
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">
                                                                    {student.fullName[0]}
                                                                </div>
                                                                <div>
                                                                    <div>{student.fullName}</div>
                                                                    <div className="text-[10px] text-muted-foreground">{student.groupName}</div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            {currentEval ? (
                                                                <Badge className={cn("hover:none whitespace-nowrap", getEvaluationColor(currentEval))}>
                                                                    {currentEval}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs italic">غير مقيم</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-wrap gap-1 justify-center">
                                                                {(['ممتاز', 'جيد جداً', 'جيد', 'حسن', 'متوسط', 'لم يحفظ'] as SurahEvaluation[]).map((grade) => (
                                                                    <Button
                                                                        key={grade}
                                                                        size="sm"
                                                                        variant={currentEval === grade ? "default" : "outline"}
                                                                        className={cn(
                                                                            "text-[10px] h-7 px-2 min-w-[55px] transition-all",
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
                            </>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 duration-500">
                                {(['ممتاز', 'جيد جداً', 'جيد', 'حسن', 'متوسط', 'لم يحفظ', 'unranked'] as const).map((level) => {
                                    const studentsInLevel = groupedByLevel[level] || [];
                                    if (level === 'unranked' && studentsInLevel.length === 0) return null;

                                    const label = level === 'unranked' ? 'طلاب لم يتم تقييمهم بعد' : level;
                                    const percentage = filteredStudents.length > 0
                                        ? Math.round((studentsInLevel.length / filteredStudents.length) * 100)
                                        : 0;

                                    return (
                                        <Card key={level} className={cn(
                                            "border-t-4 transition-all hover:shadow-lg",
                                            level === 'unranked' ? "border-t-slate-300" :
                                                level === 'ممتاز' ? "border-t-emerald-600 shadow-emerald-50" :
                                                    level === 'جيد جداً' ? "border-t-emerald-400" :
                                                        level === 'جيد' ? "border-t-teal-500" :
                                                            level === 'حسن' ? "border-t-cyan-500" :
                                                                level === 'متوسط' ? "border-t-orange-400" :
                                                                    "border-t-red-500 shadow-red-50"
                                        )}>
                                            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-slate-50/50">
                                                <div className="flex items-center gap-2">
                                                    {level !== 'unranked' && (
                                                        <div className={cn("h-3 w-3 rounded-full", getEvaluationColor(level))} />
                                                    )}
                                                    <span className="font-bold text-sm">{label}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] font-bold">
                                                    {studentsInLevel.length} ({percentage}%)
                                                </Badge>
                                            </CardHeader>
                                            <CardContent className="p-3">
                                                {studentsInLevel.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {studentsInLevel.map(s => (
                                                            <div
                                                                key={s.id}
                                                                className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-700 shadow-sm flex items-center gap-1 hover:border-primary/50 transition-colors"
                                                            >
                                                                <UsersIcon className="h-3 w-3 text-slate-400" />
                                                                {s.fullName}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-center py-4 text-xs text-muted-foreground italic">لا يوجد طلاب في هذا المستوى</p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
