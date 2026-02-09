"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useStudentContext } from '@/context/StudentContext';
import { useToast } from '@/hooks/use-toast';
import { getYear, getMonth, format, parse, parseISO, subMonths, addMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { surahs } from '@/lib/surahs';
import { SessionType } from '@/lib/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Save,
  FileText,
  UserCheck,
  AlertTriangle,
  Trophy,
  Download,
  Trash2,
  Copy,
  MoreVertical,
  Dot,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Plus,
  Calendar as CalendarIcon,
  AlertCircle,
  Sparkles,
  ClipboardList,
  ListFilter,
  Edit
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ProtectedPage } from '@/components/ui/ProtectedPage';
import Link from 'next/link';
import { ClientLayout } from '@/components/ui/ClientLayout';

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
  // Admin View: Select Sheikh
  const { allUsers } = useStudentContext();
  const [selectedSheikhId, setSelectedSheikhId] = useState<string>('');

  const [sessionChoiceData, setSessionChoiceData] = useState<{ day: number, dateStr: string, sessions: any[] } | null>(null);

  // Calendar Logic
  const daysInMonth = useMemo(() => {
    const year = getYear(currentDate);
    const month = getMonth(currentDate);
    const date = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 1; i <= date.getDate(); i++) {
      days.push(i);
    }
    return days;
  }, [currentDate]);

  const firstDayOfMonth = useMemo(() => {
    return new Date(getYear(currentDate), getMonth(currentDate), 1).getDay();
  }, [currentDate]);

  const prevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const nextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const processIsFuture = (day: number) => {
    const today = new Date();
    const cellDate = new Date(getYear(currentDate), getMonth(currentDate), day);
    return cellDate > today;
  };

  const GetSessionTypeColor = (type: SessionType) => {
    switch (type) {
      case 'حصة أساسية': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'حصة تعويضية': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'غياب الشيخ': return 'bg-rose-100 text-rose-700 border-rose-200';
      case 'حصة إضافية': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'يوم عطلة': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'حصة أنشطة': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-100';
    }
  };

  // Filter sessions based on selected Sheikh (for Admins)
  const filteredGetSessionsForDay = (date: string) => {
    const sessions = getSessionsForDay(date);
    if ((isSuperAdmin || isAdmin5) && selectedSheikhId) {
      return sessions.filter(s => s.ownerId === selectedSheikhId);
    }
    // If admin but no sheikh selected, show all? Or show none? 
    // Let's show all for now, or maybe just their own if they have any.
    // Actually, distinct behavior:
    // 1. If Admin & Selected Sheikh -> Show only that Sheikh's sessions
    // 2. If Admin & No Selection -> Show ALL sessions (Global View)
    return sessions;
  };

  const selectedSheikhName = useMemo(() => {
    return allUsers?.find(u => u.uid === selectedSheikhId)?.displayName || 'غير محدد';
  }, [allUsers, selectedSheikhId]);

  const handleDayClick = (day: number, sessionNumber?: 1 | 2) => {
    const newSelectedDay = new Date(getYear(currentDate), getMonth(currentDate), day);
    const dateStr = format(newSelectedDay, 'yyyy-MM-dd');
    const daySessions = filteredGetSessionsForDay(dateStr);

    // Construct URL with ownerId if selected
    const queryParams = new URLSearchParams();
    queryParams.set('date', dateStr);
    if (selectedSheikhId) {
      queryParams.set('ownerId', selectedSheikhId);
    }

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
      queryParams.set('session', sessionNumber.toString());
      router.push(`/sessions/register?${queryParams.toString()}`);
      return;
    }

    // إذا لم يتم تحديد رقم الحصة (النقر على الخلية نفسها)
    // نتحقق من عدد الحصص الموجودة
    if (daySessions.length >= 2) {
      setSessionChoiceData({ day, dateStr, sessions: daySessions });
    } else if (daySessions.length === 1) {
      // إذا كانت هناك حصة واحدة فقط، نفتحها مباشرة
      const existingSession = daySessions[0].sessionNumber;
      queryParams.set('session', existingSession.toString());
      router.push(`/sessions/register?${queryParams.toString()}`);
    } else {
      // لا توجد حصص -> نفتح الحصة 1 افتراضياً
      queryParams.set('session', '1');
      router.push(`/sessions/register?${queryParams.toString()}`);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string, date: string) => {
    e.stopPropagation();
    deleteDailySession(sessionId, date);
    toast({ title: "تم الحذف", description: `تم حذف بيانات الحصة بنجاح.` });
  }

  const handleAddExtraSession = () => {
    if (!extraSessionDate) {
      toast({ title: "خطأ", description: "يرجى اختيار التاريخ", variant: "destructive" });
      return;
    }

    const daySessions = filteredGetSessionsForDay(extraSessionDate);

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
    const queryParams = new URLSearchParams();
    queryParams.set('date', extraSessionDate);
    queryParams.set('session', sessionNumToOpen.toString());
    if (selectedSheikhId) {
      queryParams.set('ownerId', selectedSheikhId);
    }
    router.push(`/sessions/register?${queryParams.toString()}`);
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

  // View Mode State
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const handleQuickAddSession = () => {
    setIsAddExtraDialogOpen(true);
    setExtraSessionDate(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <ClientLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-20">

        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                <ClipboardList className="w-6 h-6" />
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white font-headline">
                سجل الحصص اليومية
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-lg leading-relaxed">
              -إدارة الحضور، التقييم، ومتابعة أداء الفوج
              {selectedSheikhId && <span className="mr-2 text-primary font-bold">(عرض: {allUsers.find(u => u.uid === selectedSheikhId)?.displayName})</span>}
              -
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto relative z-10">
            {/* Admin: Sheikh Selector */}
            {(isSuperAdmin || isAdmin5) && allUsers && (
              <div className="w-full sm:w-64">
                <Select value={selectedSheikhId} onValueChange={setSelectedSheikhId}>
                  <SelectTrigger className="h-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl shadow-sm hover:border-primary/50 transition-colors">
                    <SelectValue placeholder="اختر الشيخ / الفوج" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_sheikhs">كل الأفواج (عرض فقط)</SelectItem>
                    {/* Add current admin to list if they have a group */}
                    {allUsers.find(u => u.uid === user?.uid)?.group && (
                      <SelectItem value={user?.uid || 'current'}>مجموعتي</SelectItem>
                    )}
                    {allUsers
                      .filter(u => u.role === 'sheikh' || u.role === 'super_admin')
                      .map(u => (
                        <SelectItem key={u.uid} value={u.uid}>
                          {u.displayName || 'مستخدم'} ({u.group || 'بدون فوج'})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex gap-2 bg-slate-100 dark:bg-white/5 p-1 rounded-xl">
              <Button
                variant={viewMode === 'calendar' ? 'white' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className={cn("rounded-lg flex-1", viewMode === 'calendar' && "shadow-sm text-primary font-bold")}
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                التقويم
              </Button>
              <Button
                variant={viewMode === 'list' ? 'white' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className={cn("rounded-lg flex-1", viewMode === 'list' && "shadow-sm text-primary font-bold")}
              >
                <ListFilter className="w-4 h-4 mr-2" />
                القائمة
              </Button>
            </div>

            <Button
              onClick={handleQuickAddSession}
              className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20 hover:scale-105 transition-all font-bold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white"
            >
              <Plus className="w-5 h-5 ml-2" />
              تسجيل حصة
            </Button>
          </div>
        </div>

        {/* Global Progress Widget */}
        {!selectedSheikhId && isAdmin5 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Global stats can go here */}
          </div>
        )}

        {viewMode === 'calendar' ? (
          <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden relative">
            {/* Calendar Header with Navigation */}
            <div className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/5 backdrop-blur-sm">
              <Button variant="ghost" size="icon" onClick={prevMonth} className="hover:bg-white dark:hover:bg-white/10 rounded-xl">
                <ChevronRight className="w-6 h-6" />
              </Button>
              <h2 className="text-2xl font-black font-headline text-slate-800 dark:text-slate-100">
                {format(currentDate, 'MMMM', { locale: ar })}
                <span className="text-primary mr-2 font-handwriting text-3xl font-normal opacity-80">
                  {format(currentDate, 'yyyy')}
                </span>
              </h2>
              <Button variant="ghost" size="icon" onClick={nextMonth} className="hover:bg-white dark:hover:bg-white/10 rounded-xl">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </div>

            {/* Calendar Grid */}
            <div className="p-6">
              <div className="grid grid-cols-7 gap-4 mb-2 text-center">
                {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((day) => (
                  <div key={day} className="font-bold text-slate-400 dark:text-slate-500 text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 sm:gap-4">
                {/* Empty Cells */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-[4/5] sm:aspect-square" />
                ))}

                {/* Days */}
                {daysInMonth.map((day) => {
                  const dateStr = format(new Date(getYear(currentDate), getMonth(currentDate), day), 'yyyy-MM-dd');
                  const sessions = filteredGetSessionsForDay(dateStr);
                  const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                  const isFuture = processIsFuture(day);

                  return (
                    <div
                      key={day}
                      onClick={() => !isFuture && handleDayClick(day)}
                      className={cn(
                        "aspect-[4/5] sm:aspect-square rounded-2xl relative group transition-all duration-300 border-2 flex flex-col items-center justify-start py-2 sm:py-3 cursor-pointer overflow-hidden",
                        isToday
                          ? "border-primary bg-primary/5 dark:bg-primary/10 ring-4 ring-primary/10 z-10 scale-105 shadow-lg shadow-primary/10"
                          : "border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] hover:border-primary/30 hover:shadow-md",
                        isFuture && "opacity-40 cursor-not-allowed grayscale"
                      )}
                    >
                      {/* Date Number */}
                      <span className={cn(
                        "text-lg sm:text-xl font-bold mb-1 sm:mb-2 transition-colors",
                        isToday ? "text-primary" : "text-slate-700 dark:text-slate-300 group-hover:text-primary"
                      )}>
                        {day}
                      </span>

                      {/* Sessions Indicators */}
                      <div className="w-full px-1 sm:px-2 space-y-1 sm:space-y-1.5 overflow-y-auto custom-scrollbar flex-1">
                        {sessions.map((session, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "text-[9px] sm:text-[10px] font-bold px-1.5 py-1 rounded-lg text-center truncate shadow-sm border border-black/5",
                              GetSessionTypeColor(session.sessionType),
                              "animate-in zoom-in duration-300 slide-in-from-bottom-1"
                            )}
                          >
                            <span className="block opacity-90">{session.sessionType}</span>
                            {session.sessionNumber && <span className="block opacity-70 text-[8px]">حصة {session.sessionNumber}</span>}
                          </div>
                        ))}

                        {/* Empty State / Add Button (Hover) */}
                        {sessions.length === 0 && !isFuture && (
                          <div className="hidden group-hover:flex items-center justify-center h-full opacity-50">
                            <Plus className="w-6 h-6 text-primary" />
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          // LIST VIEW
          <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-100 dark:border-white/5 shadow-xl overflow-hidden p-6 space-y-4">
            {daysInMonth.slice().reverse().map(day => {
              const dateStr = format(new Date(getYear(currentDate), getMonth(currentDate), day), 'yyyy-MM-dd');
              const sessions = filteredGetSessionsForDay(dateStr);
              if (sessions.length === 0) return null;

              return (
                <div key={dateStr} className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-400 mr-2 border-b border-dashed border-slate-200 pb-1 mb-2 inline-block">
                    {format(new Date(dateStr), 'EEEE, d MMMM yyyy', { locale: ar })}
                  </h3>
                  <div className="grid gap-3">
                    {sessions.map(session => (
                      <div key={session.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-primary/30 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner", GetSessionTypeColor(session.sessionType))}>
                            {session.sessionType === 'حصة أساسية' ? '📖' : session.sessionType === 'حصة تعويضية' ? '🔄' : session.sessionType === 'غياب الشيخ' ? '❌' : session.sessionType === 'حصة إضافية' ? '➕' : '🎉'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-900 dark:text-white">{session.sessionType}</h4>
                              {(isSuperAdmin || isAdmin5) && !selectedSheikhId && (
                                <span className="text-xs bg-slate-200 dark:bg-white/10 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-400">
                                  {allUsers.find(u => u.uid === session.ownerId)?.displayName || 'غير محدد'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                              <span>{session.sessionNumber ? `حصة ${session.sessionNumber}` : 'بدون رقم'}</span>
                              <span className="w-1 h-1 bg-slate-300 rounded-full" />
                              <span>{session.records?.length || 0} طالباً ({session.records?.filter((r: any) => r.attendance === 'حاضر').length || 0} حضور)</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link
                            href={`/sessions/register?date=${dateStr}&session=${session.sessionNumber || 1}${selectedSheikhId ? `&ownerId=${selectedSheikhId}` : ''}`}
                            className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), "rounded-xl hover:bg-blue-50 text-blue-600")}
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteSession(e, session.id, dateStr)}
                            className="rounded-xl hover:bg-rose-50 text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Empty State for List */}
            {daysInMonth.every(day => filteredGetSessionsForDay(format(new Date(getYear(currentDate), getMonth(currentDate), day), 'yyyy-MM-dd')).length === 0) && (
              <div className="text-center py-20 opacity-50">
                <ClipboardList className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p>لا توجد حصص مسجلة في هذا الشهر</p>
                <Button variant="link" onClick={handleQuickAddSession} className="text-primary mt-2 cursor-pointer">تسجيل حصة جديدة</Button>
              </div>
            )}
          </div>
        )}

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
                    const queryParams = new URLSearchParams();
                    queryParams.set('date', sessionChoiceData.dateStr);
                    queryParams.set('session', session.sessionNumber.toString());
                    if (selectedSheikhId) {
                      queryParams.set('ownerId', selectedSheikhId);
                    }
                    router.push(`/sessions/register?${queryParams.toString()}`);
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
        {(!isSuperAdmin || selectedSheikhId) && (
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
    </ClientLayout>
  );
}
