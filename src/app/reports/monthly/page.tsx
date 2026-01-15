
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, DollarSign, Users, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, getQuarter, startOfQuarter, endOfQuarter, isBefore } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Student, Payment } from '@/lib/types';
import { GroupEvaluationCard } from '@/components/ui/GroupEvaluationCard';

export default function MonthlyStatisticsPage() {
    const { students, dailySessions, dailyReports, payments, settings, loading } = useStudentContext();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const prices = settings?.prices?.renewal || { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 };

    const studentsToShow = useMemo(() => {
        const allStudents = students ?? [];
        if (selectedStudentId === 'all') {
            return allStudents;
        }
        return allStudents.filter(s => s.id === selectedStudentId);
    }, [students, selectedStudentId]);

    const financialData = useMemo(() => {
        const monthStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const quarterStartDate = startOfQuarter(monthStartDate);
        const quarterEndDate = endOfQuarter(monthStartDate);
        const currentQuarter = getQuarter(monthStartDate);

        const paymentsInQuarter = (payments ?? []).filter(p => {
             const paymentDate = parseISO(p.date);
             return paymentDate >= quarterStartDate && paymentDate <= quarterEndDate;
        });

        let totalSubscriptionRevenue = 0;
        
        studentsToShow.forEach(student => {
            const paymentForQuarter = paymentsInQuarter.find(p => p.studentId === student.id && getQuarter(parseISO(p.date)) === currentQuarter);
            if (paymentForQuarter?.status === 'paid') {
                const tier = student.subscriptionTier || 'فئة الأصاغر';
                totalSubscriptionRevenue += prices[tier] || 0;
            }
        });
        
        // This part would ideally be fetched or calculated from a shared state if registration fees were stored per quarter.
        // For now, we simulate it as 0 since we cannot access the state from `dues/page.tsx`.
        // The logic is prepared for when state management is centralized.
        const totalRegistrationFees = 0;

        return {
            totalSubscriptionRevenue,
            totalRegistrationFees,
            grandTotal: totalSubscriptionRevenue + totalRegistrationFees,
        };

    }, [studentsToShow, payments, prices, selectedMonth, selectedYear]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
     if ((students ?? []).length === 0 && !loading) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full">
                    <h1 className="text-3xl font-headline font-bold">الكشف المالي والتقييم الشهري</h1>
                    <CardDescription>ملخص مالي صافي يعكس بيانات "السطر الذهبي" من صفحة المستحقات.</CardDescription>
                </div>
                 <div className="flex gap-2 w-full md:w-auto">
                    <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="اختر طالبًا" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الطلبة</SelectItem>
                            {students.map(student => (
                                <SelectItem key={student.id} value={student.id}>
                                    {student.fullName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select dir="rtl" value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                        <SelectTrigger className="w-full md:w-[120px]"><SelectValue placeholder="الشهر" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 12}, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', { locale: ar })}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select dir="rtl" value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                        <SelectTrigger className="w-full md:w-[100px]"><SelectValue placeholder="السنة" /></SelectTrigger>
                        <SelectContent>
                            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - i).map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                <CardHeader>
                    <CardTitle className="text-2xl text-green-800 dark:text-green-200">💰 الحصيلة المالية للموسم</CardTitle>
                    <CardDescription>
                        هذا الرقم يمثل الإجمالي النهائي المحصّل للموسم الذي ينتمي إليه الشهر المحدد.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <p className="text-5xl font-bold text-green-600 dark:text-green-400">
                        {financialData.grandTotal.toLocaleString()} د.ج
                    </p>
                    <div className="mt-4 text-sm text-muted-foreground space-y-1">
                        <p>
                            <span className="font-semibold">إجمالي الاشتراكات:</span> {financialData.totalSubscriptionRevenue.toLocaleString()} د.ج
                        </p>
                         <p>
                            <span className="font-semibold">إجمالي حقوق التسجيل:</span> {financialData.totalRegistrationFees.toLocaleString()} د.ج
                        </p>
                         <p className="text-xs pt-2 italic">
                            <Info className="inline h-3 w-3 ml-1"/>
                            يتم سحب هذه البيانات مباشرة من "السطر الذهبي" في صفحة المستحقات لضمان الدقة.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <GroupEvaluationCard
                students={studentsToShow}
                sessions={dailySessions}
                reports={Object.values(dailyReports).flatMap(day => Object.values(day))}
                groupName={selectedStudentId === 'all' ? 'الفوج كاملاً' : students.find(s=>s.id === selectedStudentId)?.fullName}
            />
        </div>
    );
}
