import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PreRegistration } from '@/lib/types';
import { Users, UserPlus, Clock, Ban, CheckCircle, BarChart3 } from 'lucide-react';

interface RegistrationsStatsProps {
    registrations: PreRegistration[];
}

export const RegistrationsStats = ({ registrations }: RegistrationsStatsProps) => {
    // Compute Stats
    const total = registrations.length;
    // Pending: 'مؤجل' | 'مرشح' | 'تم الإتصال' | 'تم إرسال رسالة' | 'لم يرد'
    const pending = registrations.filter(r => ['مؤجل', 'مرشح', 'تم الإتصال', 'تم إرسال رسالة', 'لم يرد'].includes(r.status)).length;
    // Accepted: 'تم الإنضمام'
    const accepted = registrations.filter(r => r.status === 'تم الإنضمام').length;
    // Rejected: 'مرفوض' | 'إنضم لمدرسة أخرى' | 'مكرر'
    const rejected = registrations.filter(r => ['مرفوض', 'إنضم لمدرسة أخرى', 'مكرر'].includes(r.status)).length;

    // Group by educational level
    const levelCounts = registrations.reduce((acc, curr) => {
        const level = curr.educationalLevel || 'غير محدد';
        acc[level] = (acc[level] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const topLevel = Object.entries(levelCounts).sort((a, b) => b[1] - a[1])[0];

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="bg-primary/5 border-primary/20 shadow-sm dark:bg-primary/10 dark:border-primary/20">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full text-primary dark:bg-primary/20 dark:text-primary">
                        <Users className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">إجمالي التسجيلات</p>
                        <h3 className="text-2xl font-bold text-primary">{total}</h3>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200 shadow-sm dark:bg-orange-950/20 dark:border-orange-900/50">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-full text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">قيد الانتظار</p>
                        <h3 className="text-2xl font-bold text-orange-700 dark:text-orange-400">{pending}</h3>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200 shadow-sm dark:bg-green-950/20 dark:border-green-900/50">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-full text-green-600 dark:bg-green-900/40 dark:text-green-400">
                        <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">تم القبول</p>
                        <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">{accepted}</h3>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200 shadow-sm dark:bg-red-950/20 dark:border-red-900/50">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-full text-red-600 dark:bg-red-900/40 dark:text-red-400">
                        <Ban className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground font-medium">المرفوضين</p>
                        <h3 className="text-2xl font-bold text-red-700 dark:text-red-400">{rejected}</h3>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
