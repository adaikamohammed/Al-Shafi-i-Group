"use client";

import '../../app/globals.css';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarSeparator, useSidebar } from '@/components/ui/sidebar';
import { Users, ClipboardList, BarChart3, ArrowRightLeft, Settings, Menu, LogOut, Loader2, Calendar, Award, Gavel, Edit, BookCheck, FileText, HelpCircle, DollarSign, LayoutDashboard, Search, Swords, Shield, UserPlus, UserCog, Home, PanelRight, PanelLeft, Palette, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useStudentContext } from '@/context/StudentContext';
import { CommandBar } from '@/components/ui/CommandBar';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';

const allNavItems = [
  { href: '/home', label: 'البوابة الرئيسية', icon: Home },
  { href: '/', label: 'إدارة الطلبة', icon: Users },
  { href: '/registrations', label: 'التسجيلات الجديدة', icon: UserPlus },
  { href: '/sessions', label: 'الحصص اليومية', icon: ClipboardList },
  { href: '/stats', label: 'المتابعة الأسبوعية', icon: Calendar },
  { href: '/yearly-performance', label: 'رادار الأداء السنوي', icon: BarChart3 },
  { href: '/student-history', label: 'رادار سجل الطالب', icon: LayoutDashboard },
  { href: '/comparison', label: 'ساحة المقارنة', icon: Swords },
  { href: '/dues', label: 'المستحقات المالية', icon: DollarSign },
  { href: '/reports/daily', label: 'التقرير اليومي', icon: Edit },
  { href: '/reports/student', label: 'تقرير الطالب', icon: FileText },
  { href: '/ranking', label: 'ترتيب الطلبة', icon: Award },
  { href: '/surahs', label: 'متابعة الحفظ', icon: BookCheck },
  { href: '/points', label: 'نظام النقاط', icon: Gavel },
  { href: '/league', label: 'دوري التميز', icon: Shield },
  { href: '/data', label: 'البيانات', icon: ArrowRightLeft },
  { href: '/guide', label: 'دليل الاستخدام', icon: HelpCircle },
  { href: '/profile', label: 'الملف الشخصي', icon: UserCog, separator: true },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout, isSuperAdmin, updateUserProfile } = useAuth();
  const { students } = useStudentContext();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isCommandBarOpen, setCommandBarOpen] = useState(false);

  // Global Theme Logic
  const currentThemeId = user?.portalTheme || 'midnight';
  const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

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
  }, [user, authLoading, router, pathname]);

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
    return <div className="max-w-full mx-auto">{children}</div>;
  }

  if (!user && pathname !== '/login') {
    return null;
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const sidebarContent = (
    <div className={cn(
      "flex h-full flex-col transition-colors duration-700",
      theme.isLight ? "bg-white/80" : "bg-slate-950/40"
    )}>
      <SidebarHeader className="p-4">
        <Link href="/profile" className="block p-2 rounded-2xl hover:bg-white/10 transition-colors group">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-white/10 shrink-0">
              <AvatarImage src={user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.displayName}`} alt={user?.displayName || ''} />
              <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <h1 className={cn(
                "font-headline text-sm font-bold truncate",
                theme.isLight ? "text-slate-900" : "text-white"
              )}>
                {isSuperAdmin ? 'الإدارة العامة' : (user?.group || 'فوج غير محدد')}
              </h1>
              <p className="text-[10px] text-muted-foreground truncate">{user?.displayName}</p>
            </div>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu className="gap-1.5">
          {navItems.map((item) => (
            <React.Fragment key={item.href}>
              {item.separator && <div className="my-2 border-t border-white/5 group-data-[collapsible=icon]:mx-2" />}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href) && (item.href !== '/' || pathname === '/')}
                  tooltip={item.label}
                  className={cn(
                    "rounded-xl h-10 px-3 transition-all duration-300",
                    theme.isLight ? "text-slate-600 hover:bg-amber-100 hover:text-amber-700" : "text-white/60 hover:bg-white/5 hover:text-white",
                    "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground shadow-sm"
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="font-bold text-xs tracking-tight group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </React.Fragment>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 gap-2">
        <SidebarSeparator className="mb-2 opacity-10" />


        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="تسجيل الخروج"
              className="rounded-xl h-10 px-3 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="font-bold text-xs group-data-[collapsible=icon]:hidden">تسجيل الخروج</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex justify-end pt-2 group-data-[collapsible=icon]:justify-center">
          <SidebarTrigger className="hover:bg-white/5 h-8 w-8" />
        </div>
      </SidebarFooter>
    </div>
  );

  return (
    <SidebarProvider defaultOpen={true}>
      <div className={cn(
        "min-h-screen w-full relative transition-colors duration-700 font-body",
        theme.isLight ? "bg-slate-50 text-slate-900" : "bg-slate-950 text-white dark"
      )}>
        {/* Global Theme Gradient */}
        <div className={cn("fixed inset-0 bg-gradient-to-tr transition-all duration-1000 opacity-20 pointer-events-none", theme.gradient)} />
        <div className="fixed inset-0 bg-[url('/noise.png')] opacity-5 pointer-events-none" />

        <CommandBar students={students ?? []} isOpen={isCommandBarOpen} onOpenChange={setCommandBarOpen} router={router} />

        <div className="flex min-h-screen relative z-10 rtl overflow-x-hidden">
          {isMobile ? (
            <Sheet>
              <div className="flex flex-col flex-1 min-w-0">
                <header className={cn(
                  "flex h-16 items-center justify-between gap-4 border-b px-6 backdrop-blur-md sticky top-0 z-50",
                  theme.isLight ? "bg-white/60 border-slate-200" : "bg-slate-950/60 border-white/5"
                )}>
                  <div className="flex items-center gap-4">
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0 rounded-xl hover:bg-white/5">
                        <Menu className="h-6 w-6" />
                      </Button>
                    </SheetTrigger>
                    <h1 className="font-headline text-lg font-black tracking-widest text-primary">
                      {isSuperAdmin ? 'الإدارة العامة' : (user?.group || 'فوج الشافعي')}
                    </h1>
                  </div>
                  <Button
                    onClick={() => setCommandBarOpen(true)}
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                </header>
                <main className="flex-grow p-4 animate-in fade-in duration-700">
                  {children}
                </main>
              </div>
              <SheetContent side="right" className="flex flex-col p-0 bg-card border-none w-72">
                {sidebarContent}
              </SheetContent>
            </Sheet>
          ) : (
            <>
              <Sidebar
                side="right"
                collapsible="icon"
                className={cn(
                  "border-l transition-all duration-300",
                  theme.isLight ? "border-slate-200" : "border-white/5"
                )}
              >
                {sidebarContent}
              </Sidebar>
              <main className="flex-1 p-6 transition-all duration-300 ease-in-out md:pr-[var(--sidebar-width-icon)] group-data-[state=expanded]:md:pr-[var(--sidebar-width)] min-w-0">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger className="h-10 w-10 rounded-xl hover:bg-white/5" />
                    {pathname !== '/home' && (
                      <h2 className="font-headline text-xl font-black text-primary/80 tracking-widest">
                        المدرسة القرآنية للشافعي
                      </h2>
                    )}
                  </div>
                  <Button
                    onClick={() => setCommandBarOpen(true)}
                    variant="outline"
                    className={cn(
                      "w-full max-w-sm rounded-2xl h-11 transition-all",
                      theme.isLight ? "bg-white border-slate-200 hover:bg-slate-50" : "bg-white/5 border-white/5 hover:bg-white/10"
                    )}
                  >
                    <Search className="h-4 w-4 ml-2 opacity-40" />
                    <span className="ml-auto text-xs font-bold opacity-30">ابحث عن طالب، مهمة، أو تقرير (Ctrl+K)</span>
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded-lg border bg-muted px-2 font-mono text-[10px] font-medium opacity-50">
                      ⌘K
                    </kbd>
                  </Button>
                </div>
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                  {children}
                </div>
              </main>
            </>
          )}
        </div>
      </div>
    </SidebarProvider>
  )
}
