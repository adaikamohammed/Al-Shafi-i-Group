"use client";

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Calendar, Moon } from 'lucide-react';

interface DateDisplayProps {
    className?: string;
    showIcons?: boolean;
}

export const DateDisplay = ({ className, showIcons = true }: DateDisplayProps) => {
    const [dates, setDates] = useState<{ hijri: string; gregorian: string } | null>(null);

    useEffect(() => {
        const today = new Date();

        // Hijri Date
        const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            weekday: 'long'
        }).format(today);

        // Gregorian Date
        const gregorian = new Intl.DateTimeFormat('ar-EG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(today);

        setDates({ hijri, gregorian });
    }, []);

    if (!dates) return null;

    return (
        <div dir="rtl" className={cn("flex flex-col items-center justify-center text-center", className)}>
            <div className="flex items-center gap-2 text-sm font-bold font-headline text-primary">
                {showIcons && <Moon className="h-4 w-4" />}
                <span dir="rtl">{dates.hijri}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-body mt-0.5">
                {showIcons && <Calendar className="h-3 w-3" />}
                <span dir="rtl">{dates.gregorian}</span>
            </div>
        </div>
    );
};
