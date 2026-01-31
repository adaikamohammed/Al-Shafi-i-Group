"use client";

import React, { useState } from 'react';
import {
    Bell,
    CheckCircle2,
    Clock,
    Trash2,
    MailOpen,
    Mail,
    AlertCircle,
    Calendar,
    FileText,
    Award,
    CreditCard,
    Megaphone,
    Search,
    Filter
} from 'lucide-react';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { InternalNotification } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

export default function SheikhNotificationsPage() {
    const { internalNotifications, markNotificationAsRead, loading } = useStudentContext();
    const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const filteredNotifications = internalNotifications.filter(n => {
        const matchesFilter =
            filter === 'all' ? true :
                filter === 'unread' ? !n.read : n.read;

        const matchesSearch =
            n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            n.message.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const unreadCount = internalNotifications.filter(n => !n.read).length;

    const getIcon = (type: InternalNotification['type']) => {
        switch (type) {
            case 'weekly_report': return <Calendar className="h-5 w-5 text-blue-500" />;
            case 'monthly_report': return <FileText className="h-5 w-5 text-purple-500" />;
            case 'absence_alert': return <AlertCircle className="h-5 w-5 text-red-500" />;
            case 'achievement_newsletter': return <Award className="h-5 w-5 text-amber-500" />;
            case 'payment_reminder': return <CreditCard className="h-5 w-5 text-green-500" />;
            case 'admin_broadcast': return <Megaphone className="h-5 w-5 text-blue-600" />;
            default: return <Bell className="h-5 w-5 text-gray-400" />;
        }
    };

    const getTypeLabel = (type: InternalNotification['type']) => {
        switch (type) {
            case 'weekly_report': return 'تقرير أسبوعي';
            case 'monthly_report': return 'تقرير شهري';
            case 'absence_alert': return 'تنبيه غياب';
            case 'achievement_newsletter': return 'نشرة إنجازات';
            case 'payment_reminder': return 'تذكير بالدفع';
            case 'admin_broadcast': return 'تعميم إداري';
            default: return 'إشعار';
        }
    };

    const handleMarkAsRead = (id: string) => {
        markNotificationAsRead(id);
    };

    const selectedNotification = internalNotifications.find(n => n.id === selectedId);

    return (
        <ProtectedPage>
            <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-6xl space-y-8" dir="rtl">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl dark:shadow-blue-900/20 overflow-hidden relative">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold mb-2">مركز الإشعارات</h1>
                        <p className="text-blue-100 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            لديك {unreadCount} إشعارات غير مقروءة
                        </p>
                    </div>
                    <div className="flex gap-2 relative z-10">
                        <Button variant="secondary" className="bg-white/10 border-white/20 hover:bg-white/20 text-white rounded-xl">
                            تحديد الكل كمقروء
                        </Button>
                    </div>
                    {/* Decorative Background Icon */}
                    <Bell className="absolute -left-8 -bottom-8 h-48 w-48 text-white/10 rotate-12" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* List Section */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="flex gap-2 items-center">
                            <div className="relative flex-1">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="بحث في الإشعارات..."
                                    className="pr-10 rounded-xl"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                                <SelectTrigger className="w-[120px] rounded-xl">
                                    <SelectValue placeholder="تصفية" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="all">الكل</SelectItem>
                                    <SelectItem value="unread">غير المقروء</SelectItem>
                                    <SelectItem value="read">المقروء</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <ScrollArea className="h-[600px] rounded-2xl border bg-card/50 backdrop-blur-sm shadow-inner">
                            <div className="p-4 space-y-3">
                                <AnimatePresence mode="popLayout">
                                    {filteredNotifications.length > 0 ? (
                                        filteredNotifications.map((n) => (
                                            <motion.div
                                                key={n.id}
                                                layout
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                onClick={() => {
                                                    setSelectedId(n.id);
                                                    if (!n.read) handleMarkAsRead(n.id);
                                                }}
                                                className={`p-4 rounded-xl border transition-all cursor-pointer relative group ${selectedId === n.id
                                                        ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
                                                        : 'bg-card hover:bg-gray-50 dark:hover:bg-gray-800/50'
                                                    } ${!n.read ? 'border-r-4 border-r-blue-500' : ''}`}
                                            >
                                                <div className="flex gap-4">
                                                    <div className={`p-2 rounded-lg ${!n.read ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                                                        {getIcon(n.type)}
                                                    </div>
                                                    <div className="flex-1 space-y-1 overflow-hidden">
                                                        <div className="flex justify-between items-start">
                                                            <span className="text-xs font-medium text-gray-400">
                                                                {getTypeLabel(n.type)}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400">
                                                                {format(new Date(n.timestamp), 'HH:mm dd/MM', { locale: ar })}
                                                            </span>
                                                        </div>
                                                        <h3 className={`text-sm font-bold truncate ${!n.read ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                                                            {n.title}
                                                        </h3>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                            {n.message}
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-4">
                                            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-full">
                                                <Bell className="h-10 w-10 opacity-20" />
                                            </div>
                                            <p className="text-sm">لا توجد إشعارات حالياً</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Content Section */}
                    <div className="lg:col-span-7">
                        <AnimatePresence mode="wait">
                            {selectedNotification ? (
                                <motion.div
                                    key={selectedNotification.id}
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="h-full"
                                >
                                    <Card className="h-full rounded-2xl border-none shadow-xl bg-card overflow-hidden flex flex-col">
                                        <CardHeader className="bg-gray-50/50 dark:bg-gray-800/50 border-b p-6">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-2">
                                                    <Badge variant="outline" className="rounded-lg px-2 text-[10px] font-medium border-blue-200 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                                                        {getTypeLabel(selectedNotification.type)}
                                                    </Badge>
                                                    <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white">
                                                        {selectedNotification.title}
                                                    </CardTitle>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                                        <span className="flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {format(new Date(selectedNotification.timestamp), 'eeee dd MMMM yyyy - HH:mm', { locale: ar })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button variant="outline" size="icon" className="rounded-xl hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex-1 p-8">
                                            <ScrollArea className="h-full pr-4">
                                                <div className="prose prose-blue dark:prose-invert max-w-none">
                                                    <div
                                                        className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300"
                                                        dangerouslySetInnerHTML={{ __html: selectedNotification.message }}
                                                    />
                                                </div>
                                            </ScrollArea>
                                        </CardContent>
                                        <CardFooter className="bg-gray-50/50 dark:bg-gray-800/50 border-t p-6 flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                {!selectedNotification.read ? (
                                                    <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                                                        <Clock className="h-3 w-3" />
                                                        غير مقروءة
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        تمت قراءتها
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-3">
                                                {selectedNotification.type.includes('report') && (
                                                    <Button variant="default" className="rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                                                        استعراض التقرير الكامل
                                                    </Button>
                                                )}
                                                <Button variant="outline" className="rounded-xl" onClick={() => setSelectedId(null)}>
                                                    إغلاق
                                                </Button>
                                            </div>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-6 border-2 border-dashed rounded-3xl bg-gray-50/30 dark:bg-gray-800/10">
                                    <div className="relative">
                                        <div className="p-8 bg-white dark:bg-card rounded-full shadow-2xl relative z-10">
                                            <MailOpen className="h-16 w-16 text-blue-500/40" />
                                        </div>
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                                            transition={{ duration: 3, repeat: Infinity }}
                                            className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full"
                                        />
                                    </div>
                                    <div className="space-y-2 max-w-xs">
                                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">اختر إشعاراً لقراءته</h3>
                                        <p className="text-sm text-gray-500">
                                            اضغط على أي إشعار من القائمة على اليمين لاستعراض محتواه بالكامل.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </ProtectedPage>
    );
}
