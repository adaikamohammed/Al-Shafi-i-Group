
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, FileDown, FileText as FileTextIcon, MessageCircle } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear, setMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import dynamic from 'next/dynamic';

const ReportDisplay = dynamic(() => import('@/components/ui/ReportDisplay').then(mod => mod.ReportDisplay), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
});


export default function StudentReportPage() {
    const { students, dailySessions, surahProgress, loading } = useStudentContext();
    const { user } = useAuth();
    const { toast } = useToast();
    
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [reportPeriod, setReportPeriod] = useState<'month' | 'season' | 'year'>('month');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedSeason, setSelectedSeason] = useState<number>(1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [teacherNote, setTeacherNote] = useState('');
    const [tajweedScore, setTajweedScore] = useState(5);
    const [akhlaqScore, setAkhlaqScore] = useState(5);

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);

     useEffect(() => {
        if(activeStudents.length > 0 && !selectedStudentId) {
            setSelectedStudentId(activeStudents[0].id);
        }
    }, [activeStudents, selectedStudentId]);

    const reportData = useMemo(() => {
        if (!selectedStudentId) return null;
        
        const student = (students ?? []).find(s => s.id === selectedStudentId);
        if (!student) return null;
        
        let startDate: Date;
        let endDate: Date;
        let reportTitle = '';
        let statsPeriod = '';

        switch (reportPeriod) {
            case 'season':
                const seasonStartMonth = (selectedSeason - 1) * 3;
                startDate = startOfMonth(setMonth(new Date(selectedYear, 0), seasonStartMonth));
                endDate = endOfMonth(setMonth(new Date(selectedYear, 0), seasonStartMonth + 2));
                reportTitle = 'الموسمي';
                statsPeriod = `موسم ${selectedSeason} - ${selectedYear}`;
                break;
            case 'year':
                startDate = startOfYear(new Date(selectedYear, 0));
                endDate = endOfYear(new Date(selectedYear, 0));
                reportTitle = 'السنوي';
                statsPeriod = `سنة ${selectedYear}`;
                break;
            case 'month':
            default:
                startDate = startOfMonth(new Date(selectedYear, selectedMonth));
                endDate = endOfMonth(new Date(selectedYear, selectedMonth));
                reportTitle = 'الشهري';
                statsPeriod = format(startDate, 'MMMM yyyy', { locale: ar });
                break;
        }

        const sessionsInRange = Object.values(dailySessions ?? {}).flatMap(day => Object.values(day)).filter(session => {
            if(!session.date) return false;
            const sessionDate = parseISO(session.date);
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        const stats = { present: 0, absent: 0, late: 0, makeup: 0, holidays: 0, calm: 0, mediumBehavior: 0, undisciplined: 0, totalBehavior: 0, excellent: 0, good: 0, average: 0, poor: 0, totalEvaluations: 0, compensationBalance: 0 };
        let totalSessionsHeld = 0;

        sessionsInRange.forEach(session => {
            if (session.sessionType === 'يوم عطلة') {
                stats.holidays++;
            } else {
                 const record = (session.records ?? []).find(r => r.studentId === selectedStudentId);
                 if (record) {
                    totalSessionsHeld++;
                    switch (record.attendance) {
                        case 'حاضر': stats.present++; break;
                        case 'متأخر': stats.late++; break;
                        case 'تعويض': stats.makeup++; break;
                        case 'غائب': stats.absent++; break;
                    }
                    if(record.attendance !== 'غائب' && session.sessionType === 'حصة تعويضية') {
                        stats.compensationBalance++;
                    }
                    if(record.behavior) {
                        stats.totalBehavior++;
                        switch(record.behavior){
                            case 'هادئ': stats.calm++; break;
                            case 'متوسط': stats.mediumBehavior++; break;
                            case 'غير منضبط': stats.undisciplined++; break;
                        }
                    }
                    if(record.memorization) {
                        stats.totalEvaluations++;
                         switch(record.memorization){
                            case 'ممتاز': stats.excellent++; break;
                            case 'جيد': stats.good++; break;
                            case 'متوسط': stats.average++; break;
                            case 'ضعيف': stats.poor++; break;
                        }
                    }
                }
            }
        });

        const attendanceScore = totalSessionsHeld > 0 ? ((stats.present + stats.late) / totalSessionsHeld) * 10 : 0;
        const disciplineScore = stats.totalBehavior > 0 ? ((stats.calm * 2 + stats.mediumBehavior * 1) / (stats.totalBehavior * 2)) * 10 : 0;
        
        const studentMastery = surahProgress[selectedStudentId] || {};
        const masteredCount = Object.values(studentMastery).filter(s => s === 2).length;
        const memorizationScore = masteredCount > 0 ? (masteredCount / 114) * 10 : 0;


        const radarData = [
            { subject: 'الحضÙر', score: parseFloat(attendanceScore.toFixed(1)), fullMark: 10 },
            { subject: 'الحفظ', score: parseFloat(memorizationScore.toFixed(1)), fullMark: 10 },
            { subject: 'الانضباط', score: parseFloat(disciplineScore.toFixed(1)), fullMark: 10 },
            { subject: 'التجويد', score: tajweedScore, fullMark: 10 },
            { subject: 'الأخلاق', score: akhlaqScore, fullMark: 10 },
        ];
        
        let autoNote = '';
        const studentProgressData = surahProgress[selectedStudentId] || {};
        const memorizedCount = Object.values(studentProgressData).filter(s => s === 1).length;
        if(masteredCount > 0 && memorizedCount > masteredCount) {
             autoNote = 'الطالب يحفظ جيداً ولكن يحتاج لتركيز أكبر على مراجعة وتثبيت المحفوظ القديم.';
        } else {
            const minScoreItem = radarData.reduce((min, item) => item.score < min.score ? item : min, radarData[0]);
            if (minScoreItem.score < 5) {
                switch(minScoreItem.subject) {
                    case 'الحفظ': autoNote = 'نوصي بتكثيف المراجعة والتركيز على تثبيت السور المحفوظة للوصول لمرحلة الإتقان.'; break;
                    case 'الحضÙر': autoNote = 'نوصي بالتركيز على تحسين جانب الحضور والالتزام بمواعيد الحصص.'; break;
                    case 'الانضباط': autoNote = 'نوصي بالعمل على تحسين السلوك والانضباط داخل الحلقة.'; break;
                    case 'التجويد': autoNote = 'نوصي بالتركيز على مخارج الحروف وأحكام التجويد.'; break;
                    case 'الأخلاق': autoNote = 'نوصي بتعزيز جانب الأخلاق والآداب الإسلامية العامة.'; break;
                }
            }
        }

        const studentSurahs = ((loading ? [] : (students ?? []).find(s => s.id === selectedStudentId)?.memorizedSurahsCount) || 0);

        const activeCovenant = (student.covenants || []).find(c => c.status === 'نشط' && c.card !== 'بدون');

        return {
            student,
            stats,
            memorizedSurahsCount: studentSurahs,
            reportTitle,
            statsPeriod,
            radarData,
            autoNote,
            totalSessionsHeld,
            activeCovenant,
        };

    }, [selectedStudentId, reportPeriod, selectedMonth, selectedSeason, selectedYear, students, dailySessions, surahProgress, tajweedScore, akhlaqScore, loading]);
    
    const getReportFilename = (extension: string) => {
        if (!reportData) return `report.${extension}`;
        const studentName = reportData.student.fullName.replace(/\s/g, '_');
        return `تقرير_${studentName}_${reportData.statsPeriod.replace(/\s/g, '_')}.${extension}`;
    }

    const handleDownloadAsPDF = async () => {
        window.print();
    };


    const handleDownloadAsWord = () => {
        const reportElement = document.getElementById('report-content');
        if(reportElement) {
            const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' "+
                           "xmlns:w='urn:schemas-microsoft-com:office:word' "+
                           "xmlns='http://www.w3.org/TR/REC-html40'>"+
                           "<head><meta charset='utf-8'><title>Export HTML to Word Document</title></head><body dir='rtl'>";
            const footer = "</body></html>";
            const sourceHTML = header + reportElement.innerHTML + footer;
            
            const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
            const fileDownload = document.createElement("a");
            document.body.appendChild(fileDownload);
            fileDownload.href = source;
            fileDownload.download = getReportFilename('doc');
            fileDownload.click();
            document.body.removeChild(fileDownload);
        }
    };
    
    const handleCopyWhatsAppReport = () => {
        if (!reportData) return;
    
        const { student, stats, autoNote, activeCovenant } = reportData;
        const sheikhName = user?.displayName || "الشيخ";
        let message = `*📢 تقرير أداء الطالب: ${student.fullName}*\n\n*📆 الفترة:* ${reportData.statsPeriod}\n*👨‍🏫 الشيخ المسؤول:* ${sheikhName}`;
    
        // Commitment Balance
        const attendanceBalance = stats.absent - stats.compensationBalance;
        if (attendanceBalance > 0) {
            message += `\n\n*ميزان الالتزام:*\n*رصيد حصص الغياب غير المعوضة:* ${attendanceBalance}`;
        }
    
        // Empowerment Task
        const empowermentTask = (student.covenants || []).find(c => c.type === 'ميثاق حفظ' && c.status === 'نشط');
        if (empowermentTask) {
            message += `\n*مهمة التمكين الحالية:* ${empowermentTask.text} - *حالة التسليم:* ${empowermentTask.status}`;
        }
    
        // Teacher's Note
        const sheikhNote = teacherNote.trim() ? `\n\n*ملاحظة الشيخ:* ${teacherNote.trim()}` : (autoNote ? `\n\n*ملاحظة الشيخ:* ${autoNote}` : '');
        message += sheikhNote;

        // Closing Note
        if (attendanceBalance > 0 || empowermentTask) {
            message += `\n\n*نرجو منكم حث الابن على تعويض الحصص الفائتة وتسليم المهمة في موعدها لضمان سير خطة الحفظ.*`;
        }
    
        const finalMessage = `${message.trim()}\n\n---\n*تم الإرسال عبر نظام إدارة مدرسة الإمام الشافعي.*`;
    
        navigator.clipboard.writeText(finalMessage).then(() => {
            toast({
                title: "✅ تم النسخ بنجاح!",
                description: "الرسالة جاهزة للصق في واتساب.",
            });
        }).catch(err => {
            console.error('Failed to copy: ', err);
            toast({
                title: "❌ فشل النسخ",
                description: "لم نتمكن من نسخ الرسالة. حاول مرة أخرى.",
                variant: "destructive",
            });
        });
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
                    <CardTitle>إنشاء تقرير أداء الطالب</CardTitle>
                    <CardDescription>اختر الطالب والفترة الزمنية المطلوبة، ثم قم بحفظ التقرير بالصيغة التي تفضلها.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex flex-col md:flex-row gap-2">
                         <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                            <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="اختر طالبًا" /></SelectTrigger>
                            <SelectContent>
                                {activeStudents.map(student => (
                                    <SelectItem key={student.id} value={student.id}>{student.fullName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        
                         <Select dir="rtl" value={reportPeriod} onValueChange={(value: 'month' | 'season' | 'year') => setReportPeriod(value)}>
                            <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="نوع التقرير" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="month">تقرير شهري</SelectItem>
                                <SelectItem value="season">تقرير موسمي</SelectItem>
                                <SelectItem value="year">تقرير سنوي</SelectItem>
                            </SelectContent>
                        </Select>

                        {reportPeriod === 'month' && (
                           <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[150px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({length: 12}, (_, i) => (
                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', { locale: ar })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {reportPeriod === 'season' && (
                             <Select dir="rtl" value={selectedSeason.toString()} onValueChange={(val) => setSelectedSeason(parseInt(val))}>
                                <SelectTrigger className="w-full md:w-[220px]"><SelectValue placeholder="الموسم" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">الموسم 1 (جانفي - مارس)</SelectItem>
                                    <SelectItem value="2">الموسم 2 (أفريل - جوان)</SelectItem>
                                    <SelectItem value="3">جويلية - سبتمبر</SelectItem>
                                    <SelectItem value="4">أكتوبر - ديسمبر</SelectItem>
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
                    </div>
                     <div className="flex flex-wrap gap-2">
                        <Button onClick={handleDownloadAsPDF} disabled={!selectedStudentId} variant="destructive">
                            <FileDown className="ml-2 h-4 w-4" />
                            حفظ كـ PDF
                        </Button>
                        <Button onClick={handleDownloadAsWord} disabled={!selectedStudentId}>
                            <FileTextIcon className="ml-2 h-4 w-4" />
                            حفظ بصيغة Word
                        </Button>
                        <Button onClick={handleCopyWhatsAppReport} disabled={!selectedStudentId} variant="secondary">
                            <MessageCircle className="ml-2 h-4 w-4" />
                            تجهيز رسالة واتساب
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
             <Card className="print:hidden">
                <CardHeader>
                  <CardTitle>ملاحظات وتقييمات الشيخ للتقرير</CardTitle>
                  <CardDescription>
                    أضف ملاحظاتك الكتابية هنا، وقم بتقييم التجويد والأخلاق يدويًا. ستظهر هذه التقييمات في الرسم البياني والتقرير المطبوع.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                           <Label htmlFor="tajweed-slider">تقييم التجويد: {tajweedScore}/10</Label>
                           <Slider id="tajweed-slider" defaultValue={[tajweedScore]} max={10} step={1} onValueChange={(val) => setTajweedScore(val[0])} />
                        </div>
                         <div className="space-y-3">
                           <Label htmlFor="akhlaq-slider">تقييم الأخلاق: {akhlaqScore}/10</Label>
                           <Slider id="akhlaq-slider" defaultValue={[akhlaqScore]} max={10} step={1} onValueChange={(val) => setAkhlaqScore(val[0])} />
                        </div>
                   </div>
                    <Textarea 
                        placeholder="أضف ملاحظاتك الكتابية هنا لتظهر في رسالة الواتساب والتقرير..."
                        value={teacherNote}
                        onChange={e => setTeacherNote(e.target.value)}
                        rows={4}
                    />
                </CardContent>
            </Card>

            {reportData && (
                <ReportDisplay 
                    reportData={reportData}
                    user={user}
                    teacherNote={teacherNote}
                />
            )}
        </div>
    );
}
