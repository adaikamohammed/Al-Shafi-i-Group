
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useStudentContext } from '@/context/StudentContext';
import { surahs } from '@/lib/surahs';
import type { DailyRecord, SessionType, AttendanceStatus, PerformanceLevel, BehaviorLevel, Surah, Student } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ArrowLeft, ArrowRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { format, getMonth, getYear, setMonth, setYear, getDaysInMonth, startOfMonth, getDay, addMonths, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';

const sessionTypeDescriptions: { [key in SessionType]: string } = {
  'حصة أساسية': 'الحصة العادية لحفظ ومراجعة القرآن.',
  'حصة إضافية 1': 'حصة إضافية مخصصة لبعض الطلبة لتقوية الحفظ أو المراجعة.',
  'حصة إضافية 2': 'حصة إضافية ثانية حسب الحاجة.',
  'حصة أنشطة': 'حصة مخصصة للأنشطة والترفيه، لا تتضمن حفظاً أو مراجعة.',
};

export default function DailySessionsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isSessionDialogOpen, setSessionDialogOpen] = useState(false);
  
  const { students } = useStudentContext();
  const activeStudents = useMemo(() => 
    students.filter(s => s.status === "نشط" || s.status === "غائب طويل"), 
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
    const firstDayOfMonth = getDay(startOfMonth(currentDate)); // 0 = Sunday, 1 = Monday...

    const dayCells = [];

    // Add empty cells for days before the first of the month
    // We adjust for RTL layout, starting from Saturday (6)
    const startDayIndex = (firstDayOfMonth + 1) % 7; // Convert Sunday=0 to Saturday=0 for our grid
    for (let i = 0; i < startDayIndex; i++) {
        dayCells.push(<div key={`empty-start-${i}`} className="p-2 border rounded-md"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      dayCells.push(
        <button
          key={day}
          onClick={() => handleDayClick(day)}
          className="p-2 text-center border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors h-20 flex flex-col items-start"
        >
          <span className="font-bold">{day}</span>
           <span className="text-xs text-muted-foreground">{format(new Date(year, month, day), 'EEEE', { locale: ar })}</span>
        </button>
      );
    }

    return dayCells;
  };
  
  const months = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i), 'MMMM', { locale: ar }));

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

            <div className="grid grid-cols-7 gap-2 text-center font-bold mb-2">
                 {['سبت', 'أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'].map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
                {renderCalendar()}
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
                قم بتسجيل بيانات الحصة للطلبة النشطين في هذا اليوم.
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto pr-4">
              <DailySessionForm day={format(selectedDay, 'EEEE')} students={activeStudents} />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}


