"use client";

import '../../app/globals.css';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarSeparator, useSidebar } from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, ClipboardList, BarChart3, ArrowRightLeft, Settings, Menu, LogOut, Loader2, Calendar, Award, Gavel, Edit, BookCheck, FileText, HelpCircle, DollarSign, LayoutDashboard, Search, Swords, Shield, UserPlus, UserCog, Home, PanelRight, PanelLeft, Palette, Check, MoonStar, Sun, Bell, X } from 'lucide-react';
import { useFCM } from '@/hooks/useFCM';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { canAccessPage } from '@/lib/permissions';
import { useStudentContext } from '@/context/StudentContext';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { NotificationRegister } from '@/components/ui/NotificationRegister';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
import { PORTAL_THEMES } from '@/lib/themes';
import { cn } from '@/lib/utils';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AnimatePresence, motion } from 'framer-motion';
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
  const { themeMode, setThemeMode, isDark } = useTheme();
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(t => t !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  // Global Theme Logic
  const currentThemeId = user?.portalTheme || 'classic';
  const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

  const filteredNavGroups = useMemo(() => {
    return NAV_GROUPS.map(group => ({
      ...group,
      items: group.items.filter(item => {
        // Special restriction for registrations and entry-permit page: ONLY admin00 can see it
        if ((item.href === '/registrations' || item.href === '/admin/entry-permit') && user?.email !== 'admin00@gmail.com') {
          return false;
        }

        // Use the permissions system to check access
        return canAccessPage(item.href, role);
      })
    })).filter(group => group.items.length > 0);
  }, [role, user?.email]);

  const filteredBottomNavItems = useMemo(() => {
    return BOTTOM_NAV_ITEMS.filter(item => canAccessPage(item.href, role));
  }, [role]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'development') {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister().then(success => {
              if (success) console.log('Successfully unregistered stale service worker in development mode.');
            });
          }
        });
      } else {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/firebase-messaging-sw.js').then(registration => {
            console.log('Firebase Messaging SW registered: ', registration);
          }).catch(registrationError => {
            console.log('Firebase Messaging SW registration failed: ', registrationError);
          });
        });
      }
    }
  }, []);

  useEffect(() => {
    const isPublicPage = pathname === '/' || pathname === '/about' || pathname === '/future' || pathname === '/stats' || pathname.startsWith('/parent-portal') || pathname.startsWith('/record');
    if (!authLoading && !user && pathname !== '/login' && !isPublicPage) {
      router.push('/login');
      return;
    }

    // Redirect authenticated users from root or login directly to their group (/dashboard)
    const isExplicitPublic = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('public') === 'true';
    if (!authLoading && user) {
      if ((pathname === '/' && !isExplicitPublic) || pathname === '/login') {
        router.replace('/dashboard');
      }
    }
  }, [user, authLoading, router, pathname]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA")
      ) {
        e.preventDefault()
        setCommandBarOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const isPublicPage = pathname === '/' || pathname === '/about' || pathname === '/future' || pathname === '/stats' || pathname.startsWith('/parent-portal') || pathname.startsWith('/record');
  const hasLocalActiveSession = typeof window !== 'undefined' && localStorage.getItem('has_active_session') === 'true';
  const isExplicitPublic = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('public') === 'true';

  // Smooth direct transition for remembered accounts opening root or login
  if (!isExplicitPublic && ((pathname === '/' && (user || (authLoading && hasLocalActiveSession))) || (pathname === '/login' && (user || (authLoading && hasLocalActiveSession))))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-3" dir="rtl">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold text-gray-700">جاري الدخول إلى الفوج مباشرة...</p>
      </div>
    );
  }

  if (authLoading && !isPublicPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (isPublicPage && !user) {
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
              <SidebarMenuItem key={group.title} className="group/menu relative">
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

                  <div className="md:hidden">
                    <CollapsibleContent>
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
                  </div>
                </Collapsible>

                {/* Popout menu on hover when sidebar is collapsed to icon mode */}
                <div className="absolute right-full top-0 mr-2 z-[99] hidden md:group-hover/menu:block pointer-events-auto bg-card border rounded-3xl shadow-xl w-60 p-4 border-border/80 animate-in fade-in slide-in-from-right-3 duration-200">
                  <div className="border-b pb-2 mb-2">
                    <h4 className="font-headline font-black text-xs text-primary">{group.title}</h4>
                  </div>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer",
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
                </div>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 gap-2 mt-auto">
        <SidebarSeparator className="mb-2 opacity-5" />

        <SidebarMenu className="gap-1">
          {filteredBottomNavItems.map((item) => {
            const Icon = item.icon;

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
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-bold text-[11px] tracking-tight group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="تغيير المظهر"
                  className={cn(
                    "rounded-xl h-10 px-3 transition-all duration-300",
                    theme.isLight ? "text-slate-600 hover:bg-slate-100" : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  <span className="font-bold text-[11px] tracking-tight group-data-[collapsible=icon]:hidden">المظهر</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
                className="w-64 bg-slate-900 border-white/10 text-white p-2 max-h-[300px] overflow-y-auto custom-scrollbar"
              >
                <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground">اختر المظهر</div>
                {Object.values(PORTAL_THEMES).map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => updateUserProfile({ portalTheme: t.id })}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer mb-1 focus:bg-white/10 focus:text-white"
                  >
                    <div className={cn("h-8 w-8 rounded-lg border border-white/20 shrink-0 shadow-sm", t.preview)} />
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="font-bold text-xs truncate">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate opacity-70">
                        {t.isLight ? 'فاتح' : 'داكن'}
                        {t.id === 'pink_horizon' ? ' (جديد)' : ''}
                      </span>
                    </div>
                    {currentThemeId === t.id && <Check className="h-4 w-4 text-emerald-500 mr-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>



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

  // Render simplified layout for public landing page if user is logged in or not (handled above if not logged in, but here if logged in on root)
  // Actually, if user IS logged in and goes to '/', we might want to redirect them to '/dashboard' or show the public page with a "Go to Dashboard" button.
  // For now, let's treat '/' as public page even for logged in users, OR redirect them.
  // Let's redirect logged-in users from '/' to '/dashboard' inside a useEffect or just render public page.
  // The user requirement implies '/' is public.

  // Render simplified layout for public landing page if user is logged in
  if (isPublicPage) {
    return <div className="max-w-full mx-auto font-body">{children}</div>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebarContent
        user={user}
        isSuperAdmin={isSuperAdmin}
        logout={logout}
        theme={theme}
        filteredNavGroups={filteredNavGroups}
        filteredBottomNavItems={filteredBottomNavItems}
        updateUserProfile={updateUserProfile}
        currentThemeId={currentThemeId}
        pathname={pathname}
        isMobile={isMobile}
        setCommandBarOpen={setCommandBarOpen}
        isCommandBarOpen={isCommandBarOpen}
        router={router}
        students={students}
      >
        {children}
      </AppSidebarContent>
    </SidebarProvider>
  )
}

function AppSidebarContent({
  user, isSuperAdmin, logout, theme, filteredNavGroups, filteredBottomNavItems,
  updateUserProfile, currentThemeId, pathname, isMobile, setCommandBarOpen, isCommandBarOpen, router, students, children
}: any) {
  const { state } = useSidebar();
  const { themeMode, setThemeMode, isDark, syncToPortalTheme } = useTheme();
  const { permission, requestPermission } = useFCM();
  const [showNotifBanner, setShowNotifBanner] = useState(false);

  // Auto-show notification banner once, 3s after mount
  useEffect(() => {
    if (permission === 'granted') return;
    const dismissed = localStorage.getItem('notif_banner_dismissed');
    if (dismissed) return;
    const timer = setTimeout(() => setShowNotifBanner(true), 3000);
    return () => clearTimeout(timer);
  }, [permission]);

  const dismissBanner = () => {
    setShowNotifBanner(false);
    localStorage.setItem('notif_banner_dismissed', '1');
  };

  const enableAndDismiss = async () => {
    await requestPermission();
    dismissBanner();
  };

  const handleThemeChange = (themeId: string) => {
    updateUserProfile({ portalTheme: themeId });
    syncToPortalTheme(themeId);
  };
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  // Hover state for collapsed mode
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(t => t !== groupTitle)
        : [...prev, groupTitle]
    );
  };

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
      <SidebarContent className="px-2 custom-scrollbar md:overflow-visible overflow-y-auto py-4">
        <SidebarMenu className="gap-2">
          {filteredNavGroups.map((group: any) => {
            const primaryItem = group.items.find((i: any) => i.primary);
            const mainIcon = primaryItem?.icon || group.items[0]?.icon || Layers;
            const isOpen = openGroups.includes(group.title);
            const isHovered = hoveredGroup === group.title;
            const hasActive = group.items.some((i: any) => pathname.startsWith(i.href));

            const GROUP_COLORS: Record<string, {
              activeBg: string; activeText: string; activeShadow: string;
              idleBg: string; idleText: string; idleIcon: string;
            }> = {
              "الميدان التربوي": {
                activeBg: "bg-emerald-600 dark:bg-emerald-500", activeText: "text-white", activeShadow: "shadow-md shadow-emerald-500/20",
                idleBg: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/45", idleText: "text-emerald-800 dark:text-emerald-300", idleIcon: "text-emerald-600 dark:text-emerald-400",
              },
              "بوصلة المتابعة": {
                activeBg: "bg-blue-600 dark:bg-blue-500", activeText: "text-white", activeShadow: "shadow-md shadow-blue-500/20",
                idleBg: "bg-blue-50 text-blue-800 dark:bg-blue-950/20 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950/45", idleText: "text-blue-800 dark:text-blue-300", idleIcon: "text-blue-600 dark:text-blue-400",
              },
              "سباق التميز": {
                activeBg: "bg-amber-500 dark:bg-amber-500", activeText: "text-white", activeShadow: "shadow-md shadow-amber-500/20",
                idleBg: "bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/45", idleText: "text-amber-800 dark:text-amber-300", idleIcon: "text-amber-600 dark:text-amber-400",
              },
              "النافذة الإدارية": {
                activeBg: "bg-violet-600 dark:bg-violet-500", activeText: "text-white", activeShadow: "shadow-md shadow-violet-500/20",
                idleBg: "bg-violet-50 text-violet-800 dark:bg-violet-950/20 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/45", idleText: "text-violet-800 dark:text-violet-300", idleIcon: "text-violet-600 dark:text-violet-400",
              },
              "النظام والإعدادات": {
                activeBg: "bg-slate-700 dark:bg-slate-600", activeText: "text-white", activeShadow: "shadow-md shadow-slate-500/20",
                idleBg: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/60", idleText: "text-slate-700 dark:text-slate-300", idleIcon: "text-slate-500 dark:text-slate-400",
              },
              "الإعدادات": {
                activeBg: "bg-slate-700 dark:bg-slate-600", activeText: "text-white", activeShadow: "shadow-md shadow-slate-500/20",
                idleBg: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/60", idleText: "text-slate-700 dark:text-slate-300", idleIcon: "text-slate-500 dark:text-slate-400",
              },
              "مركز التحكم": {
                activeBg: "bg-rose-600 dark:bg-rose-500", activeText: "text-white", activeShadow: "shadow-md shadow-rose-500/20",
                idleBg: "bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/45", idleText: "text-rose-800 dark:text-rose-300", idleIcon: "text-rose-600 dark:text-rose-400",
              },
              "إدارة المدارس": {
                activeBg: "bg-indigo-600 dark:bg-indigo-500", activeText: "text-white", activeShadow: "shadow-md shadow-indigo-500/20",
                idleBg: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/20 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950/45", idleText: "text-indigo-800 dark:text-indigo-300", idleIcon: "text-indigo-600 dark:text-indigo-400",
              },
              "حسابي": {
                activeBg: "bg-slate-700 dark:bg-slate-600", activeText: "text-white", activeShadow: "shadow-md shadow-slate-500/20",
                idleBg: "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800/60", idleText: "text-slate-700 dark:text-slate-300", idleIcon: "text-slate-500 dark:text-slate-400",
              },
            };

            const gc = GROUP_COLORS[group.title] ?? {
              activeBg: "bg-primary", activeText: "text-primary-foreground", activeShadow: "shadow-md shadow-primary/20",
              idleBg: "bg-gray-100 dark:bg-white/8 hover:bg-gray-200 dark:hover:bg-white/12", idleText: "text-gray-700 dark:text-gray-300", idleIcon: "text-gray-500 dark:text-gray-400",
            };

            const FirstIcon = mainIcon;

            /* ── COLLAPSED MODE ── */
            if (state === 'collapsed' && !isMobile) {
              return (
                <SidebarMenuItem key={group.title}
                  onMouseEnter={() => setHoveredGroup(group.title)}
                  onMouseLeave={() => setHoveredGroup(null)}
                  className="relative py-0.5"
                >
                  <SidebarMenuButton
                    className={cn(
                      "w-full h-10 rounded-xl flex items-center justify-center transition-all duration-200",
                      hasActive
                        ? `${gc.activeBg} ${gc.activeText} ${gc.activeShadow}`
                        : `${gc.idleBg} ${gc.idleText}`
                    )}
                    title={group.title}
                  >
                    <FirstIcon className={cn("w-5 h-5 shrink-0", hasActive ? gc.activeText : gc.idleIcon)} />
                  </SidebarMenuButton>

                  <AnimatePresence>
                    {isHovered && (
                      <HoverPopup
                        group={group}
                        pathname={pathname}
                        theme={theme}
                      />
                    )}
                  </AnimatePresence>
                </SidebarMenuItem>
              );
            }

            /* ── EXPANDED/MOBILE MODE ── */
            return (
              <SidebarMenuItem key={group.title}
                onMouseEnter={!isMobile ? () => setHoveredGroup(group.title) : undefined}
                onMouseLeave={!isMobile ? () => setHoveredGroup(null) : undefined}
                className="mb-1 relative group/menu"
              >
                {/* Group header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleGroup(group.title)}
                  className={cn(
                    "w-full h-10 flex items-center gap-3 px-3 rounded-xl text-xs font-black transition-all duration-200 select-none cursor-pointer",
                    hasActive
                      ? `${gc.activeBg} ${gc.activeText} ${gc.activeShadow}`
                      : `${gc.idleBg} ${gc.idleText}`
                  )}
                >
                  <FirstIcon className={cn("w-4 h-4 shrink-0", hasActive ? gc.activeText : gc.idleIcon)} />
                  <span className="flex-1 text-[11px] font-bold tracking-tight whitespace-nowrap overflow-hidden font-headline">
                    {group.title}
                  </span>

                  {/* Chevron indicator */}
                  <ChevronLeft
                    className={cn(
                      "w-3.5 h-3.5 shrink-0 transition-transform duration-200",
                      isOpen ? "-rotate-90" : "",
                      hasActive ? "opacity-80" : "opacity-50"
                    )}
                  />
                </div>

                {/* ── Collapsible Accordion (Mobile & Desktop) ── */}
                {isOpen && (
                  <div className="pt-1 pr-3 pb-1 space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    {group.items.map((item: any) => {
                      const active = pathname.startsWith(item.href);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
                            active
                              ? "bg-primary/10 text-primary border border-primary/20 font-extrabold"
                              : theme.isLight
                                ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                : "text-white/70 hover:bg-white/5 hover:text-white"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* ── Desktop: flyout popup on hover when accordion is closed ── */}
                {!isMobile && !isOpen && (
                  <AnimatePresence>
                    {isHovered && (
                      <HoverPopup
                        group={group}
                        pathname={pathname}
                        theme={theme}
                      />
                    )}
                  </AnimatePresence>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 gap-2 mt-auto">
        <SidebarSeparator className="mb-2 opacity-5" />

        <SidebarMenu className="gap-1">
          {filteredBottomNavItems.map((item: any) => {
            const Icon = item.icon;

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
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-bold text-[11px] tracking-tight group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}

          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  tooltip="تغيير المظهر"
                  className={cn(
                    "rounded-xl h-10 px-3 transition-all duration-300",
                    theme.isLight ? "text-slate-600 hover:bg-slate-100" : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  <span className="font-bold text-[11px] tracking-tight group-data-[collapsible=icon]:hidden">المظهر</span>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
                className="w-64 bg-slate-900 border-white/10 text-white p-2 max-h-[300px] overflow-y-auto custom-scrollbar"
              >
                <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground">اختر المظهر</div>
                {Object.values(PORTAL_THEMES).map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer mb-1 focus:bg-white/10 focus:text-white"
                  >
                    <div className={cn("h-8 w-8 rounded-lg border border-white/20 shrink-0 shadow-sm", t.preview)} />
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="font-bold text-xs truncate">{t.name}</span>
                      <span className="text-[10px] text-muted-foreground truncate opacity-70">
                        {t.isLight ? 'فاتح' : 'داكن'}
                        {t.id === 'pink_horizon' ? ' (جديد)' : ''}
                      </span>
                    </div>
                    {currentThemeId === t.id && <Check className="h-4 w-4 text-emerald-500 mr-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
              tooltip={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
              className={cn(
                "rounded-xl h-10 px-3 transition-all duration-300",
                theme.isLight ? "text-slate-600 hover:bg-slate-100" : "text-white/60 hover:bg-white/5 hover:text-white"
              )}
            >
              {isDark
                ? <Sun className="h-4 w-4 shrink-0" />
                : <MoonStar className="h-4 w-4 shrink-0" />}
              <span className="font-bold text-[11px] group-data-[collapsible=icon]:hidden">
                {isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Notification Bell with pulsing badge if not enabled */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={permission === 'granted' ? undefined : () => setShowNotifBanner(true)}
              tooltip={permission === 'granted' ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات'}
              className={cn(
                "rounded-xl h-10 px-3 transition-all duration-300 relative",
                permission === 'granted'
                  ? (theme.isLight ? "text-emerald-600" : "text-emerald-400")
                  : (theme.isLight ? "text-amber-600 hover:bg-amber-50" : "text-amber-400 hover:bg-amber-500/10")
              )}
            >
              <div className="relative shrink-0">
                <Bell className="h-4 w-4" />
                {permission !== 'granted' && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </div>
              <span className="font-bold text-[11px] group-data-[collapsible=icon]:hidden">
                {permission === 'granted' ? 'الإشعارات مفعّلة' : permission === 'denied' ? 'الإشعارات محجوبة' : 'تفعيل الإشعارات'}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

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
      </SidebarFooter>
    </div>
  );

  return (
    <div className={cn(
      "min-h-screen w-full relative transition-colors duration-700 font-body print:min-h-0 print:h-auto print:overflow-visible",
      isDark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900"
    )}>
      {/* Global Theme Gradient */}
      <div className={cn("fixed inset-0 bg-gradient-to-tr transition-all duration-1000 opacity-20 pointer-events-none print:hidden", theme.gradient)} />
      <div className="fixed inset-0 bg-[url('/noise.png')] opacity-5 pointer-events-none print:hidden" />

      <GlobalSearch students={students ?? []} isOpen={isCommandBarOpen} onOpenChange={setCommandBarOpen} router={router} />
      <NotificationRegister />

      {/* Auto Notification Banner */}
      {showNotifBanner && permission !== 'granted' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 duration-500">
          <div className={cn(
            "rounded-2xl border shadow-2xl p-4 flex items-start gap-4",
            isDark
              ? "bg-slate-900 border-amber-500/30 shadow-amber-500/10"
              : "bg-white border-amber-200 shadow-amber-100"
          )}>
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
              permission === 'denied' ? "bg-red-500/10" : "bg-amber-500/10"
            )}>
              <Bell className={cn("h-5 w-5", permission === 'denied' ? "text-red-500" : "text-amber-500 animate-bounce")} />
            </div>
            <div className="flex-1 min-w-0">
              {permission === 'denied' ? (
                <>
                  <p className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                    🚫 الإشعارات محجوبة في المتصفح
                  </p>
                  <p className={cn("text-xs mt-1 leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>
                    لتفعيلها يدوياً:
                  </p>
                  <ol className={cn("text-xs mt-1 leading-relaxed list-decimal list-inside space-y-0.5", isDark ? "text-slate-300" : "text-slate-600")}>
                    <li>اضغط على 🔒 أمام رابط الموقع في المتصفح</li>
                    <li>اختر <strong>الإذونات</strong> أو <strong>Site Settings</strong></li>
                    <li>غيّر <strong>الإشعارات</strong> من ❌ إلى ✅ <strong>السماح</strong></li>
                    <li>أعد تحميل الصفحة</li>
                  </ol>
                </>
              ) : (
                <>
                  <p className={cn("font-bold text-sm", isDark ? "text-white" : "text-slate-900")}>
                    🔔 فعّل الإشعارات الفورية
                  </p>
                  <p className={cn("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                    احصل على تنبيهات تلقائية عند غياب الطلاب أو تراجع مستوى حفظهم — حتى لو أغلقت التطبيق.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={enableAndDismiss}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
                    >
                      تفعيل الآن
                    </button>
                    <button
                      onClick={dismissBanner}
                      className={cn("text-xs px-3 py-1.5 rounded-lg transition-colors",
                        isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      لاحقاً
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={dismissBanner} className="shrink-0 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-screen relative z-10 rtl overflow-x-hidden print:overflow-visible print:h-auto print:min-h-0">
        {isMobile ? (
          <Sheet>
            <div className="flex flex-col flex-1 min-w-0">
              <header className={cn(
                "flex h-16 items-center justify-between gap-4 border-b px-6 backdrop-blur-md sticky top-0 z-50 print:hidden",
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
              <main className="flex-grow p-4 animate-in fade-in duration-700 print:p-0">
                {children}
              </main>
            </div>
            <SheetContent side="right" className="flex flex-col p-0 bg-card border-none w-72 print:hidden">
              <SheetHeader className="sr-only">
                <SheetTitle>القائمة الجانبية</SheetTitle>
              </SheetHeader>
              {sidebarContent}
            </SheetContent>
          </Sheet>
        ) : (
          <>
            <Sidebar
              side="right"
              collapsible="icon"
              className={cn(
                "border-l transition-all duration-300 print:hidden",
                theme.isLight ? "border-slate-200" : "border-white/5"
              )}
            >
              {sidebarContent}
            </Sidebar>
            <main className="flex-1 min-h-screen p-6 transition-all duration-300 ease-in-out min-w-0 print:p-0 print:min-h-0">
              <div className="flex justify-between items-center mb-8 print:hidden">
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
  );
}

function HoverPopup({
  group,
  pathname,
  theme,
}: {
  group: any;
  pathname: string;
  theme: any;
}) {
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const isMultiColumn = group.items.length > 8;
  const half = Math.ceil(group.items.length / 2);
  const col1 = group.items.slice(0, half);
  const col2 = group.items.slice(half);

  return (
    <motion.div
      initial={{ opacity: 0, x: 8, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "absolute right-full mr-3 rounded-2xl shadow-2xl border z-50 overflow-hidden pointer-events-auto max-h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar backdrop-blur-md pb-2",
        isMultiColumn ? "top-[-140px] w-[460px] md:w-[490px]" : "top-0 w-56",
        theme.isLight ? "bg-white/95 border-slate-200 text-slate-900 shadow-slate-200/50" : "bg-slate-900/95 border-white/10 text-white shadow-black/50"
      )}
      style={{ filter: "drop-shadow(0 12px 40px rgba(0,0,0,0.22))" }}
    >
      <div className={cn("px-4 py-3 border-b text-xs font-black flex items-center justify-between gap-2 font-headline tracking-wide", theme.isLight ? "bg-slate-50/80 border-slate-100 text-slate-900" : "bg-white/5 border-white/5 text-white")}>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <span>{group.title}</span>
        </div>
        {isMultiColumn && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            {group.items.length} صفحة
          </span>
        )}
      </div>

      {isMultiColumn ? (
        <div className="p-2.5 pb-4 grid grid-cols-2 gap-3 divide-x divide-x-reverse divide-slate-100 dark:divide-white/5">
          {/* Column 1 */}
          <div className="space-y-1">
            {group.title === 'النافذة الإدارية' && (
              <div className="px-2 py-1 text-[10px] font-black text-primary/80 uppercase tracking-widest border-b border-primary/10 mb-1">
                الرقابة والعمليات
              </div>
            )}
            {col1.map((item: any) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer group/link",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : theme.isLight
                        ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5 shrink-0 transition-transform group-hover/link:scale-110", active ? "text-primary-foreground" : "opacity-80")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Column 2 */}
          <div className="space-y-1 pr-3">
            {group.title === 'النافذة الإدارية' && (
              <div className="px-2 py-1 text-[10px] font-black text-primary/80 uppercase tracking-widest border-b border-primary/10 mb-1">
                المالية والخدمات
              </div>
            )}
            {col2.map((item: any) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer group/link",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : theme.isLight
                        ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5 shrink-0 transition-transform group-hover/link:scale-110", active ? "text-primary-foreground" : "opacity-80")} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-1.5 pb-3 space-y-0.5">
          {group.items.map((item: any) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer",
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : theme.isLight
                      ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
