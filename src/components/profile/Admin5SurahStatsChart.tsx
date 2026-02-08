"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, CheckCircle, BookOpen } from 'lucide-react';
import { Student, SurahMastery } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';

interface Admin5SurahStatsChartProps {
    students: Student[];
    surahProgress: Record<string, SurahMastery>;
}

const SURAH_NAMES = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمـر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الإنفطار", "المطففين", "الإنشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
];

const EVALUATION_COLORS = {
    'ممتاز': 'bg-emerald-600',
    'جيد جداً': 'bg-emerald-500',
    'جيد': 'bg-teal-500',
    'حسن': 'bg-cyan-500',
    'متوسط': 'bg-orange-400',
    'لم يحفظ': 'bg-red-500',
    'غير محفوظ': 'bg-gray-200 dark:bg-gray-700'
};

const EvaluationBar = ({ counts, total, label, isLight }: { counts: Record<string, number>; total: number; label: string; isLight: boolean }) => {
    return (
        <div className="flex flex-col gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
            <div className="flex justify-between items-center mb-1">
                <span className={cn("text-sm font-bold truncate", isLight ? "text-slate-800" : "text-white")}>{label}</span>
                <span className="text-xs opacity-70">{total > 0 ? `${Math.round((Object.values(counts).reduce((a, b) => a + b, 0) / total) * 100)}%` : '0%'}</span>
            </div>

            <div className="h-4 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                {['ممتاز', 'جيد جداً', 'جيد', 'حسن', 'متوسط'].map((evalType) => {
                    const count = counts[evalType] || 0;
                    if (count === 0) return null;
                    const percent = (count / total) * 100;
                    return (
                        <div
                            key={evalType}
                            className={cn("h-full", EVALUATION_COLORS[evalType as keyof typeof EVALUATION_COLORS])}
                            style={{ width: `${percent}%` }}
                            title={`${evalType}: ${count}`}
                        />
                    );
                })}
            </div>

            <div className="flex flex-wrap gap-2 text-[10px] mt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                {['ممتاز', 'جيد جداً', 'جيد', 'حسن', 'متوسط'].map((evalType) => {
                    const count = counts[evalType] || 0;
                    if (count === 0) return null;
                    return (
                        <span key={evalType} className="flex items-center gap-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full", EVALUATION_COLORS[evalType as keyof typeof EVALUATION_COLORS])} />
                            {count}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

export function Admin5SurahStatsChart({ students, surahProgress }: Admin5SurahStatsChartProps) {
    const { user } = useAuth();
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const insights = useMemo(() => {
        if (!students || !surahProgress) return { chartData: [], stats: { totalExcellent: 0, totalMemorized: 0 } };

        const activeStudents = students.filter(s => s.status === 'نشط');
        const activeCount = activeStudents.length;

        const surahStats: Record<number, Record<string, number>> = {};
        for (let i = 1; i <= 114; i++) surahStats[i] = {};

        let totalExcellent = 0;
        let totalMemorized = 0; // Includes everything except 'ممتاز' and 'لم يحفظ'

        Object.entries(surahProgress).forEach(([studentId, progress]) => {
            if (activeStudents.some(s => s.id === studentId)) {
                Object.entries(progress).forEach(([surahId, entry]) => {
                    const sId = parseInt(surahId);
                    const evaluation = entry.admin5Evaluation;

                    if (evaluation && evaluation !== 'لم يحفظ') {
                        surahStats[sId][evaluation] = (surahStats[sId][evaluation] || 0) + 1;

                        if (evaluation === 'ممتاز') {
                            totalExcellent++;
                        } else {
                            totalMemorized++;
                        }
                    } else if (entry.status > 0 && !evaluation) {
                        // Fallback for old data without evaluation
                        const type = entry.status === 2 ? 'ممتاز' : 'جيد';
                        surahStats[sId][type] = (surahStats[sId][type] || 0) + 1;
                        if (type === 'ممتاز') totalExcellent++; else totalMemorized++;
                    }
                });
            }
        });

        const chartData = Object.entries(surahStats)
            .map(([id, counts]) => ({
                id: parseInt(id),
                name: SURAH_NAMES[parseInt(id) - 1],
                counts,
                activeCount
            }))
            .filter(item => Object.keys(item.counts).length > 0)
            .sort((a, b) => {
                const totalA = Object.values(a.counts).reduce((acc, c) => acc + c, 0);
                const totalB = Object.values(b.counts).reduce((acc, c) => acc + c, 0);
                return totalB - totalA;
            })
            .slice(0, 12);

        return { chartData, stats: { totalExcellent, totalMemorized } };
    }, [students, surahProgress]);

    return (
        <Card className={cn(
            "rounded-[2.5rem] border-none overflow-hidden h-full shadow-2xl transition-all duration-500",
            theme.isLight ? "bg-white shadow-slate-200/50" : "bg-slate-950/40 backdrop-blur-xl border border-white/5"
        )}>
            <CardHeader className={cn(
                "border-b pb-6 p-8",
                theme.isLight ? "bg-slate-50 border-slate-100" : "bg-white/5 border-white/10"
            )}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className={cn(
                            "text-2xl font-headline font-bold flex items-center gap-3",
                            theme.isLight ? "text-slate-800" : "text-white"
                        )}>
                            <TrendingUp className="h-6 w-6 text-emerald-500" />
                            بصمة التميز والجودة
                        </CardTitle>
                        <CardDescription className={theme.isLight ? "text-slate-400" : "text-white/40"}>
                            تحليل جودة الحفظ (ممتاز، جيد جداً...) لطلبة الشيخ إبراهيم.
                        </CardDescription>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-center px-4 py-2 rounded-2xl bg-emerald-600/10 border border-emerald-600/20">
                            <p className="text-[10px] uppercase font-bold text-emerald-600">ممتاز</p>
                            <p className={cn("text-lg font-bold", theme.isLight ? "text-slate-800" : "text-white")}>{insights.stats.totalExcellent}</p>
                        </div>
                        <div className="text-center px-4 py-2 rounded-2xl bg-teal-500/10 border border-teal-500/20">
                            <p className="text-[10px] uppercase font-bold text-teal-500">مقبول</p>
                            <p className={cn("text-lg font-bold", theme.isLight ? "text-slate-800" : "text-white")}>{insights.stats.totalMemorized}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                {insights.chartData.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {insights.chartData.map((surah) => (
                            <EvaluationBar
                                key={surah.id}
                                label={surah.name}
                                counts={surah.counts}
                                total={surah.activeCount}
                                isLight={theme.isLight}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
                        <BookOpen className="h-12 w-12 opacity-20" />
                        <p className="font-medium">لم يتم تسجيل تقييمات تفصيلية بعد.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
