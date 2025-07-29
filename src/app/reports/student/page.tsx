
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
import { Badge } from '@/components/ui/badge';


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
            if (session.sessionType === 'يوم عطلة') return;
            const record = session.records.find(r => r.studentId === selectedStudentId);
            if (record?.attendance) {
                stats[record.attendance.toLowerCase() as keyof typeof stats]++;
            } else if (!record) {
                // If student has no record on a non-holiday, consider them absent
                stats.absent++;
            }
        });
        
        const studentSurahs = surahProgress[selectedStudentId] || [];
        const memorizedSurahObjects = allSurahs.filter(s => studentSurahs.includes(s.id));

        return {
            student,
            stats,
            memorizedSurahs: memorizedSurahObjects,
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
            
            <Card className="print:hidden">
                <CardHeader><CardTitle>ملاحظات الشيخ للتقرير</CardTitle></CardHeader>
                <CardContent>
                    <Textarea 
                        placeholder="أضف ملاحظاتك هنا لتظهر في التقرير المطبوع..."
                        value={teacherNote}
                        onChange={e => setTeacherNote(e.target.value)}
                        rows={4}
                    />
                </CardContent>
            </Card>


            {reportData && (
                <div id="report-content" className="p-6 md:p-8 bg-white rounded-lg shadow-lg print:shadow-none space-y-6 border">
                     <header className="text-center border-b-2 pb-4 border-primary/50">
                        <h1 className="text-2xl font-headline font-bold text-primary">تقرير أداء الطالب الشهري</h1>
                        <p className="text-muted-foreground font-semibold">المدرسة القرآنية للإمام الشافعي</p>
                        {user?.group && <p className="text-muted-foreground">{`${user.group} — ${user.displayName}`}</p>}
                        <p className="font-semibold mt-2">{format(new Date(selectedYear, selectedMonth), 'MMMM yyyy', { locale: ar })}</p>
                    </header>
                    
                    <section>
                        <Card className="bg-white shadow-none border">
                            <CardHeader><CardTitle className="text-lg">📄 بيانات الطالب</CardTitle></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                    <div><span className="font-semibold">الاسم الكامل:</span> {reportData.student.fullName}</div>
                                    <div><span className="font-semibold">اسم الولي:</span> {reportData.student.guardianName}</div>
                                    <div><span className="font-semibold">العمر:</span> {calculateAge(reportData.student.birthDate)} سنة</div>
                                    <div><span className="font-semibold">رقم الهاتف:</span> {reportData.student.phone1}</div>
                                    <div><span className="font-semibold">تاريخ التسجيل:</span> {format(reportData.student.registrationDate, 'yyyy/MM/dd')}</div>
                                     <div><span className="font-semibold">الفوج:</span> {user?.group || 'غير محدد'}</div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                         <Card className="bg-white shadow-none border">
                             <CardHeader><CardTitle className="text-lg">📊 إحصائيات الشهر</CardTitle></CardHeader>
                            <CardContent>
                                <table className="w-full text-sm text-center">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="p-2">الحالة</th>
                                            <th className="p-2">العدد</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr><td className="p-2 font-medium">حاضر</td><td>{reportData.stats.present}</td></tr>
                                        <tr><td className="p-2 font-medium">غائب</td><td>{reportData.stats.absent}</td></tr>
                                        <tr><td className="p-2 font-medium">متأخر</td><td>{reportData.stats.late}</td></tr>
                                        <tr><td className="p-2 font-medium">تعويض</td><td>{reportData.stats.makeup}</td></tr>
                                        <tr><td className="p-2 font-medium">عطلة</td><td>{reportData.stats.holidays}</td></tr>
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t font-bold bg-muted/50">
                                            <td className="p-2">المجموع</td>
                                            <td>{reportData.stats.totalMonthDays} يوم</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </CardContent>
                        </Card>
                    </section>

                    <section>
                        <Card className="bg-white shadow-none border">
                            <CardHeader>
                                <CardTitle className="text-lg">📚 متابعة حفظ السور ({reportData.memorizedSurahs.length} / 114)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {reportData.memorizedSurahs.length > 0 ? (
                                    <div className="flex flex-wrap gap-2 text-sm">
                                        {reportData.memorizedSurahs.map(surah => (
                                            <Badge key={surah.id} variant="secondary" className="bg-green-100 text-green-800">
                                                {surah.name}
                                            </Badge>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-center">لم يحفظ الطالب أي سورة بعد.</p>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                    
                     <section className="hidden print:block">
                        {teacherNote && (
                             <Card className="bg-white shadow-none border">
                                <CardHeader><CardTitle className="text-lg">🖊️ ملاحظات الشيخ</CardTitle></CardHeader>
                                <CardContent>
                                    <p className="whitespace-pre-wrap text-sm">{teacherNote}</p>
                                </CardContent>
                            </Card>
                        )}
                    </section>

                    <footer className="pt-12 text-center text-xs text-muted-foreground print:pt-24">
                        <div className="flex justify-between items-end">
                            <div className="w-1/3"><p>.........................</p><p className="font-semibold">توقيع الشيخ</p></div>
                            <div className="w-1/3"><p>.........................</p><p className="font-semibold">توقيع ولي الأمر</p></div>
                            <div className="w-1/3"><p>.........................</p><p className="font-semibold">توقيع الإدارة</p></div>
                        </div>
                         <p className="mt-8">هذا التقرير تم إنشاؤه بواسطة نظام إدارة مدرسة الإمام الشافعي بتاريخ {format(new Date(), 'dd/MM/yyyy')}</p>
                    </footer>
                </div>
            )}
            
            <style jsx global>{`
                @media print {
                    body {
                       -webkit-print-color-adjust: exact;
                       print-color-adjust: exact;
                    }
                    .print\\:hidden {
                        display: none;
                    }
                     .print\\:block {
                        display: block;
                    }
                     body > div:not(#report-content) {
                        display: none;
                    }
                    #report-content, #report-content * {
                        visibility: visible;
                    }
                    #report-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        right: 0;
                        margin: 0;
                        padding: 0;
                        border: none;
                        box-shadow: none;
                    }
                }
                @page {
                    size: A4 portrait;
                    margin: 1cm;
                }
            `}</style>
        </div>
    );
}
