"use client";

import { Suspense } from 'react';
import MeetingClient from '../[id]/MeetingClient';

export default function MeetingDetailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="font-bold text-slate-400">جاري تحميل البيانات...</p>
                </div>
            </div>
        }>
            <MeetingClient />
        </Suspense>
    );
}
