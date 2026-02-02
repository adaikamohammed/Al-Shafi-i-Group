"use client";

import Link from 'next/link';
import { Facebook, Twitter, Instagram, Youtube, MapPin, Phone, Mail } from 'lucide-react';
import Image from 'next/image';

export default function PublicFooter() {
    return (
        <footer className="bg-slate-900 text-white pt-20 pb-10 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none translate-x-1/2 -translate-y-1/2" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                    {/* Brand Column */}
                    <div className="space-y-6">
                        <Link href="/" className="flex items-center gap-3 mb-6">
                            <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-white">
                                <Image src="/logo.jpg" alt="Logo" fill className="object-cover" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xl font-black font-headline">المدرسة القرآنية</span>
                                <span className="text-sm font-bold text-primary/80">للإمام الشافعي</span>
                            </div>
                        </Link>
                        <p className="text-slate-400 leading-relaxed text-sm">
                            منصة تعليمية رائدة تهدف إلى خدمة كتاب الله، وربط الأجيال الناشئة بالقرآن الكريم تلاوة وحفظاً وتدبراً.
                        </p>
                        <div className="flex gap-4">
                            {[Facebook, Twitter, Instagram, Youtube].map((Icon, i) => (
                                <a key={i} href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-primary hover:text-white transition-all text-slate-400">
                                    <Icon className="h-5 w-5" />
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold font-headline">روابط سريعة</h3>
                        <ul className="space-y-4">
                            {['الرئيسية', 'عن المدرسة', 'المناهج التعليمية', 'الهيئة التدريسية', 'أخبار المدرسة', 'تواصل معنا'].map((item) => (
                                <li key={item}>
                                    <Link href="#" className="text-slate-400 hover:text-primary transition-colors text-sm flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
                                        {item}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold font-headline">معلومات التواصل</h3>
                        <ul className="space-y-6">
                            <li className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <MapPin className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <span className="block text-white font-bold text-sm">العنوان</span>
                                    <span className="block text-slate-400 text-sm">حي تكسبت الغربية، الوادي، الجزائر</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Phone className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <span className="block text-white font-bold text-sm">الهاتف</span>
                                    <span className="block text-slate-400 text-sm" dir="ltr">+213 6 63 33 70 90</span>
                                </div>
                            </li>
                            <li className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Mail className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <span className="block text-white font-bold text-sm">البريد الإلكتروني</span>
                                    <span className="block text-slate-400 text-sm font-sans">alshafiischool39@gmail.com</span>
                                </div>
                            </li>
                        </ul>
                    </div>

                    {/* Newsletter (Now Contact Form) */}
                    <div className="space-y-6">
                        <h3 className="text-lg font-bold font-headline">تواصل معنا</h3>
                        <p className="text-slate-400 text-sm">راسلنا مباشرة عبر البريد الإلكتروني</p>
                        <form
                            className="space-y-3"
                            onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget;
                                const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                                const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                                const subject = (form.elements.namedItem('subject') as HTMLInputElement).value;
                                const body = `الاسم: ${name}%0D%0Aالبريد: ${email}%0D%0A%0D%0Aالرسالة:%0D%0A`;
                                window.location.href = `mailto:alshafiischool39@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
                            }}
                        >
                            <input
                                name="name"
                                type="text"
                                required
                                placeholder="اسمك الكريم"
                                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                            />
                            <input
                                name="email"
                                type="email"
                                required
                                placeholder="بريدك الإلكتروني"
                                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                            />
                            <input
                                name="subject"
                                type="text"
                                required
                                placeholder="موضوع الرسالة"
                                className="w-full h-10 rounded-xl bg-white/5 border border-white/10 px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors text-sm"
                            />
                            <button type="submit" className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold transition-colors text-sm">
                                إرسال الرسالة
                            </button>
                        </form>
                    </div>
                </div>

                <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
                    <p>© 2026 المدرسة القرآنية للإمام الشافعي. جميع الحقوق محفوظة.</p>
                    <div className="flex gap-6">
                        <Link href="#" className="hover:text-white transition-colors">سياسة الخصوصية</Link>
                        <Link href="#" className="hover:text-white transition-colors">شروط الاستخدام</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
