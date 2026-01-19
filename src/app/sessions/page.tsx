"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, FileText, UserCheck, AlertTriangle, Trophy, Download, Trash2, Copy, MoreVertical, Dot, ChevronRight, ChevronLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProtectedPage } from '@/components/ui/ProtectedPage';

// Custom Components
import { SessionCalendar } from '@/components/sessions/SessionCalendar';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';

export default function DailySessionsPage() {
  const { user, isSuperAdmin } = useAuth();
  const { students, loading, getSessionsForDay, addDailySession, deleteDailySession, getSessionById } = useStudentContext();
  const { toast } = useToast();
  const router = useRouter();

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const handleDayClick = (day: number, sessionNumber: 1 | 2 = 1) => {
    const newSelectedDay = new Date(getYear(currentDate), getMonth(currentDate), day);
    const dateStr = format(newSelectedDay, 'yyyy-MM-dd');
    const daySessions = getSessionsForDay(dateStr);

    // Validation: Cannot open Session 2 if Session 1 is explicitly missing
    if (sessionNumber === 2) {
      const session1 = daySessions.find(s => s.sessionNumber === 1);
      if (!session1) {
        toast({
          title: "تنبيه",
          description: "يجب تسجيل الحصة الأولى (الأساسية) قبل فتح الحصة الثانية (الإضافية).",
          variant: "destructive",
        });
        return;
      }
    }

    router.push(`/sessions/register?date=${dateStr}&session=${sessionNumber}`);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteDailySession(sessionId);
    toast({ title: "تم الحذف", description: `تم حذف بيانات الحصة بنجاح.` });
  }

  const handleExportSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent navigation
    const session = getSessionById(sessionId);

    if (!session) {
      toast({ title: "لا توجد بيانات", description: "لا توجد سجلات لهذه الحصة لتصديرها.", variant: "destructive" });
      return;
    }

    const date = parseISO(session.date);
    const dayName = format(date, 'EEEE', { locale: ar });
    const readableDate = format(date, 'dd/MM/yyyy');

    let dataForSheet;

    if (session.sessionType === 'يوم عطلة' || (session.sessionType === 'غياب الشيخ' && !session.substituteTeacher)) {
      dataForSheet = [{
        'التاريخ': readableDate, 'اليوم': dayName,
        'رقم الحصة': session.sessionNumber, 'نوع الحصة': session.sessionType,
        'ملاحظات': session.sessionType === 'غياب الشيخ' ? `سبب الغياب: ${session.teacherAbsenceReason || 'غير محدد'}` : 'يوم عطلة',
      }];
    } else {
      dataForSheet = (session.records ?? []).map((record: any) => {
        const student = (students ?? []).find(s => s.id === record.studentId);
        const isActivity = session.sessionType === 'حصة أنشطة';
        const baseInfo = {
          'التاريخ': readableDate, 'اليوم': dayName,
          'رقم الحصة': session.sessionNumber, 'نوع الحصة': session.sessionType,
          'اسم الطالب': student?.fullName || 'غير معروف', 'الحاضر': record.attendance || '',
          'السلوك': record.behavior || '',
          'ملاحظات': record.notes || '',
        };

        if (isActivity) {
          return { ...baseInfo, 'نوع النشاط': session.activityType, 'وصف النشاط': session.activityDescription };
        } else {
          return {
            ...baseInfo,
            'التقييم': record.memorization || '',
            'مراجعة': record.review ? 'نعم' : 'لا'
          };
        }
      });
    }

    const ws = XLSX.utils.json_to_sheet(dataForSheet);
    ws['!cols'] = [
      { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `سجل حصة ${session.id}`);
    XLSX.writeFile(wb, `سجل_حصة_${session.id}.xlsx`);
  }

  if (loading) {
    return (
      <ProtectedPage>
        <div className="flex items-center justify-center p-8 h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProtectedPage>
    )
  }

  return (
    <ProtectedPage>
      <div className="container mx-auto p-4 space-y-8 pb-32 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-headline font-bold text-gray-900">سجل الحصص اليومية</h1>
            <p className="text-muted-foreground font-body text-lg">إدارة الحضور، التقييم، ومتابعة أداء الفوج.</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
            <Trophy className="h-5 w-5 text-emerald-600" />
            <span className="font-bold text-emerald-800 font-headline">الدوري نشط</span>
          </div>
        </div>

        <SessionCalendar
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          onDayClick={handleDayClick}
          getSessionsForDay={getSessionsForDay}
          isSuperAdmin={isSuperAdmin}
          onDeleteSession={handleDeleteSession}
          onExportSession={handleExportSession}
        />
      </div>
    </ProtectedPage>
  );
}
