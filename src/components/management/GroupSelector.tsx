"use client";

import React, { useMemo } from 'react';
import { useStudentContext } from '@/context/StudentContext';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
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

    // Get all sheikhs
    const sheikhs = useMemo(() => {
        return allUsers
            .filter(u => u.role === 'sheikh')
            .sort((a, b) => (a.group || '').localeCompare(b.group || ''));
    }, [allUsers]);

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
                    "max-h-[300px]",
                    theme.isLight ? "bg-white" : "bg-slate-900 border-white/10 text-white"
                )}>
                    <SelectItem value="all" className="font-bold cursor-pointer">
                        🏛️ كل المدرسة (عرض شامل)
                    </SelectItem>
                    {sheikhs.map((sheikh) => (
                        <SelectItem key={sheikh.uid} value={sheikh.uid} className="cursor-pointer">
                            <span className="flex items-center gap-2">
                                <span className={cn("inline-block w-2 h-2 rounded-full", theme.isLight ? "bg-slate-400" : "bg-white/40")} />
                                <span>{sheikh.group || 'فوج غير محدد'}</span>
                                <span className="text-xs opacity-50 mx-1">({sheikh.displayName})</span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
