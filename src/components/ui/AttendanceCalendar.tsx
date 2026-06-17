"use client";

import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SessionDay {
    date: string;
    attendance: string;
    memorization?: string;
    behavior?: string;
    sessionType?: string;
}

interface AttendanceCalendarProps {
    sessions: SessionDay[];
    studentName?: string;
}

function getAttendanceColor(attendance: string): string {
    if (attendance === 'حاضر') return 'bg-emerald-500';
    if (attendance === 'متأخر') return 'bg-amber-400';
    if (attendance === 'تعويض') return 'bg-blue-400';
    if (attendance === 'غائب' || attendance === 'غياب') return 'bg-rose-500';
    return 'bg-gray-200';
}

function getAttendanceEmoji(attendance: string): string {
    if (attendance === 'حاضر') return '✅';
    if (attendance === 'متأخر') return '⏰';
    if (attendance === 'تعويض') return '🔄';
    if (attendance === 'غائب' || attendance === 'غياب') return '❌';
    return '⚪';
}

function getMemorizationBadge(memorization?: string): string {
    if (!memorization || memorization === 'لا يوجد') return '';
    if (memorization === 'ممتاز') return '🌟';
    if (memorization === 'جيد جداً' || memorization === 'جيد جدا') return '⭐';
    if (memorization === 'جيد') return '👍';
    if (memorization === 'مقبول') return '🆗';
    if (memorization === 'لم يحفظ') return '📕';
    return '';
}

export function AttendanceCalendar({ sessions, studentName }: AttendanceCalendarProps) {
    const [tooltip, setTooltip] = useState<{ idx: number; session: SessionDay } | null>(null);

    if (!sessions || sessions.length === 0) {
        return (
            <div className="text-xs text-muted-foreground text-center py-2">
                لا توجد بيانات حصص لعرضها
            </div>
        );
    }

    // Sort sessions by date ascending
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

    const presentCount = sorted.filter(s => s.attendance === 'حاضر' || s.attendance === 'تعويض').length;
    const absentCount = sorted.filter(s => s.attendance === 'غائب' || s.attendance === 'غياب').length;
    const lateCount = sorted.filter(s => s.attendance === 'متأخر').length;
    const notMemCount = sorted.filter(s => s.memorization === 'لم يحفظ').length;

    return (
        <div className="space-y-2">
            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />حاضر</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />متأخر</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-400 inline-block" />تعويض</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-rose-500 inline-block" />غائب</span>
            </div>

            {/* Calendar Grid */}
            <div className="flex flex-wrap gap-1.5 relative">
                {sorted.map((session, idx) => {
                    const isOpen = tooltip?.idx === idx;
                    let dateLabel = session.date;
                    try { dateLabel = format(parseISO(session.date), 'EEEE d MMM', { locale: ar }); } catch {}

                    return (
                        <div key={idx} className="relative">
                            <button
                                type="button"
                                onMouseEnter={() => setTooltip({ idx, session })}
                                onMouseLeave={() => setTooltip(null)}
                                onFocus={() => setTooltip({ idx, session })}
                                onBlur={() => setTooltip(null)}
                                className={cn(
                                    "w-9 h-9 rounded-lg flex flex-col items-center justify-center text-white text-[10px] font-bold shadow-sm border-2 border-white/30 transition-transform hover:scale-110 cursor-pointer",
                                    getAttendanceColor(session.attendance)
                                )}
                                aria-label={`${dateLabel}: ${session.attendance}`}
                            >
                                <span className="text-[13px] leading-none">{getAttendanceEmoji(session.attendance)}</span>
                                {session.memorization && session.memorization !== 'لا يوجد' && (
                                    <span className="text-[8px] leading-none opacity-90">{getMemorizationBadge(session.memorization)}</span>
                                )}
                            </button>

                            {/* Tooltip */}
                            {isOpen && (
                                <div className="absolute z-50 bottom-full mb-1 right-0 w-44 bg-gray-900 text-white text-[10px] rounded-lg p-2 shadow-xl pointer-events-none">
                                    <div className="font-bold mb-1 text-[11px]">{dateLabel}</div>
                                    <div className="space-y-0.5">
                                        <div>الحضور: <span className="font-bold">{session.attendance}</span></div>
                                        {session.memorization && session.memorization !== 'لا يوجد' && (
                                            <div>الحفظ: <span className="font-bold">{session.memorization}</span></div>
                                        )}
                                        {session.behavior && session.behavior !== 'لا يوجد' && (
                                            <div>السلوك: <span className="font-bold">{session.behavior}</span></div>
                                        )}
                                        {session.sessionType && (
                                            <div className="text-gray-400">{session.sessionType}</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-bold">
                    ✅ حاضر: {presentCount}
                </span>
                {lateCount > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 font-bold">
                        ⏰ متأخر: {lateCount}
                    </span>
                )}
                <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 rounded px-1.5 py-0.5 font-bold">
                    ❌ غائب: {absentCount}
                </span>
                {notMemCount > 0 && (
                    <span className="text-[10px] bg-orange-100 text-orange-700 border border-orange-200 rounded px-1.5 py-0.5 font-bold">
                        📕 لم يحفظ: {notMemCount}
                    </span>
                )}
            </div>
        </div>
    );
}
