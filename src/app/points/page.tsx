
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStudentContext } from '@/context/StudentContext';
import { Loader2, AlertTriangle, Medal, Star, Gift, ShoppingCart, History, Coins } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';

interface Redemption {
    id: string;
    studentName: string;
    prizeName: string;
    cost: number;
    date: Date;
}

export default function PointsSystemPage() {
    const { students, dailySessions, surahProgress, loading, settings } = useStudentContext();
    const { toast } = useToast();
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [spentPoints, setSpentPoints] = useState<Record<string, number>>({});
    const [redemptionHistory, setRedemptionHistory] = useState<Redemption[]>([]);

    const activeStudents = useMemo(() => (students ?? []).filter(s => s.status === 'نشط'), [students]);
    
    const pointsConfig = settings.points;
    const rewards = settings.rewards;

    const studentTotalPoints = useMemo(() => {
        const studentScores: Record<string, number> = {};
        const seasonStartDate = settings.seasonStartDate ? parseISO(settings.seasonStartDate) : null;

        const filteredSessions = Object.values(dailySessions ?? {}).filter(session => {
            const sessionDate = parseISO(session.date);
            return !seasonStartDate || isAfter(sessionDate, seasonStartDate);
        });

        activeStudents.forEach(student => {
            let totalPoints = 0;
            
            // Points from sessions
            filteredSessions.forEach(session => {
                (session.records ?? []).forEach(record => {
                    if (record.studentId === student.id) {
                        let points = 0;
                        if (record.attendance) points += pointsConfig.attendance[record.attendance as keyof typeof pointsConfig.attendance] ?? 0;
                        if (record.memorization) points += pointsConfig.evaluation[record.memorization as keyof typeof pointsConfig.evaluation] ?? 0;
                        if (record.behavior) points += pointsConfig.behavior[record.behavior as keyof typeof pointsConfig.behavior] ?? 0;
                        if (record.review) points += pointsConfig.review.completed;
                        totalPoints += points;
                    }
                });
            });

            // Points from Surah mastery
            const progress = surahProgress ? (surahProgress[student.id] || {}) : {};
            Object.values(progress).forEach(status => {
                if (status === 1) totalPoints += pointsConfig.surah.memorized;
                if (status === 2) totalPoints += pointsConfig.surah.mastered;
            });
            studentScores[student.id] = totalPoints;
        });
        
        return studentScores;
    }, [activeStudents, dailySessions, surahProgress, pointsConfig, settings.seasonStartDate]);


    const studentCurrentBalance = useMemo(() => {
        if (!selectedStudentId) return 0;
        const totalEarned = studentTotalPoints[selectedStudentId] || 0;
        const totalSpent = spentPoints[selectedStudentId] || 0;
        return totalEarned - totalSpent;
    }, [selectedStudentId, studentTotalPoints, spentPoints]);
    
    const handleRedeem = (prize: typeof rewards[0]) => {
        if (!selectedStudentId) {
            toast({ title: 'خطأ', description: 'الرجاء اختيار طالب أولاً.', variant: 'destructive'});
            return;
        }
        
        if (studentCurrentBalance < prize.cost) {
            toast({ title: 'رصيد غير كافٍ', description: 'نقاط الطالب لا تسمح باستبدال هذه الجائزة.', variant: 'destructive'});
            return;
        }
        
        setSpentPoints(prev => ({
            ...prev,
            [selectedStudentId]: (prev[selectedStudentId] || 0) + prize.cost
        }));

        const student = activeStudents.find(s => s.id === selectedStudentId);
        const newRedemption: Redemption = {
            id: `${Date.now()}`,
            studentName: student?.fullName || 'طالب غير معروف',
            prizeName: prize.name,
            cost: prize.cost,
            date: new Date()
        };
        setRedemptionHistory(prev => [newRedemption, ...prev]);

        toast({
            title: '✅ تم الاستبدال بنجاح!',
            description: `تم خصم ${prize.cost} نقطة من رصيد الطالب ${student?.fullName}.`
        });
    };

    const getIcon = (iconName: string) => {
        switch(iconName) {
            case 'Star': return <Star className="h-6 w-6 text-primary" />;
            case 'Medal': return <Medal className="h-6 w-6 text-primary" />;
            case 'Gift': return <Gift className="h-6 w-6 text-primary" />;
            case 'UserCheck': return <Medal className="h-6 w-6 text-primary" />;
            default: return <Star className="h-6 w-6 text-primary" />;
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-200px)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
     if (activeStudents.length === 0) {
        return (
            <div className="space-y-6 flex flex-col items-center justify-center h-[calc(100vh-200px)]">
                <AlertTriangle className="h-16 w-16 text-yellow-400" />
                <h1 className="text-3xl font-headline font-bold text-center">لا يوجد طلبة لاستخدام نظام النقاط</h1>
                <p className="text-muted-foreground text-center">
                    يرجى إضافة طلبة نشطين أولاً من صفحة "إدارة الطلبة".
                </p>
            </div>
        );
    }


    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="text-3xl font-headline font-bold flex items-center gap-2"><ShoppingCart /> سوق الجوائز</CardTitle>
                    <CardDescription>
                        استخدم نقاط الطلاب التي اكتسبوها من خلال الحضور والأداء لاستبدالها بجوائز قيمة. اختر طالبًا لعرض رصيده ثم اختر الجائزة المناسبة.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center p-4 border rounded-lg bg-background">
                         <div className="w-full md:w-1/3">
                            <Label htmlFor="student-select">اختر الطالب</Label>
                            <Select dir="rtl" value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                <SelectTrigger id="student-select">
                                    <SelectValue placeholder="اختر طالبًا..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {activeStudents.map(student => (
                                        <SelectItem key={student.id} value={student.id}>
                                            {student.fullName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedStudentId && (
                             <div className="w-full md:w-2/3 flex items-center justify-center bg-primary/5 p-4 rounded-lg">
                                <Coins className="h-8 w-8 text-yellow-500 ml-4"/>
                                <div>
                                    <p className="text-sm text-muted-foreground">الرصيد الحالي للطالب</p>
                                    <p className="text-2xl font-bold">{studentCurrentBalance.toFixed(0)} نقطة</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {rewards.map(prize => (
                            <Card key={prize.id} className="flex flex-col">
                                <CardHeader className="flex-row items-center gap-4 space-y-0">
                                    <div className="bg-primary/10 p-3 rounded-full">
                                        {getIcon(prize.icon)}
                                    </div>
                                    <CardTitle>{prize.name}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground">{prize.description}</p>
                                </CardContent>
                                <div className="p-4 border-t">
                                     <div className="flex justify-between items-center mb-4">
                                        <span className="font-semibold">التكلفة:</span>
                                        <span className="text-lg font-bold text-primary">{prize.cost} نقطة</span>
                                    </div>
                                    <Button 
                                        className="w-full"
                                        disabled={!selectedStudentId || studentCurrentBalance < prize.cost}
                                        onClick={() => handleRedeem(prize)}
                                    >
                                        استبدال
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History /> سجل الاستبدالات</CardTitle>
                    <CardDescription>آخر عمليات استبدال النقاط التي تمت.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم الطالب</TableHead>
                                <TableHead>الجائزة</TableHead>
                                <TableHead>التكلفة</TableHead>
                                <TableHead>تاريخ الاستبدال</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {redemptionHistory.length > 0 ? redemptionHistory.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.studentName}</TableCell>
                                    <TableCell>{item.prizeName}</TableCell>
                                    <TableCell>{item.cost} نقطة</TableCell>
                                    <TableCell>{format(item.date, 'd MMMM yyyy, h:mm a', { locale: ar })}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center h-24">
                                        لم تتم أي عملية استبدال بعد.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

        </div>
    );
}
