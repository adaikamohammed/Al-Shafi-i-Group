
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Users, CalendarDays, BarChart, AlertTriangle, CheckCircle, XCircle, Clock, Replace, Plane, DollarSign, UserX, UserCheck, TrendingUp, UserPlus, FileText } from 'lucide-react';
import { format, parseISO, getMonth, getYear, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isToday, startOfQuarter, endOfQuarter, getQuarter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function OverviewPage() {
    const { students, dailySessions, payments, loading } = useStudentContext();
    const { user, isSuperAdmin } = useAuth();
    const [timeFilter, setTimeFilter] = useState('today');

    const TIER_PRICES = {
        firstPayment: { 'فئة الأكابر': 2500, 'فئة الأصاغر': 2000 },
        renewal: { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 },
    };
    
    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);

    const overviewData = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const currentMonthStart = startOfMonth(new Date());
        const currentQuarter = getQuarter(new Date());
        const currentYear = getYear(new Date());

        // Attendance
        const todaySession = dailySessions?.[todayStr];
        let attendancePercentage = 0;
        if (todaySession && todaySession.records && todaySession.records.length > 0) {
            const presentCount = todaySession.records.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
            attendancePercentage = (presentCount / todaySession.records.length) * 100;
        }

        // New Students
        const newStudentsThisMonth = activeStudents.filter(s => 
            getMonth(s.registrationDate) === getMonth(currentMonthStart) &&
            getYear(s.registrationDate) === getYear(currentMonthStart)
        ).length;

        // Financials
        const quarterStartDate = startOfQuarter(new Date());
        const quarterEndDate = endOfQuarter(new Date());

        const paymentsInQuarter = (payments ?? []).filter(p => {
             const paymentDate = parseISO(p.date);
             return paymentDate >= quarterStartDate && paymentDate <= quarterEndDate;
        });

        const totalRevenue = paymentsInQuarter.reduce((sum, p) => sum + p.amount, 0);

        const studentsDueForQuarter = activeStudents.filter(s => {
            const registrationYear = getYear(s.registrationDate);
            const registrationQuarter = getQuarter(s.registrationDate);
            return registrationYear < currentYear || (registrationYear === currentYear && registrationQuarter <= currentQuarter);
        });
        
        const studentsWhoPaidInQuarter = new Set(paymentsInQuarter.map(p => p.studentId));

        const pendingDues = studentsDueForQuarter.reduce((total, student) => {
            if (studentsWhoPaidInQuarter.has(student.id)) {
                return total;
            }
            const registrationYear = getYear(student.registrationDate);
            const registrationQuarter = getQuarter(student.registrationDate);
            const isFirstEverPayment = (payments ?? []).filter(p => p.studentId === student.id).length === 0;

            const isFirstPaymentForThisStudent = registrationYear === currentYear && registrationQuarter === currentQuarter && isFirstEverPayment;
            
            const tier = student.subscriptionTier || 'فئة الأصاغر';
            const amountDue = isFirstPaymentForThisStudent ? TIER_PRICES.firstPayment[tier] : TIER_PRICES.renewal[tier];

            return total + amountDue;
        }, 0);


        return {
            attendanceToday: attendancePercentage,
            newStudentsThisMonth: newStudentsThisMonth,
            financialCollection: totalRevenue,
            pendingDues: pendingDues,
        };

    }, [students, dailySessions, payments]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full">
                    <h1 className="text-3xl font-headline font-bold">نظرة عامة</h1>
                    <p className="text-muted-foreground">{isSuperAdmin ? 'عرض شامل لكل الأفواج' : (user?.group ? `مرحباً بك في ${user.group}` : 'لوحة التحكم')}</p>
                </div>
                <Tabs defaultValue="today" className="w-full md:w-auto">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="today">اليوم</TabsTrigger>
                        <TabsTrigger value="week">الأسبوع</TabsTrigger>
                        <TabsTrigger value="month">الشهر</TabsTrigger>
                        <TabsTrigger value="season">الموسم</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">الحضور اليومي</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overviewData.attendanceToday.toFixed(0)}%</div>
                        <p className="text-xs text-muted-foreground">نسبة حضور الطلبة لهذا اليوم</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">الطلبة الجدد (هذا الشهر)</CardTitle>
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{overviewData.newStudentsThisMonth}</div>
                        <p className="text-xs text-muted-foreground">طالب جديد تم إضافته هذا الشهر</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">التحصيل المالي (الموسم)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overviewData.financialCollection.toLocaleString()} د.ج</div>
                        <p className="text-xs text-muted-foreground">المبالغ المحصلة في الموسم الحالي</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">المستحقات المعلقة (الموسم)</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{overviewData.pendingDues.toLocaleString()} د.ج</div>
                        <p className="text-xs text-muted-foreground">المبالغ المتبقية للموسم الحالي</p>
                    </CardContent>
                </Card>
            </div>
            
            {/* Placeholder for future sections */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-4">
                     <CardHeader>
                        <CardTitle>التنبيهات الذكية</CardTitle>
                     </CardHeader>
                     <CardContent>
                        <p className="text-muted-foreground">قريباً...</p>
                     </CardContent>
                </Card>
                 <Card className="col-span-1 lg:col-span-3">
                     <CardHeader>
                        <CardTitle>الرسم البياني للمتابعة</CardTitle>
                     </CardHeader>
                     <CardContent>
                        <p className="text-muted-foreground">قريباً...</p>
                     </CardContent>
                </Card>
            </div>
        </div>
    );
}
