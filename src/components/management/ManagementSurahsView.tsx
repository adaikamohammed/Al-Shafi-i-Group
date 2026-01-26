"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GroupComparisonCard } from './GroupComparisonCard';
import { cn } from '@/lib/utils';

interface ManagementSurahsViewProps {
    groupStats: Array<{
        groupName: string;
        sheikhName: string;
        totalStudents: number;
        activeStudents: number;
        averageMasteryScore: number;
        totalMemorized: number;
        totalMastered: number;
        progressPercentage: number;
        topStudents: Array<{ name: string; score: number }>;
        students: Array<any>;
    }>;
}

export function ManagementSurahsView({ groupStats }: ManagementSurahsViewProps) {
    const [selectedGroupForDetails, setSelectedGroupForDetails] = useState<string | null>(null);

    if (groupStats.length === 0) return null;

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="text-2xl font-headline font-bold">مقارنة الأفواج - متابعة الحفظ</CardTitle>
                    <CardDescription>
                        الترتيب حسب متوسط نقاط الإتقان لكل فوج. انقر على أي فوج لعرض التفاصيل.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupStats.map((group, index) => (
                            <GroupComparisonCard
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
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">
                            تفاصيل {selectedGroupForDetails}
                        </DialogTitle>
                        <DialogDescription>
                            قائمة الطلاب وإحصائياتهم التفصيلية
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
                                            <TableHead>الترتيب</TableHead>
                                            <TableHead>الطالب</TableHead>
                                            <TableHead>النقاط</TableHead>
                                            <TableHead>محفوظ</TableHead>
                                            <TableHead>متقن</TableHead>
                                            <TableHead>الحالة</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {group.students
                                            .sort((a: any, b: any) => b.masteryScore - a.masteryScore)
                                            .map((student: any, index: number) => {
                                                const rank = index + 1;
                                                let rankDisplay = rank.toString();
                                                if (rank === 1) rankDisplay = '🥇';
                                                else if (rank === 2) rankDisplay = '🥈';
                                                else if (rank === 3) rankDisplay = '🥉';

                                                return (
                                                    <TableRow key={student.id} className={cn(student.status === 'مطرود' && 'opacity-50')}>
                                                        <TableCell className="font-bold text-lg">{rankDisplay}</TableCell>
                                                        <TableCell>{student.fullName}</TableCell>
                                                        <TableCell className="font-bold text-primary">{student.masteryScore}</TableCell>
                                                        <TableCell>{student.memorizedCount}</TableCell>
                                                        <TableCell>{student.masteredCount}</TableCell>
                                                        <TableCell>
                                                            <Badge variant={student.status === 'مطرود' ? 'destructive' : 'default'}>
                                                                {student.status}
                                                            </Badge>
                                                        </TableCell>
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
