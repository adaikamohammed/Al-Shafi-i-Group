"use client";

import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar, ChevronLeft, ChevronRight, Plus, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { ref, set, get, onValue, off } from 'firebase/database';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SchoolEvent {
    id: string;
    date: string;
    title: string;
    type: 'holiday' | 'activity' | 'occasion' | 'exam';
}

const EVENT_CONFIG: Record<string, { label: string; bg: string; text: string; emoji: string }> = {
    holiday: { label: 'عطلة', bg: 'bg-rose-100', text: 'text-rose-700', emoji: '🏖' },
    activity: { label: 'نشاط', bg: 'bg-blue-100', text: 'text-blue-700', emoji: '🎯' },
    occasion: { label: 'مناسبة', bg: 'bg-purple-100', text: 'text-purple-700', emoji: '🎉' },
    exam: { label: 'اختبار', bg: 'bg-amber-100', text: 'text-amber-700', emoji: '📝' },
};

interface SchoolCalendarProps {
    sheikhs: { group: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
}

// ─── School Calendar Component ────────────────────────────────────────────────
export function SchoolCalendar({ sheikhs, getDayStats }: SchoolCalendarProps) {
    const [month, setMonth] = useState(new Date());
    const [events, setEvents] = useState<SchoolEvent[]>([]);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventType, setNewEventType] = useState<'holiday' | 'activity' | 'occasion' | 'exam'>('occasion');

