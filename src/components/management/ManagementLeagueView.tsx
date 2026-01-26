"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GroupLeagueCard } from './GroupLeagueCard';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ManagementLeagueViewProps {
    groupStats: Array<{
        groupName: string;
        sheikhName: string;
        totalStudents: number;
        activeStudents: number;
        averagePoints: number;
        totalWins: number;
        totalGoals: number;
        winRate: number;
        topPlayers: Array<{ name: string; points: number }>;
        players: Array<any>;
    }>;
}

export function ManagementLeagueView({ groupStats }: ManagementLeagueViewProps) {
    const [selectedGroupForDetails, setSelectedGroupForDetails] = useState<string | null>(null);

    if (groupStats.length === 0) return null;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-headline font-bold">مقارنة الأفواج - الدوري</CardTitle>
                    <CardDescription>
                        الترتيب حسب متوسط النقاط لكل فوج. انقر على أي فوج لعرض تفاصيل اللاعبين.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupStats.map((group, index) => (
                            <GroupLeagueCard
                                key={group.groupName}
                                stats={group}
                                rank={index + 1}
                                onClick={() => setSelectedGroupForDetails(group.groupName)}
                            />
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Group Details Dialog */}
            <Dialog open={selectedGroupForDetails !== null} onOpenChange={() => setSelectedGroupForDetails(null)}>
                <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">
                            تفاصيل دوري {selectedGroupForDetails}
                        </DialogTitle>
                        <DialogDescription>
                            جدول ترتيب اللاعبين في الفوج
                        </DialogDescription>
                    </DialogHeader>
                    {selectedGroupForDetails && (() => {
                        const group = groupStats.find(g => g.groupName === selectedGroupForDetails);
                        if (!group) return null;

                        return (
                            <div className="space-y-4 mt-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">#</TableHead>
                                            <TableHead>اللاعب</TableHead>
                                            <TableHead className="text-center">لعب</TableHead>
                                            <TableHead className="text-center">فوز</TableHead>
                                            <TableHead className="text-center">تعادل</TableHead>
                                            <TableHead className="text-center">خسارة</TableHead>
                                            <TableHead className="text-center">أهداف له</TableHead>
                                            <TableHead className="text-center">أهداف عليه</TableHead>
                                            <TableHead className="text-center">فارق</TableHead>
                                            <TableHead className="text-center">نقاط</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.players
                                            .sort((a: any, b: any) => b.points - a.points)
                                            .map((player: any, index: number) => {
                                                const rank = index + 1;
                                                let rankDisplay = rank.toString();
                                                let rowClass = '';

                                                if (rank === 1) {
                                                    rankDisplay = '🥇';
                                                    rowClass = 'bg-green-100 dark:bg-green-900/30';
                                                } else if (rank === 2) {
                                                    rankDisplay = '🥈';
                                                    rowClass = 'bg-green-100 dark:bg-green-900/30';
                                                } else if (rank === 3) {
                                                    rankDisplay = '🥉';
                                                    rowClass = 'bg-green-100 dark:bg-green-900/30';
                                                }

                                                return (
                                                    <TableRow key={player.studentId} className={cn(rowClass)}>
                                                        <TableCell className="font-bold text-lg text-center">{rankDisplay}</TableCell>
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-9 w-9">
                                                                    <AvatarImage src={player.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${player.studentName}`} alt={player.studentName} />
                                                                    <AvatarFallback>{player.studentName.charAt(0)}</AvatarFallback>
                                                                </Avatar>
                                                                <span className="font-medium">{player.studentName}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">{player.played}</TableCell>
                                                        <TableCell className="text-center text-green-600 font-semibold">{player.wins}</TableCell>
                                                        <TableCell className="text-center text-gray-500 font-semibold">{player.draws}</TableCell>
                                                        <TableCell className="text-center text-red-600 font-semibold">{player.losses}</TableCell>
                                                        <TableCell className="text-center font-semibold">{player.goalsFor}</TableCell>
                                                        <TableCell className="text-center font-semibold">{player.goalsAgainst}</TableCell>
                                                        <TableCell className="text-center font-semibold">{player.goalDifference}</TableCell>
                                                        <TableCell className="text-center font-bold text-lg">{player.points}</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                    </TableBody>
                                </Table>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </>
    );
}
