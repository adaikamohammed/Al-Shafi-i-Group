
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, DollarSign, CheckCircle, XCircle, Undo2, Download, Search, FileX, PlusCircle, MinusCircle } from 'lucide-react';
import { format, parseISO, getYear, getQuarter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import type { Payment, PaymentStatus } from '@/lib/types';


type QuarterStatusFilter = 'all' | 'paid' | 'unpaid' | 'exempted';

export default function DuesPage() {
    const { students, payments, addPayment, updatePaymentStatus, loading, settings } = useStudentContext();
    const { isSuperAdmin } = useAuth();
    const { toast } = useToast();
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [quarterFilter, setQuarterFilter] = useState('all');
    const [quarterStatusFilter, setQuarterStatusFilter] = useState<QuarterStatusFilter>('all');
    
    const [registrationFees, setRegistrationFees] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });

    const prices = settings?.prices?.renewal || { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 };

    const studentsWithDues = useMemo(() => {
        return (students ?? [])
            .filter(s => s.status === 'نشط' && getYear(s.registrationDate) <= currentYear)
            .map(student => {
                const studentPayments = (payments ?? [])
                    .filter(p => p.studentId === student.id && getYear(parseISO(p.date)) === currentYear);

                const paymentStatusByQuarter: Record<number, {status: PaymentStatus, paymentId?: string}> = {};

                for (let q = 1; q <= 4; q++) {
                    const paymentForQuarter = studentPayments.find(p => getQuarter(parseISO(p.date)) === q);
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

    }, [students, payments, settings, currentYear, prices]);
    
     const filteredStudents = useMemo(() => {
        return studentsWithDues.filter(student => {
            const nameMatch = student.fullName.toLowerCase().includes(searchTerm.toLowerCase());

            let quarterMatch = true;
            if (quarterFilter !== 'all' && quarterStatusFilter !== 'all') {
                const q = parseInt(quarterFilter);
                if (quarterStatusFilter === 'paid') quarterMatch = student.paymentStatus[q]?.status === 'paid';
                if (quarterStatusFilter === 'unpaid') quarterMatch = student.paymentStatus[q]?.status === 'unpaid';
                if (quarterStatusFilter === 'exempted') quarterMatch = student.paymentStatus[q]?.status === 'exempted';
            }
            
            return nameMatch && quarterMatch;
        });
    }, [studentsWithDues, searchTerm, quarterFilter, quarterStatusFilter]);
    
    const totalsByQuarter = useMemo(() => {
        const quarterTotals: Record<number, { revenue: number, paidCount: number, exemptedCount: number }> = { 1: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 2: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 3: { revenue: 0, paidCount: 0, exemptedCount: 0 }, 4: { revenue: 0, paidCount: 0, exemptedCount: 0 }};

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


    const handlePaymentAction = async (student: typeof studentsWithDues[0], quarter: number, status: PaymentStatus) => {
        if (isSuperAdmin) return;
        
        const tier = student.subscriptionTier || 'فئة الأصاغر';
        const amount = prices[tier] || 0;
        const monthOfQuarter = (quarter - 1) * 3;
        const paymentDate = new Date(currentYear, monthOfQuarter, 1);

        const existingPayment = (payments ?? []).find(p => p.studentId === student.id && getQuarter(parseISO(p.date)) === quarter && getYear(parseISO(p.date)) === currentYear);

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
    };
    
    const handleExport = () => {
        const dataToExport = filteredStudents.map(s => ({
                "اسم الطالب": s.fullName,
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
    
     if ((students ?? []).filter(s => s.status === 'نشط').length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لعرض مستحقاتهم</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }
    
    const yearOptions = Array.from({length: 5}, (_, i) => getYear(new Date()) - i);
    const quarterNames: Record<string, string> = { '1': 'فصل 1', '2': 'فصل 2', '3': 'فصل 3', '4': 'فصل 4'};

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <h1 className="text-3xl font-headline font-bold">المستحقات المالية الفصلية</h1>
                 <Select dir="rtl" value={currentYear.toString()} onValueChange={(value) => setCurrentYear(parseInt(value))}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="اختر السنة" />
                    </SelectTrigger>
                    <SelectContent>
                        {yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                    </SelectContent>
                </Select>
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
                    <Button onClick={handleExport}><Download className="ml-2 h-4 w-4"/> تصدير (Excel)</Button>
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
                                {isSuperAdmin && <TableHead>الفوج</TableHead>}
                                <TableHead>الفئة</TableHead>
                                {[1, 2, 3, 4].map(q => <TableHead key={q} className="text-center">{quarterNames[q.toString()]}</TableHead>)}
                                <TableHead>الإجمالي السنوي</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStudents.length > 0 ? filteredStudents.map(student => (
                                <TableRow key={student.id}>
                                    <TableCell className="font-medium">{student.fullName}</TableCell>
                                    {isSuperAdmin && <TableCell><Badge variant="outline">{(student as any).groupName || 'غير محدد'}</Badge></TableCell>}
                                    <TableCell>
                                        <Badge variant="secondary">{student.subscriptionTier || 'فئة الأصاغر'}</Badge>
                                    </TableCell>
                                    {[1, 2, 3, 4].map(q => {
                                        const payment = student.paymentStatus[q];
                                        return (
                                            <TableCell key={q} className="text-center">
                                                {payment?.status === 'paid' && (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                        {!isSuperAdmin && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePaymentAction(student, q, 'unpaid')}>
                                                                <Undo2 className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                 {payment?.status === 'exempted' && (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <FileX className="h-5 w-5 text-blue-500" />
                                                         {!isSuperAdmin && (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handlePaymentAction(student, q, 'unpaid')}>
                                                                <Undo2 className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                {payment?.status === 'unpaid' && (
                                                    !isSuperAdmin ? (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="outline" size="sm"><PlusCircle className="ml-1 h-4 w-4" /> إضافة</Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>تسجيل دفعة للفصل {q}</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        اختر الإجراء المناسب للطالب <span className="font-bold">{student.fullName}</span>.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handlePaymentAction(student, q, 'exempted')} className="bg-blue-600 hover:bg-blue-700">
                                                                        <FileX className="ml-2 h-4 w-4" /> إعفاء من الدفع
                                                                    </AlertDialogAction>
                                                                    <AlertDialogAction onClick={() => handlePaymentAction(student, q, 'paid')}>
                                                                        <CheckCircle className="ml-2 h-4 w-4"/> تأكيد الدفع ({prices[student.subscriptionTier || 'فئة الأصاغر']} د.ج)
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    ) : (
                                                        <XCircle className="mx-auto h-5 w-5 text-red-500" />
                                                    )
                                                )}
                                            </TableCell>
                                        )
                                    })}
                                    <TableCell>
                                        <span className="font-bold">{student.totalPaid.toLocaleString()} د.ج</span>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={isSuperAdmin ? 8 : 7} className="h-24 text-center">
                                        لا يوجد طلبة مطابقون لخيارات البحث الحالية.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <TableFooter>
                            <TableRow className="bg-muted/30">
                                <TableCell colSpan={isSuperAdmin ? 3 : 2} className="font-semibold">حقوق التسجيل الإجمالية للفصل</TableCell>
                                {[1, 2, 3, 4].map(q => (
                                    <TableCell key={`reg-fee-${q}`} className="text-center p-1">
                                        <Input 
                                            type="number" 
                                            className="w-24 mx-auto text-center h-8" 
                                            placeholder="أضف مبلغ"
                                            value={registrationFees[q] || ''}
                                            onChange={(e) => setRegistrationFees(prev => ({...prev, [q]: Number(e.target.value)}))}
                                        />
                                    </TableCell>
                                ))}
                                <TableCell></TableCell>
                            </TableRow>
                            <TableRow className="bg-amber-100 dark:bg-amber-800/20 font-bold text-base border-t-2 border-amber-300">
                                <TableCell colSpan={isSuperAdmin ? 3 : 2}>الإجمالي النهائي للفصل</TableCell>
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
