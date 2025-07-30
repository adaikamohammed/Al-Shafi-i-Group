

"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Users, CalendarDays, BarChart, AlertTriangle, CheckCircle, XCircle, Clock, Replace, Plane } from 'lucide-react';
import { format, parseISO, getMonth, getYear, getDaysInMonth, startOfMonth, endOfMonth, getDate, getDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Legend, BarChart as RechartsBarChart } from 'recharts';
import type { Student, DailySession, SessionRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip as ShadTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const ATTENDANCE_COLORS: { [key: string]: string } = { 'حاضر': '#10B981', 'غائب': '#EF4444', 'متأخر': '#F59E0B', 'تعويض': '#3B82F6' };
const BEHAVIOR_COLORS: { [key: string]: string } = { 'هادئ': '#3B82F6', 'متوسط': '#F59E0B', 'غير منضبط': '#EF4444' };
const EVALUATION_COLORS: { [key: string]: string } = { 'ممتاز': '#10B981', 'جيد': '#34D399', 'متوسط': '#F59E0B', 'ضعيف': '#EF4444', 'لا يوجد': '#9CA3AF' };

interface ChartData {
  name: string;
  value: number;
}

export default function MonthlyStatisticsPage() {
    const { students, dailySessions, loading } = useStudentContext();
    const { user } = useAuth();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);

    const monthlyData = useMemo(() => {
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(selectedYear, selectedMonth, getDaysInMonth(startDate));
        
        const filteredSessions = Object.values(dailySessions ?? {}).filter(session => {
            const sessionDate = parseISO(session.date);
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        let recordsSource = selectedStudentId === 'all' 
            ? filteredSessions.flatMap(s => s.records ?? [])
            : filteredSessions.flatMap(s => (s.records ?? []).filter(r => r.studentId === selectedStudentId));

        const stats = {
            totalRecords: recordsSource.length,
            attendance: { 'حاضر': 0, 'غائب': 0, 'متأخر': 0, 'تعويض': 0 },
            behavior: { 'هادئ': 0, 'متوسط': 0, 'غير منضبط': 0 },
            evaluation: { 'ممتاز': 0, 'جيد': 0, 'متوسط': 0, 'ضعيف': 0, 'لا يوجد': 0 },
            sessions: filteredSessions.length,
            holidays: filteredSessions.filter(s => s.sessionType === 'يوم عطلة').length,
            sessionTypes: { 'حصة أساسية': 0, 'حصة أنشطة': 0, 'حصة تعويضية': 0 }
        };

        recordsSource.forEach(record => {
            if (record.attendance) stats.attendance[record.attendance]++;
            if (record.behavior) stats.behavior[record.behavior]++;
            if (record.memorization) stats.evaluation[record.memorization]++;
        });

        if (selectedStudentId === 'all') {
            filteredSessions.forEach(session => {
               if(session.sessionType !== 'يوم عطلة') {
                   stats.sessionTypes[session.sessionType]++;
               }
            });
        }
        
        const studentSpecificRecords: { [key: string]: SessionRecord & {sessionType: string} } = {};
        if (selectedStudentId !== 'all') {
            filteredSessions.forEach(session => {
                 const record = (session.records ?? []).find(r => r.studentId === selectedStudentId);
                 if (record) {
                     studentSpecificRecords[session.date] = {...record, sessionType: session.sessionType};
                 } else if (session.sessionType === 'يوم عطلة') {
                     studentSpecificRecords[session.date] = { studentId: selectedStudentId, attendance: 'يوم عطلة', behavior: null, memorization: null, review: null, notes: 'يوم عطلة', sessionType: 'يوم عطلة' };
                 }
            });
        }


        return { ...stats, studentSpecificRecords };

    }, [dailySessions, selectedMonth, selectedYear, selectedStudentId]);
    
    
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
            const record = monthlyData.studentSpecificRecords[dateStr];
            
            let cellClass = 'bg-gray-200 text-gray-700';
            let tooltipText = 'لا يوجد تسجيل لهذا اليوم';

            if (record) {
                switch(record.attendance) {
                    case 'حاضر': 
                        cellClass = 'bg-green-500 text-white'; 
                        tooltipText = 'حاضر';
                        break;
                    case 'غائب': 
                        cellClass = 'bg-red-500 text-white';
                        tooltipText = record.notes ? `غائب: ${record.notes}` : 'غائب (بدون سبب)';
                        break;
                    case 'متأخر': 
                        cellClass = 'bg-yellow-400 text-black';
                        tooltipText = 'متأخر';
                        break;
                    case 'تعويض': 
                        cellClass = 'bg-blue-400 text-white';
                        tooltipText = 'حصة تعويضية';
                        break;
                    case 'يوم عطلة':
                        cellClass = 'bg-gray-400 text-white';
                        tooltipText = 'يوم عطلة';
                        break;
                    default: 
                        break;
                }
            }
            
            dayCells.push(
                <TooltipProvider key={day}>
                    <ShadTooltip>
                        <TooltipTrigger asChild>
                            <div className={cn("h-14 rounded-md font-bold flex items-center justify-center", cellClass)}>
                                {day}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                           <p>{tooltipText}</p>
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
        
    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
     if (activeStudents.length === 0 && !loading) {
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
                    <h1 className="text-3xl font-headline font-bold">لوحة الإحصائيات الشهرية</h1>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">حاضر</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.attendance['حاضر']}</div>
                        <p className="text-xs text-muted-foreground">يوم حضور</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">غائب</CardTitle>
                        <XCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.attendance['غائب']}</div>
                        <p className="text-xs text-muted-foreground">يوم غياب</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">متأخر</CardTitle>
                        <Clock className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.attendance['متأخر']}</div>
                        <p className="text-xs text-muted-foreground">يوم تأخر</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">تعويض</CardTitle>
                        <Replace className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.attendance['تعويض']}</div>
                        <p className="text-xs text-muted-foreground">حصة تعويضية</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">عطلة</CardTitle>
                        <Plane className="h-4 w-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.holidays}</div>
                         <p className="text-xs text-muted-foreground">أيام عطلة مسجلة</p>
                    </CardContent>
                </Card>
            </div>
            
             {selectedStudentId !== 'all' && (
                <Card>
                    <CardHeader>
                        <CardTitle>تقويم الطالب: {(activeStudents ?? []).find(s => s.id === selectedStudentId)?.fullName}</CardTitle>
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

            {monthlyData.totalRecords > 0 ? (
                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>📊 توزيع الحضور</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie data={attendanceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                        {attendanceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={ATTENDANCE_COLORS[entry.name]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [`${value} يوم`, name]} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>😊 توزيع السلوك</CardTitle>
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
                            <CardTitle>📚 توزيع التقييم</CardTitle>
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
