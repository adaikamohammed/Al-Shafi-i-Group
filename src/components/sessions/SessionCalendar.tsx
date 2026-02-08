"use client";

import React from 'react';
import { format, getYear, getMonth, getDaysInMonth, getDay, startOfMonth, isSameDay, isToday, isPast, addMonths, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Dot, MoreVertical, Copy, Download, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface SessionCalendarProps {
    currentDate: Date;
    onDateChange: (date: Date) => void;
    onDayClick: (day: number, sessionNumber?: 1 | 2) => void;
    getSessionsForDay: (dateString: string) => any[];
    isSuperAdmin: boolean;
    onDeleteSession: (e: React.MouseEvent, sessionId: string, date: string) => void;
    onExportSession: (e: React.MouseEvent, sessionId: string) => void;
}

export const SessionCalendar = ({ currentDate, onDateChange, onDayClick, getSessionsForDay, isSuperAdmin, onDeleteSession, onExportSession }: SessionCalendarProps) => {

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

        // Empty cells for days before the 1st
        for (let i = 0; i < startDayIndex; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 md:h-32 bg-muted/5 border rounded-xl m-1 opacity-50" />);
        }

        // Day cells
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const formattedDate = format(dayDate, 'yyyy-MM-dd');
            const sessions = getSessionsForDay(formattedDate);
            const isTodayDate = isToday(dayDate);

            // Determine Status Color - Using STRONG, VISIBLE colors
            let statusClass = "bg-card hover:bg-accent/50 border-transparent shadow-sm"; // Default

            // Check if it's Thursday (4) or Friday (5) - automatic holiday
            const dayOfWeek = getDay(dayDate);
            const isWeekendDay = dayOfWeek === 4 || dayOfWeek === 5; // Thursday or Friday

            if (sessions.length > 0) {
                const hasHoliday = sessions.some(s => s.sessionType === 'يوم عطلة');
                const hasActivity = sessions.some(s => s.sessionType === 'حصة أنشطة');
                const hasAbsentNoSub = sessions.some(s => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher);
                const hasAbsentWithSub = sessions.some(s => s.sessionType === 'غياب الشيخ' && s.substituteTeacher);

                if (hasHoliday) {
                    statusClass = 'bg-sky-300 dark:bg-sky-700 border-2 border-sky-500 dark:border-sky-400'; // VERY STRONG Blue for Holiday
                } else if (hasActivity) {
                    statusClass = 'bg-purple-300 dark:bg-purple-700 border-2 border-purple-500 dark:border-purple-400'; // VERY STRONG Purple for Activities
                } else if (hasAbsentNoSub) {
                    statusClass = 'bg-red-300 dark:bg-red-700 border-2 border-red-500 dark:border-red-400'; // VERY STRONG Red for Absent without Sub
                } else if (hasAbsentWithSub) {
                    statusClass = 'bg-orange-300 dark:bg-orange-700 border-2 border-orange-500 dark:border-orange-400'; // VERY STRONG Orange for Absent with Sub
                } else {
                    statusClass = 'bg-emerald-300 dark:bg-emerald-700 border-2 border-emerald-500 dark:border-emerald-400'; // STRONG Green for Completed/Normal
                }
            } else if (isWeekendDay) {
                // Thursday or Friday without session = automatic holiday color
                statusClass = 'bg-sky-300 dark:bg-sky-700 border-2 border-sky-500 dark:border-sky-400'; // Weekend day - Holiday
            } else if (isPast(dayDate) && !isTodayDate) {
                statusClass = 'bg-muted/30 border-muted/20 opacity-80'; // Empty past day
            }
            if (isTodayDate) statusClass += " ring-2 ring-primary ring-offset-2 !bg-primary/5";

            days.push(
                <div
                    key={day}
                    onClick={() => onDayClick(day)}
                    className={cn(
                        "relative flex flex-col justify-between h-24 md:h-32 border rounded-xl m-1 p-2 transition-all cursor-pointer group shadow-sm",
                        statusClass
                    )}
                >
                    <div className="flex justify-between items-start">
                        <span className={cn("text-lg font-bold font-headline select-none", isTodayDate ? "text-primary" : "text-foreground")}>{day}</span>
                        <div className="flex">
                            {sessions.some(s => s.sessionNumber === 1) && <Dot className="h-4 w-4 text-emerald-500" />}
                            {sessions.some(s => s.sessionNumber === 2) && <Dot className="h-4 w-4 text-emerald-600" />}
                        </div>
                    </div>

                    {/* Session Infos */}
                    <div className="space-y-1 relative z-10">
                        {sessions.map((session, idx) => (
                            <div
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDayClick(day, session.sessionNumber as 1 | 2);
                                }}
                                className="flex items-center justify-center text-xs font-bold text-muted-foreground bg-white/60 hover:bg-white/90 border border-transparent hover:border-primary/30 rounded-lg px-2 py-1.5 truncate transition-all cursor-pointer shadow-sm hover:shadow-md"
                            >
                                {session.sessionType === 'حصة أساسية' ? `حصة ${session.sessionNumber}` : session.sessionType}
                            </div>
                        ))}
                    </div>

                    {/* Quick Actions Menu */}
                    {sessions.length > 0 && !isSuperAdmin && (
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
                                    {sessions.map((session, sIdx) => (
                                        <React.Fragment key={session.id || sIdx}>
                                            <div className="px-2 py-1 text-[10px] text-muted-foreground flex items-center justify-between">
                                                <span> {session.sessionType || `حصة ${session.sessionNumber}`}</span>
                                                <Badge variant="outline" className="text-[9px] h-4 px-1">{String(session.id).slice(-4)}</Badge>
                                            </div>
                                            <DropdownMenuItem onClick={() => onDayClick(day, session.sessionNumber as 1 | 2)} className="rounded-lg">
                                                <Copy className="ml-2 h-3.5 w-3.5" /> تعديل البيانات
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={(e) => onExportSession(e, session.id)} className="rounded-lg">
                                                <Download className="ml-2 h-3.5 w-3.5" /> تصدير الملف
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-700 focus:bg-red-50 rounded-lg font-bold"
                                                onClick={(e) => onDeleteSession(e, session.id, formattedDate)}
                                            >
                                                <Trash2 className="ml-2 h-3.5 w-3.5" /> حذف الحصة نهائياً
                                            </DropdownMenuItem>
                                            {sIdx < sessions.length - 1 && <DropdownMenuSeparator className="my-1 bg-emerald-100/50" />}
                                        </React.Fragment>
                                    ))}
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
