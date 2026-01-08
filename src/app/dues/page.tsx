
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, DollarSign } from 'lucide-react';
import { format, differenceInMonths, addMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const TIER_PRICES = {
    initial: { 'فئة أ': 2500, 'فئة ب': 2000 },
    subsequent: { 'فئة أ': 2000, 'فئة ب': 1500 },
};

export default function DuesPage() {
    const { students, payments, addPayment, loading, settings } = useStudentContext();
    const { toast } = useToast();
    const [filter, setFilter] = useState<'all' | 'paid' | 'overdue'>('all');
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    
    const prices = settings?.prices || TIER_PRICES;

    const studentsWithDues = useMemo(() => {
        return (students ?? [])
            .filter(s => s.status === 'نشط')
            .map(student => {
                const studentPayments = (payments ?? []).filter(p => p.studentId === student.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const lastPayment = studentPayments[0];
                
                const monthsSinceRegistration = differenceInMonths(new Date(), student.registrationDate);
                const isInitialPeriod = !lastPayment && monthsSinceRegistration < 3;

                const tier = student.subscriptionTier || 'فئة ب';
                const dueAmount = isInitialPeriod ? prices.initial[tier] : prices.subsequent[tier];
                
                let status: 'paid' | 'overdue' = 'overdue';
                let nextDueDate: Date | null = null;
                
                if (lastPayment) {
                    const lastPaymentDate = new Date(lastPayment.date);
                    nextDueDate = addMonths(lastPaymentDate, 3);
                    if (new Date() < nextDueDate) {
                        status = 'paid';
                    }
                } else {
                     nextDueDate = addMonths(student.registrationDate, 3);
                     if (new Date() < nextDueDate) {
                        status = 'paid';
                     }
                }

                return {
                    ...student,
                    lastPaymentDate: lastPayment ? new Date(lastPayment.date) : null,
                    dueAmount,
                    status,
                    nextDueDate
                };
            })
            .filter(s => {
                if (filter === 'all') return true;
                return s.status === filter;
            })
            .sort((a, b) => {
                 if (a.status === 'overdue' && b.status !== 'overdue') return -1;
                 if (b.status === 'overdue' && a.status !== 'overdue') return 1;
                 return a.fullName.localeCompare(b.fullName);
            });

    }, [students, payments, filter, prices]);

    const handleRecordPayment = async (studentId: string, amount: number) => {
        setIsProcessing(studentId);
        try {
            await addPayment({
                studentId,
                amount,
                date: new Date(),
            });
            toast({
                title: "✅ تم تسجيل الدفعة",
                description: `تم تسجيل دفعة للطالب بنجاح.`,
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                 <h1 className="text-3xl font-headline font-bold">المستحقات المالية</h1>
                  <Select dir="rtl" value={filter} onValueChange={(value: 'all' | 'paid' | 'overdue') => setFilter(value)}>
                    <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="عرض حسب الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">عرض الكل</SelectItem>
                        <SelectItem value="paid">المدفوع فقط</SelectItem>
                        <SelectItem value="overdue">المتأخر فقط</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>قائمة مستحقات الطلبة</CardTitle>
                    <CardDescription>
                        عرض حالة الدفع للطلبة النشطين وتسجيل الدفعات الجديدة.
                        الأسعار: الفترة الأولى ({prices.initial['فئة أ']} د.ج / {prices.initial['فئة ب']} د.ج),
                        الفترات اللاحقة ({prices.subsequent['فئة أ']} د.ج / {prices.subsequent['فئة ب']} د.ج).
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم الطالب</TableHead>
                                <TableHead>الفئة</TableHead>
                                <TableHead>تاريخ آخر دفعة</TableHead>
                                <TableHead>المبلغ المطلوب</TableHead>
                                <TableHead>تاريخ الاستحقاق القادم</TableHead>
                                <TableHead>الحالة</TableHead>
                                <TableHead>إجراء</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {studentsWithDues.length > 0 ? studentsWithDues.map(student => (
                                <TableRow key={student.id} className={student.status === 'overdue' ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                    <TableCell className="font-medium">{student.fullName}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{student.subscriptionTier || 'فئة ب'}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        {student.lastPaymentDate ? format(student.lastPaymentDate, 'd MMMM yyyy', { locale: ar }) : 'لا يوجد'}
                                    </TableCell>
                                    <TableCell className="font-bold">{student.dueAmount} د.ج</TableCell>
                                     <TableCell>
                                        {student.nextDueDate ? format(student.nextDueDate, 'd MMMM yyyy', { locale: ar }) : 'N/A'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={student.status === 'paid' ? 'default' : 'destructive'}>
                                            {student.status === 'paid' ? 'مدفوع' : 'متأخر'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            size="sm"
                                            onClick={() => handleRecordPayment(student.id, student.dueAmount)}
                                            disabled={isProcessing === student.id}
                                        >
                                            {isProcessing === student.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="ml-2 h-4 w-4" />}
                                            تسجيل دفعة
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        {filter === 'all' ? 'لا يوجد طلبة نشطين.' : `لا يوجد طلبة بحالة '${filter === 'paid' ? 'مدفوع' : 'متأخر'}'`}
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
