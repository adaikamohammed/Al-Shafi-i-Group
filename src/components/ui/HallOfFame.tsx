
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Shield, Activity, Sparkles, UserCheck, Users, TrendingUp } from 'lucide-react';
import type { Student, DailySession } from '@/lib/types';
import { parseISO, isAfter } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';

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
    const { user } = useAuth();
    const { settings } = useStudentContext();
    const activeStudents = useMemo(() => students.filter(s => s.status === 'نشط'), [students]);

    const allSortedSessions = useMemo(() => {
        if (!sessions) return [];
        return Object.values(sessions)
            .flatMap(day => Object.values(day))
            .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
    }, [sessions]);


    const commitmentKing = useMemo(() => {
        if (allSortedSessions.length === 0 || activeStudents.length === 0) {
            return { name: undefined, streak: 0, photoURL: undefined };
        }
        
        const sortedBasicSessions = allSortedSessions.filter(s => s.sessionType === 'حصة أساسية');
        if(sortedBasicSessions.length === 0) return { name: undefined, streak: 0, photoURL: undefined };

        let maxStreak = 0;
        let king: Student | undefined = undefined;

        activeStudents.forEach(student => {
            let currentStreak = 0;
            let studentMaxStreak = 0;
            
            sortedBasicSessions.forEach(session => {
                if (parseISO(session.date) < student.registrationDate) {
                    return;
                }

                const record = (session.records || []).find(r => r.studentId === student.id);
                
                if (record) {
                    if (record.attendance === 'حاضر') {
                        currentStreak++;
                    } else {
                        studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
                        currentStreak = 0;
                    }
                } else {
                    studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
                    currentStreak = 0;
                }
            });
            
            studentMaxStreak = Math.max(studentMaxStreak, currentStreak);

            if (studentMaxStreak > maxStreak) {
                maxStreak = studentMaxStreak;
                king = student;
            }
        });
        
        return { name: king?.fullName, streak: maxStreak, photoURL: king?.photoURL };

    }, [activeStudents, allSortedSessions]);
    
    const academicKing = useMemo(() => {
        if (allSortedSessions.length === 0 || activeStudents.length === 0) {
            return { name: undefined, streak: 0, photoURL: undefined };
        }
        const sortedBasicSessions = allSortedSessions.filter(s => s.sessionType === 'حصة أساسية');

        let maxStreak = 0;
        let king: Student | undefined = undefined;

        activeStudents.forEach(student => {
            let currentStreak = 0;
            let studentMaxStreak = 0;

            sortedBasicSessions.forEach(session => {
                 if (parseISO(session.date) < student.registrationDate) {
                    return;
                }
                const record = (session.records || []).find(r => r.studentId === student.id);
                if (record && record.memorization === 'ممتاز') {
                    currentStreak++;
                } else {
                    studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
                    currentStreak = 0;
                }
            });
            
            studentMaxStreak = Math.max(studentMaxStreak, currentStreak);

            if (studentMaxStreak > maxStreak) {
                maxStreak = studentMaxStreak;
                king = student;
            }
        });
        
        return { name: king?.fullName, streak: maxStreak, photoURL: king?.photoURL };
    }, [activeStudents, allSortedSessions]);

    const behaviorKing = useMemo(() => {
        if (allSortedSessions.length === 0 || activeStudents.length === 0) {
            return { name: undefined, streak: 0, photoURL: undefined };
        }
        const sortedBasicSessions = allSortedSessions.filter(s => s.sessionType === 'حصة أساسية');

        let maxStreak = 0;
        let king: Student | undefined = undefined;

        activeStudents.forEach(student => {
            let currentStreak = 0;
            let studentMaxStreak = 0;

            sortedBasicSessions.forEach(session => {
                 if (parseISO(session.date) < student.registrationDate) {
                    return;
                }
                const record = (session.records || []).find(r => r.studentId === student.id);
                if (record && record.behavior === 'هادئ') {
                    currentStreak++;
                } else {
                    studentMaxStreak = Math.max(studentMaxStreak, currentStreak);
                    currentStreak = 0;
                }
            });
            
            studentMaxStreak = Math.max(studentMaxStreak, currentStreak);

            if (studentMaxStreak > maxStreak) {
                maxStreak = studentMaxStreak;
                king = student;
            }
        });
        
        return { name: king?.fullName, streak: maxStreak, photoURL: king?.photoURL };
    }, [activeStudents, allSortedSessions]);
    
    const helpfulColleague = useMemo(() => {
        if (allSortedSessions.length === 0 || activeStudents.length === 0) {
            return { name: undefined, count: 0, photoURL: undefined };
        }

        const helpCounts: { [id: string]: number } = {};
        const keywords = ['ساعد', 'يعين', 'يصحح'];

        activeStudents.forEach(student => {
            helpCounts[student.id] = 0;
        });

        allSortedSessions.forEach(session => {
            (session.records || []).forEach(record => {
                if (record.notes && helpCounts[record.studentId] !== undefined) {
                    if (keywords.some(kw => record.notes!.includes(kw))) {
                        helpCounts[record.studentId]++;
                    }
                }
            });
        });
        
        let maxCount = 0;
        let kingId: string | undefined = undefined;
        for (const studentId in helpCounts) {
            if (helpCounts[studentId] > maxCount) {
                maxCount = helpCounts[studentId];
                kingId = studentId;
            }
        }
        
        const king = kingId ? activeStudents.find(s => s.id === kingId) : undefined;
        
        return { name: king?.fullName, count: maxCount, photoURL: king?.photoURL };
    }, [activeStudents, allSortedSessions]);

    const persistentTeacher = useMemo(() => {
        if (allSortedSessions.length === 0) {
            return { streak: 0 };
        }
        let maxStreak = 0;
        let currentStreak = 0;
        
        const uniqueDates = [...new Set(allSortedSessions.map(s => s.date))].sort();

        uniqueDates.forEach(date => {
            const sessionsForDay = allSortedSessions.filter(s => s.date === date);
            const isTeacherAbsent = sessionsForDay.some(s => s.sessionType === 'غياب الشيخ' && !s.substituteTeacher);

            if (!isTeacherAbsent) {
                currentStreak++;
            } else {
                maxStreak = Math.max(maxStreak, currentStreak);
                currentStreak = 0;
            }
        });

        maxStreak = Math.max(maxStreak, currentStreak);
        return { streak: maxStreak };
    }, [allSortedSessions]);

    const givingRecord = useMemo(() => {
        if (allSortedSessions.length === 0 || !settings) {
            return { count: 0 };
        }
        const seasonStartDate = settings.seasonStartDate ? parseISO(settings.seasonStartDate) : null;

        const extraSessions = allSortedSessions.filter(s => {
            if (s.sessionType !== 'حصة تعويضية') return false;
            if (seasonStartDate) {
                const sessionDate = parseISO(s.date);
                return isAfter(sessionDate, seasonStartDate);
            }
            return true;
        });
        return { count: extraSessions.length };
    }, [allSortedSessions, settings]);

    const teacherName = user?.displayName || 'الشيخ';


    return (
        <Card className="bg-white/30 backdrop-blur-sm border-gray-200/50 shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Crown className="text-amber-500" />
                    الأرقام القياسية للفوج
                </CardTitle>
                <CardDescription>قائمة الشرف لأصحاب الإنجازات الاستثنائية في الفوج.</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <RecordCard 
                    title="ملك الالتزام"
                    studentName={commitmentKing.name}
                    studentPhoto={commitmentKing.photoURL}
                    value={commitmentKing.streak}
                    unit="يوم متتالي"
                    icon={<UserCheck />}
                    color="border-blue-500"
                />
                 <RecordCard 
                    title="الخمسة المتتالية"
                    studentName={academicKing.name}
                    studentPhoto={academicKing.photoURL}
                    value={academicKing.streak}
                    unit="تقييم ممتاز"
                    icon={<Sparkles />}
                    color="border-green-500"
                />
                 <RecordCard 
                    title="سفير الأدب"
                    studentName={behaviorKing.name}
                    studentPhoto={behaviorKing.photoURL}
                    value={behaviorKing.streak}
                    unit="يوم هدوء متتالي"
                    icon={<Shield />}
                    color="border-purple-500"
                />
                 <RecordCard 
                    title="الزميل المعين"
                    studentName={helpfulColleague.name}
                    studentPhoto={helpfulColleague.photoURL}
                    value={helpfulColleague.count}
                    unit="مساعدة مسجلة"
                    icon={<Users />}
                    color="border-orange-500"
                />
                <RecordCard 
                    title="المعلم المثابر"
                    studentName={teacherName}
                    studentPhoto={user?.photoURL || undefined}
                    value={persistentTeacher.streak}
                    unit="يوم عمل متتالي"
                    icon={<Activity />}
                    color="border-teal-500"
                />
                <RecordCard 
                    title="حصص العطاء"
                    studentName={teacherName}
                    studentPhoto={user?.photoURL || undefined}
                    value={givingRecord.count}
                    unit="حصة إضافية"
                    icon={<TrendingUp />}
                    color="border-cyan-500"
                />
            </CardContent>
        </Card>
    );
}
