
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useStudentContext } from '@/context/StudentContext';
import { surahs } from '@/lib/surahs';
import type { DailyRecord, SessionType, AttendanceStatus, PerformanceLevel, BehaviorLevel, Student, SessionRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ArrowLeft, ArrowRight, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { format, getMonth, getYear, setMonth, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths, isPast, isToday, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const sessionTypeDescriptions: { [key in SessionType]: string } = {
  'حصة أساسية': 'الحصة العادية لحفظ ومراجعة القرآن.',
  'حصة أنشطة': 'حصة مخصصة للأنشطة والترفيه، لا تتضمن حفظاً أو مراجعة.',
  'يوم عطلة': 'يوم لا توجد فيه حصص دراسية لجميع الطلبة.',
};

const attendanceOptions: AttendanceStatus[] = ["حاضر", "غائب", "متأخر", "تعويض"];
const sessionTypeOptions: SessionType[] = ["حصة أساسية", "حصة أنشطة", "يوم عطلة"];


export default function DailySessionsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isSessionDialogOpen, setSessionDialogOpen] = useState(false);
  
  const { students, dailyRecords, loading } = useStudentContext();
  const activeStudents = useMemo(() => 
    students.filter(s => s.status === "نشط"), 
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

  const renderCalendar = () => {
    const year = getYear(currentDate);
    const month = getMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDayOfMonth = getDay(startOfMonth(currentDate));
    
    const dayCells = [];
    // Adjust startDayIndex for Arabic calendar (Saturday is the first day)
    const startDayIndex = (firstDayOfMonth + 1) % 7; 

    for (let i = 0; i < startDayIndex; i++) {
        dayCells.push(<div key={`empty-start-${i}`} className="p-2 border rounded-md"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dayDate = new Date(year, month, day);
        const formattedDayDate = format(dayDate, 'yyyy-MM-dd');
        const holidayRecord = dailyRecords.find(r => r.date === formattedDayDate && r.studentId === 'holiday');
        const dayHasRecords = dailyRecords.some(r => r.date === formattedDayDate && r.studentId !== 'holiday');
        
        let dayStatusClass = '';
        if (holidayRecord) {
            dayStatusClass = 'bg-yellow-200 dark:bg-yellow-800';
        } else if (dayHasRecords) {
            dayStatusClass = 'bg-green-200 dark:bg-green-800';
        } else if (isPast(dayDate) && !isToday(dayDate)) {
             dayStatusClass = 'bg-red-200 dark:bg-red-900';
        }

      dayCells.push(
        <button
          key={day}
          onClick={() => handleDayClick(day)}
          className={cn(
            "p-2 text-center border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors h-24 flex flex-col items-start justify-between",
            dayStatusClass
          )}
        >
          <span className="font-bold">{day}</span>
           <span className="text-xs text-muted-foreground self-end">{format(dayDate, 'EEEE', { locale: ar })}</span>
        </button>
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
              اختر الشهر لعرض أيامه، ثم اضغط على اليوم المطلوب لتسجيل الحصة.
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
                قم بتسجيل بيانات الحصة للطلبة النشطين في هذا اليوم. سيتم الحفظ تلقائيًا في المتصفح.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto pr-4">
              <DailySessionForm 
                day={selectedDay} 
                students={activeStudents}
                onClose={() => setSessionDialogOpen(false)}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


function SurahCombobox({ value, onSelect, disabled }: { value?: number | null, onSelect: (surahId: number | null) => void, disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const selectedSurah = value ? surahs.find(s => s.id === value) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedSurah
            ? `${selectedSurah.id}. ${selectedSurah.name}`
            : "اختر السورة..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="ابحث عن سورة..." />
          <CommandList>
            <CommandEmpty>لم يتم العثور على سورة.</CommandEmpty>
            <CommandGroup>
              {surahs.map((surah) => (
                <CommandItem
                  key={surah.id}
                  value={`${surah.id} ${surah.name}`}
                  onSelect={() => {
                    onSelect(surah.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === surah.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {surah.id}. {surah.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function DailySessionForm({ day, students, onClose }: { day: Date, students: Student[], onClose: () => void }) {
  const { addMultipleDailyRecords, getRecordsForDate } = useStudentContext();
  const [sessionType, setSessionType] = useState<SessionType>('حصة أساسية');
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const formattedDate = format(day, 'yyyy-MM-dd');
    const existingRecords = getRecordsForDate(formattedDate);
    const holidayRecord = existingRecords.find(r => r.studentId === 'holiday');
    const existingSessionType = holidayRecord?.sessionType || existingRecords.find(r => r.sessionType)?.sessionType;

    if(existingSessionType) setSessionType(existingSessionType);
    
    if (holidayRecord) {
        setRecords([]);
    } else {
        const initialRecords = students.map(s => {
          const existing = existingRecords.find(r => r.studentId === s.id);
          if (existing) {
            return { ...existing };
          }
          return {
            studentId: s.id,
            attendance: 'حاضر',
            memorization: null,
            review: false,
            behavior: 'هادئ',
            notes: '',
            surahId: null,
            fromVerse: null,
            toVerse: null,
          };
        });
        setRecords(initialRecords);
    }
  }, [day, students, getRecordsForDate]);

  const handleRecordChange = <K extends keyof DailyRecord>(studentId: string, field: K, value: DailyRecord[K]) => {
    setRecords(prevRecords =>
      prevRecords.map(rec => {
        if (rec.studentId === studentId) {
          const updatedRec = { ...rec, [field]: value };
          if (field === 'attendance' && value === 'غائب') {
            updatedRec.memorization = null; updatedRec.review = false;
            updatedRec.behavior = 'هادئ'; updatedRec.surahId = null;
            updatedRec.fromVerse = null; updatedRec.toVerse = null;
            updatedRec.notes = '';
          }
           if (field === 'surahId') {
              const surah = surahs.find(s => s.id === (value as number));
              if (surah) {
                updatedRec.fromVerse = 1; updatedRec.toVerse = surah.verses;
              } else {
                updatedRec.fromVerse = null; updatedRec.toVerse = null;
              }
           }
          return updatedRec;
        }
        return rec;
      })
    );
  };

  const handleSave = async () => {
    setIsLoading(true);
    const formattedDate = format(day, 'yyyy-MM-dd');
    
    let recordsToSave: SessionRecord[] = [];

    if (sessionType === 'يوم عطلة') {
      recordsToSave.push({
          date: formattedDate,
          sessionType: 'يوم عطلة',
          studentId: 'holiday',
          attendance: 'غائب',
          memorization: null,
          review: null,
          behavior: null,
      });
    } else {
        recordsToSave = records.map(r => ({
          ...r,
          date: formattedDate,
          sessionType: sessionType,
        }));
    }
    
    try {
        await addMultipleDailyRecords(recordsToSave);
        onClose();
    } catch (error) {
        console.error("Failed to save session records:", error);
    } finally {
        setIsLoading(false);
    }
  }

  const isActivitySession = sessionType === 'حصة أنشطة';
  const isHoliday = sessionType === 'يوم عطلة';

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
                <TableHead className="w-[240px]">الحضور</TableHead>
                {!isActivitySession && <TableHead className="w-[150px]">التقييم</TableHead>}
                {!isActivitySession && <TableHead className="w-[180px]">السورة</TableHead>}
                {!isActivitySession && <TableHead className="w-[180px]">الآيات</TableHead>}
                {!isActivitySession && <TableHead className="w-[120px]">المراجعة</TableHead>}
                <TableHead className="w-[150px]">السلوك</TableHead>
                <TableHead className="min-w-[200px]">الملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(student => {
                const record = records.find(r => r.studentId === student.id);
                if (!record) return null;
                const isAbsent = record.attendance === 'غائب';
                const isRowDisabled = isActivitySession || isAbsent;
                const selectedSurah = record.surahId ? surahs.find(s => s.id === record.surahId) : null;
                
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
                            <SurahCombobox value={record.surahId} onSelect={(surahId) => handleRecordChange(student.id, 'surahId', surahId)} disabled={isRowDisabled}/>
                        </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-1">
                                <Input type="number" placeholder="من" min={1} max={selectedSurah?.verses} value={record.fromVerse ?? ''} onChange={(e) => handleRecordChange(student.id, 'fromVerse', e.target.value ? parseInt(e.target.value) : null)} disabled={isRowDisabled || !selectedSurah} className="w-16 h-9 text-center"/>
                                <span>-</span>
                                <Input type="number" placeholder="إلى" min={record.fromVerse ?? 1} max={selectedSurah?.verses} value={record.toVerse ?? ''} onChange={(e) => handleRecordChange(student.id, 'toVerse', e.target.value ? parseInt(e.target.value) : null)} disabled={isRowDisabled || !selectedSurah} className="w-16 h-9 text-center"/>
                           </div>
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
                      <Textarea placeholder="ملاحظة..." value={record.notes ?? ''} onChange={(e) => handleRecordChange(student.id, 'notes', e.target.value)} disabled={isAbsent && !record.notes} className="h-10"/>
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
