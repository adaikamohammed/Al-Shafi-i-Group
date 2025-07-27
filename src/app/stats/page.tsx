"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, UserX, UserCheck, BarChart2, AlertTriangle } from 'lucide-react';
import { useStudentContext } from '@/context/StudentContext';
import { Progress } from '@/components/ui/progress';

const chartData = [
  // This data will be dynamic in the future.
];

export default function StatisticsPage() {
  const { students } = useStudentContext();

  const activeStudents = students.filter(s => s.status === 'نشط').length;
  const expelledStudents = students.filter(s => s.status === 'مطرود').length;

  const noData = students.length === 0;

  if (noData) {
    return (
        <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
            <AlertTriangle className="h-16 w-16 text-yellow-400" />
            <h1 className="text-3xl font-headline font-bold text-center">لا توجد بيانات لعرضها</h1>
            <p className="text-muted-foreground text-center">
                يرجى استيراد بيانات الطلبة من صفحة "البيانات" أولاً.
            </p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">إحصائيات الفوج</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="الطلبة النشطون" value={activeStudents.toString()} icon={<UserCheck className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="الطلبة المطرودون" value={expelledStudents.toString()} icon={<UserX className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="إجمالي الطلبة" value={students.length.toString()} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="متوسط الأداء" value="N/A" icon={<BarChart2 className="h-4 w-4 text-muted-foreground" />} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>معدل الحفظ والمراجعة الأسبوعي</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData} layout="horizontal" margin={{ right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                    }}
                 />
                <Legend />
                <Bar dataKey="حفظ" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="مراجعة" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>تقدم الحفظ الفردي</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {students.filter(s => s.status === 'نشط').map(student => {
                const progress = Math.round((student.memorizedSurahsCount / 114) * 100);
                return (
                  <div key={student.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{student.fullName}</span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
