"use client";

import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFCM } from '@/hooks/useFCM';
import { useAuth } from '@/context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';

export function NotificationRegister() {
    const { user } = useAuth();
    const { permission, requestPermission } = useFCM();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        // Show banner only for logged in users who haven't decided on permissions yet
        if (user && permission === 'default') {
            const timer = setTimeout(() => {
                setShowBanner(true);
            }, 3000); // delay showing it slightly for a smoother entry
            return () => clearTimeout(timer);
        } else {
            setShowBanner(false);
        }
    }, [user, permission]);

    const handleEnable = async () => {
        await requestPermission();
        setShowBanner(false);
    };

    if (!showBanner) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -50, opacity: 0 }}
                className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-white/10 p-4 rounded-2xl shadow-xl z-50 flex flex-col gap-3"
            >
                <div className="flex items-start gap-3">
                    <div className="bg-primary/10 dark:bg-primary/20 p-2 rounded-xl text-primary shrink-0">
                        <Bell className="h-5 w-5 animate-bounce-subtle" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold font-headline text-slate-900 dark:text-white">تفعيل إشعارات الجهاز</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed font-body">
                            احصل على تنبيهات فورية عند غياب الطلاب المتكرر، تراجع الحفظ، أو صدور التقارير الأسبوعية.
                        </p>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setShowBanner(false)}
                        className="h-6 w-6 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowBanner(false)}
                        className="text-[10px] h-8 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"
                    >
                        لاحقاً
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleEnable}
                        className="text-[10px] h-8 font-bold bg-primary hover:bg-primary/90 text-white rounded-xl px-4"
                    >
                        تفعيل الآن
                    </Button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
