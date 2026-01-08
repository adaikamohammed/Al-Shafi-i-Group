
"use client";

import React, { useState, useEffect } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Users, ClipboardList, BarChart3, Settings, Award, BookCheck } from 'lucide-react';
import type { Student } from '@/lib/types';
import { useRouter } from 'next/navigation';

interface CommandBarProps {
  students: Student[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const mainActions = [
    { name: "إدارة الطلبة", icon: <Users className="mr-2 h-4 w-4" />, href: "/" },
    { name: "الحصص اليومية", icon: <ClipboardList className="mr-2 h-4 w-4" />, href: "/sessions" },
    { name: "الإحصائيات", icon: <BarChart3 className="mr-2 h-4 w-4" />, href: "/reports/monthly" },
    { name: "ترتيب الطلبة", icon: <Award className="mr-2 h-4 w-4" />, href: "/ranking" },
    { name: "متابعة الحفظ", icon: <BookCheck className="mr-2 h-4 w-4" />, href: "/surahs" },
    { name: "الإعدادات", icon: <Settings className="mr-2 h-4 w-4" />, href: "/settings" },
];

export function CommandBar({ students, isOpen, onOpenChange }: CommandBarProps) {
  const router = useRouter();

  const handleSelectStudent = (studentId: string) => {
    onOpenChange(false);
    router.push(`/reports/student?studentId=${studentId}`);
  };

  const handleSelectAction = (href: string) => {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={isOpen} onOpenChange={onOpenChange}>
      <CommandInput placeholder="ابحث عن طالب أو مهمة..." />
      <CommandList>
        <CommandEmpty>لم يتم العثور على نتائج.</CommandEmpty>
        
        <CommandGroup heading="الطلبة">
          {students.filter(s => s.status === 'نشط').map((student) => (
            <CommandItem
              key={student.id}
              value={student.fullName}
              onSelect={() => handleSelectStudent(student.id)}
            >
              <span>{student.fullName}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="الإجراءات السريعة">
            {mainActions.map((action) => (
                <CommandItem key={action.href} onSelect={() => handleSelectAction(action.href)}>
                   {action.icon}
                   <span>{action.name}</span>
                </CommandItem>
            ))}
        </CommandGroup>

      </CommandList>
    </CommandDialog>
  );
}
