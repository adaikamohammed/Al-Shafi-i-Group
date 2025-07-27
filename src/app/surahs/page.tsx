"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { students } from '@/lib/data';
import { surahs } from '@/lib/surahs';
import type { SurahStatus, SurahProgress } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, FilePen, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'


const statusVariant: { [key in SurahStatus]: "default" | "destructive" | "secondary" | "outline" } = {
  "تم الحفظ": "default",
  "تمت التلقين": "default",
  "قيد الحفظ": "secondary",
  "تمت المراجعة": "secondary",
  "مراجعة جماعية": "secondary",
  "مؤجلة مؤقتًا": "outline",
  "إعادة حفظ": "destructive",
};

const statusColor: { [key in SurahStatus]: string } = {
    "تم الحفظ": "bg-green-100 text-green-800 border-green-300",
    "تمت التلقين": "bg-blue-100 text-blue-800 border-blue-300",
    "تمت المراجعة": "bg-orange-100 text-orange-800 border-orange-300",
    "قيد الحفظ": "bg-yellow-100 text-yellow-800 border-yellow-300",
    "مراجعة جماعية": "bg-purple-100 text-purple-800 border-purple-300",
    "مؤجلة مؤقتًا": "bg-gray-100 text-gray-800 border-gray-300",
    "إعادة حفظ": "bg-red-100 text-red-800 border-red-300",
};


// Mock initial progress data
const initialProgress: SurahProgress[] = students.map(s => {
    const currentSurah = surahs[s.memorizedSurahsCount] || surahs[0];
    return {
        studentId: s.id,
        surahId: currentSurah.id,
        surahName: currentSurah.name,
        status: 'قيد الحفظ',
        fromVerse: 1,
        toVerse: Math.floor(currentSurah.verses / 4), // Mock progress
        totalVerses: currentSurah.verses,
        startDate: new Date(),
        retakeCount: 0,
        notes: ''
    }
});


