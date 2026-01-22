"use client";

import '../../app/globals.css';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarSeparator, useSidebar } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, ClipboardList, BarChart3, ArrowRightLeft, Settings, Menu, LogOut, Loader2, Calendar, Award, Gavel, Edit, BookCheck, FileText, HelpCircle, DollarSign, LayoutDashboard, Search, Swords, Shield, UserPlus, UserCog, Home, PanelRight, PanelLeft, Palette, Check, MoonStar } from 'lucide-react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { canAccessPage } from '@/lib/permissions';
import { useStudentContext } from '@/context/StudentContext';
import { CommandBar } from '@/components/ui/CommandBar';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NAV_GROUPS, BOTTOM_NAV_ITEMS } from '@/lib/navigation';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const BOTTOM_NAV_ITEMS_LOCAL = BOTTOM_NAV_ITEMS; // Just for clarity if needed, but we use the import directly


import { DateDisplay } from '@/components/ui/DateDisplay';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, logout, isSuperAdmin, isManagement, role, updateUserProfile } = useAuth();
  const { students } = useStudentContext();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [isCommandBarOpen, setCommandBarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(t => t !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  // Global Theme Logic
  const currentThemeId = user?.portalTheme || 'midnight';
  const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

  const filteredNavGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Use the permissions system to check access
        return canAccessPage(item.href, role);
      })
    })).filter(group => group.items.length > 0);
  }, [role]);

  const filteredBottomNavItems = useMemo(() => {
    return BOTTOM_NAV_ITEMS.filter(item => canAccessPage(item.href, role));
  }, [role]);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
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
    const isParentPortal = pathname.startsWith('/parent-portal') || pathname.startsWith('/record');
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

  if (authLoading && !pathname.startsWith('/parent-portal') && !pathname.startsWith('/record')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if ((pathname.startsWith('/parent-portal') || pathname.startsWith('/record')) && !user) {
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

      <SidebarContent className="px-2 custom-scrollbar overflow-y-auto py-4">
        <SidebarMenu className="gap-4">
          {filteredNavGroups.map((group) => {
            const primaryItem = group.items.find(i => i.primary);
            const mainIcon = primaryItem?.icon || group.items[0]?.icon || Layers;
            const isOpen = openGroups.includes(group.title);

            return (
              <SidebarMenuItem key={group.title}>
                <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.title)}>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      className={cn(
                        "rounded-2xl h-12 w-full flex items-center gap-3 transition-all duration-500 border border-transparent shadow-sm hover:scale-[1.02] relative group/btn px-3",
                        "group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center",
                        theme.isLight
                          ? "bg-white text-slate-600 hover:bg-white hover:text-primary hover:border-primary/20 shadow-slate-200/50"
                          : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/10"
                      )}
                      tooltip={group.title}
                    >
                      <div className={cn(
                        "p-2 rounded-xl transition-all duration-500 shrink-0 flex items-center justify-center",
                        "group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:rounded-lg",
                        theme.isLight ? "bg-slate-50 group-hover/btn:bg-primary/10" : "bg-white/5 group-hover/btn:bg-white/10"
                      )}>
                        {React.createElement(mainIcon, {
                          className: "h-5 w-5 group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4"
                        })}
                      </div>
                      <span className="font-bold text-[11px] tracking-tight group-data-[collapsible=icon]:hidden whitespace-nowrap overflow-hidden font-headline">
                        {group.title}
                      </span>

                      {/* Chevron indicator */}
                      <ChevronLeft className={cn(
                        "h-4 w-4 mr-auto transition-transform duration-300 group-data-[collapsible=icon]:hidden",
                        isOpen && "rotate-90"
                      )} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <div className="mt-2 space-y-1 pr-2">
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 p-2 pr-4 rounded-xl transition-all cursor-pointer",
                            theme.isLight
                              ? "hover:bg-slate-100 text-slate-600"
                              : "hover:bg-white/5 text-white/70",
                            pathname === item.href && (theme.isLight
                              ? "bg-primary/10 text-primary font-bold"
                              : "bg-primary/20 text-primary font-bold")
                          )}
                        >
                          <item.icon className={cn("h-3.5 w-3.5 shrink-0 mr-1", item.primary && "text-primary")} />
                          <span className={cn("text-[10px] font-medium font-body", item.primary && "text-primary")}>
                            {item.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 gap-2 mt-auto">
        <SidebarSeparator className="mb-2 opacity-5" />

        <SidebarMenu className="gap-1">
          {filteredBottomNavItems.map((item) => {
            const Icon = (currentThemeId === 'ramadan' && item.href === '/home') ? MoonStar : item.icon;

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={item.label}
                  className={cn(
                    "rounded-xl h-10 px-3 transition-all duration-300",
                    theme.isLight ? "text-slate-600 hover:bg-slate-100" : "text-white/60 hover:bg-white/5 hover:text-white",
                    "data-[active=true]:bg-primary data-[active=true]:text-primary-foreground shadow-md"
                  )}
                >
                  <Link href={item.href} className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4 shrink-0", currentThemeId === 'ramadan' && item.href === '/home' && "text-amber-500")} />
                    <span className="font-bold text-[11px] tracking-tight group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="تسجيل الخروج"
              className="rounded-xl h-10 px-3 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 mt-2"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="font-bold text-[11px] group-data-[collapsible=icon]:hidden">تسجيل الخروج</span>
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
        theme.isLight ? "bg-slate-50 text-slate-900" : "bg-slate-950 text-white dark",
        currentThemeId === 'ramadan' && "ramadan-pattern"
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
              <main className="flex-1 min-h-screen p-6 transition-all duration-300 ease-in-out min-w-0">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger className="h-10 w-10 rounded-xl hover:bg-white/5" />
                    {pathname !== '/home' && (
                      <h2 className="font-headline text-xl font-black text-primary/80 tracking-widest">
                        المدرسة القرآنية للشافعي
                      </h2>
                    )}
                  </div>

                  <div className="hidden md:block">
                    <DateDisplay />
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
