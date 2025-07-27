"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { students } from '@/lib/data';
import { surahs } from '@/lib/surahs';
import type { SurahStatus } from '@/lib/types';

export default function SurahProgressPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">متابعة حفظ السور</h1>
      <Card>
        <CardHeader>
          <CardTitle>تقدم الطلبة في الحفظ</CardTitle>
          <CardDescription>
            تتبع حالة الحفظ لكل طالب وحدد السورة الحالية والنطاق.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>نسبة الإنجاز</TableHead>
                  <TableHead>السورة الجارية</TableHead>
                  <TableHead>من آية</TableHead>
                  <TableHead>إلى آية</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.filter(s => s.status === 'نشط').map((student) => {
                  const progress = Math.round((student.memorizedSurahsCount / 114) * 100);
                  const currentSurah = surahs[student.memorizedSurahsCount] || surahs[0];
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.fullName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="w-[100px]" />
                          <span>{progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select dir="rtl" defaultValue={currentSurah.id.toString()}>
                          <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="اختر السورة" />
                          </SelectTrigger>
                          <SelectContent>
                            {surahs.map(surah => (
                              <SelectItem key={surah.id} value={surah.id.toString()}>
                                {surah.id}. {surah.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" defaultValue="1" className="w-[70px]" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" defaultValue="10" className="w-[70px]" />
                      </TableCell>
                      <TableCell>
                        <Select dir="rtl" defaultValue="قيد الحفظ">
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="الحالة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="قيد الحفظ">قيد الحفظ</SelectItem>
                            <SelectItem value="تم الحفظ">تم الحفظ</SelectItem>
                            <SelectItem value="تم التلقين">تم التلقين</SelectItem>
                            <SelectItem value="مراجعة">مراجعة</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="outline">حفظ</Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
