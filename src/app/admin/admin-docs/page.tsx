"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Printer, User, ClipboardList, ArrowLeft, Edit, Calendar, Clock, History, FileText, CheckCircle2, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, subDays, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Student, AdminLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/AuthContext';

export default function AdminDocsPage() {
    const { students, allUsers, saveAdminLog, adminLogs, dailySessions } = useStudentContext();
    const { user: currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [activeTab, setActiveTab] = useState('summon');

    // Filter states for History
    const [filterType, setFilterType] = useState<string>('all');
    const [filterDate, setFilterDate] = useState<string>('');
    const [filterSheikh, setFilterSheikh] = useState<string>('all');

    // Summon State
    const [summonDate, setSummonDate] = useState('');
    const [summonReason, setSummonReason] = useState('');

    // Exit Permit State
    const [exitTime, setExitTime] = useState('');
    const [exitReason, setExitReason] = useState('');

    // Absence Permit State
    const [absenceDates, setAbsenceDates] = useState('');
    const [absenceReason, setAbsenceReason] = useState('');

    // Payment State
    const [paymentTitle, setPaymentTitle] = useState('الفصل الأول');
    const [paymentAmount, setPaymentAmount] = useState('');

    // Entry Permit State
    const [entryAbsenceDays, setEntryAbsenceDays] = useState('');
    const [entryAbsenceReason, setEntryAbsenceReason] = useState('');
    const [entryPunishment, setEntryPunishment] = useState('');

    // Search Logic
    const filteredStudents = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const term = searchTerm.toLowerCase();
        return students.filter(s =>
            s.fullName.toLowerCase().includes(term) ||
            (s.phone1 && s.phone1.includes(term))
        ).slice(0, 5);
    }, [students, searchTerm]);

    const selectedSheikhName = useMemo(() => {
        if (!selectedStudent || !allUsers) return 'غير محدد';
        const sheikh = allUsers.find(u => u.role === 'sheikh' && u.group === selectedStudent.groupName);
        return sheikh?.displayName || 'غير محدد';
    }, [selectedStudent, allUsers]);

    // Statistics Calculation (Last 30 days) for Entry Permit
    const stats30Days = useMemo(() => {
        if (!selectedStudent || !dailySessions) return { absences: 0, lates: 0, total: 0 };

        const thirtyDaysAgo = subDays(new Date(), 30);
        let absences = 0;
        let lates = 0;
        let totalCount = 0;

        Object.values(dailySessions).forEach(dateGroup => {
            Object.values(dateGroup).forEach(session => {
                const sessionDate = new Date(session.date);
                if (isAfter(sessionDate, thirtyDaysAgo)) {
                    const record = (session.records || []).find(r => r.studentId === selectedStudent.id);
                    if (record) {
                        totalCount++;
                        if (record.attendance === 'غياب') absences++;
                        if (record.attendance === 'متأخر') lates++;
                    }
                }
            });
        });

        return { absences, lates, total: totalCount };
    }, [selectedStudent, dailySessions]);

    const handlePrint = async () => {
        if (!selectedStudent) return;

        let details: any = {};
        let logType: AdminLog['type'] = 'summon';

        switch (activeTab) {
            case 'summon':
                logType = 'summon';
                details = { date: summonDate, reason: summonReason };
                break;
            case 'exit':
                logType = 'exit';
                details = { time: exitTime, reason: exitReason };
                break;
            case 'absence':
                logType = 'absence';
                details = { dates: absenceDates, reason: absenceReason };
                break;
            case 'payment':
                logType = 'payment';
                details = { title: paymentTitle, amount: paymentAmount };
                break;
            case 'entry':
                logType = 'entry';
                details = {
                    absenceDays: entryAbsenceDays,
                    reason: entryAbsenceReason,
                    punishment: entryPunishment,
                    stats: stats30Days
                };
                break;
        }

        // Save log to Firebase before printing
        await saveAdminLog({
            studentId: selectedStudent.id,
            studentName: selectedStudent.fullName,
            type: logType,
            date: format(new Date(), 'yyyy-MM-dd'),
            sheikhName: selectedSheikhName,
            groupName: selectedStudent.groupName,
            details: { ...details, ownerId: selectedStudent.ownerId }
        });

        // Trigger print
        window.print();
    };

    const resetFields = () => {
        setSummonDate('');
        setSummonReason('');
        setExitTime('');
        setExitReason('');
        setAbsenceDates('');
        setAbsenceReason('');
        setPaymentAmount('');
        setEntryAbsenceDays('');
        setEntryAbsenceReason('');
        setEntryPunishment('');
    };

    // Filtered Logs Logic
    const filteredLogs = useMemo(() => {
        return adminLogs.filter(log => {
            const matchType = filterType === 'all' || log.type === filterType;
            const matchDate = !filterDate || log.date === filterDate;
            const matchSheikh = filterSheikh === 'all' || log.groupName === filterSheikh;
            return matchType && matchDate && matchSheikh;
        }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [adminLogs, filterType, filterDate, filterSheikh]);

    const sheikhGroups = useMemo(() => {
        const groups = new Set(allUsers.filter(u => u.role === 'sheikh').map(u => u.group));
        return Array.from(groups).filter(Boolean);
    }, [allUsers]);

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 p-4 md:p-8">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/10">
                            <ClipboardList className="h-6 w-6 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight font-headline">مركز الأوصال الإدارية</h1>
                    </div>
                    <p className="text-muted-foreground font-medium">توليد وطباعة الأوصال والوثائق الرسمية للطلاب</p>
                </div>

                <Tabs value={activeTab === 'history' ? 'history' : 'docs'} onValueChange={(v) => v === 'history' ? setActiveTab('history') : setActiveTab('summon')} className="w-auto">
                    <TabsList className="bg-black/20 backdrop-blur-md rounded-xl p-1">
                        <TabsTrigger value="docs" className="rounded-lg font-bold data-[state=active]:bg-primary transition-all px-6">الوثائق</TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg font-bold data-[state=active]:bg-primary transition-all px-6 gap-2">
                            <History className="h-4 w-4" />
                            السجلات
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </motion.div>

            <AnimatePresence mode="wait">
                {activeTab !== 'history' ? (
                    <motion.div
                        key="docs-view"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-8"
                    >
                        {/* Search & Inputs Sidebar */}
                        <div className="lg:col-span-12 xl:col-span-5 space-y-6">
                            <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
                                <CardHeader className="border-b border-white/5">
                                    <CardTitle className="text-lg flex items-center gap-2 font-headline">
                                        <Search className="h-5 w-5 text-blue-400" />
                                        1. اختيار الطالب
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-4">
                                    <div className="relative group">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
                                        <Input
                                            placeholder="ابحث باسم الطالب..."
                                            className="pr-10 h-11 bg-black/20 border-white/10 rounded-xl"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    <AnimatePresence>
                                        {searchTerm && filteredStudents.length > 0 && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-1">
                                                {filteredStudents.map(student => (
                                                    <button
                                                        key={student.id}
                                                        onClick={() => {
                                                            setSelectedStudent(student);
                                                            setSearchTerm('');
                                                            resetFields();
                                                        }}
                                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition-all text-right group border border-transparent hover:border-white/5"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                                <User className="h-4 w-4 text-blue-400" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold text-sm">{student.fullName}</div>
                                                                <div className="text-[10px] text-muted-foreground">{student.groupName || 'بدون فوج'}</div>
                                                            </div>
                                                        </div>
                                                        <ArrowLeft className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all" />
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {selectedStudent && (
                                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-4 border-t border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center border-2 border-primary/20">
                                                    <User className="h-5 w-5 text-primary" />
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm text-primary">{selectedStudent.fullName}</div>
                                                    <div className="text-[10px] text-muted-foreground">الشيخ: {selectedSheikhName}</div>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)} className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10">إلغاء</Button>
                                        </motion.div>
                                    )}
                                </CardContent>
                            </Card>

                            <AnimatePresence>
                                {selectedStudent && (
                                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                                        <Card className="border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
                                            <CardHeader className="border-b border-white/5">
                                                <CardTitle className="text-lg flex items-center gap-2 font-headline">
                                                    <Edit className="h-5 w-5 text-amber-400" />
                                                    2. تفاصيل الوصل
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-6">
                                                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                                                    <TabsList className="grid grid-cols-3 bg-black/40 p-1 rounded-xl h-auto gap-1">
                                                        <TabsTrigger value="summon" className="py-2.5 rounded-lg font-bold data-[state=active]:bg-primary transition-all text-[11px] md:text-sm">استدعاء</TabsTrigger>
                                                        <TabsTrigger value="exit" className="py-2.5 rounded-lg font-bold data-[state=active]:bg-primary transition-all text-[11px] md:text-sm">خروج</TabsTrigger>
                                                        <TabsTrigger value="absence" className="py-2.5 rounded-lg font-bold data-[state=active]:bg-primary transition-all text-[11px] md:text-sm">غياب</TabsTrigger>
                                                        <TabsTrigger value="payment" className="py-2.5 rounded-lg font-bold data-[state=active]:bg-primary transition-all text-[11px] md:text-sm">سداد</TabsTrigger>
                                                        <TabsTrigger value="entry" className="py-2.5 rounded-lg font-bold data-[state=active]:bg-primary transition-all text-[11px] md:text-sm">دخول</TabsTrigger>
                                                    </TabsList>

                                                    <TabsContent value="summon" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">موعد الحضور (يوم وساعة)</Label>
                                                            <Input placeholder="مثال: غداً الثلاثاء الساعة 10:00" className="bg-white/5 border-white/10" value={summonDate} onChange={(e) => setSummonDate(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">سبب الاستدعاء</Label>
                                                            <Input placeholder="مثال: مناقشة سلوك الطالب" className="bg-white/5 border-white/10" value={summonReason} onChange={(e) => setSummonReason(e.target.value)} />
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="exit" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">وقت الخروج</Label>
                                                            <Input placeholder="مثال: الساعة 11:30 صباحاً" className="bg-white/5 border-white/10" value={exitTime} onChange={(e) => setExitTime(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">سبب الخروج</Label>
                                                            <Input placeholder="مثال: موعد طبي طارئ" className="bg-white/5 border-white/10" value={exitReason} onChange={(e) => setExitReason(e.target.value)} />
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="absence" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">أيام الغياب</Label>
                                                            <Input placeholder="مثال: الأسبوع القادم كاملاً" className="bg-white/5 border-white/10" value={absenceDates} onChange={(e) => setAbsenceDates(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">سبب الغياب</Label>
                                                            <Input placeholder="مثال: سفر عائلي" className="bg-white/5 border-white/10" value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} />
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="payment" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">بيان السداد (عنوان الوصل)</Label>
                                                            <Input placeholder="مثال: مستحقات الفصل الأول" className="bg-white/5 border-white/10 font-bold" value={paymentTitle} onChange={(e) => setPaymentTitle(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">المبلغ المدفوع (د.ج)</Label>
                                                            <div className="relative">
                                                                <Input type="number" placeholder="0" className="bg-white/5 border-white/10 text-lg font-black text-emerald-400 pr-12" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">د.ج</span>
                                                            </div>
                                                        </div>
                                                    </TabsContent>

                                                    <TabsContent value="entry" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">أيام الغياب السابقة</Label>
                                                            <Input placeholder="مثال: الأسبوع الماضي" className="bg-white/5 border-white/10" value={entryAbsenceDays} onChange={(e) => setEntryAbsenceDays(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">السبب</Label>
                                                            <Input placeholder="مثال: وعكة صحية" className="bg-white/5 border-white/10" value={entryAbsenceReason} onChange={(e) => setEntryAbsenceReason(e.target.value)} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-xs font-bold text-muted-foreground">العقوبة (إن وجدت)</Label>
                                                            <Input placeholder="مثال: استظهار الحزب المنسي" className="bg-white/5 border-white/10" value={entryPunishment} onChange={(e) => setEntryPunishment(e.target.value)} />
                                                        </div>

                                                        {/* Preview 30 day summary */}
                                                        <div className="pt-2">
                                                            <div className="bg-primary/10 rounded-xl p-3 border border-primary/20 flex justify-around text-center">
                                                                <div>
                                                                    <div className="text-sm font-black">{stats30Days.total}</div>
                                                                    <div className="text-[10px] text-muted-foreground font-bold">حضور</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-black text-amber-400">{stats30Days.lates}</div>
                                                                    <div className="text-[10px] text-muted-foreground font-bold">تأخر</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-black text-rose-400">{stats30Days.absences}</div>
                                                                    <div className="text-[10px] text-muted-foreground font-bold">غياب</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TabsContent>
                                                </Tabs>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Print Preview Area */}
                        <div className="lg:col-span-12 xl:col-span-7 flex flex-col items-center">
                            <div className="text-sm font-bold opacity-50 flex items-center gap-2 mb-4">
                                <Printer className="h-4 w-4" />
                                معاينة الوصل (80 مم)
                            </div>

                            <div className="sticky top-24 w-full flex flex-col items-center gap-6">
                                {/* THE RECEIPT TARGET */}
                                <div
                                    id="printable-receipt"
                                    className="w-[300px] bg-white text-black p-5 shadow-2xl font-body"
                                    style={{ minHeight: '400px', direction: 'rtl' }}
                                >
                                    {/* Receipt Header */}
                                    <div className="text-center border-b-2 border-black pb-4 mb-4">
                                        <h2 className="text-xl font-black mb-1">
                                            {activeTab === 'summon' && 'استدعاء ولي أمر'}
                                            {activeTab === 'exit' && 'إذن خروج استثنائي'}
                                            {activeTab === 'absence' && 'إشعار غياب مسبق'}
                                            {activeTab === 'payment' && 'وصل استلام مبلغ'}
                                            {activeTab === 'entry' && 'إذن دخول للحلقة'}
                                        </h2>
                                        <p className="text-xs font-bold">المدرسة القرآنية للإمام الشافعي</p>
                                        <p className="text-[10px]">حي تكسبت الغربية / الوادي</p>
                                    </div>

                                    {selectedStudent ? (
                                        <div className="space-y-4">
                                            {/* Student Info */}
                                            <div className="space-y-2 text-xs py-2 border-b border-gray-100">
                                                <div className="flex justify-between">
                                                    <span className="font-bold">الطالب:</span>
                                                    <span className="font-black">{selectedStudent.fullName}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="font-bold">الشيخ:</span>
                                                    <span>{selectedSheikhName}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="font-bold">ولي الأمر:</span>
                                                    <span className="text-[10px]">{selectedStudent.guardianName} ({selectedStudent.phone1})</span>
                                                </div>
                                            </div>

                                            {/* Tab Specific Content */}
                                            <div className="space-y-3 py-4 min-h-[150px]">
                                                {activeTab === 'summon' && (
                                                    <div className="space-y-4">
                                                        <div className="p-2 border-r-4 border-black bg-gray-50">
                                                            <p className="text-[10px] font-bold text-gray-500 mb-1">موعد الحضور المقرر:</p>
                                                            <p className="text-sm font-black">{summonDate || '......'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-gray-500">سبب الاستدعاء:</p>
                                                            <p className="text-xs leading-relaxed">{summonReason || 'المقابلة من أجل مصلحة الطالب التربوية.'}</p>
                                                        </div>
                                                        <p className="text-[10px] italic mt-4 opacity-70">يرجى من ولي الأمر الالتزام بالموعد المحدد أعلاه.</p>
                                                    </div>
                                                )}

                                                {activeTab === 'exit' && (
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center p-2 border-2 border-black border-dashed">
                                                            <span className="text-xs font-bold">وقت الخروج:</span>
                                                            <span className="text-lg font-black">{exitTime || '......'}</span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-gray-500">سبب الخروج:</p>
                                                            <p className="text-xs">{exitReason || '......'}</p>
                                                        </div>
                                                        <div className="p-2 bg-gray-50 text-[9px] border border-gray-100 rounded">
                                                            <strong>إشعار للشيخ:</strong> يسمح للطالب بالمغادرة بناءً على طلب الإدارة.
                                                        </div>
                                                    </div>
                                                )}

                                                {activeTab === 'absence' && (
                                                    <div className="space-y-4">
                                                        <div className="p-2 border border-black bg-gray-50">
                                                            <p className="text-[10px] font-bold mb-1">أيام الغياب المصرح بها:</p>
                                                            <p className="text-sm font-black text-rose-700">{absenceDates || '......'}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold text-gray-500">السبب:</p>
                                                            <p className="text-xs">{absenceReason || '......'}</p>
                                                        </div>
                                                        <div className="pt-2 border-t border-gray-100">
                                                            <p className="text-[9px] font-bold text-gray-400">تحت إشراف الشيخ: {selectedSheikhName}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeTab === 'payment' && (
                                                    <div className="space-y-5">
                                                        <div className="text-center p-4 bg-gray-50 border-y border-black border-dashed">
                                                            <p className="text-sm font-black underline mb-3 uppercase tracking-wider">{paymentTitle}</p>
                                                            <div className="text-2xl font-black">
                                                                {paymentAmount ? `${Number(paymentAmount).toLocaleString()} د.ج` : '...... د.ج'}
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] leading-relaxed space-y-2">
                                                            <p>• تم استلام المبلغ المذكور في خزينة المدرسة.</p>
                                                            <p className="font-bold">• وصل موجه لولي الأمر وللشيخ المسؤول لتسوية الوضعية.</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {activeTab === 'entry' && (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2 text-xs">
                                                            <div className="flex justify-between border-b pb-1">
                                                                <span className="font-bold">أيام الغياب:</span>
                                                                <span className="font-black text-rose-600">{entryAbsenceDays || '......'}</span>
                                                            </div>
                                                            <div className="flex justify-between border-b pb-1">
                                                                <span className="font-bold">السبب:</span>
                                                                <span>{entryAbsenceReason || '......'}</span>
                                                            </div>
                                                            {entryPunishment && (
                                                                <div className="flex justify-between bg-gray-100 p-1 font-bold">
                                                                    <span className="text-rose-700">العقوبة:</span>
                                                                    <span>{entryPunishment}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="p-2 border-2 border-black border-dashed">
                                                            <p className="text-center text-[9px] font-black uppercase mb-1">موجز آخر 30 يوم</p>
                                                            <div className="flex justify-around text-center">
                                                                <div><div className="font-bold text-xs">{stats30Days.absences}</div><div className="text-[8px]">غياب</div></div>
                                                                <div><div className="font-bold text-xs">{stats30Days.lates}</div><div className="text-[8px]">تأخر</div></div>
                                                                <div><div className="font-bold text-xs">{stats30Days.total}</div><div className="text-[8px]">الحضور</div></div>
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] text-center italic opacity-70 underline">هذا الوصل يسمح للطالب بالالتحاق بحلقته.</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer Info */}
                                            <div className="flex justify-between items-end border-t border-black pt-4 mt-8">
                                                <div className="text-[10px]">
                                                    <p className="font-bold">حرر في:</p>
                                                    <p>{format(new Date(), 'yyyy/MM/dd HH:mm', { locale: ar })}</p>
                                                </div>
                                                <div className="text-center">
                                                    <div className="h-12 w-24 border border-black flex items-center justify-center text-[10px] font-bold mb-1 rounded-sm rotate-1 flex-col">
                                                        <span>ختم</span>
                                                        <span>الإدارة</span>
                                                    </div>
                                                    <p className="text-[8px] opacity-70 font-mono">ID: {selectedStudent.id.substring(0, 8)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-[300px] flex flex-col items-center justify-center text-gray-200 gap-4">
                                            <div className="p-4 rounded-full bg-gray-50 border-2 border-dashed border-gray-100">
                                                <User className="h-12 w-12 opacity-20" />
                                            </div>
                                            <p className="text-sm font-bold opacity-30">يرجى اختيار طالب للمعاينة</p>
                                        </div>
                                    )}
                                </div>

                                {selectedStudent && (
                                    <div className="w-full max-w-[300px] space-y-3">
                                        <Button
                                            onClick={handlePrint}
                                            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 text-lg group transition-all"
                                        >
                                            <Printer className="ml-2 h-6 w-6 group-hover:scale-110 transition-transform" />
                                            حفظ وطباعة الوصل
                                        </Button>
                                        <p className="text-[10px] text-center text-muted-foreground font-medium px-4">
                                            عند النقر سيتم تسجيل الوصل في السجلات الإدارية وفتح نافذة الطباعة.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="history-view"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="space-y-6"
                    >
                        {/* Filters Bar */}
                        <Card className="border-white/10 bg-white/5 backdrop-blur-md">
                            <CardContent className="p-4 flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-bold">تصفية السجلات:</span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <select
                                        aria-label="نوع الوثيقة"
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="bg-black/20 border-white/10 rounded-lg text-xs font-bold p-2 outline-none focus:ring-1 ring-primary"
                                    >
                                        <option value="all">كل الأنواع</option>
                                        <option value="summon">استدعاء</option>
                                        <option value="exit">خروج</option>
                                        <option value="absence">غياب</option>
                                        <option value="payment">سداد</option>
                                        <option value="entry">دخول</option>
                                    </select>

                                    <Input
                                        type="date"
                                        value={filterDate}
                                        onChange={(e) => setFilterDate(e.target.value)}
                                        className="h-9 bg-black/20 border-white/10 text-xs w-40"
                                    />

                                    <select
                                        aria-label="الفوج / الشيخ"
                                        value={filterSheikh}
                                        onChange={(e) => setFilterSheikh(e.target.value)}
                                        className="bg-black/20 border-white/10 rounded-lg text-xs font-bold p-2 outline-none focus:ring-1 ring-primary"
                                    >
                                        <option value="all">كل الأفواج</option>
                                        {sheikhGroups.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => { setFilterType('all'); setFilterDate(''); setFilterSheikh('all'); }}
                                        className="text-[10px] h-8"
                                    >
                                        إعادة تعيين
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Logs List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredLogs.length > 0 ? filteredLogs.map(log => (
                                <motion.div key={log.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                                    <Card className="border-white/5 bg-white/[0.03] hover:bg-white/[0.05] transition-all group border-r-4"
                                        style={{
                                            borderRightColor:
                                                log.type === 'summon' ? '#fbbf24' :
                                                    log.type === 'exit' ? '#60a5fa' :
                                                        log.type === 'absence' ? '#f87171' :
                                                            log.type === 'payment' ? '#34d399' : '#a78bfa'
                                        }}>
                                        <CardContent className="p-4 space-y-3">
                                            <div className="flex justify-between items-start">
                                                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-tighter">
                                                    {log.type === 'summon' && 'استدعاء'}
                                                    {log.type === 'exit' && 'خروج'}
                                                    {log.type === 'absence' && 'غياب'}
                                                    {log.type === 'payment' && 'سداد'}
                                                    {log.type === 'entry' && 'دخول'}
                                                </Badge>
                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                    <Clock className="h-3 w-3" />
                                                    {format(new Date(log.timestamp), 'yyyy/MM/dd HH:mm')}
                                                </div>
                                            </div>

                                            <div>
                                                <div className="font-black text-sm text-primary">{log.studentName}</div>
                                                <div className="text-[10px] text-muted-foreground">{log.sheikhName} | {log.groupName}</div>
                                            </div>

                                            <div className="p-2 rounded bg-black/20 text-[11px] leading-relaxed">
                                                {log.type === 'summon' && <p><strong>موعد الحضور:</strong> {log.details.date}</p>}
                                                {log.type === 'exit' && <p><strong>وقت الخروج:</strong> {log.details.time}</p>}
                                                {log.type === 'absence' && <p><strong>الأيام:</strong> {log.details.dates}</p>}
                                                {log.type === 'payment' && <p><strong>المبلغ:</strong> {Number(log.details.amount).toLocaleString()} د.ج ({log.details.title})</p>}
                                                {log.type === 'entry' && (
                                                    <div className="space-y-1">
                                                        <p><strong>الغياب:</strong> {log.details.absenceDays}</p>
                                                        {log.details.punishment && <p className="text-rose-400 font-bold"><strong>العقوبة:</strong> {log.details.punishment}</p>}
                                                    </div>
                                                )}
                                                {log.details.reason && <p className="mt-1 opacity-70"><strong>السبب:</strong> {log.details.reason}</p>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )) : (
                                <div className="col-span-full h-40 flex flex-col items-center justify-center text-muted-foreground bg-white/5 rounded-2xl border border-dashed border-white/10">
                                    <ClipboardList className="h-10 w-10 opacity-20 mb-2" />
                                    <p className="text-sm font-bold opacity-30">لا توجد سجلات مطابقة للبحث</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    #printable-receipt, #printable-receipt * { visibility: visible; }
                    #printable-receipt {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 80mm;
                        padding: 5mm;
                        margin: 0;
                        box-shadow: none;
                        border: none;
                        background: white !important;
                        color: black !important;
                        z-index: 9999;
                        direction: rtl;
                    }
                    @page { size: auto; margin: 0mm; }
                }
            `}</style>
        </div>
    );
}
