"use client";

import React, { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button'; // Adjusted path if necessary
import { AnimatePresence, motion } from 'framer-motion';

export function NotificationPrompter() {
    const [showPrompt, setShowPrompt] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    useEffect(() => {
        // Prevent showing the prompt if user previously dismissed it
        const isDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';
        if (isDismissed) return;

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowPrompt(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            localStorage.setItem('pwa-install-dismissed', 'true');
        }
        setShowPrompt(false);
    };

    const handleDismiss = () => {
        localStorage.setItem('pwa-install-dismissed', 'true');
        setShowPrompt(false);
    };

    if (!showPrompt) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-primary text-primary-foreground p-4 rounded-xl shadow-2xl z-50 flex items-center justify-between gap-4"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Download className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="font-bold text-sm">تثبيت التطبيق</p>
                        <p className="text-xs opacity-90">ثبت التطبيق للوصول السريع</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={handleInstallClick} className="font-bold">
                        تثبيت
                    </Button>
                    <Button size="icon" variant="ghost" onClick={handleDismiss} className="hover:bg-white/20 text-white">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
