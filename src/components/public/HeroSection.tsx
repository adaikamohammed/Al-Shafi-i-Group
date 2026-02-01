"use client";

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, Star } from 'lucide-react';
import Image from 'next/image';

export default function HeroSection() {
    return (
        <div className="relative min-h-[90vh] flex items-center pt-20 overflow-hidden bg-[#fafafa]">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-[0.03]"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
            />

            <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-12 items-center relative z-10">
                {/* Text Content */}
                <motion.div
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-right space-y-8"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-bold">
                        <Star className="h-4 w-4 fill-primary" />
                        الريادة في تعليم القرآن الكريم
                    </div>

                    <h1 className="text-5xl lg:text-7xl font-black text-gray-900 leading-[1.2] font-headline">
                        نغرس <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-600">القين</span> <br />
                        ونبني <span className="text-secondary">الأجيال</span>
                    </h1>

                    <p className="text-xl text-gray-500 leading-relaxed max-w-lg mr-0 ml-auto bg-white/50 backdrop-blur-sm p-4 rounded-xl border border-white/50 shadow-sm">
                        بيئة قرآنية تربوية تجمع بين أصالة المنهج وحداثة الوسيلة، لتخريج جيل حافظ لكتاب الله، متمثل لأخلاقه.
                    </p>

                    <div className="flex flex-wrap gap-4 pt-4">
                        <Button size="lg" className="h-14 px-8 text-lg rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 transition-transform bg-gradient-to-r from-primary to-primary/90">
                            سجل الآن
                            <ArrowLeft className="mr-2 h-5 w-5" />
                        </Button>
                        <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-2xl border-2 hover:bg-gray-50 text-gray-700">
                            <BookOpen className="ml-2 h-5 w-5" />
                            تعرف على مناهجنا
                        </Button>
                    </div>

                    {/* Stats Preview */}
                    <div className="flex gap-8 pt-8 border-t border-gray-200/60">
                        <div>
                            <p className="text-3xl font-black text-gray-900 font-headline">+800</p>
                            <p className="text-sm text-gray-500 font-bold">طالب وطالبة</p>
                        </div>
                        <div className="w-px h-12 bg-gray-200"></div>
                        <div>
                            <p className="text-3xl font-black text-gray-900 font-headline">+50</p>
                            <p className="text-sm text-gray-500 font-bold">خاتم للكتاب</p>
                        </div>
                        <div className="w-px h-12 bg-gray-200"></div>
                        <div>
                            <p className="text-3xl font-black text-gray-900 font-headline">20</p>
                            <p className="text-sm text-gray-500 font-bold">حلقة قرآنية</p>
                        </div>
                    </div>
                </motion.div>

                {/* Visual Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="relative hidden lg:block"
                >
                    <div className="relative z-10 grid grid-cols-2 gap-4">
                        <div className="space-y-4 translate-y-12">
                            <div className="h-64 w-full bg-gray-200 rounded-3xl overflow-hidden shadow-2xl skew-y-3 hover:skew-y-0 transition-all duration-500 cursor-pointer relative">
                                <Image
                                    src="/gallery/activity-3.jpg"
                                    alt="نشاط طلابي"
                                    fill
                                    className="object-cover hover:scale-110 transition-transform duration-700"
                                />
                            </div>
                            <div className="h-48 w-full bg-gray-100 rounded-3xl overflow-hidden shadow-lg -skew-y-3 hover:skew-y-0 transition-all duration-500 relative">
                                <Image
                                    src="/gallery/activity-2.jpg"
                                    alt="حلقة قرآنية"
                                    fill
                                    className="object-cover hover:scale-110 transition-transform duration-700"
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-48 w-full bg-gray-100 rounded-3xl overflow-hidden shadow-lg skew-y-3 hover:skew-y-0 transition-all duration-500 relative">
                                <Image
                                    src="/gallery/activity-7.jpg"
                                    alt="طلاب المدرسة"
                                    fill
                                    className="object-cover hover:scale-110 transition-transform duration-700"
                                />
                            </div>
                            <div className="h-64 w-full bg-gray-200 rounded-3xl overflow-hidden shadow-2xl -skew-y-3 hover:skew-y-0 transition-all duration-500 cursor-pointer relative">
                                <Image
                                    src="/gallery/activity-8.jpg"
                                    alt="نشاط جماعي"
                                    fill
                                    className="object-cover hover:scale-110 transition-transform duration-700"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Decorative Blobs */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-br from-primary/20 to-secondary/20 blur-[100px] rounded-full z-0" />
                </motion.div>
            </div>
        </div>
    );
}
