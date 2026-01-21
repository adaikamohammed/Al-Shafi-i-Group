"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoonStar, BookOpen, Quote, ChevronLeft, Calendar, Flag, Star, ScrollText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ISLAMIC_OCCASIONS, Occasion } from '@/lib/occasionsData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';

export default function OccasionsPage() {
    const { user } = useAuth();
    const [selectedYear, setSelectedYear] = useState<string>('2026');
    const [selectedOccasion, setSelectedOccasion] = useState<Occasion | null>(null);
    const [activeTab, setActiveTab] = useState<'religious' | 'holiday'>('religious');

    const currentThemeId = user?.portalTheme || 'midnight';
    const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

    // Filter by year and type
    const filteredOccasions = useMemo(() => {
        return ISLAMIC_OCCASIONS.filter(o => o.type === activeTab && o.dates[selectedYear]);
    }, [activeTab, selectedYear]);

    return (
        <div dir="rtl" className="container mx-auto max-w-7xl py-8 space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-4">
                <div className="text-center md:text-right space-y-2">
                    <h1 className={cn(
                        "text-4xl md:text-6xl font-headline font-black flex items-center justify-center md:justify-start gap-4",
                        theme.isLight ? "text-slate-900" : "text-white"
                    )}>
                        <div className={cn(
                            "p-3 rounded-3xl shadow-lg",
                            theme.isLight ? "bg-primary text-white" : "bg-emerald-500 text-white"
                        )}>
                            <MoonStar className="h-10 w-10" />
                        </div>
                        المناسبات والتقويم
                    </h1>
                    <p className={cn(
                        "text-lg opacity-70 max-w-2xl font-body",
                        theme.isLight ? "text-slate-600" : "text-white/60"
                    )}>
                        بوابتك الروحانية لتتبع أهم المحطات الإيمانية والوطنية عبر العام.
                    </p>
                </div>

                <div className={cn(
                    "flex items-center gap-3 p-2 rounded-3xl border backdrop-blur-xl shadow-2xl",
                    theme.isLight ? "bg-white/80 border-slate-200" : "bg-white/5 border-white/10"
                )}>
                    <span className="text-sm font-black px-4 opacity-70">سنة العرض:</span>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[140px] h-12 rounded-2xl font-black bg-primary/5 border-none focus:ring-2 focus:ring-primary/20">
                            <SelectValue placeholder="السنة" />
                        </SelectTrigger>
                        <SelectContent className={cn("rounded-2xl border shadow-2xl", theme.isLight ? "bg-white text-slate-900" : "bg-slate-900 text-white border-white/10")}>
                            <SelectItem value="2025" className="cursor-pointer font-bold py-3">2025 ميلادي</SelectItem>
                            <SelectItem value="2026" className="cursor-pointer font-bold py-3">2026 ميلادي</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Filter Tabs */}
            <Tabs defaultValue="religious" className="w-full" onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className={cn(
                    "p-1.5 rounded-full h-16 w-full max-w-md mx-auto grid grid-cols-2 shadow-inner",
                    theme.isLight ? "bg-slate-100" : "bg-white/5"
                )}>
                    <TabsTrigger value="religious" className="rounded-full h-full data-[state=active]:bg-white data-[state=active]:shadow-lg font-black text-lg transition-all gap-2">
                        <Star className="h-5 w-5 text-amber-500" />
                        مناسبات دينية
                    </TabsTrigger>
                    <TabsTrigger value="holiday" className="rounded-full h-full data-[state=active]:bg-white data-[state=active]:shadow-lg font-black text-lg transition-all gap-2">
                        <Flag className="h-5 w-5 text-rose-500" />
                        عطل سنوية
                    </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <AnimatePresence mode="popLayout">
                            {filteredOccasions.map((occasion, idx) => (
                                <motion.div
                                    key={occasion.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                                >
                                    <Card
                                        onClick={() => setSelectedOccasion(occasion)}
                                        className={cn(
                                            "border-none shadow-xl h-full cursor-pointer transition-all duration-500 hover:scale-[1.03] hover:shadow-2xl overflow-hidden group relative backdrop-blur-2xl rounded-[2.5rem]",
                                            theme.isLight ? "bg-white border border-slate-100 hover:bg-slate-50/50" : "bg-white/5 hover:bg-white/10"
                                        )}>

                                        {/* Colored Glow */}
                                        <div className={cn(
                                            "absolute -top-24 -right-24 w-48 h-48 blur-3xl opacity-10 group-hover:opacity-20 transition-opacity",
                                            activeTab === 'religious' ? "bg-amber-500" : "bg-rose-500"
                                        )} />

                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className={cn(
                                                    "p-4 rounded-3xl transition-all duration-500 group-hover:shadow-lg",
                                                    theme.isLight
                                                        ? activeTab === 'religious' ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                                                        : activeTab === 'religious' ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"
                                                )}>
                                                    {activeTab === 'religious' ? <MoonStar className="h-7 w-7" /> : <Flag className="h-7 w-7" />}
                                                </div>
                                                <div className={cn(
                                                    "px-4 py-1.5 rounded-full text-xs font-black tracking-widest uppercase",
                                                    theme.isLight ? "bg-slate-100 text-slate-500" : "bg-black/40 text-white/40"
                                                )}>
                                                    {selectedYear}
                                                </div>
                                            </div>
                                            <CardTitle className={cn("text-2xl font-headline font-black leading-tight", theme.isLight ? "text-slate-900" : "text-white")}>
                                                {occasion.title}
                                            </CardTitle>
                                            <CardDescription className={cn("text-base line-clamp-2 leading-relaxed mt-2", theme.isLight ? "text-slate-500" : "text-white/50")}>
                                                {occasion.description}
                                            </CardDescription>
                                        </CardHeader>

                                        <CardContent className="space-y-6 pt-4">
                                            <div className={cn(
                                                "p-5 rounded-[1.5rem] border space-y-3 transition-colors",
                                                theme.isLight ? "bg-slate-50 border-slate-100 group-hover:bg-white" : "bg-black/30 border-white/5"
                                            )}>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-xs font-black opacity-40 uppercase tracking-tighter shrink-0">التقويم الهجري</span>
                                                    <span className={cn("font-black text-sm text-left truncate", theme.isLight ? "text-primary" : "text-emerald-400")}>
                                                        {occasion.dates[selectedYear].hijri}
                                                    </span>
                                                </div>
                                                <div className="w-full h-px opacity-5 bg-current" />
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-xs font-black opacity-40 uppercase tracking-tighter shrink-0">التاريخ الميلادي</span>
                                                    <span className="font-black text-sm opacity-80 text-left truncate">
                                                        {occasion.dates[selectedYear].gregorian}
                                                    </span>
                                                </div>
                                            </div>

                                            <Button
                                                className={cn(
                                                    "w-full h-14 rounded-2xl gap-3 font-black text-lg transition-all group-hover:gap-5 shadow-lg",
                                                    theme.isLight ? "bg-slate-900 text-white hover:bg-black" : "bg-white text-slate-900 hover:bg-slate-100"
                                                )}
                                            >
                                                <span>التفاصيل والأدلة</span>
                                                <ChevronLeft className="h-5 w-5" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Detail Modal */}
            <Dialog open={!!selectedOccasion} onOpenChange={(open) => !open && setSelectedOccasion(null)}>
                <DialogContent dir="rtl" className={cn(
                    "max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 border-none rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.2)]",
                    theme.isLight ? "bg-white" : "bg-slate-950 border border-white/10"
                )}>
                    {selectedOccasion && (
                        <>
                            <DialogHeader className={cn(
                                "p-10 pb-6 border-b sticky top-0 z-20 backdrop-blur-3xl",
                                theme.isLight ? "bg-white/80 border-slate-100" : "bg-slate-950/80 border-white/5"
                            )}>
                                <DialogTitle className={cn(
                                    "text-3xl md:text-4xl font-headline font-black flex items-center gap-5",
                                    theme.isLight ? "text-primary" : "text-emerald-400"
                                )}>
                                    <div className={cn(
                                        "p-3 rounded-2xl shadow-inner",
                                        theme.isLight ? "bg-primary/10" : "bg-emerald-500/10"
                                    )}>
                                        <MoonStar className="h-8 w-8" />
                                    </div>
                                    {selectedOccasion.title}
                                </DialogTitle>
                                <DialogDescription className="text-xl pt-4 opacity-80 leading-relaxed font-body">
                                    {selectedOccasion.description}
                                </DialogDescription>
                            </DialogHeader>

                            <ScrollArea className="flex-1 overflow-y-auto">
                                <div className="p-10 space-y-12 pb-24">
                                    {/* Detailed Dates Card */}
                                    <div className={cn(
                                        "grid grid-cols-1 sm:grid-cols-2 gap-6 p-8 rounded-[2rem] border relative overflow-hidden",
                                        theme.isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                                    )}>
                                        <div className="absolute top-0 left-0 p-4 opacity-5">
                                            <Calendar className="h-24 w-24" />
                                        </div>
                                        <div className="text-center sm:text-start space-y-2 border-e border-current/10 pe-6">
                                            <span className="text-xs font-black opacity-40 uppercase tracking-widest block">يوافق بالهجري</span>
                                            <span className={cn("text-2xl font-black", theme.isLight ? "text-primary" : "text-emerald-400")}>
                                                {selectedOccasion.dates[selectedYear].hijri}
                                            </span>
                                        </div>
                                        <div className="text-center sm:text-start space-y-2 ps-6">
                                            <span className="text-xs font-black opacity-40 uppercase tracking-widest block">يوافق بالميلادي</span>
                                            <span className="text-2xl font-black opacity-90">
                                                {selectedOccasion.dates[selectedYear].gregorian}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Quran Section */}
                                    {selectedOccasion.quran && (
                                        <div className="space-y-6">
                                            <h3 className="flex items-center gap-3 text-2xl font-black opacity-90">
                                                <BookOpen className="h-7 w-7 text-amber-500" />
                                                من آيات الذكر الحكيم
                                            </h3>
                                            {selectedOccasion.quran.map((q, i) => (
                                                <div key={i} className={cn(
                                                    "p-10 rounded-[2.5rem] relative shadow-inner overflow-hidden",
                                                    theme.isLight ? "bg-amber-50 border-2 border-amber-100 shadow-amber-200/20" : "bg-amber-500/10 border border-amber-500/20"
                                                )}>
                                                    <Quote className="absolute top-6 left-8 h-12 w-12 opacity-5" />
                                                    <p className={cn(
                                                        "text-2xl md:text-3xl font-headline font-black text-center leading-[1.8] quran-text relative z-10 mb-6",
                                                        theme.isLight ? "text-amber-900" : "text-amber-100"
                                                    )}>
                                                        {q.text}
                                                    </p>
                                                    <div className="text-center">
                                                        <span className={cn("px-6 py-2 rounded-full font-black text-sm", theme.isLight ? "bg-white shadow-sm text-amber-700" : "bg-amber-500/20 text-amber-300")}>
                                                            {q.source}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Hadith Section */}
                                    {selectedOccasion.hadith && (
                                        <div className="space-y-6">
                                            <h3 className="flex items-center gap-3 text-2xl font-black opacity-90">
                                                <ScrollText className="h-7 w-7 text-emerald-500" />
                                                من هدي النبوة
                                            </h3>
                                            <div className="space-y-4">
                                                {selectedOccasion.hadith.map((h, i) => (
                                                    <div key={i} className={cn(
                                                        "p-8 rounded-[2rem] border-e-8 shadow-sm transition-transform hover:-translate-x-1",
                                                        theme.isLight ? "bg-emerald-50/50 border-emerald-500" : "bg-emerald-500/5 border-emerald-500"
                                                    )}>
                                                        <p className="text-xl leading-relaxed font-bold opacity-90 mb-4 pl-2">
                                                            "{h.text}"
                                                        </p>
                                                        <div className="flex justify-end">
                                                            <span className={cn("text-xs font-black px-4 py-1 rounded-full", theme.isLight ? "bg-emerald-100 text-emerald-800" : "bg-emerald-500/20 text-emerald-400")}>
                                                                {h.source}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quotes Section (Sahaba & Scholars) */}
                                    {selectedOccasion.quotes && (
                                        <div className="space-y-6">
                                            <h3 className="flex items-center gap-3 text-2xl font-black opacity-90">
                                                <Quote className="h-7 w-7 text-indigo-500" />
                                                أقوال الصحابة والعلماء
                                            </h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                {selectedOccasion.quotes.map((q, i) => (
                                                    <div key={i} className={cn(
                                                        "p-6 rounded-[1.8rem] border shadow-sm relative",
                                                        theme.isLight ? "bg-indigo-50/30 border-indigo-100" : "bg-indigo-500/5 border-white/5"
                                                    )}>
                                                        <p className="text-lg leading-relaxed font-medium opacity-90 mb-4 pr-1">
                                                            {q.text}
                                                        </p>
                                                        <span className={cn(
                                                            "text-sm font-black flex items-center gap-2",
                                                            theme.isLight ? "text-indigo-600" : "text-indigo-400"
                                                        )}>
                                                            <div className="w-6 h-px bg-current opacity-30" />
                                                            {q.author}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Virtues Section */}
                                    {selectedOccasion.virtues && (
                                        <div className="space-y-4">
                                            <h3 className="flex items-center gap-3 text-2xl font-black opacity-90">
                                                <Star className="h-7 w-7 text-amber-500 fill-amber-500" />
                                                الفضائل والمستحبات
                                            </h3>
                                            <div className={cn(
                                                "p-8 rounded-[2rem] border-2 border-dashed leading-loose text-lg font-bold",
                                                theme.isLight ? "bg-amber-50/30 border-amber-200 text-slate-800" : "bg-white/5 border-white/10 text-white/90"
                                            )}>
                                                {selectedOccasion.virtues}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
