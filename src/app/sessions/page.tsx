"use client";

import React, { useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
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

// Custom Components
import { SessionCalendar } from '@/components/sessions/SessionCalendar';
import { AttendanceList, AttendanceRecord } from '@/components/sessions/AttendanceList';
import { SessionStatsWidget } from '@/components/sessions/SessionStatsWidget';

export default function DailySessionsPage() {
  const { user, isSuperAdmin } = useAuth();
  const { students, loading, getSessionsForDay, addDailySession, deleteDailySession, getSessionById } = useStudentContext();
  const { toast } = useToast();

  // State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [sessionToOpen, setSessionToOpen] = useState<1 | 2>(1);
  const [isSessionDialogOpen, setSessionDialogOpen] = useState(false);

  // Session Data State
  const [sessionType, setSessionType] = useState<'حصة أساسية' | 'حصة تعويضية' | 'يوم عطلة' | 'غياب الشيخ' | 'حصة أنشطة'>('حصة أساسية');
  const [teacherAbsenceReason, setTeacherAbsenceReason] = useState('');
  const [substituteTeacher, setSubstituteTeacher] = useState('');
  const [activityType, setActivityType] = useState(''); // New: Type of activity
  const [activityDescription, setActivityDescription] = useState(''); // New: Description of activity
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Helpers
  const activeStudents = useMemo(() =>
    (students ?? []).filter(s => {
      const isGroupMatch = isSuperAdmin ? true : s.groupName === user?.group;
      return s.status === "نشط" && isGroupMatch;
    }).sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar')),
    [students, isSuperAdmin, user]);


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

    setSelectedDay(newSelectedDay);
    setSessionToOpen(sessionNumber);

    // Load existing session data if available
    const existingSession = daySessions.find(s => s.sessionNumber === sessionNumber);

    if (existingSession) {
      setSessionType(existingSession.sessionType as any);
      setTeacherAbsenceReason(existingSession.teacherAbsenceReason || '');
      setSubstituteTeacher(existingSession.substituteTeacher || '');
      setActivityType(existingSession.activityType || '');
      setActivityDescription(existingSession.activityDescription || '');

      const records: any = {};
      existingSession.records?.forEach((record: any) => {
        records[record.studentId] = {
          attendance: record.attendance,
          memorization: record.memorization,
          behavior: record.behavior,
          notes: record.notes,
          review: record.review
        };
      });
      setAttendanceRecords(records);
    } else {
      // Reset for new session
      setSessionType(sessionNumber === 1 ? 'حصة أساسية' : 'حصة تعويضية');
      setTeacherAbsenceReason('');
      setSubstituteTeacher('');
      setActivityType('');
      setActivityDescription('');
      setAttendanceRecords({});
    }

    setSessionDialogOpen(true);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteDailySession(sessionId);
    toast({ title: "تم الحذف", description: `تم حذف بيانات الحصة بنجاح.` });
  }

  const handleExportSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent dialog from opening
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

  const handleSaveSession = async () => {
    if (!selectedDay) return;
    setIsSaving(true);

    try {
      const dateStr = format(selectedDay, 'yyyy-MM-dd');
      const existingSessions = getSessionsForDay(dateStr);
      const existingSession = existingSessions.find(s => s.sessionNumber === sessionToOpen);
      const id = existingSession ? existingSession.id : `${dateStr}-s${sessionToOpen}-${Date.now()}`;

      const recordsArray = Object.entries(attendanceRecords).map(([studentId, data]) => ({
        studentId,
        ...data
      })).filter(r => r.attendance); // Only save records where attendance is marked

      const sessionData = {
        id,
        date: dateStr,
        sessionNumber: sessionToOpen,
        sessionType,
        teacherAbsenceReason: sessionType === 'غياب الشيخ' ? teacherAbsenceReason : null,
        substituteTeacher: (sessionType === 'غياب الشيخ' && substituteTeacher) ? substituteTeacher : null,
        activityType: sessionType === 'حصة أنشطة' ? activityType : null,
        activityDescription: sessionType === 'حصة أنشطة' ? activityDescription : null,
        records: recordsArray
      };

      await addDailySession(sessionData);
      setSessionDialogOpen(false);
      toast({
        title: "تم الحفظ بنجاح",
        description: `تم تسجيل بيانات الحصة ${sessionToOpen} ليوم ${format(selectedDay, 'dd/MM/yyyy')}`,
      });
    } catch (error) {
      console.error("Error saving session:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCurrentSession = async (sessionId: string) => {
    if (confirm('هل أنت متأكد من حذف بيانات هذه الحصة؟ سيتم فقدان جميع سجلات الحضور والتقييم.')) {
      setIsSaving(true);
      try {
        deleteDailySession(sessionId);
        setSessionDialogOpen(false);
        toast({ title: "تم الحذف", description: "تم حذف بيانات الحصة بنجاح." });
      } catch (error) {
        toast({ title: "خطأ", description: "حدث خطأ أثناء الحذف.", variant: "destructive" });
      } finally {
        setIsSaving(false);
      }
    }
  };


  const handleUpdateRecord = (studentId: string, field: keyof AttendanceRecord, value: any) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { studentId, attendance: '', memorization: '', behavior: '', notes: '', review: false }),
        [field]: value,
        // Ensure attendance is 'حاضر' if it was empty and we're editing other fields
        attendance: field === 'attendance' ? value : (prev[studentId]?.attendance || 'حاضر')
      }
    }));
  };

  const handleMarkAllPresent = () => {
    setAttendanceRecords(prev => {
      const newRecords = { ...prev };
      activeStudents.forEach(student => {
        newRecords[student.id] = {
          ...(newRecords[student.id] || { memorization: '', behavior: '', notes: '', review: false }),
          studentId: student.id,
          attendance: 'حاضر'
        };
      });
      return newRecords;
    });
    toast({ title: "تم", description: "تم تحضير جميع الطلاب كـ 'حاضر'" });
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
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

      <Dialog open={isSessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-none rounded-[2rem]" dir="rtl">
          <DialogHeader className="p-6 pb-2 bg-muted/20">
            <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              تسجيل حصة: {selectedDay && format(selectedDay, 'd MMMM yyyy', { locale: ar })}
            </DialogTitle>
            <DialogDescription className="font-body">
              رقم الحصة: <span className="font-bold text-primary">{sessionToOpen}</span> (يوم {selectedDay && format(selectedDay, 'EEEE', { locale: ar })})
            </DialogDescription>
          </DialogHeader>


          <div className="p-4 bg-background border-b flex flex-col gap-3">
            {/* Stats Widget - Live Feedback */}
            {(sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية') && (
              <SessionStatsWidget students={activeStudents} records={attendanceRecords} />
            )}

            <div className="flex flex-col md:flex-row gap-3 items-end md:items-center justify-between">
              <div className="space-y-1 flex-1 w-full">
                <Label className="text-xs text-muted-foreground">نوع الحصة</Label>
                <Select value={sessionType} onValueChange={(val: any) => setSessionType(val)} dir="rtl">
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="حصة أساسية">حصة أساسية</SelectItem>
                    <SelectItem value="حصة أنشطة">حصة أنشطة 🏃‍♂️</SelectItem>
                    {/* Hide Compensation for Session 1 as per request */}
                    {sessionToOpen === 2 && <SelectItem value="حصة تعويضية">حصة تعويضية</SelectItem>}
                    <SelectItem value="يوم عطلة">يوم عطلة</SelectItem>
                    <SelectItem value="غياب الشيخ">غياب الشيخ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(sessionType === 'حصة أساسية' || sessionType === 'حصة تعويضية' || sessionType === 'حصة أنشطة' || (sessionType === 'غياب الشيخ' && substituteTeacher)) && (
                <Button size="sm" onClick={handleMarkAllPresent} variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 h-9 w-full md:w-auto whitespace-nowrap">
                  <UserCheck className="ml-2 h-4 w-4" /> تحضير الجميع
                </Button>
              )}
            </div>

            {/* Dynamic Inputs based on Type */}
            {sessionType === 'غياب الشيخ' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-1">
                  <Label className="text-xs">سبب الغياب</Label>
                  <Input value={teacherAbsenceReason} onChange={(e) => setTeacherAbsenceReason(e.target.value)} placeholder="السبب..." className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المستخلف (اختياري)</Label>
                  <Input value={substituteTeacher} onChange={(e) => setSubstituteTeacher(e.target.value)} placeholder="اسم البديل" className="h-8" />
                </div>
              </div>
            )}

            {sessionType === 'حصة أنشطة' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-1">
                  <Label className="text-xs">نوع النشاط</Label>
                  <Input value={activityType} onChange={(e) => setActivityType(e.target.value)} placeholder="مثال: كرة قدم..." className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">نبذة مختصرة</Label>
                  <Input value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} placeholder="وصف للنشاط..." className="h-8" />
                </div>
              </div>
            )}
          </div>

          <ScrollArea className="flex-1 p-4 bg-muted/5">
            {(sessionType === 'يوم عطلة' || (sessionType === 'غياب الشيخ' && !substituteTeacher)) ? (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-4 bg-amber-100 rounded-full text-amber-600">
                  <AlertTriangle className="h-10 w-10" />
                </div>
                <h3 className="text-lg font-bold font-headline">لا يوجد تسجيل حضور</h3>
                <p className="text-muted-foreground font-body max-w-sm text-sm">
                  {sessionType === 'يوم عطلة' ? 'هذا اليوم عطلة رسمية.' : 'يرجى تسجيل سبب الغياب أعلاه.'}
                </p>
              </div>
            ) : (
              <AttendanceList
                students={activeStudents}
                records={attendanceRecords}
                onUpdateRecord={handleUpdateRecord}
                sessionType={sessionType}
              />
            )}
          </ScrollArea>

          <DialogFooter className="p-4 bg-background border-t flex items-center justify-between sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSessionDialogOpen(false)} className="h-9">إلغاء</Button>
              {selectedDay && getSessionsForDay(format(selectedDay, 'yyyy-MM-dd')).find(s => s.sessionNumber === sessionToOpen) && (
                <Button
                  variant="destructive"
                  onClick={() => {
                    const session = getSessionsForDay(format(selectedDay, 'yyyy-MM-dd')).find(s => s.sessionNumber === sessionToOpen);
                    if (session) handleDeleteSession(session.id);
                  }}
                  className="h-9 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                >
                  <Trash2 className="h-4 w-4 ml-1" /> حذف البيانات
                </Button>
              )}
            </div>
            <Button onClick={handleSaveSession} disabled={isSaving} className="min-w-[120px] h-9">
              {isSaving ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
              حفظ الحصة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
