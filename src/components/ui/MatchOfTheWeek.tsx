
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Swords, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LeagueStat } from '@/lib/types';

export const MatchOfTheWeek = ({ leagueTable }: { leagueTable: LeagueStat[] }) => {
    
    const isMatchDay = useMemo(() => {
        const today = new Date().getDay();
        // Wednesday is day 3 (Sunday=0)
        return today === 3;
    }, []);

    const matchDetails = useMemo(() => {
        if (leagueTable.length < 2) return null;

        const topFive = leagueTable.slice(0, 5);
        if (topFive.length < 2) return null;

        let contender1 = topFive[0];
        let contender2 = topFive[1];
        let isTitleDecider = false;

        // Check if the top match is a title decider
        if ((contender1.points - contender2.points) <= 3) {
            isTitleDecider = true;
        } else {
            // Find the closest match in the top 5
            let minDiff = Infinity;
            for (let i = 0; i < topFive.length; i++) {
                for (let j = i + 1; j < topFive.length; j++) {
                    const diff = Math.abs(topFive[i].points - topFive[j].points);
                    if (diff < minDiff) {
                        minDiff = diff;
                        contender1 = topFive[i];
                        contender2 = topFive[j];
                    }
                }
            }
            isTitleDecider = false;
        }
        
        // Ensure contender1 is always the one with more or equal points
        if (contender1.points < contender2.points) {
            [contender1, contender2] = [contender2, contender1];
        }

        return { contender1, contender2, isTitleDecider };

    }, [leagueTable]);

    if (!isMatchDay || !matchDetails) {
        return null; // Don't render if it's not match day or not enough players
    }

    const { contender1, contender2, isTitleDecider } = matchDetails;

    return (
        <Card className="bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 text-white border-primary/50 shadow-2xl">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-headline font-bold flex items-center justify-center gap-2 text-amber-300 drop-shadow-lg">
                    <Star className="text-amber-400" />
                    {isTitleDecider ? "مباراة القمة: حسم الصدارة" : "مباراة الأسبوع"}
                </CardTitle>
                <CardDescription className="text-gray-300">
                    أقوى مواجهة هذا الأسبوع، حيث يتنافس أفضل الطلاب لحسم مراكز الصدارة.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-around">
                    {/* Contender 1 */}
                    <div className="flex flex-col items-center gap-2 text-center">
                        <Avatar className="w-24 h-24 border-4 border-amber-400">
                            <AvatarImage src={contender1.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${contender1.studentName}`} alt={contender1.studentName} />
                            <AvatarFallback>{contender1.studentName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="text-lg font-bold">{contender1.studentName}</h3>
                        <Badge variant="secondary" className="text-xl">{contender1.points} نقطة</Badge>
                    </div>

                    <Swords className="h-12 w-12 text-red-500 animate-pulse" />

                    {/* Contender 2 */}
                     <div className="flex flex-col items-center gap-2 text-center">
                        <Avatar className="w-24 h-24 border-4 border-gray-400">
                            <AvatarImage src={contender2.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${contender2.studentName}`} alt={contender2.studentName} />
                            <AvatarFallback>{contender2.studentName.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <h3 className="text-lg font-bold">{contender2.studentName}</h3>
                        <Badge variant="secondary" className="text-xl">{contender2.points} نقطة</Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
