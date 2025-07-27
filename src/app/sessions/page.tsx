"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { students } from '@/lib/data';
import type { DailyRecord, Student } from '@/lib/types';

const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export default function DailySessionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">إدارة الحصص اليومية</h1>
      <Card>
        <CardHeader>
          <CardTitle>سجل الحصص الأسبوعي</CardTitle>
          <CardDescription>
            قم بتسجيل أداء الطلبة لكل يوم من أيام الدراسة.
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
  const [records, setRecords] = useState<DailyRecord[]>(
    students.map(s => ({
      studentId: s.id,
      attendance: 'حاضر',
      memorization: 'جيد',
      review: true,
      behavior: 'هادئ',
    }))
  );

  const handleRecordChange = (studentId: string, field: keyof DailyRecord, value: any) => {
    setRecords(prevRecords =>
      prevRecords.map(rec =>
        rec.studentId === studentId ? { ...rec, [field]: value } : rec
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الطالب</TableHead>
              <TableHead>الحضور</TableHead>
              <TableHead>الحفظ</TableHead>
              <TableHead>المراجعة</TableHead>
              <TableHead>السلوك</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map(student => {
              const record = records.find(r => r.studentId === student.id);
              if (!record) return null;

              return (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.fullName}</TableCell>
                  <TableCell>
                    <RadioGroup
                      dir="rtl"
                      defaultValue={record.attendance}
                      onValueChange={(value) => handleRecordChange(student.id, 'attendance', value)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="حاضر" id={`att-present-${student.id}-${day}`} />
                        <Label htmlFor={`att-present-${student.id}-${day}`}>حاضر</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="غائب" id={`att-absent-${student.id}-${day}`} />
                        <Label htmlFor={`att-absent-${student.id}-${day}`}>غائب</Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="متأخر" id={`att-late-${student.id}-${day}`} />
                        <Label htmlFor={`att-late-${student.id}-${day}`}>متأخر</Label>
                      </div>
                    </RadioGroup>
                  </TableCell>
                  <TableCell>
                    <Select
                      dir="rtl"
                      defaultValue={record.memorization}
                      onValueChange={(value) => handleRecordChange(student.id, 'memorization', value)}
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
                  <TableCell>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Switch 
                        id={`review-${student.id}-${day}`} 
                        checked={record.review}
                        onCheckedChange={(checked) => handleRecordChange(student.id, 'review', checked)}
                      />
                      <Label htmlFor={`review-${student.id}-${day}`}>{record.review ? 'تمت' : 'لم تتم'}</Label>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      dir="rtl"
                      defaultValue={record.behavior}
                      onValueChange={(value) => handleRecordChange(student.id, 'behavior', value)}
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
  );
}
