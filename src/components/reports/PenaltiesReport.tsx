import React from 'react';
import { format, parseISO } from 'date-fns';

interface PenaltiesReportProps {
    logs: any[];
    groupName: string;
    date: Date;
}

export const PenaltiesReport = ({ logs, groupName, date }: PenaltiesReportProps) => {
    return (
        <div className="p-8 bg-white text-black print:p-0" dir="rtl">
            <style type="text/css" media="print">
                {`
                    /* Override Global Print Styles (Receipt Mode) */
                    @page { 
                        size: A4 landscape !important; 
                        margin: 10mm !important; 
                    }
                    
                    body { 
                        background-color: white !important; 
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    /* Hide ALL content by default */
                    body * {
                        visibility: hidden;
                    }

                    /* Show ONLY our report container and its children */
                    .penalties-report-print,
                    .penalties-report-print * {
                        visibility: visible !important;
                    }

                    /* Position the report to take full page */
                    .penalties-report-print {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background-color: white !important;
                    }
                    
                    /* Helper for table headers */
                    thead th {
                        background-color: #e5e7eb !important; /* bg-gray-200 */
                        color: black !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                `}
            </style>

            <div className="flex items-center justify-between mb-8 border-b border-black pb-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-black">تقرير العقوبات والمخالفات</h1>
                    <p className="text-sm text-gray-600">المدرسة القرآنية للإمام الشافعي</p>
                </div>
                <div className="text-left text-sm text-black">
                    <p><strong>تاريخ التقرير:</strong> {format(date, 'dd/MM/yyyy')}</p>
                    <p><strong>الفوج:</strong> {groupName === 'all' ? 'جميع الأفواج' : groupName}</p>
                    <p><strong>العدد:</strong> {logs.length} عقوبة</p>
                </div>
            </div>

            <table className="w-full text-sm text-right border-collapse border border-black">
                <thead className="bg-gray-200 text-black font-bold">
                    <tr>
                        <th className="p-2 border border-black w-[15%]">الطالب</th>
                        <th className="p-2 border border-black w-[10%]">الفوج</th>
                        <th className="p-2 border border-black w-[25%]">السبب / التعهد</th>
                        <th className="p-2 border border-black w-[10%]">النوع</th>
                        <th className="p-2 border border-black w-[15%]">العقوبة المقررة</th>
                        <th className="p-2 border border-black w-[10%]">الحالة</th>
                        <th className="p-2 border border-black w-[15%]">التاريخ</th>
                    </tr>
                </thead>
                <tbody>
                    {logs.map((log, idx) => (
                        <tr key={idx} className="border-b border-black">
                            <td className="p-2 border border-black font-bold align-top">{log.student.fullName}</td>
                            <td className="p-2 border border-black align-top">{log.student.groupName}</td>
                            <td className="p-2 border border-black align-top">
                                {log.covenant.text}
                                {log.covenant.commitmentType && <span className="mr-1 text-xs text-gray-600 block">({log.covenant.commitmentType})</span>}
                            </td>
                            <td className="p-2 border border-black align-top">{log.covenant.type}</td>
                            <td className="p-2 border border-black align-top">
                                <div>{log.covenant.writtenPenalty || '-'}</div>
                                {log.covenant.compensationSessions && (
                                    <div className="text-xs mt-1">تعويض: {log.covenant.compensationSessions} حصص</div>
                                )}
                            </td>
                            <td className="p-2 border border-black align-top">
                                {log.covenant.status || 'نشط'}
                            </td>
                            <td className="p-2 border border-black align-top font-mono">
                                {format(parseISO(log.covenant.date), "dd/MM/yyyy")}
                            </td>
                        </tr>
                    ))}
                    {logs.length === 0 && (
                        <tr>
                            <td colSpan={7} className="p-8 text-center text-gray-500 border border-black">
                                لا توجد عقوبات مطابقة للفلترة الحالية
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div className="mt-8 pt-4 border-t border-black flex justify-between items-center text-xs text-black">
                <div>تم استخراج هذا التقرير آلياً من نظام إدارة المدرسة</div>
                <div className="flex gap-4">
                    <span>التوقيع: .......................................</span>
                    <span>الختم: .......................................</span>
                </div>
            </div>
        </div>
    );
};
