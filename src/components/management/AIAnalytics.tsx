"use client";

import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Brain, TrendingDown, TrendingUp, AlertTriangle, Lightbulb, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIAnalyticsProps {
    sheikhs: { group: string; displayName: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
    selectedDate: Date;
    students: any[];
}

interface Recommendation {
    type: 'warning' | 'success' | 'info';
    title: string;
    description: string;
    group?: string;
}

export function AIAnalytics({ sheikhs, getDayStats, selectedDate, students }: AIAnalyticsProps) {
    const [expanded, setExpanded] = useState(true);

    const analysis = useMemo(() => {
        // Compare current month vs previous month
        const currStart = startOfMonth(selectedDate);
        const currEnd = endOfMonth(selectedDate);
        const prevStart = startOfMonth(subMonths(selectedDate, 1));
        const prevEnd = endOfMonth(subMonths(selectedDate, 1));
        const currDays = eachDayOfInterval({ start: currStart, end: currEnd });
        const prevDays = eachDayOfInterval({ start: prevStart, end: prevEnd });

        // Compare current week vs previous week
        const currWeekStart = startOfWeek(selectedDate, { weekStartsOn: 6 });
        const currWeekEnd = endOfWeek(selectedDate, { weekStartsOn: 6 });
        const prevWeekStart = startOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 6 });
        const prevWeekEnd = endOfWeek(subWeeks(selectedDate, 1), { weekStartsOn: 6 });
        const currWeekDays = eachDayOfInterval({ start: currWeekStart, end: currWeekEnd });
        const prevWeekDays = eachDayOfInterval({ start: prevWeekStart, end: prevWeekEnd });

        const recommendations: Recommendation[] = [];

        // Per group analysis
        const groupTrends: { group: string; displayName: string; currAtt: number; prevAtt: number; diff: number; currExc: number; prevExc: number; sessions: number; weekAtt: number; prevWeekAtt: number }[] = [];

        sheikhs.forEach(sh => {
            let currAtt = 0, currAttC = 0, prevAtt = 0, prevAttC = 0;
            let currExc = 0, currExcC = 0, prevExc = 0, prevExcC = 0;
            let sessions = 0;
            let weekAtt = 0, weekAttC = 0, prevWeekAtt = 0, prevWeekAttC = 0;

            currDays.forEach(day => {
                const stats = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                if (stats && (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية')) {
                    sessions++;
                    if (stats.attendance !== null) { currAtt += stats.attendance; currAttC++; }
                    if (stats.excellent !== null) { currExc += stats.excellent; currExcC++; }
                }
            });

            prevDays.forEach(day => {
                const stats = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                if (stats && (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية')) {
                    if (stats.attendance !== null) { prevAtt += stats.attendance; prevAttC++; }
                    if (stats.excellent !== null) { prevExc += stats.excellent; prevExcC++; }
                }
            });

            currWeekDays.forEach(day => {
                const stats = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                if (stats && stats.attendance !== null && (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية')) {
                    weekAtt += stats.attendance; weekAttC++;
                }
            });
            prevWeekDays.forEach(day => {
                const stats = getDayStats(sh.group, format(day, 'yyyy-MM-dd'));
                if (stats && stats.attendance !== null && (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية')) {
                    prevWeekAtt += stats.attendance; prevWeekAttC++;
                }
            });

            const cAtt = currAttC > 0 ? Math.round(currAtt / currAttC) : 0;
            const pAtt = prevAttC > 0 ? Math.round(prevAtt / prevAttC) : 0;
            const cExc = currExcC > 0 ? Math.round(currExc / currExcC) : 0;
            const pExc = prevExcC > 0 ? Math.round(prevExc / prevExcC) : 0;
            const wAtt = weekAttC > 0 ? Math.round(weekAtt / weekAttC) : 0;
            const pwAtt = prevWeekAttC > 0 ? Math.round(prevWeekAtt / prevWeekAttC) : 0;

            groupTrends.push({ group: sh.group, displayName: sh.displayName, currAtt: cAtt, prevAtt: pAtt, diff: cAtt - pAtt, currExc: cExc, prevExc: pExc, sessions, weekAtt: wAtt, prevWeekAtt: pwAtt });
        });

        // Generate recommendations
        groupTrends.forEach(g => {
            if (g.diff < -10 && g.prevAtt > 0) {
                recommendations.push({
                    type: 'warning',
                    title: `تراجع ملحوظ في ${g.group}`,
                    description: `انخفض حضور ${g.displayName} بنسبة ${Math.abs(g.diff)}% عن الشهر الماضي (${g.prevAtt}% → ${g.currAtt}%). يُنصح بالمتابعة.`,
                    group: g.group,
                });
            }
            if (g.diff > 10 && g.prevAtt > 0) {
                recommendations.push({
                    type: 'success',
                    title: `تحسّن ملحوظ في ${g.group}`,
                    description: `ارتفع حضور ${g.displayName} بنسبة ${g.diff}% عن الشهر الماضي (${g.prevAtt}% → ${g.currAtt}%). عمل رائع!`,
                    group: g.group,
                });
            }
            if (g.weekAtt < g.prevWeekAtt - 15 && g.prevWeekAtt > 0) {
                recommendations.push({
                    type: 'warning',
                    title: `انخفاض أسبوعي في ${g.group}`,
                    description: `حضور الأسبوع الحالي ${g.weekAtt}% مقارنة بـ ${g.prevWeekAtt}% الأسبوع الماضي.`,
                    group: g.group,
                });
            }
            if (g.currExc > g.prevExc + 10 && g.prevExc > 0) {
                recommendations.push({
                    type: 'success',
                    title: `تحسّن في الحفظ — ${g.group}`,
                    description: `ارتفعت نسبة \"ممتاز\" من ${g.prevExc}% إلى ${g.currExc}%.`,
                    group: g.group,
                });
            }
            if (g.sessions === 0) {
                recommendations.push({
                    type: 'info',
                    title: `لا حصص مسجلة — ${g.group}`,
                    description: `لم يسجّل ${g.displayName} أي حصة هذا الشهر بعد.`,
                    group: g.group,
                });
            }
        });

        // Overall stats
        const totalGroups = sheikhs.length;
        const activeGroups = groupTrends.filter(g => g.sessions > 0).length;
        const overallAtt = groupTrends.reduce((s, g) => s + g.currAtt, 0) / Math.max(groupTrends.length, 1);
        const overallExc = groupTrends.reduce((s, g) => s + g.currExc, 0) / Math.max(groupTrends.length, 1);
        const prevOverallAtt = groupTrends.reduce((s, g) => s + g.prevAtt, 0) / Math.max(groupTrends.length, 1);

        // Monthly summary text
        const monthName = format(selectedDate, 'MMMM yyyy', { locale: ar });
        const attTrend = Math.round(overallAtt - prevOverallAtt);
        const bestGroup = [...groupTrends].sort((a, b) => b.currAtt - a.currAtt)[0];
        const worstGroup = [...groupTrends].filter(g => g.sessions > 0).sort((a, b) => a.currAtt - b.currAtt)[0];

        let summary = `📊 ملخص أداء المدرسة — ${monthName}\n\n`;
        summary += `• متوسط الحضور العام: ${Math.round(overallAtt)}%`;
        if (attTrend !== 0) summary += ` (${attTrend > 0 ? '↑' : '↓'} ${Math.abs(attTrend)}% عن الشهر الماضي)`;
        summary += `\n• الأفواج النشطة: ${activeGroups}/${totalGroups}\n`;
        summary += `• متوسط نسبة ممتاز: ${Math.round(overallExc)}%\n`;
        if (bestGroup) summary += `• أفضل فوج: ${bestGroup.displayName} (${bestGroup.currAtt}%)\n`;
        if (worstGroup && worstGroup.group !== bestGroup?.group) summary += `• الأقل حضوراً: ${worstGroup.displayName} (${worstGroup.currAtt}%)\n`;
        if (recommendations.filter(r => r.type === 'warning').length > 0) {
            summary += `\n⚠️ ${recommendations.filter(r => r.type === 'warning').length} تنبيه(ات) تحتاج متابعة`;
        }

        return { recommendations, summary, groupTrends, overallAtt: Math.round(overallAtt), attTrend };
    }, [sheikhs, getDayStats, selectedDate]);

    return (
        <div className="space-y-4">
            {/* AI Header */}
            <div className="bg-gradient-to-l from-violet-50 via-purple-50 to-fuchsia-50 border-2 border-purple-200 rounded-2xl p-4 shadow-lg">
                <div className="flex items-center gap-2 mb-3">
                    <Brain className="h-5 w-5 text-purple-500" />
                    <span className="font-black text-sm text-purple-800">تحليلات ذكية — {format(selectedDate, 'MMMM yyyy', { locale: ar })}</span>
                </div>
                {/* Summary */}
                <div className="bg-white/70 rounded-xl p-3 border border-purple-100 text-xs leading-relaxed whitespace-pre-line text-slate-700">
                    {analysis.summary}
                </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations.length > 0 && (
                <div className="border rounded-2xl overflow-hidden bg-white shadow-md">
                    <button
                        onClick={() => setExpanded(v => !v)}
                        className="w-full bg-slate-50 border-b p-3 flex items-center justify-between text-right"
                    >
                        <span className="text-sm font-black flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-amber-500" />
                            التوصيات والملاحظات ({analysis.recommendations.length})
                        </span>
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {expanded && (
                        <div className="divide-y">
                            {analysis.recommendations.map((rec, i) => (
                                <div key={i} className={cn("flex items-start gap-3 px-4 py-3",
                                    rec.type === 'warning' ? 'bg-rose-50/30' : rec.type === 'success' ? 'bg-emerald-50/30' : 'bg-slate-50/30'
                                )}>
                                    {rec.type === 'warning' ? <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" /> :
                                        rec.type === 'success' ? <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" /> :
                                            <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
                                    <div>
                                        <div className="text-xs font-bold">{rec.title}</div>
                                        <div className="text-[10px] text-muted-foreground mt-0.5">{rec.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Group attendance prediction */}
            <div className="border rounded-2xl overflow-hidden bg-white shadow-md">
                <div className="bg-slate-50 border-b p-3">
                    <h3 className="text-sm font-black flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-500" />
                        توقع الأداء القادم بناءً على الاتجاهات
                    </h3>
                </div>
                <div className="divide-y">
                    {analysis.groupTrends.map(g => {
                        const predicted = Math.min(100, Math.max(0, g.currAtt + Math.round(g.diff * 0.5)));
                        const trendIcon = g.diff > 5 ? '📈' : g.diff < -5 ? '📉' : '➡️';
                        return (
                            <div key={g.group} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="text-xs font-bold min-w-[40px]">{g.group}</span>
                                <div className="flex-1 bg-muted/30 rounded-full h-2.5 overflow-hidden">
                                    <div className={cn("h-full rounded-full transition-all",
                                        predicted >= 80 ? "bg-emerald-400" : predicted >= 60 ? "bg-amber-400" : "bg-rose-400"
                                    )} style={{ width: `${predicted}%` }} />
                                </div>
                                <span className="text-[10px] font-bold min-w-[35px] text-right">{predicted}%</span>
                                <span className="text-sm" title={`الاتجاه: ${g.diff > 0 ? '+' : ''}${g.diff}%`}>{trendIcon}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="p-2 bg-slate-50 border-t text-[8px] text-muted-foreground text-center">
                    * التوقع مبني على مقارنة الشهر الحالي بالسابق — تقدير تقريبي وليس دقيقاً
                </div>
            </div>
        </div>
    );
}
