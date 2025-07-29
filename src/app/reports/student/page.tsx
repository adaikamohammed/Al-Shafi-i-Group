
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, Printer } from 'lucide-react';
import { format, parseISO, getMonth, getYear, getDaysInMonth, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { surahs as allSurahs } from '@/lib/surahs';

const calculateAge = (birthDate?: Date) => {
  if (!birthDate) return 'N/A';
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

export default function StudentReportPage() {
    const { students, dailySessions, surahProgress, loading } = useStudentContext();
    const { user } = useAuth();
    
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [teacherNote, setTeacherNote] = useState('');

    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

     useEffect(() => {
        if(activeStudents.length > 0 && !selectedStudentId) {
            setSelectedStudentId(activeStudents[0].id);
        }
    }, [activeStudents, selectedStudentId]);

    const reportData = useMemo(() => {
        if (!selectedStudentId) return null;
        
        const student = students.find(s => s.id === selectedStudentId);
        if (!student) return null;

        const startDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const endDate = endOfMonth(new Date(selectedYear, selectedMonth));
        
        const filteredSessions = Object.values(dailySessions).filter(session => {
            const sessionDate = parseISO(session.date);
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        const stats = {
            present: 0, absent: 0, late: 0, makeup: 0,
            holidays: filteredSessions.filter(s => s.sessionType === 'يوم عطلة').length,
            totalMonthDays: getDaysInMonth(startDate)
        };

        filteredSessions.forEach(session => {
            const record = session.records.find(r => r.studentId === selectedStudentId);
            if (record) {
                if (record.attendance === 'حاضر') stats.present++;
                if (record.attendance === 'غائب') stats.absent++;
                if (record.attendance === 'متأخر') stats.late++;
                if (record.attendance === 'تعويض') stats.makeup++;
            }
        });
        
        const studentSurahs = surahProgress[selectedStudentId] || [];
        const progressPercent = (studentSurahs.length / allSurahs.length) * 100;

        return {
            student,
            stats,
            studentSurahs,
            progressPercent,
        };

    }, [selectedStudentId, selectedMonth, selectedYear, students, dailySessions, surahProgress]);


    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    if (activeStudents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض تقاريرهم</h1>
                <p className="text-muted-foreground text-center">يرجى إضافة طلبة نشطين أولاً.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <Card className="print:hidden">
                <CardHeader>
                    <CardTitle>إنشاء تقرير طالب شهري</CardTitle>
                    <CardDescription>اختر الطالب والشهر المطلوب ثم اضغط على زر الطباعة لإنشاء التقرير.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row gap-4">
                     <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="اختر طالبًا" /></SelectTrigger>
                        <SelectContent>
                            {activeStudents.map(student => (
                                <SelectItem key={student.id} value={student.id}>{student.fullName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                        <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 12}, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', {locale: ar})}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                     <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                        <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="السنة" /></SelectTrigger>
                        <SelectContent>
                             {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handlePrint} disabled={!selectedStudentId}>
                        <Printer className="ml-2 h-4 w-4" />
                        طباعة التقرير
                    </Button>
                </CardContent>
            </Card>

            {reportData && (
                <div id="report-content" className="p-8 bg-white rounded-lg shadow-lg print:shadow-none space-y-8">
                     <header className="text-center border-b-2 pb-4 border-primary">
                        <h1 className="text-3xl font-headline font-bold text-primary">تقرير أداء الطالب الشهري</h1>
                        <p className="text-muted-foreground">مدرسة الإمام الشافعي القرآنية</p>
                        <p className="font-semibold mt-2">{format(new Date(selectedYear, selectedMonth), 'MMMM yyyy', { locale: ar })}</p>
                    </header>
                    
                    <section>
                        <Card>
                            <CardHeader><CardTitle>بيانات الطالب</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 gap-x-8 gap-y-4">
                                <div><span className="font-semibold">الاسم الكامل:</span> {reportData.student.fullName}</div>
                                <div><span className="font-semibold">اسم الولي:</span> {reportData.student.guardianName}</div>
                                <div><span className="font-semibold">رقم الهاتف:</span> {reportData.student.phone1}</div>
                                <div><span className="font-semibold">العمر:</span> {calculateAge(reportData.student.birthDate)} سنة</div>
                                <div><span className="font-semibold">تاريخ التسجيل:</span> {format(reportData.student.registrationDate, 'dd/MM/yyyy')}</div>
                                 <div><span className="font-semibold">الفوج:</span> {user?.group || 'غير محدد'}</div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                         <Card>
                             <CardHeader><CardTitle>إحصائيات الشهر</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 bg-green-100 rounded-md text-center">
                                    <p className="font-bold text-2xl">{reportData.stats.present}</p>
                                    <p className="text-sm text-green-800">حاضر</p>
                                </div>
                                <div className="p-3 bg-red-100 rounded-md text-center">
                                    <p className="font-bold text-2xl">{reportData.stats.absent}</p>
                                    <p className="text-sm text-red-800">غائب</p>
                                </div>
                                <div className="p-3 bg-yellow-100 rounded-md text-center">
                                    <p className="font-bold text-2xl">{reportData.stats.late}</p>
                                    <p className="text-sm text-yellow-800">متأخر</p>
                                </div>
                                 <div className="p-3 bg-blue-100 rounded-md text-center">
                                    <p className="font-bold text-2xl">{reportData.stats.makeup}</p>
                                    <p className="text-sm text-blue-800">تعويض</p>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <Card>
                            <CardHeader>
                                <CardTitle>متابعة حفظ السور ({reportData.studentSurahs.length} / 114)</CardTitle>
                                <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                                    <div className="bg-primary h-2.5 rounded-full" style={{ width: `${reportData.progressPercent}%` }}></div>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2 text-sm">
                                {allSurahs.map(surah => (
                                    <span key={surah.id} className={`py-1 px-2 rounded-full ${reportData.studentSurahs.includes(surah.id) ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                        {surah.name}
                                    </span>
                                ))}
                            </CardContent>
                        </Card>
                    </section>
                    
                     <section className="print:hidden">
                        <Card>
                             <CardHeader><CardTitle>ملاحظات الشيخ</CardTitle></CardHeader>
                            <CardContent>
                                <Textarea 
                                    placeholder="أضف ملاحظاتك هنا لتظهر في التقرير المطبوع..."
                                    value={teacherNote}
                                    onChange={e => setTeacherNote(e.target.value)}
                                    rows={4}
                                />
                            </CardContent>
                        </Card>
                    </section>
                     <section className="hidden print:block">
                        {teacherNote && (
                             <Card>
                                <CardHeader><CardTitle>ملاحظات الشيخ</CardTitle></CardHeader>
                                <CardContent>
                                    <p className="whitespace-pre-wrap">{teacherNote}</p>
                                </CardContent>
                            </Card>
                        )}
                    </section>

                    <footer className="pt-12 text-center text-sm text-muted-foreground">
                        <div className="flex justify-around">
                            <div>
                                <p>.........................</p>
                                <p>توقيع الشيخ</p>
                            </div>
                            <div>
                                <p>.........................</p>
                                <p>توقيع ولي الأمر</p>
                            </div>
                        </div>
                         <p className="mt-8">هذا التقرير تم إنشاؤه بواسطة نظام إدارة مدرسة الإمام الشافعي بتاريخ {format(new Date(), 'dd/MM/yyyy')}</p>
                    </footer>
                </div>
            )}
            
            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #report-content, #report-content * {
                        visibility: visible;
                    }
                    #report-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        right: 0;
                    }
                    .print\\:hidden {
                        display: none;
                    }
                     .print\\:block {
                        display: block;
                    }
                }
            `}</style>
        </div>
    );
}
