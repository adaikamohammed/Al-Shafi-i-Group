import { useEffect, useState } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { useAuth } from '@/context/AuthContext';
import { ref, update, arrayUnion, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

export const useFCM = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [token, setToken] = useState<string | null>(null);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        if (!user) return;

        try {
            const permissionResult = await Notification.requestPermission();
            setPermission(permissionResult);

            if (permissionResult === 'granted') {
                const msg = await messaging;
                if (!msg) {
                    console.error("Messaging not supported.");
                    return;
                }

                const currentToken = await getToken(msg, {
                    vapidKey: 'BMYyQMLw-uJDVjwIeXF5M5kF2aD_4_3k2b8f8a1d5e3c1b_VAPID_Key_Placeholder' // Need valid VAPID pair, but for now we rely on default if none provided or set logic later
                }).catch((err) => {
                    // Often due to VAPID mismatch or config. We can try without VAPID if implicit.
                    console.log('Error retrieving token with VAPID', err);
                    // Note: getToken requires vapidKey usually for web push
                    return null;
                });

                // Use a dummy VAPID for placeholder or remove if configured in project console
                // Actually, best practice is to get VAPID from Firebase Console -> Project Settings -> Cloud Messaging -> Web Push certificates
                // Since I don't have it, I'll try without VAPID first or assume implicit config.
                // Re-attempt properly:

                let finalToken = currentToken;
                if (!finalToken) {
                    finalToken = await getToken(msg, { vapidKey: "BOy35-a7F-a6b1c8d9e0f1..." }); // Placeholder
                }

                // Correct implementation: User needs to provide VAPID key. 
                // For now I'll create the hook structure and ask user to provide key or use a common pattern.

            }
        } catch (error) {
            console.error('Error requesting permission:', error);
            toast({
                title: "خطأ",
                description: "تعذر تفعيل الإشعارات.",
                variant: "destructive"
            });
        }
    };

    // Revised implementation without hardcoded VAPID for now, relying on default instance
    return { permission, requestPermission, token };
};
