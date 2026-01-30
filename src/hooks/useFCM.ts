import { useEffect, useState } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { useAuth } from '@/context/AuthContext';
import { ref, update, get, remove } from 'firebase/database';
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
                // Ensure service worker is registered and active
                if (!('serviceWorker' in navigator)) {
                    console.error("Service Worker not supported.");
                    toast({
                        title: "خطأ",
                        description: "المتصفح لا يدعم الإشعارات.",
                        variant: "destructive"
                    });
                    return;
                }

                // Register service worker if not already registered
                let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
                if (!registration) {
                    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    console.log('Firebase Messaging SW registered:', registration);
                }

                // Wait for service worker to be active
                if (registration.installing) {
                    await new Promise((resolve) => {
                        registration!.installing!.addEventListener('statechange', (e) => {
                            if ((e.target as ServiceWorker).state === 'activated') {
                                resolve(true);
                            }
                        });
                    });
                } else if (registration.waiting) {
                    await new Promise((resolve) => {
                        registration!.waiting!.addEventListener('statechange', (e) => {
                            if ((e.target as ServiceWorker).state === 'activated') {
                                resolve(true);
                            }
                        });
                    });
                }

                const msg = await messaging;
                if (!msg) {
                    console.error("Messaging not supported.");
                    return;
                }

                // Try retrieving token with the service worker registration
                try {
                    const currentToken = await getToken(msg, {
                        serviceWorkerRegistration: registration
                    });
                    if (currentToken) {
                        setToken(currentToken);

                        // Save token to user profile (with error handling)
                        try {
                            const userRef = ref(db, `users/${user.uid}/profile`);
                            const snapshot = await get(userRef);
                            const profile = snapshot.val() || {};
                            const currentTokens = profile.fcmTokens || [];

                            if (!currentTokens.includes(currentToken)) {
                                await update(userRef, {
                                    fcmTokens: [...currentTokens, currentToken]
                                });
                            }
                        } catch (dbError: any) {
                            console.error('Failed to save FCM token to database:', dbError);
                            // Don't show error to user - token is still valid locally
                            // This might happen if database rules are not properly configured
                        }

                        toast({
                            title: "تم تفعيل الإشعارات",
                            description: "ستتلقى الآن تنبيهات من المدرسة.",
                            className: "bg-green-600 text-white border-none"
                        });
                    } else {
                        console.log('No registration token available. Request permission to generate one.');
                    }
                } catch (err: any) {
                    console.error('An error occurred while retrieving token. ', err);

                    // Check if it's a permission error
                    if (err?.code === 'messaging/permission-blocked' || err?.message?.includes('permission')) {
                        toast({
                            title: "خطأ في الصلاحيات",
                            description: "يرجى التحقق من إعدادات الإشعارات في المتصفح.",
                            variant: "destructive"
                        });
                    } else {
                        toast({
                            title: "خطأ في الإعداد",
                            description: "يرجى التأكد من إعداد Web Push Certificate في لوحة تحكم فايربيس.",
                            variant: "destructive"
                        });
                    }
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
