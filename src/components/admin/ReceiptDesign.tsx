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
            <div className="receipt-header">
                <div className="flex flex-col items-center">
                    <h2 className="receipt-title text-black">
                        {type === 'summon' && 'استدعاء ولي أمر'}
                        {type === 'exit' && 'إذن خروج استثنائي'}
                        {type === 'absence' && 'إشعار غياب مسبق'}
                        {type === 'payment' && 'وصل استلام مبلغ'}
                        {type === 'entry' && 'إذن دخول للحلقة'}
                    </h2>
                    <p className="text-[12px] font-[950] text-black/80">المدرسة القرآنية للإمام الشافعي - حي تكسبت / الوادي</p>
                </div>
                <div className="receipt-ticket-number bg-black/5 text-black border-black/20">
                    {details?.ticketNumber || 'TKT-######'}
                </div>
            </div>

            <div className="receipt-body">
                {/* Student Info */}
                <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-3">
                    <div className="receipt-field">
                        <span className="receipt-field-label text-black text-[13px]">الطالب</span>
                        <span className="receipt-field-value text-black">{studentName || '......'}</span>
                    </div>
                    <div className="receipt-field">
                        <span className="receipt-field-label text-black text-[13px]">المجموعة / الأستاذ(ة)</span>
                        <span className="receipt-field-value text-black">{sheikhName || '......'}</span>
                    </div>
                    <div className="receipt-field col-span-2">
                        <span className="receipt-field-label text-black text-[13px]">ولي الأمر</span>
                        <span className="receipt-field-value text-black">
                            {details?.guardianName || '......'}
                            {details?.guardianPhone && <span className="text-[10px] opacity-70 mr-1" dir="ltr">({details.guardianPhone})</span>}
                        </span>
                    </div>
                </div>

                {/* Tab Specific Content */}
                <div className="min-h-[100px]">
                    {type === 'summon' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-black/5 rounded-xl border-r-4 border-black">
                                <span className="receipt-field-label text-black text-[13px]">موعد الحضور المقرر</span>
                                <p className="text-sm font-black text-black">{details?.date || '......'}</p>
                            </div>
                            <div className="receipt-field">
                                <span className="receipt-field-label text-black text-[13px]">سبب الاستدعاء</span>
                                <p className="text-xs leading-relaxed font-bold text-black">{details?.reason || 'المقابلة من أجل مصلحة الطالب التربوية.'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'exit' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-black/5 rounded-xl border-2 border-black/20 border-dashed">
                                <span className="text-xs font-black text-black">وقت الخروج:</span>
                                <span className="text-xl font-black text-black">{details?.time || '......'}</span>
                            </div>
                            <div className="receipt-field">
                                <span className="receipt-field-label text-black text-[13px]">سبب الخروج</span>
                                <p className="text-xs font-bold text-black">{details?.reason || '......'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'absence' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-black/5 rounded-xl border border-black/20">
                                <span className="receipt-field-label text-black text-[13px]">أيام الغياب المصرح بها</span>
                                <p className="text-sm font-black text-black">{details?.dates || '......'}</p>
                            </div>
                            <div className="receipt-field">
                                <span className="receipt-field-label text-black text-[13px]">السبب</span>
                                <p className="text-xs font-bold text-black">{details?.reason || '......'}</p>
                            </div>
                        </div>
                    )}

                    {type === 'payment' && (
                        <div className="space-y-4">
                            <div className="text-center p-4 bg-black/5 rounded-2xl border-2 border-black/20 border-dashed">
                                <p className="text-xs font-black text-black underline mb-2 tracking-wider">{details?.title || '......'}</p>
                                <div className="text-2xl font-black text-black">
                                    {details?.amount ? `${Number(details.amount).toLocaleString()} د.ج` : '...... د.ج'}
                                </div>
                            </div>
                        </div>
                    )}

                    {type === 'entry' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 border-b border-black/10 pb-3">
                                <div className="receipt-field">
                                    <span className="receipt-field-label text-black text-[13px]">أيام الغياب</span>
                                    <span className="receipt-field-value text-black">{details?.absenceDays || '0'}</span>
                                </div>
                                <div className="receipt-field">
                                    <span className="receipt-field-label text-black text-[13px]">السبب</span>
                                    <span className="receipt-field-value text-black">{details?.reason || '......'}</span>
                                </div>
                            </div>
                            {details?.punishment && (
                                <div className="bg-black/5 p-2 rounded-lg border border-black/20 mb-2">
                                    <span className="receipt-field-label text-black text-[13px]">العقوبة المقررة</span>
                                    <p className="text-xs font-black text-black">{details.punishment}</p>
                                </div>
                            )}
                            <div className="receipt-stats-grid bg-black/5 border-black/20">
                                <div className="receipt-stat-item">
                                    <span className="receipt-stat-label text-black">غياب</span>
                                    <span className="receipt-stat-value text-black">{details?.stats?.absences || 0}</span>
                                </div>
                                <div className="receipt-stat-item">
                                    <span className="receipt-stat-label text-black">تأخر</span>
                                    <span className="receipt-stat-value text-black">{details?.stats?.lates || 0}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Section */}
                <div className="receipt-qr-section border-black/20">
                    <div className="flex flex-col gap-1">
                        <div className="receipt-field">
                            <span className="receipt-field-label text-black text-[13px]">تاريخ الإصدار</span>
                            <span className="text-[11px] font-[950] text-black">
                                {timestamp ? format(new Date(timestamp), 'yyyy/MM/dd HH:mm', { locale: ar }) : format(new Date(), 'yyyy/MM/dd HH:mm', { locale: ar })}
                            </span>
                        </div>
                        <div className="h-8 w-16 border border-black/20 flex items-center justify-center text-[8px] font-black text-black/40 rounded mt-1 rotate-1 uppercase">
                            ختم الإدارة
                        </div>
                    </div>
                    {qrCodeUrl && (
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
