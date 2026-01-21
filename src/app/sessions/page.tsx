"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, parse, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { surahs } from '@/lib/surahs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, FileText, UserCheck, AlertTriangle, Trophy, Download, Trash2, Copy, MoreVertical, Dot, ChevronRight, ChevronLeft, BookOpen } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProtectedPage } from '@/components/ui/ProtectedPage';

// Custom Components
import { SessionCalendar } from '@/components/sessions/SessionCalendar';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';

export default function DailySessionsPage() {
  const { user, isSuperAdmin } = useAuth();
  const { students, dailySessions, loading, getSessionsForDay, addDailySession, deleteDailySession, getSessionById } = useStudentContext();
  const { toast } = useToast();
  const router = useRouter();

  const isAdmin5 = user?.email === 'admin5@gmail.com';

  const globalProgress = useMemo(() => {
    if (!isAdmin5 || !dailySessions) return null;
    const allSessions = Object.values(dailySessions).flatMap(day => Object.values(day as Record<string, any>));
    const sortedSessions = allSessions
      .filter(s => s.sessionType === 'حصة أساسية' && s.surahId)
      .sort((a, b) => b.date.localeCompare(a.date));

    const latest = sortedSessions[0];
    if (!latest) return { surahId: 26, fromVerse: 1, toVerse: 1, surahName: 'الشعراء', totalVerses: 227 };

    const surah = surahs.find(s => s.id === latest.surahId);
    return {
      surahId: latest.surahId,
      fromVerse: latest.fromVerse,
      toVerse: latest.toVerse,
      surahName: surah?.name || '',
      totalVerses: surah?.verses || 100
    };
  }, [dailySessions, isAdmin5]);

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

    const date = parse(session.date, 'yyyy-MM-dd', new Date());
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
          const surah = (session.surahId)
            ? surahs.find(s => s.id === session.surahId)
            : (record.surahId ? surahs.find(s => s.id === record.surahId) : null);
          return {
            ...baseInfo,
            'التقييم': record.memorization || '',
            'مراجعة': record.review ? 'نعم' : 'لا',
            'السورة': surah ? surah.name : '',
            'من آية': (session.fromVerse || record.fromVerse) || '',
            'إلى آية': (session.toVerse || record.toVerse) || ''
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

        {isAdmin5 && globalProgress && (
          <div className="bg-card p-6 rounded-2xl shadow-sm border space-y-4 animate-in fade-in slide-in-from-top-4 duration-1000">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 rounded-xl text-emerald-700">
                  <BookOpen className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-headline font-bold">التقدم الحالي في السورة</h2>
                  <p className="text-muted-foreground text-sm font-body">متابعة الحفظ الجماعي للفوج</p>
                </div>
              </div>
              <div className="text-left">
                <span className="text-2xl font-bold text-emerald-600 font-headline">{globalProgress.surahName}</span>
                <p className="text-xs text-muted-foreground">الآية {globalProgress.toVerse} من {globalProgress.totalVerses}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-muted-foreground px-1">
                <span>0%</span>
                <span>{Math.round((globalProgress.toVerse / globalProgress.totalVerses) * 100)}%</span>
                <span>100%</span>
              </div>
              <Progress value={(globalProgress.toVerse / globalProgress.totalVerses) * 100} className="h-3 bg-emerald-50" />
            </div>
          </div>
        )}

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
