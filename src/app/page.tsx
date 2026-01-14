"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const StudentManagementPage = dynamic(() => import('@/components/student-management'), {
  ssr: false,
  loading: () => <div className="flex h-[calc(100vh-200px)] w-full items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>,
});

export default function Page() {
  return <StudentManagementPage />;
}
