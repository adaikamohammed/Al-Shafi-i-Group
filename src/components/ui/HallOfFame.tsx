

"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Shield, Activity, Sparkles, UserCheck, Users, TrendingUp, Loader2, BookOpenCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';

interface HallOfFameProps {}

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
                {loading ? <div className="flex justify-center pt-4"><Loader2 className="h-6 w-6 animate-spin"/></div> : 
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


export function HallOfFame({}: HallOfFameProps) {
    const { user } = useAuth();
    const { hallOfFame, loading } = useStudentContext();
    const teacherName = user?.displayName || 'الشيخ';

    if (loading || !hallOfFame) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Crown className="text-amber-500" />
                        الأرقام القياسية للفوج
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-24">
                     <Loader2 className="h-8 w-8 animate-spin" />
                </CardContent>
             </Card>
        )
    }

    const { commitmentKing, academicKing, behaviorKing, suraGuardian, persistentTeacher, givingRecord } = hallOfFame;

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
                    title="حارس السور"
                    studentName={suraGuardian.name}
                    studentPhoto={suraGuardian.photoURL}
                    value={suraGuardian.count}
                    unit="سورة في 30 يوم"
                    icon={<BookOpenCheck />}
                    color="border-sky-500"
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
