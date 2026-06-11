"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UserCheck, Star, Calendar, MessageSquare, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';

export default function SheikhsMonitoringPage() {
    const { allUsers, dailyReports, dailySessions } = useStudentContext();
    const { user } = useAuth();

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const sheikhsPerformance = useMemo(() => {
        const sheikhs = allUsers.filter(u => u.role === 'sheikh');

        return sheikhs.map(sheikh => {
            // Calculate report counts for this sheikh
            let reportCount = 0;
            if (dailyReports) {
                Object.values(dailyReports).forEach(day => {
                    if (day) {
                        Object.values(day).forEach(report => {
                            if (report && report.authorId === sheikh.uid) reportCount++;
                        });
                    }
                });
            }

            // Calculate actual session counts, attendance rate, and average student memorization rating
            let sessionCount = 0;
            let totalPresent = 0;
            let totalRecordCount = 0;
            let totalEvalPoints = 0;
            let evalCount = 0;

            if (dailySessions) {
                Object.values(dailySessions).forEach(daySessions => {
                    if (daySessions) {
                        Object.values(daySessions).forEach((session: any) => {
                            if (session && session.ownerId === sheikh.uid) {
                                const sType = session.sessionType;
                                const isReal = sType === 'حصة أساسية' || sType === 'حصة تعويضية' || sType === 'حصة إضافية';
                                if (isReal) {
                                    sessionCount++;
                                    const records: any[] = Array.isArray(session.records)
                                        ? session.records
                                        : session.records ? Object.values(session.records) : [];

                                    records.forEach((r: any) => {
                                        totalRecordCount++;
                                        if (r.attendance === 'حاضر' || r.attendance === 'متأخر' || r.attendance === 'تعويض') {
                                            totalPresent++;
                                        }

                                        if (r.memorization) {
                                            evalCount++;
                                            if (r.memorization === 'ممتاز') {
                                                totalEvalPoints += 5;
                                            } else if (r.memorization === 'جيد جدا' || r.memorization === 'جيد جداً') {
                                                totalEvalPoints += 3.5;
                                            } else if (r.memorization === 'جيد') {
                                                totalEvalPoints += 2.5;
                                            } else if (r.memorization === 'حسن') {
                                                totalEvalPoints += 1.5;
                                            } else if (r.memorization === 'مقبول' || r.memorization === 'متوسط') {
                                                totalEvalPoints += 1.0;
                                            } else if (r.memorization === 'ضعيف') {
                                                totalEvalPoints += 0.5;
                                            } else if (r.memorization === 'لم يحفظ') {
                                                totalEvalPoints += 0;
                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                });
            }

            const attendanceRate = totalRecordCount > 0
                ? Math.round((totalPresent / totalRecordCount) * 100)
                : 100;

            const rating = evalCount > 0
                ? parseFloat((totalEvalPoints / evalCount).toFixed(1))
                : 5.0;

            return {
                ...sheikh,
                reportCount,
                rating,
                attendance: `${attendanceRate}%`,
                sessionCount
            };
        });
    }, [allUsers, dailyReports, dailySessions]);

    return (
        <ProtectedPage>
            <div className="container mx-auto p-4 space-y-8 pb-32 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-headline font-bold text-gray-900">أداء المشايخ</h1>
                        <p className="text-muted-foreground font-body text-lg text-slate-500">تقييم ومتابعة نشاط المشايخ والتقارير المرفوعة.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {sheikhsPerformance.map((sheikh, idx) => (
                        <Card key={idx} className={cn(
                            "border-none shadow-2xl relative overflow-hidden group transition-all duration-500 hover:-translate-y-2",
                            theme.isLight ? "bg-white" : "bg-white/5"
                        )}>
                            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-primary/20 to-blue-500/20" />
                            <CardHeader className="relative pt-12 pb-6 px-6">
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <Avatar className="h-24 w-24 border-4 border-background shadow-2xl">
                                        <AvatarImage src={sheikh.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${sheikh.displayName}`} />
                                        <AvatarFallback>{sheikh.displayName?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <CardTitle className="text-2xl font-headline font-bold">{sheikh.displayName}</CardTitle>
                                        <CardDescription className="font-body font-medium opacity-60">{sheikh.group || 'فوج غير محدد'}</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <Star key={s} className={cn("h-4 w-4", s <= Math.floor(sheikh.rating) ? "text-amber-400 fill-amber-400" : "text-white/10")} />
                                        ))}
                                        <span className="text-xs font-bold mr-2 opacity-60">({sheikh.rating})</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="px-6 pb-8 space-y-6">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="text-center p-3 rounded-2xl bg-white/5">
                                        <Calendar className="h-5 w-5 text-blue-400 mx-auto mb-2" />
                                        <p className="text-[10px] opacity-40 mb-1">الحصص</p>
                                        <p className="text-lg font-black font-headline">{sheikh.sessionCount}</p>
                                    </div>
                                    <div className="text-center p-3 rounded-2xl bg-white/5">
                                        <MessageSquare className="h-5 w-5 text-emerald-400 mx-auto mb-2" />
                                        <p className="text-[10px] opacity-40 mb-1">التقارير</p>
                                        <p className="text-lg font-black font-headline">{sheikh.reportCount}</p>
                                    </div>
                                    <div className="text-center p-3 rounded-2xl bg-white/5">
                                        <Award className="h-5 w-5 text-amber-400 mx-auto mb-2" />
                                        <p className="text-[10px] opacity-40 mb-1">الالتزام</p>
                                        <p className="text-lg font-black font-headline">{sheikh.attendance}</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="opacity-60">تاريخ الانضمام</span>
                                        <span className="font-medium font-body">{sheikh.joinDate || '2023-09-01'}</span>
                                    </div>
                                    <div className="w-full h-px bg-white/5" />
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="opacity-60">آخر نشاط</span>
                                        <span className="text-emerald-400 font-bold">نشط الآن</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </ProtectedPage>
    );
}
