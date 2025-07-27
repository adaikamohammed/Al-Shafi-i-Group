"use client";

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Users, ClipboardList, BookOpen, BarChart3, ArrowRightLeft, Settings, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import React from 'react';

const navItems = [
  { href: '/', label: 'إدارة الطلبة', icon: Users },
  { href: '/sessions', label: 'الحصص اليومية', icon: ClipboardList },
  { href: '/surahs', label: 'متابعة السور', icon: BookOpen },
  { href: '/stats', label: 'إحصائيات الفوج', icon: BarChart3 },
  { href: '/data', label: 'البيانات', icon: ArrowRightLeft },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const sidebarContent = (
    <>
      <SidebarHeader className="p-4">
        <h1 className="font-headline text-2xl font-bold text-primary">
          مدرسة الإمام الشافعي
        </h1>
        <p className="text-sm text-muted-foreground">فوج الشيخ أحمد بن عمر</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={{ children: item.label, side: 'right', align: 'center' }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </>
  );

  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>مدير مدرسة الشافعي</title>
        <meta name="description" content="إدارة مدرسة الإمام الشافعي القرآنية" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:wght@400;700&family=Belleza&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <SidebarProvider>
          {isMobile ? (
            <Sheet>
              <div className="flex flex-col">
                <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
                   <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0">
                      <Menu className="h-5 w-5" />
                      <span className="sr-only">فتح قائمة التنقل</span>
                    </Button>
                  </SheetTrigger>
                  <h1 className="font-headline text-lg font-semibold text-primary">
                    مدرسة الإمام الشافعي
                  </h1>
                </header>
                <main className="flex-grow p-4">
                  {children}
                </main>
              </div>
              <SheetContent side="right" className="flex flex-col p-0">
                {sidebarContent}
              </SheetContent>
            </Sheet>
          ) : (
            <>
              <Sidebar side="right">
                {sidebarContent}
              </Sidebar>
              <SidebarInset>
                <main className="p-4 sm:p-6 lg:p-8">
                  {children}
                </main>
              </SidebarInset>
            </>
          )}
          <Toaster />
        </SidebarProvider>
      </body>
    </html>
  );
}
