"use client";

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Loading component for better UX
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">جاري التحميل...</p>
    </div>
  </div>
);

// Dynamic imports for heavy components to reduce initial bundle size
const AuthProvider = dynamic(
  () => import('@/context/AuthContext').then(mod => ({ default: mod.AuthProvider })),
  { ssr: false }
);

const StudentProvider = dynamic(
  () => import('@/context/StudentContext').then(mod => ({ default: mod.StudentProvider })),
  { ssr: false }
);

const ClientLayout = dynamic(
  () => import('./ClientLayout').then(mod => ({ default: mod.ClientLayout })),
  {
    ssr: false,
    loading: () => <LoadingFallback />
  }
);

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AuthProvider>
        <StudentProvider>
          <ClientLayout>{children}</ClientLayout>
        </StudentProvider>
      </AuthProvider>
    </Suspense>
  );
}
