"use client";

import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, subMonths, addMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, Calendar, TrendingUp, BookOpen, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentProfileProps {
    studentId: string;
    studentName: string;
    studentGroup: string;
    dailySessions: any;
    sheikhs: { group: string; uids: Set<string> }[];
    onClose: () => void;
}

const EVAL_COLORS: Record<string, string> = {
    'ممتاز': '#10b981',
    'جيد جدا': '#22c55e',
    'جيد جداً': '#22c55e',
    'جيد': '#3b82f6',
    'مقبول': '#f59e0b',
    'حسن': '#f59e0b',
    'ضعيف': '#ef4444',
    'متوسط': '#ef4444',
    'لم يحفظ': '#94a3b8',
};

const EVAL_SCORE: Record<string, number> = {
    'ممتاز': 6, 'جيد جدا': 5, 'جيد جداً': 5, 'جيد': 4,
    'مقبول': 3, 'حسن': 3, 'ضعيف': 2, 'متوسط': 2, 'لم يحفظ': 1,
};

// ─── Student Profile Dialog ───────────────────────────────────────────────────
export function StudentProfileDialog({ studentId, studentName, studentGroup, dailySessions, sheikhs, onClose }: StudentProfileProps) {
    const [calendarMonth, setCalendarMonth] = useState(new Date());

    // Build owner→group lookup
    const ownerGroupMap = useMemo(() => {
        const map = new Map<string, string>();
        sheikhs.forEach(sh => sh.uids.forEach(uid => map.set(uid, sh.group)));
        return map;
    }, [sheikhs]);

    // Gather ALL session records for this student
    const allRecords = useMemo(() => {
        const records: {
            date: string;
            attendance: string;
            memorization: string | null;
            isReview: boolean;
            sessionType: string;
        }[] = [];

        if (!dailySessions) return records;

        Object.entries(dailySessions).forEach(([dateStr, daySessions]) => {
            Object.values(daySessions as Record<string, any>).forEach((session: any) => {
                if (!session) return;
                const grp = ownerGroupMap.get(session.ownerId);
                if (grp !== studentGroup) return;

                const sType = session.sessionType;
                const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                if (!isReal) return;

                const recs: any[] = Array.isArray(session.records)
                    ? session.records
                    : session.records ? Object.values(session.records) : [];

                const rec = recs.find((r: any) => r.studentId === studentId);
                if (rec) {
                    records.push({
                        date: dateStr,
                        attendance: rec.attendance || 'غائب',
                        memorization: rec.review ? null : (rec.memorization || null),
                        isReview: !!rec.review,
                        sessionType: sType,
                    });
                } else {
                    // Student not in records = absent
                    records.push({
                        date: dateStr,
                        attendance: 'غائب',
                        memorization: null,
                        isReview: false,
                        sessionType: sType,
                    });
                }
            });
        });

        return records.sort((a, b) => a.date.localeCompare(b.date));
    }, [dailySessions, studentId, studentGroup, ownerGroupMap]);

    // Summary stats
    const stats = useMemo(() => {
        let present = 0, absent = 0, late = 0;
        let excellent = 0, goodPlus = 0, good = 0, acceptable = 0, weak = 0, notMem = 0;
        let totalEvals = 0;

        allRecords.forEach(r => {
            if (r.attendance === 'حاضر' || r.attendance === 'تعويض') present++;
            else if (r.attendance === 'متأخر') { present++; late++; }
            else absent++;

            if (r.memorization) {
                totalEvals++;
                if (r.memorization === 'ممتاز') excellent++;
                else if (r.memorization === 'جيد جدا' || r.memorization === 'جيد جداً') goodPlus++;
                else if (r.memorization === 'جيد') good++;
                else if (r.memorization === 'مقبول' || r.memorization === 'حسن') acceptable++;
                else if (r.memorization === 'ضعيف' || r.memorization === 'متوسط') weak++;
                else if (r.memorization === 'لم يحفظ') notMem++;
            }
        });

        const total = present + absent;
        const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
        const excellentRate = totalEvals > 0 ? Math.round((excellent / totalEvals) * 100) : 0;

        return { present, absent, late, total, attendanceRate, excellent, goodPlus, good, acceptable, weak, notMem, totalEvals, excellentRate };
    }, [allRecords]);

    // Calendar data for current month
    const calendarData = useMemo(() => {
        const monthStart = startOfMonth(calendarMonth);
        const monthEnd = endOfMonth(calendarMonth);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const recordMap = new Map(allRecords.map(r => [r.date, r]));

        return days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const record = recordMap.get(dateStr);
            return {
                day,
                dateStr,
                dayNum: format(day, 'd'),
                dayOfWeek: getDay(day),
                record,
            };
        });
    }, [calendarMonth, allRecords]);

    // Weekly evaluation trend (last 12 entries)
    const evalTrend = useMemo(() => {
        return allRecords
            .filter(r => r.memorization !== null)
            .slice(-12)
            .map((r, i) => ({
                name: format(new Date(r.date), 'd/M'),
                score: EVAL_SCORE[r.memorization!] || 0,
                label: r.memorization!,
            }));
    }, [allRecords]);

    // Last 10 sessions
    const last10 = allRecords.slice(-10).reverse();

    // Pad calendar start
    const firstDayOfWeek = calendarData[0]?.dayOfWeek ?? 6;
    const padStart = firstDayOfWeek === 6 ? 0 : firstDayOfWeek + 1;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

            {/* Dialog */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-l from-indigo-50 via-blue-50 to-cyan-50 border-b p-4 flex items-center justify-between rounded-t-2xl z-10">
                    <div>
                        <h2 className="text-base font-black">{studentName}</h2>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold">{studentGroup}</span>
                            <span>{stats.total} حصة مسجلة</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Stats cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-100 rounded-xl p-2.5 text-center">
                            <div className="text-xl font-black text-emerald-700">{stats.attendanceRate}%</div>
                            <div className="text-[9px] font-bold text-emerald-500">نسبة الحضور</div>
                        </div>
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-2.5 text-center">
                            <div className="text-xl font-black text-blue-700">{stats.present}<span className="text-sm text-muted-foreground">/{stats.total}</span></div>
                            <div className="text-[9px] font-bold text-blue-500">أيام الحضور</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-100 rounded-xl p-2.5 text-center">
                            <div className="text-xl font-black text-purple-700">{stats.excellentRate}%</div>
                            <div className="text-[9px] font-bold text-purple-500">نسبة ممتاز</div>
                        </div>
                        <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-100 rounded-xl p-2.5 text-center">
                            <div className="text-xl font-black text-rose-700">{stats.absent}</div>
                            <div className="text-[9px] font-bold text-rose-500">أيام الغياب</div>
                        </div>
                    </div>

                    {/* Eval distribution bar */}
                    {stats.totalEvals > 0 && (
                        <div className="border rounded-xl p-3 bg-slate-50/50">
                            <div className="text-[10px] font-bold text-muted-foreground mb-2">توزيع التقييمات ({stats.totalEvals} تقييم)</div>
                            <div className="flex h-4 rounded-full overflow-hidden">
                                {[
                                    { count: stats.excellent, color: 'bg-emerald-500', label: 'ممتاز' },
                                    { count: stats.goodPlus, color: 'bg-green-400', label: 'ج.جداً' },
                                    { count: stats.good, color: 'bg-blue-400', label: 'جيد' },
                                    { count: stats.acceptable, color: 'bg-amber-400', label: 'مقبول' },
                                    { count: stats.weak, color: 'bg-rose-400', label: 'ضعيف' },
                                    { count: stats.notMem, color: 'bg-slate-300', label: 'لم يحفظ' },
                                ].filter(e => e.count > 0).map(e => (
                                    <div
                                        key={e.label}
                                        className={cn("h-full transition-all", e.color)}
                                        style={{ width: `${(e.count / stats.totalEvals) * 100}%` }}
                                        title={`${e.label}: ${e.count}`}
                                    />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-1.5">
                                {[
                                    { count: stats.excellent, color: 'bg-emerald-500', label: 'ممتاز' },
                                    { count: stats.goodPlus, color: 'bg-green-400', label: 'ج.جداً' },
                                    { count: stats.good, color: 'bg-blue-400', label: 'جيد' },
                                    { count: stats.acceptable, color: 'bg-amber-400', label: 'مقبول' },
                                    { count: stats.weak, color: 'bg-rose-400', label: 'ضعيف' },
                                    { count: stats.notMem, color: 'bg-slate-300', label: 'لم يحفظ' },
                                ].filter(e => e.count > 0).map(e => (
                                    <span key={e.label} className="flex items-center gap-1 text-[9px]">
                                        <span className={cn("w-2 h-2 rounded-full", e.color)} />{e.label} ({e.count})
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Calendar */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="bg-slate-50 border-b p-2.5 flex items-center justify-between">
                            <button onClick={() => setCalendarMonth(d => subMonths(d, 1))} className="p-1 rounded-lg hover:bg-muted">
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            <span className="text-xs font-bold">{format(calendarMonth, 'MMMM yyyy', { locale: ar })}</span>
                            <button onClick={() => setCalendarMonth(d => addMonths(d, 1))} className="p-1 rounded-lg hover:bg-muted">
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="p-2">
                            {/* Day headers */}
                            <div className="grid grid-cols-7 gap-0.5 mb-1">
                                {['سبت', 'أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع'].map(d => (
                                    <div key={d} className="text-center text-[9px] font-bold text-muted-foreground py-1">{d}</div>
                                ))}
                            </div>
                            {/* Calendar grid */}
                            <div className="grid grid-cols-7 gap-0.5">
                                {Array.from({ length: padStart }).map((_, i) => <div key={`pad-${i}`} />)}
                                {calendarData.map((cd, i) => {
                                    let bg = 'bg-slate-50';
                                    let textColor = 'text-muted-foreground';
                                    let ring = '';
                                    if (cd.record) {
                                        const att = cd.record.attendance;
                                        if (att === 'حاضر' || att === 'تعويض') { bg = 'bg-emerald-100'; textColor = 'text-emerald-700'; }
                                        else if (att === 'متأخر') { bg = 'bg-amber-100'; textColor = 'text-amber-700'; ring = 'ring-1 ring-amber-300'; }
                                        else if (att === 'غائب' || att === 'غياب') { bg = 'bg-rose-100'; textColor = 'text-rose-700'; }
                                        // Memorization dot
                                        if (cd.record.memorization) {
                                            const mColor = EVAL_COLORS[cd.record.memorization] || '#94a3b8';
                                        }
                                    }
                                    return (
                                        <div
                                            key={i}
                                            className={cn("h-8 rounded-md flex flex-col items-center justify-center text-[10px] font-bold transition-colors relative", bg, textColor, ring)}
                                            title={cd.record ? `${cd.record.attendance}${cd.record.memorization ? ` | ${cd.record.memorization}` : ''}` : ''}
                                        >
                                            {cd.dayNum}
                                            {cd.record?.memorization && (
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full absolute bottom-0.5"
                                                    style={{ backgroundColor: EVAL_COLORS[cd.record.memorization] || '#94a3b8' }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Calendar legend */}
                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t">
                                {[
                                    { bg: 'bg-emerald-100', label: 'حاضر' },
                                    { bg: 'bg-amber-100', label: 'متأخر' },
                                    { bg: 'bg-rose-100', label: 'غائب' },
                                    { bg: 'bg-slate-50', label: 'لا حصة' },
                                ].map(l => (
                                    <span key={l.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                        <span className={cn("w-3 h-3 rounded-sm", l.bg)} />{l.label}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Evaluation trend chart */}
                    {evalTrend.length > 2 && (
                        <div className="border rounded-xl p-3">
                            <div className="text-[10px] font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                                <TrendingUp className="h-3.5 w-3.5" />
                                تطوّر التقييمات (آخر {evalTrend.length} حصة)
                            </div>
                            <div className="h-40">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={evalTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                                        <YAxis tick={{ fontSize: 9 }} domain={[0, 6]} ticks={[1, 2, 3, 4, 5, 6]}
                                            tickFormatter={(v: number) => v === 6 ? 'ممتاز' : v === 5 ? 'ج.جداً' : v === 4 ? 'جيد' : v === 3 ? 'مقبول' : v === 2 ? 'ضعيف' : 'لم يحفظ'} />
                                        <RechartsTooltip
                                            formatter={(value: number) => [value === 6 ? 'ممتاز' : value === 5 ? 'جيد جداً' : value === 4 ? 'جيد' : value === 3 ? 'مقبول' : value === 2 ? 'ضعيف' : 'لم يحفظ', 'التقييم']}
                                            contentStyle={{ direction: 'rtl', borderRadius: '12px', fontSize: '11px' }}
                                        />
                                        <Line type="monotone" dataKey="score" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, fill: '#8b5cf6' }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Last 10 sessions */}
                    <div className="border rounded-xl overflow-hidden">
                        <div className="bg-slate-50 border-b p-2.5 flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold">آخر 10 حصص</span>
                        </div>
                        <div className="divide-y">
                            {last10.map((r, i) => {
                                const evalBadge = r.memorization ? EVAL_COLORS[r.memorization] : null;
                                return (
                                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs">
                                        <span className={cn("w-2 h-2 rounded-full shrink-0",
                                            (r.attendance === 'حاضر' || r.attendance === 'تعويض') ? 'bg-emerald-500' :
                                                r.attendance === 'متأخر' ? 'bg-amber-400' : 'bg-rose-400'
                                        )} />
                                        <span className="text-[10px] text-muted-foreground min-w-[70px]">
                                            {format(new Date(r.date), 'EEEE d/M', { locale: ar })}
                                        </span>
                                        <span className={cn("font-bold text-[10px]",
                                            (r.attendance === 'حاضر' || r.attendance === 'تعويض') ? 'text-emerald-600' :
                                                r.attendance === 'متأخر' ? 'text-amber-600' : 'text-rose-600'
                                        )}>
                                            {r.attendance}
                                        </span>
                                        {r.memorization && (
                                            <span
                                                className="text-[10px] font-bold px-2 py-0.5 rounded-full mr-auto"
                                                style={{ backgroundColor: `${evalBadge}20`, color: evalBadge || '#666' }}
                                            >
                                                {r.memorization}
                                            </span>
                                        )}
                                        {r.isReview && <span className="text-[9px] text-blue-500 font-bold mr-auto">مراجعة</span>}
                                    </div>
                                );
                            })}
                            {last10.length === 0 && (
                                <div className="p-6 text-center text-muted-foreground text-xs">لا توجد حصص مسجلة</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
