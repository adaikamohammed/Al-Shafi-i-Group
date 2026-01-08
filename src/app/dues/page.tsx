
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { format, parseISO, getYear, getQuarter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const TIER_PRICES = {
    firstPayment: { 'فئة الأكابر': 2500, 'فئة الأصاغر': 2000 },
    renewal: { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 },
};

const getQuarterFromDate = (date: Date) => {
    return getQuarter(date);
};

export default function DuesPage() {
    const { students, payments, addPayment, loading, settings } = useStudentContext();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));

    const prices = settings?.prices || TIER_PRICES;

    const studentsWithDues = useMemo(() => {
        return (students ?? [])
            .filter(s => s.status === 'نشط' && getYear(s.registrationDate) <= currentYear)
            .map(student => {
                const studentPayments = (payments ?? [])
                    .filter(p => p.studentId === student.id && getYear(parseISO(p.date)) === currentYear)
                    .map(p => ({ ...p, quarter: getQuarterFromDate(parseISO(p.date)) }))
                    .sort((a, b) => a.quarter - b.quarter);
                
                const registrationQuarter = getQuarterFromDate(student.registrationDate);
                const registrationYear = getYear(student.registrationDate);

                const paidQuarters = studentPayments.map(p => p.quarter);
                const tier = student.subscriptionTier || 'فئة الأصاغر';
                let totalPaid = 0;
                let totalDue = 0;
                let nextPayment = { quarter: 0, amount: 0, isFirstPayment: false };

                const paymentStatus: Record<number, 'paid' | 'due' | 'not-applicable'> = { 1: 'not-applicable', 2: 'not-applicable', 3: 'not-applicable', 4: 'not-applicable' };

                for (let q = 1; q <= 4; q++) {
                    if (registrationYear > currentYear || (registrationYear === currentYear && q < registrationQuarter)) {
                        continue; // Skip quarters before registration
                    }

                    const isFirstEverPayment = registrationYear === currentYear && q === registrationQuarter && (payments ?? []).filter(p => p.studentId === student.id).length === 0;
                    const amountForQuarter = isFirstEverPayment ? prices.firstPayment[tier] : prices.renewal[tier];
                    totalDue += amountForQuarter;
                    
                    if(paidQuarters.includes(q)) {
                        paymentStatus[q] = 'paid';
                        const paymentForQuarter = studentPayments.find(p => p.quarter === q);
                        totalPaid += paymentForQuarter?.amount || 0;
                    } else {
                        paymentStatus[q] = 'due';
                        if (nextPayment.quarter === 0) {
                            nextPayment = { quarter: q, amount: amountForQuarter, isFirstPayment: isFirstEverPayment };
                        }
                    }
                }
                
                return {
                    ...student,
                    paymentStatus,
                    totalPaid,
                    totalDue,
                    nextPayment
                };
            });

    }, [students, payments, settings, currentYear]);

    const handleRecordPayment = async (studentId: string, amount: number, quarter: number) => {
        setIsProcessing(studentId);
        try {
            // We record the payment at the start of the quarter for consistency.
            const monthOfQuarter = (quarter - 1) * 3;
            const paymentDate = new Date(currentYear, monthOfQuarter, 1);

            await addPayment({
                studentId,
                amount,
                date: paymentDate,
            });
            toast({
                title: "✅ تم تسجيل الدفعة",
                description: `تم تسجيل دفعة للفصل ${quarter} للطالب بنجاح.`,
            });
        } catch (error) {
            toast({
                title: "❌ خطأ",
                description: "فشل تسجيل الدفعة.",
                variant: 'destructive'
            });
        } finally {
            setIsProcessing(null);
        }
    };

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
                    <CardTitle>سجل الدفعات لسنة {currentYear}</CardTitle>
                    <CardDescription>
                       عرض حالة الدفع لكل فصل من فصول السنة.
                       الأسعار: دفعة أولى ({prices.firstPayment['فئة الأكابر']}/{prices.firstPayment['فئة الأصاغر']} د.ج),
                       تجديد ({prices.renewal['فئة الأكابر']}/{prices.renewal['فئة الأصاغر']} د.ج).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم الطالب</TableHead>
                                <TableHead>الفئة</TableHead>
                                <TableHead className="text-center">فصل 1</TableHead>
                                <TableHead className="text-center">فصل 2</TableHead>
                                <TableHead className="text-center">فصل 3</TableHead>
                                <TableHead className="text-center">فصل 4</TableHead>
                                <TableHead>الإجمالي</TableHead>
                                <TableHead>إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {studentsWithDues.length > 0 ? studentsWithDues.map(student => (
                                <TableRow key={student.id} className={student.totalPaid < student.totalDue ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                    <TableCell className="font-medium">{student.fullName}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{student.subscriptionTier || 'فئة الأصاغر'}</Badge>
                                    </TableCell>
                                    {[1, 2, 3, 4].map(q => (
                                        <TableCell key={q} className="text-center">
                                            {student.paymentStatus[q] === 'paid' && <CheckCircle className="mx-auto h-5 w-5 text-green-500" />}
                                            {student.paymentStatus[q] === 'due' && <XCircle className="mx-auto h-5 w-5 text-red-500" />}
                                            {student.paymentStatus[q] === 'not-applicable' && <span className="text-muted-foreground">-</span>}
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <div className="flex flex-col">
                                           <span>مدفوع: {student.totalPaid} د.ج</span>
                                           <span className="text-muted-foreground">مستحق: {student.totalDue} د.ج</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {student.nextPayment.quarter > 0 && (
                                            <Button
                                                size="sm"
                                                onClick={() => handleRecordPayment(student.id, student.nextPayment.amount, student.nextPayment.quarter)}
                                                disabled={isProcessing === student.id}
                                                variant={student.nextPayment.isFirstPayment ? 'default' : 'secondary'}
                                            >
                                                {isProcessing === student.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="ml-2 h-4 w-4" />}
                                                {`دفع فصل ${student.nextPayment.quarter} (${student.nextPayment.amount} د.ج)`}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        لا يوجد طلبة مسجلون في هذه السنة.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

    