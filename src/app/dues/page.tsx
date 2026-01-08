
"use client";

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertTriangle, DollarSign, CheckCircle, XCircle, Undo2, Download, Search } from 'lucide-react';
import { format, parseISO, getYear, getQuarter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const TIER_PRICES = {
    firstPayment: { 'فئة الأكابر': 2500, 'فئة الأصاغر': 2000 },
    renewal: { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 },
};

const getQuarterFromDate = (date: Date) => {
    return getQuarter(date);
};

type PaymentStatusFilter = 'all' | 'paid' | 'partially-paid' | 'not-paid';
type QuarterStatusFilter = 'all' | 'paid' | 'unpaid';

export default function DuesPage() {
    const { students, payments, addPayment, deletePayment, loading, settings } = useStudentContext();
    const { isSuperAdmin } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [currentYear, setCurrentYear] = useState(getYear(new Date()));
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>('all');
    const [quarterFilter, setQuarterFilter] = useState('all');
    const [quarterStatusFilter, setQuarterStatusFilter] = useState<QuarterStatusFilter>('all');

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

                const paidQuartersInfo: { quarter: number, paymentId: string }[] = studentPayments.map(p => ({ quarter: p.quarter, paymentId: p.id }));
                const paidQuarters = paidQuartersInfo.map(p => p.quarter);

                const tier = student.subscriptionTier || 'فئة الأصاغر';
                let totalPaid = 0;
                let totalDue = 0;
                let nextPayment = { quarter: 0, amount: 0, isFirstPayment: false };

                const paymentStatus: Record<number, {status: 'paid' | 'due' | 'not-applicable', paymentId?: string}> = { 
                    1: {status: 'not-applicable'}, 
                    2: {status: 'not-applicable'}, 
                    3: {status: 'not-applicable'}, 
                    4: {status: 'not-applicable'} 
                };

                for (let q = 1; q <= 4; q++) {
                    if (registrationYear > currentYear || (registrationYear === currentYear && q < registrationQuarter)) {
                        continue; // Skip quarters before registration
                    }

                    const isFirstEverPayment = registrationYear === currentYear && q === registrationQuarter && (payments ?? []).filter(p => p.studentId === student.id).length === 0;
                    const amountForQuarter = isFirstEverPayment ? prices.firstPayment[tier] : prices.renewal[tier];
                    totalDue += amountForQuarter;
                    
                    const paidInfo = paidQuartersInfo.find(p => p.quarter === q);
                    if(paidInfo) {
                        paymentStatus[q] = {status: 'paid', paymentId: paidInfo.paymentId};
                        const paymentForQuarter = studentPayments.find(p => p.quarter === q);
                        totalPaid += paymentForQuarter?.amount || 0;
                    } else {
                        paymentStatus[q] = {status: 'due'};
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
    
     const filteredStudents = useMemo(() => {
        return studentsWithDues.filter(student => {
            const nameMatch = student.fullName.toLowerCase().includes(searchTerm.toLowerCase());

            let statusMatch = true;
            if (statusFilter !== 'all') {
                if (statusFilter === 'paid') statusMatch = student.totalPaid >= student.totalDue && student.totalDue > 0;
                else if (statusFilter === 'partially-paid') statusMatch = student.totalPaid > 0 && student.totalPaid < student.totalDue;
                else if (statusFilter === 'not-paid') statusMatch = student.totalPaid === 0 && student.totalDue > 0;
            }

            let quarterMatch = true;
            if (quarterFilter !== 'all' && quarterStatusFilter !== 'all') {
                const q = parseInt(quarterFilter);
                if (quarterStatusFilter === 'paid') quarterMatch = student.paymentStatus[q].status === 'paid';
                if (quarterStatusFilter === 'unpaid') quarterMatch = student.paymentStatus[q].status === 'due';
            }
            
            return nameMatch && statusMatch && quarterMatch;
        });
    }, [studentsWithDues, searchTerm, statusFilter, quarterFilter, quarterStatusFilter]);


    const handleRecordPayment = async (studentId: string, amount: number, quarter: number) => {
        setIsProcessing(studentId);
        try {
            const monthOfQuarter = (quarter - 1) * 3;
            const paymentDate = new Date(currentYear, monthOfQuarter, 1);

            await addPayment({
                studentId,
                amount,
                date: paymentDate.toISOString(),
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
    
    const handleUndoPayment = async (paymentId: string | undefined) => {
        if (!paymentId) return;
        try {
            await deletePayment(paymentId);
            toast({
                title: "✅ تم التراجع عن الدفعة",
                description: "تم حذف سجل الدفعة بنجاح."
            });
        } catch (error) {
             toast({
                title: "❌ خطأ",
                description: "فشل التراجع عن الدفعة.",
                variant: 'destructive'
            });
        }
    };
    
    const handleExport = () => {
        const dataToExport = filteredStudents.map(s => {
            const statusSummary = `مدفوع: ${s.totalPaid} / مستحق: ${s.totalDue}`;
            return {
                "اسم الطالب": s.fullName,
                "الفئة": s.subscriptionTier,
                "الفوج": (s as any).groupName || 'غير محدد',
                "تاريخ التسجيل": format(s.registrationDate, 'yyyy-MM-dd'),
                "فصل 1": s.paymentStatus[1].status,
                "فصل 2": s.paymentStatus[2].status,
                "فصل 3": s.paymentStatus[3].status,
                "فصل 4": s.paymentStatus[4].status,
                "الملخص المالي": statusSummary,
            }
        });

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
                    <Select dir="rtl" value={statusFilter} onValueChange={(v) => setStatusFilter(v as PaymentStatusFilter)}>
                        <SelectTrigger><SelectValue placeholder="فلترة حسب حالة الدفع" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">الكل</SelectItem>
                            <SelectItem value="paid">مدفوع بالكامل</SelectItem>
                            <SelectItem value="partially-paid">مدفوع جزئيًا</SelectItem>
                            <SelectItem value="not-paid">لم يدفع</SelectItem>
                        </SelectContent>
                    </Select>
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
                                {isSuperAdmin && <TableHead>الفوج</TableHead>}
                                <TableHead>الفئة</TableHead>
                                <TableHead className="text-center">فصل 1</TableHead>
                                <TableHead className="text-center">فصل 2</TableHead>
                                <TableHead className="text-center">فصل 3</TableHead>
                                <TableHead className="text-center">فصل 4</TableHead>
                                <TableHead>الإجمالي</TableHead>
                                {!isSuperAdmin && <TableHead>إجراء</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredStudents.length > 0 ? filteredStudents.map(student => (
                                <TableRow key={student.id} className={(student.totalPaid < student.totalDue && student.totalDue > 0) ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                    <TableCell className="font-medium">{student.fullName}</TableCell>
                                    {isSuperAdmin && <TableCell><Badge variant="outline">{(student as any).groupName || 'غير محدد'}</Badge></TableCell>}
                                    <TableCell>
                                        <Badge variant="secondary">{student.subscriptionTier || 'فئة الأصاغر'}</Badge>
                                    </TableCell>
                                    {[1, 2, 3, 4].map(q => (
                                        <TableCell key={q} className="text-center">
                                            {student.paymentStatus[q].status === 'paid' && (
                                                <div className="flex items-center justify-center gap-2">
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                    {!isSuperAdmin && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                    <Undo2 className="h-4 w-4 text-muted-foreground" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>تراجع عن الدفعة؟</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        هل أنت متأكد من رغبتك في التراجع عن هذه الدفعة المسجلة؟ سيتم حذفها نهائيا.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleUndoPayment(student.paymentStatus[q].paymentId)}>نعم، قم بالتراجع</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            )}
                                            {student.paymentStatus[q].status === 'due' && <XCircle className="mx-auto h-5 w-5 text-red-500" />}
                                            {student.paymentStatus[q].status === 'not-applicable' && <span className="text-muted-foreground">-</span>}
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <div className="flex flex-col">
                                           <span>مدفوع: {student.totalPaid} د.ج</span>
                                           <span className="text-muted-foreground">مستحق: {student.totalDue} د.ج</span>
                                        </div>
                                    </TableCell>
                                    {!isSuperAdmin && (
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
                                    )}
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={isSuperAdmin ? 9 : 8} className="h-24 text-center">
                                        لا يوجد طلبة مطابقون لخيارات البحث الحالية.
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
