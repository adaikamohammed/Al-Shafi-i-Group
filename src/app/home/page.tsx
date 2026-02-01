"use client";

import { ManagementDashboard } from '@/components/management/ManagementDashboard';
import { ProtectedPage } from '@/components/ui/ProtectedPage';

export default function HomePage() {
    return (
        <ProtectedPage>
            <ManagementDashboard />
        </ProtectedPage>
    );
}
