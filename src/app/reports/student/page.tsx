
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Printer, AlertTriangle } from 'lucide-react';
import { format, parseISO, getMonth, getYear, getDaysInMonth, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { surahs as allSurahs } from '@/lib/surahs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { JSDoc } from 'typescript';

// You might need to add a custom font to jsPDF to support Arabic characters
// This is a complex topic, but here's a simplified version.
// You'd need to convert a .ttf font file to a Base64 string.
// For this example, we'll rely on system fonts which may or may not work.

export default function StudentReportPage() {
    const { students, dailySessions, surahProgress, loading } = useStudentContext();
    const { user } = useAuth();

    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [isGenerating, setIsGenerating] = useState(false);

    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const handleGenerateReport = async () => {
        if (!selectedStudentId) return;
        setIsGenerating(true);

        const student = students.find(s => s.id === selectedStudentId);
        if (!student) {
            setIsGenerating(false);
            return;
        }

        const startDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const endDate = endOfMonth(new Date(selectedYear, selectedMonth));

        const sessionsInMonth = Object.values(dailySessions).filter(session => {
            const sessionDate = parseISO(session.date);
            return isWithinInterval(sessionDate, { start: startDate, end: endDate });
        });
        
        const studentRecords = sessionsInMonth.map(session => ({
            ...session.records.find(r => r.studentId === student.id),
            sessionType: session.sessionType,
        })).filter(r => r.studentId);
        
        const stats = {
            present: studentRecords.filter(r => r.attendance === 'حاضر').length,
            absent: studentRecords.filter(r => r.attendance === 'غائب').length,
            late: studentRecords.filter(r => r.attendance === 'متأخر').length,
            makeup: studentRecords.filter(r => r.attendance === 'تعويض').length,
            holidays: sessionsInMonth.filter(s => s.sessionType === 'يوم عطلة').length,
        };

        const studentSurahProgress = surahProgress[student.id] || [];

        // PDF Generation
        const doc = new jsPDF();

        // Add Arabic font - this requires a Base64 encoded TTF file.
        // This is a placeholder. For real production, you need to generate this file.
        // doc.addFileToVFS('Amiri-Regular.ttf', '...'); 
        // doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        // doc.setFont('Amiri');
        
        doc.setRTL(true);
        doc.setFontSize(10);
        
        // Use a generic font that might have some Arabic support
        doc.setFont('Helvetica');


        // Header
        doc.setFontSize(18);
        doc.text('المدرسة القرآنية للإمام الشافعي', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
        doc.setFontSize(14);
        doc.text('تقرير الطالب الشهري', doc.internal.pageSize.getWidth() / 2, 30, { align: 'center' });
        doc.setFontSize(12);
        const monthName = format(startDate, 'MMMM yyyy', {locale: ar});
        doc.text(`شهر: ${monthName}`, doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
        
        let y = 55;

        // Student Info
        (doc as any).autoTable({
            startY: y,
            head: [['بيانات الطالب']],
            body: [
                [`${student.fullName}`, 'الاسم الكامل'],
                [`${student.guardianName}`, 'اسم الولي'],
                [`${student.phone1}`, 'رقم الهاتف'],
                [`${new Date().getFullYear() - student.birthDate.getFullYear()} سنة`, 'العمر'],
                [`${format(student.registrationDate, 'dd/MM/yyyy')}`, 'تاريخ التسجيل'],
                [`${user?.group || 'غير محدد'}`, 'الفوج'],
            ],
            theme: 'grid',
            headStyles: { halign: 'center', fillColor: [41, 128, 185] },
            styles: { halign: 'right' }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
        
        // Attendance Stats
        (doc as any).autoTable({
            startY: y,
            head: [['إحصائيات الشهر']],
            body: [
                [`${stats.present} يوم`, 'حاضر'],
                [`${stats.absent} يوم`, 'غائب'],
                [`${stats.late} يوم`, 'متأخر'],
                [`${stats.makeup} حصص`, 'تعويض'],
                [`${stats.holidays} يوم`, 'عطلة'],
            ],
            theme: 'grid',
            headStyles: { halign: 'center', fillColor: [41, 128, 185] },
            styles: { halign: 'right' }
        });
        y = (doc as any).lastAutoTable.finalY + 10;
        
        // Surah Progress
        doc.text('السور المحفوظة', doc.internal.pageSize.getWidth() - 14, y);
        y += 5;
        const surahChunks: string[][] = [];
        let chunk: string[] = [];
        allSurahs.forEach((surah, index) => {
            const status = studentSurahProgress.includes(surah.id) ? '✔' : '❌';
            chunk.push(`${status} ${surah.name}`);
            if (chunk.length === 5 || index === allSurahs.length - 1) {
                surahChunks.push(chunk);
                chunk = [];
            }
        });

        (doc as any).autoTable({
            startY: y,
            body: surahChunks,
            theme: 'plain',
            styles: { halign: 'right', cellPadding: 2, fontSize: 9 },
        });
        y = (doc as any).lastAutoTable.finalY + 15;
        
        // Signatures
        doc.text('....................................', 180, y, { align: 'right' });
        doc.text('....................................', 115, y, { align: 'center' });
        doc.text('....................................', 50, y, { align: 'left' });
        y += 5;
        doc.text('توقيع الشيخ', 180, y, { align: 'right' });
        doc.text('توقيع ولي الأمر', 115, y, { align: 'center' });
        doc.text('توقيع الإدارة', 50, y, { align: 'left' });
        
        doc.save(`تقرير_${student.fullName.replace(/ /g, '_')}_${monthName.replace(/ /g, '_')}.pdf`);
        setIsGenerating(false);
    };

    if (loading) {
        return <div className="flex items-center justify-center h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    if (activeStudents.length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
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
                    <CardTitle className="text-3xl font-headline font-bold">📄 إنشاء تقرير طالب شهري</CardTitle>
                    <CardDescription>
                        اختر الطالب والشهر المطلوب، ثم قم بإنشاء تقرير PDF منسق وجاهز للطباعة أو الإرسال.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                            <SelectTrigger><SelectValue placeholder="اختر طالبًا..." /></SelectTrigger>
                            <SelectContent>
                                {activeStudents.map(student => (
                                    <SelectItem key={student.id} value={student.id}>{student.fullName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                            <SelectTrigger><SelectValue placeholder="اختر الشهر" /></SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 12 }, (_, i) => (
                                    <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', { locale: ar })}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                            <SelectTrigger><SelectValue placeholder="اختر السنة" /></SelectTrigger>
                            <SelectContent>
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleGenerateReport} disabled={!selectedStudentId || isGenerating} className="w-full md:w-auto">
                        {isGenerating ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Printer className="ml-2 h-4 w-4" />}
                        {isGenerating ? 'جاري إنشاء التقرير...' : 'إنشاء وطباعة التقرير'}
                    </Button>
                </CardContent>
            </Card>
            
             <Card className="bg-amber-50 border-amber-300">
                <CardHeader>
                    <CardTitle className="text-amber-800">ملاحظة هامة بخصوص اللغة العربية</CardTitle>
                </CardHeader>
                <CardContent className="text-amber-700">
                   قد تظهر الحروف العربية بشكل غير صحيح (متقطعة أو معكوسة) في ملف الـ PDF الناتج. هذا بسبب أن مكتبات توليد PDF في المتصفح تحتاج إلى خطوط مخصصة تدعم اللغة العربية. سيتم إضافة الدعم الكامل للغة العربية في تحديث مستقبلي.
                </CardContent>
            </Card>
        </div>
    );
}

