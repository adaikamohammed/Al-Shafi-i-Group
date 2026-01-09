

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, FileDown, FileText as FileTextIcon, MessageCircle, ShieldAlert } from 'lucide-react';
import { format, parseISO, getMonth, getYear, getDaysInMonth, startOfMonth, endOfMonth, startOfYear, endOfYear, setMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { surahs as allSurahs } from '@/lib/surahs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import html2canvas from 'html2canvas';
import type { Covenant } from '@/lib/types';

const calculateAge = (birthDate?: Date) => {
  if (!birthDate) return 'N/A';
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

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
        const memorizationScore = (masteredCount / allSurahs.length) * 10;


        const radarData = [
            { subject: 'الحاضر', score: parseFloat(attendanceScore.toFixed(1)), fullMark: 10 },
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
                    case 'الحضور': autoNote = 'نوصي بالتركيز على تحسين جانب الحضور والالتزام بمواعيد الحصص.'; break;
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
        const groupName = user?.group || "المدرسة";
        const sheikhNote = teacherNote.trim() ? `\n\n*ملاحظة الشيخ:* ${teacherNote.trim()}` : (autoNote ? `\n\n*ملاحظة الشيخ:* ${autoNote}`: '');
        let message = '';
        
        const absenceThreshold = 3;
        const undisciplinedThreshold = 2;
        const poorEvaluationThreshold = 2;

        if (activeCovenant) {
            message = `إدارة ${groupName}: تم وضع الابن ${student.fullName} تحت ميثاق *${activeCovenant.type}* نظراً لـ ${activeCovenant.text.toLowerCase()}. نأمل منكم حثه على الالتزام بالعهد ومتابعة بطاقته في سجل الطالب.${sheikhNote}`;
        } else if (stats.absent >= absenceThreshold) {
            message = `السلام عليكم ورحمة الله وبركاته،
نود إفادتكم من إدارة (${groupName}) بأن ابننا ${student.fullName} قد تغيب عن الحلقات لـ ${stats.absent} أيام.
استمرارية الحضور هي سر الإنجاز، نرجو التنسيق معنا لضمان عودته للمسار.${sheikhNote}`;
        } else if (stats.undisciplined >= undisciplinedThreshold) {
            message = `عناية ولي أمر الطالب ${student.fullName} المحترم،
نود إشراككم في متابعة سلوك الابن خلال الحلقة، حيث تم رصد سلوك غير منضبط ${stats.undisciplined} مرات.
نؤمن بأن تكامل البيت والمسجد هو أساس التربية.${sheikhNote}`;
        } else if (stats.poor >= poorEvaluationThreshold) {
            const lastEvaluation = stats.poor > 0 ? "ضعيف" : "متوسط";
            message = `تحية طيبة من إدارة (${groupName})،
نود إحاطتكم علماً بأن مستوى ${student.fullName} شهد تراجعاً طفيفاً في التقييم الأخير (من ممتاز إلى ${lastEvaluation}).
حرصاً منا على تميزه، نرجو منكم حثه على المراجعة بالمنزل.${sheikhNote}`;
        } else {
            const attendanceRate = reportData.totalSessionsHeld > 0 
                ? Math.round(((stats.present + stats.late) / reportData.totalSessionsHeld) * 100) + "%" 
                : "غير متاح";
            message = `*📢 تقرير أداء الطالب: ${student.fullName}*
    
*📆 الفترة:* ${reportData.statsPeriod}
*👨‍🏫 الشيخ المسؤول:* ${user?.displayName || "الشيخ"}
    
*📖 عدد السور المحفوظة:* ${reportData.memorizedSurahsCount}
*📊 معدل الحضور:* ${attendanceRate}
    
*📝 ملاحظات وتوصيات الشيخ:*
${teacherNote.trim() || autoNote || "لا توجد ملاحظات إضافية."}`;
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
                <Card id="report-display" className="p-6 md:p-8 bg-white text-black rounded-lg shadow-lg">
                   <div id="report-content" className="space-y-6">
                        <header className="text-center border-b-2 pb-4 border-gray-300">
                            <h1 className="text-2xl font-bold text-gray-800">{`تقرير أداء الطالب ${reportData.reportTitle}`}</h1>
                            <p className="text-lg font-semibold text-gray-700">المدرسة القرآنية للإمام الشافعي</p>
                            {user?.group && <p className="text-md text-gray-600">{`فوج ${user.group} — ${user.displayName}`}</p>}
                            <p className="font-semibold mt-2 text-lg">{reportData.statsPeriod}</p>
                        </header>
                        
                        <section className="avoid-break">
                            <Card className="bg-white shadow-none border border-gray-300">
                                <CardHeader><CardTitle className="text-lg text-gray-800">📄 بيانات الطالب</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                        <div><span className="font-semibold">الاسم الكامل:</span> {reportData.student.fullName}</div>
                                        <div><span className="font-semibold">اسم الولي:</span> {reportData.student.guardianName}</div>
                                        <div><span className="font-semibold">العمر:</span> {calculateAge(reportData.student.birthDate)} سنة</div>
                                        <div><span className="font-semibold">رقم هاتف الولي:</span> {reportData.student.phone1}</div>
                                        <div><span className="font-semibold">تاريخ التسجيل:</span> {format(reportData.student.registrationDate, 'yyyy/MM/dd')}</div>
                                        <div><span className="font-semibold">الفوج:</span> {user?.group || 'غير محدد'}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                        
                        <section className="avoid-break">
                             <Card className="bg-white shadow-none border border-gray-300">
                                <CardHeader><CardTitle className="text-lg text-gray-800">🎯 رادار المهارات</CardTitle></CardHeader>
                                <CardContent id="radar-chart-container" className="h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={reportData.radarData}>
                                            <PolarGrid />
                                            <PolarAngleAxis dataKey="subject" />
                                            <PolarRadiusAxis angle={30} domain={[0, 10]}/>
                                            <Radar name="التقييم" dataKey="score" stroke="#808000" fill="#808000" fillOpacity={0.6} />
                                            <Legend />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </section>

                        <section className="avoid-break">
                            <Card className="bg-white shadow-none border border-gray-300">
                                <CardHeader><CardTitle className="text-lg text-gray-800">{`📊 إحصائيات ${reportData.reportTitle}`}</CardTitle></CardHeader>
                                <CardContent>
                                    <table className="w-full text-sm text-center border-collapse border border-gray-300">
                                        <thead>
                                            <tr className="border-b border-gray-300 bg-gray-50">
                                                <th className="p-2 border border-gray-300">الحالة</th>
                                                <th className="p-2 border border-gray-300">العدد (حصص)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td className="p-2 border border-gray-300 font-medium">حاضر</td><td className="border border-gray-300">{reportData.stats.present}</td></tr>
                                            <tr><td className="p-2 border border-gray-300 font-medium">غائب</td><td className="border border-gray-300">{reportData.stats.absent}</td></tr>
                                            <tr><td className="p-2 border border-gray-300 font-medium">متأخر</td><td className="border border-gray-300">{reportData.stats.late}</td></tr>
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-gray-300 font-bold bg-gray-100">
                                                <td className="p-2 border border-gray-300">إجمالي الحصص الدراسية</td>
                                                <td className="border border-gray-300">{reportData.totalSessionsHeld} حصة</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </CardContent>
                            </Card>
                        </section>
                        
                        <section className="avoid-break">
                            <Card className="bg-white shadow-none border border-gray-300">
                                <CardHeader><CardTitle className="text-lg text-gray-800">⚖️ ميزان الالتزام</CardTitle></CardHeader>
                                <CardContent>
                                     <table className="w-full text-sm text-center border-collapse border border-gray-300">
                                        <thead>
                                            <tr className="border-b border-gray-300 bg-gray-50">
                                                <th className="p-2 border border-gray-300">البيان</th>
                                                <th className="p-2 border border-gray-300">الرصيد</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td className="p-2 border border-gray-300 font-medium">رصيد الغياب</td><td className="border border-gray-300">{reportData.stats.absent}</td></tr>
                                            <tr><td className="p-2 border border-gray-300 font-medium">رصيد التعويض</td><td className="border border-gray-300">{reportData.stats.compensationBalance}</td></tr>
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-gray-300 font-bold bg-gray-100">
                                                <td className="p-2 border border-gray-300">صافي الرصيد</td>
                                                <td className="border border-gray-300">
                                                    {(reportData.stats.absent - reportData.stats.compensationBalance) > 0 ? (
                                                        <Badge variant="destructive">مطلوب تعويض {reportData.stats.absent - reportData.stats.compensationBalance} حصص</Badge>
                                                    ) : (
                                                        <Badge className="bg-green-600 text-white">تم استيفاء جميع الحصص</Badge>
                                                    )}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </CardContent>
                            </Card>
                        </section>

                        <section className="avoid-break">
                            <Card className="bg-white shadow-none border border-gray-300">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-800">📚 متابعة حفظ السور ({reportData.memorizedSurahsCount} / 114)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {reportData.memorizedSurahsCount > 0 ? (
                                        <p className="text-gray-600 text-center">
                                            أتم الطالب حفظ {reportData.memorizedSurahsCount} سورة من القرآن الكريم.
                                        </p>
                                    ) : (
                                        <p className="text-gray-500 text-center">لم يحفظ الطالب أي سورة بعد.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </section>

                        {reportData.activeCovenant && (
                             <section className="avoid-break">
                                <Card className="bg-white shadow-none border-2 border-red-400">
                                     <CardHeader>
                                        <CardTitle className="text-lg text-red-700 flex items-center gap-2">
                                            <ShieldAlert /> وثيقة ميثاق نشطة
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4 text-center">
                                         <p className="text-gray-600">
                                            يشهد الشيخ <span className="font-bold">{user?.displayName || "المسؤول"}</span>، أن الطالب:
                                        </p>
                                        <p className="text-xl font-bold text-gray-800">{reportData.student.fullName}</p>
                                        <p>قد وضع تحت <span className="font-bold">"{reportData.activeCovenant.type}"</span> بتاريخ <span className="font-bold">{format(parseISO(reportData.activeCovenant.date), 'dd MMMM yyyy', { locale: ar })}</span>.</p>
                                        <blockquote className="p-4 bg-gray-100 border-r-4 border-gray-300">
                                            <p className="font-semibold italic">"{reportData.activeCovenant.text}"</p>
                                        </blockquote>
                                        <p className="text-sm text-gray-500">نأمل من ولي الأمر المتابعة وحث الابن على الالتزام بالعهد.</p>
                                    </CardContent>
                                </Card>
                            </section>
                        )}
                        
                         <section className="avoid-break">
                                <Card className="bg-white shadow-none border border-gray-300">
                                    <CardHeader><CardTitle className="text-lg text-gray-800">🖊️ ملاحظات وتوصيات الشيخ</CardTitle></CardHeader>
                                    <CardContent>
                                        {reportData.autoNote && <p className="whitespace-pre-wrap text-sm font-bold mb-2 p-2 bg-amber-100 text-amber-800 rounded-md">التوصية الآلية: {reportData.autoNote}</p>}
                                        <p className="whitespace-pre-wrap text-sm">{teacherNote ? teacherNote : (reportData.autoNote ? '' : 'لا توجد ملاحظات إضافية.')}</p>
                                    </CardContent>
                                </Card>
                            </section>

                        <footer className="pt-12 text-center text-xs text-gray-500">
                            <div className="flex justify-between items-end">
                                <div className="w-1/3"><p>.........................</p><p className="font-semibold">توقيع الشيخ</p></div>
                                <div className="w-1/3"><p>.........................</p><p className="font-semibold">توقيع ولي الأمر</p></div>
                                <div className="w-1/3"><p>.........................</p><p className="font-semibold">توقيع الإدارة</p></div>
                            </div>
                            <p className="mt-8">هذا التقرير تم إنشاؤه بواسطة نظام إدارة مدرسة الإمام الشافعي بتاريخ {format(new Date(), 'dd/MM/yyyy')}</p>
                        </footer>
                    </div>
                </Card>
            )}
            
            <style jsx global>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #report-display, #report-display * {
                    visibility: visible;
                  }
                  #report-display {
                    position: absolute;
                    left: 0;
                    top: 0;
                    right: 0;
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    border: none;
                    box-shadow: none;
                  }
                  .avoid-break {
                    page-break-inside: avoid;
                  }
                }
            `}</style>
        </div>
    );
}


    
