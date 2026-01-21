"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, TrendingUp, AlertCircle, Award, Target, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistantReportProps {
    data: any[]; // Aggregated data
    timeframe: string;
}

export const AssistantReport = ({ data, timeframe }: AssistantReportProps) => {
    // Logic to find top/bottom groups for the report text
    const topAttendance = [...data].sort((a, b) => b.attendanceRate - a.attendanceRate)[0];
    const topEvaluation = [...data].sort((a, b) => b.evaluationScore - a.evaluationScore)[0];
    const averageAttendance = data.reduce((acc, curr) => acc + curr.attendanceRate, 0) / (data.length || 1);

    const timeframeText = {
        'weekly': 'الأسبوعي',
        'monthly': 'الشهري',
        'seasonal': 'الفصلي',
        'yearly': 'السنوي'
    }[timeframe as keyof typeof timeframeText] || 'الدوري';

    return (
        <Card className="border-none shadow-2xl bg-gradient-to-br from-indigo-900/40 via-slate-900/40 to-emerald-900/20 backdrop-blur-xl border border-white/10">
            <CardHeader className="border-b border-white/10 pb-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-headline font-black flex items-center gap-3 text-white">
                            <Sparkles className="h-6 w-6 text-amber-400 animate-pulse" />
                            تقرير المساعد الإداري الذكي
                        </CardTitle>
                        <CardDescription className="text-white/60 font-body">
                            تحليل معمق لأداء المدرسة للمستوى {timeframeText}
                        </CardDescription>
                    </div>
                    <div className="px-4 py-2 bg-white/10 rounded-full border border-white/20 text-xs font-bold text-amber-200">
                        {new Date().toLocaleDateString('ar-DZ')}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-8 space-y-10">
                {/* 1. School Summary */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 text-emerald-400">
                        <Target className="h-5 w-5" />
                        <h3 className="font-headline font-bold text-lg">نظرة عامة على المدرسة</h3>
                    </div>
                    <p className="text-white/80 leading-relaxed font-body text-right">
                        بناءً على البيانات المجمعة لجميع الأفواج، سجلت المدرسة معدل حضور عام بنسبة
                        <span className="text-emerald-400 font-bold mx-1">%{averageAttendance.toFixed(1)}</span>.
                        يظهر الأداء العام استقراراً ملحوظاً، مع تميز واضح في ملف المراجعة والحفظ خلال هذه الفترة.
                    </p>
                </section>

                {/* 2. Group Breakdown */}
                <section className="space-y-4">
                    <div className="flex items-center gap-3 text-amber-400">
                        <Award className="h-5 w-5" />
                        <h3 className="font-headline font-bold text-lg">تحليل أداء الأفواج</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.map((group, idx) => (
                            <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-white">{group.groupName}</span>
                                    <div className={cn(
                                        "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                                        group.attendanceRate > 90 ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                                    )}>
                                        {group.attendanceRate > 90 ? 'أداء ممتاز' : 'أداء مستقر'}
                                    </div>
                                </div>
                                <div className="text-xs text-white/60 font-body leading-loose">
                                    • حقق الفوج أعلى نسبة التزام بالمراجعة (%{group.reviewRate}). <br />
                                    • مستوى السلوك العام للفوج سجل %{group.behaviorScore} بمتوسط "هادئ".
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 3. Administrative Recommendations */}
                <section className="p-6 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 space-y-4">
                    <div className="flex items-center gap-3 text-amber-500">
                        <AlertCircle className="h-5 w-5" />
                        <h3 className="font-headline font-bold text-lg">توصيات إدارية</h3>
                    </div>
                    <ul className="space-y-3 text-sm text-amber-200/80 font-body">
                        <li className="flex items-start gap-2">
                            <ChevronLeft className="h-4 w-4 mt-0.5 shrink-0" />
                            تشجيع شيخ {topAttendance?.groupName} على الحفاظ على هذا المستوى المتميز من الحضور.
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronLeft className="h-4 w-4 mt-0.5 shrink-0" />
                            توزيع نقاط إضافية للطلاب المتميزين في {topEvaluation?.groupName} لتعزيز جودة الحفظ.
                        </li>
                        <li className="flex items-start gap-2">
                            <ChevronLeft className="h-4 w-4 mt-0.5 shrink-0" />
                            مراجعة وضع الأفواج التي سجلت معدل مراجعة أقل من %80 لتقديم دعم توجيهي.
                        </li>
                    </ul>
                </section>
            </CardContent>
        </Card>
    );
};
