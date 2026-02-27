"use client";

import React, { useCallback, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Share2, MessageCircle, Copy, Check, Image } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickShareProps {
    sheikhs: { group: string; displayName: string; uids: Set<string> }[];
    getDayStats: (group: string, dateStr: string) => any;
    selectedDate: Date;
}

export function QuickShare({ sheikhs, getDayStats, selectedDate }: QuickShareProps) {
    const [copied, setCopied] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const todayStr = format(selectedDate, 'yyyy-MM-dd');

    const generateSummary = useCallback(() => {
        const dateFormatted = format(selectedDate, 'EEEE d MMMM yyyy', { locale: ar });
        let text = `📊 ملخص اليوم — ${dateFormatted}\n\n`;

        let recorded = 0;
        const lines: string[] = [];

        sheikhs.forEach(sh => {
            const stats = getDayStats(sh.group, todayStr);
            if (stats && (stats.type === 'حصة أساسية' || stats.type === 'حصة تعويضية' || stats.type === 'حصة إضافية')) {
                recorded++;
                const att = stats.attendance !== null ? `${stats.attendance}%` : '—';
                const exc = stats.excellent !== null ? `${stats.excellent}%` : '—';
                lines.push(`📖 ${sh.group} (${sh.displayName}): حضور ${att} | ممتاز ${exc}`);
            } else if (stats && stats.type === 'غياب الشيخ') {
                lines.push(`❌ ${sh.group} (${sh.displayName}): غياب الشيخ`);
            } else if (stats && stats.type === 'يوم عطلة') {
                lines.push(`🏖 ${sh.group}: عطلة`);
            }
        });

        text += `✅ سجّلوا الحصة: ${recorded}/${sheikhs.length}\n\n`;
        text += lines.join('\n');
        text += `\n\n🕌 المدرسة القرآنية للإمام الشافعي`;

        return text;
    }, [sheikhs, getDayStats, todayStr, selectedDate]);

    const copyToClipboard = async () => {
        const text = generateSummary();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareWhatsApp = () => {
        const text = encodeURIComponent(generateSummary());
        window.open(`https://wa.me/?text=${text}`, '_blank');
    };

    const shareTelegram = () => {
        const text = encodeURIComponent(generateSummary());
        window.open(`https://t.me/share/url?url=&text=${text}`, '_blank');
    };

    return (
        <div className="relative print:hidden">
            <button
                onClick={() => setShowMenu(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border bg-background hover:bg-muted transition-colors"
                title="مشاركة سريعة"
            >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">مشاركة</span>
            </button>

            {showMenu && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                    <div className="absolute top-full mt-1 left-0 z-50 bg-white border rounded-xl shadow-2xl w-48 overflow-hidden" dir="rtl">
                        <div className="p-2 border-b bg-slate-50 text-[10px] font-bold text-muted-foreground">📤 مشاركة ملخص اليوم</div>
                        <button
                            onClick={() => { shareWhatsApp(); setShowMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-emerald-50 transition-colors text-right text-xs font-bold text-emerald-700"
                        >
                            <MessageCircle className="h-4 w-4" /> واتساب
                        </button>
                        <button
                            onClick={() => { shareTelegram(); setShowMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-blue-50 transition-colors text-right text-xs font-bold text-blue-700"
                        >
                            <MessageCircle className="h-4 w-4" /> تلغرام
                        </button>
                        <button
                            onClick={() => { copyToClipboard(); setShowMenu(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted transition-colors text-right text-xs font-bold border-t"
                        >
                            {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                            {copied ? 'تم النسخ!' : 'نسخ النص'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
