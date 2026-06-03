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

        // Hijri Date - Um Al-Qura calendar
        const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            weekday: 'long'
        });
        const parts = hijriFormatter.formatToParts(today);
        const weekday = parts.find(p => p.type === 'weekday')?.value || '';
        const day = parts.find(p => p.type === 'day')?.value || '';
        const month = parts.find(p => p.type === 'month')?.value || '';
        const year = parts.find(p => p.type === 'year')?.value || '';
        const era = parts.find(p => p.type === 'era')?.value || 'هـ';

        const toWestern = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
        const hijri = `${weekday}، ${toWestern(day)} ${month} ${toWestern(year)} ${era}`;

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
