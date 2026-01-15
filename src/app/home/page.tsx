
"use client";

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Camera, LogOut, Users, ClipboardList, Calendar, Swords, DollarSign, Edit, FileText, Award, BookCheck, Gavel, ArrowRightLeft, HelpCircle, UserCog, Settings, UserPlus, LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { DailyInspiration } from '@/components/ui/DailyInspiration';
import { DailyChecklist } from '@/components/ui/DailyChecklist';
import { GroupEvaluationCard } from '@/components/ui/GroupEvaluationCard';
import { useStudentContext } from '@/context/StudentContext';
import { cn } from '@/lib/utils';


const navItems = [
    { href: '/overview', label: 'نظرة عامة', icon: LayoutDashboard, color: 'text-purple-400' },
    { href: '/', label: 'إدارة الطلبة', icon: Users, color: 'text-blue-400' },
    { href: '/registrations', label: 'التسجيلات الجديدة', icon: UserPlus, color: 'text-teal-400' },
    { href: '/sessions', label: 'الحصص اليومية', icon: ClipboardList, color: 'text-sky-400' },
    { href: '/stats', label: 'المتابعة الأسبوعية', icon: Calendar, color: 'text-indigo-400' },
    { href: '/comparison', label: 'ساحة المقارنة', icon: Swords, color: 'text-red-400' },
    { href: '/dues', label: 'المستحقات المالية', icon: DollarSign, color: 'text-amber-400' },
    { href: '/reports/daily', label: 'التقرير اليومي', icon: Edit, color: 'text-rose-400' },
    { href: '/reports/student', label: 'تقرير الطالب', icon: FileText, color: 'text-fuchsia-400' },
    { href: '/ranking', label: 'ترتيب الطلبة', icon: Award, color: 'text-yellow-400' },
    { href: '/surahs', label: 'متابعة الحفظ', icon: BookCheck, color: 'text-lime-400' },
    { href: '/points', label: 'نظام النقاط', icon: Gavel, color: 'text-orange-400' },
    { href: '/data', label: 'البيانات', icon: ArrowRightLeft, color: 'text-cyan-400' },
    { href: '/guide', label: 'دليل الاستخدام', icon: HelpCircle, color: 'text-violet-400' },
    { href: '/profile', label: 'الملف الشخصي', icon: UserCog, color: 'text-gray-400' },
    { href: '/settings', label: 'الإعدادات', icon: Settings, color: 'text-gray-400' },
];


export default function HomePage() {
  const { user, updateUserProfile, logout } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { students, dailySessions, dailyReports, loading } = useStudentContext();

  const handleBackgroundChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      await updateUserProfile({ photoFile: file });
      toast({
        title: "✅ تم التحديث",
        description: "تم تحديث صورة الخلفية بنجاح.",
      });
    } catch (error) {
      // Error is handled in AuthContext
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div 
        className="min-h-screen w-full bg-cover bg-center bg-no-repeat relative flex flex-col items-center justify-center p-4"
        style={{backgroundImage: `url(${user?.photoURL || '/default-bg.jpg'})`}}
    >
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-black/30" />
        
        <div className="absolute top-4 right-4 z-10">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleBackgroundChange}
                accept="image/*"
                className="hidden"
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Camera className="ml-2 h-4 w-4" />}
                تخصيص الهوية البصرية
            </Button>
        </div>
        
        <div className="relative z-10 text-center mb-8 text-white">
            <h1 className="text-4xl font-bold text-amber-300 drop-shadow-lg">{user?.group || "فوج غير محدد"}</h1>
            <p className="text-lg opacity-90">{user?.displayName}</p>
        </div>
        
         <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 w-full max-w-6xl">
            {navItems.map((item) => (
                <Link
                    href={item.href}
                    key={item.href}
                    className="group bg-black/20 backdrop-blur-sm border border-white/20 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-white text-center transition-all duration-300 hover:bg-white/20 hover:scale-105 hover:shadow-lg"
                >
                    <item.icon className={cn("h-8 w-8 transition-colors", item.color)} />
                    <span className="text-sm font-semibold">{item.label}</span>
                </Link>
            ))}
             <button onClick={logout} className="group bg-red-800/50 backdrop-blur-sm border border-red-400/30 rounded-lg p-4 flex flex-col items-center justify-center gap-2 text-white text-center transition-all duration-300 hover:bg-red-700/80 hover:scale-105 hover:shadow-lg">
                <LogOut className="h-8 w-8 text-red-300" />
                <span className="text-sm font-semibold">تسجيل الخروج</span>
            </button>
        </div>

        <div className="relative z-10 w-full max-w-6xl mt-8 space-y-6">
            <DailyInspiration />
            <DailyChecklist />
            <GroupEvaluationCard students={students || []} sessions={dailySessions} reports={Object.values(dailyReports).flatMap(day => Object.values(day))} groupName={user?.group} />
        </div>
    </div>
  );
}
    

    