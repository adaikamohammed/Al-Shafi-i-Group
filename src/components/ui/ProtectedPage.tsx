'use client';

import { useAuth } from '@/context/AuthContext';
import { canAccessPage } from '@/lib/permissions';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export const ProtectedPage = ({ children }: { children: React.ReactNode }) => {
    const { role, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !canAccessPage(pathname, role)) {
            router.push('/sessions');
        }
    }, [role, loading, pathname, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (!canAccessPage(pathname, role)) {
        return null;
    }

    return <>{children}</>;
};
