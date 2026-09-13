"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import Image from 'next/image';
import ContactModal from './ContactModal';
import { useAuth } from '@/context/AuthContext';

export default function PublicNavbar() {
    const { user } = useAuth();
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
            <div className="container mx-auto px-4 h-20 flex justify-between items-center">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-3">
                    <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-xl overflow-hidden shadow-sm border border-gray-100">
                        <Image
                            src="/logo.jpg"
                            alt="Logo"
                            fill
                            className="object-cover"
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-gray-900 font-headline leading-none">المدرسة القرآنية</span>
                        <span className="text-xs font-bold text-primary">للإمام الشافعي</span>
                    </div>
                </Link>

                {/* Desktop Links */}
                <div className="hidden md:flex items-center gap-8">
                    <Link href="/stats" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">إحصائياتنا</Link>
                    <Link href="/about" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">تاريخ المدرسة</Link>
                    <Link href="/future" className="text-sm font-bold text-primary font-black transition-colors">رؤية المستقبل</Link>
                    <Link href="/#gallery" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">معرض الصور</Link>
                    <ContactModal>
                        <button className="text-sm font-bold text-gray-600 hover:text-primary transition-colors cursor-pointer">تواصل معنا</button>
                    </ContactModal>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <Link href={user ? "/dashboard" : "/login"}>
                        <Button className="rounded-xl px-6 font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                            {user ? "دخول الفوج 🚪" : "دخول المشايخ"}
                        </Button>
                    </Link>

                    {/* Mobile Menu */}
                    <div className="md:hidden">
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="ghost" size="icon" className="rounded-xl">
                                    <Menu className="h-6 w-6 text-gray-700" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="pt-20">
                                <SheetHeader className="sr-only">
                                    <SheetTitle>قائمة التنقل الجانبية</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-6">
                                    <Link href="/#stats" className="text-lg font-bold text-gray-800">إحصائياتنا</Link>
                                    <Link href="/about" className="text-lg font-bold text-gray-800">تاريخ المدرسة</Link>
                                    <Link href="/future" className="text-lg font-bold text-primary">رؤية المستقبل</Link>
                                    <Link href="/#gallery" className="text-lg font-bold text-gray-800">معرض الصور</Link>
                                    <ContactModal>
                                        <button className="text-lg font-bold text-gray-800 w-full text-right">تواصل معنا</button>
                                    </ContactModal>
                                    <Link href={user ? "/dashboard" : "/login"} className="w-full">
                                        <Button className="w-full rounded-xl py-6 font-bold text-lg">
                                            {user ? "دخول الفوج 🚪" : "دخول المشايخ"}
                                        </Button>
                                    </Link>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>
            </div>
        </nav>
    );
}