    // Load events from Firebase
    React.useEffect(() => {
        const eventsRef = ref(db, 'schoolEvents');
        const unsub = onValue(eventsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                setEvents(Object.entries(data).map(([id, ev]: [string, any]) => ({ id, ...ev })));
            } else {
                setEvents([]);
            }
        });
        return () => off(eventsRef, 'value', unsub);
    }, []);

    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Calendar data with session info
    const calendarDays = useMemo(() => {
        return days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            let hasSession = false;
            let isHoliday = false;
            let isSheikhAbsent = false;
            let totalGroups = 0;

            sheikhs.forEach(sh => {
                const stats = getDayStats(sh.group, dateStr);
                if (stats) {
                    if (stats.type === 'يوم عطلة') isHoliday = true;
                    else if (stats.type === 'غياب الشيخ') isSheikhAbsent = true;
                    else if (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية') {
                        hasSession = true;
                        totalGroups++;
                    }
                }
            });

            const dayEvents = events.filter(e => e.date === dateStr);

            return { day, dateStr, dayNum: format(day, 'd'), dayOfWeek: getDay(day), hasSession, isHoliday, isSheikhAbsent, totalGroups, events: dayEvents };
        });
    }, [days, sheikhs, getDayStats, events]);

    const firstDayOfWeek = calendarDays[0]?.dayOfWeek ?? 6;
    const padStart = firstDayOfWeek === 6 ? 0 : firstDayOfWeek + 1;

    const addEvent = async () => {
        if (!selectedDay || !newEventTitle.trim()) return;
        const id = `evt_${Date.now()}`;
        const newEvent: SchoolEvent = { id, date: selectedDay, title: newEventTitle.trim(), type: newEventType };
        await set(ref(db, `schoolEvents/${id}`), { date: newEvent.date, title: newEvent.title, type: newEvent.type });
        setNewEventTitle('');
        setShowAddDialog(false);
    };

    const removeEvent = async (id: string) => {
        await set(ref(db, `schoolEvents/${id}`), null);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="border rounded-2xl overflow-hidden bg-white shadow-lg">
                <div className="bg-gradient-to-l from-teal-50 to-cyan-50 border-b p-3 flex items-center justify-between">
                    <h3 className="text-sm font-black flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-teal-500" />
                        تقويم المدرسة — {format(month, 'MMMM yyyy', { locale: ar })}
                    </h3>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setMonth(d => subMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors" title="الشهر السابق">
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <button onClick={() => setMonth(d => addMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-white/50 transition-colors" title="الشهر التالي">
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="p-3">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {['سبت', 'أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع'].map(d => (
                            <div key={d} className="text-center text-[9px] font-bold text-muted-foreground py-1">{d}</div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: padStart }).map((_, i) => <div key={`pad-${i}`} />)}
                        {calendarDays.map((cd, i) => {
                            const isToday = format(new Date(), 'yyyy-MM-dd') === cd.dateStr;
                            const hasEvents = cd.events.length > 0;

                            return (
                                <button
                                    key={i}
                                    onClick={() => { setSelectedDay(cd.dateStr); setShowAddDialog(false); }}
                                    className={cn(
                                        "min-h-[60px] rounded-lg p-1 text-right relative transition-all border text-[10px]",
                                        isToday ? "ring-2 ring-primary ring-offset-1" : "",
                                        cd.isHoliday ? "bg-rose-50 border-rose-100" :
                                            cd.hasSession ? "bg-emerald-50/50 border-emerald-100" :
                                                cd.dayOfWeek === 5 ? "bg-slate-50 border-slate-100" :
                                                    "bg-white border-border hover:bg-muted/30",
                                        selectedDay === cd.dateStr ? "ring-2 ring-blue-400" : ""
                                    )}
                                >
                                    <span className={cn("font-bold text-xs", isToday && "text-primary")}>{cd.dayNum}</span>
                                    {cd.hasSession && <span className="absolute top-1 left-1 text-[7px] text-emerald-500 font-bold">{cd.totalGroups}📖</span>}
                                    {cd.isHoliday && <span className="absolute bottom-0.5 right-0.5 text-[8px]">🏖</span>}
                                    {hasEvents && (
                                        <div className="mt-0.5 space-y-0.5">
                                            {cd.events.slice(0, 2).map(ev => (
                                                <div key={ev.id} className={cn("text-[7px] px-1 py-0.5 rounded truncate font-bold", EVENT_CONFIG[ev.type]?.bg, EVENT_CONFIG[ev.type]?.text)}>
                                                    {EVENT_CONFIG[ev.type]?.emoji} {ev.title}
                                                </div>
                                            ))}
                                            {cd.events.length > 2 && <div className="text-[7px] text-muted-foreground text-center">+{cd.events.length - 2}</div>}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t">
                        {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
                            <span key={key} className={cn("flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full", cfg.bg, cfg.text)}>
                                {cfg.emoji} {cfg.label}
                            </span>
                        ))}
                        <span className="flex items-center gap-1 text-[9px]">
                            <span className="w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-100" />حصص مسجلة
                        </span>
                    </div>
                </div>
            </div>

            {/* Selected day details + Add event */}
            {selectedDay && (
                <div className="border rounded-2xl overflow-hidden bg-white shadow-md">
                    <div className="bg-slate-50 border-b p-3 flex items-center justify-between">
                        <span className="text-sm font-bold">{format(new Date(selectedDay), 'EEEE d MMMM yyyy', { locale: ar })}</span>
                        <button
                            onClick={() => setShowAddDialog(v => !v)}
                            className="text-[11px] font-bold px-3 py-1 rounded-lg bg-primary text-white hover:bg-primary/90 flex items-center gap-1"
                        >
                            <Plus className="h-3 w-3" /> إضافة حدث
                        </button>
                    </div>

                    {showAddDialog && (
                        <div className="p-3 border-b bg-blue-50/30 space-y-2">
                            <input
                                type="text"
                                value={newEventTitle}
                                onChange={e => setNewEventTitle(e.target.value)}
                                placeholder="عنوان الحدث..."
                                className="w-full text-xs border rounded-lg px-3 py-2 bg-white"
                                dir="rtl"
                            />
                            <div className="flex items-center gap-2">
                                {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
                                    <button
                                        key={key}
                                        onClick={() => setNewEventType(key as any)}
                                        className={cn("text-[10px] font-bold px-2 py-1 rounded-lg border transition-all",
                                            newEventType === key ? `${cfg.bg} ${cfg.text} border-current` : "bg-white border-border"
                                        )}
                                    >
                                        {cfg.emoji} {cfg.label}
                                    </button>
                                ))}
                                <button onClick={addEvent} className="text-[10px] font-bold px-3 py-1 rounded-lg bg-emerald-500 text-white mr-auto" disabled={!newEventTitle.trim()}>
                                    ✓ حفظ
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Day events */}
                    <div className="p-3 space-y-1.5">
                        {events.filter(e => e.date === selectedDay).map(ev => (
                            <div key={ev.id} className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border", EVENT_CONFIG[ev.type]?.bg)}>
                                <span className="text-sm">{EVENT_CONFIG[ev.type]?.emoji}</span>
                                <span className={cn("text-xs font-bold flex-1", EVENT_CONFIG[ev.type]?.text)}>{ev.title}</span>
                                <button onClick={() => removeEvent(ev.id)} className="p-1 hover:bg-white/50 rounded" title="حذف الحدث">
                                    <X className="h-3 w-3 text-muted-foreground" />
                                </button>
                            </div>
                        ))}
                        {events.filter(e => e.date === selectedDay).length === 0 && !showAddDialog && (
                            <div className="text-center text-xs text-muted-foreground py-4">لا أحداث مسجلة لهذا اليوم</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
