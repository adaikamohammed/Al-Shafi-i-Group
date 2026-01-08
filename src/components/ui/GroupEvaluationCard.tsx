
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Student, DailySession } from '@/lib/types';
import { Bot, Lightbulb, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface GroupEvaluationCardProps {
    students: Student[];
    sessions: DailySession[];
    groupName?: string | null;
}

export function GroupEvaluationCard({ students, sessions, groupName }: GroupEvaluationCardProps) {

    const evaluationData = useMemo(() => {
        const activeStudents = (students ?? []).filter(s => s.status === 'نشط');
        if (activeStudents.length === 0 || sessions.length === 0) return null;

        const records = (sessions ?? []).flatMap(s => s.records ?? []);
        const totalPossibleAttendances = (sessions ?? []).filter(s => s.sessionType !== 'يوم عطلة').length * activeStudents.length;
        const totalActualAttendances = records.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;

        const attendanceRate = totalPossibleAttendances > 0 ? (totalActualAttendances / totalPossibleAttendances) * 100 : 0;
        
        return {
            attendanceRate,
        };
    }, [students, sessions]);

    const evaluateGroupPerformance = (data: typeof evaluationData) => {
        if (!data) {
             return {
                rating: "لا توجد بيانات كافية",
                suggestions: ["❌ لا توجد سجلات حضور كافية لتقييم الأداء."]
            };
        }
        
        let rating: string;
        let suggestions: string[] = [];

        if (data.attendanceRate >= 90) {
            rating = "ممتاز";
            suggestions.push("👍 أداء ممتاز في الحضور، استمروا في هذا العمل الرائع!");
        } else if (data.attendanceRate >= 75) {
            rating = "جيد";
            suggestions.push("📈 نسبة الحضور جيدة. يمكن تحفيز الطلبة الأقل حضوراً للوصول للمستوى الممتاز.");
        } else {
            rating = "بحاجة لتحسين";
            suggestions.push("⚠️ نسبة الحضور منخفضة. يُنصح بالتواصل مع أولياء أمور الطلبة الأكثر غيابًا.");
        }
        
        // This is a placeholder for financial status check as we don't have payment data here.
        // This can be expanded if payments are passed to this component.
        // if (allDuesArePaid) {
        //     suggestions.push("💰 الوضعية المالية للفوج مستقرة تماماً.");
        // }

        return { rating, suggestions };
    }

    const { rating, suggestions } = evaluateGroupPerformance(evaluationData);
    
    const getRatingBadgeClass = (currentRating: string) => {
        switch(currentRating) {
            case 'ممتاز': return 'bg-green-100 text-green-800 border-green-300';
            case 'جيد': return 'bg-blue-100 text-blue-800 border-blue-300';
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
                    <CardTitle>تقييم الأداء الآلي للفوج</CardTitle>
                </div>
                <CardDescription>
                    تقييم تلقائي لأداء {groupName || 'الفوج'} بناءً على مؤشرات الأداء الرئيسية.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
                <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-muted rounded-lg">
                    <p className="text-lg font-semibold text-muted-foreground">التقييم العام للحضور</p>
                    <Badge className={`text-xl px-4 py-1 border ${getRatingBadgeClass(rating)}`}>{rating}</Badge>
                    {rating === 'ممتاز' && <TrendingUp className="h-10 w-10 text-green-500" />}
                    {rating === 'جيد' && <TrendingUp className="h-10 w-10 text-blue-500" />}
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

    