"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Award, Users, BookOpen, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupStats {
    groupName: string;
    sheikhName: string;
    totalStudents: number;
    activeStudents: number;
    averageMasteryScore: number;
    totalMemorized: number;
    totalMastered: number;
    progressPercentage: number;
    topStudents: Array<{
        name: string;
        score: number;
    }>;
}

interface GroupComparisonCardProps {
    stats: GroupStats;
    rank: number;
    onClick?: () => void;
}

export function GroupComparisonCard({ stats, rank, onClick }: GroupComparisonCardProps) {
    let rankDisplay = rank.toString();
    let rankClass = '';

    if (rank === 1) {
        rankDisplay = '🥇';
        rankClass = 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500';
    } else if (rank === 2) {
        rankDisplay = '🥈';
        rankClass = 'bg-gray-200 dark:bg-gray-700/30 border-gray-400';
    } else if (rank === 3) {
        rankDisplay = '🥉';
        rankClass = 'bg-orange-100 dark:bg-orange-900/30 border-orange-500';
    }

    return (
        <Card
            className={cn(
                "cursor-pointer transition-all hover:shadow-lg hover:scale-105 border-2",
                rankClass
            )}
            onClick={onClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <span className="text-2xl">{rankDisplay}</span>
                        {stats.groupName}
                    </CardTitle>
                    <Badge variant="outline" className="font-medium">
                        {stats.sheikhName}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Average Score */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">متوسط النقاط</span>
                    </div>
                    <span className="text-xl font-bold text-primary">{stats.averageMasteryScore.toFixed(1)}</span>
                </div>

                {/* Active Students */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">الطلاب النشطون</span>
                    </div>
                    <span className="text-sm font-bold">{stats.activeStudents} / {stats.totalStudents}</span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>نسبة التقدم</span>
                        <span>{stats.progressPercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.progressPercentage} className="h-2" />
                </div>

                {/* Memorization Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-green-500" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">محفوظ</span>
                            <span className="text-sm font-bold">{stats.totalMemorized}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">متقن</span>
                            <span className="text-sm font-bold">{stats.totalMastered}</span>
                        </div>
                    </div>
                </div>

                {/* Top 3 Students Preview */}
                {stats.topStudents.length > 0 && (
                    <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">أفضل 3 طلاب:</p>
                        <div className="space-y-1">
                            {stats.topStudents.slice(0, 3).map((student, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="truncate">{student.name}</span>
                                    <span className="font-bold text-primary">{student.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
