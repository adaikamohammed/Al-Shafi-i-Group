

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, FileDown, MessageCircle, Send } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, startOfYear, endOfYear, setMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';

const ReportDisplay = dynamic(() => import('@/components/ui/ReportDisplay').then(mod => mod.ReportDisplay), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
});

type MessageTemplate = "tashjee" | "tanbih" | "tahdidi" | "istidaa" | "inqitaa";

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
    const [messageTemplate, setMessageTemplate] = useState<MessageTemplate>('tashjee');
    const [messageContent, setMessageContent] = useState('');

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط').sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')), [students]);
    const selectedStudent = useMemo(() => activeStudents.find(s => s.id === selectedStudentId), [activeStudents, selectedStudentId]);

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
        const masteredCount = Object.values(studentMastery).filter(s => s.status === 2).length;
        const memorizationScore = masteredCount > 0 ? (masteredCount / 114) * 10 : 0;


        const radarData = [
            { subject: 'الحضور', score: parseFloat(attendanceScore.toFixed(1)), fullMark: 10 },
            { subject: 'الحفظ', score: parseFloat(memorizationScore.toFixed(1)), fullMark: 10 },
            { subject: 'السلوك', score: parseFloat(disciplineScore.toFixed(1)), fullMark: 10 },
            { subject: 'التجويد', score: tajweedScore, fullMark: 10 },
        ];
        
        let autoNote = '';
        const studentProgressData = surahProgress[selectedStudentId] || {};
        const memorizedCount = Object.values(studentProgressData).filter(s => s.status === 1).length;
        if(masteredCount > 0 && memorizedCount > masteredCount) {
             autoNote = 'الطالب يحفظ جيداً ولكن يحتاج لتركيز أكبر على مراجعة وتثبيت المحفوظ القديم.';
        } else {
            const minScoreItem = radarData.reduce((min, item) => item.score < min.score ? item : min, radarData[0]);
            if (minScoreItem.score < 5) {
                switch(minScoreItem.subject) {
                    case 'الحفظ': autoNote = 'نوصي بتكثيف المراجعة والتركيز على تثبيت السور المحفوظة للوصول لمرحلة الإتقان.'; break;
                    case 'الحضور': autoNote = 'نوصي بالتركيز على تحسين جانب الحضور والالتزام بمواعيد الحصص.'; break;
                    case 'السلوك': autoNote = 'نوصي بالعمل على تحسين السلوك والانضباط داخل الحلقة.'; break;
                    case 'التجويد': autoNote = 'نوصي بالتركيز على مخارج الحروف وأحكام التجويد.'; break;
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

    }, [selectedStudentId, reportPeriod, selectedMonth, selectedSeason, selectedYear, students, dailySessions, surahProgress, tajweedScore, loading]);
    
     useEffect(() => {
        if (!selectedStudent || !user) {
            setMessageContent('');
            return;
        }

        const studentName = selectedStudent.fullName;
        const sheikhName = user.displayName || "الشيخ";
        
        // Auto-suggestion logic
        if (reportData) {
            const { stats, radarData } = reportData;
            const hifzScore = radarData.find(d => d.subject === 'الحفظ')?.score || 0;
            
            if (stats.absent > 2) {
                setMessageTemplate('tahdidi');
            } else if (hifzScore < 5) {
                setMessageTemplate('tanbih');
            } else {
                setMessageTemplate('tashjee');
            }
        }

    }, [selectedStudent, reportData, user]);

    useEffect(() => {
        if (!selectedStudent || !user) {
            setMessageContent('');
            return;
        }

        const studentName = selectedStudent.fullName;
        const sheikhName = user.displayName || "الشيخ";
        let generatedMessage = '';

        const messageBase = `*📢 تقرير أداء الطالب: ${studentName}*\n*👨‍🏫 الشيخ المسؤول: ${sheikhName}*\n\n`;

        switch (messageTemplate) {
            case 'tahdidi':
                generatedMessage = messageBase + `نلاحظ تكرار غياب ابنكم، وعليه نرجو منكم الحضور للمدرسة للتوقيع على تعهد بالالتزام لضمان استمراره.`;
                break;
            case 'tanbih':
                generatedMessage = messageBase + `نحيطكم علماً بأن مستوى حفظ ابنكم في تراجع ملحوظ مؤخراً. نرجو منكم المتابعة المنزلية المكثفة.`;
                break;
            case 'istidaa':
                generatedMessage = messageBase + `يرجى منكم الحضور لمقر مدرسة الشافعي في أقرب وقت لمقابلة الشيخ لأمر ضروري يخص ابنكم.`;
                break;
            case 'tashjee':
                generatedMessage = messageBase + `ما شاء الله! نبارك لكم التميز الباهر لابنكم في حصص القرآن مؤخراً. استمروا في دعمه وتشجيعه.`;
                break;
            case 'inqitaa':
                 generatedMessage = messageBase + `إشعار انقطاع: نحيطكم علماً بأن ابنكم قد تغيب لأكثر من 3 حصص متتالية دون عذر. نرجو منكم التواصل مع الإدارة بشكل عاجل.`;
                break;
        }
        setMessageContent(generatedMessage);
    }, [messageTemplate, selectedStudent, user]);

    const getReportFilename = (extension: string) => {
        if (!reportData) return `report.${extension}`;
        const studentName = reportData.student.fullName.replace(/\s/g, '_');
        return `تقرير_${studentName}_${reportData.statsPeriod.replace(/\s/g, '_')}.${extension}`;
    }

    const handleDownloadAsPDF = async () => {
        window.print();
    };


    const handleSendWhatsApp = () => {
        if (!messageContent || !selectedStudent?.phone1) {
            toast({
                title: "خطأ",
                description: "الرجاء التأكد من وجود محتوى للرسالة ورقم هاتف لولي الأمر.",
                variant: "destructive",
            });
            return;
        }
        // Basic phone number cleaning
        const phoneNumber = selectedStudent.phone1.replace(/\D/g, '');
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(messageContent)}`;
        window.open(whatsappUrl, '_blank');
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
                    </div>
                </CardContent>
            </Card>
            
             <Card className="print:hidden">
                <CardHeader>
                  <CardTitle>ملاحظات وتقييمات الشيخ للتقرير</CardTitle>
                  <CardDescription>
                    أضف ملاحظاتك الكتابية هنا، وقم بتقييم التجويد يدويًا. ستظهر هذه التقييمات في الرسم البياني والتقرير المطبوع.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="space-y-3">
                       <Label htmlFor="tajweed-slider">تقييم التجويد: {tajweedScore}/10</Label>
                       <Slider id="tajweed-slider" defaultValue={[tajweedScore]} max={10} step={1} onValueChange={(val) => setTajweedScore(val[0])} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="teacher-note">ملاحظات الشيخ الختامية للتقرير</Label>
                        <Textarea 
                            id="teacher-note"
                            placeholder="هذه الملاحظات ستظهر في التقرير المطبوع فقط..."
                            value={teacherNote}
                            onChange={e => setTeacherNote(e.target.value)}
                            rows={3}
                        />
                    </div>
                    <div className="pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4 items-end">
                            <div className="space-y-2">
                                <Label htmlFor="message-template">اختر قالب رسالة واتساب</Label>
                                 <Select dir="rtl" value={messageTemplate} onValueChange={(value: MessageTemplate) => setMessageTemplate(value)}>
                                    <SelectTrigger id="message-template" className={cn(
                                        messageTemplate === 'tahdidi' || messageTemplate === 'tanbih' || messageTemplate === 'inqitaa' ? 'ring-2 ring-destructive' : '',
                                        messageTemplate === 'tashjee' ? 'ring-2 ring-green-500' : ''
                                    )}>
                                        <SelectValue placeholder="اختر نوع الرسالة" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tashjee">رسالة تشجيع (للتميز)</SelectItem>
                                        <SelectItem value="tanbih">رسالة تنبيه (لضعف الحفظ)</SelectItem>
                                        <SelectItem value="tahdidi">رسالة تعهد (لضبط الغياب)</SelectItem>
                                        <SelectItem value="inqitaa">إشعار انقطاع (غياب 3+ حصص)</SelectItem>
                                        <SelectItem value="istidaa">استدعاء ولي أمر</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <Button onClick={handleSendWhatsApp} disabled={!selectedStudentId} className="w-full">
                                <Send className="ml-2 h-4 w-4" />
                                إرسال عبر واتساب
                            </Button>
                        </div>
                        <div className="mt-2 space-y-2">
                            <Label htmlFor="whatsapp-message">محتوى الرسالة (قابل للتعديل)</Label>
                             <Textarea
                                id="whatsapp-message"
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                rows={4}
                                placeholder="اختر قالبًا ليظهر المحتوى هنا..."
                            />
                        </div>
                    </div>
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

    

    

