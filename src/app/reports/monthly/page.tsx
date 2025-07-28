
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, Users, CalendarDays, BarChart, AlertTriangle } from 'lucide-react';
import { format, parseISO, getMonth, getYear, getDaysInMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Bar, XAxis, YAxis, CartesianGrid, Legend, BarChart as RechartsBarChart } from 'recharts';
import type { Student } from '@/lib/types';


const ATTENDANCE_COLORS: { [key: string]: string } = { 'حاضر': '#10B981', 'غائب': '#EF4444', 'متأخر': '#F59E0B', 'تعويض': '#3B82F6' };
const BEHAVIOR_COLORS: { [key: string]: string } = { 'هادئ': '#3B82F6', 'متوسط': '#F59E0B', 'غير منضبط': '#EF4444' };
const EVALUATION_COLORS: { [key: string]: string } = { 'ممتاز': '#10B981', 'جيد': '#34D399', 'متوسط': '#F59E0B', 'ضعيف': '#EF4444', 'لا يوجد': '#9CA3AF' };

interface ChartData {
  name: string;
  value: number;
}

export default function MonthlyStatisticsPage() {
    const { students, dailySessions, loading } = useStudentContext();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    
    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const monthlyData = useMemo(() => {
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(selectedYear, selectedMonth, getDaysInMonth(startDate));
        
        const filteredSessions = Object.values(dailySessions).filter(session => {
            const sessionDate = parseISO(session.date);
            return sessionDate >= startDate && sessionDate <= endDate;
        });

        let records = filteredSessions.flatMap(s => s.records);

        if (selectedStudentId !== 'all') {
            records = records.filter(r => r.studentId === selectedStudentId);
        }

        const stats = {
            totalRecords: records.length,
            attendance: { 'حاضر': 0, 'غائب': 0, 'متأخر': 0, 'تعويض': 0 },
            behavior: { 'هادئ': 0, 'متوسط': 0, 'غير منضبط': 0 },
            evaluation: { 'ممتاز': 0, 'جيد': 0, 'متوسط': 0, 'ضعيف': 0, 'لا يوجد': 0 },
            sessions: filteredSessions.length,
            holidays: filteredSessions.filter(s => s.sessionType === 'يوم عطلة').length,
            sessionTypes: { 'حصة أساسية': 0, 'حصة أنشطة': 0, 'حصة تعويضية': 0 }
        };

        records.forEach(record => {
            if (record.attendance) stats.attendance[record.attendance]++;
            if (record.behavior) stats.behavior[record.behavior]++;
            if (record.memorization) stats.evaluation[record.memorization]++;
        });

        filteredSessions.forEach(session => {
           if(session.sessionType !== 'يوم عطلة') {
               stats.sessionTypes[session.sessionType]++;
           }
        });

        return stats;

    }, [dailySessions, selectedMonth, selectedYear, selectedStudentId]);

    const attendanceData: ChartData[] = Object.entries(monthlyData.attendance)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

    const behaviorData: ChartData[] = Object.entries(monthlyData.behavior)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));

    const evaluationData = Object.entries(monthlyData.evaluation)
        .map(([name, value]) => ({ name, value }));
        
    const sessionTypeData = Object.entries(monthlyData.sessionTypes)
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
                <h1 className="text-3xl font-headline font-bold">لوحة الإحصائيات الشهرية</h1>
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
                        <CardTitle className="text-sm font-medium">إجمالي الطلبة</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{selectedStudentId === 'all' ? activeStudents.length : 1}</div>
                        <p className="text-xs text-muted-foreground">طالب نشط</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">الأيام المسجلة</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.sessions}</div>
                        <p className="text-xs text-muted-foreground">من أصل {getDaysInMonth(new Date(selectedYear, selectedMonth))} يومًا في الشهر</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">إجمالي الحضور</CardTitle>
                        <BarChart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.attendance['حاضر']}</div>
                        <p className="text-xs text-muted-foreground">
                          من إجمالي {monthlyData.totalRecords} سجل
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">أيام العطل</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{monthlyData.holidays}</div>
                         <p className="text-xs text-muted-foreground">
                          أيام عطلة مسجلة هذا الشهر
                        </p>
                    </CardContent>
                </Card>
            </div>
            
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
                                : `تقييمات الطالب ${students.find(s=>s.id === selectedStudentId)?.fullName} خلال الشهر`}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <ResponsiveContainer width="100%" height={300}>
                                <RechartsBarChart data={evaluationData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
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

    
