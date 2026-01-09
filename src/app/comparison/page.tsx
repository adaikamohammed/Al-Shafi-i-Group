
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Swords, User, Calendar, Cake } from 'lucide-react';
import { format, getMonth, getYear, setMonth, startOfYear, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Student } from '@/lib/types';

const calculateAge = (birthDate?: Date) => {
  if (!birthDate) return 'N/A';
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const StudentCard = ({ student, onSelectStudent, studentList, disabledStudentId }: { student: Student | null, onSelectStudent: (id: string) => void, studentList: Student[], disabledStudentId?: string }) => {
    return (
        <Card className="flex-1">
            <CardHeader>
                <Select dir="rtl" value={student?.id || ''} onValueChange={onSelectStudent}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر طالبًا..." />
                    </SelectTrigger>
                    <SelectContent>
                        {studentList.map(s => (
                            <SelectItem key={s.id} value={s.id} disabled={s.id === disabledStudentId}>
                                {s.fullName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center p-6 min-h-[200px]">
                {student ? (
                    <>
                        <Avatar className="w-24 h-24 mb-4">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${student.fullName}`} alt={student.fullName} />
                            <AvatarFallback>{student.fullName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="text-xl font-bold">{student.fullName}</h3>
                        <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                             <div className="flex items-center gap-1">
                                <Cake className="h-4 w-4"/>
                                <span>{calculateAge(student.birthDate)} سنة</span>
                            </div>
                             <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4"/>
                                <span>انضم في {format(student.registrationDate, 'MMM yyyy', {locale: ar})}</span>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <User className="h-16 w-16 mb-2" />
                        <p>اختر طالبًا لعرض بياناته</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default function ComparisonPage() {
    const { students, loading } = useStudentContext();
    const [periodType, setPeriodType] = useState<'month' | 'season' | 'year'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const [student1Id, setStudent1Id] = useState<string | null>(null);
    const [student2Id, setStudent2Id] = useState<string | null>(null);

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);

    const student1 = useMemo(() => activeStudents.find(s => s.id === student1Id) || null, [activeStudents, student1Id]);
    const student2 = useMemo(() => activeStudents.find(s => s.id === student2Id) || null, [activeStudents, student2Id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    if (activeStudents.length < 2) {
         return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد عدد كافٍ من الطلبة للمقارنة</h1>
                <p className="text-muted-foreground text-center">
                    يجب أن يكون لديك طالبان نشطان على الأقل لاستخدام هذه الميزة.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold flex items-center gap-2">
                        <Swords />
                        ساحة المقارنة (VS)
                    </CardTitle>
                    <CardDescription>
                        اختر طالبين وفترة زمنية لتحليل أدائهما وجهًا لوجه في مختلف الجوانب.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Select dir="rtl" value={periodType} onValueChange={(value: 'month' | 'season' | 'year') => setPeriodType(value)}>
                        <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="نوع التقرير" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="month">مقارنة شهرية</SelectItem>
                            <SelectItem value="season">مقارنة موسمية</SelectItem>
                            <SelectItem value="year">مقارنة سنوية</SelectItem>
                        </SelectContent>
                    </Select>

                    {periodType === 'month' && (
                        <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                            <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
                            <SelectContent>
                                {Array.from({length: 12}, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', { locale: ar })}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {periodType === 'season' && (
                        <Select dir="rtl" value={selectedSeason.toString()} onValueChange={(val) => setSelectedSeason(parseInt(val))}>
                            <SelectTrigger className="w-full md:w-[220px]"><SelectValue placeholder="الموسم" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">الموسم 1 (جانفي - مارس)</SelectItem>
                                <SelectItem value="2">الموسم 2 (أفريل - جوان)</SelectItem>
                                <SelectItem value="3">الموسم 3 (جويلية - سبتمبر)</SelectItem>
                                <SelectItem value="4">الموسم 4 (أكتوبر - ديسمبر)</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                        <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="السنة" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-start">
                <StudentCard 
                    student={student1}
                    onSelectStudent={(id) => setStudent1Id(id)}
                    studentList={activeStudents}
                    disabledStudentId={student2Id || undefined}
                />
                
                <div className="flex items-center justify-center h-full pt-20">
                     <Swords className="h-12 w-12 text-primary" />
                </div>

                <StudentCard 
                    student={student2}
                    onSelectStudent={(id) => setStudent2Id(id)}
                    studentList={activeStudents}
                    disabledStudentId={student1Id || undefined}
                />
            </div>
            
             {/* Placeholder for comparison results */}
            {student1 && student2 && (
                 <Card>
                    <CardHeader>
                        <CardTitle>نتائج المقارنة</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center text-muted-foreground p-12">
                        <p>سيتم عرض تفاصيل المقارنة هنا قريبًا...</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
