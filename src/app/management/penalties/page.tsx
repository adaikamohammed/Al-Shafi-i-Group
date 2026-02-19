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
import { CalendarIcon, Search, Gavel, FileWarning, CheckCircle2, AlertTriangle, UserX, Calculator, Save, X, Trash2, ArrowRight, Users, Loader2, Printer, Download } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Covenant } from '@/lib/types';
import { getDatabase, ref, update } from 'firebase/database';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { PenaltiesReport } from '@/components/reports/PenaltiesReport';

export default function PenaltiesPage() {
    const { user, isSuperAdmin, isManagement } = useAuth(); // Added role checkers
    const { students, allUsers } = useStudentContext(); // Need allUsers for Sheikh names

    const handlePrint = () => {
        window.print();
    };

    const downloadCSV = () => {
        if (!filteredLogs.length) {
            toast({ title: "تنبيه", description: "لا توجد بيانات للتصدير", variant: "default" });
            return;
        }

        const headers = ["الطالب", "الفوج", "الشيخ", "نوع الالتزام", "السبب / النص", "العقوبة", "الحالة", "تاريخ العقوبة", "حصص التعويض", "تاريخ التعويض", "حالة التعويض"];

        const rows = filteredLogs.map(({ student, covenant }) => [
            student.fullName,
            student.groupName,
            getSheikhName(student.ownerId),
            covenant.commitmentType || "غير محدد",
            covenant.text,
            covenant.writtenPenalty || "-",
            covenant.status || "نشط",
            format(parseISO(covenant.date), "yyyy-MM-dd"),
            covenant.compensationSessions || "0",
            covenant.compensationDate ? format(parseISO(covenant.compensationDate), "yyyy-MM-dd") : "-",
            covenant.isCompensated ? "تم" : "لم يتم"
        ]);

        const csvContent = [
            "\uFEFF" + headers.join(","), // Add BOM
            ...rows.map(e => e.map(field => `"${String(field).replace(/"/g, '""')}"`).join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `penalties_report_${format(new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<any>(null);

    // Filters
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month' | 'custom'>('month'); // Changed default to month
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
    const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);

    // Effect to enforce group selection for Sheikhs
    React.useEffect(() => {
        if (user && !isSuperAdmin && !isManagement && user.group) {
            setSelectedGroup(user.group);
        }
    }, [user, isSuperAdmin, isManagement]);

    // Form State
    const [absenceDays, setAbsenceDays] = useState('');
    const [reason, setReason] = useState('');
    const [writtenPenalty, setWrittenPenalty] = useState('');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [compensationSessions, setCompensationSessions] = useState('');
    const [compensationDate, setCompensationDate] = useState<Date | undefined>(undefined);
    const [commitmentType, setCommitmentType] = useState<string>('');
    const [status, setStatus] = useState<string>('نشط'); // New State for Status
    const [editingCovenant, setEditingCovenant] = useState<Covenant | null>(null);
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
        const uniqueGroups = new Map<string, string>(); // groupName -> sheikhName
        students.forEach(s => {
            if (s.groupName && !uniqueGroups.has(s.groupName)) {
                // Find owner of this student to get Sheikh Name
                const sheikh = allUsers.find(u => u.uid === s.ownerId);
                uniqueGroups.set(s.groupName, sheikh?.displayName || 'غير معروف');
            }
        });

        return Array.from(uniqueGroups.entries()).map(([groupName, sheikhName]) => ({
            groupName,
            sheikhName
        })).sort((a, b) => {
            // Extract numbers for sorting: "فوج 1" -> 1
            const numA = parseInt(a.groupName.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.groupName.replace(/\D/g, '')) || 0;
            return numA - numB;
        });
    }, [students, allUsers]);

    // Filter students for search
    const filteredStudents = useMemo(() => {
        let result = students;

        // Force filter by group for Sheikhs (double check security)
        if (user && !isSuperAdmin && !isManagement && user.group) {
            result = result.filter(s => s.groupName === user.group);
        } else if (selectedGroup !== 'all') {
            // Normal filter for admins
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
    }, [students, searchQuery, selectedGroup, user, isSuperAdmin, isManagement]);

    // Role Check - Allow if logged in and has role (basic check, relying on Layout for protection primarily)
    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-gray-600">جاري التحميل...</p>
            </div>
        );
    }

    // Check access permission via role - though layout handles this, double check doesn't hurt
    // We assume if they reached here, they have permission via `canAccessPage` in layout/middleware logic essentially.

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

            let updatedCovenants = [...(selectedStudent.covenants || [])];

            if (editingCovenant) {
                // Update existing covenant
                updatedCovenants = updatedCovenants.map(c => {
                    if (c.id === editingCovenant.id) {
                        return {
                            ...c,
                            text: reason || c.text,
                            absenceDays: presence(absenceDays),
                            writtenPenalty: writtenPenalty,
                            dueDate: dueDate ? dueDate.toISOString() : undefined,
                            compensationSessions: presence(compensationSessions),
                            compensationDate: compensationDate ? compensationDate.toISOString() : undefined,

                            commitmentType: commitmentType || undefined,
                            status: (status as any) || 'نشط', // Update Status
                        };
                    }
                    return c;
                });
                toast({ title: "تم بنجاح", description: `تم تحديث العقوبة للطالب ${selectedStudent.fullName}`, className: "bg-green-600 text-white" });
            } else {
                // Add new covenant
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
                    isCompensated: false,
                    commitmentType: commitmentType || undefined,
                };
                updatedCovenants.push(newCovenant);
                toast({ title: "تم بنجاح", description: `تم إضافة الإجراء التأديبي للطالب ${selectedStudent.fullName}`, className: "bg-green-600 text-white" });
            }

            // FIX: Use sanitizeData to prevent undefined values
            const covenantsToSave = updatedCovenants.map(c => sanitizeData(c));

            // FIX: Use correct path users/{ownerId}/students/{studentId}
            await update(ref(db, `users/${selectedStudent.ownerId}/students/${selectedStudent.id}`), {
                covenants: covenantsToSave
            });

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
        setCommitmentType('');
        setStatus('نشط'); // Reset Status
        setSelectedStudent(null);
        setSearchQuery('');
        setEditingCovenant(null);
    };

    const handleEdit = (student: any, covenant: Covenant) => {
        setSelectedStudent(student);
        setEditingCovenant(covenant);

        // Populate form
        setReason(covenant.text || '');
        setAbsenceDays(covenant.absenceDays?.toString() || '');
        setWrittenPenalty(covenant.writtenPenalty || '');
        setDueDate(covenant.dueDate ? parseISO(covenant.dueDate) : undefined);
        setCompensationSessions(covenant.compensationSessions?.toString() || '');
        setCompensationDate(covenant.compensationDate ? parseISO(covenant.compensationDate) : undefined);
        setCommitmentType(covenant.commitmentType || '');
        setStatus(covenant.status || 'نشط'); // Populate Status

        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (student: any, covenantId: string) => {
        if (!confirm('هل أنت متأكد من حذف هذه العقوبة؟')) return;

        try {
            const db = getDatabase();
            const updatedCovenants = (student.covenants || []).filter((c: Covenant) => c.id !== covenantId);
            const covenantsToSave = updatedCovenants.map((c: Covenant) => sanitizeData(c));

            await update(ref(db, `users/${student.ownerId}/students/${student.id}`), {
                covenants: covenantsToSave
            });
            toast({ title: "تم الحذف", description: "تم حذف العقوبة بنجاح", className: "bg-red-600 text-white" });
        } catch (error) {
            console.error(error);
            toast({ title: "خطأ", description: "فشل الحذف", variant: "destructive" });
        }
    };

    // Get Filtered Penalties (Logs)
    const filteredLogs = useMemo(() => {
        const logs: any[] = [];
        const now = new Date();

        let startDate = new Date();
        let endDate = new Date();

        if (timeframe === 'today') {
            startDate = now;
            endDate = now;
        } else if (timeframe === 'week') {
            startDate = addDays(now, -7);
            endDate = now;
        } else if (timeframe === 'month') {
            startDate = addDays(now, -30);
            endDate = now;
        } else if (timeframe === 'custom') {
            if (customStartDate) startDate = customStartDate;
            else startDate = new Date(0); // far past

            if (customEndDate) endDate = customEndDate;
            else endDate = now;
        }

        students.forEach(student => {
            // Enforce Group Filter
            if (selectedGroup !== 'all' && student.groupName !== selectedGroup) return;
            if (user && !isSuperAdmin && !isManagement && user.group && student.groupName !== user.group) return;

            if (student.covenants) {
                student.covenants.forEach(cov => {
                    // Filter by Status
                    if (statusFilter !== 'all') {
                        if (statusFilter === 'active' && cov.status !== 'نشط' && !cov.status) return; // Treat undefined as active/pending
                        if (statusFilter === 'fulfilled' && cov.status !== 'تم الوفاء بها') return;
                        if (statusFilter === 'broken' && cov.status !== 'نُقِض') return;
                        if (statusFilter === 'active' && cov.status && cov.status !== 'نشط') return;
                    }

                    const covDate = parseISO(cov.date);
                    let include = false;

                    if (timeframe === 'today') {
                        include = isSameDay(covDate, now);
                    } else if (timeframe === 'custom') {
                        include = (isAfter(covDate, startDate) || isSameDay(covDate, startDate)) &&
                            (isBefore(covDate, endDate) || isSameDay(covDate, endDate));
                    } else {
                        include = isAfter(covDate, startDate);
                    }

                    if (include) {
                        logs.push({ student, covenant: cov });
                    }
                });
            }
        });
        return logs.sort((a, b) => parseISO(b.covenant.date).getTime() - parseISO(a.covenant.date).getTime());
    }, [students, timeframe, selectedGroup, user, isSuperAdmin, isManagement, statusFilter, customStartDate, customEndDate]);

    // Due Penalties (Active)
    const duePenalties = useMemo(() => {
        const today = new Date();
        const logs: any[] = [];
        students.forEach(student => {
            // Enforce Group Filter
            if (selectedGroup !== 'all' && student.groupName !== selectedGroup) return;
            // Double check for safety
            if (user && !isSuperAdmin && !isManagement && user.group && student.groupName !== user.group) return;

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
    }, [students, selectedGroup, user, isSuperAdmin, isManagement]);

    // Statistics
    const stats = useMemo(() => {
        let totalPenalties = 0;
        let activePenalties = 0;
        let compensatedCount = 0;

        students.forEach(s => {
            // Enforce Group Filter
            if (selectedGroup !== 'all' && s.groupName !== selectedGroup) return;
            // Double check for safety
            if (user && !isSuperAdmin && !isManagement && user.group && s.groupName !== user.group) return;

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
    }, [students, selectedGroup, user, isSuperAdmin, isManagement]);


    return (
        <div className="container mx-auto p-4 max-w-7xl space-y-8" dir="rtl">

            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
                <div className="md:col-span-3">
                    <h1 className="text-3xl font-bold font-headline text-gray-900 flex items-center gap-2">
                        <Gavel className="h-8 w-8 text-primary" />
                        إدارة العقوبات والتعويضات
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        نظام ضبط الميدان التربوي ومتابعة المخالفات والتعويضات.
                        {(user && !isSuperAdmin && !isManagement) && <span className="text-primary font-bold mr-2">({user.group})</span>}
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
            <div className="grid grid-cols-1 gap-6 print:hidden">

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
                                                    {student.groupName}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant={student.status === 'نشط' ? 'outline' : 'destructive'} className="text-[10px]">{student.status}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Show Dropdown ONLY for Admins */}
                    {(isSuperAdmin || isManagement) ? (
                        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                            <SelectTrigger className="w-[180px] h-11">
                                <SelectValue placeholder="اختر الفوج" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الأفواج</SelectItem>
                                {groupsList.map(g => (
                                    <SelectItem key={g.groupName} value={g.groupName}>
                                        {g.groupName} - {g.sheikhName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
                        <div className="w-[180px] h-11 flex items-center justify-center bg-gray-50 rounded-md border text-sm font-bold text-gray-500">
                            {user?.group || 'فوجي'}
                        </div>
                    )}
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
                                {/* Row 1 */}
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
                                <div className="col-span-4">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">السبب</Label>
                                    <Input
                                        placeholder="سبب الغياب أو المخالفة"
                                        className="h-10 bg-white"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                    />
                                </div>

                                {/* Commitment Type */}
                                <div className="col-span-3">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">نوع الالتزام</Label>
                                    <Select value={commitmentType} onValueChange={setCommitmentType}>
                                        <SelectTrigger className="h-10 bg-white">
                                            <SelectValue placeholder="اختر" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="قرآن">قرآن</SelectItem>
                                            <SelectItem value="صلاة">صلاة</SelectItem>
                                            <SelectItem value="سلوك">سلوك</SelectItem>
                                            <SelectItem value="غياب">غياب</SelectItem> {/* Added Absence */}
                                            <SelectItem value="أخرى">أخرى</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[9px] text-muted-foreground mt-1">
                                        * نوع المخالفة أو الالتزام المرتبط
                                    </p>
                                </div>

                                {/* Status Selector (Only in Edit Mode) */}
                                {editingCovenant && (
                                    <div className="col-span-3">
                                        <Label className="text-[10px] text-muted-foreground mb-1 block">حالة العقوبة</Label>
                                        <Select value={status} onValueChange={setStatus}>
                                            <SelectTrigger className={cn("h-10 bg-white border-2", status === 'تم الوفاء بها' ? "border-green-200 bg-green-50 text-green-700" : status === 'نُقِض' ? "border-red-200 bg-red-50 text-red-700" : "")}>
                                                <SelectValue placeholder="الحالة" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="نشط">نشط (قيد الانتظار)</SelectItem>
                                                <SelectItem value="تم الوفاء بها">✅ تم الوفاء (أنجزت)</SelectItem>
                                                <SelectItem value="نُقِض">❌ تم النقض (لم تنجز)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

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

                                {/* Row 2 */}
                                {/* Due Date (Penalty) */}
                                <div className="col-span-3">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">استحقاق العقوبة</Label>
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

                                {/* Compensation Sessions */}
                                <div className="col-span-3">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">حصص التعويض</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        placeholder="عدد الحصص"
                                        className="text-center h-10 bg-white"
                                        value={compensationSessions}
                                        onChange={(e) => setCompensationSessions(e.target.value)}
                                    />
                                </div>

                                {/* Compensation Date */}
                                <div className="col-span-3">
                                    <Label className="text-[10px] text-muted-foreground mb-1 block">تاريخ التعويض</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" className={cn("w-full h-10 justify-start text-right text-xs px-2 bg-white", !compensationDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-auto h-3 w-3" />
                                                {compensationDate ? format(compensationDate, "d MMM", { locale: ar }) : "تاريخ"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar mode="single" selected={compensationDate} onSelect={setCompensationDate} initialFocus locale={ar} />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Save Button */}
                                <div className="col-span-3 flex items-end h-full pt-6">
                                    <div className="flex gap-2 w-full">
                                        <Button onClick={handleAddPenalty} disabled={loading || !selectedStudent} className={cn("flex-1 text-white h-10 shadow-md shadow-primary/20", editingCovenant ? "bg-amber-600 hover:bg-amber-700" : "bg-primary hover:bg-primary/90")}>
                                            {loading ? "جاري الحفظ..." :
                                                <span className="flex items-center gap-2">
                                                    <Save className="h-4 w-4" /> {editingCovenant ? "تحديث" : "حفظ"}
                                                </span>
                                            }
                                        </Button>
                                        {editingCovenant && (
                                            <Button variant="outline" onClick={resetForm} className="px-3 h-10 border-red-200 text-red-600 hover:bg-red-50">
                                                إلغاء
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>

                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Tables Grid - Changed to Full Width Stack */}
            <div className="grid grid-cols-1 gap-6 print:hidden">

                {/* 1. Due Penalties (kept as separate section above logs for visibility) */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                        <div className="h-2 w-2 rounded-full bg-amber-500"></div>
                        مستحقة / متأخرة
                        <Badge variant="secondary" className="mr-auto">{duePenalties.length}</Badge>
                    </h3>
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        {/* Due Penalties Table Content - Keeping compact */}
                        {duePenalties.length > 0 ? (
                            <div className="overflow-x-auto max-h-[300px]">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-50 text-muted-foreground font-medium border-b sticky top-0">
                                        <tr>
                                            <th className="p-3">الطالب</th>
                                            <th className="p-3">المطلوب</th>
                                            <th className="p-3">الاستحقاق</th>
                                            <th className="p-3">الحالة</th>
                                            <th className="p-3">إجراءات</th>
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
                                                    <td className="p-3 flex items-center gap-2">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(log.student, log.covenant)}>
                                                            <Search className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:bg-green-50" onClick={() => {
                                                            const updated = { ...log.covenant, status: 'تم الوفاء بها' };
                                                            handleEdit(log.student, updated);
                                                        }}>
                                                            <CheckCircle2 className="h-3 w-3" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-gray-300" />
                                لا توجد مستحقات حالياً
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Main Logs (Expanded) */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">

                        {/* Title & Print */}
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                                <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                سجل العقوبات
                            </h3>
                            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={downloadCSV}>
                                <Download className="h-3 w-3" /> تصدير Excel
                            </Button>
                            <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handlePrint}>
                                <Printer className="h-3 w-3" /> طباعة
                            </Button>
                        </div>

                        {/* Advanced Filters */}
                        <div className="flex flex-wrap items-center gap-2 flex-1 justify-end">

                            {/* Status Filter */}
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[120px] h-8 text-xs">
                                    <SelectValue placeholder="الحالة" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">كل الحالات</SelectItem>
                                    <SelectItem value="active">نشط (Active)</SelectItem>
                                    <SelectItem value="fulfilled">تم الوفاء (Done)</SelectItem>
                                    <SelectItem value="broken">تم النقض (Broken)</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Timeframe Presets */}
                            <div className="flex bg-gray-100 rounded-lg p-1 h-8 items-center">
                                <button onClick={() => setTimeframe('today')} className={cn("px-3 h-full text-[10px] rounded-md transition-all flex items-center", timeframe === 'today' ? "bg-white shadow text-primary font-bold" : "text-muted-foreground hover:text-gray-900")}>اليوم</button>
                                <button onClick={() => setTimeframe('week')} className={cn("px-3 h-full text-[10px] rounded-md transition-all flex items-center", timeframe === 'week' ? "bg-white shadow text-primary font-bold" : "text-muted-foreground hover:text-gray-900")}>أسبوع</button>
                                <button onClick={() => setTimeframe('month')} className={cn("px-3 h-full text-[10px] rounded-md transition-all flex items-center", timeframe === 'month' ? "bg-white shadow text-primary font-bold" : "text-muted-foreground hover:text-gray-900")}>شهر</button>
                                <button onClick={() => setTimeframe('custom')} className={cn("px-3 h-full text-[10px] rounded-md transition-all flex items-center", timeframe === 'custom' ? "bg-white shadow text-primary font-bold" : "text-muted-foreground hover:text-gray-900")}>مخصص</button>
                            </div>

                            {/* Custom Date Inputs (Show if timeframe is custom) */}
                            {timeframe === 'custom' && (
                                <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2">
                                    <Input
                                        type="date"
                                        className="h-8 text-xs w-auto"
                                        onChange={(e) => setCustomStartDate(e.target.valueAsDate || undefined)}
                                    />
                                    <span className="text-muted-foreground">-</span>
                                    <Input
                                        type="date"
                                        className="h-8 text-xs w-auto"
                                        onChange={(e) => setCustomEndDate(e.target.valueAsDate || undefined)}
                                    />
                                </div>
                            )}

                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden min-h-[300px]">
                        {filteredLogs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-50 text-muted-foreground font-medium border-b">
                                        <tr>
                                            <th className="p-3">الطالب</th>
                                            <th className="p-3">السبب / الالتزام</th>
                                            <th className="p-3">العقوبة</th>
                                            <th className="p-3">التاريخ</th>
                                            <th className="p-3">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredLogs.map((log, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                <td className="p-3">
                                                    <p className="font-bold text-xs">{log.student.fullName}</p>
                                                    <p className="text-[10px] text-muted-foreground">{getSheikhName(log.student.ownerId)}</p>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col">
                                                        <span className="text-muted-foreground text-xs">{log.covenant.text}</span>
                                                        {log.covenant.commitmentType && <Badge variant="secondary" className="w-fit text-[9px] mt-1">{log.covenant.commitmentType}</Badge>}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex flex-col gap-1 items-start">
                                                        {log.covenant.writtenPenalty && (
                                                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                                                {log.covenant.writtenPenalty}
                                                            </Badge>
                                                        )}
                                                        {log.covenant.compensationSessions && (
                                                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                                                تعويض: {log.covenant.compensationSessions} حصص
                                                            </Badge>
                                                        )}
                                                        {!log.covenant.writtenPenalty && !log.covenant.compensationSessions && '-'}
                                                    </div>
                                                </td>

                                                <td className="p-3 text-[10px] text-muted-foreground">
                                                    {format(parseISO(log.covenant.date), "d MMM", { locale: ar })}
                                                    <div className="mt-1">
                                                        <Badge variant="outline" className={cn("text-[9px]",
                                                            log.covenant.status === 'تم الوفاء بها' ? "bg-green-50 text-green-700 border-green-200" :
                                                                log.covenant.status === 'نُقِض' ? "bg-red-50 text-red-700 border-red-200" : "bg-gray-100 text-gray-500"
                                                        )}>
                                                            {log.covenant.status}
                                                        </Badge>
                                                    </div>
                                                </td>
                                                <td className="p-3 flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-blue-600 hover:bg-blue-50" onClick={() => handleEdit(log.student, log.covenant)}>
                                                        <Search className="h-3 w-3" /> {/* Using Search icon as Edit standard not imported, or just standard edit icon if available */}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:bg-red-50" onClick={() => handleDelete(log.student, log.covenant.id)}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
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

            </div>


            {/* Hidden Report Component - Visible on Print */}
            <div className="hidden print:block penalties-report-print">
                <PenaltiesReport
                    logs={filteredLogs}
                    groupName={selectedGroup}
                    date={new Date()}
                />
            </div>
        </div>
    );
}