export default function SurahProgressPage() {
  const [studentProgress, setStudentProgress] = useState(initialProgress);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SurahProgress | null>(null);

  const handleSurahChange = (studentId: string, newSurahId: string) => {
    const studentData = studentProgress.find(p => p.studentId === studentId);
    if (studentData) {
        setSelectedStudent(studentData);
        setShowConfirmation(true);
    }
     // Actual logic will be in handleConfirmation
  };

  const handleConfirmation = (confirm: boolean) => {
    if (confirm && selectedStudent) {
       setStudentProgress(prev => prev.map(p => {
        if (p.studentId === selectedStudent.studentId) {
            const newSurah = surahs.find(s => s.id === p.surahId + 1);
            if(newSurah){
                return {
                    ...p,
                    surahId: newSurah.id,
                    surahName: newSurah.name,
                    fromVerse: 1,
                    toVerse: 1,
                    totalVerses: newSurah.verses,
                    status: 'قيد الحفظ',
                    startDate: new Date(),
                    completionDate: undefined,
                    retakeCount: 0,
                };
            }
        }
        return p;
       }));
    } else if (!confirm && selectedStudent) {
         setStudentProgress(prev => prev.map(p => {
            if (p.studentId === selectedStudent.studentId) {
                 return { ...p, retakeCount: (p.retakeCount || 0) + 1, status: 'إعادة حفظ' };
            }
            return p;
         }));
    }
    setShowConfirmation(false);
    setSelectedStudent(null);
  };
  

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-headline font-bold">متابعة حفظ السور</h1>
      <Card>
        <CardHeader>
          <CardTitle>تقدم الطلبة في الحفظ</CardTitle>
          <CardDescription>
            تتبع حالة الحفظ لكل طالب، سجل التواريخ والملاحظات، وتابع التقدم بدقة.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>السورة الجارية</TableHead>
                  <TableHead>التقدم</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.filter(s => s.status === 'نشط').map((student) => {
                    const progressData = studentProgress.find(p => p.studentId === student.id);
                    if (!progressData) return null;

                    const progressPercentage = Math.round((progressData.toVerse / progressData.totalVerses) * 100);

                    return (
                        <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.fullName}</TableCell>
                            <TableCell>
                                <Select 
                                    dir="rtl" 
                                    value={progressData.surahId.toString()}
                                    onValueChange={(newId) => handleSurahChange(student.id, newId)}
                                >
                                <SelectTrigger className="w-[160px]">
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
                                <div className="flex items-center gap-2 w-[200px]">
                                  <Progress value={progressPercentage} className="w-[100px]" />
                                  <span className="text-sm text-muted-foreground">{progressPercentage}% ({progressData.toVerse}/{progressData.totalVerses})</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={statusVariant[progressData.status]} className={cn(statusColor[progressData.status])}>
                                    {progressData.status}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <EditProgressDialog progress={progressData} />
                            </TableCell>
                        </TableRow>
                    );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {selectedStudent && (
         <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>تثبيت السورة: {surahs.find(s => s.id === selectedStudent.surahId)?.name}</AlertDialogTitle>
                <AlertDialogDescription>
                    هل أتقن الطالب "{students.find(s => s.id === selectedStudent.studentId)?.fullName}" السورة الحالية بشكل جيد؟
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogAction onClick={() => handleConfirmation(true)}>
                    ✅ نعم، أتقنها (انتقل للتالية)
                </AlertDialogAction>
                <AlertDialogAction onClick={() => handleConfirmation(false)} variant="destructive">
                    🔁 لا، لم يتقنها (إعادة حفظ)
                </AlertDialogAction>
                 <AlertDialogCancel onClick={() => setShowConfirmation(false)}>إلغاء</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

function EditProgressDialog({ progress }: { progress: SurahProgress }) {
    const [isOpen, setIsOpen] = useState(false);
    const [startDate, setStartDate] = useState<Date | undefined>(progress.startDate);
    const [completionDate, setCompletionDate] = useState<Date | undefined>(progress.completionDate);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <FilePen className="ml-2 h-3 w-3" />
                    تعديل
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>تعديل تقدم: {students.find(s => s.id === progress.studentId)?.fullName}</DialogTitle>
                    <DialogDescription>
                        السورة الحالية: {progress.surahName}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>من آية</Label>
                            <Input type="number" defaultValue={progress.fromVerse} className="w-full" />
                        </div>
                        <div className="space-y-2">
                            <Label>إلى آية</Label>
                            <Input type="number" defaultValue={progress.toVerse} className="w-full" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>الحالة</Label>
                             <Select dir="rtl" defaultValue={progress.status}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الحالة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.keys(statusVariant).map(status => (
                                        <SelectItem key={status} value={status}>{status}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>عدد مرات الإعادة</Label>
                            <Input type="number" defaultValue={progress.retakeCount} className="w-full" />
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>تاريخ بدء السورة</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-right font-normal", !startDate && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {startDate ? format(startDate, "PPP", { locale: ar }) : <span>اختر تاريخًا</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                         </div>
                         <div className="space-y-2">
                             <Label>تاريخ إتمام السورة</Label>
                             <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-right font-normal", !completionDate && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="ml-2 h-4 w-4" />
                                    {completionDate ? format(completionDate, "PPP", { locale: ar }) : <span>اختر تاريخًا</span>}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={completionDate} onSelect={setCompletionDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                         </div>
                     </div>
                     <div className="space-y-2">
                        <Label>ملاحظات الشيخ</Label>
                        <Textarea defaultValue={progress.notes} placeholder="ملاحظات حول أداء الطالب في هذه السورة..."/>
                     </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>إلغاء</Button>
                    <Button onClick={() => setIsOpen(false)}>
                        <Save className="ml-2 h-4 w-4" />
                        حفظ التغييرات
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
