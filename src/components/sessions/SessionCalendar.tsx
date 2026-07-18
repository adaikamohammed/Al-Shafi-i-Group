"use client";

import React from 'react';
import { format, getYear, getMonth, getDaysInMonth, getDay, startOfMonth, isToday, isPast, addMonths, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, MoreVertical, Copy, Download, Trash2, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface SessionCalendarProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onDayClick: (day: number, sessionNumber?: 1 | 2) => void;
    getSessionsForDay: (dateString: string) => any[];
    isSuperAdmin: boolean;
    onDeleteSession: (e: React.MouseEvent, sessionId: string, date: string, ownerId?: string) => void;
    onExportSession: (e: React.MouseEvent, sessionId: string) => void;
    onMoveSession: (e: React.MouseEvent, sessionId: string, date: string, currentOwnerId: string) => void;
}

export const SessionCalendar = ({ currentDate, onDateChange, onDayClick, getSessionsForDay, isSuperAdmin, onDeleteSession, onExportSession, onMoveSession }: SessionCalendarProps) => {

    const year = getYear(currentDate);
    const month = getMonth(currentDate);
    const months = [
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];

    const renderHeader = () => (
        <div className="flex justify-between items-center mb-6 bg-card p-4 rounded-2xl shadow-sm border">
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => onDateChange(subMonths(currentDate, 1))}>
                    <ChevronRight className="h-5 w-5" />
                </Button>
                <div className="text-center">
                    <h2 className="text-xl font-bold font-headline text-primary">{months[month]}</h2>
                    <p className="text-sm text-muted-foreground font-body">{year}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onDateChange(addMonths(currentDate, 1))}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
            </div>
            <Button variant="outline" size="sm" onClick={() => onDateChange(new Date())} className="font-bold">
                اليوم
            </Button>
        </div>
    );

    const renderDays = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDayOfMonth = getDay(startOfMonth(currentDate));
        const startDayIndex = firstDayOfMonth % 7;
        const days = [];

        for (let i = 0; i < startDayIndex; i++) {
            days.push(<div key={`empty-${i}`} className="min-h-[6rem] md:min-h-[8rem] h-auto bg-muted/5 border rounded-xl m-1 opacity-50" />);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day, 12, 0, 0);
            const formattedDate = format(dayDate, 'yyyy-MM-dd');
            const sessions = getSessionsForDay(formattedDate);
            const isTodayDate = isToday(dayDate);

            const getSessionNum = (s: any) => s.sessionNumber !== undefined ? Number(s.sessionNumber) : (s.id && s.id.endsWith('-s2') ? 2 : 1);
            const hasSession2 = sessions.some((s: any) => getSessionNum(s) === 2);
            const canAddSession2 = !hasSession2 && sessions.some((s: any) =>
                getSessionNum(s) === 1 &&
                s.sessionType !== 'يوم عطلة' &&
                s.sessionType !== 'غياب الشيخ' &&
                s.sessionType !== 'حصة أنشطة'
            );

            let statusClass = "bg-card hover:bg-accent/50 border-transparent shadow-sm";
            let hasTwoSessions = false;
            let color1 = "";
            let color2 = "";
            let borderColor = "";

            if (sessions.length > 0) {
                const hasHoliday = sessions.some((s: any) => s.sessionType === 'يوم عطلة');
                const hasActivity = sessions.some((s: any) => s.sessionType === 'حصة أنشطة');
                const hasAbsentNoSub = sessions.some((s: any) => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher);
                const hasAbsentWithSub = sessions.some((s: any) => s.sessionType === 'غياب الشيخ' && s.substituteTeacher);

                if (sessions.length === 2) {
                    hasTwoSessions = true;
                    const sortedSessions = [...sessions].sort((a, b) => {
                        const numA = getSessionNum(a);
                        const numB = getSessionNum(b);
                        return numA - numB;
                    });
                    const s1 = sortedSessions[0];
                    const s2 = sortedSessions[1];

                    const getColor = (s: any) => {
                        if (s.sessionType === 'يوم عطلة') return '#0ea5e9'; // sky-500
                        if (s.sessionType === 'حصة أنشطة') return '#a855f7'; // purple-500
                        if (s.sessionType === 'غياب الشيخ') {
                            return s.substituteTeacher ? '#f97316' : '#f43f5e'; // orange-500 : rose-500
                        }
                        return '#10b981'; // emerald-500
                    };

                    const getBorderColor = (s: any) => {
                        if (s.sessionType === 'يوم عطلة') return '#0284c7'; // sky-600
                        if (s.sessionType === 'حصة أنشطة') return '#9333ea'; // purple-600
                        if (s.sessionType === 'غياب الشيخ') {
                            return s.substituteTeacher ? '#ea580c' : '#e11d48'; // orange-600 : rose-600
                        }
                        return '#059669'; // emerald-600
                    };

                    color1 = getColor(s1);
                    color2 = getColor(s2);
                    borderColor = getBorderColor(s2);

                    const isS1Green = s1.sessionType === 'حصة أساسية' || s1.sessionType === 'حصة إضافية' || s1.sessionType === 'حصة تعويضية';
                    const isS2Green = s2.sessionType === 'حصة أساسية' || s2.sessionType === 'حصة إضافية' || s2.sessionType === 'حصة تعويضية';

                    if (isS1Green && isS2Green) {
                        color1 = '#10b981'; // normal emerald-500
                        color2 = '#047857'; // emerald-700 (أغمق قليلاً)
                        borderColor = '#047857';
                    }

                    statusClass = 'text-white border-2 shadow-[0_4px_15px_rgba(0,0,0,0.15)]';
                } else {
                    if (hasHoliday) statusClass = 'bg-sky-500 text-white border-2 border-sky-600 shadow-sky-200';
                    else if (hasActivity) statusClass = 'bg-purple-500 text-white border-2 border-purple-600 shadow-purple-200';
                    else if (hasAbsentNoSub) statusClass = 'bg-rose-500 text-white border-2 border-rose-600 shadow-rose-200';
                    else if (hasAbsentWithSub) statusClass = 'bg-orange-500 text-white border-2 border-orange-600 shadow-orange-200';
                    else statusClass = 'bg-emerald-500 text-white border-2 border-emerald-600 shadow-emerald-200';
                }
            } else if (isPast(dayDate) && !isTodayDate) {
                statusClass = 'bg-muted/30 border-muted/20 opacity-80';
            }
            if (isTodayDate) statusClass += " ring-2 ring-primary ring-offset-2";

            days.push(
                <div
                    key={day}
                    onClick={() => onDayClick(day)}
                    className={cn(
                        "relative flex flex-col justify-between min-h-[5.5rem] sm:min-h-[6rem] md:min-h-[8rem] h-auto border rounded-xl m-0.5 sm:m-1 p-1 sm:p-2 transition-all cursor-pointer group shadow-sm",
                        statusClass
                    )}
                    style={hasTwoSessions ? {
                        background: `linear-gradient(135deg, ${color1} 50%, ${color2} 50%)`,
                        borderColor: borderColor
                    } : undefined}
                >
                    {/* رقم اليوم + مؤشر الحصة الإضافية */}
                    <div className="flex justify-between items-start">
                        <span className={cn("text-base sm:text-lg font-bold font-headline select-none", isTodayDate ? "text-primary" : "text-foreground")}>
                            {day}
                        </span>
                        {/* نقطة صغيرة فقط للإشارة لوجود حصة إضافية */}
                        {hasSession2 && (
                            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white/80 border border-indigo-300 shrink-0 mt-1" title="يوم بحصتين" />
                        )}
                    </div>

                    {/* Session Badges — مخفية على الجوال لمنع تمدد الخلايا */}
                    <div className="hidden sm:block space-y-0.5 sm:space-y-1 relative z-10">
                        {sessions.map((session: any, idx: number) => (
                            <div
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDayClick(day, getSessionNum(session) as 1 | 2);
                                }}
                                className="flex items-center justify-center text-[9px] sm:text-xs font-bold text-muted-foreground bg-white/60 hover:bg-white/90 border border-transparent hover:border-primary/30 rounded-lg px-1 sm:px-2 py-1 sm:py-1.5 truncate transition-all cursor-pointer shadow-sm hover:shadow-md"
                            >
                                {session.sessionType === 'حصة أساسية' ? (
                                    getSessionNum(session) === 1 ? (
                                        <span className="flex items-center gap-0.5 truncate">
                                            <span className="text-[10px]">📗</span>
                                            <span className="hidden sm:inline">حصة أساسية</span>
                                            <span className="sm:hidden">أساسي</span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-0.5 truncate">
                                            <span className="text-[10px]">📘</span>
                                            <span className="hidden sm:inline">حصة إضافية</span>
                                            <span className="sm:hidden">إضافي</span>
                                        </span>
                                    )
                                ) : session.sessionType === 'يوم عطلة' ? (
                                    <span className="flex items-center gap-0.5 truncate">
                                        <span className="text-[10px]">🏖️</span>
                                        <span className="hidden sm:inline">يوم عطلة</span>
                                        <span className="sm:hidden">عطلة</span>
                                    </span>
                                ) : session.sessionType === 'حصة أنشطة' ? (
                                    <span className="flex items-center gap-0.5 truncate">
                                        <span className="text-[10px]">🎨</span>
                                        <span className="hidden sm:inline">حصة أنشطة</span>
                                        <span className="sm:hidden">أنشطة</span>
                                    </span>
                                ) : session.sessionType === 'غياب الشيخ' ? (
                                    <span className="flex items-center gap-0.5 truncate">
                                        <span className="text-[10px]">👤</span>
                                        <span className="hidden sm:inline">غياب الشيخ</span>
                                        <span className="sm:hidden">غياب</span>
                                    </span>
                                ) : (
                                    <span className="truncate">{session.sessionType}</span>
                                )}
                            </div>
                        ))}

                        {/* زر إضافة الحصة الإضافية — صغير ومدمج */}
                        {canAddSession2 && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDayClick(day, 2);
                                }}
                                className="w-full flex items-center justify-center gap-1 text-[9px] sm:text-[11px] font-bold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 border border-white/30 hover:border-white/60 rounded-lg px-1 sm:px-2 py-0.5 sm:py-1 transition-all active:scale-95"
                                title="إضافة حصة إضافية"
                            >
                                <Plus className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                                <span className="hidden sm:inline">حصة إضافية</span>
                                <span className="sm:hidden">+ إضافي</span>
                            </button>
                        )}
                    </div>

                    {/* Quick Actions Menu */}
                    {sessions.length > 0 && (
                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 bg-white/80 hover:bg-white shadow-sm" onClick={(e) => e.stopPropagation()}>
                                        <MoreVertical className="h-3 w-3" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-52 font-body p-2 space-y-1">
                                    <div className="px-2 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 rounded-lg mb-1">
                                        إدارة حصص اليوم
                                    </div>
                                    {sessions.map((session: any, sIdx: number) => (
                                        <React.Fragment key={session.id || sIdx}>
                                            <div className="px-2 py-1 text-[10px] text-muted-foreground flex items-center justify-between">
                                                <span>{getSessionNum(session) === 1 ? 'حصة أساسية' : 'حصة إضافية'}</span>
                                                <Badge variant="outline" className="text-[9px] h-4 px-1">{String(session.id).slice(-4)}</Badge>
                                            </div>
                                            <DropdownMenuItem onClick={() => onDayClick(day, getSessionNum(session) as 1 | 2)} className="rounded-lg">
                                                <Copy className="ml-2 h-3.5 w-3.5" /> تعديل البيانات
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => onExportSession(e, session.id)} className="rounded-lg">
                                                <Download className="ml-2 h-3.5 w-3.5" /> تصدير الملف
                                            </DropdownMenuItem>
                                            {isSuperAdmin && (
                                                <DropdownMenuItem
                                                    onClick={(e) => onMoveSession(e, session.id, formattedDate, session.ownerId)}
                                                    className="rounded-lg text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                                                >
                                                    <ChevronRight className="ml-2 h-3.5 w-3.5" /> نقل الحصة
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg font-bold"
                                                onClick={(e) => onDeleteSession(e, session.id, formattedDate, session.ownerId)}
                                            >
                                                <Trash2 className="ml-2 h-3.5 w-3.5" /> حذف الحصة نهائياً
                                            </DropdownMenuItem>
                                            {sIdx < sessions.length - 1 && <DropdownMenuSeparator className="my-1 bg-emerald-100/50" />}
                                        </React.Fragment>
                                    ))}
                                    {canAddSession2 && (
                                        <>
                                            <DropdownMenuSeparator className="my-1" />
                                            <DropdownMenuItem
                                                onClick={() => onDayClick(day, 2)}
                                                className="rounded-lg text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50 font-bold"
                                            >
                                                <Plus className="ml-2 h-3.5 w-3.5" /> إضافة حصة إضافية
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}
                </div>
            );
        }
        return days;
    };

    return (
        <div className="bg-background rounded-[2rem] p-4 md:p-6 shadow-xl border border-border/50">
            {renderHeader()}
            <div className="grid grid-cols-7 gap-1 md:gap-2">
                {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
                    <div key={day} className="text-center font-bold text-xs md:text-sm text-muted-foreground p-2">
                        {day}
                    </div>
                ))}
                {renderDays()}
            </div>
        </div>
    );
};
