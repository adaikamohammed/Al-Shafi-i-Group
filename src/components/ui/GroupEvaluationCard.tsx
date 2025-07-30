
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Student, DailySession, DailyReport } from '@/lib/types';
import { Bot, Lightbulb } from 'lucide-react';

interface GroupEvaluationCardProps {
    students: Student[];
    sessions: DailySession[];
    reports: DailyReport[];
    groupName?: string | null;
}

export function GroupEvaluationCard({ students, sessions, reports, groupName }: GroupEvaluationCardProps) {

    const evaluationData = useMemo(() => {
        const activeStudents = (students ?? []).filter(s => s.status === 'نشط');
        if (activeStudents.length === 0) return null;

        const inactiveStudentsCount = (students ?? []).filter(s => s.status === 'غائب طويل' || s.status === 'مطرود').length;

        const totalPossibleAttendances = (sessions ?? []).filter(s => s.sessionType !== 'يوم عطلة').length * activeStudents.length;
        const totalActualAttendances = (sessions ?? [])
            .flatMap(s => s.records ?? [])
            .filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;

        const attendanceRate = totalPossibleAttendances > 0 ? (totalActualAttendances / totalPossibleAttendances) * 100 : 100;
        
        const totalMemorizedSurahs = (students ?? []).reduce((sum, s) => sum + (s.memorizedSurahsCount || 0), 0);
        const averageProgress = (students ?? []).length > 0 ? totalMemorizedSurahs / (students ?? []).length : 0;
        
        const numReportsThisMonth = (reports ?? []).length;
        const numComplaints = (reports ?? []).filter(r => r.category === 'شكوى').length;

        return {
            attendanceRate,
            averageProgress,
            numReportsThisMonth,
            numComplaints,
            numInactiveStudents: inactiveStudentsCount,
        };
    }, [students, sessions, reports]);

    if (!evaluationData) {
        return null; // Or a placeholder card
    }

    const evaluateGroupPerformance = (data: typeof evaluationData) => {
        let score = 0;
        if (!data) return 0;

        // Attendance weight
        if (data.attendanceRate >= 90) score += 25;
        else if (data.attendanceRate >= 75) score += 20;
        else if (data.attendanceRate >= 50) score += 10;

        // Memorization progress weight
        if (data.averageProgress >= 5) score += 25;
        else if (data.averageProgress >= 3) score += 15;
        else score += 5;

        // Reporting weight
        if (data.numReportsThisMonth >= 10) score += 20;
        else if (data.numReportsThisMonth >= 5) score += 10;

        // Complaints weight (negative)
        if (data.numComplaints === 0) score += 15;
        else if (data.numComplaints <= 2) score += 5;

        // Inactive students weight (negative)
        if (data.numInactiveStudents === 0) score += 15;
        else if (data.numInactiveStudents <= 2) score += 5;

        return Math.min(score, 100);
    }

    const generateSuggestions = (data: typeof evaluationData) => {
        let suggestions: string[] = [];
        if (!data) return [];

        if (data.attendanceRate < 70)
            suggestions.push("📌 ضع خطة تحفيزية لتحسين حضور الطلبة");

        if (data.averageProgress < 3)
            suggestions.push("📖 خصص وقتًا إضافيًا للمراجعة اليومية");

        if (data.numReportsThisMonth < 5)
            suggestions.push("📝 حاول كتابة تقرير يومي أو أسبوعي لتوثيق الأداء");

        if (data.numComplaints > 2)
            suggestions.push("⚠️ راجع أسباب الشكاوى وحدد الطلاب المعنيين");

        if (data.numInactiveStudents > 3)
            suggestions.push("📋 تواصل مع أولياء أمور الطلبة الغائبين لإعادة دمجهم");
        
        if(suggestions.length === 0) {
            suggestions.push("🎉 أداء الفوج ممتاز هذا الشهر، استمروا في العطاء!")
        }

        return suggestions;
    }

    const score = evaluateGroupPerformance(evaluationData);
    const rating = score >= 90 ? "ممتاز" : score >= 75 ? "جيد جدًا" : score >= 60 ? "جيد" : "ضعيف";
    const suggestions = generateSuggestions(evaluationData);

    const getRatingBadgeClass = (currentRating: string) => {
        switch(currentRating) {
            case 'ممتاز': return 'bg-green-100 text-green-800';
            case 'جيد جدًا': return 'bg-blue-100 text-blue-800';
            case 'جيد': return 'bg-yellow-100 text-yellow-800';
            case 'ضعيف': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-primary" />
                    <CardTitle>تقييم الأداء الآلي للفوج</CardTitle>
                </div>
                <CardDescription>
                    تقييم تلقائي لأداء {groupName || 'الفوج'} بناءً على مؤشرات الأداء الرئيسية خلال الفترة المحددة.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-muted rounded-lg">
                    <p className="text-lg font-semibold text-muted-foreground">النتيجة النهائية</p>
                    <div className="text-6xl font-bold text-primary">{score}<span className="text-2xl text-muted-foreground">/100</span></div>
                    <Badge className={`text-lg px-4 py-1 ${getRatingBadgeClass(rating)}`}>{rating}</Badge>
                </div>
                <div className="space-y-4">
                     <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500"/>
                        <h4 className="font-semibold text-lg">اقتراحات لتحسين الأداء</h4>
                    </div>
                    <ul className="space-y-2 list-inside">
                        {suggestions.map((suggestion, index) => (
                            <li key={index} className="text-sm text-muted-foreground p-2 bg-background rounded-md">
                                {suggestion}
                            </li>
                        ))}
                    </ul>
                </div>
            </CardContent>
        </Card>
    );
}
