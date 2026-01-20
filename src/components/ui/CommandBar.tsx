
"use client";

import React from 'react';
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
  FileText, User, ChevronsRight, DollarSign, ArrowRightLeft, HelpCircle, PieChart
} from 'lucide-react';
import type { Student } from '@/lib/types';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface CommandBarProps {
  students: Student[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  router: AppRouterInstance;
}

const mainActions = [
  { name: "الرؤى والتحليلات", icon: <PieChart className="ml-2 h-4 w-4" />, href: "/insights" },
  { name: "إدارة الطلبة", icon: <Users className="ml-2 h-4 w-4" />, href: "/" },
  { name: "الحصص اليومية", icon: <ClipboardList className="ml-2 h-4 w-4" />, href: "/sessions" },
  { name: "المستحقات المالية", icon: <DollarSign className="ml-2 h-4 w-4" />, href: "/dues" },
  { name: "الإحصائيات الشهرية", icon: <BarChart3 className="ml-2 h-4 w-4" />, href: "/reports/monthly" },
  { name: "ترتيب الطلبة", icon: <Award className="ml-2 h-4 w-4" />, href: "/ranking" },
  { name: "متابعة الحفظ", icon: <BookCheck className="ml-2 h-4 w-4" />, href: "/surahs" },
  { name: "استيراد/تصدير", icon: <ArrowRightLeft className="ml-2 h-4 w-4" />, href: "/data" },
  { name: "دليل الاستخدام", icon: <HelpCircle className="ml-2 h-4 w-4" />, href: "/guide" },
  { name: "الإعدادات", icon: <Settings className="ml-2 h-4 w-4" />, href: "/settings" },
];

export function CommandBar({ students, isOpen, onOpenChange, router }: CommandBarProps) {

  const handleSelect = (callback: () => void) => {
    onOpenChange(false);
    callback();
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={onOpenChange}>
      <CommandInput placeholder="ابحث عن طالب أو انتقل إلى صفحة..." />
      <CommandList>
        <CommandEmpty>لم يتم العثور على نتائج.</CommandEmpty>

        <CommandGroup heading="الطلبة">
          {(students ?? []).filter(s => s.status === 'نشط').slice(0, 5).map((student) => (
            <CommandItem
              key={student.id}
              value={student.fullName}
              onSelect={() => handleSelect(() => router.push(`/reports/student`))}
              className="flex justify-between items-center"
            >
              <div className="flex items-center">
                <User className="ml-2 h-4 w-4" />
                <span>{student.fullName}</span>
              </div>
              <div className="flex items-center gap-2 opacity-60 text-xs">
                <span>عرض التقرير</span>
                <ChevronsRight className="h-4 w-4" />
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="الانتقال السريع">
          {mainActions.map((action) => (
            <CommandItem key={action.href} onSelect={() => handleSelect(() => router.push(action.href))}>
              {action.icon}
              <span>{action.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  );
}