// This component remains largely the same, but is now used within the Dialog
function DailySessionForm({ day, students }: { day: string, students: Student[] }) {
  const [sessionType, setSessionType] = useState<SessionType>('حصة أساسية');
  const [records, setRecords] = useState<DailyRecord[]>(
    students.map(s => ({
      studentId: s.id,
      attendance: 'حاضر',
      memorization: null,
      review: null,
      behavior: 'هادئ',
      notes: '',
      surahId: null,
      fromVerse: null,
      toVerse: null,
    }))
  );

  const handleRecordChange = <K extends keyof DailyRecord>(studentId: string, field: K, value: DailyRecord[K]) => {
    setRecords(prevRecords =>
      prevRecords.map(rec => {
        if (rec.studentId === studentId) {
          const updatedRec = { ...rec, [field]: value };
          if (field === 'attendance' && (value === 'غير مطالب' || value === 'غائب')) {
            updatedRec.memorization = null;
            updatedRec.review = null;
            updatedRec.behavior = null;
            updatedRec.surahId = null;
            updatedRec.fromVerse = null;
            updatedRec.toVerse = null;
          }
           if (field === 'surahId') {
            updatedRec.fromVerse = 1;
            updatedRec.toVerse = null;
          }
          return updatedRec;
        }
        return rec;
      })
    );
  };

  const isActivitySession = sessionType === 'حصة أنشطة';

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Label htmlFor={`session-type-${day}`} className="font-bold">نوع الحصة:</Label>
          <div className="flex items-center gap-2">
            <Select dir="rtl" value={sessionType} onValueChange={(value: SessionType) => setSessionType(value)}>
              <SelectTrigger id={`session-type-${day}`} className="w-[200px]">
                <SelectValue placeholder="اختر نوع الحصة" />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(sessionTypeDescriptions).map(type => (
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

        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">الطالب</TableHead>
                <TableHead className="w-[240px]">الحضور</TableHead>
                {!isActivitySession && <TableHead className="w-[150px]">التقييم</TableHead>}
                {!isActivitySession && <TableHead className="w-[180px]">السورة</TableHead>}
                {!isActivitySession && <TableHead className="w-[180px]">الآيات</TableHead>}
                {!isActivitySession && <TableHead className="w-[120px]">التقدم</TableHead>}
                {!isActivitySession && <TableHead className="w-[120px]">المراجعة</TableHead>}
                <TableHead className="w-[150px]">السلوك</TableHead>
                <TableHead className="min-w-[200px]">الملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(student => {
                const record = records.find(r => r.studentId === student.id);
                if (!record) return null;
                const isNotRequired = record.attendance === 'غير مطالب';
                const isAbsent = record.attendance === 'غائب';
                const isRowDisabled = isNotRequired || isActivitySession || isAbsent;
                const selectedSurah = record.surahId ? surahs.find(s => s.id === record.surahId) : null;
                const progress = selectedSurah && record.toVerse ? Math.round((record.toVerse / selectedSurah.verses) * 100) : 0;
                
                return (
                  <TableRow key={student.id} className={cn((isNotRequired || isAbsent) && 'bg-muted/50')}>
                    <TableCell className="font-medium">{student.fullName}</TableCell>
                    <TableCell>
                      <RadioGroup
                        dir="rtl"
                        value={record.attendance}
                        onValueChange={(value: AttendanceStatus) => handleRecordChange(student.id, 'attendance', value)}
                        className="flex gap-2 flex-wrap"
                      >
                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="حاضر" id={`att-present-${student.id}-${day}`} /><Label htmlFor={`att-present-${student.id}-${day}`}>حاضر</Label></div>
                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="غائب" id={`att-absent-${student.id}-${day}`} /><Label htmlFor={`att-absent-${student.id}-${day}`}>غائب</Label></div>
                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="متأخر" id={`att-late-${student.id}-${day}`} /><Label htmlFor={`att-late-${student.id}-${day}`}>متأخر</Label></div>
                        <div className="flex items-center space-x-2 space-x-reverse"><RadioGroupItem value="غير مطالب" id={`att-notreq-${student.id}-${day}`} /><Label htmlFor={`att-notreq-${student.id}-${day}`}>غير مطالب</Label></div>
                      </RadioGroup>
                    </TableCell>
                    
                    {!isActivitySession && (
                      <>
                        <TableCell>
                          <Select
                            dir="rtl"
                            value={record.memorization ?? ''}
                            onValueChange={(value: PerformanceLevel) => handleRecordChange(student.id, 'memorization', value)}
                            disabled={isRowDisabled}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="التقييم" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ممتاز">ممتاز</SelectItem>
                              <SelectItem value="جيد">جيد</SelectItem>
                              <SelectItem value="متوسط">متوسط</SelectItem>
                              <SelectItem value="ضعيف">ضعيف</SelectItem>
                              <SelectItem value="لا يوجد">لا يوجد</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                           <Select
                                dir="rtl"
                                value={record.surahId?.toString() ?? ''}
                                onValueChange={(value) => {
                                  const surahId = parseInt(value);
                                  const surah = surahs.find(s => s.id === surahId);
                                  if (surah) {
                                      handleRecordChange(student.id, 'surahId', surahId);
                                      handleRecordChange(student.id, 'fromVerse', 1);
                                      handleRecordChange(student.id, 'toVerse', null);
                                  }
                                }}
                                disabled={isRowDisabled}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر السورة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {surahs.map(surah => (
                                        <SelectItem key={surah.id} value={surah.id.toString()}>{surah.id}. {surah.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </TableCell>
                         <TableCell>
                           <div className="flex items-center gap-1">
                                <Input
                                    type="number"
                                    placeholder="من"
                                    min={1}
                                    max={selectedSurah?.verses}
                                    value={record.fromVerse ?? ''}
                                    onChange={(e) => {
                                        const from = e.target.value ? parseInt(e.target.value) : null;
                                        if (from === null || (selectedSurah && from <= (record.toVerse ?? selectedSurah.verses))) {
                                            handleRecordChange(student.id, 'fromVerse', from);
                                        }
                                    }}
                                    disabled={isRowDisabled || !selectedSurah}
                                    className="w-16 h-9 text-center"
                                />
                                <span>-</span>
                                <Input
                                    type="number"
                                    placeholder="إلى"
                                    min={record.fromVerse ?? 1}
                                    max={selectedSurah?.verses}
                                    value={record.toVerse ?? ''}
                                     onChange={(e) => {
                                        const to = e.target.value ? parseInt(e.target.value) : null;
                                        if (to === null || (selectedSurah && to >= (record.fromVerse ?? 1) && to <= selectedSurah.verses)) {
                                          handleRecordChange(student.id, 'toVerse', to);
                                        }
                                     }}
                                    disabled={isRowDisabled || !selectedSurah}
                                    className="w-16 h-9 text-center"
                                />
                           </div>
                        </TableCell>
                        <TableCell>
                            {selectedSurah && record.fromVerse && record.toVerse && (
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="w-16" />
                                    <span className="text-xs text-muted-foreground">{progress}%</span>
                                </div>
                            )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Switch
                              id={`review-${student.id}-${day}`}
                              checked={record.review ?? false}
                              onCheckedChange={(checked) => handleRecordChange(student.id, 'review', checked)}
                              disabled={isRowDisabled}
                            />
                            <Label htmlFor={`review-${student.id}-${day}`}>{record.review ? 'تمت' : 'لم تتم'}</Label>
                          </div>
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Select
                        dir="rtl"
                        value={record.behavior ?? ''}
                        onValueChange={(value: BehaviorLevel) => handleRecordChange(student.id, 'behavior', value)}
                        disabled={isNotRequired || isAbsent}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="السلوك" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="هادئ">هادئ</SelectItem>
                          <SelectItem value="متوسط">متوسط</SelectItem>
                          <SelectItem value="غير منضبط">غير منضبط</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Textarea
                        placeholder="ملاحظة..."
                        value={record.notes ?? ''}
                        onChange={(e) => handleRecordChange(student.id, 'notes', e.target.value)}
                        disabled={isNotRequired && !record.notes && !isAbsent}
                        className="h-10"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end mt-6">
          <Button>حفظ بيانات يوم {day}</Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

