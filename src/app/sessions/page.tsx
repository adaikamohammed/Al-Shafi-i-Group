

"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useStudentContext } from '@/context/StudentContext';
import { useAuth } from '@/context/AuthContext';
import type { DailyRecord, SessionType, AttendanceStatus, PerformanceLevel, BehaviorLevel, Student, DailySession } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ArrowLeft, ArrowRight, Loader2, Download, MoreVertical, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { format, getMonth, getYear, setMonth, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths, isPast, isToday, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const sessionTypeDescriptions: { [key in SessionType]: string } = {
  'حصة أساسية': 'الحصة العادية لحفظ ومراجعة القرآن.',
  'حصة أنشطة': 'حصة مخصصة للأنشطة والترفيه، لا تتضمن حفظاً أو مراجعة.',
  'يوم عطلة': 'يوم لا توجد فيه حصص دراسية لجميع الطلبة.',
  'حصة تعويضية': 'حصة لتعويض طالب أو أكثر عن يوم غابوا فيه.'
};

const attendanceOptions: AttendanceStatus[] = ["حاضر", "غائب", "متأخر", "تعويض"];
const sessionTypeOptions: SessionType[] = ["حصة أساسية", "حصة أنشطة", "يوم عطلة", "حصة تعويضية"];


export default function DailySessionsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isSessionDialogOpen, setSessionDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const { students, dailySessions, loading, getSessionForDate, addDailySession, deleteDailySession } = useStudentContext();
  const activeStudents = useMemo(() => 
    (students ?? []).filter(s => s.status === "نشط"), 
  [students]);

  const handleDayClick = (day: number) => {
    const newSelectedDay = new Date(getYear(currentDate), getMonth(currentDate), day);
    setSelectedDay(newSelectedDay);
    setSessionDialogOpen(true);
  };
  
  const handleMonthChange = (monthIndex: number) => {
    setCurrentDate(setMonth(currentDate, monthIndex));
  };

  const handleYearChange = (offset: number) => {
      setCurrentDate(prev => offset > 0 ? addMonths(prev, 12) : subMonths(prev, 12));
  }
  
  const handleDeleteDay = (e: React.MouseEvent, day: number) => {
    e.stopPropagation();
    const date = new Date(getYear(currentDate), getMonth(currentDate), day);
    const formattedDate = format(date, 'yyyy-MM-dd');
    deleteDailySession(formattedDate);
    toast({ title: "✅ تم الحذف", description: `تم حذف بيانات يوم ${formattedDate} بنجاح.` });
  }

  const handleExportDay = (e: React.MouseEvent, day: number) => {
    e.stopPropagation(); // Prevent dialog from opening
    const date = new Date(getYear(currentDate), getMonth(currentDate), day);
    const formattedDate = format(date, 'yyyy-MM-dd');
    const session = getSessionForDate(formattedDate);

    if (!session) {
        toast({ title: "لا توجد بيانات", description: "لا توجد سجلات لهذا اليوم لتصديرها.", variant: "destructive" });
        return;
    }

    const dayName = format(date, 'EEEE', { locale: ar });
    const readableDate = format(date, 'dd/MM/yyyy');
    
    let dataForSheet;
    
    if (session.sessionType === 'يوم عطلة') {
        dataForSheet = [{
            'التاريخ': readableDate,
            'اليوم': dayName,
            'نوع الحصة': 'يوم عطلة',
        }];
    } else {
        dataForSheet = (session.records ?? []).map(record => {
            const student = (students ?? []).find(s => s.id === record.studentId);
            return {
                'التاريخ': readableDate,
                'اليوم': dayName,
                'نوع الحصة': session.sessionType,
                'اسم الطالب': student?.fullName || 'غير معروف',
                'الحضور': record.attendance || '',
                'التقييم': record.memorization || '',
                'السلوك': record.behavior || '',
                'مراجعة': record.review ? 'نعم' : 'لا',
                'ملاحظات': record.notes || '',
            }
        });
    }

    const ws = XLSX.utils.json_to_sheet(dataForSheet);
    ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 12 },
        { wch: 12 }, { wch: 10 }, { wch: 30 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `سجل حصة ${formattedDate}`);
    XLSX.writeFile(wb, `سجل_حصة_${formattedDate}.xlsx`);
  }

  const renderCalendar = () => {
    const year = getYear(currentDate);
    const month = getMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getDay(startOfMonth(currentDate));
    
    const dayCells = [];
    const startDayIndex = (firstDayOfMonth + 1) % 7; 

    for (let i = 0; i < startDayIndex; i++) {
        dayCells.push(<div key={`empty-start-${i}`} className="p-2 border rounded-md"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        const formattedDayDate = format(dayDate, 'yyyy-MM-dd');
        const session = dailySessions ? dailySessions[formattedDayDate] : undefined;
        const isHoliday = session?.sessionType === 'يوم عطلة';
        
        let dayStatusClass = '';
        if (isHoliday) {
            dayStatusClass = 'bg-yellow-200 dark:bg-yellow-800';
        } else if (session) {
            dayStatusClass = 'bg-green-200 dark:bg-green-800';
        } else if (isPast(dayDate) && !isToday(dayDate)) {
             dayStatusClass = 'bg-red-200 dark:bg-red-900';
        }

      dayCells.push(
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={cn(
            "p-2 text-start border rounded-md transition-colors h-24 flex flex-col justify-between relative group",
            "hover:bg-accent hover:text-accent-foreground cursor-pointer",
            dayStatusClass
          )}
        >
            <div className="flex justify-between w-full items-start">
                 <span className="font-bold">{day}</span>
                 {session && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground/60 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                             <DropdownMenuItem onClick={(e) => handleExportDay(e, day)}>
                                <Download className="ml-2 h-4 w-4" />
                                <span>تحميل بيانات اليوم</span>
                            </DropdownMenuItem>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                                        <Trash2 className="ml-2 h-4 w-4" />
                                        <span>حذف بيانات اليوم</span>
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>هل أنت متأكد تمامًا؟</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        سيؤدي هذا إلى حذف جميع سجلات هذا اليوم نهائيًا. هذا الإجراء لا يمكن التراجع عنه.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={(e) => handleDeleteDay(e, day)}>نعم، قم بالحذف</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                         </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                 )}
            </div>
           <span className="text-xs text-muted-foreground self-end">{format(dayDate, 'EEEE', { locale: ar })}</span>
        </div>
      );
    }

    return dayCells;
  };
  
  const months = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i), 'MMMM', { locale: ar }));

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">إدارة الحصص اليومية</h1>
      
      <Card>
        <CardHeader>
           <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => handleYearChange(-1)}>
                    <ArrowRight className="h-4 w-4" />
                </Button>
                <CardTitle className="text-center text-2xl font-headline">
                    {format(currentDate, 'yyyy', { locale: ar })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => handleYearChange(1)}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            </div>
            <CardDescription className="text-center">
              {'اختر الشهر لعرض أيامه، ثم اضغط على اليوم المطلوب لتسجيل أو تعديل الحصة.'}
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
                {months.map((month, index) => (
                    <Button
                        key={month}
                        variant={getMonth(currentDate) === index ? 'default' : 'outline'}
                        onClick={() => handleMonthChange(index)}
                        className={cn(getMonth(new Date()) === index && getYear(new Date()) === getYear(currentDate) && "ring-2 ring-ring ring-offset-2")}
                    >
                        {month}
                    </Button>
                ))}
            </div>
            <div dir="rtl" className="grid grid-cols-7 gap-2 text-center font-bold mb-2">
                 {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {renderCalendar()}
            </div>
             <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-green-200 border"></div><span>يوم مسجل</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-yellow-200 border"></div><span>يوم عطلة</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-red-200 border"></div><span>يوم فائت</span></div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-background border"></div><span>يوم قادم</span></div>
            </div>
        </CardContent>
      </Card>
      
      {selectedDay && (
        <Dialog open={isSessionDialogOpen} onOpenChange={setSessionDialogOpen}>
          <DialogContent className="max-w-7xl h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-headline">
                {`سجل الحصة ليوم: ${format(selectedDay, 'EEEE, d MMMM yyyy', { locale: ar })}`}
              </DialogTitle>
              <DialogDescription>
                قم بتسجيل بيانات الحصة للطلبة النشطين في هذا اليوم. سيتم الحفظ تلقائيًا في قاعدة البيانات.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto pr-4">
              <DailySessionForm 
                day={selectedDay} 
                students={activeStudents}
                onClose={() => setSessionDialogOpen(false)}
                addDailySession={addDailySession}
                getSessionForDate={getSessionForDate}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


interface DailySessionFormProps {
    day: Date;
    students: Student[];
    onClose: () => void;
    addDailySession: (session: DailySession) => void;
    getSessionForDate: (date: string) => DailySession | undefined;
}


function DailySessionForm({ day, students, onClose, addDailySession, getSessionForDate }: DailySessionFormProps) {
  const [sessionType, setSessionType] = useState<SessionType>('حصة أساسية');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    const existingSession = getSessionForDate(formattedDate);

    if (existingSession) {
        setSessionType(existingSession.sessionType);
        if (existingSession.sessionType === 'يوم عطلة') {
            setRecords([]);
        } else {
             const updatedRecords = (students ?? []).map(s => {
                const existingRec = (existingSession.records ?? []).find(r => r.studentId === s.id);
                return existingRec || {
                    studentId: s.id,
                    attendance: 'حاضر',
                    memorization: null, review: false, behavior: 'هادئ',
                    notes: '',
                };
            });
            setRecords(updatedRecords);
        }
    } else {
        const initialRecords = (students ?? []).map(s => ({
            studentId: s.id,
            attendance: 'حاضر',
            memorization: null, review: false, behavior: 'هادئ',
            notes: '',
        }));
        setRecords(initialRecords);
        setSessionType('حصة أساسية');
    }
  }, [day, students, getSessionForDate]);

  const handleRecordChange = <K extends keyof DailyRecord>(studentId: string, field: K, value: DailyRecord[K]) => {
    setRecords(prevRecords =>
      prevRecords.map(rec => {
        if (rec.studentId === studentId) {
          const updatedRec = { ...rec, [field]: value };
          if (field === 'attendance' && value === 'غائب') {
            updatedRec.memorization = null; updatedRec.review = false;
            updatedRec.behavior = 'هادئ';
          }
          return updatedRec;
        }
        return rec;
      })
    );
  };

  const handleSave = () => {
    setIsLoading(true);
    const formattedDate = format(day, 'yyyy-MM-dd');
    
    const sessionToSave: DailySession = {
        date: formattedDate,
        sessionType: sessionType,
        records: sessionType === 'يوم عطلة' ? [] : records,
    };
    addDailySession(sessionToSave);
    
    setIsLoading(false);
    onClose();
  }

  const isActivitySession = sessionType === 'حصة أنشطة';
  const isHoliday = sessionType === 'يوم عطلة';
  const isMakeupSession = sessionType === 'حصة تعويضية';

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Label className="font-bold">نوع الحصة:</Label>
          <div className="flex items-center gap-2">
            <Select dir="rtl" value={sessionType} onValueChange={(value: SessionType) => setSessionType(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="اختر نوع الحصة" />
              </SelectTrigger>
              <SelectContent>
                {sessionTypeOptions.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sessionTypeDescriptions[sessionType]}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

       { !isHoliday && <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">الطالب</TableHead>
                <TableHead className="w-[240px]">الحضُور</TableHead>
                {!isActivitySession && <TableHead className="w-[150px]">التقييم</TableHead>}
                {!isActivitySession && <TableHead className="w-[120px]">المراجعة</TableHead>}
                <TableHead className="w-[150px]">السلوك</TableHead>
                <TableHead className="min-w-[200px]">الملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(students ?? []).map(student => {
                const record = (records ?? []).find(r => r.studentId === student.id);
                if (!record) return null;
                const isAbsent = record.attendance === 'غائب';
                const isRowDisabled = isAbsent || (isActivitySession && !isMakeupSession);
                
                return (
                  <TableRow key={student.id} className={cn(isAbsent && 'bg-muted/50')}>
                    <TableCell className="font-medium">{student.fullName}</TableCell>
                    <TableCell>
                      <RadioGroup dir="rtl" value={record.attendance} onValueChange={(value: AttendanceStatus) => handleRecordChange(student.id, 'attendance', value)} className="flex gap-2 flex-wrap">
                        {attendanceOptions.map(opt => (
                           <div key={opt} className="flex items-center space-x-2 space-x-reverse">
                             <RadioGroupItem value={opt} id={`att-${opt}-${student.id}`} />
                             <Label htmlFor={`att-${opt}-${student.id}`}>{opt}</Label>
                           </div>
                        ))}
                      </RadioGroup>
                    </TableCell>
                    
                    {!isActivitySession && (
                      <>
                        <TableCell>
                          <Select dir="rtl" value={record.memorization ?? ''} onValueChange={(value: PerformanceLevel) => handleRecordChange(student.id, 'memorization', value)} disabled={isRowDisabled}>
                            <SelectTrigger><SelectValue placeholder="التقييم" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ممتاز">ممتاز</SelectItem><SelectItem value="جيد">جيد</SelectItem>
                              <SelectItem value="متوسط">متوسط</SelectItem><SelectItem value="ضعيف">ضعيف</SelectItem>
                              <SelectItem value="لا يوجد">لا يوجد</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Switch id={`review-${student.id}`} checked={record.review ?? false} onCheckedChange={(checked) => handleRecordChange(student.id, 'review', checked)} disabled={isRowDisabled}/>
                            <Label htmlFor={`review-${student.id}`}>{record.review ? 'تمت' : 'لم تتم'}</Label>
                          </div>
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Select dir="rtl" value={record.behavior ?? ''} onValueChange={(value: BehaviorLevel) => handleRecordChange(student.id, 'behavior', value)} disabled={isAbsent}>
                        <SelectTrigger><SelectValue placeholder="السلوك" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="هادئ">هادئ</SelectItem><SelectItem value="متوسط">متوسط</SelectItem>
                          <SelectItem value="غير منضبط">غير منضبط</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Textarea placeholder="ملاحظة (مثل سبب الغياب)..." value={record.notes ?? ''} onChange={(e) => handleRecordChange(student.id, 'notes', e.target.value)} className="h-10"/>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>}

         {isHoliday && (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-md h-full">
                <h3 className="text-xl font-bold">يوم عطلة</h3>
                <p className="text-muted-foreground">لن يتم تسجيل أي بيانات للطلبة في هذا اليوم.</p>
            </div>
        )}

        <DialogFooter className="mt-6">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={handleSave} disabled={isLoading}>
                {isLoading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ بيانات اليوم
            </Button>
        </DialogFooter>
      </div>
    </TooltipProvider>
  );
}
