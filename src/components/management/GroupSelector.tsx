"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    SelectGroup,
    SelectLabel,
    SelectSeparator,
} from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { cn, isSheikhMenUser, isSheikhWomenUser } from '@/lib/utils';
import { PORTAL_THEMES } from '@/lib/themes';

interface GroupSelectorProps {
    value: string; // 'all' or uid of the sheikh
    onChange: (value: string) => void;
    className?: string;
}

export function GroupSelector({ value, onChange, className }: GroupSelectorProps) {
    const { allUsers } = useStudentContext();
    const { user } = useAuth();

    // Theme context
    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    // Get all sheikhs with unique groups and sorted numerically
    const sheikhs = useMemo(() => {
        const uniqueGroups = new Map();

        // Sort users to prefer UIDs containing 'admin' when selecting a representative for a group
        const sortedUsers = [...allUsers].sort((a, b) => {
            const aIsAdmin = a.uid.toLowerCase().includes('admin');
            const bIsAdmin = b.uid.toLowerCase().includes('admin');
            if (aIsAdmin && !bIsAdmin) return -1;
            if (!aIsAdmin && bIsAdmin) return 1;
            return 0;
        });

        sortedUsers.forEach(u => {
            if (u.group) {
                const groupKey = u.group.trim();
                if (!uniqueGroups.has(groupKey)) {
                    uniqueGroups.set(groupKey, u);
                }
            }
        });

        return Array.from(uniqueGroups.values())
            .sort((a, b) => {
                const groupA = parseInt((a.group || '').replace(/[^0-9]/g, '')) || 999;
                const groupB = parseInt((b.group || '').replace(/[^0-9]/g, '')) || 999;
                return groupA - groupB;
            });
    }, [allUsers]);

    // Categorize sheikhs into Men's ( المشايخ ) and Women's ( الأستاذات ) groups
    const groupedSheikhs = useMemo(() => {
        const sheikhsMen: typeof sheikhs = [];
        const sheikhsWomen: typeof sheikhs = [];
        const sheikhsOthers: typeof sheikhs = [];

        sheikhs.forEach(sheikh => {
            if (isSheikhMenUser(sheikh)) {
                sheikhsMen.push(sheikh);
            } else if (isSheikhWomenUser(sheikh)) {
                sheikhsWomen.push(sheikh);
            } else {
                sheikhsOthers.push(sheikh);
            }
        });

        return { sheikhsMen, sheikhsWomen, sheikhsOthers };
    }, [sheikhs]);

    return (
        <div className={cn("min-w-[200px]", className)}>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger className={cn(
                    "w-full h-10 rounded-xl transition-colors border",
                    theme.isLight
                        ? "bg-white border-slate-200 text-slate-800 focus:ring-slate-200"
                        : "bg-white/5 border-white/10 text-white focus:ring-white/10"
                )}>
                    <SelectValue placeholder="اختر الفوج للعرض" />
                </SelectTrigger>
                <SelectContent align="end" className={cn(
                    "max-h-[300px] overflow-y-auto",
                    theme.isLight ? "bg-white" : "bg-slate-900 border-white/10 text-white"
                )}>
                    <SelectItem value="all" className="font-bold cursor-pointer mb-1">
                        🏛️ كل المدرسة (عرض شامل)
                    </SelectItem>
                    <SelectItem value="sheikhs_all" className="font-bold cursor-pointer text-indigo-600 dark:text-indigo-400 mb-1">
                        👨‍🏫 أفواج المشايخ (11 فوجاً)
                    </SelectItem>
                    <SelectItem value="ustadhats_all" className="font-bold cursor-pointer text-pink-600 dark:text-pink-400 mb-2">
                        👩‍🏫 أفواج الأستاذات (10 أفواج)
                    </SelectItem>

                    {groupedSheikhs.sheikhsMen.length > 0 && (
                        <SelectGroup>
                            <SelectSeparator className="my-1" />
                            <SelectLabel className={cn(
                                "font-bold text-[11px] py-1.5 pl-8 pr-2 sticky top-0 z-10 rounded-sm",
                                theme.isLight ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-slate-300"
                            )}>
                                تفصيل أفواج المشايخ
                            </SelectLabel>
                            {groupedSheikhs.sheikhsMen.map((sheikh) => (
                                <SelectItem key={sheikh.uid} value={sheikh.uid} className="cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <span className={cn("inline-block w-2 h-2 rounded-full", theme.isLight ? "bg-slate-400" : "bg-white/40")} />
                                        <span>{sheikh.group || 'فوج غير محدد'} {sheikh.displayName}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}

                    {groupedSheikhs.sheikhsWomen.length > 0 && (
                        <SelectGroup>
                            <SelectSeparator className="my-1" />
                            <SelectLabel className={cn(
                                "font-bold text-[11px] py-1.5 pl-8 pr-2 sticky top-0 z-10 rounded-sm",
                                theme.isLight ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-slate-300"
                            )}>
                                تفصيل أفواج الأستاذات
                            </SelectLabel>
                            {groupedSheikhs.sheikhsWomen.map((sheikh) => (
                                <SelectItem key={sheikh.uid} value={sheikh.uid} className="cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <span className={cn("inline-block w-2 h-2 rounded-full", theme.isLight ? "bg-slate-400" : "bg-white/40")} />
                                        <span>{sheikh.group || 'فوج غير محدد'} {sheikh.displayName}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}

                    {groupedSheikhs.sheikhsOthers.length > 0 && (
                        <SelectGroup>
                            <SelectSeparator className="my-1" />
                            <SelectLabel className={cn(
                                "font-bold text-[11px] py-1.5 pl-8 pr-2 sticky top-0 z-10 rounded-sm",
                                theme.isLight ? "bg-slate-100 text-slate-600" : "bg-slate-800 text-slate-300"
                            )}>
                                أفواج أخرى
                            </SelectLabel>
                            {groupedSheikhs.sheikhsOthers.map((sheikh) => (
                                <SelectItem key={sheikh.uid} value={sheikh.uid} className="cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        <span className={cn("inline-block w-2 h-2 rounded-full", theme.isLight ? "bg-slate-400" : "bg-white/40")} />
                                        <span>{sheikh.group || 'فوج غير محدد'} {sheikh.displayName}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                </SelectContent>
            </Select>
        </div>
    );
}
