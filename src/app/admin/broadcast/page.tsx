"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
    Megaphone,
    Send,
    Users,
    Search,
    Bell,
    CheckCircle2,
    Clock,
    UserCircle,
    Building
} from 'lucide-react';
import { InternalNotification } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { arabicCompare } from '@/lib/utils';

export default function BroadcastCenterPage() {
    const { user, isSuperAdmin, isManagement } = useAuth();
    const { allUsers, addInternalNotification } = useStudentContext();
    const { toast } = useToast();

    const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [msgType, setMsgType] = useState<InternalNotification['type']>('admin_broadcast');
    const [isSending, setIsSending] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const allSheikhs = useMemo(() => {
        if (!allUsers || !Array.isArray(allUsers)) return [];
        return allUsers
            .filter(u => u.role === 'sheikh')
            .map(u => ({
                id: u.uid,
                name: u.displayName || u.email || 'مستخدم',
                group: u.group || 'بدون فوج',
                photo: u.photoURL
            }))
            .filter(u =>
                u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.group.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .sort((a, b) => arabicCompare(a.name, b.name));
    }, [allUsers, searchQuery]);

    const handleSendBroadcast = async () => {
        if (selectedRecipients.length === 0 || !subject || !message) {
            toast({ title: 'خطأ', description: 'يرجى ملء جميع الحقول واختيار المستلمين', variant: 'destructive' });
            return;
        }

        setIsSending(true);
        let successCount = 0;
        let failCount = 0;

        for (const uid of selectedRecipients) {
            try {
                await addInternalNotification(uid, subject, message, msgType);
                successCount++;
            } catch (err) {
                console.error(`Failed to send to ${uid}:`, err);
                failCount++;
            }
        }

        setIsSending(false);
        setSubject('');
        setMessage('');
        setSelectedRecipients([]);

        toast({
            title: successCount > 0 ? "✅ تمت العملية" : "❌ فشل الإرسال",
            description: `تم إرسال ${successCount} تنبيهاً بنجاح${failCount > 0 ? `. فشل ${failCount}` : ''}`,
            variant: failCount > 0 ? "destructive" : "default",
        });
    };

    const toggleRecipient = (id: string) => {
        if (selectedRecipients.includes(id)) {
            setSelectedRecipients(prev => prev.filter(r => r !== id));
        } else {
            setSelectedRecipients(prev => [...prev, id]);
        }
    };

    const selectAll = () => {
        setSelectedRecipients(allSheikhs.map(s => s.id));
    };

    const selectNone = () => {
        setSelectedRecipients([]);
    };

    return (
        <ProtectedPage>
            <div className="container mx-auto py-8 px-4 max-w-6xl space-y-8" dir="rtl">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                            <Megaphone className="h-8 w-8" />
                            مركز الإرسال والتعاميم
                        </h1>
                        <p className="text-blue-100">
                            إرسال تنبيهات فورية تظهر في حسابات المشايخ داخل المنصة
                        </p>
                    </div>
                    <div className="absolute -left-10 -bottom-10 h-64 w-64 text-white/10 rotate-12 bg-white/5 rounded-full blur-3xl" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: Configuration & Message */}
                    <div className="lg:col-span-7 space-y-6">
                        <Card className="rounded-2xl border-none shadow-lg overflow-hidden">
                            <CardHeader className="bg-gray-50/50 dark:bg-gray-800/50 border-b">
                                <CardTitle className="text-lg font-bold">محتوى التنبيه</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-4">
                                <div className="space-y-2">
                                    <Label>نوع التنبيه</Label>
                                    <Select value={msgType} onValueChange={(v: any) => setMsgType(v)}>
                                        <SelectTrigger className="rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="admin_broadcast">📣 تعميم إداري عام</SelectItem>
                                            <SelectItem value="weekly_report">📅 تقرير أسبوعي</SelectItem>
                                            <SelectItem value="monthly_report">📊 تقرير شهري</SelectItem>
                                            <SelectItem value="absence_alert">⚠️ تنبيه غياب</SelectItem>
                                            <SelectItem value="payment_reminder">💳 تذكير مالي</SelectItem>
                                            <SelectItem value="achievement_newsletter">🏆 نشرة إنجازات</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>عنوان التنبيه</Label>
                                    <Input
                                        placeholder="اكتب عنواناً جذاباً ومختصراً..."
                                        className="rounded-xl"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>نص الرسالة</Label>
                                    <Textarea
                                        placeholder="اكتب تفاصيل الإشعار هنا..."
                                        className="rounded-xl min-h-[250px] leading-relaxed"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                    />
                                    <p className="text-[10px] text-muted-foreground">تنبيه: سيصل هذا الإشعار للمستخدمين المحددين داخل حساباتهم في الموقع.</p>
                                </div>
                            </CardContent>
                            <CardFooter className="bg-gray-50/50 dark:bg-gray-800/50 border-t p-6">
                                <Button
                                    className="w-full rounded-xl py-6 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 font-bold"
                                    onClick={handleSendBroadcast}
                                    disabled={isSending || selectedRecipients.length === 0}
                                >
                                    {isSending ? (
                                        <Clock className="ml-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="ml-2 h-4 w-4" />
                                    )}
                                    إرسال إلى {selectedRecipients.length} مستلم
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>

                    {/* Right: Recipient Selection */}
                    <div className="lg:col-span-5 space-y-6">
                        <Card className="rounded-2xl border-none shadow-lg h-full flex flex-col overflow-hidden">
                            <CardHeader className="bg-gray-50/50 dark:bg-gray-800/50 border-b">
                                <div className="flex justify-between items-center mb-4">
                                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                                        <Users className="h-5 w-5 text-indigo-500" />
                                        المستلمون
                                    </CardTitle>
                                    <span className="text-xs font-bold px-2 py-1 bg-indigo-100 text-indigo-700 rounded-lg">
                                        {selectedRecipients.length} محدد
                                    </span>
                                </div>
                                <div className="relative mb-2">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="بحث عن شيخ أو فوج..."
                                        className="pr-10 rounded-xl bg-white"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={selectAll}>
                                        تحديد الكل
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs font-bold text-gray-500 hover:text-red-600 hover:bg-red-50" onClick={selectNone}>
                                        إلغاء الكل
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 overflow-y-auto max-h-[600px]">
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {allSheikhs.map((sheikh) => (
                                        <div
                                            key={sheikh.id}
                                            onClick={() => toggleRecipient(sheikh.id)}
                                            className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${selectedRecipients.includes(sheikh.id)
                                                ? 'bg-indigo-50/50 dark:bg-indigo-900/10'
                                                : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                                                }`}
                                        >
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedRecipients.includes(sheikh.id)
                                                ? 'bg-indigo-600 border-indigo-600'
                                                : 'border-gray-300 dark:border-gray-700'
                                                }`}>
                                                {selectedRecipients.includes(sheikh.id) && <CheckCircle2 className="h-4 w-4 text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                                                    {sheikh.name}
                                                </p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Building className="h-3 w-3" />
                                                    {sheikh.group}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {allSheikhs.length === 0 && (
                                        <div className="py-12 text-center text-gray-400 space-y-2">
                                            <Users className="h-10 w-10 mx-auto opacity-20" />
                                            <p className="text-sm">لا يوجد مشايخ متوافقين مع البحث</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </ProtectedPage>
    );
}
