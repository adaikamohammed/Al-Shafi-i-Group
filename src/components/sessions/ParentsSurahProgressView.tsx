"use client";

import React, { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, Trophy, Star, ShieldAlert, Award, Download, Clock } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn, arabicCompare } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ParentsSurahProgressViewProps {
    dailySessions: Record<string, Record<string, any>> | null;
    students: any[];
    globalProgress: {
        surahId: number;
        fromVerse: number;
        toVerse: number;
        surahName: string;
        totalVerses: number;
    } | null;
}

const pad = (num: number) => num < 10 ? `0${num}` : num.toString();

const toHijri = (date: Date): string => {
    try {
        const hijriDate = new Date(date);
        hijriDate.setDate(hijriDate.getDate() - 1);
        const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
        const parts = fmt.formatToParts(hijriDate);
        const day = parts.find(p => p.type === 'day')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';
        const toWestern = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        return `${toWestern(day)} ${month} ${toWestern(year)}`;
    } catch {
        return '';
    }
};

export const ParentsSurahProgressView = ({ dailySessions, students, globalProgress }: ParentsSurahProgressViewProps) => {

    const containerRef = useRef<HTMLDivElement>(null);

    const activeStudents = useMemo(() =>
        [...students].filter(s => s.status === 'نشط').sort((a, b) => arabicCompare(a.fullName, b.fullName)),
        [students]
    );

    const surahData = useMemo(() => {
        if (!globalProgress || !dailySessions) return null;

        const allSessions = Object.values(dailySessions).flatMap(day => Object.values(day as Record<string, any>));

        const validSessions = allSessions
            .filter(s =>
                (s.sessionType === 'حصة أساسية' || s.sessionType === 'حصة إضافية') &&
                s.tasmieSurahId === globalProgress.surahId &&
                !s.isCounterStopped
            )
            .sort((a, b) => a.date.localeCompare(b.date));

        const wirds = validSessions.map((session, index) => {
            const date = parse(session.date, 'yyyy-MM-dd', new Date());
            const records: any[] = session.records || [];

            const successfulReciters = activeStudents.filter(student => {
                const rec = records.find(r => r.studentId === student.id);
                const isPresent = rec?.attendance === 'حاضر' || rec?.attendance === 'متأخر';
                const hasMemorized = rec?.memorization && rec.memorization !== 'لم يحفظ' && rec.memorization !== 'لا يوجد';

                let hasCaughtUp = false;
                if (!isPresent || !hasMemorized) {
                    const newerSessions = allSessions.filter(ns => ns.date > session.date);
                    for (const ns of newerSessions) {
                        const nRec = (ns.records || []).find((r: any) => r.studentId === student.id);
                        if (nRec && nRec.catchUpRecords) {
                            const matchingCatchUp = nRec.catchUpRecords.find((cr: any) => cr.date === session.date && cr.surahName === globalProgress.surahName && cr.fromVerse === session.tasmieFromVerse);
                            if (matchingCatchUp) {
                                hasCaughtUp = true;
                                break;
                            }
                        }
                    }
                }

                return (isPresent && hasMemorized) || hasCaughtUp;
            });

            const pendingReciters = activeStudents.filter(s => !successfulReciters.find(sr => sr.id === s.id));

            return {
                id: `${session.id}-${index}`,
                dateStr: session.date,
                dayName: format(date, 'EEEE', { locale: ar }),
                hijriDate: toHijri(date),
                fromVerse: session.tasmieFromVerse,
                toVerse: session.tasmieToVerse,
                successfulReciters,
                pendingReciters,
                isRecent: new Date().getTime() - date.getTime() < 4 * 24 * 60 * 60 * 1000,
                successPercentage: Math.round((successfulReciters.length / activeStudents.length) * 100) || 0
            };
        });

        // Deduplicate
        const uniqueWirds = Array.from(new Map(wirds.map(w => [`${w.fromVerse}-${w.toVerse}`, w])).values())
            .sort((a, b) => a.fromVerse - b.fromVerse);

        return {
            wirds: uniqueWirds
        };

    }, [dailySessions, globalProgress, activeStudents]);


    if (!globalProgress || !surahData || surahData.wirds.length === 0) return null;

    const progressPercentage = Math.round((globalProgress.toVerse / globalProgress.totalVerses) * 100);

    return (
        <div ref={containerRef} className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-100 my-8 print:shadow-none print:border-none print:my-0 pb-12">

            {/* Elegant Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8 border-b-2 border-emerald-50 pb-6 text-center md:text-right">
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col gap-1 items-center justify-center h-20 w-20 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl text-white shadow-emerald-500/30 shadow-lg">
                        <BookOpen className="h-8 w-8" />
                        <span className="text-[10px] font-bold">تسميع</span>
                    </div>
                    <div>
                        <h2 className="text-3xl font-headline font-black text-emerald-900 drop-shadow-sm">
                            لوحة متابعة استظهار سورة {globalProgress.surahName}
                        </h2>
                        <p className="text-emerald-600/80 font-body text-base mt-2 flex items-center justify-center md:justify-start gap-2">
                            <Star className="h-4 w-4 fill-emerald-500 text-emerald-500" />
                            تقرير مفصل لأولياء الأمور يوضح تقدم الفرسان في التسميع
                        </p>
                    </div>
                </div>

                <div className="w-full md:w-64 bg-slate-50 p-4 rounded-xl border border-slate-100 shrink-0 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-emerald-400 to-emerald-600" />
                    <div className="flex justify-between items-end mb-2">
                        <span className="font-bold text-slate-700 text-sm">معدل الإنجاز العام</span>
                        <span className="font-black text-2xl text-emerald-700">{progressPercentage}%</span>
                    </div>
                    <Progress value={progressPercentage} className="h-3 bg-slate-200 [&>div]:bg-emerald-500" />
                    <div className="text-[10px] text-slate-500 mt-2 font-bold opacity-80 flex justify-between">
                        <span>الآية {globalProgress.fromVerse}</span>
                        <span>الآية {globalProgress.toVerse}</span>
                    </div>
                </div>
            </div>

            {/* Timelines Details */}
            <div className="space-y-6 relative">
                {/* Timeline vertical line */}
                <div className="absolute top-4 bottom-4 right-1/2 md:right-32 w-1 bg-emerald-50/80 rounded-full z-0 hidden md:block" />

                {surahData.wirds.map((wird, idx) => (
                    <div key={wird.id} className="relative z-10 flex flex-col md:flex-row gap-4 md:gap-8 items-start group">

                        {/* Wird Info Bubble (Right side on md) */}
                        <div className="shrink-0 w-full md:w-32 flex flex-col items-center md:items-end z-10">
                            <div className={cn(
                                "flex flex-col items-center justify-center w-full md:w-28 py-3 rounded-2xl shadow-sm border-2 transition-all duration-300",
                                wird.isRecent ? "bg-emerald-50 border-emerald-300" : "bg-white border-slate-100 group-hover:border-emerald-200"
                            )}>
                                <span className={cn(
                                    "text-xs font-bold mb-1",
                                    wird.isRecent ? "text-emerald-600" : "text-slate-500"
                                )}>
                                    الورد {idx + 1}
                                </span>
                                <span className="font-headline font-black text-xl text-slate-800 tracking-tight">
                                    {pad(wird.fromVerse)}<span className="text-slate-300 mx-1">-</span>{pad(wird.toVerse)}
                                </span>
                            </div>

                            {/* Date info */}
                            <div className="flex flex-col items-center md:items-end mt-2 text-slate-500 px-2">
                                <span className="text-sm font-bold text-emerald-700/80">{wird.dayName}</span>
                                <span className="text-[10px]">{wird.hijriDate}</span>
                            </div>
                        </div>

                        {/* Connector dot */}
                        <div className="hidden md:flex shrink-0 w-8 flex-col items-center pt-6 z-10 relative">
                            <div className={cn(
                                "w-4 h-4 rounded-full border-4 shadow-sm",
                                wird.isRecent ? "bg-emerald-500 border-white ring-2 ring-emerald-200" : "bg-white border-emerald-200"
                            )} />
                        </div>

                        {/* Content Area (Left side on md) */}
                        <div className="grow w-full bg-slate-50/50 rounded-2xl p-5 border border-slate-100 relative overflow-hidden transition-shadow hover:shadow-md">

                            {/* Visual Progress Bar for this specific Wird */}
                            <div className="mb-6 bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                                <div className="flex-1 w-full flex items-center gap-3">
                                    <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
                                    <div className="grow">
                                        <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                                            <span>نسبة استظهار الفوج</span>
                                            <span className={wird.successPercentage === 100 ? "text-emerald-600 font-black" : ""}>{wird.successPercentage}%</span>
                                        </div>
                                        <Progress
                                            value={wird.successPercentage}
                                            className="h-2.5 bg-slate-100 [&>div]:bg-amber-400 group-hover:[&>div]:bg-amber-500 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Successful List */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-emerald-700 font-bold border-b border-emerald-100/50 pb-2">
                                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                                        <span>أتموا الحفظ ({wird.successfulReciters.length})</span>
                                    </div>
                                    <div className="space-y-1.5 flex flex-col pr-1 h-[140px] overflow-y-auto custom-scrollbar">
                                        {wird.successfulReciters.length > 0 ? (
                                            wird.successfulReciters.map((student, i) => (
                                                <div key={student.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-50/50 text-sm shadow-sm transition-transform hover:-translate-x-1">
                                                    <span className="text-emerald-300 font-mono text-[10px] w-4 text-center">{i + 1}.</span>
                                                    <span className="font-bold text-slate-700 font-body">{student.fullName}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-slate-400 italic py-2 text-center bg-white/50 rounded-lg border border-dashed border-slate-200 h-full flex items-center justify-center">
                                                لم يسجل أي استظهار
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Pending List */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-amber-700 font-bold border-b border-amber-100/50 pb-2">
                                        <Clock className="h-5 w-5 text-amber-500" />
                                        <span>في طور الحفظ ({wird.pendingReciters.length})</span>
                                    </div>
                                    <div className="space-y-1.5 flex flex-col pr-1 h-[140px] overflow-y-auto custom-scrollbar">
                                        {wird.pendingReciters.length > 0 ? (
                                            wird.pendingReciters.map((student, i) => (
                                                <div key={student.id} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-amber-50/50 text-sm shadow-sm opacity-80 grayscale-[20%] transition-transform hover:-translate-x-1">
                                                    <span className="text-amber-300 font-mono text-[10px] w-4 text-center">{i + 1}.</span>
                                                    <span className="font-medium text-slate-600 font-body">{student.fullName}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-sm text-emerald-600 font-bold italic py-2 text-center bg-emerald-50 rounded-lg border border-dashed border-emerald-200 h-full flex flex-col items-center justify-center gap-1">
                                                <Award className="h-6 w-6" />
                                                ممتاز! جميع الفرسان أتموا الحفظ
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {surahData.wirds.length === 0 && (
                    <div className="text-center py-24 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <Trophy className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-headline font-bold text-slate-600 mb-2">لا يوجد أوراد مسجلة</h3>
                        <p className="text-slate-400 max-w-sm mx-auto">سيظهر هنا المخطط البياني التفصيلي بمجرد البدء في تسجيل أوراد الفوج.</p>
                    </div>
                )}
            </div>

            <div className="mt-8 text-center text-xs text-slate-400 font-bold opacity-60 print:block">
                تم استخراج هذا التقرير تلقائياً من تطبيق متابعة الحلقات. بتاريخ {format(new Date(), 'dd-MM-yyyy')}
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
            `}</style>
        </div>
    );
};
