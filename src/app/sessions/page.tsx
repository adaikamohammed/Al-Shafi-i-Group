"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { students } from '@/lib/data';
import type { DailyRecord, Student, SessionType, AttendanceStatus, PerformanceLevel, BehaviorLevel } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const sessionTypeDescriptions: { [key in SessionType]: string } = {
  'حصة أساسية': 'الحصة العادية لحفظ ومراجعة القرآن.',
  'حصة إضافية 1': 'حصة إضافية مخصصة لبعض الطلبة لتقوية الحفظ أو المراجعة.',
  'حصة إضافية 2': 'حصة إضافية ثانية حسب الحاجة.',
  'حصة أنشطة': 'حصة مخصصة للأنشطة والترفيه، لا تتضمن حفظاً أو مراجعة.',
};

export default function DailySessionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">إدارة الحصص اليومية</h1>
      <Card>
        <CardHeader>
          <CardTitle>سجل الحصص الأسبوعي</CardTitle>
          <CardDescription>
            قم بتسجيل أداء الطلبة لكل يوم من أيام الدراسة واختر نوع الحصة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {daysOfWeek.map(day => (
              <AccordionItem value={day} key={day}>
                <AccordionTrigger className="text-xl font-headline">{`يوم ${day}`}</AccordionTrigger>
                <AccordionContent>
                  <DailySessionForm day={day} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}

function DailySessionForm({ day }: { day: string }) {
  const [sessionType, setSessionType] = useState<SessionType>('حصة أساسية');
  const [records, setRecords] = useState<DailyRecord[]>(
    students.map(s => ({
      studentId: s.id,
      attendance: 'حاضر',
      memorization: 'جيد',
      review: true,
      behavior: 'هادئ',
      notes: '',
    }))
  );

  const handleRecordChange = <K extends keyof DailyRecord>(studentId: string, field: K, value: DailyRecord[K]) => {
    setRecords(prevRecords =>
      prevRecords.map(rec => {
        if (rec.studentId === studentId) {
          const updatedRec = { ...rec, [field]: value };
          // If student is "Not Required", disable other fields
          if (field === 'attendance' && value === 'غير مطالب') {
            updatedRec.memorization = null;
            updatedRec.review = null;
            updatedRec.behavior = null;
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطالب</TableHead>
                <TableHead className="w-[250px]">الحضور</TableHead>
                {!isActivitySession && <TableHead>الحفظ</TableHead>}
                {!isActivitySession && <TableHead>المراجعة</TableHead>}
                <TableHead>السلوك</TableHead>
                <TableHead className="min-w-[200px]">الملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(student => {
                const record = records.find(r => r.studentId === student.id);
                if (!record) return null;
                const isNotRequired = record.attendance === 'غير مطالب';
                const isRowDisabled = isNotRequired || isActivitySession;

                return (
                  <TableRow key={student.id} className={cn(isNotRequired && 'bg-muted/50')}>
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
                      <TableCell>
                        <Select
                          dir="rtl"
                          value={record.memorization ?? ''}
                          onValueChange={(value: PerformanceLevel) => handleRecordChange(student.id, 'memorization', value)}
                          disabled={isNotRequired}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue placeholder="التقييم" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ممتاز">ممتاز</SelectItem>
                            <SelectItem value="جيد">جيد</SelectItem>
                            <SelectItem value="متوسط">متوسط</SelectItem>
                            <SelectItem value="ضعيف">ضعيف</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    )}
                    {!isActivitySession && (
                      <TableCell>
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <Switch
                            id={`review-${student.id}-${day}`}
                            checked={record.review ?? false}
                            onCheckedChange={(checked) => handleRecordChange(student.id, 'review', checked)}
                            disabled={isNotRequired}
                          />
                          <Label htmlFor={`review-${student.id}-${day}`}>{record.review ? 'تمت' : 'لم تتم'}</Label>
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      <Select
                        dir="rtl"
                        value={record.behavior ?? ''}
                        onValueChange={(value: BehaviorLevel) => handleRecordChange(student.id, 'behavior', value)}
                        disabled={isNotRequired}
                      >
                        <SelectTrigger className="w-[120px]">
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
                        disabled={isNotRequired && !record.notes}
                        className="h-10"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end">
          <Button>حفظ بيانات يوم {day}</Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
