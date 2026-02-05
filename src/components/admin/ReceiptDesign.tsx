"use client";

import React from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AdminLog } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ReceiptDesignProps {
    log: Partial<AdminLog> & {
        details: any;
    };
    qrCodeUrl?: string;
    className?: string;
    isHistory?: boolean;
}

export const ReceiptDesign: React.FC<ReceiptDesignProps> = ({ log, qrCodeUrl, className, isHistory }) => {
    const { type, studentName, sheikhName, details, timestamp } = log;

    return (
        <div
            id={isHistory ? undefined : "printable-receipt"}
            className={cn(
                "receipt-container",
                isHistory && "receipt-history-mode",
                className
            )}
            dir="rtl"
        >
            {/* Receipt Header */}
            <div className="receipt-header border-b-2 border-black pt-0 mt-0">
                <div className="flex flex-col items-center">
                    <h2 className="receipt-title text-black font-black">
                        {type === 'summon' && 'استدعاء ولي أمر'}
                        {type === 'exit' && 'إذن خروج استثنائي'}
                        {type === 'absence' && 'إشعار غياب مسبق'}
                        {type === 'payment' && 'وصل استلام مبلغ'}
                        {type === 'entry' && 'إذن دخول للحلقة'}
                        {type === 'join' && 'طالب جديد'}
                    </h2>
                    <p className="text-[14px] font-[1000] text-black">المدرسة القرآنية للإمام الشافعي - حي تكسبت / الوادي</p>
                </div>
            </div>

            <div className="receipt-body pt-1">
                {/* Student Info */}
                <div className="grid grid-cols-2 gap-1 border-b-2 border-black pb-1 mb-1">
                    <div className="receipt-field">
                        <span className="receipt-field-label text-black text-[14px] font-black">الطالب</span>
                        <span className="receipt-field-value text-black font-black">{studentName || '......'}</span>
                    </div>
                    <div className="receipt-field">
                        <span className="receipt-field-label text-black text-[14px] font-black">المجموعة / الأستاذ(ة)</span>
                        <span className="receipt-field-value text-black font-black">{sheikhName || '......'}</span>
                    </div>
                    <div className="receipt-field col-span-2">
                        <span className="receipt-field-label text-black text-[14px] font-black">ولي الأمر</span>
                        <span className="receipt-field-value text-black font-black">
                            {details?.guardianName || '......'}
                            {details?.guardianPhone && <span className="text-[12px] font-black mr-1" dir="ltr">({details.guardianPhone})</span>}
                        </span>
                    </div>
                </div>

                {/* Tab Specific Content */}
                <div className="min-h-[50px]">
                    {type === 'summon' && (
                        <div className="space-y-2">
                            <div className="p-1.5 bg-white rounded-xl">
                                <span className="receipt-field-label text-black text-[14px] font-black">موعد الحضور المقرر</span>
                                <p className="text-sm font-black text-black">{details?.date || '......'}</p>
                            </div>
                            <div className="receipt-field">
                                <span className="receipt-field-label text-black text-[13px] font-black">سبب الاستدعاء</span>
                                <p className="text-xs leading-relaxed font-black text-black">{details?.reason || 'المقابلة من أجل مصلحة الطالب التربوية.'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'exit' && (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center p-1.5 bg-white rounded-xl">
                                <span className="text-xs font-black text-black">وقت الخروج:</span>
                                <span className="text-xl font-black text-black">{details?.time || '......'}</span>
                            </div>
                            <div className="receipt-field">
                                <span className="receipt-field-label text-black text-[13px] font-black">سبب الخروج</span>
                                <p className="text-xs font-black text-black">{details?.reason || '......'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'absence' && (
                        <div className="space-y-2">
                            <div className="p-1.5 bg-white rounded-xl">
                                <span className="receipt-field-label text-black text-[13px] font-black">أيام الغياب المصرح بها</span>
                                <p className="text-sm font-black text-black">{details?.dates || '......'}</p>
                            </div>
                            <div className="receipt-field">
                                <span className="receipt-field-label text-black text-[13px] font-black">السبب</span>
                                <p className="text-xs font-black text-black">{details?.reason || '......'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'payment' && (
                        <div className="space-y-4">
                            <div className="text-center p-4 bg-white rounded-2xl">
                                <p className="text-xs font-black text-black underline mb-2 tracking-wider">{details?.title || '......'}</p>
                                <div className="text-2xl font-black text-black">
                                    {details?.amount ? `${Number(details.amount).toLocaleString()} د.ج` : '...... د.ج'}
                                </div>
                            </div>
                        </div>
                    )}

                    {type === 'entry' && (
                        <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-2 border-b-2 border-black pb-1 mb-1">
                                <div className="receipt-field">
                                    <span className="receipt-field-label text-black text-[13px] font-black">أيام الغياب</span>
                                    <span className="receipt-field-value text-black font-black">{details?.absenceDays || '0'}</span>
                                </div>
                                <div className="receipt-field">
                                    <span className="receipt-field-label text-black text-[13px] font-black">السبب</span>
                                    <span className="receipt-field-value text-black font-black">{details?.reason || '......'}</span>
                                </div>
                            </div>

                            <div className="bg-white p-1 rounded-lg mb-1">
                                <span className="receipt-field-label text-black text-[13px] font-black">العقوبة المقررة</span>
                                <p className="text-xs font-black text-black">{details?.punishment || 'لا يوجد'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'join' && (
                        <div className="space-y-2">
                            <div className="receipt-field mb-1">
                                <span className="receipt-field-label text-black text-[13px] font-black">المستوى الدراسي</span>
                                <span className="receipt-field-value text-black font-black">{details?.level || '......'}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 border-t-2 border-black pt-1">
                                <div className="receipt-field">
                                    <span className="receipt-field-label text-black text-[13px] font-black">أيام الدراسة</span>
                                    <span className="receipt-field-value text-black font-black">{details?.studyDays || '......'}</span>
                                </div>
                                <div className="receipt-field">
                                    <span className="receipt-field-label text-black text-[13px] font-black">التوقيت</span>
                                    <span className="receipt-field-value text-black font-black">{details?.timing || '......'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="receipt-qr-section border-t-2 border-black">
                    <div className="flex flex-col gap-1">
                        <div className="receipt-field">
                            <span className="receipt-field-label text-black text-[13px] font-black">تاريخ الإصدار</span>
                            <span className="text-[12px] font-[1000] text-black">
                                {timestamp ? format(new Date(timestamp), 'yyyy/MM/dd HH:mm', { locale: ar }) : format(new Date(), 'yyyy/MM/dd HH:mm', { locale: ar })}
                            </span>
                        </div>
                        <div className="h-8 w-16 border-2 border-black flex items-center justify-center text-[8px] font-black text-black rounded mt-1 rotate-1 uppercase">
                            ختم الإدارة
                        </div>
                    </div>
                    {qrCodeUrl && type !== 'join' && (
                        <div className="receipt-qr-image border-black/10">
                            <img
                                src={qrCodeUrl}
                                alt="QR"
                                className="w-full h-full"
                                crossOrigin="anonymous"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
