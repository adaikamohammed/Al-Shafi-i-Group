"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, MessageCircle, MapPin, Clock, Send } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function ContactModal({ children }: { children: React.ReactNode }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden bg-transparent border-none shadow-none">
                <div className="bg-white rounded-[2rem] overflow-hidden flex flex-col md:flex-row h-[600px] w-full shadow-2xl">
                    {/* Visual Side */}
                    <div className="w-full md:w-5/12 bg-slate-900 relative p-8 flex flex-col justify-between overflow-hidden">
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/islamic-art.png')]" />
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2" />
                        </div>

                        <div className="relative z-10">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6 border border-white/10">
                                <MessageCircle className="text-emerald-400 w-6 h-6" />
                            </div>
                            <DialogTitle className="text-3xl font-black text-white font-headline leading-tight mb-2">
                                تواصل مع <br />
                                <span className="text-emerald-400">إدارة المدرسة</span>
                            </DialogTitle>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                نسعد باستقبال استفساراتكم واقتراحاتكم. نحن هنا لخدمتكم وخدمة كتاب الله.
                            </p>
                        </div>

                        <div className="relative z-10 space-y-6">
                            <div className="flex items-start gap-4">
                                <MapPin className="text-emerald-500 w-5 h-5 mt-1 shrink-0" />
                                <div>
                                    <h4 className="text-white font-bold text-sm mb-1">العنوان</h4>
                                    <p className="text-slate-400 text-xs">المدرسة القرآنية للإمام الشافعي, تكسبت الغربية/الوادي</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <Clock className="text-emerald-500 w-5 h-5 mt-1 shrink-0" />
                                <div>
                                    <h4 className="text-white font-bold text-sm mb-1">أوقات العمل</h4>
                                    <p className="text-slate-400 text-xs text-right leading-relaxed">السبت إلى الأربعاء بين صلاتي المغرب والعشاء</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="w-full md:w-7/12 bg-white p-6 relative flex flex-col">
                        <Tabs defaultValue="phone" className="w-full h-full flex flex-col" dir="rtl">
                            <TabsList className="w-full grid grid-cols-2 mb-6">
                                <TabsTrigger value="phone">أرقام الهاتف</TabsTrigger>
                                <TabsTrigger value="email">البريد الإلكتروني</TabsTrigger>
                            </TabsList>

                            <TabsContent value="phone" className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4">
                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">أرقام التواصل المباشر</h3>
                                    <p className="text-slate-500 text-sm">يمكنكم الاتصال بنا مباشرة عبر الأرقام التالية</p>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="group flex items-center gap-4 p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50/50 transition-all cursor-pointer">
                                        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-emerald-600 group-hover:scale-110 transition-transform">
                                            <Phone className="w-5 h-5" />
                                        </div>
                                        <div className="text-right flex-1">
                                            <div className="text-xs text-slate-400 font-bold mb-1">الرقم الرئيسي</div>
                                            <div className="text-xl font-black text-slate-800 dir-ltr font-mono tracking-wider">
                                                06 63 33 70 90
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="text-center mt-auto">
                                    <Button className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-xl py-6 font-bold text-lg shadow-xl shadow-slate-200" onClick={() => window.open('tel:0663337090')}>
                                        <Phone className="w-5 h-5 mr-2" />
                                        اتصل الآن
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="email" className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4">
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">راسلنا عبر البريد الإلكتروني</h3>
                                </div>

                                <form className="space-y-4 flex-1 flex flex-col" onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.currentTarget);
                                    const name = formData.get('name');
                                    const email = formData.get('email');
                                    const subject = formData.get('subject');
                                    const message = formData.get('message');
                                    window.open(`mailto:contact@shafi-school.com?subject=${subject}&body=الاسم: ${name}%0D%0Aالبريد: ${email}%0D%0A%0D%0A${message}`);
                                }}>
                                    <div>
                                        <Input name="name" placeholder="اسمك الكريم" className="bg-slate-50 border-slate-200 rounded-xl h-12 text-right" required />
                                    </div>
                                    <div>
                                        <Input name="email" type="email" placeholder="بريدك الإلكتروني" className="bg-slate-50 border-slate-200 rounded-xl h-12 text-right" required />
                                    </div>
                                    <div>
                                        <Input name="subject" placeholder="موضوع الرسالة" className="bg-slate-50 border-slate-200 rounded-xl h-12 text-right" required />
                                    </div>
                                    <div className="flex-1">
                                        <Textarea name="message" placeholder="نص الرسالة..." className="bg-slate-50 border-slate-200 rounded-xl min-h-[120px] h-full text-right resize-none" required />
                                    </div>

                                    <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 font-bold text-lg shadow-lg shadow-emerald-200 mt-auto">
                                        <Send className="w-5 h-5 mr-2" />
                                        إرسال الرسالة
                                    </Button>
                                </form>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
