"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { BookOpen, TrendingUp } from 'lucide-react';
import { Student } from '@/lib/types';

interface SurahStatsChartProps {
    students: Student[];
    surahProgress: Record<string, Record<string | number, number>>;
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

export function SurahStatsChart({ students, surahProgress }: SurahStatsChartProps) {

    const chartData = useMemo(() => {
        if (!students || !surahProgress) return [];

        const activeStudentIds = new Set(students.filter(s => s.status === 'نشط').map(s => s.id));

        // Initialize counts
        const surahCounts: Record<number, number> = {};
        for (let i = 1; i <= 114; i++) surahCounts[i] = 0;

        // Iterate progress
        Object.entries(surahProgress).forEach(([studentId, progress]) => {
            if (activeStudentIds.has(studentId)) {
                Object.entries(progress).forEach(([surahId, status]) => {
                    const sId = parseInt(surahId);
                    if (status === 2) { // 2 = Mastered
                        surahCounts[sId] = (surahCounts[sId] || 0) + 1;
                    }
                });
            }
        });

        // Transform to array and sort
        const data = Object.entries(surahCounts)
            .map(([id, count]) => ({
                id: parseInt(id),
                name: SURAH_NAMES[parseInt(id) - 1],
                count: count
            }))
            .filter(item => item.count > 0) // Only show surahs that have been mastered by at least one student
            .sort((a, b) => b.count - a.count)
            .slice(0, 15); // Top 15

        return data;
    }, [students, surahProgress]);

    return (
        <Card className="rounded-[1.5rem] border-none shadow-sm overflow-hidden h-full">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
                <CardTitle className="text-xl font-headline flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" /> السور الأكثر حفظاً في الفوج
                </CardTitle>
                <CardDescription>
                    إحصائية تظهر السور التي أتم حفظها وإتقانها أكبر عدد من الطلبة.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="h-[350px] w-full" dir="ltr">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
                                <XAxis
                                    dataKey="name"
                                    angle={-45}
                                    textAnchor="end"
                                    interval={0}
                                    height={80}
                                    tick={{ fontSize: 12, fill: '#666' }}
                                />
                                <YAxis allowDecimals={false} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" name="عدد الحفاظ" radius={[8, 8, 0, 0]} barSize={40}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index < 3 ? '#10b981' : '#3b82f6'} fillOpacity={0.8} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            لا توجد بيانات كافية لعرض الإحصائيات.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
