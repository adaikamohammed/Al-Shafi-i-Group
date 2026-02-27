"use client";

import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Trophy, Crown, Medal, Star, Award, Flame, Calendar, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SheikhScore {
    group: string;
    displayName: string;
    totalPoints: number;
    sessionPoints: number;   // Points from recording sessions
    evalPoints: number;      // Points from evaluating all students
    attendancePoints: number; // Points from > 90% attendance
    totalSessions: number;
    totalDays: number;
    avgAttendance: number;
    badges: { icon: string; label: string; color: string }[];
}

interface SheikhBadgesProps {
    sheikhs: { group: string; displayName: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
    selectedDate: Date;
}

// ─── Main component ──────────────────────────────────────────────────────────
export function SheikhBadges({ sheikhs, getDayStats, selectedDate }: SheikhBadgesProps) {
    const scores = useMemo<SheikhScore[]>(() => {
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

        return sheikhs.map(sh => {
            let sessions = 0, highAttDays = 0, totalDays = 0;
            let attTotal = 0, attCount = 0;

            allDays.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const stats = getDayStats(sh.group, dateStr);
                totalDays++;
                if (stats) {
                    const isReal = stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية';
                    if (isReal) {
                        sessions++;
                        if (stats.attendance !== null) {
                            attTotal += stats.attendance;
                            attCount++;
                            if (stats.attendance >= 90) highAttDays++;
                        }
                    }
                }
            });

            const avgAttendance = attCount > 0 ? Math.round(attTotal / attCount) : 0;

            // Points calculation
            const sessionPoints = sessions * 10;       // 10 pts per session logged
            const evalPoints = sessions * 5;             // 5 pts per session with evaluations
            const attendancePoints = highAttDays * 8;    // 8 pts per day with >90% attendance

            const totalPoints = sessionPoints + evalPoints + attendancePoints;

            // Badges
            const badges: { icon: string; label: string; color: string }[] = [];
            if (sessions >= 20) badges.push({ icon: '💯', label: '100 حصة+', color: 'bg-amber-100 text-amber-700' });
            if (sessions >= 15 && sessions < 20) badges.push({ icon: '📚', label: '15+ حصة', color: 'bg-blue-100 text-blue-700' });
            if (avgAttendance >= 90) badges.push({ icon: '⭐', label: 'حضور ممتاز', color: 'bg-emerald-100 text-emerald-700' });
            if (sessions === totalDays && sessions > 0) badges.push({ icon: '🔥', label: 'صفر غياب', color: 'bg-rose-100 text-rose-700' });
            if (highAttDays >= 10) badges.push({ icon: '🎯', label: 'حضور عالي', color: 'bg-purple-100 text-purple-700' });

            return {
                group: sh.group,
                displayName: sh.displayName,
                totalPoints,
                sessionPoints,
                evalPoints,
                attendancePoints,
                totalSessions: sessions,
                totalDays,
                avgAttendance,
                badges,
            };
        }).sort((a, b) => b.totalPoints - a.totalPoints);
    }, [sheikhs, getDayStats, selectedDate]);

    const topSheikh = scores[0];

    return (
        <div className="space-y-4">
            {/* Top Sheikh card */}
            {topSheikh && topSheikh.totalPoints > 0 && (
                <div className="relative bg-gradient-to-l from-amber-50 via-yellow-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-4 shadow-lg overflow-hidden">
                    <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-amber-100/30" />
                    <div className="flex items-center gap-3 relative">
                        <div className="text-5xl">🏆</div>
                        <div>
                            <div className="text-[10px] font-bold text-amber-500">شيخ الشهر</div>
                            <div className="text-lg font-black text-amber-800">{topSheikh.displayName}</div>
                            <div className="text-xs text-amber-600">{topSheikh.group} — {topSheikh.totalPoints} نقطة</div>
                        </div>
                        <div className="mr-auto text-center">
                            <div className="text-3xl font-black text-amber-600">{topSheikh.totalSessions}</div>
                            <div className="text-[9px] font-bold text-amber-500">حصة</div>
                        </div>
                    </div>
                    {topSheikh.badges.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {topSheikh.badges.map(b => (
                                <span key={b.label} className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", b.color)}>
                                    {b.icon} {b.label}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Leaderboard */}
            <div className="border rounded-2xl overflow-hidden bg-white shadow-lg">
                <div className="bg-gradient-to-l from-purple-50 to-indigo-50 border-b p-3">
                    <h3 className="text-sm font-black flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-purple-500" />
                        ترتيب المشايخ — {format(selectedDate, 'MMMM yyyy', { locale: ar })}
                    </h3>
                </div>
                <div className="divide-y">
                    {scores.map((s, rank) => {
                        const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}`;
                        return (
                            <div key={s.group} className={cn("flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/20",
                                rank < 3 && "bg-amber-50/30"
                            )}>
                                <span className={cn("text-lg font-black min-w-[32px] text-center", rank >= 3 && "text-muted-foreground text-sm")}>{medal}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-sm truncate">{s.displayName}</div>
                                    <div className="text-[10px] text-muted-foreground">{s.group}</div>
                                </div>
                                {/* Points breakdown */}
                                <div className="flex items-center gap-1.5 text-[9px]">
                                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md font-bold" title="حصص">📖 {s.totalSessions}</span>
                                    <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md font-bold" title="حضور">📊 {s.avgAttendance}%</span>
                                </div>
                                {/* Badges */}
                                <div className="flex items-center gap-0.5">
                                    {s.badges.slice(0, 3).map(b => (
                                        <span key={b.label} className="text-sm" title={b.label}>{b.icon}</span>
                                    ))}
                                </div>
                                {/* Total points */}
                                <div className="text-right min-w-[50px]">
                                    <div className="text-sm font-black text-primary">{s.totalPoints}</div>
                                    <div className="text-[8px] text-muted-foreground">نقطة</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Scoring note */}
            <div className="text-[9px] text-muted-foreground bg-muted/20 rounded-xl p-3 border space-y-1">
                <div className="font-bold text-[10px]">📋 نظام النقاط:</div>
                <div>• تسجيل حصة يومياً = <strong>10 نقاط</strong></div>
                <div>• تقييم جميع الطلاب = <strong>5 نقاط</strong></div>
                <div>• نسبة حضور فوق 90% = <strong>8 نقاط</strong></div>
            </div>
        </div>
    );
}
