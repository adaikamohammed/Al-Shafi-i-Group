import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Users, UserCheck, UserX, Clock, Star } from 'lucide-react';
import { AttendanceRecord } from './AttendanceList';
import { Student } from '@/lib/types';

interface SessionStatsWidgetProps {
    students: Student[];
    records: Record<string, AttendanceRecord>;
    className?: string;
}

export const SessionStatsWidget = ({ students, records, className }: SessionStatsWidgetProps) => {
    const stats = useMemo(() => {
        const total = students.length;
        if (total === 0) return { present: 0, absent: 0, late: 0, presentPct: 0, memorizedCount: 0 };

        let present = 0;
        let absent = 0;
        let late = 0;
        let memorizedCount = 0;

        Object.values(records).forEach(r => {
            if (r.attendance === 'حاضر') present++;
            if (r.attendance === 'غياب') absent++;
            if (r.attendance === 'متأخر') late++;
            if (r.memorization && r.memorization !== 'لم يحفظ' && r.memorization !== 'ضعيف') memorizedCount++;
        });

        // Calculate including late as present-ish or separate? 
        // Usually Late counts towards presence count but effectively 'not fully'.
        // Let's count present + late as 'Attendees'
        const attendees = present + late;

        return {
            present,
            absent,
            late,
            attendees,
            presentPct: Math.round((attendees / total) * 100),
            memorizedCount,
            memorizedPct: attendees > 0 ? Math.round((memorizedCount / attendees) * 100) : 0
        };
    }, [students, records]);

    return (
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 mb-4 animate-in fade-in slide-in-from-top-4 ${className}`}>

            {/* Attendance Rate */}
            <Card className="bg-white/50 border-none shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground font-bold">نسبة الحضور</span>
                        <span className="text-lg font-bold text-primary">{stats.presentPct}%</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Users className="h-4 w-4" />
                    </div>
                </CardContent>
                <div className="px-3 pb-2">
                    <Progress value={stats.presentPct} className="h-1.5" />
                </div>
            </Card>

            {/* Present Count */}
            <Card className="bg-emerald-50/50 border-emerald-100/50 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-emerald-600 font-bold">الحاضرون</span>
                        <span className="text-lg font-bold text-emerald-700">{stats.present}</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <UserCheck className="h-4 w-4" />
                    </div>
                </CardContent>
            </Card>

            {/* Late & Absent */}
            <Card className="bg-amber-50/50 border-amber-100/50 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-amber-600 font-bold">تأخر / غياب</span>
                        <span className="text-lg font-bold text-amber-700">{stats.late} / {stats.absent}</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <Clock className="h-4 w-4" />
                    </div>
                </CardContent>
            </Card>

            {/* Memorization Progress - Good indicator for 'League' feel */}
            <Card className="bg-purple-50/50 border-purple-100/50 shadow-sm">
                <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-xs text-purple-600 font-bold">أنجزوا الحفظ</span>
                        <span className="text-lg font-bold text-purple-700">{stats.memorizedCount}</span>
                    </div>
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                        <Star className="h-4 w-4" />
                    </div>
                </CardContent>
            </Card>

        </div>
    );
};
