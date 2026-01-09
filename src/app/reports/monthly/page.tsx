

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Users, CalendarDays, BarChart, AlertTriangle, CheckCircle, XCircle, Clock, Replace, Plane, DollarSign, UserX, UserCheck } from 'lucide-react';
import { format, parseISO, getMonth, getYear, getDaysInMonth, startOfMonth, endOfMonth, getDate, getDay, getQuarter, startOfQuarter, endOfQuarter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Legend, BarChart as RechartsBarChart } from 'recharts';
import type { Student, DailySession, SessionRecord, DailyReport, Payment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip as ShadTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { GroupEvaluationCard } from '@/components/ui/GroupEvaluationCard';


const ATTENDANCE_COLORS: { [key: string]: string } = { 'حاضر': '#10B981', 'غائب': '#EF4444', 'متأخر': '#F59E0B', 'تعويض': '#3B82F6' };
const BEHAVIOR_COLORS: { [key: string]: string } = { 'هادئ': '#3B82F6', 'متوسط': '#F59E0B', 'غير منضبط': '#EF4444' };
const EVALUATION_COLORS: { [key: string]: string } = { 'ممتاز': '#10B981', 'جيد': '#34D399', 'متوسط': '#F59E0B', 'ضعيف': '#EF4444', 'لا يوجد': '#9CA3AF' };
const REVENUE_COLORS = { 'الإيرادات الفعلية': '#10B981', 'الإيرادات المتوقعة': '#F59E0B' };

interface ChartData {
  name: string;
  value: number;
}
interface RevenueChartData {
    name: string;
    'الإيرادات الفعلية': number;
    'الإيرادات المتوقعة': number;
}

const TIER_PRICES = {
    firstPayment: { 'فئة الأكابر': 2500, 'فئة الأصاغر': 2000 },
    renewal: { 'فئة الأكابر': 2000, 'فئة الأصاغر': 1500 },
};

export default function MonthlyStatisticsPage() {
    const { students, dailySessions, dailyReports, payments, settings, loading } = useStudentContext();
    const { user } = useAuth();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);
    const prices = settings?.prices || TIER_PRICES;

    const monthlyData = useMemo(() => {
        const monthStartDate = startOfMonth(new Date(selectedYear, selectedMonth));
        const monthEndDate = endOfMonth(new Date(selectedYear, selectedMonth));
        
        const quarterStartDate = startOfQuarter(monthStartDate);
        const quarterEndDate = endOfQuarter(monthStartDate);
        const currentQuarter = getQuarter(monthStartDate);
        
        const sessionsInMonth = Object.values(dailySessions ?? {}).flatMap(sessionsOnDate => 
            Object.values(sessionsOnDate).filter(session => {
                const sessionDate = parseISO(session.date);
                return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
            })
        );
        
        const filteredReports = Object.values(dailyReports ?? {})
            .flatMap(dayReports => Object.values(dayReports))
            .filter(report => {
                 if(!report?.date) return false;
                 const reportDate = parseISO(report.date);
                 return reportDate >= monthStartDate && reportDate <= monthEndDate;
            });
            
        const paymentsInQuarter = (payments ?? []).filter(p => {
             const paymentDate = parseISO(p.date);
             return paymentDate >= quarterStartDate && paymentDate <= quarterEndDate;
        });
        
        let recordsSource = selectedStudentId === 'all' 
            ? sessionsInMonth.flatMap(s => s.records ?? [])
            : sessionsInMonth.flatMap(s => (s.records ?? []).filter(r => r.studentId === selectedStudentId));

        const stats = {
            totalRecords: recordsSource.length,
            attendance: { 'حاضر': 0, 'غائب': 0, 'متأخر': 0, 'تعويض': 0 },
            behavior: { 'هادئ': 0, 'متوسط': 0, 'غير منضبط': 0 },
            evaluation: { 'ممتاز': 0, 'جيد': 0, 'متوسط': 0, 'ضعيف': 0, 'لا يوجد': 0 },
            sessions: sessionsInMonth,
            reports: filteredReports,
            holidays: sessionsInMonth.filter(s => s.sessionType === 'يوم عطلة').length,
            sessionTypes: { 'حصة أساسية': 0, 'حصة أنشطة': 0, 'حصة تعويضية': 0 }
        };

        (recordsSource ?? []).forEach(record => {
            if (record.attendance) stats.attendance[record.attendance]++;
            if (record.behavior) stats.behavior[record.behavior]++;
            if (record.memorization) stats.evaluation[record.memorization]++;
        });

        if (selectedStudentId === 'all') {
            sessionsInMonth.forEach(session => {
               if(session.sessionType !== 'يوم عطلة') {
                   stats.sessionTypes[session.sessionType]++;
               }
            });
        }
        
        const studentSpecificRecords: { [key: string]: (SessionRecord & {sessionType: string})[] } = {};
        if (selectedStudentId !== 'all') {
            const studentSessions = Object.values(dailySessions ?? {}).flatMap(Object.values).filter(session => {
                const sessionDate = parseISO(session.date);
                return sessionDate >= monthStartDate && sessionDate <= monthEndDate;
            });
            studentSessions.forEach(session => {
                 if (!studentSpecificRecords[session.date]) {
                    studentSpecificRecords[session.date] = [];
                 }
                 const record = (session.records ?? []).find(r => r.studentId === selectedStudentId);
                 if (record) {
                     studentSpecificRecords[session.date].push({...record, sessionType: session.sessionType});
                 } else if (session.sessionType === 'يوم عطلة') {
                     studentSpecificRecords[session.date].push({ studentId: selectedStudentId, attendance: 'يوم عطلة', behavior: null, memorization: null, review: null, notes: 'يوم عطلة', sessionType: 'يوم عطلة' });
                 }
            });
        }
        
        const financialStats = {
            totalRevenue: paymentsInQuarter.reduce((sum, p) => sum + p.amount, 0),
            expectedRevenue: 0,
            paidStudentsCount: new Set(paymentsInQuarter.map(p => p.studentId)).size,
            unpaidStudentsCount: 0,
        };
        
        const studentsDueForQuarter = activeStudents.filter(s => {
            const registrationYear = getYear(s.registrationDate);
            const registrationQuarter = getQuarter(s.registrationDate);
            return registrationYear < selectedYear || (registrationYear === selectedYear && registrationQuarter <= currentQuarter);
        });
        
        const studentsWhoPaidInQuarter = new Set(paymentsInQuarter.map(p => p.studentId));

        financialStats.expectedRevenue = studentsDueForQuarter.reduce((total, student) => {
            if (studentsWhoPaidInQuarter.has(student.id)) {
                return total; // Already paid this quarter
            }
            
            const registrationYear = getYear(student.registrationDate);
            const registrationQuarter = getQuarter(student.registrationDate);
            const isFirstEverPayment = (payments ?? []).filter(p => p.studentId === student.id).length === 0;

            const isFirstPaymentForThisStudent = registrationYear === selectedYear && registrationQuarter === currentQuarter && isFirstEverPayment;
            
            const tier = student.subscriptionTier || 'فئة الأصاغر';
            const amountDue = isFirstPaymentForThisStudent ? prices.firstPayment[tier] : prices.renewal[tier];

            return total + amountDue;
        }, 0);
        
        const unpaidStudents = studentsDueForQuarter.filter(s => !studentsWhoPaidInQuarter.has(s.id));
        financialStats.unpaidStudentsCount = unpaidStudents.length;

        return { ...stats, studentSpecificRecords, financialStats };

    }, [dailySessions, dailyReports, payments, settings, selectedMonth, selectedYear, selectedStudentId, students]);
    
    
     const renderStudentCalendar = () => {
        const daysInMonth = getDaysInMonth(new Date(selectedYear, selectedMonth));
        const firstDayOfMonth = getDay(startOfMonth(new Date(selectedYear, selectedMonth)));
        const startDayIndex = (firstDayOfMonth + 1) % 7; 

        const dayCells = [];
        for (let i = 0; i < startDayIndex; i++) {
            dayCells.push(<div key={`empty-${i}`}></div>);
        }

        for(let day = 1; day <= daysInMonth; day++) {
            const dateStr = format(new Date(selectedYear, selectedMonth, day), 'yyyy-MM-dd');
            const records = monthlyData.studentSpecificRecords[dateStr];
            
            let cellClass = 'bg-gray-200 dark:bg-gray-700 text-gray-700';
            let tooltipText = 'لا يوجد تسجيل لهذا اليوم';
            let mainStatus = 'لم يسجل';

            if (records && records.length > 0) {
                const primaryRecord = records.find(r => r.sessionType === 'حصة أساسية') || records[0];
                mainStatus = primaryRecord.attendance || mainStatus;
                
                tooltipText = records.map(r => `الحصة: ${r.sessionType}, الحضور: ${r.attendance}`).join('\n');
                
                if (records.some(r => r.attendance === 'يوم عطلة')) {
                    cellClass = 'bg-gray-400 dark:bg-gray-600 text-white';
                    mainStatus = 'عطلة';
                } else if (records.every(r => r.attendance === 'غائب')) {
                    cellClass = 'bg-red-500 dark:bg-red-800 text-white';
                } else if (records.some(r => r.attendance === 'حاضر' || r.attendance === 'متأخر')) {
                    cellClass = 'bg-green-500 dark:bg-green-700 text-white';
                } else if (records.some(r => r.attendance === 'غائب')) {
                    cellClass = 'bg-yellow-400 dark:bg-yellow-600 text-black'; // Mix of presence and absence
                }
            }
            
            dayCells.push(
                <TooltipProvider key={day}>
                    <ShadTooltip>
                        <TooltipTrigger asChild>
                            <div className={cn("h-16 rounded-md font-bold flex flex-col items-center justify-center p-1", cellClass)}>
                                <span>{day}</span>
                                <span className="text-xs font-normal">{mainStatus}</span>
                                {records && records.length > 1 && <div className="absolute top-1 right-1 h-2 w-2 bg-white rounded-full"></div>}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                           <p className="whitespace-pre-wrap">{tooltipText}</p>
                        </TooltipContent>
                    </ShadTooltip>
                </TooltipProvider>
            );
        }
        return dayCells;
    }


    const attendanceData: ChartData[] = Object.entries(monthlyData.attendance)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

    const behaviorData: ChartData[] = Object.entries(monthlyData.behavior)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

    const evaluationData = Object.entries(monthlyData.evaluation)
        .map(([name, value]) => ({ name, value }));
        
    const revenueData: RevenueChartData[] = [{
        name: `موسم ${getQuarter(new Date(selectedYear, selectedMonth))}`,
        'الإيرادات الفعلية': monthlyData.financialStats.totalRevenue,
        'الإيرادات المتوقعة': monthlyData.financialStats.expectedRevenue
    }];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
     if ((students ?? []).filter(s => s.status === 'نشط').length === 0 && !loading) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="w-full">
                    <h1 className="text-3xl font-headline font-bold">لوحة الإحصائيات</h1>
                    <p className="text-muted-foreground">{user?.group ? `نظرة عامة على ${user.group}` : ''}</p>
                </div>
                 <div className="flex gap-2 w-full md:w-auto">
                    <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                        <SelectTrigger className="w-full md:w-[200px]">
                            <SelectValue placeholder="اختر طالبًا" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">كل الطلبة النشطين</SelectItem>
                            {activeStudents.map(student => (
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
                                <SelectItem key={i} value={i.toString()}>{format(new Date(2000, i), 'MMMM', {locale: ar})}</SelectItem>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">الإيرادات المحققة (الموسم)</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.financialStats.totalRevenue.toLocaleString()} د.ج</div>
                        <p className="text-xs text-muted-foreground">للموسم الحالي</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">مبالغ مستحقة (الموسم)</CardTitle>
                        <DollarSign className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.financialStats.expectedRevenue.toLocaleString()} د.ج</div>
                        <p className="text-xs text-muted-foreground">المتبقية لهذا الموسم</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">الطلاب الذين دفعوا (الموسم)</CardTitle>
                        <UserCheck className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.financialStats.paidStudentsCount}</div>
                        <p className="text-xs text-muted-foreground">طالب</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">الطلاب المتأخرون (الموسم)</CardTitle>
                        <UserX className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.financialStats.unpaidStudentsCount}</div>
                         <p className="text-xs text-muted-foreground">طالب</p>
                    </CardContent>
                </Card>
            </div>
            
             {selectedStudentId === 'all' && (
                <GroupEvaluationCard
                    students={students ?? []}
                    sessions={dailySessions}
                    reports={monthlyData.reports}
                    groupName={user?.group}
                />
            )}

             {selectedStudentId !== 'all' && (
                <Card>
                    <CardHeader>
                        <CardTitle>تقويم الطالب: {(students ?? []).find(s => s.id === selectedStudentId)?.fullName}</CardTitle>
                        <CardDescription>نظرة سريعة على حضور الطالب خلال الشهر المحدد.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="grid grid-cols-7 gap-2 text-center text-sm font-semibold mb-2">
                            {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                            {renderStudentCalendar()}
                        </div>
                    </CardContent>
                </Card>
            )}

            {monthlyData.totalRecords > 0 || monthlyData.financialStats.totalRevenue > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                     <Card className="md:col-span-2">
                         <CardHeader>
                            <CardTitle>📊 ملخص الإيرادات للموسم الحالي</CardTitle>
                             <CardDescription>
                                مقارنة بين الإيرادات الفعلية (المدفوعة) والمتوقعة (المستحقة) للموسم المحدد.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <ResponsiveContainer width="100%" height={300}>
                                <RechartsBarChart data={revenueData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} unit=" د.ج" />
                                    <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} formatter={(value, name) => [`${(value as number).toLocaleString()} د.ج`, name as string]} />
                                    <Legend />
                                    <Bar dataKey="الإيرادات الفعلية" fill={REVENUE_COLORS['الإيرادات الفعلية']} />
                                    <Bar dataKey="الإيرادات المتوقعة" fill={REVENUE_COLORS['الإيرادات المتوقعة']} />
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>📊 توزيع الحضور (شهري)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={attendanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                        {attendanceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={ATTENDANCE_COLORS[entry.name]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [`${value} حصة`, name]} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>😊 توزيع السلوك (شهري)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={behaviorData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label>
                                        {behaviorData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={BEHAVIOR_COLORS[entry.name]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [`${value} مرة`, name]} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card className="md:col-span-2">
                         <CardHeader>
                            <CardTitle>📚 توزيع التقييم (شهري)</CardTitle>
                             <CardDescription>
                                {selectedStudentId === 'all' 
                                ? 'متوسط تقييم جميع الطلاب خلال الشهر المحدد' 
                                : `تقييمات الطالب ${(students ?? []).find(s=>s.id === selectedStudentId)?.fullName} خلال الشهر`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <ResponsiveContainer width="100%" height={300}>
                                <RechartsBarChart data={evaluationData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis allowDecimals={false} />
                                    <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} formatter={(value) => [`${value} مرة`, 'العدد']} />
                                    <Bar dataKey="value">
                                        {evaluationData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={EVALUATION_COLORS[entry.name]} />
                                        ))}
                                    </Bar>
                                </RechartsBarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                 <div className="space-y-6 flex flex-col items-center justify-center h-60 border border-dashed rounded-lg">
                    <AlertTriangle className="h-16 w-16 text-muted-foreground" />
                    <h2 className="text-xl font-headline font-bold text-center">لا توجد بيانات مسجلة لهذا الشهر</h2>
                    <p className="text-muted-foreground text-center">
                        يرجى اختيار شهر آخر أو تسجيل بيانات في صفحة "الحصص اليومية".
                    </p>
                </div>
            )}
        </div>
    );
}

    
