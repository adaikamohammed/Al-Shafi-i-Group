
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Student, DailySession, DailyReport } from '@/lib/types';
import { Bot, Lightbulb, AlertTriangle } from 'lucide-react';

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
        
        const records = (sessions ?? []).flatMap(s => s.records ?? []);
        const totalPossibleAttendances = (sessions ?? []).filter(s => s.sessionType !== 'يوم عطلة').length * activeStudents.length;
        const totalActualAttendances = records.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;

        const attendanceRate = totalPossibleAttendances > 0 ? (totalActualAttendances / totalPossibleAttendances) * 100 : 0;
        
        const totalMemorizedSurahs = (students ?? []).reduce((sum, s) => sum + (s.memorizedSurahsCount || 0), 0);
        const averageProgress = activeStudents.length > 0 ? totalMemorizedSurahs / activeStudents.length : 0;
        
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

    const isValidDataSet = (data: typeof evaluationData) => {
        if (!data) return false;
        return data.numReportsThisMonth > 0 || data.attendanceRate > 0 || data.averageProgress > 0 || sessions.length > 0;
    }

    const evaluateGroupPerformance = (data: typeof evaluationData) => {
        if (!data || !isValidDataSet(data)) {
             return {
                score: null,
                rating: "لا توجد بيانات",
                suggestions: ["❌ لا توجد بيانات كافية لحساب الأداء لهذا الشهر."]
            };
        }
        
        let score = 0;

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

        const finalScore = Math.min(score, 100);
        const rating = finalScore >= 90 ? "ممتاز" : finalScore >= 75 ? "جيد جدًا" : finalScore >= 60 ? "جيد" : "ضعيف";
        const suggestions = generateSuggestions(data, rating);

        return { score: finalScore, rating, suggestions };
    }

    const generateSuggestions = (data: typeof evaluationData, rating: string) => {
        if (!data) return [];
        let suggestions: string[] = [];

        // General suggestions based on rating
        if (rating === "ضعيف") {
            suggestions.push("🧠 خصص وقتًا إضافيًا للمراجعة اليومية وركز على تحفيز الطلبة.");
        }
        if (rating === "جيد") {
            suggestions.push("✅ الاستمرار على نفس الوتيرة مع الانتباه للطلبة المتأخرين في الحفظ أو الغياب.");
        }
        if (rating === "ممتاز" || rating === "جيد جدًا") {
            suggestions.push("🌟 حافظ على نفس الأداء مع تشجيع الاستمرارية وتنفيذ مسابقات بين الطلبة.");
        }

        // Specific suggestions based on stats
        if (data.attendanceRate < 70) {
            suggestions.push("📍 غياب مرتفع! تواصل مع أولياء أمور الطلبة الأكثر غيابًا.");
        }
        if (data.averageProgress < 2) {
            suggestions.push("📚 مستوى الحفظ ضعيف — أضف جلسة مراجعة يومية مكثفة.");
        }
        if (data.numComplaints >= 3) {
            suggestions.push("🚨 الشكاوى مرتفعة — راجع أسبابها مع الطلاب المعنيين بسرعة.");
        }
        if (data.numInactiveStudents >= 2) {
            suggestions.push("👥 بعض الطلبة غير نشطين، خصص جلسات فردية معهم.");
        }
         if (data.numReportsThisMonth < 5) {
            suggestions.push("📝 حاول كتابة تقارير أكثر لتوثيق الأداء والمشاكل بشكل أفضل.");
        }
        
        if(suggestions.length === 0) {
            suggestions.push("🎉 أداء الفوج ممتاز هذا الشهر، استمروا في العطاء!")
        }

        return suggestions;
    }

    const { score, rating, suggestions } = evaluateGroupPerformance(evaluationData);
    
    const getRatingBadgeClass = (currentRating: string) => {
        switch(currentRating) {
            case 'ممتاز': return 'bg-green-100 text-green-800 border-green-300';
            case 'جيد جدًا': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'جيد': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'ضعيف': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }
    
    if (!evaluationData) {
        return null;
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
                    {score !== null ? (
                        <>
                            <p className="text-lg font-semibold text-muted-foreground">النتيجة النهائية</p>
                            <div className="text-6xl font-bold text-primary">{score}<span className="text-2xl text-muted-foreground">/100</span></div>
                            <Badge className={`text-lg px-4 py-1 border ${getRatingBadgeClass(rating)}`}>{rating}</Badge>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center">
                            <AlertTriangle className="h-12 w-12 text-yellow-500 mb-2"/>
                            <p className="font-bold">لا توجد بيانات</p>
                            <p className="text-sm text-muted-foreground">لا يمكن حساب التقييم لهذا الشهر.</p>
                        </div>
                    )}
                </div>
                <div className="space-y-4">
                     <div className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500"/>
                        <h4 className="font-semibold text-lg">اقتراحات لتحسين الأداء</h4>
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
