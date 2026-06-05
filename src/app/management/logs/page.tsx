"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { ref, query, orderByChild, limitToLast, onValue, off } from 'firebase/database';
import { ActivityAction } from '@/lib/activityLogger';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
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
    'MOVE_SESSION': { label: 'نقل حصة', color: 'bg-indigo-100 text-indigo-700', icon: Calendar },
    'ADMIN_MSG': { label: 'رسالة إدارية', color: 'bg-teal-100 text-teal-700', icon: Activity },
};

const KNOWN_ACTORS = [
    "المدير العام",
    "الإدارة",
    "الشيخ زياد درويش",
    "الشيخ عبد الحميد",
    "الشيخ فؤاد بن عمر",
    "الشيخ أحمد بن عمر",
    "الشيخ إبراهيم مراد",
    "الشيخ سفيان نصيرة",
    "الشيخ محمد منصور",
    "الشيخ عبد الحق نصيرة",
    "الشيخ صهيب نصيب"
];

export default function ActivityLogsPage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState<string>('ALL');
    const [filterActor, setFilterActor] = useState<string>('ALL');

    useEffect(() => {
        const logsRef = query(ref(db, 'activity_logs'), limitToLast(200));

        const unsubscribe = onValue(logsRef, (snapshot: any) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const logsArray: LogEntry[] = Object.entries(data).map(([key, value]: [string, any]) => ({
                    id: key,
                    ...value,
                    // Handle firebase timestamp if simpler handling needed
                    timestamp: value.timestamp
                })).sort((a, b) => {
                    // Sort descending
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
        }, (err: any) => {
            console.error("Firebase Read Error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => off(logsRef, 'value', unsubscribe);
    }, []);

    const uniqueActors = useMemo(() => {
        const actors = new Set(logs.map(l => l.actorName));
        // Merge known actors so they appear in filter even if they haven't logged anything yet
        KNOWN_ACTORS.forEach(actor => actors.add(actor));
        return Array.from(actors).sort();
    }, [logs]);

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

    // Group logs by Date
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
        <div className="min-h-screen bg-gray-50/50 p-6 space-y-8 font-tajawal" dir="rtl">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <Activity className="w-8 h-8 text-primary" />
                        سجل النشاطات
                    </h1>
                    <p className="text-gray-500 mt-1 text-lg">مراقبة التحديثات والعمليات اليومية للمشايخ.</p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-6">
                    <div className="text-center">
                        <p className="text-xs text-gray-400 font-medium">نشاط اليوم</p>
                        <p className="text-2xl font-bold text-primary">
                            {filteredLogs.filter(l => l.timestamp && typeof l.timestamp === 'number' && format(new Date(l.timestamp), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length}
                        </p>
                    </div>
                    <div className="w-px bg-gray-200"></div>
                    <div className="text-center">
                        <p className="text-xs text-gray-400 font-medium">إجمالي السجلات</p>
                        <p className="text-2xl font-bold text-gray-700">{logs.length}</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    <div>
                        <p className="font-bold">خطأ في تحميل البيانات</p>
                        <p className="text-sm text-red-600/80">{error}</p>
                        <p className="text-xs mt-1">يرجى التأكد من صلاحيات الحساب (Management Role) وقواعد البيانات (Database Rules).</p>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4 sticky top-4 z-10 backdrop-blur-xl bg-white/90">

                {/* Search */}
                <div className="relative col-span-1 md:col-span-2">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="بحث عن شيخ، طالب، أو تفاصيل..."
                        className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Action Filter */}
                <div className="relative">
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                        className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer"
                        value={filterAction}
                        onChange={(e) => setFilterAction(e.target.value)}
                    >
                        <option value="ALL">جميع العمليات</option>
                        {Object.keys(ACTION_CONFIG).map(action => (
                            <option key={action} value={action}>{ACTION_CONFIG[action as ActivityAction].label}</option>
                        ))}
                    </select>
                </div>

                {/* Actor Filter */}
                <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <select
                        className="w-full pl-4 pr-10 py-3 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none cursor-pointer"
                        value={filterActor}
                        onChange={(e) => setFilterActor(e.target.value)}
                    >
                        <option value="ALL">جميع المشايخ</option>
                        {uniqueActors.map(actor => (
                            <option key={actor} value={actor}>{actor}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Timeline List */}
            <div className="space-y-8">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : Object.keys(groupedLogs).length === 0 ? (
                    <div className="text-center py-20 text-gray-400">
                        <Files className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>لا توجد سجلات مطابقة</p>
                    </div>
                ) : (
                    Object.entries(groupedLogs).map(([date, dayLogs]) => (
                        <div key={date} className="relative">
                            <div className="sticky top-24 z-0 flex items-center gap-4 mb-6">
                                <div className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold shadow-sm border border-primary/10 backdrop-blur-md">
                                    {date === format(new Date(), 'yyyy-MM-dd') ? 'اليوم' : format(parseISO(date), 'EEEE, d MMMM yyyy', { locale: ar })}
                                </div>
                                <div className="h-px bg-gray-200 flex-1"></div>
                            </div>

                            <div className="space-y-4 pr-4 border-r-2 border-gray-100 mr-4 relative">
                                {/* Timeline line decoration */}
                                <AnimatePresence>
                                    {dayLogs.map((log) => {
                                        const config = ACTION_CONFIG[log.action] || { label: log.action, color: 'bg-gray-100', icon: Activity };
                                        const Icon = config.icon;

                                        return (
                                            <motion.div
                                                key={log.id}
                                                initial={{ opacity: 0, x: 20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -20 }}
                                                className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group"
                                            >
                                                <div className="flex items-start gap-4">
                                                    {/* Icon */}
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${config.color} shadow-sm`}>
                                                        <Icon className="w-6 h-6" />
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <span className="font-bold text-gray-800 ml-2">{log.actorName}</span>
                                                                <span className="text-gray-400 text-sm font-normal">
                                                                    ( {log.groupName || 'المشرف'} )
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-gray-400 font-mono dir-ltr flex items-center gap-1">
                                                                <Clock className="w-3 h-3" />
                                                                {log.timestamp && format(new Date(log.timestamp), 'HH:mm')}
                                                            </span>
                                                        </div>

                                                        <p className="text-gray-700 font-medium">{log.details}</p>

                                                        {log.targetName && (
                                                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg w-fit">
                                                                <User className="w-3 h-3" />
                                                                <span>{log.targetName}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Timeline Dot */}
                                                <div className="absolute top-1/2 -right-[21px] -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary rounded-full z-10 group-hover:scale-125 transition-transform shadow-sm"></div>
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
