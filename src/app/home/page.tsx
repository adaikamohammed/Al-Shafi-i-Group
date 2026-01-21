"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Palette, LogOut, Users, ClipboardList, Calendar,
  Swords, DollarSign, Edit, FileText, Award, BookCheck,
  Gavel, ArrowRightLeft, HelpCircle, UserCog, Settings,
  UserPlus, BarChart3, Shield, LayoutDashboard,
  Check, TrendingUp, Star, MoonStar, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { DailyChecklist } from '@/components/ui/DailyChecklist';
import { DailyInspiration } from '@/components/ui/DailyInspiration';
import { ManagementDashboard } from '@/components/management/ManagementDashboard';
import { canAccessPage } from '@/lib/permissions';
import { GroupEvaluationCard } from '@/components/ui/GroupEvaluationCard';
import { HallOfFame } from '@/components/ui/HallOfFame';
import { ImpactStats } from '@/components/ui/ImpactStats';
import { RecentMilestones } from '@/components/ui/RecentMilestones';
import { useStudentContext } from '@/context/StudentContext';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PORTAL_THEMES } from '@/lib/themes';

const navItems = [
  { href: '/', label: 'إدارة الطلبة', icon: Users, color: 'text-blue-400', glow: 'group-hover:shadow-blue-500/20' },
  { href: '/registrations', label: 'التسجيلات الجديدة', icon: UserPlus, color: 'text-emerald-400', glow: 'group-hover:shadow-emerald-500/20' },
  { href: '/sessions', label: 'الحصص اليومية', icon: ClipboardList, color: 'text-sky-400', glow: 'group-hover:shadow-sky-500/20' },
  { href: '/stats', label: 'المتابعة الأسبوعية', icon: Calendar, color: 'text-indigo-400', glow: 'group-hover:shadow-indigo-500/20' },

  { href: '/yearly-performance', label: 'رادار الأداء السنوي', icon: BarChart3, color: 'text-purple-400', glow: 'group-hover:shadow-purple-500/20' },
  { href: '/comparison', label: 'ساحة المقارنة', icon: Swords, color: 'text-rose-400', glow: 'group-hover:shadow-rose-500/20' },
  { href: '/dues', label: 'المستحقات المالية', icon: DollarSign, color: 'text-amber-400', glow: 'group-hover:shadow-amber-500/20' },
  { href: '/management/monitoring', label: 'نظام المراقبة', icon: BarChart3, color: 'text-emerald-500', glow: 'group-hover:shadow-emerald-500/20' },
  { href: '/reports/daily', label: 'التقرير اليومي', icon: Edit, color: 'text-pink-400', glow: 'group-hover:shadow-pink-500/20' },

  { href: '/reports/student', label: 'تقرير الطالب', icon: FileText, color: 'text-orange-400', glow: 'group-hover:shadow-orange-500/20' },
  { href: '/ranking', label: 'ترتيب الطلبة', icon: Award, color: 'text-yellow-400', glow: 'group-hover:shadow-yellow-500/20' },
  { href: '/surahs', label: 'متابعة الحفظ', icon: BookCheck, color: 'text-lime-400', glow: 'group-hover:shadow-lime-500/20' },
  { href: '/points', label: 'نظام النقاط', icon: Gavel, color: 'text-orange-500', glow: 'group-hover:shadow-orange-700/20' },

  { href: '/league', label: 'دوري التميز', icon: Shield, color: 'text-cyan-400', glow: 'group-hover:shadow-cyan-500/20' },
  { href: '/data', label: 'البيانات', icon: ArrowRightLeft, color: 'text-slate-400', glow: 'group-hover:shadow-slate-500/20' },
  { href: '/guide', label: 'دليل الاستخدام', icon: HelpCircle, color: 'text-violet-400', glow: 'group-hover:shadow-violet-500/20' },

  { href: '/profile', label: 'الملف الشخصي', icon: UserCog, color: 'text-indigo-300', glow: 'group-hover:shadow-indigo-300/20' },
  { href: '/settings', label: 'الإعدادات', icon: Settings, color: 'text-slate-500', glow: 'group-hover:shadow-slate-500/20' },
];

