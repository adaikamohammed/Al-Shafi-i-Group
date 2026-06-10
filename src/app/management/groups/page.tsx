"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shield, Users, UserCheck, TrendingUp, Search } from 'lucide-react';
import { cn, isSheikhMenUser, isSheikhWomenUser, isStudentInMenSheikhs, isStudentInWomenUstadhats } from '@/lib/utils';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';
import { GroupSelector } from '@/components/management/GroupSelector';

export default function GroupsMonitoringPage() {
    const { students, allUsers, selectedGroup, setSelectedGroup } = useStudentContext();
    const { user } = useAuth();

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    const groupsData = useMemo(() => {
        const groups: Record<string, any> = {};

        // Filter sheikhs to match collective groups if selected
        const filteredSheikhs = allUsers.filter(u => u.role === 'sheikh').filter(sheikh => {
            if (selectedGroup === 'sheikhs_all') return isSheikhMenUser(sheikh);
            if (selectedGroup === 'ustadhats_all') return isSheikhWomenUser(sheikh);
            return true;
        });

        // Initialize groups from sheikhs
        filteredSheikhs.forEach(sheikh => {
            groups[sheikh.group || 'غير محدد'] = {
                groupName: sheikh.group || 'غير محدد',
                sheikhName: sheikh.displayName,
                studentCount: 0,
                activeCount: 0,
                lastActivity: sheikh.joinDate || 'غير معروف'
            };
        });

        // Add student counts
        students.forEach(student => {
            if (selectedGroup === 'sheikhs_all' && !isStudentInMenSheikhs(student, allUsers)) return;
            if (selectedGroup === 'ustadhats_all' && !isStudentInWomenUstadhats(student, allUsers)) return;

            const gName = student.groupName || 'غير محدد';
            if (!groups[gName]) {
                groups[gName] = {
                    groupName: gName,
                    sheikhName: 'غير محدد',
                    studentCount: 0,
                    activeCount: 0,
                    lastActivity: 'غير معروف'
                };
            }
            groups[gName].studentCount++;
            if (student.status === 'نشط') groups[gName].activeCount++;
        });

        return Object.values(groups).filter(g => {
            if (selectedGroup === 'all' || selectedGroup === 'sheikhs_all' || selectedGroup === 'ustadhats_all') return true;
            // Find the sheikh UID for this group if possible, or filter by what we have.
            // Our GroupSelector returns UID. 'groups' keys are Group Names.
            // We need to match UID to GroupName.
            const selectedSheikh = allUsers.find(u => u.uid === selectedGroup);
            return selectedSheikh ? g.groupName === selectedSheikh.group : true;
        });
    }, [students, allUsers, selectedGroup]);

    return (
        <ProtectedPage>
            <div className="container mx-auto p-4 space-y-8 pb-32 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-headline font-bold">مراقبة الأفواج</h1>
                        <p className="text-muted-foreground font-body text-lg">نظرة شاملة على جميع المجموعات التعليمية والمشايخ.</p>
                    </div>
                    <GroupSelector value={selectedGroup} onChange={setSelectedGroup} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className={cn("border-none shadow-xl", theme.isLight ? "bg-white" : "bg-white/5")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/20 rounded-2xl">
                                    <Shield className="h-6 w-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm opacity-60">إجمالي الأفواج</p>
                                    <h3 className="text-2xl font-black font-headline">{groupsData.length}</h3>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={cn("border-none shadow-xl", theme.isLight ? "bg-white" : "bg-white/5")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/20 rounded-2xl">
                                    <Users className="h-6 w-6 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-sm opacity-60">متوسط الطلاب/فوج</p>
                                    <h3 className="text-2xl font-black font-headline">
                                        {groupsData.length > 0 ? Math.round(students.length / groupsData.length) : 0}
                                    </h3>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className={cn("border-none shadow-xl", theme.isLight ? "bg-white" : "bg-white/5")}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-500/20 rounded-2xl">
                                    <TrendingUp className="h-6 w-6 text-purple-500" />
                                </div>
                                <div>
                                    <p className="text-sm opacity-60">معدل النشاط العام</p>
                                    <h3 className="text-2xl font-black font-headline">94%</h3>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className={cn("border-none shadow-2xl overflow-hidden", theme.isLight ? "bg-white" : "bg-white/5")}>
                    <CardHeader className="p-6 border-b border-white/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <CardTitle className="text-xl font-headline font-bold">قائمة الأفواج</CardTitle>
                            <div className="relative max-w-sm w-full">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-40" />
                                <Input placeholder="بحث عن فوج أو شيخ..." className="pr-10 rounded-xl bg-white/5 border-white/5" />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className={cn("text-xs uppercase opacity-60", theme.isLight ? "bg-slate-50" : "bg-white/5")}>
                                    <tr>
                                        <th className="px-6 py-4">اسم الفوج</th>
                                        <th className="px-6 py-4">الشيخ المسؤول</th>
                                        <th className="px-6 py-4 text-center">عدد الطلبة</th>
                                        <th className="px-6 py-4 text-center">النشطون</th>
                                        <th className="px-6 py-4 text-center">آخر نشاط</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {groupsData.map((group, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="font-bold flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                    {group.groupName}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-body text-sm opacity-80">{group.sheikhName}</td>
                                            <td className="px-6 py-4 text-center font-bold">{group.studentCount}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-xs font-bold text-emerald-400">{group.activeCount}</span>
                                                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-emerald-500 rounded-full"
                                                            style={{ width: `${(group.activeCount / (group.studentCount || 1)) * 100}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center text-[10px] opacity-40 font-body">{group.lastActivity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </ProtectedPage>
    );
}
