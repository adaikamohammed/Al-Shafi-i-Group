"use client";

import React from 'react';
import { motion } from 'framer-motion';
import PublicNavbar from '@/components/public/PublicNavbar';
import Footer from '@/components/public/Footer';
import {
    History, Users, GraduationCap, Building2, Star, Quote,
    BookOpen, Heart, Tv, Trophy, Compass, UserCheck,
    ShieldCheck, Info, MapPin, Calendar
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const activities = [
    { title: "تحفيظ القرآن الكريم", icon: BookOpen, color: "bg-emerald-500" },
    { title: "تفسير القرآن وحفظ المتون", icon: GraduationCap, color: "bg-blue-500" },
    { title: "الآداب والأخلاق الإسلامية", icon: Heart, color: "bg-rose-500" },
    { title: "دروس مرئية (العارض الضوئي)", icon: Tv, color: "bg-amber-500" },
    { title: "مسابقات دينية", icon: Trophy, color: "bg-purple-500" },
    { title: "رحلات ترفيهية", icon: Compass, color: "bg-indigo-500" },
];

const management = [
    { name: "إلياس عدايكة", role: "المدير", icon: UserCheck },
    { name: "محمد عدايكة", role: "عضو الإدارة", icon: ShieldCheck },
    { name: "تقي الدين قديري", role: "عضو الإدارة", icon: ShieldCheck },
];

const sheikhs = [
    "الشيخ زياد درويش", "الشيخ عبد الحميد سعيدان", "الشيخ فؤاد بن عمر",
    "الشيخ أحمد بن عمر", "الشيخ إبراهيم مراد", "الشيخ سفيان نصيرة",
    "الشيخ محمد لمين منصور", "الشيخ عبد الحق نصيرة", "الشيخ صهيب نصيب"
];

const ustadhat = [
    "الأستاذة سعيدة", "الأستاذة سميرة", "الأستاذة رقية",
    "الأستاذة ثريا", "الأستاذة أميرة", "الأستاذة زينب",
    "الأستاذة جهاد", "الأستاذة حياة", "الأستاذة ميمونه"
];

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-[#fafaf5]" dir="rtl">
            <PublicNavbar />

            <main className="pt-20">
                {/* Hero */}
                <section className="relative h-[40vh] flex items-center justify-center overflow-hidden bg-slate-900 text-center">
                    <div className="absolute inset-0 z-0 opacity-40">
                        <img src="/about-school.jpg" alt="Background" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
                    </div>
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="container mx-auto px-4 relative z-10 text-center">
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 font-headline tracking-tight">
                            عن مدرسة <span className="text-emerald-400">الشافعي</span>
                        </h1>
                        <p className="text-lg text-slate-300 max-w-2xl mx-auto font-medium">
                            مسيرة إيمانية، تعليمية، وتربوية ممتدة لخدمة كتاب الله
                        </p>
                    </motion.div>
                </section>

                <div className="container mx-auto px-4 py-12">
                    <Tabs defaultValue="history" className="w-full">
                        <div className="flex justify-center mb-12">
                            <TabsList className="bg-white p-1 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex h-auto overflow-x-auto w-full max-w-2xl">
                                <TabsTrigger value="history" className="flex-1 py-3 px-6 rounded-xl font-bold font-headline transition-all data-[state=active]:bg-primary data-[state=active]:text-white">
                                    تاريخ المدرسة
                                </TabsTrigger>
                                <TabsTrigger value="team" className="flex-1 py-3 px-6 rounded-xl font-bold font-headline transition-all data-[state=active]:bg-primary data-[state=active]:text-white">
                                    طاقمنا
                                </TabsTrigger>
                                <TabsTrigger value="activities" className="flex-1 py-3 px-6 rounded-xl font-bold font-headline transition-all data-[state=active]:bg-primary data-[state=active]:text-white">
                                    أنشطتنا
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* History Tab */}
                        <TabsContent value="history" className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 text-right">
                            {/* 2006 */}
                            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-100 overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-bl-[100px]" />
                                <div className="relative z-10 grid lg:grid-cols-3 gap-12">
                                    <div className="lg:col-span-2 space-y-6">
                                        <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-100 text-amber-700 font-black text-sm">2006</div>
                                        <h3 className="text-3xl font-black text-slate-900 font-headline">الانطلاقة المباركة</h3>
                                        <p className="text-slate-600 leading-loose text-lg text-right">
                                            فتحت المدرسة القرآنية لمسجد الإمام الشافعي أبوابها على بركة الله سنة 2006 لتعليم القرآن الكريم وأحكامه، تحت إشراف الشيخين الكريمين <b>إبراهيم مجوري</b> و<b>ياسين عتوسي</b> حفظهما الله، حيث قاما بمجهودات كبيرة في تحفيظ كتاب الله لكافة الأطوار.
                                        </p>
                                        <p className="text-slate-600 leading-loose text-right">
                                            وقد أتت هذه المجهودات أكلها بحفظ عدد كبير من الطلبة للقرآن الكريم، نذكر منهم بفخر:
                                            <span className="block mt-2 font-bold text-slate-800">عبد الكريم ترممو، فؤاد بن عمر، بشير شكيمة، سفيان نصيرة، زكرياء شكيمة، ياسين غيلاني، عبد القادر عدايكة، عماد بن عمر.....</span>
                                        </p>
                                        <div className="bg-rose-50/50 p-6 rounded-3xl border border-rose-100 text-right">
                                            <h4 className="font-black text-rose-600 mb-3 flex items-center gap-2 justify-end">
                                                جناح النساء
                                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                            </h4>
                                            <p className="text-slate-600 leading-loose">
                                                كان تحت إشراف الأستاذة <b>غيلاني وهيبة</b>، حيث تكفلت بتدريس كافة الأطوار، وقد تخرج تحت يديها العديد من الطالبات نذكر منهم:
                                                <span className="block mt-2 font-bold text-slate-800 text-sm">عدايكة ريحانة، غيلاني إيمان، بالعيد مهدية، عدايكة سناء، بشر نذيرة، بن عمر كوثر، عدايكة حسنية، شكيمة سارة...</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <div className="relative w-full aspect-square rounded-[3rem] overflow-hidden shadow-2xl rotate-2 border-8 border-white">
                                            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2015-2022 */}
                            <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-100 overflow-hidden relative">
                                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-br-[100px]" />
                                <div className="relative z-10 space-y-8 text-right">
                                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-emerald-100 text-emerald-700 font-black text-sm">2015 - 2022</div>
                                    <h3 className="text-3xl font-black text-slate-900 font-headline">مرحلة التجديد والنموذجية</h3>
                                    <p className="text-slate-600 leading-loose text-lg">
                                        تم تجديد الجمعية الدينية للمسجد وقررت هاته الأخيرة إعطاء نفس جديد للمدرسة، حيث نصبت خلية مكلفة بتسيير عمل المدرسة القرآنية وتجهيزها بكافة المستلزمات الضرورية لتواكب بذلك عمل المدارس القرآنية النموذجية.
                                    </p>
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="bg-slate-50 p-6 rounded-3xl border-l-4 border-emerald-500 text-right">
                                            <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2 justify-end">
                                                المؤطرون المباشرون
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            </h4>
                                            <p className="text-sm text-slate-700 leading-relaxed">
                                                عبد الكريم ترممو، فؤاد بن عمر، بشير شكيمة، سفيان نصيرة (أعضاء في الجمعية الدينية للمسجد).
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 p-6 rounded-3xl border-l-4 border-primary text-right">
                                            <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2 justify-end">
                                                المرافق المتاحة
                                                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                            </h4>
                                            <p className="text-sm text-slate-700 leading-relaxed">
                                                تحتوي المدرسة القرآنية على إدارة و 4 حجرات خاصة بالذكور، وقسم مجهز بالكراسي والطاولات خاص بفوج محو الأمية وفوج الأطفال الصغار، بالإضافة إلى حجرة جناح الإناث.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2022-2026 */}
                            <div className="bg-slate-900 rounded-[3rem] p-8 md:p-12 shadow-2xl text-white overflow-hidden relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-to-b from-primary/20 to-transparent opacity-20" />
                                <div className="relative z-10 text-center space-y-6">
                                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary/20 text-primary font-black text-sm">2022 - 2026</div>
                                    <h3 className="text-3xl font-black font-headline text-white">التوسع والتطوير المستمر</h3>
                                    <div className="flex justify-center flex-wrap gap-4 items-center text-xl font-medium">
                                        <MapPin className="text-primary w-6 h-6" />
                                        <span>على بركة الله، تم إضافة مصلى المسجد كقاعة دراسية كبرى مجهزة لاستقبال الحلقات القرآنية.</span>
                                    </div>
                                    <div className="pt-8">
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 uppercase text-[10px] tracking-widest font-black text-slate-400">تنوع الأطوار</div>
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 uppercase text-[10px] tracking-widest font-black text-slate-400">تجهيزات عصرية</div>
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 uppercase text-[10px] tracking-widest font-black text-slate-400">إشراف متخصص</div>
                                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 uppercase text-[10px] tracking-widest font-black text-slate-400">بيئة تربوية</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Team Tab */}
                        <TabsContent value="team" className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            {/* Management */}
                            <div className="text-right">
                                <h3 className="text-2xl font-black text-emerald-600 mb-10 flex items-center gap-3 justify-end">
                                    طاقم الإدارة <div className="w-8 h-1 bg-emerald-600 rounded-full" />
                                </h3>
                                <div className="grid md:grid-cols-3 gap-8">
                                    {management.map((m, i) => (
                                        <div key={i} className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 flex items-center gap-4 hover:border-primary/30 transition-all flex-row-reverse">
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-primary">
                                                <m.icon className="w-8 h-8" />
                                            </div>
                                            <div className="text-right">
                                                <h4 className="font-black text-slate-900">{m.name}</h4>
                                                <p className="text-sm text-emerald-600 font-bold">{m.role}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Educational Staff */}
                            <div className="grid md:grid-cols-2 gap-16 text-right">
                                {/* Sheikhs */}
                                <div>
                                    <h3 className="text-2xl font-black text-blue-600 mb-8 flex items-center gap-3 justify-end">
                                        أفواج الأكابر (المشايخ) <div className="w-8 h-1 bg-blue-600 rounded-full" />
                                    </h3>
                                    <div className="space-y-3">
                                        {sheikhs.map((s, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -20 }}
                                                whileInView={{ opacity: 1, x: 0 }}
                                                className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all group flex-row-reverse"
                                            >
                                                <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-blue-500 font-black text-xs group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                    {i + 1}
                                                </div>
                                                <span className="font-bold text-slate-800">{s}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                    <p className="mt-6 text-xs text-slate-400 font-medium italic">9 أفواج للمشايخ مخصصة للذكور من الرابعة ابتدائي فما فوق.</p>
                                </div>

                                {/* Ustadhat */}
                                <div>
                                    <h3 className="text-2xl font-black text-rose-500 mb-8 flex items-center gap-3 justify-end">
                                        أفواج الأصاغر (الأستاذات) <div className="w-8 h-1 bg-rose-500 rounded-full" />
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {ustadhat.map((u, i) => (
                                            <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 group hover:border-rose-200 transition-all flex-row-reverse">
                                                <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-300 group-hover:bg-rose-500 group-hover:text-white transition-all">
                                                    <Users className="w-5 h-5" />
                                                </div>
                                                <span className="font-bold text-slate-800 text-sm">{u}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-8 bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4 flex-row-reverse">
                                        <div className="text-amber-500 shrink-0 mt-1"><Info className="w-6 h-6" /></div>
                                        <p className="text-sm text-amber-800 leading-relaxed font-bold">
                                            نظام الأفواج: 9 أفواج للأستاذات مخصصة للذكور والإناث إلى غاية السنة الثالثة ابتدائي، ثم يتم تحويل الذكور لأفواج المشايخ.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Activities Tab */}
                        <TabsContent value="activities" className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                                {activities.map((act, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 hover:border-primary transition-all text-center group"
                                    >
                                        <div className={`${act.color} w-20 h-20 mx-auto rounded-3xl flex items-center justify-center text-white mb-8 group-hover:scale-110 transition-transform shadow-lg`}>
                                            <act.icon className="w-10 h-10" />
                                        </div>
                                        <h4 className="text-xl font-black text-slate-900">{act.title}</h4>
                                    </motion.div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Closing Quote */}
                <section className="py-24 bg-white">
                    <div className="container mx-auto px-4 text-center">
                        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-12">
                            <Quote className="w-16 h-16 text-emerald-100 mx-auto" />
                            <h3 className="text-4xl md:text-5xl font-black text-slate-900 font-headline leading-relaxed">
                                "رسالتنا تقديم رؤية عصرية تجمع بين الأصالة في تعليم القرآن والتطور في أساليب التربية."
                            </h3>
                            <div className="flex justify-center gap-4 pt-8">
                                <span className="px-6 py-2 bg-slate-900 text-white rounded-full font-bold">مدرسة الإمام الشافعي</span>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
