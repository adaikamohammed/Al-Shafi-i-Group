"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Shield, Activity, Sparkles, UserCheck } from 'lucide-react';
import type { Student, DailySession } from '@/lib/types';
import { parseISO } from 'date-fns';

interface HallOfFameProps {
    students: Student[];
    sessions: Record<string, Record<string, DailySession>>;
}

const RecordCard = ({ title, studentName, studentPhoto, value, unit, icon, color, loading }: { title: string, studentName?: string, studentPhoto?: string, value: number, unit: string, icon: React.ReactNode, color: string, loading?: boolean }) => {
    return (
        <Card className={`border-l-4 ${color}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-full">
                        {icon}
                    </div>
                    <CardTitle className="text-base">{title}</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <p className="text-sm text-muted-foreground">جارِ الحساب...</p> : 
                 studentName && value > 0 ? (
                     <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={studentPhoto} />
                            <AvatarFallback>{studentName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-bold">{studentName}</p>
                            <p className="text-xl font-headline font-bold text-primary">{value} <span className="text-sm font-normal text-muted-foreground">{unit}</span></p>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground text-sm pt-4">لا يوجد صاحب رقم قياسي حالي</p>
                )}
            </CardContent>
        </Card>
    );
};


export function HallOfFame({ students, sessions }: HallOfFameProps) {
    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const commitmentKing = useMemo(() => {
        if (!sessions || activeStudents.length === 0) {
            return { name: undefined, streak: 0, photoURL: undefined };
        }
        
        const allWorkSessions = Object.values(sessions)
            .flatMap(day => Object.values(day))
            .filter(session => session.sessionType === 'حصة أساسية')

        const workSessionsByDate = allWorkSessions.reduce((acc, session) => {
            if (!acc[session.date]) {
                acc[session.date] = [];
            }
            acc[session.date].push(session);
            return acc;
        }, {} as Record<string, DailySession[]>);

        const uniqueWorkDays = Object.keys(workSessionsByDate).sort();
        
        let maxStreak = 0;
        let king: Student | undefined = undefined;

        activeStudents.forEach(student => {
            let currentStreak = 0;
            let studentMaxStreak = 0;
            
            uniqueWorkDays.forEach(date => {
                const sessionsOnDay = workSessionsByDate[date];
                let present = false;
                let absentOrLate = false;
                
                // Student should not be checked for attendance before they were registered.
                if (parseISO(date) < student.registrationDate) {
                    return;
                }

                for (const session of sessionsOnDay) {
                    const record = (session.records || []).find(r => r.studentId === student.id);
                    if (record) {
                        if(record.attendance === 'حاضر') present = true;
                        if(record.attendance === 'غائب' || record.attendance === 'متأخر') {
                            absentOrLate = true;
                            break;
                        }
                    }
                }
                
                if (absentOrLate) {
                    currentStreak = 0;
                } else if (present) {
                    currentStreak++;
                } else {
                    currentStreak = 0;
                }
                
                studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
            });

            if (studentMaxStreak > maxStreak) {
                maxStreak = studentMaxStreak;
                king = student;
            }
        });
        
        return { name: king?.fullName, streak: maxStreak, photoURL: king?.photoURL };

    }, [activeStudents, sessions]);


    // Placeholder for other records
    const hifzKing = { name: "قيد التطوير", streak: 0, photoURL: undefined };
    const pointsKing = { name: "قيد التطوير", streak: 0, photoURL: undefined };
    const behaviorKing = { name: "قيد التطوير", streak: 0, photoURL: undefined };


    return (
        <Card className="bg-white/30 backdrop-blur-sm border-gray-200/50 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Crown className="text-amber-500" />
                    الأرقام القياسية للفوج
                </CardTitle>
                <CardDescription>قائمة الشرف لأصحاب الإنجازات الاستثنائية في الفوج.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecordCard 
                    title="ملك الالتزام"
                    studentName={commitmentKing.name}
                    studentPhoto={commitmentKing.photoURL}
                    value={commitmentKing.streak}
                    unit="يوم متتالي"
                    icon={<Shield />}
                    color="border-blue-500"
                />
                 <RecordCard 
                    title="ملك الحفظ"
                    studentName={hifzKing.name}
                    studentPhoto={hifzKing.photoURL}
                    value={hifzKing.streak}
                    unit="سورة متقنة"
                    icon={<Sparkles />}
                    color="border-green-500"
                    loading={true}
                />
                 <RecordCard 
                    title="ملك النقاط"
                    studentName={pointsKing.name}
                    studentPhoto={pointsKing.photoURL}
                    value={pointsKing.streak}
                    unit="نقطة"
                    icon={<Activity />}
                    color="border-purple-500"
                    loading={true}
                />
                 <RecordCard 
                    title="ملك السلوك"
                    studentName={behaviorKing.name}
                    studentPhoto={behaviorKing.photoURL}
                    value={behaviorKing.streak}
                    unit="يوم منضبط"
                    icon={<UserCheck />}
                    color="border-yellow-500"
                    loading={true}
                />
            </CardContent>
        </Card>
    );
}
