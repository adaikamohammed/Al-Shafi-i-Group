
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, Printer, FileDown, FileText as FileTextIcon, Image as ImageIcon } from 'lucide-react';
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
        
        const stats = {
            present: 0,
            absent: 0,
            late: 0,
            makeup: 0,
            holidays: 0,
        };

        const totalDaysInMonth = getDaysInMonth(startDate);
        
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const currentDate = new Date(selectedYear, selectedMonth, day);
            const dateString = format(currentDate, 'yyyy-MM-dd');
            const session = dailySessions[dateString];

            if (session) {
                if (session.sessionType === 'يوم عطلة') {
                    stats.holidays++;
                } else {
                    const record = session.records.find(r => r.studentId === selectedStudentId);
                    if (record) {
                        switch (record.attendance) {
                            case 'حاضر': stats.present++; break;
                            case 'متأخر': stats.late++; break;
                            case 'تعويض': stats.makeup++; break;
                            case 'غائب': stats.absent++; break;
                        }
                    } else {
                        // Student record not found in a non-holiday session, count as absent
                         stats.absent++;
                    }
                }
            } else {
                 const dayOfWeek = currentDate.getDay();
                 // Assuming weekend is Friday (5)
                 if (dayOfWeek !== 5) {
                    // stats.absent++;
                 }
            }
        }
        
        const studentSurahs = surahProgress[selectedStudentId] || [];
        const memorizedSurahObjects = allSurahs.filter(s => studentSurahs.includes(s.id));

        return {
            student,
            stats: {
                ...stats,
                totalMonthDays: totalDaysInMonth
            },
            memorizedSurahs: memorizedSurahObjects,
        };

    }, [selectedStudentId, selectedMonth, selectedYear, students, dailySessions, surahProgress]);
    
    const getReportFilename = (extension: string) => {
        if (!reportData) return `report.${extension}`;
        const studentName = reportData.student.fullName.replace(/\s/g, '_');
        const monthName = format(new Date(selectedYear, selectedMonth), 'MMMM', { locale: ar });
        return `تقرير_${studentName}_${monthName}_${selectedYear}.${extension}`;
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
    
    const handleDownloadAsImage = async () => {
        const reportElement = document.getElementById('report-content');
        if (reportElement) {
            const html2canvas = (await import('html2canvas')).default;
            html2canvas(reportElement, { scale: 2, useCORS: true }).then(canvas => {
                const link = document.createElement("a");
                link.download = getReportFilename('png');
                link.href = canvas.toDataURL("image/png");
                link.click();
            });
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
                    <CardDescription>اختر الطالب والشهر المطلوب ثم قم بحفظ التقرير بالصيغة التي تفضلها.</CardDescription>
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
                    </div>
                     <div className="flex flex-wrap gap-2">
                        <Button onClick={handleDownloadAsPDF} disabled={!selectedStudentId} variant="destructive">
                            <FileDown className="ml-2 h-4 w-4" />
                            حفظ كـ PDF
                        </Button>
                        <Button onClick={handleDownloadAsImage} disabled={!selectedStudentId} variant="secondary">
                            <ImageIcon className="ml-2 h-4 w-4" />
                            حفظ كصورة (PNG)
                        </Button>
                        <Button onClick={handleDownloadAsWord} disabled={!selectedStudentId}>
                            <FileTextIcon className="ml-2 h-4 w-4" />
                            حفظ بصيغة Word
                        </Button>
                    </div>
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

            {/* This container is for display on screen, not for printing */}
            {reportData && (
                <Card id="report-display" className="p-6 md:p-8 bg-white text-black rounded-lg shadow-lg font-body">
                   <div id="report-content" className="space-y-6">
                        <header className="text-center border-b-2 pb-4 border-gray-300">
                            <h1 className="text-2xl font-headline font-bold text-gray-800">تقرير أداء الطالب الشهري</h1>
                            <p className="text-lg font-semibold text-gray-700">المدرسة القرآنية للإمام الشافعي</p>
                            {user?.group && <p className="text-md text-gray-600">{`فوج ${user.group} — ${user.displayName}`}</p>}
                            <p className="font-semibold mt-2 text-lg">{format(new Date(selectedYear, selectedMonth), 'MMMM yyyy', { locale: ar })}</p>
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
                                <CardHeader><CardTitle className="text-lg text-gray-800">📊 إحصائيات الشهر</CardTitle></CardHeader>
                                <CardContent>
                                    <table className="w-full text-sm text-center border-collapse border border-gray-300">
                                        <thead>
                                            <tr className="border-b border-gray-300 bg-gray-50">
                                                <th className="p-2 border border-gray-300">الحالة</th>
                                                <th className="p-2 border border-gray-300">العدد</th>
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
                                                <td className="p-2 border border-gray-300">المجموع</td>
                                                <td className="border border-gray-300">{reportData.stats.totalMonthDays} يوم</td>
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

