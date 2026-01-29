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
import { SessionType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, FileText, UserCheck, AlertTriangle, Trophy, Download, Trash2, Copy, MoreVertical, Dot, ChevronRight, ChevronLeft, BookOpen, Plus, Calendar as CalendarIcon, AlertCircle, Sparkles } from 'lucide-react';
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
  const [isAddExtraDialogOpen, setIsAddExtraDialogOpen] = useState(false);
  const [extraSessionDate, setExtraSessionDate] = useState('');
  const [extraSessionType, setExtraSessionType] = useState<SessionType>('حصة أساسية');
  const [extraSessionNumber, setExtraSessionNumber] = useState<1 | 2>(1);
  const [sessionChoiceData, setSessionChoiceData] = useState<{ day: number, dateStr: string, sessions: any[] } | null>(null);
  const handleDayClick = (day: number, sessionNumber?: 1 | 2) => {
    const newSelectedDay = new Date(getYear(currentDate), getMonth(currentDate), day);
    const dateStr = format(newSelectedDay, 'yyyy-MM-dd');
    const daySessions = getSessionsForDay(dateStr);

    // إذا تم تحديد رقم الحصة مسبقاً (عبر النقر المباشر على ماركة الحصة)
    if (sessionNumber) {
      // التحقق من وجود الحصة الأولى قبل فتح الحصة الثانية
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
      return;
    }

    // إذا لم يتم تحديد رقم الحصة (النقر على الخلية نفسها)
    // نتحقق من عدد الحصص الموجودة
    if (daySessions.length >= 2) {
      setSessionChoiceData({ day, dateStr, sessions: daySessions });
    } else if (daySessions.length === 1) {
      // إذا كانت الحصة 1 موجودة، نفتح الحصة 2
      const nextSession = daySessions[0].sessionNumber === 1 ? 2 : 1;
      router.push(`/sessions/register?date=${dateStr}&session=${nextSession}`);
    } else {
      // لا توجد حصص -> نفتح الحصة 1 افتراضياً
      router.push(`/sessions/register?date=${dateStr}&session=1`);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteDailySession(sessionId);
    toast({ title: "تم الحذف", description: `تم حذف بيانات الحصة بنجاح.` });
  }

  const handleAddExtraSession = () => {
    if (!extraSessionDate) {
      toast({ title: "خطأ", description: "يرجى اختيار التاريخ", variant: "destructive" });
      return;
    }

    const daySessions = getSessionsForDay(extraSessionDate);

    // التحقق من عدد الحصص
    if (daySessions.length >= 2) {
      toast({
        title: "تنبيه",
        description: "لا يمكن إضافة أكثر من حصتين في اليوم الواحد.",
        variant: "destructive",
      });
      return;
    }

    // تحديد رقم الحصة المفقودة تلقائياً
    const existingSession1 = daySessions.find(s => s.sessionNumber === 1);
    const sessionNumToOpen = existingSession1 ? 2 : 1;

    // التحقق من وجود الحصة الأولى إذا كان المستخدم يريد إضافة الحصة الثانية
    if (sessionNumToOpen === 2 && !existingSession1) {
      toast({
        title: "تنبيه",
        description: "يجب تسجيل الحصة الأولى (الأساسية) قبل إضافة الحصة الثانية (الإضافية).",
        variant: "destructive",
      });
      return;
    }

    // الانتقال إلى صفحة تسجيل الحصة
    router.push(`/sessions/register?date=${extraSessionDate}&session=${sessionNumToOpen}`);
    setIsAddExtraDialogOpen(false);
  };

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

        {/* Session Choice Dialog */}
        <Dialog open={!!sessionChoiceData} onOpenChange={() => setSessionChoiceData(null)}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-xl font-headline">اختر الحصة</DialogTitle>
              <DialogDescription className="font-body">
                هذا اليوم يحتوي على أكثر من حصة مسجلة. اختر الحصة التي تريد تعديلها:
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-3 py-4">
              {sessionChoiceData?.sessions.sort((a, b) => a.sessionNumber - b.sessionNumber).map((session) => (
                <Button
                  key={session.id}
                  variant="outline"
                  className="h-16 rounded-xl flex items-center justify-between px-6 hover:bg-emerald-50 hover:border-emerald-200 transition-all group"
                  onClick={() => {
                    router.push(`/sessions/register?date=${sessionChoiceData.dateStr}&session=${session.sessionNumber}`);
                    setSessionChoiceData(null);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700 group-hover:scale-110 transition-transform">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">حصة {session.sessionNumber === 1 ? 'أساسية' : 'إضافية'}</div>
                      <div className="text-xs text-muted-foreground">{session.sessionType}</div>
                    </div>
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground group-hover:translate-x-[-4px] transition-transform" />
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Floating Action Button */}
        {!isSuperAdmin && (
          <Button
            onClick={() => setIsAddExtraDialogOpen(true)}
            className="fixed bottom-8 left-8 h-16 w-16 rounded-full shadow-2xl z-50 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 transition-all duration-300 hover:scale-110"
            size="icon"
          >
            <Plus className="h-8 w-8" />
          </Button>
        )}

        {/* Add Extra Session Dialog */}
        <Dialog open={isAddExtraDialogOpen} onOpenChange={setIsAddExtraDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline">إضافة حصة إضافية</DialogTitle>
              <DialogDescription className="font-body">
                اختر التاريخ ونوع الحصة ورقم الحصة لإضافة حصة جديدة للفوج.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Date Selection */}
              <div className="space-y-2">
                <Label htmlFor="extra-date" className="text-base font-semibold flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  التاريخ
                </Label>
                <Input
                  id="extra-date"
                  type="date"
                  value={extraSessionDate}
                  onChange={(e) => setExtraSessionDate(e.target.value)}
                  className="text-right"
                />
              </div>

              {/* Session Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="extra-type" className="text-base font-semibold">نوع الحصة</Label>
                <Select value={extraSessionType} onValueChange={(value) => setExtraSessionType(value as SessionType)}>
                  <SelectTrigger id="extra-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="حصة أساسية">حصة أساسية</SelectItem>
                    <SelectItem value="حصة أنشطة">حصة أنشطة</SelectItem>
                    <SelectItem value="حصة إضافية">حصة إضافية</SelectItem>
                    <SelectItem value="غياب الشيخ">غياب الشيخ</SelectItem>
                    <SelectItem value="يوم عطلة">يوم عطلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Session Number Auto Selection Info */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-emerald-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-900 text-sm">التحديد التلقائي لرقم الحصة</p>
                  <p className="text-xs text-emerald-700 leading-relaxed font-body">
                    سيقوم النظام تلقائياً بفتح "الحصة الثانية" إذا كانت الحصة الأساسية مسجلة مسبقاً، أو "الحصة الأولى" إذا لم يتم تسجيل أي حصة بعد.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddExtraDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={handleAddExtraSession} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600">
                <Plus className="ml-2 h-4 w-4" />
                إضافة الحصة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedPage>
  );
}
