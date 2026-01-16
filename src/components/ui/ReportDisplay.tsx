
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const calculateAge = (birthDate?: Date) => {
  if (!birthDate) return 'N/A';
  const ageDifMs = Date.now() - new Date(birthDate).getTime();
  const ageDate = new Date(ageDifMs);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

interface ReportDisplayProps {
    reportData: any;
    user: any;
    teacherNote: string;
}

export function ReportDisplay({ reportData, user, teacherNote }: ReportDisplayProps) {
    if (!reportData) return null;

    return (
        <Card id="report-display" className="p-6 md:p-8 bg-white text-black rounded-lg shadow-lg">
           <div id="report-content" className="space-y-6">
                <header className="text-center border-b-2 pb-4 border-gray-300">
                    <h1 className="text-2xl font-bold text-gray-800">{`تقرير أداء الطالب ${reportData.reportTitle}`}</h1>
                    <p className="text-lg font-semibold text-gray-700">المدرسة القرآنية للإمام الشافعي</p>
                    {user?.group && <p className="text-md text-gray-600">{`${user.group} — ${user.displayName}`}</p>}
                    <p className="font-semibold mt-2 text-lg">{reportData.statsPeriod}</p>
                </header>
                
                <section className="avoid-break">
                    <Card className="bg-white shadow-none border border-gray-300">
                        <CardHeader><CardTitle className="text-lg text-gray-800">بيانات الطالب</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div><span className="font-semibold">الاسم الكامل:</span> {reportData.student.fullName}</div>
                                <div><span className="font-semibold">اسم الولي:</span> {reportData.student.guardianName}</div>
                                <div><span className="font-semibold">العمر:</span> {calculateAge(reportData.student.birthDate)} سنة</div>
                                <div><span className="font-semibold">رقم هاتف الولي:</span> {reportData.student.phone1}</div>
                                <div><span className="font-semibold">تاريخ التسجيل:</span> {format(reportData.student.registrationDate, 'yyyy/MM/dd')}</div>
                                <div><span className="font-semibold">الفوج:</span> {reportData.student.groupName || 'غير محدد'}</div>
                            </div>
                        </CardContent>
                    </Card>
                </section>
                
                 <section className="grid md:grid-cols-2 gap-4 avoid-break">
                     <Card className="bg-white shadow-none border border-gray-300">
                        <CardHeader><CardTitle className="text-base text-gray-800">ملخص تقييم المهارات</CardTitle></CardHeader>
                        <CardContent className="p-3">
                           <table className="w-full text-sm text-center border-collapse border border-gray-300">
                                <thead>
                                    <tr className="border-b border-gray-300 bg-gray-50">
                                        <th className="p-2 border border-gray-300">المهارة</th>
                                        <th className="p-2 border border-gray-300">التقييم من 10</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportData.radarData.map((item: { subject: string, score: number }) => (
                                        <tr key={item.subject}>
                                            <td className="p-1 border border-gray-300 font-medium">{item.subject}</td>
                                            <td className="p-1 border border-gray-300 font-bold">{item.score.toFixed(1)} / 10</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>

                    <Card className="bg-white shadow-none border border-gray-300">
                        <CardHeader><CardTitle className="text-base text-gray-800">سجل الحضور والانضباط العام</CardTitle></CardHeader>
                        <CardContent className="p-3">
                            <table className="w-full text-sm text-center border-collapse border border-gray-300">
                                <thead>
                                    <tr className="border-b border-gray-300 bg-gray-50">
                                        <th className="p-2 border border-gray-300">حاضر</th>
                                        <th className="p-2 border border-gray-300">غائب</th>
                                        <th className="p-2 border border-gray-300">متأخر</th>
                                        <th className="p-2 border border-gray-300">رصيد الغياب</th>
                                        <th className="p-2 border border-gray-300">رصيد التعويض</th>
                                        <th className="p-2 border border-gray-300">صافي الرصيد</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="p-1 border border-gray-300 font-medium">{reportData.stats.present}</td>
                                        <td className="p-1 border border-gray-300 font-medium">{reportData.stats.absent}</td>
                                        <td className="p-1 border border-gray-300 font-medium">{reportData.stats.late}</td>
                                        <td className="p-1 border border-gray-300 font-medium">{reportData.stats.absent}</td>
                                        <td className="p-1 border border-gray-300 font-medium">{reportData.stats.compensationBalance}</td>
                                        <td className={cn(
                                            "p-1 border border-gray-300 font-bold",
                                            (reportData.stats.absent - reportData.stats.compensationBalance) > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                        )}>
                                            {(reportData.stats.absent - reportData.stats.compensationBalance) > 0 ? (
                                                `مطلوب ${reportData.stats.absent - reportData.stats.compensationBalance} حصص`
                                            ) : (
                                                "مستوفٍ"
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </section>
                
                <section className="avoid-break">
                    <Card className="bg-white shadow-none border border-gray-300">
                         <CardContent className="p-4 space-y-3">
                            <div>
                                <h3 className="font-bold text-gray-800">متابعة حفظ السور ({reportData.memorizedSurahsCount} / 114)</h3>
                                {reportData.memorizedSurahsCount > 0 ? (
                                    <p className="text-gray-600 text-sm">
                                        أتم الطالب حفظ {reportData.memorizedSurahsCount} سورة من القرآن الكريم.
                                    </p>
                                ) : (
                                    <p className="text-gray-500 text-sm">لم يحفظ الطالب أي سورة بعد.</p>
                                )}
                            </div>
                           
                            {reportData.activeCovenant && (
                                <div className="border-t pt-3">
                                    <h3 className="font-bold text-red-700 flex items-center gap-2">
                                        <ShieldAlert /> وثيقة ميثاق نشطة
                                    </h3>
                                    <div className="space-y-2 mt-2 text-sm">
                                        <p><span className="font-semibold">نوع الميثاق:</span> {reportData.activeCovenant.type} ({reportData.activeCovenant.card})</p>
                                        <blockquote className="p-2 bg-gray-100 border-r-4 border-gray-300 italic text-xs">
                                            "{reportData.activeCovenant.text}"
                                        </blockquote>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </section>
                
                 <section className="avoid-break">
                        <Card className="bg-white shadow-none border border-gray-300">
                            <CardHeader><CardTitle className="text-lg text-gray-800">ملاحظات وتوصيات الشيخ</CardTitle></CardHeader>
                            <CardContent className="min-h-[100px]">
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
                    font-size: 10pt; /* Smaller font for printing */
                  }
                  .avoid-break {
                    page-break-inside: avoid;
                  }
                   h1, h2, h3, h4 {
                     font-size: inherit; /* Reset heading sizes for print */
                   }
                }
            `}</style>
        </Card>
    )
}
