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

/** سطر حقل واحد: عنوان غامق صغير | قيمة غامقة */
const FieldRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-row items-baseline justify-between border-b border-black/10 py-[2px] gap-2 last:border-0">
        <span className="text-[10px] font-bold text-black shrink-0">{label}</span>
        <span className="text-[11px] font-black text-black text-left">{value || '......'}</span>
    </div>
);

export const ReceiptDesign: React.FC<ReceiptDesignProps> = ({ log, qrCodeUrl, className, isHistory }) => {
    const { type, studentName, sheikhName, details, timestamp } = log;

    const typeLabel: Record<string, string> = {
        summon: 'استدعاء ولي أمر',
        exit: 'إذن خروج استثنائي',
        absence: 'إشعار غياب مسبق',
        payment: 'وصل استلام مبلغ',
        entry: 'إذن دخول للحلقة',
        join: 'طالب جديد',
    };

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
            {/* Header */}
            <div className="receipt-header">
                <h2 className="text-[15px] font-black text-black leading-tight font-headline">
                    {typeLabel[type as string] || type}
                </h2>
                <p className="text-[9px] font-bold text-black mt-0.5">
                    المدرسة القرآنية للإمام الشافعي - حي تكسبت / الوادي
                </p>
            </div>

            {/* Body */}
            <div className="receipt-body">

                {/* معلومات الطالب */}
                <div className="border-b border-black pb-1 mb-1 space-y-[2px]">
                    <FieldRow label="الطالب" value={studentName} />
                    <FieldRow label="المجموعة / الأستاذ(ة)" value={sheikhName} />
                    <FieldRow
                        label="ولي الأمر"
                        value={
                            details?.guardianName
                                ? <>
                                    {details.guardianName}
                                    {details?.guardianPhone && (
                                        <span className="text-[10px] font-bold mr-1" dir="ltr">({details.guardianPhone})</span>
                                    )}
                                  </>
                                : '......'
                        }
                    />
                </div>

                {/* محتوى حسب نوع الوصل */}
                <div className="space-y-[2px]">

                    {type === 'summon' && (
                        <>
                            <FieldRow label="موعد الحضور" value={details?.date} />
                            <FieldRow label="سبب الاستدعاء" value={details?.reason || 'المقابلة من أجل مصلحة الطالب.'} />
                        </>
                    )}

                    {type === 'exit' && (
                        <>
                            <FieldRow label="وقت الخروج" value={details?.time} />
                            <FieldRow label="سبب الخروج" value={details?.reason} />
                        </>
                    )}

                    {type === 'absence' && (
                        <>
                            <FieldRow label="أيام الغياب" value={details?.dates} />
                            <FieldRow label="السبب" value={details?.reason} />
                        </>
                    )}

                    {type === 'payment' && (
                        <div className="text-center py-1">
                            <p className="text-[10px] font-bold text-black underline mb-1">
                                {details?.title || '......'}
                            </p>
                            <div className="text-[18px] font-black text-black">
                                {details?.amount
                                    ? `${Number(details.amount).toLocaleString()} د.ج`
                                    : '...... د.ج'}
                            </div>
                        </div>
                    )}

                    {type === 'entry' && (
                        <>
                            <FieldRow label="أيام الغياب" value={details?.absenceDays || '0'} />
                            <FieldRow label="السبب" value={details?.reason} />
                            <FieldRow label="العقوبة المقررة" value={details?.punishment || 'لا يوجد'} />
                        </>
                    )}

                    {type === 'join' && (
                        <>
                            <FieldRow label="المستوى الدراسي" value={details?.level} />
                            <FieldRow label="أيام الدراسة" value={details?.studyDays} />
                            <FieldRow label="التوقيت" value={details?.timing} />
                        </>
                    )}
                </div>

                {/* Footer: QR + التاريخ */}
                <div className="receipt-qr-section">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-black">تاريخ الإصدار</span>
                        <span className="text-[11px] font-black text-black" dir="ltr">
                            {timestamp
                                ? format(new Date(timestamp), 'yyyy/MM/dd HH:mm', { locale: ar })
                                : format(new Date(), 'yyyy/MM/dd HH:mm', { locale: ar })}
                        </span>
                    </div>
                    {qrCodeUrl && type !== 'join' && (
                        <div className="receipt-qr-image">
                            <img
                                src={qrCodeUrl}
                                alt="QR"
                                className="w-full h-full"
                                crossOrigin="anonymous"
                                loading="lazy"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
