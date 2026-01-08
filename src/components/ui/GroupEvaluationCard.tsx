
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Student, DailySession, DailyReport } from '@/lib/types';
import { Bot, Lightbulb, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface GroupEvaluationCardProps {
    students: Student[];
    sessions: DailySession[];
    reports: DailyReport[];
    groupName?: string | null;
}

const POSITIVE_REPORT_CATEGORIES = ["شكر", "اقتراح"];
const NEGATIVE_REPORT_CATEGORIES = ["شكوى"];

export function GroupEvaluationCard({ students, sessions, reports, groupName }: GroupEvaluationCardProps) {

    const evaluationData = useMemo(() => {
        const activeStudents = (students ?? []).filter(s => s.status === 'نشط');
        if (activeStudents.length === 0 || sessions.length === 0) return null;

        const records = (sessions ?? []).flatMap(s => s.records ?? []);
        
        // Attendance Score (40%)
        const totalPossibleAttendances = (sessions ?? []).filter(s => s.sessionType !== 'يوم عطلة').length * activeStudents.length;
        const totalActualAttendances = records.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
        const attendanceScore = totalPossibleAttendances > 0 ? (totalActualAttendances / totalPossibleAttendances) * 40 : 0;

        // Discipline Score (30%)
        const totalBehaviorRecords = records.filter(r => r.behavior).length;
        const positiveBehavior = records.filter(r => r.behavior === 'هادئ').length;
        const neutralBehavior = records.filter(r => r.behavior === 'متوسط').length;
        const disciplineScore = totalBehaviorRecords > 0 ? ((positiveBehavior * 1 + neutralBehavior * 0.5) / totalBehaviorRecords) * 30 : 0;
        
        // Reports/Feedback Score (30%)
        const positiveReports = (reports ?? []).filter(r => POSITIVE_REPORT_CATEGORIES.includes(r.category)).length;
        const negativeReports = (reports ?? []).filter(r => NEGATIVE_REPORT_CATEGORIES.includes(r.category)).length;
        let reportScore = 15; // Start with neutral 15/30
        if (reports.length > 0) {
            reportScore = 15 + (positiveReports * 5) - (negativeReports * 5);
            reportScore = Math.max(0, Math.min(30, reportScore)); // Clamp between 0 and 30
        }
        
        const sentimentIndex = attendanceScore + disciplineScore + reportScore;
        
        return {
            sentimentIndex,
            attendanceRate: totalPossibleAttendances > 0 ? (totalActualAttendances / totalPossibleAttendances) * 100 : 0,
            positiveReports,
            negativeReports,
            positiveBehaviorCount: positiveBehavior,
            totalBehaviorRecords
        };
    }, [students, sessions, reports]);

    const evaluateGroupPerformance = (data: typeof evaluationData) => {
        if (!data) {
             return {
                rating: "لا توجد بيانات",
                suggestions: ["❌ لا توجد سجلات حضور كافية لتقييم الأداء."]
            };
        }
        
        let rating: string;
        let suggestions: string[] = [];

        if (data.sentimentIndex >= 85) {
            rating = "ممتاز";
            suggestions.push("👍 أداء ممتاز وروح معنوية عالية في الفوج. استمروا في هذا العمل الرائع!");
        } else if (data.sentimentIndex >= 60) {
            rating = "جيد ومستقر";
            suggestions.push("📈 أداء الفوج جيد. يمكن التركيز على الجوانب الأقل أداءً لدفعه نحو التميز.");
        } else {
            rating = "بحاجة لتحسين";
            suggestions.push("⚠️ هناك تراجع في بعض المؤشرات. يُنصح بمراجعة أسباب تراجع الحضور أو الانضباط.");
        }
        
        if(data.attendanceRate < 75 && data.sentimentIndex < 85) {
            suggestions.push("📉 نسبة الحضور منخفضة. يُنصح بالتواصل مع أولياء أمور الطلبة الأكثر غيابًا.");
        }
        
        if(data.negativeReports > data.positiveReports) {
             suggestions.push("📝 الشكاوى أكثر من رسائل الشكر. قد يكون هناك استياء يتطلب المتابعة.");
        }

        if(data.totalBehaviorRecords > 0 && (data.positiveBehaviorCount / data.totalBehaviorRecords) < 0.6) {
             suggestions.push("⚖️ مستوى الانضباط العام متوسط. يمكن تحفيز الطلاب على الهدوء والتركيز أكثر.");
        }


        return { rating, suggestions };
    }

    const { rating, suggestions } = evaluateGroupPerformance(evaluationData);
    
    const getRatingBadgeClass = (currentRating: string) => {
        switch(currentRating) {
            case 'ممتاز': return 'bg-green-100 text-green-800 border-green-300';
            case 'جيد ومستقر': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'بحاجة لتحسين': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }
    
    if (!evaluationData) {
        return (
            <Card className="md:col-span-2">
                 <CardHeader>
                    <div className="flex items-center gap-2">
                        <Bot className="h-6 w-6 text-primary" />
                        <CardTitle>تقييم الأداء الآلي للفوج</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center p-8">
                     <AlertTriangle className="h-12 w-12 text-yellow-500 mb-2"/>
                    <p className="font-bold">لا توجد بيانات كافية</p>
                    <p className="text-sm text-muted-foreground">لا يمكن حساب التقييم بدون سجلات حضور.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="md:col-span-2">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-primary" />
                    <CardTitle>رادار الروح المعنوية للفوج</CardTitle>
                </div>
                <CardDescription>
                    تقييم تلقائي لأداء {groupName || 'الفوج'} بناءً على مؤشرات الحضور، الانضباط، والتقارير.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-muted rounded-lg">
                    <p className="text-lg font-semibold text-muted-foreground">مؤشر السعادة والالتزام</p>
                    <Badge className={`text-xl px-4 py-1 border ${getRatingBadgeClass(rating)}`}>{rating}</Badge>
                    {rating === 'ممتاز' && <TrendingUp className="h-10 w-10 text-green-500" />}
                    {(rating === 'جيد ومستقر') && <TrendingUp className="h-10 w-10 text-blue-500" />}
                    {rating === 'بحاجة لتحسين' && <TrendingDown className="h-10 w-10 text-red-500" />}
                </div>
                <div className="space-y-4">
                     <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500"/>
                        <h4 className="font-semibold text-lg">ملاحظات واقتراحات</h4>
                    </div>
                    <ul className="space-y-2 list-inside">
                        {(suggestions ?? []).map((suggestion, index) => (
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
