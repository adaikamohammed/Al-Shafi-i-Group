
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { format, subDays, parseISO } from 'date-fns';
import type { DailySession } from '@/lib/types';

export const AttendanceChart = ({ sessions }: { sessions: Record<string, Record<string, DailySession>> }) => {
    const attendanceLast7Days = useMemo(() => {
        const data = Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), i);
            const dateStr = format(date, 'yyyy-MM-dd');
            const daySessions = sessions[dateStr] ? Object.values(sessions[dateStr]) : [];
            
            let attendance = 0;
            if (daySessions.length > 0) {
                const allRecords = daySessions.flatMap(s => s.records ?? []);
                 if (allRecords.length > 0) {
                    const present = allRecords.filter(r => r.attendance === 'حاضر' || r.attendance === 'متأخر').length;
                    attendance = (present / allRecords.length) * 100;
                }
            }
            return { date: format(date, 'd/M'), attendance: parseFloat(attendance.toFixed(1)) };
        }).reverse();
        return data;
    }, [sessions]);

    return (
        <Card className="col-span-1 lg:col-span-7">
            <CardHeader>
                <CardTitle>متابعة نسبة الحضور (آخر 7 أيام)</CardTitle>
            </CardHeader>
            <CardContent>
                 <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={attendanceLast7Days} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                        <defs>
                            <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis unit="%" domain={[0, 100]}/>
                        <Tooltip
                            contentStyle={{ borderRadius: '0.5rem', direction: 'rtl' }}
                            formatter={(value: number) => [`${value}%`, 'نسبة الحضور']}
                        />
                        <Area type="monotone" dataKey="attendance" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorAttendance)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
};

    
