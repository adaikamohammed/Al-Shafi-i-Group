
"use client";

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { StudentProvider } from '@/context/StudentContext';
import { ClientLayout } from './ClientLayout';

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <StudentProvider>
        <ClientLayout>{children}</ClientLayout>
      </StudentProvider>
    </AuthProvider>
  );
}
