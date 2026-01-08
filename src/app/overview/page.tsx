
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Users, DollarSign, UserPlus, FileText, CheckCircle, Bot, Lightbulb } from 'lucide-react';
import { format, getMonth, getYear, startOfQuarter, endOfQuarter, getQuarter, startOfWeek, endOfWeek, subDays, isSameDay, startOfMonth, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { Student, DailySession } from '@/lib/types';
import { GroupEvaluationCard } from '@/components/ui/GroupEvaluationCard';
import { DailyInspiration } from '@/components/ui/DailyInspiration';


const SmartAlerts = ({ students, sessions }: { students: Student[], sessions: Record<string, DailySession> }) => {
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 6 }); // Saturday
    const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 6 }); // Friday

    const weeklyAttendance = useMemo(() => {
        const attendanceMap: Record<string, number> = {};
        (students ?? []).forEach(s => attendanceMap[s.id] = 0);

        Object.values(sessions ?? {}).forEach(session => {
            const sessionDate = parseISO(session.date);
            if (sessionDate >= startOfCurrentWeek && sessionDate <= endOfCurrentWeek) {
                (session.records ?? []).forEach(record => {
                    if ((record.attendance === 'حاضر' || record.attendance === 'متأخر') && attendanceMap[record.studentId] !== undefined) {
                        attendanceMap[record.studentId]++;
                    }
                });
            }
        });
        
        return Object.entries(attendanceMap)
            .map(([studentId, count]) => ({ studentId, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(item => {
                const student = students.find(s => s.id === item.studentId);
                return { ...item, name: student?.fullName || 'طالب غير معروف' };
            });

    }, [students, sessions, startOfCurrentWeek, endOfCurrentWeek]);

    const consecutiveAbsences = useMemo(() => {
        const absenceMap: Record<string, number> = {};
        const lastSessionDates: Record<string, Date | null> = {};

        const sortedSessionDates = Object.keys(sessions).sort((a, b) => b.localeCompare(a));
        
        sortedSessionDates.slice(0, 5).forEach(dateStr => { // Check last 5 sessions
            const session = sessions[dateStr];
            (session.records ?? []).forEach(record => {
                 if (lastSessionDates[record.studentId] === undefined) lastSessionDates[record.studentId] = null;
                 
                 const currentDate = parseISO(dateStr);
                 const lastDate = lastSessionDates[record.studentId];

                 if(record.attendance === 'غائب') {
                    if (lastDate && subDays(lastDate, 1).getDate() === currentDate.getDate()) {
                       absenceMap[record.studentId] = (absenceMap[record.studentId] || 1) + 1;
                    } else {
                       absenceMap[record.studentId] = 1;
                    }
                 } else {
                    absenceMap[record.studentId] = 0;
                 }
                 lastSessionDates[record.studentId] = currentDate;
            });
        });
        
        return Object.entries(absenceMap)
            .filter(([, count]) => count >= 3)
            .map(([studentId]) => students.find(s => s.id === studentId)?.fullName)
            .filter(Boolean);
    }, [students, sessions]);

    const isEndOfMonth = today.getDate() > 20;

    return (
      <Card className="col-span-1 lg:col-span-4">
        <CardHeader>
           <div className="flex items-center gap-2">
                <Bot className="h-6 w-6 text-primary" />
                <CardTitle>التنبيهات والاقتراحات الذكية</CardTitle>
            </div>
        </CardHeader>
        <CardContent className="space-y-3">
             {weeklyAttendance.length > 0 && weeklyAttendance[0].count > 0 && (
                <div className="p-3 bg-blue-50 text-blue-800 rounded-lg">
                    <p className="font-bold">🌟 نجوم الأسبوع (الأكثر حضورًا):</p>
                    <p className="text-sm">{weeklyAttendance.map(s => s.name).join('، ')}</p>
                </div>
            )}
             {consecutiveAbsences.length > 0 && (
                 <div className="p-3 bg-red-50 text-red-800 rounded-lg">
                    <p className="font-bold">⚠️ غياب متكرر:</p>
                    <p className="text-sm">الطلاب: {consecutiveAbsences.join('، ')} قد تغيبوا 3 مرات متتالية أو أكثر.</p>
                </div>
            )}
            {isEndOfMonth && (
                 <div className="p-3 bg-yellow-50 text-yellow-800 rounded-lg">
                    <p className="font-bold">💰 تذكير مالي:</p>
                    <p className="text-sm">اقتربت نهاية الشهر، لا تنس مراجعة صفحة "المستحقات المالية".</p>
                </div>
            )}
            {weeklyAttendance.length === 0 && consecutiveAbsences.length === 0 && !isEndOfMonth && (
                <p className="text-muted-foreground text-center p-4">لا توجد تنبيهات هامة حاليًا. أداء الفوج مستقر.</p>
            )}
        </CardContent>
      </Card>
    );
};


const AttendanceChart = ({ sessions }: { sessions: Record<string, DailySession> }) => {
    const attendanceLast7Days = useMemo(() => {
        const data = Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const session = sessions[dateStr];
            let attendance = 0;
            if (session && session.records && session.records.length > 0) {
                const present = session.records.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
                attendance = (present / session.records.length) * 100;
            }
            return { date: format(date, 'd/M'), attendance: parseFloat(attendance.toFixed(1)) };
        }).reverse();
        return data;
    }, [sessions]);

    return (
        <Card className="col-span-1 lg:col-span-3">
            <CardHeader>
                <CardTitle>متابعة نسبة الحضور (آخر 7 أيام)</CardTitle>
            </CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={attendanceLast7Days} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis unit="%" domain={[0, 100]}/>
                        <Tooltip
                            contentStyle={{ borderRadius: '0.5rem', direction: 'rtl' }}
                            formatter={(value: number) => [`${value}%`, 'نسبة الحضور']}
                        />
                        <Area type="monotone" dataKey="attendance" stroke="#10B981" fillOpacity={1} fill="url(#colorAttendance)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};


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
                 const registrationQuarter = getQuarter(student.registrationDate);
                 const registrationYear = getYear(student.registrationDate);
                 const isFirstPaymentForThisStudent = registrationYear === currentYear && registrationQuarter === currentQuarter && isFirstEverPayment;
                 const tier = student.subscriptionTier || 'فئة الأصاغر';
                 expectedRevenue += isFirstPaymentForThisStudent ? TIER_PRICES.firstPayment[tier] : TIER_PRICES.renewal[tier];
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

    }, [activeStudents, dailySessions, payments, settings, TIER_PRICES]);
    
    const attendanceChartData = [
        { name: 'حضور', value: overviewData.attendanceToday },
        { name: 'غياب', value: 100 - overviewData.attendanceToday }
    ];

    const financialProgress = overviewData.totalPossibleRevenue > 0 
        ? (overviewData.financialCollection / overviewData.totalPossibleRevenue) * 100 
        : 0;

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
                <Tabs defaultValue="today" className="w-full md:w-auto">
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="today">اليوم</TabsTrigger>
                        <TabsTrigger value="week">الأسبوع</TabsTrigger>
                        <TabsTrigger value="month">الشهر</TabsTrigger>
                        <TabsTrigger value="season">الموسم</TabsTrigger>
                    </TabsList>
                </Tabs>
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
                                    <Cell fill="#3b82f6" />
                                    <Cell fill="rgba(59, 130, 246, 0.2)" />
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

    