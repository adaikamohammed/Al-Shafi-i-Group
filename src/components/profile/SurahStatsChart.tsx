"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, CheckCircle, BookOpen, Layers } from 'lucide-react';
import { Student, SurahMastery } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';

interface SurahStatsChartProps {
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

const CircularProgress = ({ mastered, memorized, total, label, isLight }: { mastered: number; memorized: number; total: number; label: string; isLight: boolean }) => {
    const size = 80;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const masteredPercent = total === 0 ? 0 : (mastered / total) * 100;
    const memorizedPercent = total === 0 ? 0 : (memorized / total) * 100;

    const masteredOffset = circumference - (masteredPercent / 100) * circumference;
    const memorizedOffset = circumference - ((masteredPercent + memorizedPercent) / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
            <div className="relative" style={{ width: size, height: size }}>
                {/* Background Circle */}
                <svg className="transform -rotate-90 w-full h-full">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={isLight ? "#f1f5f9" : "#1e293b"}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                    />
                    {/* Memorized Part */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#6ee7b7" // emerald-300
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={memorizedOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                    />
                    {/* Mastered Part */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#047857" // emerald-700
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={masteredOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className={cn("text-sm font-bold", isLight ? "text-slate-800" : "text-white")}>
                        {Math.round(masteredPercent + memorizedPercent)}%
                    </span>
                </div>
            </div>
            <div className="text-center">
                <p className={cn("text-xs font-headline font-bold mb-1", isLight ? "text-slate-700" : "text-slate-200")}>{label}</p>
                <div className="flex items-center gap-2 justify-center opacity-60 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-700" /> {mastered}
                    </span>
                    <span className="text-[10px] flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" /> {memorized}
                    </span>
                </div>
            </div>
        </div>
    );
};

export function SurahStatsChart({ students, surahProgress }: SurahStatsChartProps) {
    const { user } = useAuth();
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const insights = useMemo(() => {
        if (!students || !surahProgress) return { chartData: [], stats: { totalMastered: 0, totalMemorized: 0 } };

        const activeStudents = (students || []).filter(s => s && s.status === 'نشط');
        const activeCount = activeStudents.length;

        const surahCounts: Record<number, { mastered: number; memorized: number; total: number }> = {};
        for (let i = 1; i <= 114; i++) surahCounts[i] = { mastered: 0, memorized: 0, total: 0 };

        let totalMastered = 0;
        let totalMemorized = 0;

        Object.entries(surahProgress).forEach(([studentId, progress]) => {
            if (activeStudents.some(s => s.id === studentId)) {
                if (progress && typeof progress === 'object') {
                    Object.entries(progress).forEach(([surahId, entry]) => {
                        const sId = parseInt(surahId);
                        if (!surahCounts[sId]) return;
                        if (entry && entry.status === 2) {
                            surahCounts[sId].mastered++;
                            totalMastered++;
                        } else if (entry && entry.status === 1) {
                            surahCounts[sId].memorized++;
                            totalMemorized++;
                        }
                    });
                }
            }
        });

        const chartData = Object.entries(surahCounts)
            .map(([id, stats]) => ({
                id: parseInt(id),
                name: SURAH_NAMES[parseInt(id) - 1],
                mastered: stats.mastered,
                memorized: stats.memorized,
                total: stats.mastered + stats.memorized,
                activeCount: activeCount
            }))
            .filter(item => item.total > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, 12); // Grid of 12 (3x4 or 4x3)

        return { chartData, stats: { totalMastered, totalMemorized } };
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
                            بصمة الإنجاز الجماعي
                        </CardTitle>
                        <CardDescription className={theme.isLight ? "text-slate-400" : "text-white/40"}>
                            نسب إنجاز الفوج في حفظ وإتقان السور.
                        </CardDescription>
                    </div>

                    <div className="flex gap-4">
                        <div className="text-center px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-[10px] uppercase font-bold text-emerald-500">متقن</p>
                            <p className={cn("text-lg font-bold", theme.isLight ? "text-slate-800" : "text-white")}>{insights.stats.totalMastered}</p>
                        </div>
                        <div className="text-center px-4 py-2 rounded-2xl bg-emerald-300/10 border border-emerald-300/20">
                            <p className="text-[10px] uppercase font-bold text-emerald-400">محفوظ</p>
                            <p className={cn("text-lg font-bold", theme.isLight ? "text-slate-800" : "text-white")}>{insights.stats.totalMemorized}</p>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-8">
                {insights.chartData.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                        {insights.chartData.map((surah) => (
                            <CircularProgress
                                key={surah.id}
                                label={surah.name}
                                mastered={surah.mastered}
                                memorized={surah.memorized}
                                total={surah.activeCount}
                                isLight={!!theme.isLight}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-4">
                        <BookOpen className="h-12 w-12 opacity-20" />
                        <p className="font-medium">بانتظار ثمار الغرس.. لا توجد إحصائيات للحفظ بعد.</p>
                    </div>
                )}

                <div className="mt-8 flex flex-wrap justify-center gap-6 text-[11px] font-bold opacity-70">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-emerald-700" />
                        <span className={theme.isLight ? "text-slate-600" : "text-slate-400"}>نسبة الإتقان بامتياز</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-emerald-300" />
                        <span className={theme.isLight ? "text-slate-600" : "text-slate-400"}>نسبة الحفظ الأولي</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-800" />
                        <span className={theme.isLight ? "text-slate-600" : "text-slate-400"}>غير محفوظ بعد</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
