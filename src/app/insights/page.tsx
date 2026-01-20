"use client";

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { ManagementDashboard } from '@/components/management/ManagementDashboard';
import { GroupEvaluationCard } from '@/components/ui/GroupEvaluationCard';
import { HallOfFame } from '@/components/ui/HallOfFame';
import { ImpactStats } from '@/components/ui/ImpactStats';
import { RecentMilestones } from '@/components/ui/RecentMilestones';
import { GlobalErrorBoundary } from '@/components/ui/GlobalErrorBoundary';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, Award, Crown } from 'lucide-react';

export default function InsightsPage() {
    const { user, isManagement } = useAuth();
    const { students, dailySessions, loading } = useStudentContext();

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <GlobalErrorBoundary>
            <div className={cn(
                "min-h-screen w-full relative overflow-x-hidden transition-colors duration-700 p-4",
                theme.isLight ? "text-slate-900" : "text-white"
            )}>
                <div className="relative z-10 container mx-auto flex flex-col items-center gap-8 py-8">

                    <div className="w-full max-w-7xl">
                        <h1 className="text-4xl font-headline font-bold mb-8 text-center">الرؤى والتحليلات</h1>
                    </div>

                    <div className="w-full max-w-7xl">
                        <ImpactStats />
                    </div>

                    {isManagement ? (
                        <div className="w-full max-w-7xl">
                            <ManagementDashboard />
                        </div>
                    ) : (
                        <div className="w-full max-w-7xl space-y-8">
                            <section className="space-y-6">
                                <div className="flex items-center gap-4 px-6 border-r-4 border-primary">
                                    <Award className="h-7 w-7 text-primary" />
                                    <h2 className="text-3xl font-headline font-black tracking-tight">الرادار التحليلي</h2>
                                </div>
                                <GroupEvaluationCard students={students || []} sessions={dailySessions} groupName={user?.group} />
                            </section>
                        </div>
                    )}

                    <div className="w-full max-w-7xl space-y-12">
                        <div className={cn(
                            "backdrop-blur-xl p-8 lg:p-12 rounded-[2.5rem] border shadow-2xl space-y-16",
                            theme.isLight ? "bg-white border-slate-200" : "bg-white/5 border-white/10"
                        )}>
                            <section className="space-y-8">
                                <RecentMilestones />
                            </section>

                            <div className={cn("w-full h-px", theme.isLight ? "bg-slate-200" : "bg-white/10")} />

                            <section className="space-y-10">
                                <div className="flex items-center gap-4 px-6 border-r-4 border-yellow-500">
                                    <Crown className="h-8 w-8 text-yellow-500" />
                                    <h2 className="text-3xl font-headline font-black tracking-tight">لوحة الشرف الذهبية</h2>
                                </div>
                                <div className="w-full">
                                    <HallOfFame />
                                </div>
                            </section>
                        </div>
                    </div>

                </div>
            </div>
        </GlobalErrorBoundary>
    );
}
