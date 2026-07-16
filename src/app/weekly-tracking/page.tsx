"use client";

import React, { Suspense } from 'react';
import { VisualProgress } from '@/components/sessions/VisualProgress';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import { Loader2 } from 'lucide-react';

export default function WeeklyFollowUpPage() {
  return (
    <ProtectedPage>
      <div className="container mx-auto p-4 max-w-6xl space-y-6 pb-24 rtl" dir="rtl">
        <Suspense fallback={
          <div className="bg-card border rounded-3xl p-16 flex flex-col items-center justify-center min-h-[400px]">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground font-bold text-sm">جارٍ تحميل مرصد الأوراد البصري...</p>
          </div>
        }>
          <VisualProgress />
        </Suspense>
      </div>
    </ProtectedPage>
  );
}
