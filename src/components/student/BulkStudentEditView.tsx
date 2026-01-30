"use client";

import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Search, X, AlertCircle } from 'lucide-react';
import { Student } from '@/lib/types';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const educationalLevels = ["روضة", "تحضيري", "1 ابتدائي", "2 ابتدائي", "3 ابتدائي", "4 ابتدائي", "5 ابتدائي", "1 متوسط", "2 متوسط", "3 متوسط", "4 متوسط", "1 ثانوي", "2 ثانوي", "3 ثانوي", "بكالوريا", "جامعي", "متوقف عن الدراسة"];
const memorizationAmounts = ["ثمن", "ربع", "نصف", "صفحة", "أكثر"];

interface BulkStudentEditViewProps {
    students: Student[];
    onClose: () => void;
}

export const BulkStudentEditView = ({ students: initialStudents, onClose }: BulkStudentEditViewProps) => {
    const { bulkUpdateStudents } = useStudentContext();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [localChanges, setLocalChanges] = useState<Record<string, Partial<Student>>>({});
    const [isSaving, setIsSaving] = useState(false);

    const filteredStudents = useMemo(() => {
        return initialStudents.filter(s =>
            s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.guardianName && s.guardianName.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [initialStudents, searchTerm]);

    const handleChange = (studentId: string, field: keyof Student, value: any) => {
        setLocalChanges(prev => ({
            ...prev,
            [studentId]: {
                ...prev[studentId],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        if (Object.keys(localChanges).length === 0) {
            toast({ title: "تنبيه", description: "لم يتم إجراء أي تغييرات للحفظ." });
            return;
        }

        setIsSaving(true);
        try {
            await bulkUpdateStudents(localChanges);
            setLocalChanges({});
            onClose();
        } catch (error: any) {
            console.error("Error saving bulk changes:", error);
        } finally {
            setIsSaving(false);
        }
    };

    const hasChanges = Object.keys(localChanges).length > 0;

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/30 p-4 rounded-xl border border-border/40">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-[300px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث سريعة في الجدول..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-background font-body"
                        />
                    </div>
                    {hasChanges && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 font-bold">
                            {Object.keys(localChanges).length} طلاب تم تعديلهم
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button variant="outline" onClick={onClose} disabled={isSaving} className="font-bold">
                        <X className="ml-2 h-4 w-4" /> إلغاء
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving || !hasChanges} className="bg-primary shadow-lg shadow-primary/20 font-bold">
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        حفظ جميع التغييرات
                    </Button>
                </div>
            </div>

            <div className="relative overflow-x-auto rounded-xl border border-border/50 shadow-md bg-background scrollbar-thin">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow className="font-headline">
                            <TableHead className="min-w-[200px] text-right font-bold">الاسم الكامل</TableHead>
                            <TableHead className="min-w-[100px] text-center font-bold">الجنس</TableHead>
                            <TableHead className="min-w-[150px] text-right font-bold">اسم الولي</TableHead>
                            <TableHead className="min-w-[130px] text-right font-bold">الهاتف 1</TableHead>
                            <TableHead className="min-w-[150px] text-right font-bold">المستوى الدراسي</TableHead>
                            <TableHead className="min-w-[100px] text-center font-bold">العمر التقريبي</TableHead>
                            <TableHead className="min-w-[140px] text-center font-bold">تاريخ الميلاد (دقيق)</TableHead>
                            <TableHead className="min-w-[80px] text-center font-bold">الصفحة</TableHead>
                            <TableHead className="min-w-[120px] text-right font-bold">الحالة</TableHead>
                            <TableHead className="min-w-[130px] text-right font-bold">خطة الحفظ</TableHead>
                            <TableHead className="min-w-[200px] text-right font-bold">ملاحظات</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredStudents.length > 0 ? (
                            filteredStudents.map((student) => {
                                const studentChanges = localChanges[student.id] || {};
                                const currentYear = 2026; // Based on metadata

                                const getVal = (field: keyof Student) => {
                                    if (studentChanges[field] !== undefined) return studentChanges[field];
                                    return (student as any)[field];
                                };

                                const getBirthDateStr = () => {
                                    const val = getVal('birthDate');
                                    if (!val) return '';
                                    try {
                                        const d = typeof val === 'string' ? new Date(val) : val;
                                        return d.toISOString().split('T')[0];
                                    } catch (e) { return ''; }
                                };

                                const getAge = () => {
                                    const val = getVal('birthDate');
                                    if (!val) return '';
                                    try {
                                        const d = typeof val === 'string' ? new Date(val) : val;
                                        return currentYear - d.getFullYear();
                                    } catch (e) { return ''; }
                                };

                                const handleAgeChange = (ageStr: string) => {
                                    if (ageStr === '') {
                                        handleChange(student.id, 'birthDate', null);
                                        return;
                                    }
                                    const age = parseInt(ageStr, 10);
                                    if (!isNaN(age)) {
                                        const birthYear = currentYear - age;
                                        const birthDate = new Date(birthYear, 0, 1).toISOString();
                                        handleChange(student.id, 'birthDate', birthDate);
                                    }
                                };

                                const isChanged = (field: keyof Student) => studentChanges[field] !== undefined;

                                return (
                                    <TableRow key={student.id} className={cn("transition-colors", Object.keys(studentChanges).length > 0 ? "bg-amber-50/30" : "")}>
                                        <TableCell className="p-2">
                                            <Input
                                                value={getVal('fullName') || ''}
                                                onChange={(e) => handleChange(student.id, 'fullName', e.target.value)}
                                                className={cn("h-9 font-body border-transparent hover:border-border focus:border-primary", isChanged('fullName') && "border-amber-400 bg-amber-50/50")}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Select value={getVal('gender') || 'ذكر'} onValueChange={(val) => handleChange(student.id, 'gender', val)}>
                                                <SelectTrigger className={cn("h-9 font-body border-transparent hover:border-border", isChanged('gender') && "border-amber-400 bg-amber-50/50")}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="font-body">
                                                    <SelectItem value="ذكر">ذكر</SelectItem>
                                                    <SelectItem value="أنثى">أنثى</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                value={getVal('guardianName') || ''}
                                                onChange={(e) => handleChange(student.id, 'guardianName', e.target.value)}
                                                className={cn("h-9 font-body border-transparent hover:border-border focus:border-primary", isChanged('guardianName') && "border-amber-400 bg-amber-50/50")}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                value={getVal('phone1') || ''}
                                                onChange={(e) => handleChange(student.id, 'phone1', e.target.value)}
                                                className={cn("h-9 font-body dir-ltr text-right border-transparent hover:border-border focus:border-primary", isChanged('phone1') && "border-amber-400 bg-amber-50/50")}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Select value={getVal('educationalLevel') || ''} onValueChange={(val) => handleChange(student.id, 'educationalLevel', val)}>
                                                <SelectTrigger className={cn("h-9 font-body border-transparent hover:border-border", isChanged('educationalLevel') && "border-amber-400 bg-amber-50/50")}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="font-body">
                                                    {educationalLevels.map(level => <SelectItem key={level} value={level}>{level}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                type="number"
                                                value={getAge()}
                                                onChange={(e) => handleAgeChange(e.target.value)}
                                                className={cn("h-9 font-body text-center border-transparent hover:border-border focus:border-primary", isChanged('birthDate') && "border-amber-400 bg-amber-50/50")}
                                                placeholder="العمر"
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                type="date"
                                                value={getBirthDateStr()}
                                                onChange={(e) => handleChange(student.id, 'birthDate', e.target.value)}
                                                className={cn("h-9 font-body text-center border-transparent hover:border-border focus:border-primary text-xs opacity-70", isChanged('birthDate') && "border-amber-400 bg-amber-50/50")}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                value={getVal('pageNumber') || ''}
                                                onChange={(e) => handleChange(student.id, 'pageNumber', e.target.value)}
                                                className={cn("h-9 font-body text-center border-transparent hover:border-border focus:border-primary", isChanged('pageNumber') && "border-amber-400 bg-amber-50/50")}
                                            />
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Select value={getVal('status')} onValueChange={(val) => handleChange(student.id, 'status', val)}>
                                                <SelectTrigger className={cn("h-9 font-body border-transparent hover:border-border", isChanged('status') && "border-amber-400 bg-amber-50/50")}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="font-body">
                                                    <SelectItem value="نشط">نشط</SelectItem>
                                                    <SelectItem value="مطرود">مطرود</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Select value={getVal('dailyMemorizationAmount') || ''} onValueChange={(val) => handleChange(student.id, 'dailyMemorizationAmount', val)}>
                                                <SelectTrigger className={cn("h-9 font-body border-transparent hover:border-border", isChanged('dailyMemorizationAmount') && "border-amber-400 bg-amber-50/50")}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="font-body">
                                                    {memorizationAmounts.map(amount => <SelectItem key={amount} value={amount}>{amount}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="p-2">
                                            <Input
                                                value={getVal('notes') || ''}
                                                onChange={(e) => handleChange(student.id, 'notes', e.target.value)}
                                                className={cn("h-9 font-body border-transparent hover:border-border focus:border-primary", isChanged('notes') && "border-amber-400 bg-amber-50/50")}
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={10} className="h-32 text-center text-muted-foreground font-body">
                                    لم يتم العثور على نتائج للبحث.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 shadow-sm">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800 font-body">
                    <p className="font-bold mb-1">تعليمات الوضع السريع:</p>
                    <ul className="list-disc list-inside space-y-1 opacity-90">
                        <li>يمكنك تعديل أي معلومة مباشرة داخل الجدول.</li>
                        <li>سيتم تلوين الحقول المعدلة باللون <span className="text-amber-700 font-bold">الأصفر</span> لتسهيل المراجعة.</li>
                        <li>اضغط على "حفظ جميع التغييرات" لتطبيق التعديلات على جميع الطلاب دفعة واحدة.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
