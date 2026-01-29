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

                // Try retrieving token without explicit VAPID key first (relying on implicit config)
                try {
                    const currentToken = await getToken(msg);
                    if (currentToken) {
                        setToken(currentToken);
                        // Save token to user profile
                        const userRef = ref(db, `users/${user.uid}/fcmTokens`);
                        await update(ref(db, `users/${user.uid}`), {
                            fcmTokens: arrayUnion(currentToken)
                        });

                        toast({
                            title: "تم تفعيل الإشعارات",
                            description: "ستتلقى الآن تنبيهات من المدرسة.",
                            className: "bg-green-600 text-white border-none"
                        });
                    } else {
                        console.log('No registration token available. Request permission to generate one.');
                    }
                } catch (err) {
                    console.error('An error occurred while retrieving token. ', err);
                    // If the error is related to missing VAPID key, checking console might be needed.
                    // But usually modern firebase config handles it if "Web Push Certificate" is generated in console.
                    toast({
                        title: "خطأ في الإعداد",
                        description: "يرجى التأكد من إعداد Web Push Certificate في لوحة تحكم فايربيس.",
                        variant: "destructive"
                    });
                }
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
