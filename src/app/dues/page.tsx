
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, DollarSign, CheckCircle, XCircle, Undo2, Download, Search, FileX, PlusCircle, MinusCircle, MoreHorizontal, Save } from 'lucide-react';
import { format, parseISO, getYear, getQuarter, formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Payment, PaymentStatus, Student } from '@/lib/types';
import { cn } from '@/lib/utils';


type QuarterStatusFilter = 'all' | 'paid' | 'unpaid' | 'exempted';
type StatusFilter = 'all' | 'نشط' | 'مطرود';

const statusVariant: { [key in 'نشط' | 'مطرود']: "default" | "destructive" } = {
    "نشط": "default",
    "مطرود": "destructive",
};


export default function DuesPage() {
    const { students, payments, addPayment, updatePaymentStatus, loading, settings, saveSettings } = useStudentContext();
    const { isSuperAdmin, isManagement } = useAuth();
    const { toast } = useToast();
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [quarterFilter, setQuarterFilter] = useState('all');
    const [quarterStatusFilter, setQuarterStatusFilter] = useState<QuarterStatusFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('نشط');
    const [isSaving, setIsSaving] = useState(false);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    const [registrationFees, setRegistrationFees] = useState<Record<number, number>>({});
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (settings.registrationFees && settings.registrationFees[currentYear]) {
            setRegistrationFees(settings.registrationFees[currentYear]);
        } else {
            setRegistrationFees({});
        }
    }, [currentYear, settings.registrationFees]);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const handleFeeChange = (quarter: number, value: string) => {
        const newFees = { ...registrationFees, [quarter]: Number(value) || 0 };
        setRegistrationFees(newFees);

        if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

        debounceTimeout.current = setTimeout(() => {
            handleSaveFees(newFees, true); // Auto-save silently
        }, 1500); // 1.5 second delay
    };

    const handleSaveFees = async (feesToSave?: Record<number, number>, isSilent: boolean = false) => {
        setIsSaving(true);
        const fees = feesToSave || registrationFees;
        const newSettings = {
            ...settings,
            registrationFees: {
                ...settings.registrationFees,
                [currentYear]: fees,
            }
        };
        try {
            await saveSettings(newSettings);
            if (!isSilent) {
                toast({ title: "✅ تم الحفظ", description: "تم حفظ حقوق التسجيل بنجاح." });
            }
        } catch (e) {
            if (!isSilent) {
                toast({ title: "❌ خطأ", description: "فشل حفظ حقوق التسجيل.", variant: "destructive" });
            }
        } finally {
            setIsSaving(false);
        }
    };

    const prices = settings?.prices?.renewal || { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 };

    const studentsWithDues = useMemo(() => {
        if (!students) return [];

        // Index payments by studentId for O(1) lookup
        const paymentsByStudent = (payments ?? []).reduce((acc, p) => {
            if (p.date && getYear(parseISO(p.date)) === currentYear) {
                if (!acc[p.studentId]) acc[p.studentId] = [];
                acc[p.studentId].push(p);
            }
            return acc;
        }, {} as Record<string, Payment[]>);

        return students.map(student => {
            const studentPayments = paymentsByStudent[student.id] || [];

            const paymentStatusByQuarter: Record<number, { status: PaymentStatus, paymentId?: string }> = {};

            for (let q = 1; q <= 4; q++) {
                const paymentForQuarter = studentPayments.find(p => p.date && getQuarter(parseISO(p.date)) === q);
                if (paymentForQuarter) {
                    paymentStatusByQuarter[q] = { status: paymentForQuarter.status, paymentId: paymentForQuarter.id };
                } else {
                    paymentStatusByQuarter[q] = { status: 'unpaid' };
                }
            }

            const totalPaid = studentPayments
                .filter(p => p.status === 'paid')
                .reduce((sum, p) => sum + p.amount, 0);

            return {
                ...student,
                paymentStatus: paymentStatusByQuarter,
                totalPaid,
            };
        });

    }, [students, payments, currentYear]);

    const filteredStudents = useMemo(() => {
        return studentsWithDues.filter(student => {
            const nameMatch = student.fullName.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

            const statusMatch = statusFilter === 'all' || student.status === statusFilter;

            let quarterMatch = true;
            if (quarterFilter !== 'all' && quarterStatusFilter !== 'all') {
                const q = parseInt(quarterFilter);
                if (quarterStatusFilter === 'paid') quarterMatch = student.paymentStatus[q]?.status === 'paid';
                if (quarterStatusFilter === 'unpaid') quarterMatch = student.paymentStatus[q]?.status === 'unpaid';
                if (quarterStatusFilter === 'exempted') quarterMatch = student.paymentStatus[q]?.status === 'exempted';
            }

            return nameMatch && quarterMatch && statusMatch;
        });
    }, [studentsWithDues, searchTerm, quarterFilter, quarterStatusFilter, statusFilter]);

    const totalsByQuarter = useMemo(() => {
        const quarterTotals: Record<number, { revenue: number, paidCount: number, exemptedCount: number }> = { 1: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 2: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 3: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 4: { revenue: 0, paidCount: 0, exemptedCount: 0 } };

        filteredStudents.forEach(student => {
            for (let q = 1; q <= 4; q++) {
                const payment = student.paymentStatus[q];
                if (payment?.status === 'paid') {
                    const tier = student.subscriptionTier || 'فئة الأصاغر';
                    quarterTotals[q].revenue += prices[tier] || 0;
                    quarterTotals[q].paidCount++;
                }
                if (payment?.status === 'exempted') {
                    quarterTotals[q].exemptedCount++;
                }
            }
        });

        for (let q = 1; q <= 4; q++) {
            quarterTotals[q].revenue += registrationFees[q] || 0;
        }

        return quarterTotals;
    }, [filteredStudents, registrationFees, prices]);


    const totalRevenue = useMemo(() => {
        return Object.values(totalsByQuarter).reduce((sum, q) => sum + q.revenue, 0);
    }, [totalsByQuarter]);


    const handlePaymentAction = React.useCallback(async (student: Student, quarter: number, status: PaymentStatus) => {
        if (isSuperAdmin) return; // Only super_admin is read-only

        const tier = student.subscriptionTier || 'فئة الأصاغر';
        const amount = prices[tier] || 0;
        const monthOfQuarter = (quarter - 1) * 3;
        const paymentDate = new Date(currentYear, monthOfQuarter, 1);

        const existingPayment = (payments ?? []).find(p => p.date && p.studentId === student.id && getQuarter(parseISO(p.date)) === quarter && getYear(parseISO(p.date)) === currentYear);

        try {
            if (existingPayment) {
                await updatePaymentStatus(existingPayment.id, status, status === 'paid' ? amount : 0);
            } else {
                await addPayment({
                    studentId: student.id,
                    amount: status === 'paid' ? amount : 0,
                    date: paymentDate.toISOString(),
                    status: status,
                });
            }
            let toastMessage = '';
            if (status === 'paid') toastMessage = `تم تسجيل دفعة الفصل ${quarter} للطالب.`;
            if (status === 'exempted') toastMessage = `تم تسجيل إعفاء للفصل ${quarter} للطالب.`;
            if (status === 'unpaid') toastMessage = `تم إلغاء دفعة الفصل ${quarter}.`;

            toast({
                title: "✅ تم تحديث الحالة",
                description: toastMessage,
            });

        } catch (error) {
            toast({
                title: "❌ خطأ",
                description: "فشل تحديث حالة الدفعة.",
                variant: 'destructive'
            });
        }
    }, [isSuperAdmin, prices, currentYear, payments, updatePaymentStatus, addPayment, toast]);

    const handleExport = () => {
        const dataToExport = filteredStudents.map(s => ({
            "اسم الطالب": s.fullName,
            "الحالة": s.status,
            "الفئة": s.subscriptionTier,
            "فصل 1": s.paymentStatus[1]?.status || 'unpaid',
            "فصل 2": s.paymentStatus[2]?.status || 'unpaid',
            "فصل 3": s.paymentStatus[3]?.status || 'unpaid',
            "فصل 4": s.paymentStatus[4]?.status || 'unpaid',
            "الإجمالي المدفوع": s.totalPaid,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `مستحقات_${currentYear}`);
        XLSX.writeFile(wb, `تقرير_المستحقات_${currentYear}.xlsx`);
    }


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if ((students ?? []).length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض مستحقاتهم</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }

    const yearOptions = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
    const quarterNames: Record<string, string> = { '1': 'فصل 1', '2': 'فصل 2', '3': 'فصل 3', '4': 'فصل 4' };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-headline font-bold">المستحقات المالية الفصلية</h1>
                <div className="flex items-center gap-2">
                    <Button onClick={() => handleSaveFees()} disabled={isSaving}>
                        {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                        حفظ
                    </Button>
                    <Select dir="rtl" value={currentYear.toString()} onValueChange={(value) => setCurrentYear(parseInt(value))}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="اختر السنة" />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>أدوات الفلترة والبحث</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="بحث باسم الطالب..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Select dir="rtl" value={quarterFilter} onValueChange={setQuarterFilter}>
                            <SelectTrigger className="w-1/2"><SelectValue placeholder="اختر الفصل" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الفصول</SelectItem>
                                <SelectItem value="1">فصل 1</SelectItem>
                                <SelectItem value="2">فصل 2</SelectItem>
                                <SelectItem value="3">فصل 3</SelectItem>
                                <SelectItem value="4">فصل 4</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select dir="rtl" value={quarterStatusFilter} onValueChange={(v) => setQuarterStatusFilter(v as QuarterStatusFilter)} disabled={quarterFilter === 'all'}>
                            <SelectTrigger className="w-1/2"><SelectValue placeholder="حالة الفصل" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="paid">مدفوع</SelectItem>
                                <SelectItem value="unpaid">غير مدفوع</SelectItem>
                                <SelectItem value="exempted">معفى</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center space-x-1 rounded-lg bg-muted p-1">
                        <Button variant={statusFilter === 'all' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('all')} className="h-8 px-3">الكل</Button>
                        <Button variant={statusFilter === 'نشط' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('نشط')} className="h-8 px-3">النشطون فقط</Button>
                        <Button variant={statusFilter === 'مطرود' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('مطرود')} className="h-8 px-3">المطرودون</Button>
                    </div>
                    <Button onClick={handleExport}><Download className="ml-2 h-4 w-4" /> تصدير (Excel)</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>سجل الدفعات لسنة {currentYear}</CardTitle>
                    <CardDescription>
                        أسعار الاشتراكات الفصلية ثابتة: ({prices['فئة الأكابر']} د.ج للأكابر، {prices['فئة الأصاغر']} د.ج للأصاغر).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="w-full overflow-x-auto">
                        <Table className="min-w-full">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-1/4">اسم الطالب</TableHead>
                                    {(isSuperAdmin || isManagement) && <TableHead>الفوج</TableHead>}
                                    <TableHead>الحالة</TableHead>
                                    <TableHead>الفئة</TableHead>
                                    {[1, 2, 3, 4].map(q => <TableHead key={q} className="text-center">{quarterNames[q.toString()]}</TableHead>)}
                                    <TableHead>الإجمالي السنوي</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length > 0 ? filteredStudents.map(student => (
                                    <PaymentRow
                                        key={student.id}
                                        student={student}
                                        isSuperAdmin={isSuperAdmin}
                                        isManagement={isManagement}
                                        prices={prices}
                                        onPaymentAction={handlePaymentAction}
                                    />
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={(isSuperAdmin || isManagement) ? 8 : 7} className="h-24 text-center">
                                            لا يوجد طلبة مطابقون لخيارات البحث الحالية.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow className="bg-muted/30">
                                    <TableCell colSpan={(isSuperAdmin || isManagement) ? 4 : 3} className="font-semibold">حقوق التسجيل الإجمالية للفصل</TableCell>
                                    {[1, 2, 3, 4].map(q => (
                                        <TableCell key={`reg-fee-${q}`} className="text-center p-1">
                                            <Input
                                                type="number"
                                                className="w-24 mx-auto text-center h-8 bg-blue-50 dark:bg-blue-900/20"
                                                placeholder="أدخل مبلغًا"
                                                value={registrationFees[q] || ''}
                                                onChange={(e) => handleFeeChange(q, e.target.value)}
                                            />
                                        </TableCell>
                                    ))}
                                    <TableCell></TableCell>
                                </TableRow>
                                <TableRow className="bg-amber-100 dark:bg-amber-800/20 font-bold text-base border-t-2 border-amber-300">
                                    <TableCell colSpan={(isSuperAdmin || isManagement) ? 4 : 3}>الإجمالي النهائي للفصل</TableCell>
                                    {[1, 2, 3, 4].map(q => (
                                        <TableCell key={`total-footer-${q}`} className="text-center text-lg text-amber-800 dark:text-amber-200 transition-colors">
                                            {totalsByQuarter[q].revenue.toLocaleString()} د.ج
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-xl text-amber-900 dark:text-amber-100 transition-colors">{totalRevenue.toLocaleString()} د.ج</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Memoized Row Component
const PaymentRow = React.memo(({
    student,
    isSuperAdmin,
    prices,
    onPaymentAction
}: {
    student: any,
    isSuperAdmin: boolean,
    isManagement: boolean,
    prices: any,
    onPaymentAction: (s: any, q: number, st: PaymentStatus) => void
}) => {
    return (
        <TableRow className={cn(student.status === 'مطرود' && 'opacity-50 hover:opacity-70 transition-opacity')}>
            <TableCell className="font-bold text-slate-700 dark:text-slate-200 py-4">{student.fullName}</TableCell>
            {isSuperAdmin && <TableCell><Badge variant="outline" className="font-medium">{(student as any).groupName || 'غير محدد'}</Badge></TableCell>}
            <TableCell>
                <Badge variant={statusVariant[student.status as 'نشط' | 'مطرود'] || 'secondary'} className="font-bold">
                    {student.status}
                </Badge>
                {student.status === 'مطرود' && student.expulsionDate &&
                    <p className="text-[10px] text-muted-foreground mt-1">({formatDistanceToNowStrict(parseISO(student.expulsionDate), { locale: ar, addSuffix: true })})</p>
                }
            </TableCell>
            <TableCell>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-medium">
                    {student.subscriptionTier || 'فئة الأصاغر'}
                </Badge>
            </TableCell>
            {[1, 2, 3, 4].map(q => {
                const payment = student.paymentStatus[q];
                return (
                    <TableCell key={q} className="text-center">
                        {payment?.status === 'paid' && (
                            <div className="flex items-center justify-center gap-2">
                                <CheckCircle className="h-5 w-5 text-emerald-500" />
                                {!isSuperAdmin && student.status === 'نشط' && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onPaymentAction(student, q, 'unpaid')}>
                                        <Undo2 className="h-3.5 w-3.5 text-slate-400" />
                                    </Button>
                                )}
                            </div>
                        )}
                        {payment?.status === 'exempted' && (
                            <div className="flex items-center justify-center gap-2">
                                <FileX className="h-5 w-5 text-sky-500" />
                                {!isSuperAdmin && student.status === 'نشط' && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => onPaymentAction(student, q, 'unpaid')}>
                                        <Undo2 className="h-3.5 w-3.5 text-slate-400" />
                                    </Button>
                                )}
                            </div>
                        )}
                        {payment?.status === 'unpaid' && (
                            !isSuperAdmin && student.status === 'نشط' ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-8 px-2 border-dashed border-slate-300 hover:border-primary hover:text-primary transition-all">
                                            <PlusCircle className="ml-1.5 h-3.5 w-3.5" />
                                            إضافة
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="center" className="w-48">
                                        <DropdownMenuItem onSelect={() => onPaymentAction(student, q, 'paid')} className="cursor-pointer">
                                            <CheckCircle className="ml-2 h-4 w-4 text-emerald-500" />
                                            <span className="font-medium">تأكيد الدفع ({prices[student.subscriptionTier || 'فئة الأصاغر']} د.ج)</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onPaymentAction(student, q, 'exempted')} className="cursor-pointer">
                                            <FileX className="ml-2 h-4 w-4 text-sky-500" />
                                            <span className="font-medium">إعفاء من الدفع</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <XCircle className="mx-auto h-5 w-5 text-rose-300 dark:text-rose-900/50" />
                            )
                        )}
                    </TableCell>
                )
            })}
            <TableCell>
                <div className="flex flex-col items-center">
                    <span className="font-bold text-slate-900 dark:text-white">{student.totalPaid.toLocaleString()} د.ج</span>
                    <div className="h-1 w-full bg-slate-100 rounded-full mt-1 overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${Math.min((student.totalPaid / 8000) * 100, 100)}%` }}
                        />
                    </div>
                </div>
            </TableCell>
        </TableRow>
    );
});

PaymentRow.displayName = 'PaymentRow';




