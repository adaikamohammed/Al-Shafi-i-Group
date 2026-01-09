
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Student, DailySession, DailyReport } from '@/lib/types';
import { Bot, Lightbulb, AlertTriangle, TrendingUp, TrendingDown, Smile, Frown, Meh } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { format, startOfWeek, endOfWeek, subWeeks, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

interface GroupEvaluationCardProps {
    students: Student[];
    sessions: Record<string, DailySession>;
    reports: DailyReport[];
    groupName?: string | null;
}

const POSITIVE_REPORT_CATEGORIES = ["شكر", "اقتراح"];
const NEGATIVE_REPORT_CATEGORIES = ["شكوى"];

const calculateSentimentForWeek = (
    students: Student[], 
    sessions: Record<string, DailySession>, 
    reports: DailyReport[], 
    weekStartDate: Date, 
    weekEndDate: Date
) => {
    const activeStudents = (students ?? []).filter(s => s.status === 'نشط');
    if (activeStudents.length === 0) return { score: 0, attendanceRate: 0, badBehaviorCount: 0 };
    
    const weeklySessions = Object.values(sessions).flatMap(s => Object.values(s)).filter(s => {
        if (!s || !s.date) return false;
        const sessionDate = parseISO(s.date);
        return sessionDate >= weekStartDate && sessionDate <= weekEndDate;
    });

    const weeklyReports = reports.filter(r => {
        if (!r || !r.date) return false;
        const reportDate = parseISO(r.date);
        return reportDate >= weekStartDate && reportDate <= weekEndDate;
    });

    const records = weeklySessions.flatMap(s => s.records ?? []);
    
    const totalPossibleAttendances = weeklySessions.filter(s => s.sessionType !== 'يوم عطلة').length * activeStudents.length;
    const totalActualAttendances = records.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
    const attendanceScore = totalPossibleAttendances > 0 ? (totalActualAttendances / totalPossibleAttendances) * 40 : 0;
    const attendanceRate = totalPossibleAttendances > 0 ? (totalActualAttendances / totalPossibleAttendances) * 100 : 0;

    const totalBehaviorRecords = records.filter(r => r.behavior).length;
    const positiveBehavior = records.filter(r => r.behavior === 'هادئ').length;
    const neutralBehavior = records.filter(r => r.behavior === 'متوسط').length;
    const badBehaviorCount = records.filter(r => r.behavior === 'غير منضبط').length;
    const disciplineScore = totalBehaviorRecords > 0 ? ((positiveBehavior * 1 + neutralBehavior * 0.5) / totalBehaviorRecords) * 30 : 0;
    
    const positiveReports = weeklyReports.filter(r => POSITIVE_REPORT_CATEGORIES.includes(r.category)).length;
    const negativeReports = weeklyReports.filter(r => NEGATIVE_REPORT_CATEGORIES.includes(r.category)).length;
    let reportScore = 15;
    if (weeklyReports.length > 0) {
        reportScore = 15 + (positiveReports * 5) - (negativeReports * 5);
        reportScore = Math.max(0, Math.min(30, reportScore));
    }
    
    return { score: attendanceScore + disciplineScore + reportScore, attendanceRate, badBehaviorCount };
}


export function GroupEvaluationCard({ students, sessions, reports, groupName }: GroupEvaluationCardProps) {

    const weeklySentiments = useMemo(() => {
        const data = Array.from({ length: 4 }).map((_, i) => {
            const weekEndDate = endOfWeek(subWeeks(new Date(), i), { weekStartsOn: 6 });
            const weekStartDate = startOfWeek(weekEndDate, { weekStartsOn: 6 });
            
            const { score } = calculateSentimentForWeek(students, sessions, reports, weekStartDate, weekEndDate);
            
            return {
                name: format(weekStartDate, 'dd/MM', { locale: ar }),
                score: parseFloat(score.toFixed(1)),
            };
        }).reverse();
        return data;
    }, [students, sessions, reports]);

    const currentSentimentData = useMemo(() => {
        const today = new Date();
        const weekStartDate = startOfWeek(today, { weekStartsOn: 6 });
        const weekEndDate = endOfWeek(today, { weekStartsOn: 6 });

        const { score, attendanceRate, badBehaviorCount } = calculateSentimentForWeek(students, sessions, reports, weekStartDate, weekEndDate);

        return {
            sentimentIndex: score,
            attendanceRate,
            badBehaviorCount
        };
    }, [students, sessions, reports]);

    const evaluateGroupPerformance = (sentimentIndex: number, attendanceRate: number, badBehaviorCount: number) => {
        let rating: string;
        let suggestions: string[] = [];
        let icon: React.ReactNode;
        let ratingText: string;

        if (sentimentIndex >= 85) {
            rating = "ممتاز";
            ratingText = "الفوج في قمة عطائه.. استمروا!";
            icon = <TrendingUp className="h-10 w-10 text-green-500" />;
        } else if (sentimentIndex >= 60) {
            rating = "جيد ومستقر";
            ratingText = "أداء مستقر، نحتاج لدفعة بسيطة نحو التميز.";
            icon = <Smile className="h-10 w-10 text-blue-500" />;
             if (badBehaviorCount > 2) {
                suggestions.push("📈 لوحظ تكرار السلوك غير المنضبط. قد يكون من الجيد تخصيص وقت للتوجيه.");
            }
        } else {
            rating = "بحاجة لتحسين";
            ratingText = "مؤشر الالتزام في هبوط.. ربما حان وقت مكافأة أو نشاط لكسر الروتين.";
            icon = <Frown className="h-10 w-10 text-red-500" />;
        }
        
        if (attendanceRate < 75) {
            suggestions.push("📉 نسبة الحضور منخفضة. يُنصح بالتواصل مع أولياء أمور الطلبة الأكثر غيابًا.");
        }

        const weeklyMasteryChange = 0; // Placeholder logic
        if (weeklyMasteryChange < 0 && sentimentIndex < 85) {
            suggestions.push("📚 الحفظ في تباطؤ. ربما يحتاج الطلاب لمسابقة سريعة لتحفيزهم.");
        }
        
        return { rating, suggestions, icon, ratingText };
    }

    const { rating, suggestions, icon, ratingText } = evaluateGroupPerformance(
        currentSentimentData.sentimentIndex, 
        currentSentimentData.attendanceRate,
        currentSentimentData.badBehaviorCount
    );
    
    const getRatingBadgeClass = (currentRating: string) => {
        switch(currentRating) {
            case 'ممتاز': return 'bg-green-100 text-green-800 border-green-300';
            case 'جيد ومستقر': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'بحاجة لتحسين': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    }
    
    if (Object.keys(sessions).length === 0) {
        return (
            <Card className="md:col-span-2 lg:col-span-4">
                 <CardHeader>
                    <div className="flex items-center gap-2">
                        <Bot className="h-6 w-6 text-primary" />
                        <CardTitle>رادار الروح المعنوية للفوج</CardTitle>
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
        <Card className="md:col-span-2 lg:col-span-4">
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
                <div className="flex flex-col justify-between space-y-4 p-6 bg-muted rounded-lg">
                   <div className="flex justify-between items-start">
                     <div>
                        <p className="text-lg font-semibold text-muted-foreground">مؤشر الالتزام الحالي</p>
                        <Badge className={`text-xl px-4 py-1 border ${getRatingBadgeClass(rating)}`}>{rating}</Badge>
                     </div>
                     {icon}
                   </div>
                   <p className="text-sm font-medium">{ratingText}</p>
                </div>
                <div className="space-y-2">
                     <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-lg">منحنى الالتزام (آخر 4 أسابيع)</h4>
                    </div>
                    <div className="h-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={weeklySentiments} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="sentimentGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis domain={[0, 100]} fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '0.5rem', direction: 'rtl', fontSize: '12px', padding: '4px 8px' }}
                                    formatter={(value: number) => [`${value}%`, 'الالتزام']}
                                />
                                <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#sentimentGradient)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </CardContent>
            {suggestions.length > 0 && (
                <div className="p-4 border-t space-y-2">
                    <h4 className="font-semibold flex items-center gap-2"><Lightbulb className="text-yellow-500" /> نصائح ذكية</h4>
                    <ul className="list-disc pr-5 space-y-1 text-sm text-muted-foreground">
                        {suggestions.map((tip, i) => <li key={i}>{tip}</li>)}
                    </ul>
                </div>
            )}
        </Card>
    );
}
