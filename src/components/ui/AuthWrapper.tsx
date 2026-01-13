
"use client";

import '../../app/globals.css';
import { Toaster } from '@/components/ui/toaster';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Users, ClipboardList, BarChart3, ArrowRightLeft, Settings, Menu, LogOut, Loader2, Calendar, Award, Gavel, Edit, BookCheck, FileText, HelpCircle, DollarSign, LayoutDashboard, Search, Swords, Shield, UserPlus, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useEffect, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { StudentProvider, useStudentContext } from '@/context/StudentContext';
import { CommandBar } from '@/components/ui/CommandBar';

const allNavItems = [
  { href: '/overview', label: 'نظرة عامة', icon: LayoutDashboard },
  { href: '/', label: 'إدارة الطلبة', icon: Users },
  { href: '/registrations', label: 'التسجيلات الجديدة', icon: UserPlus },
  { href: '/sessions', label: 'الحصص اليومية', icon: ClipboardList },
  { href: '/stats', label: 'المتابعة الأسبوعية', icon: Calendar },
  { href: '/comparison', label: 'ساحة المقارنة', icon: Swords },
  { href: '/dues', label: 'المستحقات المالية', icon: DollarSign },
  { href: '/reports/monthly', label: 'الإحصائيات الشهرية', icon: BarChart3 },
  { href: '/reports/daily', label: 'التقرير اليومي', icon: Edit },
  { href: '/reports/student', label: 'تقرير الطالب', icon: FileText },
  { href: '/ranking', label: 'ترتيب الطلبة', icon: Award },
  { href: '/surahs', label: 'متابعة الحفظ', icon: BookCheck },
  { href: '/points', label: 'نظام النقاط', icon: Gavel },
  { href: '/data', label: 'البيانات', icon: ArrowRightLeft },
  { href: '/guide', label: 'دليل الاستخدام', icon: HelpCircle },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

function AppContent({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading, logout, isSuperAdmin } = useAuth();
    const { students } = useStudentContext();
    const router = useRouter();
    const pathname = usePathname();
    const isMobile = useIsMobile();
    const [isCommandBarOpen, setCommandBarOpen] = useState(false);
    
    const navItems = useMemo(() => {
        if (isSuperAdmin) {
            return allNavItems.filter(item => !['/reports/daily', '/points', '/settings'].includes(item.href));
        }
        return allNavItems;
    }, [isSuperAdmin]);
    
    useEffect(() => {
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/service-worker.js').then(registration => {
            console.log('SW registered: ', registration);
          }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
          });
        });
      }
    }, []);

    useEffect(() => {
        const isParentPortal = pathname.startsWith('/parent-portal');
        if (!authLoading && !user && pathname !== '/login' && !isParentPortal) {
            router.push('/login');
        }
         if (!authLoading && user && pathname === '/login') {
             router.push('/overview');
        }
    }, [user, authLoading, router, pathname, isSuperAdmin]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                setCommandBarOpen((open) => !open)
            }
        }
        document.addEventListener("keydown", down)
        return () => document.removeEventListener("keydown", down)
    }, [])

    if (authLoading && !pathname.startsWith('/parent-portal')) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    if (pathname.startsWith('/parent-portal') && !user) {
      return <>{children}</>;
    }

    if (!user && pathname !== '/login') {
        return null;
    }

     if (pathname === '/login') {
        return <>{children}</>;
    }

    const sidebarContent = (
    <>
      <SidebarHeader className="p-0">
         <Link href="/profile" className="block p-4 hover:bg-sidebar-accent transition-colors">
             <div className="flex items-center gap-3">
                 <div>
                    <h1 className="font-headline text-lg font-bold text-primary">
                        {user?.group ? `إدارة ${user.group}` : 'إدارة فوج - الإمام الشافعي'}
                    </h1>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                 </div>
             </div>
         </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
               <SidebarMenuButton
                asChild
                isActive={pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/')}
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
            <CommandBar students={students ?? []} isOpen={isCommandBarOpen} onOpenChange={setCommandBarOpen} router={router} />
            {isMobile ? (
              <Sheet>
                <div className="flex flex-col min-h-screen">
                  <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
                    <div className="flex items-center gap-2">
                        <SheetTrigger asChild>
                          <Button variant="outline" size="icon" className="shrink-0">
                            <Menu className="h-5 w-5" />
                            <span className="sr-only">فتح قائمة التنقل</span>
                          </Button>
                        </SheetTrigger>
                        <h1 className="font-headline text-lg font-semibold text-primary">
                          {user?.group || 'مدرسة الشافعي'}
                        </h1>
                    </div>
                    <Button
                        onClick={() => setCommandBarOpen(true)}
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                    >
                        <Search className="h-5 w-5" />
                        <span className="sr-only">بحث</span>
                    </Button>
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
                <main className="md:ml-[var(--sidebar-width-icon)] lg:md:ml-[var(--sidebar-width)] p-4 sm:p-5 transition-all duration-300 ease-in-out w-full">
                    <div className="flex justify-end mb-4">
                        <Button
                            onClick={() => setCommandBarOpen(true)}
                            variant="outline"
                            className="w-full max-w-xs"
                        >
                            <span className="mr-auto text-muted-foreground">ابحث عن طالب أو مهمة...</span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                                <span className="text-xs">⌘</span>K
                            </kbd>
                        </Button>
                    </div>
                    <div className="w-full mx-auto px-4 sm:px-6 md:px-8">
                       {children}
                    </div>
                </main>
              </>
            )}
            <Toaster />
          </SidebarProvider>
    )
}


export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
        <StudentProvider>
            <AppContent>{children}</AppContent>
        </StudentProvider>
    </AuthProvider>
  )
}
