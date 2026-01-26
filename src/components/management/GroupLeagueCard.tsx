"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Users, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GroupLeagueStats {
    groupName: string;
    sheikhName: string;
    totalStudents: number;
    activeStudents: number;
    averagePoints: number;
    totalWins: number;
    totalGoals: number;
    winRate: number;
    topPlayers: Array<{
        name: string;
        points: number;
    }>;
}

interface GroupLeagueCardProps {
    stats: GroupLeagueStats;
    rank: number;
    onClick?: () => void;
}

export function GroupLeagueCard({ stats, rank, onClick }: GroupLeagueCardProps) {
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
                {/* Average Points */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">متوسط النقاط</span>
                    </div>
                    <span className="text-xl font-bold text-primary">{stats.averagePoints.toFixed(1)}</span>
                </div>

                {/* Active Students */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-medium">الطلاب النشطون</span>
                    </div>
                    <span className="text-sm font-bold">{stats.activeStudents} / {stats.totalStudents}</span>
                </div>

                {/* Win Rate */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>نسبة الفوز</span>
                        <span>{stats.winRate.toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.winRate} className="h-2" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-500" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">انتصارات</span>
                            <span className="text-sm font-bold">{stats.totalWins}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground">أهداف</span>
                            <span className="text-sm font-bold">{stats.totalGoals}</span>
                        </div>
                    </div>
                </div>

                {/* Top 3 Players Preview */}
                {stats.topPlayers.length > 0 && (
                    <div className="pt-2 border-t">
                        <p className="text-xs text-muted-foreground mb-1">أفضل 3 لاعبين:</p>
                        <div className="space-y-1">
                            {stats.topPlayers.slice(0, 3).map((player, idx) => (
                                <div key={idx} className="flex justify-between text-xs">
                                    <span className="truncate">{player.name}</span>
                                    <span className="font-bold text-primary">{player.points}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
