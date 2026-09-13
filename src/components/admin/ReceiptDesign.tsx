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
        warning: 'وصل إنذار رسمي',
        compensation: 'وصل تعويض حصة قرآنية',
        transfer: 'إشعار انتقال فوج دراسي',
        mushaf_sticker: 'ملصق المصحف الشريف',
    };

    // تصميم مخصص لملصق المصحف الشريف (إطار إسلامي أنيق واسم بارز)
    if (type === 'mushaf_sticker') {
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
                {/* إطار خارجي مزدوج أنيق للطابعة الحرارية */}
                <div className="border-[2.5px] border-black p-1 rounded-xl">
                    <div className="border border-dashed border-black p-2.5 rounded-lg text-center space-y-1.5">
                        {/* ترويسة مع البسملة واسم المدرسة */}
                        <div className="border-b border-black pb-1 space-y-0.5">
                            <p className="text-[11px] font-bold text-black font-serif">﷽</p>
                            <h2 className="text-[12px] font-black text-black leading-tight font-headline">
                                المدرسة القرآنية للإمام الشافعي
                            </h2>
                            <p className="text-[8px] font-bold text-black/80">
                                حي تكسبت ـ الوادي
                            </p>
                        </div>

                        {/* شارة مصحف الطالب */}
                        <div className="pt-0.5">
                            <span className="inline-block text-[9px] font-black px-2.5 py-0.5 border border-black rounded-full bg-black/5">
                                ❖ هَذَا مُصْحَفُ الطَّالِبِ(ة) ❖
                            </span>
                        </div>

                        {/* اسم الطالب بارز وكبير في مربع مميز */}
                        <div className="my-1 border-2 border-black py-2 px-1 rounded-lg bg-black/5">
                            <span className="text-[8.5px] font-bold text-black block mb-0.5">الاسم واللقب</span>
                            <h1 className="text-[17px] font-black text-black leading-tight tracking-wide font-headline">
                                {studentName || '....................'}
                            </h1>
                        </div>

                        {/* معلومات اختيارية */}
                        <div className="space-y-[2px] text-right pt-0.5">
                            {sheikhName && sheikhName !== 'غير محدد' && (
                                <FieldRow label="الشيخ المشرف" value={sheikhName} />
                            )}
                            {details?.currentSurah && (
                                <FieldRow label="السورة / الحزب الحالي" value={details.currentSurah} />
                            )}
                            {details?.date && (
                                <FieldRow label="تاريخ البدء / التسليم" value={details.date} />
                            )}
                            {details?.note && (
                                <FieldRow label="ملاحظة" value={details.note} />
                            )}
                        </div>

                        {/* حديث شريف ودعاء ختامي */}
                        <div className="border-t border-black pt-1.5 mt-1 space-y-0.5">
                            <p className="text-[8.5px] font-black text-black leading-tight">
                                {details?.dua || '« خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ »'}
                            </p>
                            <p className="text-[7.5px] font-bold text-black/70">
                                جعله الله ربيع قلبه ونوراً له وشفيعاً يوم القيامة 🤲
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

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

                    {type === 'warning' && (
                        <>
                            <FieldRow label="درجة الإنذار" value={details?.degree || 'إنذار أول'} />
                            <FieldRow label="سبب الإنذار" value={details?.reason || 'مخالفة الانضباط أو تكرار الغياب'} />
                            {details?.card && details.card !== 'بدون' && (
                                <FieldRow label="البطاقة التأديبية" value={details.card} />
                            )}
                            <FieldRow label="الإجراء المقرر" value={details?.action || 'الالتزام والانضباط فوراً'} />
                            <div className="mt-1 pt-1 border-t border-black/20 text-center">
                                <span className="text-[8.5px] font-black text-black">⚠️ تنبيه: يُسجّل هذا الإنذار رسمياً في الملف الإداري للطالب.</span>
                            </div>
                        </>
                    )}

                    {type === 'compensation' && (
                        <>
                            <FieldRow label="الحصة المعوَّضة" value={details?.compensatedDate || 'حصة سابقة'} />
                            <FieldRow label="موعد التعويض" value={details?.compensationDate || 'جلسة اليوم'} />
                            <FieldRow label="المقدار المستظهر" value={details?.amount || 'المقرر المحدد'} />
                            <FieldRow label="المشرف على التسميع" value={details?.teacher || sheikhName} />
                            <FieldRow label="النتيجة" value={details?.result || 'تم الاستيفاء بنجاح'} />
                            <div className="mt-1 pt-1 border-t border-black/20 text-center">
                                <span className="text-[8.5px] font-black text-black">✓ إفادة رسمية باستيفاء الحصة وتعويضها شرعاً وإدارياً.</span>
                            </div>
                        </>
                    )}

                    {type === 'transfer' && (
                        <>
                            <FieldRow label="الفوج الحالي" value={details?.fromGroup || '......'} />
                            <FieldRow label="الفوج الجديد المحوَّل إليه" value={details?.toGroup || '......'} />
                            <FieldRow label="تاريخ سريان النقل" value={details?.effectiveDate || 'ابتداءً من الحصة القادمة'} />
                            <FieldRow label="سبب الانتقال" value={details?.reason || 'تنظيم إداري / ترقية مستوى'} />
                            <div className="mt-1 pt-1 border-t border-black/20 text-center">
                                <span className="text-[8.5px] font-black text-black">🔀 إشعار رسمي معتمد من إدارة المدرسة القرآنية.</span>
                            </div>
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
