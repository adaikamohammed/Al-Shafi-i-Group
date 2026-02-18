"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, parseISO, isSameDay, isAfter, isBefore, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn, sanitizeData } from '@/lib/utils';
import { CalendarIcon, Search, Gavel, FileWarning, CheckCircle2, AlertTriangle, UserX, Calculator, Save, X, Trash2, ArrowRight, Users } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Covenant } from '@/lib/types';
import { getDatabase, ref, update } from 'firebase/database';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';

export default function PenaltiesPage() {
    const { user } = useAuth();
    const { students, allUsers } = useStudentContext(); // Need allUsers for Sheikh names
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);

    // Filters
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('today');

    // Form State
    const [absenceDays, setAbsenceDays] = useState('');
    const [reason, setReason] = useState('');
    const [writtenPenalty, setWrittenPenalty] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [compensationSessions, setCompensationSessions] = useState('');
    const [compensationDate, setCompensationDate] = useState<Date | undefined>(undefined);
    const [loading, setLoading] = useState(false);

    // Quick Reasons
    const QUICK_REASONS = [
        { label: "غياب", reason: "غياب غير مبرر", penalty: "يس 3 مرات", days: "1" },
        { label: "تأخر", reason: "تأخر عن الحصة", penalty: "وجه واحد", days: "0" },
        { label: "شغب", reason: "شغب وتشويش", penalty: "تنبيه شفهي", days: "0" },
        { label: "لم يحفظ", reason: "عدم الحفظ", penalty: "إعادة الحصة", days: "0" },
    ];

    // Helper to get Sheikh Name
    const getSheikhName = (ownerId: string) => {
        const sheikh = allUsers.find(u => u.uid === ownerId);
        return sheikh?.displayName || 'غير معروف';
    };

    // Derived Data: Groups List
    const groupsList = useMemo(() => {
        const groups = new Set<string>();
        students.forEach(s => {
            if (s.groupName) groups.add(s.groupName);
        });
        return Array.from(groups).sort();
    }, [students]);

    // Filter students for search
    const filteredStudents = useMemo(() => {
        let result = students;

        // Filter by Group
        if (selectedGroup !== 'all') {
            result = result.filter(s => s.groupName === selectedGroup);
        }

        // Filter by Search
        if (searchQuery) {
            result = result.filter(s =>
                s.fullName.includes(searchQuery) ||
                (s.groupName && s.groupName.includes(searchQuery))
            );
        }

        return result.sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
    }, [students, searchQuery, selectedGroup]);

    // Role Check
    if (!user || user.email !== 'admin00@gmail.com') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <AlertTriangle className="h-16 w-16 text-amber-500 mb-4" />
                <h1 className="text-2xl font-bold text-gray-800 mb-2">غير مصرح بالدخول</h1>
                <p className="text-gray-600">هذه الصفحة خاصة بالإدارة فقط (Admin00).</p>
            </div>
        );
    }

    const presence = (val: string) => val ? parseInt(val) : undefined;

    const handleQuickReason = (qr: any) => {
        setReason(qr.reason);
        setWrittenPenalty(qr.penalty);
        setAbsenceDays(qr.days);
        // Optional: Set default due date to next week?
        setDueDate(addDays(new Date(), 7));
    };

    const handleAddPenalty = async () => {
        if (!selectedStudent) {
            toast({ title: "خطأ", description: "يرجى اختيار طالب أولاً", variant: "destructive" });
            return;
        }
        if (!absenceDays && !writtenPenalty && !compensationSessions) {
            toast({ title: "تنبيه", description: "يجب ملء حقل واحد على الأقل (أيام الغياب، العقوبة، أو التعويض)", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const db = getDatabase();
            const covenantId = `cov_${Date.now()}`;
            const newCovenant: Covenant = {
                id: covenantId,
                type: "إجراء تأديبي",
                text: reason || "غياب غير مبرر",
                status: "نشط",
                card: "بدون",
                date: new Date().toISOString(),
                absenceDays: presence(absenceDays),
                writtenPenalty: writtenPenalty,
                dueDate: dueDate ? dueDate.toISOString() : undefined,
                compensationSessions: presence(compensationSessions),
                compensationDate: compensationDate ? compensationDate.toISOString() : undefined,
                isCompensated: false
            };

            const existingCovenants = selectedStudent.covenants || [];
            const updatedCovenants = [...existingCovenants, newCovenant];

            // FIX: Use sanitizeData to prevent undefined values
            const covenantsToSave = updatedCovenants.map(c => sanitizeData(c));

            // FIX: Use correct path users/{ownerId}/students/{studentId}
            await update(ref(db, `users/${selectedStudent.ownerId}/students/${selectedStudent.id}`), {
                covenants: covenantsToSave
            });

            toast({ title: "تم بنجاح", description: `تم إضافة الإجراء التأديبي للطالب ${selectedStudent.fullName}`, className: "bg-green-600 text-white" });
            resetForm();
        } catch (error) {
            console.error(error);
            toast({ title: "خطأ", description: "حدث خطأ أثناء حفظ البيانات", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setAbsenceDays('');
        setReason('');
        setWrittenPenalty('');
        setDueDate(undefined);
        setCompensationSessions('');
        setCompensationDate(undefined);
        setSelectedStudent(null);
        setSearchQuery('');
    };

    // Get Filtered Penalties (Logs)
    const filteredLogs = useMemo(() => {
        const logs: any[] = [];
        const now = new Date();

        let startDate = new Date();
        if (timeframe === 'today') startDate = now; // Start of today handled by isSameDay actually
        else if (timeframe === 'week') startDate = addDays(now, -7);
        else if (timeframe === 'month') startDate = addDays(now, -30);

        students.forEach(student => {
            // Apply Group Filter to logs too
            if (selectedGroup !== 'all' && student.groupName !== selectedGroup) return;

            if (student.covenants) {
                student.covenants.forEach(cov => {
                    if (cov.type === 'إجراء تأديبي') {
                        const covDate = parseISO(cov.date);
                        let include = false;

                        if (timeframe === 'today') include = isSameDay(covDate, now);
                        else include = isAfter(covDate, startDate); // approximate

                        if (include) {
                            logs.push({ student, covenant: cov });
                        }
                    }
                });
            }
        });
        return logs.sort((a, b) => parseISO(b.covenant.date).getTime() - parseISO(a.covenant.date).getTime());
    }, [students, timeframe, selectedGroup]);

    // Due Penalties (Active)
    const duePenalties = useMemo(() => {
        const today = new Date();
        const logs: any[] = [];
        students.forEach(student => {
            if (selectedGroup !== 'all' && student.groupName !== selectedGroup) return;

            if (student.covenants) {
                student.covenants.forEach(cov => {
                    if (cov.type === 'إجراء تأديبي' && cov.status === 'نشط' && cov.dueDate) {
                        const due = parseISO(cov.dueDate);
                        // Show if due is today or in past (overdue)
                        if (isSameDay(due, today) || isBefore(due, today)) {
                            logs.push({ student, covenant: cov });
                        }
                    }
                });
            }
        });
        return logs.sort((a, b) => parseISO(a.covenant.dueDate!).getTime() - parseISO(b.covenant.dueDate!).getTime());
    }, [students, selectedGroup]);

    // Statistics
    const stats = useMemo(() => {
        let totalPenalties = 0;
        let activePenalties = 0;
        let compensatedCount = 0;

        students.forEach(s => {
            if (s.covenants) {
                s.covenants.forEach(c => {
                    if (c.type === 'إجراء تأديبي') {
                        totalPenalties++;
                        if (c.status === 'نشط') activePenalties++;
                        if (c.isCompensated) compensatedCount++;
                    }
                });
            }
        });

        return { totalPenalties, activePenalties, compensatedCount };
    }, [students]);


    return (
        <div className="container mx-auto p-4 max-w-7xl space-y-8" dir="rtl">

            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                    <h1 className="text-3xl font-bold font-headline text-gray-900 flex items-center gap-2">
                        <Gavel className="h-8 w-8 text-primary" />
                        إدارة العقوبات والتعويضات
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        نظام ضبط الميدان التربوي ومتابعة المخالفات والتعويضات.
                    </p>
                </div>

                {/* Visual Stats */}
                <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-around">
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-bold">إجمالي العقوبات</p>
                        <p className="text-xl font-black text-gray-800">{stats.totalPenalties}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-bold">نشطة حالياً</p>
                        <p className="text-xl font-black text-red-600">{stats.activePenalties}</p>
                    </div>
                    <div className="w-px h-8 bg-gray-100"></div>
                    <div className="text-center">
                        <p className="text-[10px] text-muted-foreground font-bold">تم التعويض</p>
                        <p className="text-xl font-black text-green-600">{stats.compensatedCount}</p>
                    </div>
                </div>
            </div>

            {/* Main Action Area */}
            <div className="grid grid-cols-1 gap-6">

                {/* 1. Selection & Filter */}
                <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="ابحث عن طالب..."
                            className="pr-9 h-11"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                if (selectedStudent) setSelectedStudent(null);
                            }}
                        />
                        {/* Dropdown Results */}
                        {searchQuery && !selectedStudent && filteredStudents.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-xl shadow-xl max-h-60 overflow-auto custom-scrollbar">
                                {filteredStudents.map(student => (
                                    <div
                                        key={student.id}
                                        className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center border-b last:border-0 group"
                                        onClick={() => {
                                            setSelectedStudent(student);
                                            setSearchQuery(student.fullName);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">
                                                {student.fullName.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-gray-900 group-hover:text-primary transition-colors">{student.fullName}</p>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    <Users className="h-3 w-3" />
                                                    {student.groupName} <span className="text-gray-300">|</span> <span className="text-primary/70">{getSheikhName(student.ownerId)}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant={student.status === 'نشط' ? 'outline' : 'destructive'} className="text-[10px]">{student.status}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                        <SelectTrigger className="w-[180px] h-11">
                            <SelectValue placeholder="اختر الفوج" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الأفواج</SelectItem>
                            {groupsList.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>


                {/* 2. Inline Form (Speed Mode) */}
                <div className={cn("transition-all duration-500", selectedStudent ? "opacity-100 translate-y-0" : "opacity-40 translate-y-2 pointer-events-none grayscale")}>
                    <Card className="border-2 border-primary/20 shadow-md relative overflow-hidden bg-white/50 backdrop-blur-sm">
                        {selectedStudent && (
                            <div className="absolute top-3 left-3 flex items-center gap-2 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                                <span className="text-xs font-bold text-primary">{selectedStudent.fullName}</span>
                                <span className="text-[10px] text-muted-foreground">({getSheikhName(selectedStudent.ownerId)})</span>
                                <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full hover:bg-red-100 hover:text-red-600" onClick={() => setSelectedStudent(null)}>
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}

                        <CardContent className="p-6 pt-10">
                            {/* Speed Chips */}
                            <div className="mb-4 flex flex-wrap gap-2">
                                <span className="text-xs font-bold text-muted-foreground self-center ml-2">إدخال سريع:</span>
                                {QUICK_REASONS.map((qr, idx) => (
                                    <Badge
                                        key={idx}
                                        variant="secondary"
                                        className="cursor-pointer hover:bg-primary hover:text-white transition-colors px-3 py-1"
                                        onClick={() => handleQuickReason(qr)}
                                    >
                                        {qr.label}
                                    </Badge>
                                ))}
                            </div>

                            <div className="grid grid-cols-12 gap-4 items-start">
                                {/* Absence Days */}
                                <div className="col-span-2">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">أيام الغياب</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        className="text-center h-10 bg-white"
                                        value={absenceDays}
                                        onChange={(e) => setAbsenceDays(e.target.value)}
                                    />
                                </div>

                                {/* Reason */}
                                <div className="col-span-3">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">السبب</Label>
                                    <Input
                                        placeholder="سبب الغياب أو المخالفة"
                                        className="h-10 bg-white"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>

                                {/* Written Penalty */}
                                <div className="col-span-3">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">العقوبة (السور)</Label>
                                    <Input
                                        placeholder="مثال: يس 3 مرات"
                                        className="h-10 bg-white"
                                        value={writtenPenalty}
                                        onChange={(e) => setWrittenPenalty(e.target.value)}
                                    />
                                </div>

                                {/* Due Date */}
                                <div className="col-span-2">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">الاستحقاق</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-full h-10 justify-start text-right text-xs px-2 bg-white", !dueDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-auto h-3 w-3" />
                                                {dueDate ? format(dueDate, "d MMM", { locale: ar }) : "تاريخ"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus locale={ar} />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Save Button */}
                                <div className="col-span-2 flex items-end h-full pt-6">
                                    <Button onClick={handleAddPenalty} disabled={loading || !selectedStudent} className="w-full bg-primary hover:bg-primary/90 text-white h-10 shadow-md shadow-primary/20">
                                        {loading ? "جاري الحفظ..." :
                                            <span className="flex items-center gap-2">
                                                <Save className="h-4 w-4" /> حفظ
                                            </span>
                                        }
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Tables Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 1. Filtered Logs */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                            <div className="h-2 w-2 rounded-full bg-red-500"></div>
                            سجل العقوبات
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 font-normal">
                                {timeframe === 'today' ? 'اليوم' : timeframe === 'week' ? 'آخر أسبوع' : 'آخر شهر'}
                            </span>
                        </h3>
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button onClick={() => setTimeframe('today')} className={cn("px-3 py-1 text-xs rounded-md transition-all", timeframe === 'today' ? "bg-white shadow text-primary font-bold" : "text-muted-foreground hover:text-gray-900")}>اليوم</button>
                            <button onClick={() => setTimeframe('week')} className={cn("px-3 py-1 text-xs rounded-md transition-all", timeframe === 'week' ? "bg-white shadow text-primary font-bold" : "text-muted-foreground hover:text-gray-900")}>أسبوع</button>
                            <button onClick={() => setTimeframe('month')} className={cn("px-3 py-1 text-xs rounded-md transition-all", timeframe === 'month' ? "bg-white shadow text-primary font-bold" : "text-muted-foreground hover:text-gray-900")}>شهر</button>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[300px]">
                        {filteredLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-50 text-muted-foreground font-medium border-b">
                                        <tr>
                                            <th className="p-3">الطالب</th>
                                            <th className="p-3">السبب</th>
                                            <th className="p-3">العقوبة</th>
                                            <th className="p-3">التاريخ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredLogs.map((log, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className="p-3">
                                                    <p className="font-bold text-xs">{log.student.fullName}</p>
                                                    <p className="text-[10px] text-muted-foreground">{getSheikhName(log.student.ownerId)}</p>
                                                </td>
                                                <td className="p-3 text-muted-foreground text-xs">{log.covenant.text}</td>
                                                <td className="p-3">
                                                    {log.covenant.writtenPenalty ? (
                                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                                            {log.covenant.writtenPenalty}
                                                        </Badge>
                                                    ) : '-'}
                                                </td>
                                                <td className="p-3 text-[10px] text-muted-foreground">
                                                    {format(parseISO(log.covenant.date), "d MMM", { locale: ar })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <div className="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-gray-300" />
                                </div>
                                لا توجد عقوبات مسجلة في هذه الفترة
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Due Penalties */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                        <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                        مستحقة / متأخرة
                        <Badge variant="secondary" className="mr-auto">{duePenalties.length}</Badge>
                    </h3>
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[300px]">
                        {duePenalties.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-50 text-muted-foreground font-medium border-b">
                                        <tr>
                                            <th className="p-3">الطالب</th>
                                            <th className="p-3">المطلوب</th>
                                            <th className="p-3">الاستحقاق</th>
                                            <th className="p-3">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {duePenalties.map((log, idx) => {
                                            const isOverdue = isBefore(parseISO(log.covenant.dueDate!), new Date()) && !isSameDay(parseISO(log.covenant.dueDate!), new Date());
                                            return (
                                                <tr key={idx} className="hover:bg-gray-50/50">
                                                    <td className="p-3">
                                                        <p className="font-bold text-xs">{log.student.fullName}</p>
                                                        <p className="text-[10px] text-muted-foreground">{getSheikhName(log.student.ownerId)}</p>
                                                    </td>
                                                    <td className="p-3 text-muted-foreground text-xs">{log.covenant.writtenPenalty || 'تعويض'}</td>
                                                    <td className="p-3">
                                                        <div className={cn("flex items-center gap-1 font-bold text-xs", isOverdue ? "text-red-500" : "text-amber-600")}>
                                                            <CalendarIcon className="h-3 w-3" />
                                                            {format(parseISO(log.covenant.dueDate!), 'd MMM', { locale: ar })}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        {isOverdue ? <Badge variant="destructive" className="text-[10px]">متأخر</Badge> : <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px]">اليوم</Badge>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                                <div className="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-gray-300" />
                                </div>
                                لا توجد مستحقات حالياً
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
