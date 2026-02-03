"use client";

import React from 'react';
import { motion } from 'framer-motion';
import PublicNavbar from '@/components/public/PublicNavbar';
import Footer from '@/components/public/Footer';
import {
    Construction,
    HeartHandshake,
    Users,
    Sparkles,
    ArrowLeft,
    Target,
    Zap,
    ShieldCheck,
    Milestone,
    Lightbulb,
    Gem
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function FutureVisionPage() {
    const fadeIn = {
        initial: { opacity: 0, y: 30 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true },
        transition: { duration: 0.8 }
    };

    return (
        <div className="min-h-screen bg-[#fafaf9]" dir="rtl">
            <PublicNavbar />

            <main>
                {/* Hero Section */}
                <section className="relative h-[85vh] flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 z-0">
                        <img
                            src="/future-expansion.png"
                            alt="Concept Expansion"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-[#fafaf9]" />
                    </div>

                    <div className="container mx-auto px-4 relative z-10 text-center">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1 }}
                        >
                            <span className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm mb-6 backdrop-blur-md border border-emerald-500/30">
                                <Sparkles className="w-4 h-4" />
                                رؤية 2030 للمدرسة القرآنية
                            </span>
                            <h1 className="text-5xl md:text-7xl font-black text-white mb-8 font-headline leading-tight drop-shadow-2xl">
                                نبني <span className="text-emerald-400">مستقبلاً</span> يليق <br />بأهل القرآن
                            </h1>
                            <p className="text-xl text-slate-100 max-w-3xl mx-auto font-medium leading-relaxed mb-10 drop-shadow-lg">
                                لأن مدرسة الشافعي ليست مجرد مكان للحفظ، بل هي صرح تربوي ينمو ليحتضن أحلام أبنائنا في بيئة عصرية تحفظ عبق الأصالة.
                            </p>
                            <div className="flex flex-wrap justify-center gap-4">
                                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-7 text-lg font-bold rounded-2xl shadow-xl shadow-emerald-900/20 transition-all hover:scale-105">
                                    ساهم في البناء
                                    <HeartHandshake className="mr-2 h-6 w-6" />
                                </Button>
                                <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/20 text-white hover:bg-white/20 px-8 py-7 text-lg font-bold rounded-2xl transition-all">
                                    اكتشف الرؤية
                                    <ArrowLeft className="mr-2 h-6 w-6" />
                                </Button>
                            </div>
                        </motion.div>
                    </div>

                    {/* Scroll Indicator */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
                        <div className="w-8 h-12 rounded-full border-2 border-white/30 flex justify-center p-2">
                            <div className="w-1 h-3 bg-white rounded-full" />
                        </div>
                    </div>
                </section>

                {/* The Need for Change */}
                <section className="py-24 relative overflow-hidden">
                    <div className="container mx-auto px-4">
                        <div className="grid lg:grid-cols-2 gap-16 items-center">
                            <motion.div {...fadeIn}>
                                <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-rose-100 text-rose-600 font-black text-sm mb-6">
                                    <Target className="w-4 h-4" />
                                    لماذا الآن؟
                                </div>
                                <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-8 font-headline">
                                    تحديات الأمس <span className="text-rose-500">وقود</span> الغد
                                </h2>
                                <div className="space-y-6">
                                    {[
                                        {
                                            title: "الضغط المتزايد",
                                            desc: "نواجه طلبات تسجيل متزايدة تفوق القدرة الاستيعابية الحالية للمدرسة.",
                                            icon: Users,
                                            color: "text-blue-500",
                                            bg: "bg-blue-50"
                                        },
                                        {
                                            title: "محدودية القاعات",
                                            desc: "نسعى لتوفير مساحات تعليمية أوسع ومؤهلة لاستقبال الطلاب في أحسن الظروف.",
                                            icon: Construction,
                                            color: "text-amber-500",
                                            bg: "bg-amber-50"
                                        },
                                        {
                                            title: "العصرنة والرقمنة",
                                            desc: "هدفنا هو إعادة تصميم الهيكل المعماري للمدرسة لتوفير بيئة تعليمية عصرية.",
                                            icon: Zap,
                                            color: "text-purple-500",
                                            bg: "bg-purple-50"
                                        }
                                    ].map((item, i) => (
                                        <div key={i} className="flex gap-6 p-6 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm transition-hover hover:shadow-md group">
                                            <div className={`${item.bg} ${item.color} w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110`}>
                                                <item.icon className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-slate-900 mb-2">{item.title}</h3>
                                                <p className="text-slate-600 leading-relaxed font-medium">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>

                            <motion.div
                                {...fadeIn}
                                transition={{ delay: 0.3 }}
                                className="relative"
                            >
                                <div className="absolute -inset-4 bg-emerald-500 rounded-[4rem] rotate-3 opacity-10" />
                                <div className="relative bg-white p-8 rounded-[3.5rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
                                    <img
                                        src="/future-expansion.png"
                                        alt="Modern Design"
                                        className="w-full h-80 object-cover rounded-[2.5rem] mb-8"
                                    />
                                    <blockquote className="text-2xl font-black text-slate-800 leading-normal italic text-right mb-6">
                                        "إننا نخطط لمدرسة لا تخرج حفاظاً للقرآن فحسب، بل أجيالاً قادرة على قيادة المستقبل بقيم الوحي المشرقة."
                                    </blockquote>
                                    <div className="flex items-center gap-4 justify-end">
                                        <div className="text-right">
                                            <div className="font-black text-slate-900">إدارة مدرسة الشافعي</div>
                                            <div className="text-sm text-slate-500">رؤية التطوير 2026</div>
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                                            <ShieldCheck className="text-emerald-600 w-6 h-6" />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* Expansion Pillars */}
                <section className="py-24 bg-slate-900 text-white relative">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-20">
                            <motion.div {...fadeIn}>
                                <h2 className="text-4xl md:text-5xl font-black mb-6 font-headline">محاور مشروع <span className="text-emerald-400">التوسعة</span></h2>
                                <p className="text-slate-400 max-w-2xl mx-auto text-lg leading-relaxed">خطتنا المتكاملة لرفع الكفاءة التشغيلية والجمالية للمدرسة</p>
                            </motion.div>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                {
                                    title: "توسيع القدرة الاستيعابية",
                                    icon: Milestone,
                                    points: [
                                        "بناء قاعات تعليمية إضافية",
                                        "تحسين استغلال المساحات المتاحة",
                                        "تجهيز مرافق لاستقبال فئات أكثر"
                                    ],
                                    color: "from-blue-500 to-indigo-600"
                                },
                                {
                                    title: "عصرنة المرافق",
                                    icon: Lightbulb,
                                    points: [
                                        "تجهيز ذكي لجميع القاعات",
                                        "مختبر تعليمي رقمي",
                                        "نظام تكييف وتدفئة مركزي"
                                    ],
                                    color: "from-emerald-500 to-teal-600"
                                },
                                {
                                    title: "التصميم والجمالية",
                                    icon: Gem,
                                    points: [
                                        "واجهة معمارية إسلامية حديثة",
                                        "مساحات خضراء وفناء تعليمي",
                                        "نظام إضاءة طبيعية مبتكر"
                                    ],
                                    color: "from-amber-500 to-orange-600"
                                }
                            ].map((pillar, i) => (
                                <motion.div
                                    key={i}
                                    {...fadeIn}
                                    transition={{ delay: i * 0.2 }}
                                    className="relative group p-8 rounded-[3rem] bg-slate-800/50 border border-slate-700 hover:bg-slate-800 transition-all overflow-hidden"
                                >
                                    <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${pillar.color} opacity-10 group-hover:opacity-20 transition-opacity rounded-bl-[100px]`} />
                                    <pillar.icon className="w-12 h-12 text-emerald-400 mb-6" />
                                    <h3 className="text-2xl font-black mb-6">{pillar.title}</h3>
                                    <ul className="space-y-4">
                                        {pillar.points.map((point, j) => (
                                            <li key={j} className="flex items-center gap-3 text-slate-300 font-medium">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Contribution Section */}
                <section className="py-24 relative">
                    <div className="container mx-auto px-4">
                        <div className="max-w-5xl mx-auto rounded-[4rem] overflow-hidden shadow-2xl border border-white relative">
                            <div className="absolute inset-0 z-0">
                                <div className="absolute inset-0 bg-emerald-700 opacity-95" />
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/islamic-art.png')] opacity-10" />
                            </div>

                            <div className="relative z-10 p-12 md:p-20 text-center text-white">
                                <motion.div {...fadeIn}>
                                    <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8 backdrop-blur-md">
                                        <HeartHandshake className="w-12 h-12 text-emerald-300" />
                                    </div>
                                    <h2 className="text-4xl md:text-6xl font-black mb-8 font-headline leading-tight">
                                        ضع بصرُنا <span className="text-white">فيما</span> ترجو <br />أثره في <span className="text-emerald-300">ميزانك</span>
                                    </h2>
                                    <p className="text-xl text-emerald-50/80 max-w-3xl mx-auto font-medium leading-relaxed mb-12">
                                        كل لبنة تضاف، وكل قاعة تبنى، هي صدقة جارية يتردد فيها صدى حرفٍ من كتاب الله آناء الليل وأطراف النهار. ساهم معنا في إتمام هذا الصرح المبارك.
                                    </p>

                                    <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                                        <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 text-right">
                                            <h4 className="text-emerald-300 font-black mb-4 flex items-center gap-2 justify-end">
                                                معلومات الدعم المادي
                                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                            </h4>
                                            <p className="text-white/90 leading-relaxed font-medium">
                                                يمكنكم تقديم مساهماتكم مباشرة في مقر المدرسة القرانية بمسجد الإمام الشافعي، أو عبر التواصل مع أعضاء اللجنة الدينية.
                                            </p>
                                        </div>
                                        <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/20 text-right">
                                            <h4 className="text-emerald-300 font-black mb-4 flex items-center gap-2 justify-end">
                                                التواصل المباشر
                                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                            </h4>
                                            <p className="text-white/90 leading-relaxed font-bold text-xl">
                                                06XX XX XX XX
                                                <br />
                                                05XX XX XX XX
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-12 pt-12 border-t border-white/10 italic text-emerald-200/60 font-medium">
                                        "إن الله في عون العبد ما كان العبد في عون أخيه" - حديث شريف
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