export default function HomePage() {
  const { user, updateUserProfile, logout, isManagement, role } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const { students, dailySessions, loading } = useStudentContext();

  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => canAccessPage(item.href, role));
  }, [role]);

  const currentThemeId = user?.portalTheme || 'midnight';
  const theme = PORTAL_THEMES[currentThemeId] || PORTAL_THEMES.midnight;

  const handleThemeChange = async (themeId: string) => {
    if (themeId === currentThemeId) return;

    setIsSaving(true);
    try {
      await updateUserProfile({ portalTheme: themeId });
      toast({
        title: "✅ تم تحديث المظهر",
        description: `تم تفعيل ثيم "${PORTAL_THEMES[themeId].name}" بنجاح.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "❌ خطأ",
        description: "لم نتمكن من حفظ المظهر الجديد.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen w-full relative overflow-x-hidden transition-colors duration-700",
      theme.isLight ? "text-slate-900" : "text-white"
    )}>
      {/* We don't redefine background here as it's now in ClientLayout, 
            but we can add page-specific overlays if needed */}

      {/* Content Wrapper */}
      <div className="relative z-10 container mx-auto px-4 py-8 flex flex-col items-center">

        {/* Top Toolbar */}
        <div className="w-full max-w-7xl flex items-center justify-between mb-12">
          <div className={cn(
            "flex items-center gap-3 backdrop-blur-md px-4 py-2 rounded-xl border shadow-lg",
            theme.isLight ? "bg-white border-slate-200" : "bg-white/5 border-white/10"
          )}>
            {currentThemeId === 'ramadan' ? (
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
            ) : (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            )}
            <span className={cn("text-sm font-bold opacity-80", theme.isLight ? "text-slate-600" : "text-white")}>
              حالة النظام: <span className="text-emerald-400">مستقر</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isSaving}
                  className={cn(
                    "backdrop-blur-md rounded-xl h-11 shadow-lg transition-all",
                    theme.isLight ? "bg-white border-slate-200 text-slate-900 hover:bg-slate-50" : "bg-white/10 border-white/10 text-white hover:bg-white/20"
                  )}
                >
                  {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Palette className="ml-2 h-4 w-4 text-amber-400" />}
                  مظهر البوابة
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={cn(
                "w-56 backdrop-blur-2xl rounded-2xl shadow-2xl",
                theme.isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900/95 border-white/10 text-white"
              )} align="end">
                <DropdownMenuLabel className={cn(
                  "font-headline text-xs uppercase tracking-widest px-4 pt-3",
                  theme.isLight ? "text-slate-400" : "text-white/50"
                )}>طابع البوابة</DropdownMenuLabel>
                <DropdownMenuSeparator className={theme.isLight ? "bg-slate-100" : "bg-white/5"} />
                {Object.values(PORTAL_THEMES).map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => handleThemeChange(t.id)}
                    className={cn(
                      "flex items-center justify-between py-3 px-4 rounded-xl cursor-pointer transition-colors",
                      theme.isLight ? "hover:bg-slate-50 focus:bg-slate-50" : "hover:bg-white/5 focus:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("h-4 w-4 rounded-full border", t.preview, theme.isLight ? "border-slate-200" : "border-white/20")} />
                      <span className={cn("font-medium", currentThemeId === t.id && "text-primary")}>{t.name}</span>
                    </div>
                    {currentThemeId === t.id && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center mb-16 space-y-6"
        >
          <div className={cn(
            "inline-flex items-center gap-3 px-8 py-3 rounded-full border mb-2 backdrop-blur-md shadow-inner",
            theme.isLight ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-white/5 border-white/10 text-amber-200"
          )}>
            {currentThemeId === 'ramadan' ? (
              <MoonStar className={cn("h-5 w-5 animate-pulse", theme.isLight ? "text-amber-600 fill-amber-600" : "text-amber-300 fill-amber-300")} />
            ) : (
              <Star className={cn("h-5 w-5", theme.isLight ? "text-amber-600 fill-amber-600" : "text-amber-300 fill-amber-300")} />
            )}
            <span className="text-sm font-headline font-black tracking-widest lowercase">المدرسة القرآنية للإمام الشافعي</span>
          </div>
          <h1 className={cn(
            "text-6xl md:text-9xl font-headline font-black leading-tight",
            theme.isLight ? "text-slate-900" : "text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/30 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]"
          )}>
            {isManagement ? "الإدارة" : (user?.group || "فوج 7")}
          </h1>
          <p className={cn(
            "text-xl md:text-3xl font-medium tracking-tight font-body",
            theme.isLight ? "text-slate-500" : "text-white/50"
          )}>
            تحية عطرة، <span className={theme.isLight ? "text-slate-900 font-bold" : "text-white font-bold"}>{user?.displayName || "محمد منصور"}</span> 👋
          </p>
        </motion.div>

        {/* Impact Stats */}
        <div className="w-full max-w-7xl mb-16 px-2">
          <ImpactStats />
        </div>

        {isManagement ? (
          <div className="w-full max-w-7xl">
            <ManagementDashboard />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 w-full max-w-7xl px-2">
            {filteredNavItems.map((item, idx) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.04 }}
              >
                <Link
                  href={item.href}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-6 p-8 rounded-[2rem]",
                    "backdrop-blur-2xl border transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] shadow-2xl",
                    theme.isLight ? "bg-white border-slate-100 hover:bg-slate-50 shadow-slate-200/50" : "bg-white/5 border-white/5 hover:bg-white/10 shadow-black/80",
                    item.glow
                  )}
                >
                  <div className={cn("absolute inset-0 rounded-[2rem] opacity-0 group-hover:opacity-10 transition-opacity blur-3xl", theme.preview)} />

                  <div className={cn("relative p-6 rounded-[1.8rem] bg-white/5 group-hover:scale-125 transition-transform duration-500 shadow-inner", item.color)}>
                    <item.icon className="h-10 w-10" />
                  </div>
                  <span className={cn(
                    "relative text-base font-headline font-bold text-center tracking-wide transition-colors",
                    theme.isLight ? "text-slate-700 group-hover:text-amber-600" : "text-white group-hover:text-amber-200"
                  )}>
                    {item.label}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {!isManagement && (
          <div className="w-full max-w-7xl mt-24 space-y-20 px-2 lg:px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <section className="space-y-8">
                <div className="flex items-center gap-4 px-6 border-r-4 border-amber-400">
                  <LayoutDashboard className="h-7 w-7 text-amber-400" />
                  <h2 className={cn("text-3xl font-headline font-black tracking-tight", theme.isLight ? "text-slate-900" : "text-white")}>النبض اليومي</h2>
                </div>
                <div className="space-y-8">
                  <DailyInspiration />
                  <DailyChecklist />
                </div>
              </section>

              <section className="space-y-8">
                <div className="flex items-center gap-4 px-6 border-r-4 border-primary">
                  <Award className="h-7 w-7 text-primary" />
                  <h2 className={cn("text-3xl font-headline font-black tracking-tight", theme.isLight ? "text-slate-900" : "text-white")}>الرادار التحليلي</h2>
                </div>
                <GroupEvaluationCard students={students || []} sessions={dailySessions} groupName={user?.group} />
              </section>
            </div>
          </div>
        )}

        {/* Bottom Section: Milestones & Hall of Fame - Full Width */}
        <div className="w-full max-w-7xl mt-12 space-y-12 mb-32 px-2 lg:px-4">
          <div className={cn(
            "backdrop-blur-xl p-8 lg:p-12 rounded-[2.5rem] border shadow-2xl space-y-16",
            theme.isLight ? "bg-white border-slate-200" : "bg-white/5 border-white/10"
          )}>
            <section className="space-y-8">
              <RecentMilestones />
            </section>

            <div className={cn("w-full h-px", theme.isLight ? "bg-slate-200" : "bg-white/10")} />

            <section className="space-y-10">
              <div className="flex items-center gap-4 px-6 border-r-4 border-yellow-500">
                <CrownIcon className="h-8 w-8 text-yellow-500" />
                <h2 className={cn("text-3xl font-headline font-black tracking-tight", theme.isLight ? "text-slate-900" : "text-white")}>لوحة الشرف الذهبية</h2>
              </div>
              <div className="w-full">
                <HallOfFame />
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="py-12 text-center opacity-20 hover:opacity-100 transition-opacity duration-1000">
          <p className="text-xs font-bold tracking-[0.5em] uppercase">المدرسة القرآنية للإمام الشافعي • تصميم وبناء Antigravity ✨</p>
        </div>
      </div>
    </div>
  );
}

// Simple Crown Icon helper if crown-icon is not in lucide
function CrownIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M12 17H12.01" />
    </svg>
  )
}
