
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Users, DollarSign, UserPlus, FileText, CheckCircle } from 'lucide-react';
import { format, getMonth, getYear, startOfQuarter, getQuarter, startOfWeek, endOfWeek, subDays, isSameDay, startOfMonth, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { Student, DailySession } from '@/lib/types';
import { GroupEvaluationCard } from '@/components/ui/GroupEvaluationCard';
import { DailyInspiration } from '@/components/ui/DailyInspiration';
import { SmartAlerts } from '@/components/ui/SmartAlerts';
import { AttendanceChart } from '@/components/ui/AttendanceChart';


export default function OverviewPage() {
    const { students, dailySessions, payments, loading, settings } = useStudentContext();
    const { user, isSuperAdmin } = useAuth();
    
    const TIER_PRICES = settings?.prices || {
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
        if (todaySession && todaySession.records && activeStudents.length > 0 && todaySession.sessionType !== 'يوم عطلة') {
            const presentCount = todaySession.records.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
            attendancePercentage = (presentCount / activeStudents.length) * 100;
        }

        // New Students
        const newStudentsThisMonth = activeStudents.filter(s => 
            s.registrationDate &&
            getMonth(s.registrationDate) === getMonth(currentMonthStart) &&
            getYear(s.registrationDate) === getYear(currentMonthStart)
        ).length;

        // Financials
        const quarterStartDate = startOfQuarter(new Date());
        
        const paymentsInQuarter = (payments ?? []).filter(p => {
             const paymentDate = parseISO(p.date);
             return paymentDate >= quarterStartDate;
        });

        const totalRevenue = paymentsInQuarter.reduce((sum, p) => sum + p.amount, 0);

        const studentsDueForQuarter = activeStudents.filter(s => {
            if (!s.registrationDate) return false;
            const registrationYear = getYear(s.registrationDate);
            const registrationQuarter = getQuarter(s.registrationDate);
            return registrationYear < currentYear || (registrationYear === currentYear && registrationQuarter <= currentQuarter);
        });
        
        const studentsWhoPaidInQuarter = new Set(paymentsInQuarter.map(p => p.studentId));
        let expectedRevenue = 0;
        
        studentsDueForQuarter.forEach(student => {
             const studentQuarterlyPayments = (payments ?? []).filter(p => p.studentId === student.id && getQuarter(parseISO(p.date)) === currentQuarter && getYear(parseISO(p.date)) === currentYear);
             if(studentQuarterlyPayments.length === 0) {
                 const isFirstEverPayment = (payments ?? []).filter(p => p.studentId === student.id).length === 0;
                 if (student.registrationDate) {
                    const registrationQuarter = getQuarter(student.registrationDate);
                    const registrationYear = getYear(student.registrationDate);
                    const isFirstPaymentForThisStudent = registrationYear === currentYear && registrationQuarter === currentQuarter && isFirstEverPayment;
                    const tier = student.subscriptionTier || 'فئة الأصاغر';
                    expectedRevenue += isFirstPaymentForThisStudent ? TIER_PRICES.firstPayment[tier] : TIER_PRICES.renewal[tier];
                 }
             }
        });
        
        const totalPossibleRevenue = totalRevenue + expectedRevenue;
        
        return {
            attendanceToday: attendancePercentage,
            newStudentsThisMonth: newStudentsThisMonth,
            financialCollection: totalRevenue,
            pendingDues: expectedRevenue,
            totalPossibleRevenue: totalPossibleRevenue
        };

    }, [activeStudents, dailySessions, payments, settings]);
    
    const attendanceChartData = [
        { name: 'حضور', value: overviewData.attendanceToday },
        { name: 'غياب', value: 100 - overviewData.attendanceToday }
    ];

    const financialProgress = overviewData.totalPossibleRevenue > 0 
        ? (overviewData.financialCollection / overviewData.totalPossibleRevenue) * 100 
        : 100;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
             <DailyInspiration />
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full">
                    <h1 className="text-3xl font-headline font-bold">نظرة عامة</h1>
                    <p className="text-muted-foreground">{isSuperAdmin ? 'عرض شامل لكل الأفواج' : (user?.group ? `مرحباً بك في ${user.group}` : 'لوحة التحكم')}</p>
                </div>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-lg rounded-2xl bg-gradient-to-tr from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-950/50">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">الحضور اليومي</CardTitle>
                        <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center">
                         <ResponsiveContainer width={100} height={100}>
                           <PieChart>
                                <Pie 
                                    data={attendanceChartData} 
                                    cx="50%" cy="50%" 
                                    innerRadius={30} 
                                    outerRadius={40} 
                                    startAngle={90}
                                    endAngle={450}
                                    paddingAngle={0}
                                    dataKey="value"
                                >
                                    <Cell fill="hsl(var(--primary))" />
                                    <Cell fill="hsl(var(--primary) / 0.2)" />
                                </Pie>
                                <Tooltip content={() => null} />
                           </PieChart>
                        </ResponsiveContainer>
                        <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 -mt-20 mb-12">{overviewData.attendanceToday.toFixed(0)}%</div>
                    </CardContent>
                </Card>
                <Card className="shadow-lg rounded-2xl bg-gradient-to-tr from-green-100 to-green-200 dark:from-green-900/50 dark:to-green-950/50">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-800 dark:text-green-200">الطلبة الجدد (هذا الشهر)</CardTitle>
                        <UserPlus className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-5xl font-bold text-green-900 dark:text-green-100 mt-4">+{overviewData.newStudentsThisMonth}</div>
                        <p className="text-xs text-muted-foreground text-green-700 dark:text-green-300">طالب جديد تم إضافته هذا الشهر</p>
                    </CardContent>
                </Card>
                <Card className="shadow-lg rounded-2xl bg-gradient-to-tr from-emerald-100 to-emerald-200 dark:from-emerald-900/50 dark:to-emerald-950/50">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-200">التحصيل المالي (الموسم)</CardTitle>
                        <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-emerald-900 dark:text-emerald-100 mt-4">{overviewData.financialCollection.toLocaleString()} د.ج</div>
                        <p className="text-xs text-muted-foreground text-emerald-700 dark:text-emerald-300">تم تحصيل {financialProgress.toFixed(0)}% من الهدف</p>
                    </CardContent>
                </Card>
                 <Card className="shadow-lg rounded-2xl bg-gradient-to-tr from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-950/50">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-200">المستحقات المعلقة (الموسم)</CardTitle>
                        <FileText className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </CardHeader>
                    <CardContent>
                        {overviewData.pendingDues > 0 ? (
                             <>
                                <div className="text-4xl font-bold text-amber-900 dark:text-amber-100 mt-4">{overviewData.pendingDues.toLocaleString()} د.ج</div>
                                <p className="text-xs text-muted-foreground text-amber-700 dark:text-amber-300">المبالغ المتبقية للموسم الحالي</p>
                             </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full pt-4">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                                <p className="font-semibold mt-2 text-green-800 dark:text-green-200">تم تسوية كل المستحقات</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            
             <GroupEvaluationCard students={students ?? []} sessions={Object.values(dailySessions)} groupName={isSuperAdmin ? "كل الأفواج" : user?.group} />
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <SmartAlerts students={activeStudents} sessions={dailySessions} />
                <AttendanceChart sessions={dailySessions} />
            </div>
        </div>
    );
}

    