
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, FileDown, FileText as FileTextIcon, MessageCircle } from 'lucide-react';
import { format, parseISO, getMonth, getYear, getDaysInMonth, startOfMonth, endOfMonth, startOfYear, endOfYear, setMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { surahs as allSurahs } from '@/lib/surahs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';


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

        const stats = {
            present: 0, absent: 0, late: 0, makeup: 0, holidays: 0,
        };

        const totalDaysInRange = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) + 1;
        
        const sessionsInRange = Object.values(dailySessions ?? {}).filter(session => {
            const sessionDate = parseISO(session.date);
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        sessionsInRange.forEach(session => {
            if (session.sessionType === 'يوم عطلة') {
                stats.holidays++;
            } else {
                 const record = (session.records ?? []).find(r => r.studentId === selectedStudentId);
                 if (record) {
                    switch (record.attendance) {
                        case 'حاضر': stats.present++; break;
                        case 'متأخر': stats.late++; break;
                        case 'تعويض': stats.makeup++; break;
                        case 'غائب': stats.absent++; break;
                    }
                }
            }
        });

        const studentSurahs = (surahProgress ?? {})[selectedStudentId] || [];
        const memorizedSurahObjects = allSurahs.filter(s => studentSurahs.includes(s.id));

        return {
            student,
            stats: { ...stats, totalPeriodDays: Math.round(totalDaysInRange) },
            memorizedSurahs: memorizedSurahObjects,
            reportTitle,
            statsPeriod
        };

    }, [selectedStudentId, reportPeriod, selectedMonth, selectedSeason, selectedYear, students, dailySessions, surahProgress]);
    
    const getReportFilename = (extension: string) => {
        if (!reportData) return `report.${extension}`;
        const studentName = reportData.student.fullName.replace(/\s/g, '_');
        return `تقرير_${studentName}_${reportData.statsPeriod.replace(/\s/g, '_')}.${extension}`;
    }

    const handleDownloadAsPDF = async () => {
        const reportElement = document.getElementById('report-content');
        if (reportElement) {
            const html2pdf = (await import('html2pdf.js')).default;
            const opt = {
                margin:       [5, 5, 5, 5],
                filename:     getReportFilename('pdf'),
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2, useCORS: true, allowTaint: false },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { avoid: ['.avoid-break'] }
            };
            html2pdf().set(opt).from(reportElement).save();
        }
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

        const { student, stats, memorizedSurahs, reportTitle, statsPeriod } = reportData;
        const surahsText = memorizedSurahs.length > 0 
            ? memorizedSurahs.map(s => s.name).join('، ') 
            : "لا توجد سور محفوظة مسجلة.";
        const totalSessionDays = stats.present + stats.absent + stats.late + stats.makeup;
        const attendanceRate = totalSessionDays > 0 
            ? Math.round((stats.present / totalSessionDays) * 100) + "%" 
            : "غير متاح";
        const notes = teacherNote.trim() || "لا توجد ملاحظات إضافية.";
        const sheikhName = user?.displayName || "الشيخ";

        const message = `📢 *تقرير ${reportTitle} شامل لأداء الطالب: ${student.fullName}*

📆 *الفترة*: ${statsPeriod}
👨‍🏫 *الشيخ المسؤول*: ${sheikhName}
👨‍👦 *اسم الولي*: ${student.guardianName || 'غير محدد'}

📖 *السور المحفوظة (${memorizedSurahs.length})*: ${surahsText}
📊 *معدل الحضور*: ${attendanceRate} (حضر ${stats.present} من ${totalSessionDays} حصة)

📝 *ملاحظات الشيخ*:
${notes}

📤 هذا التقرير تم إعداده تلقائيًا من قبل نظام إدارة مدرسة الإمام الشافعي.`;

        navigator.clipboard.writeText(message).then(() => {
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
                                        <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', {locale: ar})}</SelectItem>
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
                            نسخ رسالة واتساب
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
            <Card className="print:hidden">
                <CardHeader><CardTitle>ملاحظات الشيخ للتقرير</CardTitle></CardHeader>
                <CardContent>
                    <Textarea 
                        placeholder="أضف ملاحظاتك هنا لتظهر في التقرير المطبوع ورسالة واتساب..."
                        value={teacherNote}
                        onChange={e => setTeacherNote(e.target.value)}
                        rows={4}
                    />
                </CardContent>
            </Card>

            {reportData && (
                <Card id="report-display" className="p-6 md:p-8 bg-white text-black rounded-lg shadow-lg font-body">
                   <div id="report-content" className="space-y-6">
                        <header className="text-center border-b-2 pb-4 border-gray-300">
                            <h1 className="text-2xl font-headline font-bold text-gray-800">{`تقرير أداء الطالب ${reportData.reportTitle}`}</h1>
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
                                        <div><span className="font-semibold">رقم الهاتف:</span> {reportData.student.phone1}</div>
                                        <div><span className="font-semibold">تاريخ التسجيل:</span> {format(reportData.student.registrationDate, 'yyyy/MM/dd')}</div>
                                        <div><span className="font-semibold">الفوج:</span> {user?.group || 'غير محدد'}</div>
                                    </div>
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
                                                <th className="p-2 border border-gray-300">العدد (أيام)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr><td className="p-2 border border-gray-300 font-medium">حاضر</td><td className="border border-gray-300">{reportData.stats.present}</td></tr>
                                            <tr><td className="p-2 border border-gray-300 font-medium">غائب</td><td className="border border-gray-300">{reportData.stats.absent}</td></tr>
                                            <tr><td className="p-2 border border-gray-300 font-medium">متأخر</td><td className="border border-gray-300">{reportData.stats.late}</td></tr>
                                            <tr><td className="p-2 border border-gray-300 font-medium">تعويض</td><td className="border border-gray-300">{reportData.stats.makeup}</td></tr>
                                            <tr><td className="p-2 border border-gray-300 font-medium">عطلة</td><td className="border border-gray-300">{reportData.stats.holidays}</td></tr>
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t border-gray-300 font-bold bg-gray-100">
                                                <td className="p-2 border border-gray-300">إجمالي أيام الفترة</td>
                                                <td className="border border-gray-300">{reportData.stats.totalPeriodDays} يوم</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </CardContent>
                            </Card>
                        </section>

                        <section className="avoid-break">
                            <Card className="bg-white shadow-none border border-gray-300">
                                <CardHeader>
                                    <CardTitle className="text-lg text-gray-800">📚 متابعة حفظ السور ({reportData.memorizedSurahs.length} / 114)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {reportData.memorizedSurahs.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 text-sm">
                                            {reportData.memorizedSurahs.map(surah => (
                                                <Badge key={surah.id} variant="secondary" className="bg-green-100 text-green-800 font-medium">
                                                    {surah.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500 text-center">لم يحفظ الطالب أي سورة بعد.</p>
                                    )}
                                </CardContent>
                            </Card>
                        </section>
                        
                        {teacherNote && (
                            <section className="avoid-break">
                                <Card className="bg-white shadow-none border border-gray-300">
                                    <CardHeader><CardTitle className="text-lg text-gray-800">🖊️ ملاحظات الشيخ</CardTitle></CardHeader>
                                    <CardContent>
                                        <p className="whitespace-pre-wrap text-sm">{teacherNote}</p>
                                    </CardContent>
                                </Card>
                            </section>
                        )}

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
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                
                #report-content, #report-content * {
                    font-family: 'Cairo', sans-serif !important;
                    color: black;
                }

                @media print {
                    body > *:not(#report-container) {
                        display: none;
                    }
                    .print\:hidden {
                        display: none !important;
                    }
                    #report-display {
                       display: none !important;
                    }
                    body {
                       -webkit-print-color-adjust: exact;
                       print-color-adjust: exact;
                    }
                     #report-content {
                        visibility: visible;
                        position: absolute;
                        left: 0;
                        top: 0;
                        right: 0;
                        width: 100%;
                        border: none !important;
                        box-shadow: none !important;
                        page-break-inside: avoid;
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

    