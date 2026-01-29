"use client";

import { useEffect, useState } from 'react';
import { useFCM } from '@/hooks/useFCM';
import { useAuth } from '@/context/AuthContext';
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { Bell } from 'lucide-react';

export const NotificationPrompter = () => {
    const { permission, requestPermission } = useFCM();
    const { user } = useAuth();
    const { toast } = useToast();
    const [hasPrompted, setHasPrompted] = useState(false);

    useEffect(() => {
        // Only prompt if user is logged in, permission is default (not yet asked), and we haven't prompted this session
        if (user && permission === 'default' && !hasPrompted) {
            // We use a slight delay to not overwhelm the user immediately on load
            const timer = setTimeout(() => {
                toast({
                    title: "تفعيل الإشعارات",
                    description: "هل ترغب في استقبال إشعارات وتحديثات من المدرسة؟",
                    action: (
                        <ToastAction altText="تفعيل" onClick={requestPermission} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            <Bell className="mr-2 h-4 w-4" /> تفعيل
                        </ToastAction>
                    ),
                    duration: 10000,
                });
                setHasPrompted(true);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [user, permission, hasPrompted, toast, requestPermission]);

    return null; // This component handles side-effects only (rendering toast)
};
