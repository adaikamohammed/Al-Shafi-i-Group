"use client";

// This route is kept for backwards compatibility only.
// All new navigation uses /meetings/detail?id=...
// This avoids the generateStaticParams() requirement with output: 'export'.

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function MeetingPageRedirect() {
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        if (params?.id) {
            router.replace(`/meetings/detail?id=${params.id}`);
        } else {
            router.replace('/meetings');
        }
    }, [params, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="font-bold text-slate-400">جاري التحويل...</p>
            </div>
        </div>
    );
}

export function generateStaticParams() {
    // Return an empty array — this page is client-side only and just redirects.
    // The actual content lives at /meetings/detail?id=...
    return [];
}
