"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { ref, query, orderByChild, limitToLast, onValue, off } from 'firebase/database';
import { ActivityAction } from '@/lib/activityLogger';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import {
    Search,
    Filter,
    User,
    Files,
    Calendar,
    Clock,
    Trash2,
    Edit,
    PlusCircle,
    FileText,
    Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface LogEntry {
    id: string;
    action: ActivityAction;
    actorId: string;
    actorName: string;
    targetId?: string;
    targetName?: string;
    details?: string;
    timestamp: any; // Firebase timestamp or number
    groupName?: string;
}

const ACTION_CONFIG: Record<ActivityAction, { label: string, color: string, icon: any }> = {
    'ADD_STUDENT': { label: 'إضافة طالب', color: 'bg-green-100 text-green-700', icon: PlusCircle },
    'UPDATE_STUDENT': { label: 'تعديل طالب', color: 'bg-blue-100 text-blue-700', icon: Edit },
    'DELETE_STUDENT': { label: 'حذف طالب', color: 'bg-red-100 text-red-700', icon: Trash2 },
    'ADD_SESSION': { label: 'تسجيل حصة', color: 'bg-emerald-100 text-emerald-700', icon: Calendar },
    'DELETE_SESSION': { label: 'حذف حصة', color: 'bg-orange-100 text-orange-700', icon: Trash2 },
    'SAVE_REPORT': { label: 'حفظ تقرير', color: 'bg-purple-100 text-purple-700', icon: FileText },
    'DELETE_REPORT': { label: 'حذف تقرير', color: 'bg-rose-100 text-rose-700', icon: Trash2 },
    'UPDATE_SURAH_PROGRESS': { label: 'تحديث الحفظ', color: 'bg-amber-100 text-amber-700', icon: Edit },
    'UPDATE_PRE_REGISTRATION': { label: 'تعديل تسجيل', color: 'bg-blue-50 text-blue-600', icon: Edit },
    'DELETE_PRE_REGISTRATION': { label: 'حذف تسجيل', color: 'bg-red-50 text-red-600', icon: Trash2 },
};

export default function ActivityLogsPage() {
    const { user, isManagement, isSuperAdmin } = useAuth();
    const { activityLogs: contextLogs, loading: contextLoading } = useStudentContext();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState<string>('ALL');
    const [filterActor, setFilterActor] = useState<string>('ALL');

    useEffect(() => {
        if (!user) return;

        if (isSuperAdmin || isManagement) {
            setLogs(contextLogs as unknown as LogEntry[]);
            setLoading(contextLoading);
        } else {
            // Sheikh view - only their logs
            setLoading(true);
            const logPath = `users/${user.uid}/activity_logs`;
            const logsRef = query(ref(db, logPath), limitToLast(200));
            const unsub = onValue(logsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const logsArray: LogEntry[] = Object.entries(snapshot.val()).map(([key, value]: [string, any]) => ({
                        id: key,
                        ...value,
                        timestamp: value.timestamp
                    })).sort((a, b) => {
                        const timeA = typeof a.timestamp === 'number' ? a.timestamp : 0;
                        const timeB = typeof b.timestamp === 'number' ? b.timestamp : 0;
                        return timeB - timeA;
                    });
                    setLogs(logsArray);
                    setError(null);
                } else {
                    setLogs([]);
                }
                setLoading(false);
            }, (err) => {
                console.error("User Logs Read Error:", err);
                setError(err.message);
                setLoading(false);
            });

            return () => off(logsRef, 'value', unsub);
        }
    }, [user, isManagement, isSuperAdmin, contextLogs, contextLoading]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch =
                log.actorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (log.details?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                (log.targetName?.toLowerCase() || '').includes(searchTerm.toLowerCase());

            const matchesAction = filterAction === 'ALL' || log.action === filterAction;
            const matchesActor = filterActor === 'ALL' || log.actorName === filterActor || (filterActor === 'Unknown' && !log.actorName);

            return matchesSearch && matchesAction && matchesActor;
        });
    }, [logs, searchTerm, filterAction, filterActor]);

    const uniqueActors = useMemo(() => {
        if (!(isSuperAdmin || isManagement)) return [];
        const actors = new Set(logs.map(l => l.actorName).filter(Boolean));
        return Array.from(actors).sort();
    }, [logs, isSuperAdmin, isManagement]);

    const groupedLogs = useMemo(() => {
        const groups: Record<string, LogEntry[]> = {};
        filteredLogs.forEach(log => {
            let dateKey = 'Unknown';
            if (log.timestamp && typeof log.timestamp === 'number') {
                dateKey = format(new Date(log.timestamp), 'yyyy-MM-dd');
            }
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(log);
        });
        return groups;
    }, [filteredLogs]);

    return (
        <div className="min-h-screen p-6 space-y-8 font-body" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3 font-headline">
                        <Activity className="w-8 h-8 text-primary" />
                        {(isSuperAdmin || isManagement) ? 'سجل النشاطات العام' : 'سجل النشاطات'}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-lg">
                        {(isSuperAdmin || isManagement)
                            ? 'مراقبة التحديثات والعمليات اليومية لجميع المشايخ.'
                            : 'مراقبة التحديثات والعمليات اليومية في فوجك.'}
                    </p>
                </div>

                <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex gap-6">
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground font-medium">نشاط اليوم</p>
                        <p className="text-2xl font-bold text-primary">
                            {filteredLogs.filter(l => l.timestamp && typeof l.timestamp === 'number' && format(new Date(l.timestamp), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                        </p>
                    </div>
                    <div className="w-px bg-border"></div>
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground font-medium">إجمالي السجلات</p>
                        <p className="text-2xl font-bold">{logs.length}</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    <div>
                        <p className="font-bold">خطأ في تحميل البيانات</p>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <div className="bg-card rounded-2xl p-5 shadow-sm border border-border grid grid-cols-1 md:grid-cols-3 gap-4 sticky top-4 z-10 backdrop-blur-xl bg-card/90">
                <div className="relative col-span-1 md:col-span-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <input
                        type="text"
                        placeholder="بحث عن طالب، أو تفاصيل..."
                        className="w-full pl-4 pr-10 py-3 rounded-xl bg-muted/50 border-transparent focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="relative">
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                    <select
                        aria-label="تصفية حسب العملية"
                        className="w-full pl-4 pr-10 py-3 rounded-xl bg-muted/50 border-transparent focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer text-sm"
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                    >
                        <option value="ALL">جميع العمليات</option>
                        {Object.keys(ACTION_CONFIG).map(action => (
                            <option key={action} value={action}>{ACTION_CONFIG[action as ActivityAction].label}</option>
                        ))}
                    </select>
                </div>

                {(isSuperAdmin || isManagement) && (
                    <div className="relative">
                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                        <select
                            aria-label="تصفية حسب الشيخ"
                            className="w-full pl-4 pr-10 py-3 rounded-xl bg-muted/50 border-transparent focus:bg-card focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer text-sm font-bold text-primary"
                            value={filterActor}
                            onChange={(e) => setFilterActor(e.target.value)}
                        >
                            <option value="ALL">جميع المشايخ</option>
                            {uniqueActors.map(actor => (
                                <option key={actor} value={actor}>{actor}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            <div className="space-y-8">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : Object.keys(groupedLogs).length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <Files className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>لا توجد سجلات مطابقة</p>
                    </div>
                ) : (
                    Object.entries(groupedLogs)
                        .sort(([dateA], [dateB]) => {
                            if (dateA === 'Unknown') return 1;
                            if (dateB === 'Unknown') return -1;
                            return dateB.localeCompare(dateA);
                        })
                        .map(([date, dayLogs]) => (
                            <div key={date} className="relative">
                                <div className="sticky top-24 z-0 flex items-center gap-4 mb-6">
                                    <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border border-primary/10 backdrop-blur-md">
                                        {date === format(new Date(), 'yyyy-MM-dd') ? 'اليوم' : format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: ar })}
                                    </div>
                                    <div className="h-px bg-border flex-1"></div>
                                </div>

                                <div className="space-y-4 pr-4 border-r-2 border-border mr-4 relative">
                                    <AnimatePresence>
                                        {dayLogs.map((log) => {
                                            const config = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-muted', icon: Activity };
                                            const Icon = config.icon;

                                            return (
                                                <motion.div
                                                    key={log.id}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    className="bg-card rounded-xl p-5 shadow-sm border border-border hover:shadow-md transition-shadow relative group"
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${config.color} shadow-sm`}>
                                                            <Icon className="w-6 h-6" />
                                                        </div>

                                                        <div className="flex-1 space-y-1">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <span className="font-bold ml-2">{log.actorName}</span>
                                                                    <span className="text-muted-foreground text-sm font-normal">
                                                                        ( {log.groupName || 'المشرف'} )
                                                                    </span>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground font-mono dir-ltr flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {log.timestamp && format(new Date(log.timestamp), 'HH:mm')}
                                                                </span>
                                                            </div>

                                                            <p className="text-foreground/90 font-medium">{log.details}</p>

                                                            {log.targetName && (
                                                                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg w-fit">
                                                                    <User className="w-3 h-3" />
                                                                    <span>{log.targetName}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="absolute top-1/2 -right-[21px] -translate-y-1/2 w-3 h-3 bg-card border-2 border-primary rounded-full z-10 group-hover:scale-125 transition-transform shadow-sm"></div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
}
