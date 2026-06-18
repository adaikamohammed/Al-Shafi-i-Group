"use client";

import React, { useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from "@/components/ui/command";
import {
  Users, ClipboardList, BarChart3, Settings, Award, BookCheck,
  FileText, User, ChevronsRight, DollarSign, ArrowRightLeft,
  HelpCircle, AlertTriangle, ShieldAlert, Sparkles, BookOpen,
  LayoutDashboard, Activity, Bell, Calendar, Home, Palette,
  Sparkle, ShieldCheck, UserCheck, Flame, Info
} from 'lucide-react';
import type { Student } from '@/lib/types';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useAuth } from '@/context/AuthContext';
import { canAccessPage } from '@/lib/permissions';
import { NAV_GROUPS } from '@/lib/navigation';
import { normalizeArabic } from '@/context/StudentContext';

interface GlobalSearchProps {
  students: Student[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  router: AppRouterInstance;
}

export function GlobalSearch({ students, isOpen, onOpenChange, router }: GlobalSearchProps) {
  const { user, role } = useAuth();

  const handleSelect = (callback: () => void) => {
    onOpenChange(false);
    callback();
  };

  // Flatten and filter NAV_GROUPS to get all accessible pages for quick navigation
  const searchableActions = useMemo(() => {
    const actions: Array<{
      label: string;
      href: string;
      icon: any;
      groupTitle: string;
      keywords: string;
    }> = [];

    NAV_GROUPS.forEach(group => {
      group.items.forEach(item => {
        // Special restriction for registrations page: ONLY admin00 can see it
        if ((item.href === '/registrations' || item.href === '/admin/entry-permit') && user?.email !== 'admin00@gmail.com') {
          return;
        }
        if (canAccessPage(item.href, role)) {
          const keywords = [
            normalizeArabic(item.label),
            item.label,
            normalizeArabic(group.title),
            group.title,
            item.href
          ].filter(Boolean).join(' ');

          actions.push({
            label: item.label,
            href: item.href,
            icon: item.icon,
            groupTitle: group.title,
            keywords
          });
        }
      });
    });

    return actions;
  }, [role, user?.email]);

  // Index students with comprehensive metadata for rich fuzzy filtering
  const indexedStudents = useMemo(() => {
    return (students ?? []).map(student => {
      // Build search keywords string
      const warningText = student.covenants?.map(c => c.text + ' ' + c.type).join(' ') || '';
      const groupName = student.groupName || '';
      
      const keywords = [
        normalizeArabic(student.fullName),
        student.fullName,
        normalizeArabic(groupName),
        groupName,
        student.phone1 || '',
        student.phone2 || '',
        student.guardianName ? normalizeArabic(student.guardianName) : '',
        normalizeArabic(warningText),
        student.status,
        student.educationalLevel ? normalizeArabic(student.educationalLevel) : '',
        student.pageNumber ? `صفحة ${student.pageNumber}` : ''
      ].filter(Boolean).join(' ');

      // Check if student has active warnings (covenants that are 'نشط')
      const activeCovenants = student.covenants?.filter(c => c.status === 'نشط') || [];

      return {
        ...student,
        groupName,
        keywords,
        activeCovenants
      };
    });
  }, [students]);

  // Filter students under active warning status to display in a dedicated alerts section
  const warningStudents = useMemo(() => {
    return indexedStudents.filter(s => s.activeCovenants.length > 0 && s.status === 'نشط');
  }, [indexedStudents]);

  return (
    <CommandDialog open={isOpen} onOpenChange={onOpenChange}>
      <CommandInput placeholder="ابحث عن اسم طالب، رقم هاتف، صفحة، أو سبب إنذار..." />
      <CommandList className="max-h-[400px] custom-scrollbar overflow-y-auto">
        <CommandEmpty className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
          <Info className="h-6 w-6 opacity-40 text-primary" />
          <span>لم نجد نتائج مطابقة لبحثك.</span>
        </CommandEmpty>

        {/* 1. Alerts / Warnings Section */}
        {warningStudents.length > 0 && (
          <CommandGroup heading="طلاب تحت الإنذار والمتابعة ⚠️">
            {warningStudents.slice(0, 5).map((student) => (
              <CommandItem
                key={`warning-${student.id}`}
                value={student.keywords}
                onSelect={() => handleSelect(() => router.push(`/reports/student?id=${student.id}`))}
                className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-rose-500/5 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-rose-500/10 text-rose-500">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="font-bold text-sm text-rose-600 dark:text-rose-400">{student.fullName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      فوج: {student.groupName || 'غير محدد'} | {student.activeCovenants[0]?.text || student.activeCovenants[0]?.type || 'تنبيه نشط'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-rose-500 font-bold bg-rose-500/10 px-2 py-0.5 rounded-full">
                  <span>متابعة</span>
                  <ChevronsRight className="h-3 w-3" />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* 2. Students Section */}
        {indexedStudents.length > 0 && (
          <CommandGroup heading="قائمة الطلاب 👨‍🎓">
            {indexedStudents.map((student) => {
              const isActive = student.status === 'نشط';
              const isSuspended = student.status === 'غائب طويل';
              const isExpelled = student.status === 'مطرود';

              return (
                <CommandItem
                  key={`student-${student.id}`}
                  value={student.keywords}
                  onSelect={() => handleSelect(() => router.push(`/reports/student?id=${student.id}`))}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : isSuspended 
                          ? 'bg-amber-500/10 text-amber-500'
                          : 'bg-slate-500/10 text-slate-500'
                    }`}>
                      <User className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col gap-0.5 text-right">
                      <span className="font-bold text-sm">{student.fullName}</span>
                      <span className="text-[10px] text-muted-foreground">
                        فوج: {student.groupName || 'غير محدد'} 
                        {student.pageNumber && ` | الورد: صفحة ${student.pageNumber}`}
                        {student.memorizedSurahsCount > 0 && ` | حفظ ${student.memorizedSurahsCount} سورة`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {student.activeCovenants.length > 0 && (
                      <span className="text-[10px] bg-rose-500/15 text-rose-500 px-2 py-0.5 rounded-full font-bold">
                        إنذار ساري
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isActive 
                        ? 'bg-emerald-500/10 text-emerald-500' 
                        : isSuspended 
                          ? 'bg-amber-500/10 text-amber-500' 
                          : isExpelled
                            ? 'bg-rose-500/10 text-rose-500'
                            : 'bg-slate-500/10 text-slate-500'
                    }`}>
                      {student.status}
                    </span>
                    <ChevronsRight className="h-4 w-4 opacity-40 mr-1" />
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* 3. Quick Navigation / Pages Section */}
        <CommandGroup heading="الانتقال السريع والصفحات 🚀">
          {searchableActions.map((action) => {
            const Icon = action.icon || FileText;
            return (
              <CommandItem
                key={`page-${action.href}`}
                value={action.keywords}
                onSelect={() => handleSelect(() => router.push(action.href))}
                className="flex items-center justify-between py-2 px-3 rounded-xl cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="font-bold text-sm">{action.label}</span>
                    <span className="text-[10px] text-muted-foreground">{action.groupTitle}</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground opacity-60 bg-muted px-2 py-1 rounded-md">
                  انتقال
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
