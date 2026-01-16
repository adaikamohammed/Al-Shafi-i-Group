

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Swords, User, Calendar, Cake, Crown, ShieldCheck, CheckCircle, XCircle, ChevronsUpDown, Check } from 'lucide-react';
import { format, getMonth, getYear, setMonth, startOfYear, endOfYear, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { Student, DailySession } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';


const calculateAge = (birthDate?: Date) => {
  if (!birthDate) return 'N/A';
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const StudentCard = ({ student, onSelectStudent, studentList, disabledStudentId, isRecordHolder }: { student: Student | null, onSelectStudent: (id: string | null) => void, studentList: Student[], disabledStudentId?: string | null, isRecordHolder?: boolean }) => {
    const [open, setOpen] = useState(false);

    return (
        <Card className="flex-1 min-w-[300px]">
            <CardHeader>
                 <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="w-full justify-between"
                        >
                            {student
                                ? studentList.find((s) => s.id === student.id)?.fullName
                                : "اختر طالبًا..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="ابحث عن اسم الطالب..." />
                            <CommandEmpty>لم يتم العثور على طالب.</CommandEmpty>
                            <CommandGroup>
                                {studentList.map((s) => (
                                    <CommandItem
                                        key={s.id}
                                        value={s.fullName}
                                        disabled={s.id === disabledStudentId}
                                        onSelect={() => {
                                            onSelectStudent(s.id === student?.id ? null : s.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                student?.id === s.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {s.fullName}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </Command>
                    </PopoverContent>
                </Popover>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center text-center p-6 min-h-[200px]">
                {student ? (
                    <>
                        <Avatar className="w-24 h-24 mb-4">
                            <AvatarImage src={student.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${student.fullName}`} alt={student.fullName} />
                            <AvatarFallback>{student.fullName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                          {student.fullName}
                          {isRecordHolder && <Crown className="h-5 w-5 text-yellow-500" />}
                        </h3>
                        <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground mt-2">
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

const ComparisonStat = ({ title, value1, value2, suffix = '', higherIsBetter = true }: { title: string, value1: number, value2: number, suffix?: string, higherIsBetter?: boolean }) => {
    const total = value1 + value2;
    const percentage1 = total > 0 ? (value1 / total) * 100 : 50;
    
    const isDraw = value1 === value2;
    const isWinner1 = !isDraw && (higherIsBetter ? value1 > value2 : value1 < value2);
    const isWinner2 = !isDraw && (higherIsBetter ? value2 > value1 : value2 < value1);

    return (
        <div className="space-y-2">
            <h4 className="text-center font-semibold text-muted-foreground">{title}</h4>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 w-1/4 justify-start">
                    {isWinner1 && <Crown className="h-4 w-4 text-yellow-500" />}
                    <span className="font-bold">{value1.toLocaleString()} {suffix}</span>
                </div>
                <Progress value={percentage1} className="flex-1 h-3" />
                <div className="flex items-center gap-1 w-1/4 justify-end">
                    <span className="font-bold">{value2.toLocaleString()} {suffix}</span>
                    {isWinner2 && <Crown className="h-4 w-4 text-yellow-500" />}
                </div>
            </div>
        </div>
    );
};


export default function ComparisonPage() {
    const { students, dailySessions, loading, hallOfFame } = useStudentContext();
    const { toast } = useToast();

    const [periodType, setPeriodType] = useState<'month' | 'season' | 'year'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const [student1Id, setStudent1Id] = useState<string | null>(null);
    const [student2Id, setStudent2Id] = useState<string | null>(null);

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط').sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')), [students]);

    const student1 = useMemo(() => activeStudents.find(s => s.id === student1Id) || null, [activeStudents, student1Id]);
    const student2 = useMemo(() => activeStudents.find(s => s.id === student2Id) || null, [activeStudents, student2Id]);

    const isRecordHolder = (studentId: string | null): boolean => {
        if (!studentId || !hallOfFame) return false;
        return Object.values(hallOfFame).some(record => {
            if (!record || !('id' in record)) return false; 
            return (record as any).id === studentId;
        });
    }

    const comparisonData = useMemo(() => {
        if (!student1 || !student2) return null;

        let startDate: Date;
        let endDate: Date;

        switch (periodType) {
            case 'season':
                const seasonStartMonth = (selectedSeason - 1) * 3;
                startDate = startOfMonth(setMonth(new Date(selectedYear, 0), seasonStartMonth));
                endDate = endOfMonth(setMonth(new Date(selectedYear, 0), seasonStartMonth + 2));
                break;
            case 'year':
                startDate = startOfYear(new Date(selectedYear, 0));
                endDate = endOfYear(new Date(selectedYear, 0));
                break;
            case 'month':
            default:
                startDate = startOfMonth(new Date(selectedYear, selectedMonth));
                endDate = endOfMonth(new Date(selectedYear, selectedMonth));
                break;
        }

        const sessionsInRange = Object.values(dailySessions ?? {}).flatMap(day => Object.values(day)).filter(session => {
            if(!session.date) return false;
            const sessionDate = parseISO(session.date);
            return sessionDate >= startDate && sessionDate <= endDate;
        });
        
        const getStatsForStudent = (studentId: string) => {
            const stats = { present: 0, absent: 0, late: 0, makeup: 0, excellent: 0, good: 0, calm: 0, totalSessions: 0 };
            sessionsInRange.forEach(session => {
                if (session.sessionType === 'يوم عطلة' || (session.sessionType === 'غياب الشيخ' && !session.substituteTeacher)) return;
                
                const record = (session.records ?? []).find(r => r.studentId === studentId);
                if (record) {
                    stats.totalSessions++;
                    if (record.attendance === 'حاضر') stats.present++;
                    if (record.attendance === 'غائب') stats.absent++;
                    if (record.attendance === 'متأخر') stats.late++;
                    if (record.attendance === 'تعويض') stats.makeup++;
                    if (record.memorization === 'ممتاز') stats.excellent++;
                    if (record.memorization === 'جيد') stats.good++;
                    if (record.behavior === 'هادئ') stats.calm++;
                }
            });
            return stats;
        }

        return {
            student1: getStatsForStudent(student1.id),
            student2: getStatsForStudent(student2.id),
        };

    }, [student1, student2, periodType, selectedMonth, selectedSeason, selectedYear, dailySessions]);


    const handleCrownWinner = () => {
        if (!comparisonData || !student1 || !student2) return;

        const { student1: stats1, student2: stats2 } = comparisonData;

        // Scoring: Excellent = 3, Calm = 2, Present/Makeup = 1, Late = 0.5, Absent = -2
        const score1 = (stats1.excellent * 3) + (stats1.calm * 2) + (stats1.present + stats1.makeup) + (stats1.late * 0.5) - (stats1.absent * 2) + ((student1.memorizedSurahsCount || 0) * 0.1);
        const score2 = (stats2.excellent * 3) + (stats2.calm * 2) + (stats2.present + stats2.makeup) + (stats2.late * 0.5) - (stats2.absent * 2) + ((student2.memorizedSurahsCount || 0) * 0.1);
        
        let winner: Student;
        let reason = '';

        if (score1 > score2) {
            winner = student1;
            if (stats1.excellent > stats2.excellent) reason = "لتفوقه الدراسي وحصوله على تقييم 'ممتاز' في أغلب الحصص.";
            else if (stats1.calm > stats2.calm) reason = "لانضباطه المتميز وسلوكه الهادئ في الحلقة.";
            else reason = "لالتزامه الملحوظ بالحضور والمواظبة على الحصص.";
        } else if (score2 > score1) {
            winner = student2;
            if (stats2.excellent > stats1.excellent) reason = "لتفوقه الدراسي وحصوله على تقييم 'ممتاز' في أغلب الحصص.";
            else if (stats2.calm > stats1.calm) reason = "لانضباطه المتميز وسلوكه الهادئ في الحلقة.";
            else reason = "لالتزامه الملحوظ بالحضور والمواظبة على الحصص.";
        } else {
             toast({
                title: "🤝 تعادل!",
                description: "أداء الطالبين متقارب جدًا. لا يوجد فائز واضح.",
            });
            return;
        }
        
        toast({
            title: `🏆 الفائز هو: ${winner.fullName}`,
            description: reason,
            duration: 5000,
        });
    }

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
                    onSelectStudent={setStudent1Id}
                    studentList={activeStudents}
                    disabledStudentId={student2Id}
                    isRecordHolder={isRecordHolder(student1Id)}
                />
                
                <div className="flex items-center justify-center h-full pt-20">
                     <Swords className="h-12 w-12 text-primary" />
                </div>

                <StudentCard 
                    student={student2}
                    onSelectStudent={setStudent2Id}
                    studentList={activeStudents}
                    disabledStudentId={student1Id}
                    isRecordHolder={isRecordHolder(student2Id)}
                />
            </div>
            
            {student1 && student2 && comparisonData && (
                <>
                 <Card>
                    <CardHeader>
                        <CardTitle>نتائج المقارنة</CardTitle>
                         <CardDescription>
                            مقارنة شاملة بين الطالبين خلال الفترة المحددة. <Crown className="inline-block h-4 w-4 text-yellow-500" /> تشير إلى الأداء الأفضل.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 p-6">
                        <ComparisonStat title="الحضور" value1={comparisonData.student1.present} value2={comparisonData.student2.present} suffix="يوم" />
                        <ComparisonStat title="الغياب" value1={comparisonData.student1.absent} value2={comparisonData.student2.absent} suffix="يوم" higherIsBetter={false} />
                        <ComparisonStat title="التأخر" value1={comparisonData.student1.late} value2={comparisonData.student2.late} suffix="مرة" higherIsBetter={false} />
                        <ComparisonStat title="حصص التعويض" value1={comparisonData.student1.makeup} value2={comparisonData.student2.makeup} suffix="حصص" />
                        <ComparisonStat title="تقييم 'ممتاز'" value1={comparisonData.student1.excellent} value2={comparisonData.student2.excellent} suffix="مرة" />
                        <ComparisonStat title="السلوك الهادئ" value1={comparisonData.student1.calm} value2={comparisonData.student2.calm} suffix="مرة" />
                         <ComparisonStat title="السور المتقنة" value1={student1.memorizedSurahsCount || 0} value2={student2.memorizedSurahsCount || 0} suffix="سورة" />
                    </CardContent>
                </Card>
                 <div className="flex justify-center">
                    <Button onClick={handleCrownWinner} size="lg" className="bg-gradient-to-r from-yellow-400 to-amber-500 text-white shadow-lg hover:shadow-xl transition-shadow">
                        <Crown className="ml-2 h-5 w-5" />
                        تتويج الفائز وتوليد شهادة
                    </Button>
                </div>
                </>
            )}
        </div>
    );
}
