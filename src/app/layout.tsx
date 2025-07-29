

"use client";

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Users, ClipboardList, BarChart3, ArrowRightLeft, Settings, Menu, LogOut, Loader2, Calendar, Award, Gavel, Edit } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useEffect } from 'react';
import { StudentProvider } from '@/context/StudentContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navItems = [
  { href: '/', label: 'إدارة الطلبة', icon: Users },
  { href: '/sessions', label: 'الحصص اليومية', icon: ClipboardList },
  { href: '/stats', label: 'المتابعة الأسبوعية', icon: Calendar },
  { href: '/reports/monthly', label: 'الإحصائيات الشهرية', icon: BarChart3 },
  { href: '/reports/daily', label: 'التقرير اليومي', icon: Edit },
  { href: '/ranking', label: 'ترتيب الطلبة', icon: Award },
  { href: '/points', label: 'نظام النقاط', icon: Gavel },
  { href: '/data', label: 'البيانات', icon: ArrowRightLeft },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

function AuthWrapper({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const isMobile = useIsMobile();
    
    useEffect(() => {
        if (!authLoading && !user && pathname !== '/login') {
            router.push('/login');
        }
         if (!authLoading && user && pathname === '/login') {
            router.push('/');
        }
    }, [user, authLoading, router, pathname]);

    if (authLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    if (!user && pathname !== '/login') {
        return null;
    }

     if (pathname === '/login') {
        return children;
    }

    const sidebarContent = (
    <>
      <SidebarHeader className="p-4">
         <div className="flex items-center gap-3">
             <Avatar>
                <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
                <AvatarFallback>{user?.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
             </Avatar>
             <div>
                <h1 className="font-headline text-lg font-bold text-primary">
                    إدارة فوج - الإمام الشافعي
                </h1>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
             </div>
         </div>
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
            <SidebarMenuItem>
                 <SidebarMenuButton onClick={logout} tooltip={{ children: "تسجيل الخروج", side: 'right', align: 'center' }}>
                     <LogOut />
                     <span>تسجيل الخروج</span>
                 </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </>
  );

    return (
        <SidebarProvider>
            {isMobile ? (
              <Sheet>
                <div className="flex flex-col">
                  <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
                    <div className="flex items-center gap-2">
                        <SheetTrigger asChild>
                          <Button variant="outline" size="icon" className="shrink-0">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">فتح قائمة التنقل</span>
                          </Button>
                        </SheetTrigger>
                        <h1 className="font-headline text-lg font-semibold text-primary">
                          مدرسة الإمام الشافعي
                        </h1>
                    </div>
                     <Avatar>
                        <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || ''} />
                        <AvatarFallback>{user?.displayName?.charAt(0).toUpperCase()}</AvatarFallback>
                     </Avatar>
                  </header>
                  <main className="flex-grow p-4">
                    {children}
                  </main>
                </div>
                <SheetContent side="right" className="flex flex-col p-0 bg-card">
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
    )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
 
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>مدير مدرسة الشافعي</title>
        <meta name="description" content="إدارة مدرسة الإمام الشافعي القرآنية" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
            <StudentProvider>
                <AuthWrapper>
                    {children}
                </AuthWrapper>
            </StudentProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
