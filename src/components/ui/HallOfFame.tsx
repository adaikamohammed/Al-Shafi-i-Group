"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Crown, Shield, Activity, Sparkles, UserCheck, Users, TrendingUp, Loader2, BookOpenCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface HallOfFameProps { }

const RecordCard = ({ title, studentName, studentPhoto, value, unit, icon, color, loading, delay }: { title: string, studentName?: string, studentPhoto?: string, value: number, unit: string, icon: React.ReactNode, color: string, loading?: boolean, delay: number }) => {
    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay }}
        >
            <Card className={cn(
                "relative overflow-hidden group transition-all duration-300 border-none",
                "bg-white/5 backdrop-blur-md hover:bg-white/10"
            )}>
                {/* Accent Line */}
                <div className={cn("absolute bottom-0 right-0 left-0 h-1", color)} />

                <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform", color.replace('bg-', 'text-'))}>
                            {icon}
                        </div>
                        <CardTitle className="text-base font-headline font-bold text-white/90">{title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-2">
                    {loading ? (
                        <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>
                    ) : studentName && value > 0 ? (
                        <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 border-2 border-white/10 ring-2 ring-white/5">
                                <AvatarImage src={studentPhoto} className="object-cover" />
                                <AvatarFallback className="bg-slate-800 text-white font-bold">{studentName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <p className="font-bold text-white truncate text-sm">{studentName}</p>
                                <p className="text-2xl font-headline font-bold text-amber-400">
                                    {value} <span className="text-xs font-normal text-white/40 uppercase tracking-tighter">{unit}</span>
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="py-4 text-center">
                            <p className="text-white/20 text-xs font-medium">في انتظار البطل القادم...</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

export function HallOfFame({ }: HallOfFameProps) {
    const { user } = useAuth();
    const { hallOfFame, loading: contextLoading } = useStudentContext();
    const teacherName = user?.displayName || 'الشيخ';

    if (contextLoading || !hallOfFame) {
        return (
            <Card className="bg-white/5 backdrop-blur-md border-none border-white/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                        <Crown className="text-amber-500 animate-pulse" />
                        الأرقام القياسية للفوج
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center items-center h-32">
                    <Loader2 className="h-10 w-10 animate-spin text-amber-500/50" />
                </CardContent>
            </Card>
        )
    }

    const { commitmentKing, academicKing, behaviorKing, suraGuardian, persistentTeacher, givingRecord } = hallOfFame;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                <RecordCard
                    title="ملك الالتزام"
                    studentName={commitmentKing.name}
                    studentPhoto={commitmentKing.photoURL}
                    value={commitmentKing.streak}
                    unit="يوم متتالي"
                    icon={<UserCheck className="h-5 w-5" />}
                    color="bg-blue-500"
                    delay={0.1}
                />
                <RecordCard
                    title="الخمسة المتتالية"
                    studentName={academicKing.name}
                    studentPhoto={academicKing.photoURL}
                    value={academicKing.streak}
                    unit="تقييم ممتاز"
                    icon={<Sparkles className="h-5 w-5" />}
                    color="bg-emerald-500"
                    delay={0.2}
                />
                <RecordCard
                    title="سفير الأدب"
                    studentName={behaviorKing.name}
                    studentPhoto={behaviorKing.photoURL}
                    value={behaviorKing.streak}
                    unit="يوم هدوء متتالي"
                    icon={<Shield className="h-5 w-5" />}
                    color="bg-purple-500"
                    delay={0.3}
                />
                <RecordCard
                    title="حارس السور"
                    studentName={suraGuardian.name}
                    studentPhoto={suraGuardian.photoURL}
                    value={suraGuardian.count}
                    unit="سورة/شهر"
                    icon={<BookOpenCheck className="h-5 w-5" />}
                    color="bg-sky-500"
                    delay={0.4}
                />
                <RecordCard
                    title="المعلم المثابر"
                    studentName={teacherName}
                    studentPhoto={user?.photoURL || undefined}
                    value={persistentTeacher.streak}
                    unit="يوم عمل"
                    icon={<Activity className="h-5 w-5" />}
                    color="bg-teal-500"
                    delay={0.5}
                />
                <RecordCard
                    title="حصص العطاء"
                    studentName={teacherName}
                    studentPhoto={user?.photoURL || undefined}
                    value={givingRecord.count}
                    unit="حصة إضافية"
                    icon={<TrendingUp className="h-5 w-5" />}
                    color="bg-cyan-500"
                    delay={0.6}
                />
            </div>
        </div>
    );
}
